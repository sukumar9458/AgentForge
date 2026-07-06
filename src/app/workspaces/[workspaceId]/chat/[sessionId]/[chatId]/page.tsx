import React from "react";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Workspace } from "@/models/Workspace";
import { Session } from "@/models/Session";
import { Chat } from "@/models/Chat";
import { Message } from "@/models/Message";
import AgentConsole from "@/components/workspace/AgentConsole";
import mongoose from "mongoose";

interface ChatPageProps {
  params: Promise<{
    workspaceId: string;
    sessionId: string;
    chatId: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function WorkspaceChatPage({ params }: ChatPageProps) {
  const userSession = await auth();
  if (!userSession?.user) {
    redirect("/auth/login");
  }

  const { workspaceId, sessionId, chatId } = await params;
  const userId = userSession.user.id;

  await connectToDatabase();

  const wId = new mongoose.Types.ObjectId(workspaceId);
  const sId = new mongoose.Types.ObjectId(sessionId);
  const cId = new mongoose.Types.ObjectId(chatId);
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

  // 3. Verify chat thread exists and belongs to this session
  const chatThread = await Chat.findOne({
    _id: cId,
    sessionId: sId,
  });

  if (!chatThread) {
    redirect(`/workspaces/${workspaceId}/chat/${sessionId}`);
  }

  // 4. Load historical messages for this specific chat thread
  const messagesDocs = await Message.find({
    chatId: cId,
  }).sort({ createdAt: 1 }).lean();

  const formattedMessages = messagesDocs.map((msg: any) => ({
    _id: msg._id.toString(),
    sender: msg.sender,
    senderType: msg.senderType,
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
    steps: msg.steps?.map((step: any) => ({
      agentName: step.agentName,
      action: step.action,
      timestamp: step.timestamp.toISOString(),
      duration: step.duration,
      output: step.output,
    })),
  }));

  return (
    <AgentConsole
      sessionId={sessionId}
      chatId={chatId}
      workspaceId={workspaceId}
      initialMessages={formattedMessages}
      userName={userSession.user.name || "User"}
    />
  );
}
