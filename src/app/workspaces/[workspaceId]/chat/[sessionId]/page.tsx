import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Workspace } from "@/models/Workspace";
import { Session } from "@/models/Session";
import { Chat } from "@/models/Chat";
import mongoose from "mongoose";

interface ChatSessionPageProps {
  params: Promise<{
    workspaceId: string;
    sessionId: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function WorkspaceChatSessionPage({ params }: ChatSessionPageProps) {
  const userSession = await auth();
  if (!userSession?.user) {
    redirect("/auth/login");
  }

  const { workspaceId, sessionId } = await params;
  const userId = userSession.user.id;

  await connectToDatabase();

  const wId = new mongoose.Types.ObjectId(workspaceId);
  const sId = new mongoose.Types.ObjectId(sessionId);
  const uId = new mongoose.Types.ObjectId(userId);

  // 1. Verify workspace and user membership
  const workspace = await Workspace.findOne({
    _id: wId,
    "members.user": uId,
  });

  if (!workspace) {
    redirect("/dashboard");
  }

  // 2. Verify chat session exists and belongs to this workspace
  const chatSession = await Session.findOne({
    _id: sId,
    workspaceId: wId,
  });

  if (!chatSession) {
    redirect(`/workspaces/${workspaceId}`);
  }

  // 3. Find the most recent chat under this session
  let latestChat = await Chat.findOne({ sessionId: sId }).sort({ updatedAt: -1 });

  // 4. If no chat exists under this session, create a default one
  if (!latestChat) {
    latestChat = await Chat.create({
      sessionId: sId,
      title: "New Chat",
    });
  }

  // 5. Redirect to the chat page
  redirect(`/workspaces/${workspaceId}/chat/${sessionId}/${latestChat._id.toString()}`);
}
