import React from "react";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Workspace } from "@/models/Workspace";
import { Session } from "@/models/Session";
import Link from "next/link";
import {
  MessageSquare,
  Plus,
  ArrowLeft,
  Settings,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Trash2,
  Clock,
} from "lucide-react";
import { createChatSession, createChatThread, deleteChatThread } from "@/app/dashboard/actions";
import { Chat } from "@/models/Chat";
import mongoose from "mongoose";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const userSession = await auth();
  if (!userSession?.user) {
    redirect("/auth/login");
  }

  const { workspaceId } = await params;
  const userId = userSession.user.id;

  await connectToDatabase();

  const wId = new mongoose.Types.ObjectId(workspaceId);
  const uId = new mongoose.Types.ObjectId(userId);

  // 1. Load workspace detail & check membership
  const workspace = await Workspace.findOne({
    _id: wId,
    "members.user": uId,
  });

  if (!workspace) {
    redirect("/dashboard");
  }

  // 2. Load sessions list and their child chat threads
  const sessionsDocs = await Session.find({ workspaceId: wId }).sort({ createdAt: -1 }).lean();
  const sessions = await Promise.all(
    sessionsDocs.map(async (s: any) => {
      const chatsDocs = await Chat.find({ sessionId: s._id }).sort({ createdAt: -1 }).lean();
      return {
        _id: s._id.toString(),
        title: s.title,
        chats: chatsDocs.map((c: any) => ({
          _id: c._id.toString(),
          title: c.title,
          createdAt: c.createdAt.toISOString(),
        })),
      };
    })
  );

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-100 overflow-hidden">
      
      {/* Workspace Left Sidebar */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 h-full">
        {/* Workspace Title Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{workspace.name}</h2>
            <span className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
              {workspace.description || "Sandbox Workspace"}
            </span>
          </div>
          <Link
            href="/dashboard"
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        {/* Workspace Operations Quick Links */}
        <div className="p-3 border-b border-slate-800 space-y-1">
          <Link
            href={`/workspaces/${workspaceId}`}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            <FolderOpen className="w-4 h-4 text-purple-400" />
            <span>Workspace Files (RAG)</span>
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/cron`}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>AI Cron Workflows</span>
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/settings`}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>Team & Settings</span>
          </Link>
        </div>

        {/* Sessions Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Agent Sessions
            </span>
            
            {/* Create Session Action Dialog wrapper */}
            <form
              action={async (formData) => {
                "use server";
                const title = formData.get("sessionTitle") as string;
                const result = await createChatSession(workspaceId, title);
                if (result.success && result.sessionId) {
                  redirect(`/workspaces/${workspaceId}/chat/${result.sessionId}`);
                }
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                name="sessionTitle"
                required
                placeholder="New Session..."
                className="bg-slate-950 border border-slate-800 text-[10px] text-white px-2 py-1 rounded placeholder-slate-500 focus:outline-none w-32"
              />
              <button
                type="submit"
                className="p-1 bg-white hover:bg-slate-200 text-black rounded cursor-pointer"
                title="Create session"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-3">
            {sessions.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-[10px]">
                No active chat sessions. Create one above!
              </div>
            ) : (
              sessions.map((s) => (
                <div key={s._id} className="space-y-1">
                  {/* Session Header Item */}
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-900/40 border border-slate-900/60 group">
                    <span className="truncate select-none">{s.title}</span>
                    
                    {/* Add Chat under Session Button */}
                    <form
                      action={async () => {
                        "use server";
                        const result = await createChatThread(workspaceId, s._id, "New Chat");
                        if (result.success && result.chatId) {
                          redirect(`/workspaces/${workspaceId}/chat/${s._id}/${result.chatId}`);
                        }
                      }}
                      className="m-0 hidden group-hover:block"
                    >
                      <button
                        type="submit"
                        className="p-0.5 hover:bg-slate-800 hover:text-white text-slate-400 rounded transition-colors cursor-pointer"
                        title="New chat in this session"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>

                  {/* Nested Chats List */}
                  <div className="pl-3.5 border-l border-slate-800 space-y-0.5">
                    {s.chats.length === 0 ? (
                      <div className="text-slate-600 text-[10px] py-1.5 px-3">
                        No chats. Click + above to start!
                      </div>
                    ) : (
                      s.chats.map((c) => (
                        <div
                          key={c._id}
                          className="group flex items-center justify-between rounded-lg hover:bg-slate-800/40 transition-all pr-2"
                        >
                          <Link
                            href={`/workspaces/${workspaceId}/chat/${s._id}/${c._id}`}
                            className="flex-1 flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:text-white truncate"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="truncate">{c.title}</span>
                          </Link>
                          <form
                            action={async () => {
                              "use server";
                              await deleteChatThread(workspaceId, c._id);
                            }}
                            className="hidden group-hover:block m-0"
                          >
                            <button
                              type="submit"
                              className="p-1 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded transition-colors cursor-pointer"
                              title="Delete Chat"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom User Profile */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-slate-300 hover:text-white"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-xs font-semibold">Dashboard</span>
          </Link>

          <form action="/api/auth/signout" method="POST" className="m-0">
            <button
              type="submit"
              className="p-1 hover:text-red-400 text-slate-400 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </aside>

      {/* Main Right Content Panel */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-slate-950">
        {children}
      </main>
    </div>
  );
}
