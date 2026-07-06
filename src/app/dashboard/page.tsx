import React from "react";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Workspace } from "@/models/Workspace";
import { Session } from "@/models/Session";
import { Message } from "@/models/Message";
import { VectorDocument } from "@/models/VectorDocument";
import { ActivityLog } from "@/models/ActivityLog";
import Overview from "@/components/dashboard/Overview";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import Link from "next/link";
import { Plus, FolderKanban, ArrowRight, Compass, LogOut } from "lucide-react";
import { createWorkspace } from "./actions";

// Server page is server-side rendered dynamically
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userSession = await auth();
  if (!userSession?.user) {
    redirect("/auth/login");
  }

  const userId = userSession.user.id;

  await connectToDatabase();

  // 1. Fetch user's workspaces
  const workspaces = await Workspace.find({
    "members.user": new mongoose.Types.ObjectId(userId),
  }).sort({ updatedAt: -1 });

  const workspaceIds = workspaces.map((w) => w._id);

  // 2. Fetch metrics
  const sessionsCount = await Session.countDocuments({
    workspaceId: { $in: workspaceIds },
  });

  const documentsCount = await VectorDocument.countDocuments({
    workspaceId: { $in: workspaceIds },
  });

  // Calculate agent runs (messages sent by 'agent')
  const sessions = await Session.find({
    workspaceId: { $in: workspaceIds },
  }).select("_id");
  const sessionIds = sessions.map((s) => s._id);

  const agentRunsCount = await Message.countDocuments({
    sessionId: { $in: sessionIds },
    senderType: "agent",
  });

  // 3. Load recent activity logs
  const logsDocs = await ActivityLog.find({
    workspaceId: { $in: workspaceIds },
  })
    .sort({ createdAt: -1 })
    .limit(8)
    .populate("userId", "name email")
    .lean();

  const formattedLogs = logsDocs.map((log: any) => ({
    _id: log._id.toString(),
    action: log.action,
    details: log.details,
    createdAt: log.createdAt.toISOString(),
    userId: log.userId
      ? {
          name: log.userId.name,
          email: log.userId.email,
        }
      : undefined,
  }));

  const stats = {
    workspacesCount: workspaces.length,
    sessionsCount,
    agentRunsCount,
    documentsCount,
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans flex flex-col">
      {/* Top Premium Navbar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-lg">
            <span className="text-sm font-black text-black">AF</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-white">AgentForge</span>
          <span className="bg-slate-900 border border-slate-800 text-[10px] text-slate-300 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
            Workspace
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-white uppercase">
              {userSession.user.name?.slice(0, 2) || "U"}
            </div>
            <span className="text-sm font-medium text-slate-300 hidden sm:inline">
              {userSession.user.name}
            </span>
          </div>
          
          <form action="/api/auth/signout" method="POST" className="m-0">
            <button
              type="submit"
              className="p-2 hover:bg-red-950/20 hover:text-red-400 text-slate-400 rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </form>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side (Stats & Visualizations) */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Workspace Overview</h2>
            <p className="text-sm text-slate-400">
              Analyze collaborative activities and agent invocation telemetry patterns.
            </p>
          </div>

          <Overview stats={stats} />

          <ActivityFeed logs={formattedLogs} />
        </div>

        {/* Right Side (Workspace Management & Actions) */}
        <div className="space-y-6">
          
          {/* Create Workspace Panel */}
          <div className="glass border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex items-center gap-2 mb-4">
              <FolderKanban className="w-5 h-5 text-white" />
              <h3 className="text-lg font-bold text-white">Create Workspace</h3>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Launch a new dedicated sandbox workspace to invite team members and load vector indexes.
            </p>

            <form action={async (formData) => {
              "use server";
              await createWorkspace(null, formData);
            }} className="space-y-4">
              <div className="space-y-1">
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Workspace Name (e.g. Acme Tech)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-white"
                />
              </div>

              <div className="space-y-1">
                <textarea
                  name="description"
                  placeholder="Short Description..."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-white resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-white hover:bg-slate-200 text-black font-semibold text-sm rounded-lg flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Initialize Workspace</span>
              </button>
            </form>
          </div>

          {/* Active Workspaces Selector List */}
          <div className="glass border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-white" />
                <h3 className="text-lg font-bold text-white">Active Workspaces</h3>
              </div>
              <span className="text-xs bg-slate-900 border border-slate-800 px-2 py-0.5 text-slate-400 rounded-full font-mono font-medium">
                {workspaces.length}
              </span>
            </div>

            {workspaces.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-800 rounded-lg text-slate-500 text-xs">
                You do not have any workspaces yet. Build one above!
              </div>
            ) : (
              <div className="space-y-3">
                {workspaces.map((ws) => (
                  <Link
                    key={ws._id}
                    href={`/workspaces/${ws._id.toString()}`}
                    className="block group p-4 rounded-lg bg-slate-900/40 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 transition-all shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-white group-hover:text-slate-300 transition-colors">
                          {ws.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                          {ws.description || "No description provided."}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 group-hover:text-white transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

// Ensure mongoose works inside server actions
import mongoose from "mongoose";
