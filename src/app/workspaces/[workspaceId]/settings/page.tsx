import React from "react";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Workspace } from "@/models/Workspace";
import InviteMemberForm from "@/components/workspace/InviteMemberForm";
import mongoose from "mongoose";
import { Users, Shield, User, HelpCircle } from "lucide-react";

interface SettingsPageProps {
  params: Promise<{ workspaceId: string }>;
}

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage({ params }: SettingsPageProps) {
  const userSession = await auth();
  if (!userSession?.user) {
    redirect("/auth/login");
  }

  const { workspaceId } = await params;
  const userId = userSession.user.id;

  await connectToDatabase();

  const wId = new mongoose.Types.ObjectId(workspaceId);
  const uId = new mongoose.Types.ObjectId(userId);

  // 1. Fetch workspace detail and populate member profile information
  const workspace = await Workspace.findOne({
    _id: wId,
    "members.user": uId,
  }).populate("members.user", "name email image");

  if (!workspace) {
    redirect("/dashboard");
  }

  // Find actor's role to restrict invite display if they are viewers/editors
  const userMember = workspace.members.find(
    (m: any) => m.user._id.toString() === userId
  );
  
  const isAuthorizedToInvite = userMember && ["owner", "admin"].includes(userMember.role);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
      <div className="flex flex-col gap-1.5 bg-slate-900/40 border border-slate-800/80 rounded-xl p-6 relative overflow-hidden">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Workspace Settings</h1>
        <p className="text-sm text-slate-400">
          Manage collaborative workspace settings, invite coworkers, and view member directories.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Invite Member Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-bold text-white">Invite Coworker</h3>
            </div>
            
            {isAuthorizedToInvite ? (
              <>
                <p className="text-xs text-slate-400 mb-5">
                  Send an email invitation to invite a registered team member. They must have an account.
                </p>
                <InviteMemberForm workspaceId={workspaceId} />
              </>
            ) : (
              <div className="p-4 bg-slate-950/40 border border-slate-850 text-slate-500 rounded-lg text-xs flex gap-2">
                <Shield className="w-4 h-4 flex-shrink-0 text-slate-600" />
                <span>Only Workspace Owners and Administrators can invite new members.</span>
              </div>
            )}
          </div>

          <div className="glass border border-slate-800 rounded-xl p-5 shadow-lg space-y-3.5">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Permission Key Roles</span>
            </h4>
            <div className="space-y-2.5 text-xs text-slate-400">
              <p>
                <strong className="text-slate-200">Owner / Admin:</strong> Full permissions to upload files, invite members, configure settings, and delete workspace.
              </p>
              <p>
                <strong className="text-slate-200">Editor:</strong> Standard contributor role. Can create agent run sessions, write prompts, and upload file vectors.
              </p>
              <p>
                <strong className="text-slate-200">Viewer:</strong> Read-only access. Can inspect files and read completed chats, but cannot invoke agent sessions.
              </p>
            </div>
          </div>
        </div>

        {/* Directory Members List */}
        <div className="lg:col-span-2">
          <div className="glass border border-slate-800 rounded-xl p-6 shadow-xl min-h-[300px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>Collaborator Directory</span>
              </h3>
              <span className="text-xs bg-slate-900 border border-slate-800 px-2.5 py-0.5 text-slate-400 rounded-full font-mono font-medium">
                {workspace.members.length} Members
              </span>
            </div>

            <div className="space-y-3.5">
              {workspace.members.map((member: any) => (
                <div
                  key={member._id}
                  className="flex items-center justify-between p-4 rounded-lg bg-slate-900/40 border border-slate-900 hover:border-slate-800/80 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-semibold uppercase text-slate-200">
                      {member.user.name?.slice(0, 2) || "CO"}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{member.user.name}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{member.user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-semibold border border-indigo-800/40 bg-indigo-950/30 text-indigo-400 px-2.5 py-1 rounded-full">
                      {member.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
