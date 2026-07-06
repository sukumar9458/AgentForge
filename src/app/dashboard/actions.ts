"use server";

import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Workspace } from "@/models/Workspace";
import { Session } from "@/models/Session";
import { User } from "@/models/User";
import { ActivityLog } from "@/models/ActivityLog";
import { Message } from "@/models/Message";
import { Chat } from "@/models/Chat";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";

export interface WorkspaceState {
  success: boolean;
  error?: string;
  workspaceId?: string;
}

export interface SessionState {
  success: boolean;
  error?: string;
  sessionId?: string;
}

export async function createWorkspace(
  prevState: any,
  formData: FormData
): Promise<WorkspaceState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;

  if (!name) {
    return { success: false, error: "Workspace name is required." };
  }

  try {
    await connectToDatabase();

    const uId = new mongoose.Types.ObjectId(session.user.id);

    const workspace = await Workspace.create({
      name,
      description,
      owner: uId,
      members: [
        {
          user: uId,
          role: "owner",
          joinedAt: new Date(),
        },
      ],
    });

    // Log action
    await ActivityLog.create({
      workspaceId: workspace._id,
      userId: uId,
      action: "create_workspace",
      details: `Created workspace "${name}"`,
    });

    revalidatePath("/dashboard");
    return { success: true, workspaceId: workspace._id.toString() };
  } catch (error) {
    console.error("Create workspace error:", error);
    return { success: false, error: "Failed to create workspace." };
  }
}

export async function createChatSession(
  workspaceId: string,
  title: string
): Promise<SessionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  if (!title) {
    return { success: false, error: "Session title is required." };
  }

  try {
    await connectToDatabase();

    const wId = new mongoose.Types.ObjectId(workspaceId);
    const uId = new mongoose.Types.ObjectId(session.user.id);

    // Verify workspace membership
    const workspace = await Workspace.findOne({
      _id: wId,
      "members.user": uId,
    });

    if (!workspace) {
      return { success: false, error: "Access denied or workspace not found." };
    }

    const newSession = await Session.create({
      workspaceId: wId,
      title,
      createdBy: uId,
    });

    // Log action
    await ActivityLog.create({
      workspaceId: wId,
      userId: uId,
      action: "create_session",
      details: `Created chat session "${title}"`,
    });

    revalidatePath(`/workspaces/${workspaceId}`);
    return { success: true, sessionId: newSession._id.toString() };
  } catch (error) {
    console.error("Create chat session error:", error);
    return { success: false, error: "Failed to create chat session." };
  }
}

export async function inviteWorkspaceMember(
  workspaceId: string,
  email: string,
  role: "admin" | "editor" | "viewer" = "editor"
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await connectToDatabase();

    const wId = new mongoose.Types.ObjectId(workspaceId);
    const actorId = new mongoose.Types.ObjectId(session.user.id);

    // Verify actor is owner or admin in workspace
    const workspace = await Workspace.findOne({
      _id: wId,
      members: {
        $elemMatch: {
          user: actorId,
          role: { $in: ["owner", "admin"] },
        },
      },
    });

    if (!workspace) {
      return { success: false, error: "Permission denied." };
    }

    // Find the user to invite
    const userToInvite = await User.findOne({ email: email.toLowerCase() });
    if (!userToInvite) {
      return { success: false, error: "User with this email not found." };
    }

    // Check if user is already a member
    const alreadyMember = workspace.members.some(
      (m: any) => m.user.toString() === userToInvite._id.toString()
    );

    if (alreadyMember) {
      return { success: false, error: "User is already a member of this workspace." };
    }

    // Add member
    workspace.members.push({
      user: userToInvite._id,
      role,
      joinedAt: new Date(),
    });

    await workspace.save();

    // Log action
    await ActivityLog.create({
      workspaceId: wId,
      userId: actorId,
      action: "invite_member",
      details: `Invited "${userToInvite.name}" as ${role}`,
    });

    revalidatePath(`/workspaces/${workspaceId}/settings`);
    return { success: true };
  } catch (error) {
    console.error("Invite workspace member error:", error);
    return { success: false, error: "Failed to invite member." };
  }
}

export async function clearSessionMessages(
  workspaceId: string,
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await connectToDatabase();

    const wId = new mongoose.Types.ObjectId(workspaceId);
    const sId = new mongoose.Types.ObjectId(sessionId);
    const uId = new mongoose.Types.ObjectId(session.user.id);

    // Verify workspace membership
    const workspace = await Workspace.findOne({
      _id: wId,
      "members.user": uId,
    });

    if (!workspace) {
      return { success: false, error: "Access denied." };
    }

    // Delete all messages associated with the session
    await Message.deleteMany({ sessionId: sId });

    // Log action
    await ActivityLog.create({
      workspaceId: wId,
      userId: uId,
      action: "clear_chat",
      details: "Cleared session chat history",
    });

    revalidatePath(`/workspaces/${workspaceId}/chat/${sessionId}`);
    return { success: true };
  } catch (error) {
    console.error("Clear chat session error:", error);
    return { success: false, error: "Failed to clear chat session." };
  }
}

export async function createChatThread(
  workspaceId: string,
  sessionId: string,
  title: string
): Promise<{ success: boolean; error?: string; chatId?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await connectToDatabase();

    const wId = new mongoose.Types.ObjectId(workspaceId);
    const sId = new mongoose.Types.ObjectId(sessionId);
    const uId = new mongoose.Types.ObjectId(session.user.id);

    // Verify workspace membership
    const workspace = await Workspace.findOne({
      _id: wId,
      "members.user": uId,
    });

    if (!workspace) {
      return { success: false, error: "Access denied." };
    }

    const newChat = await Chat.create({
      sessionId: sId,
      title: title || "New Chat",
    });

    // Log action
    await ActivityLog.create({
      workspaceId: wId,
      userId: uId,
      action: "create_chat_thread",
      details: `Created new chat thread "${title}"`,
    });

    revalidatePath(`/workspaces/${workspaceId}`);
    return { success: true, chatId: newChat._id.toString() };
  } catch (error) {
    console.error("Create chat thread error:", error);
    return { success: false, error: "Failed to create chat thread." };
  }
}

export async function deleteChatThread(
  workspaceId: string,
  chatId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await connectToDatabase();

    const wId = new mongoose.Types.ObjectId(workspaceId);
    const cId = new mongoose.Types.ObjectId(chatId);
    const uId = new mongoose.Types.ObjectId(session.user.id);

    // Verify workspace membership
    const workspace = await Workspace.findOne({
      _id: wId,
      "members.user": uId,
    });

    if (!workspace) {
      return { success: false, error: "Access denied." };
    }

    // Delete the chat thread itself
    await Chat.deleteOne({ _id: cId });

    // Delete all messages in the chat thread
    await Message.deleteMany({ chatId: cId });

    revalidatePath(`/workspaces/${workspaceId}`);
    return { success: true };
  } catch (error) {
    console.error("Delete chat thread error:", error);
    return { success: false, error: "Failed to delete chat thread." };
  }
}
