"use client";

import React, { useState, useTransition } from "react";
import { inviteWorkspaceMember } from "@/app/dashboard/actions";
import { UserPlus, Shield } from "lucide-react";

interface InviteMemberFormProps {
  workspaceId: string;
}

export default function InviteMemberForm({ workspaceId }: InviteMemberFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (!email) return;

    startTransition(async () => {
      const result = await inviteWorkspaceMember(workspaceId, email, role);
      if (result.success) {
        setStatus({ type: "success", message: `Successfully invited user "${email}"` });
        setEmail("");
      } else {
        setStatus({ type: "error", message: result.error || "Failed to invite member." });
      }
    });
  };

  return (
    <form onSubmit={handleInvite} className="space-y-4">
      {status && (
        <div
          className={`p-3 rounded-lg border text-xs text-center ${
            status.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-200"
              : "bg-red-950/40 border-red-800/50 text-red-200"
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="colleague@company.com"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-white"
          />
        </div>
        <div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-white cursor-pointer"
          >
            <option value="admin" className="text-black bg-white" style={{ color: "black", backgroundColor: "white" }}>Admin</option>
            <option value="editor" className="text-black bg-white" style={{ color: "black", backgroundColor: "white" }}>Editor</option>
            <option value="viewer" className="text-black bg-white" style={{ color: "black", backgroundColor: "white" }}>Viewer</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2 bg-white hover:bg-neutral-200 text-black font-semibold text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
      >
        <UserPlus className="w-4 h-4" />
        <span>{isPending ? "Inviting..." : "Send Invitation"}</span>
      </button>
    </form>
  );
}
