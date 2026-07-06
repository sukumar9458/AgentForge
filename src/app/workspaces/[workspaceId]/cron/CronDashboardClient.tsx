"use client";

import React, { useState } from "react";
import {
  Clock,
  Github,
  Mail,
  Plus,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  X,
  Cpu,
  RefreshCw,
} from "lucide-react";
import {
  saveCronJob,
  deleteCronJob,
  toggleCronJobActive,
  triggerCronJob,
} from "./actions";

interface CronJobItem {
  _id: string;
  name: string;
  workspaceId: string;
  type: "workspace" | "github";
  githubRepo: string;
  email: string;
  prompt: string;
  dayOfWeek: string;
  hour: number;
  minute?: number;
  second?: number;
  active: boolean;
  lastRunStatus: "SUCCESS" | "FAILED" | "RUNNING" | "PENDING";
  lastRunTime: string;
}

interface ClientProps {
  workspaceId: string;
  initialJobs: CronJobItem[];
}

const DAYS_MAP: Record<string, string> = {
  "*": "Every Day",
  "0": "Sunday",
  "1": "Monday",
  "2": "Tuesday",
  "3": "Wednesday",
  "4": "Thursday",
  "5": "Friday",
  "6": "Saturday",
};

export default function CronDashboardClient({ workspaceId, initialJobs }: ClientProps) {
  const [jobs, setJobs] = useState<CronJobItem[]>(initialJobs);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form States
  const [name, setName] = useState("");
  const [type, setType] = useState<"workspace" | "github">("workspace");
  const [githubRepo, setGithubRepo] = useState("");
  const [email, setEmail] = useState("");
  const [prompt, setPrompt] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("*");
  const [hour, setHour] = useState(9); // Default 9:00 AM
  const [minute, setMinute] = useState(0);
  const [second, setSecond] = useState(0);

  // Action pending states
  const [pendingJobIds, setPendingJobIds] = useState<Record<string, boolean>>({});

  const handleOpenModal = () => {
    setName("");
    setType("workspace");
    setGithubRepo("");
    setEmail("");
    setPrompt("");
    setDayOfWeek("*");
    setHour(9);
    setMinute(0);
    setSecond(0);
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await saveCronJob({
        workspaceId,
        name,
        type,
        githubRepo: type === "github" ? githubRepo : undefined,
        email: email || undefined,
        prompt,
        dayOfWeek,
        hour,
        minute,
        second,
      });

      if (res.success) {
        setIsModalOpen(false);
        // Refresh page or manual reload. In simple SPA state, we reload local jobs.
        window.location.reload();
      } else {
        setErrorMsg(res.error || "Failed to save workflow.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect server actions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this scheduled workflow?")) return;
    setPendingJobIds((prev) => ({ ...prev, [jobId]: true }));

    try {
      const res = await deleteCronJob(workspaceId, jobId);
      if (res.success) {
        setJobs((prev) => prev.filter((j) => j._id !== jobId));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPendingJobIds((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const handleToggleActive = async (jobId: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    setJobs((prev) =>
      prev.map((j) => (j._id === jobId ? { ...j, active: nextActive } : j))
    );

    try {
      await toggleCronJobActive(workspaceId, jobId, nextActive);
    } catch (err) {
      console.error(err);
      // Revert if error
      setJobs((prev) =>
        prev.map((j) => (j._id === jobId ? { ...j, active: currentActive } : j))
      );
    }
  };

  const handleTriggerJob = async (jobId: string) => {
    setPendingJobIds((prev) => ({ ...prev, [jobId]: true }));
    // Optimistically show RUNNING
    setJobs((prev) =>
      prev.map((j) => (j._id === jobId ? { ...j, lastRunStatus: "RUNNING" } : j))
    );

    try {
      const res = await triggerCronJob(workspaceId, jobId);
      if (res.success) {
        alert("Workflow triggered! The agent is running in the background. Check your Session timeline in a few moments.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPendingJobIds((prev) => ({ ...prev, [jobId]: false }));
      // Reload page to refresh statuses
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  const getStatusBadge = (status: CronJobItem["lastRunStatus"]) => {
    switch (status) {
      case "SUCCESS":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-950/40 border border-emerald-800/60 text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Success</span>
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-rose-950/40 border border-rose-800/60 text-rose-400">
            <XCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        );
      case "RUNNING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-indigo-950/40 border border-indigo-800/60 text-indigo-400 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Running</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-slate-900 border border-slate-800 text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
      {/* Header operations */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 border border-slate-800/80 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/5 rounded-full blur-2xl pointer-events-none"></div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Clock className="w-8 h-8 text-emerald-400" />
            <span>AI Cron Workflows</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1.5 max-w-xl">
            Schedule background agents to automatically audit GitHub code repository builds or run custom search grounding tasks.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white font-semibold text-xs tracking-wide transition-all shadow-md shadow-purple-950/50 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Workflow</span>
        </button>
      </div>

      {/* Schedules list */}
      <div className="glass border border-slate-800 rounded-xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-400" />
          <span>Scheduled Cron Tasks</span>
        </h3>

        {jobs.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-850 rounded-xl text-slate-500 text-sm flex flex-col items-center justify-center gap-3">
            <Clock className="w-10 h-10 text-slate-700 animate-pulse" />
            <span className="font-semibold text-slate-400">No scheduled cron jobs found.</span>
            <p className="text-xs text-slate-500 max-w-xs">
              Click the "Add Workflow" button above to schedule your first periodic agent audit.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div
                key={job._id}
                className="group border border-slate-800 hover:border-slate-700 rounded-xl p-5 bg-slate-900/10 hover:bg-slate-900/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                {/* Job metadata info */}
                <div className="space-y-2.5 max-w-xl min-w-0">
                  <div className="flex items-center gap-3">
                    <h4 className="font-extrabold text-white text-base truncate">{job.name}</h4>
                    {job.type === "github" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-950/60 border border-indigo-800/40 text-indigo-300 uppercase">
                        <Github className="w-3 h-3" />
                        <span>GitHub Repo</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-purple-950/60 border border-purple-800/40 text-purple-300 uppercase">
                        <Cpu className="w-3 h-3" />
                        <span>Workspace</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed truncate">
                    <strong className="text-slate-300">Prompt:</strong> "{job.prompt}"
                  </p>

                  {job.type === "github" && job.githubRepo && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <Github className="w-3.5 h-3.5" />
                      <a href={job.githubRepo} target="_blank" rel="noreferrer" className="hover:underline hover:text-white truncate">
                        {job.githubRepo}
                      </a>
                    </div>
                  )}

                  {job.email && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{job.email}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Run interval: {DAYS_MAP[job.dayOfWeek]} at {job.hour.toString().padStart(2, "0")}:
                        {(job.minute ?? 0).toString().padStart(2, "0")}:
                        {(job.second ?? 0).toString().padStart(2, "0")}
                      </span>
                    </span>
                    {job.lastRunTime && (
                      <span>• Last execute: {new Date(job.lastRunTime).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {/* Operations column */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  {/* Status Badges */}
                  <div>{getStatusBadge(job.lastRunStatus)}</div>

                  {/* Active Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={job.active}
                      onChange={() => handleToggleActive(job._id, job.active)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-focus:ring-1 peer-focus:ring-purple-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600 peer-checked:after:bg-white"></div>
                  </label>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTriggerJob(job._id)}
                      disabled={pendingJobIds[job._id]}
                      className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/20 rounded-lg transition-all cursor-pointer disabled:opacity-30"
                      title="Run workflow now"
                    >
                      <Play className="w-4.5 h-4.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteJob(job._id)}
                      disabled={pendingJobIds[job._id]}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-all cursor-pointer disabled:opacity-30"
                      title="Delete workflow"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden relative flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                <span>Create AI Cron Workflow</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveJob} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Workflow Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Workflow Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Daily Security Audit"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Mode Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Workflow Target Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType("workspace")}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      type === "workspace"
                        ? "bg-purple-950/40 border-purple-500 text-purple-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    Workspace RAG / Web
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("github")}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      type === "github"
                        ? "bg-indigo-950/40 border-indigo-500 text-indigo-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    GitHub Repo Audit
                  </button>
                </div>
              </div>

              {/* Conditional GitHub URL input */}
              {type === "github" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    GitHub Repository URL
                  </label>
                  <input
                    type="url"
                    required
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    placeholder="https://github.com/owner/repository"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              )}

              {/* Alert Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Notification Email (Alerts)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sukumar@example.com (optional)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Agent Instructions / Prompt */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Agent Instruction Prompt
                </label>
                <textarea
                  required
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    type === "github"
                      ? "e.g. Audit code files, locate compilation issues, verify security flaws, and suggest fixes."
                      : "e.g. Search google for latest TypeScript releases and synthesize summary reports against uploaded files."
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* Interval / Scheduler Settings */}
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Execution Days
                  </label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="*" className="text-black bg-white" style={{ color: "black", backgroundColor: "white" }}>Every Day</option>
                    <option value="1" className="text-black bg-white" style={{ color: "black", backgroundColor: "white" }}>Mondays</option>
                    <option value="2" className="text-black bg-white" style={{ color: "black", backgroundColor: "white" }}>Tuesdays</option>
                    <option value="3" className="text-black bg-white" style={{ color: "black", backgroundColor: "white" }}>Wednesdays</option>
                    <option value="4" className="text-black bg-white" style={{ color: "black", backgroundColor: "white" }}>Thursdays</option>
                    <option value="5" className="text-black bg-white" style={{ color: "black", backgroundColor: "white" }}>Fridays</option>
                    <option value="6" className="text-black bg-white" style={{ color: "black", backgroundColor: "white" }}>Saturdays</option>
                    <option value="0" className="text-black bg-white" style={{ color: "black", backgroundColor: "white" }}>Sundays</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Hour */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Hour
                    </label>
                    <select
                      value={hour}
                      onChange={(e) => setHour(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      {Array.from({ length: 24 }).map((_, i) => (
                        <option key={i} value={i} className="text-black bg-white" style={{ color: "black", backgroundColor: "white" }}>
                          {i.toString().padStart(2, "0")} ({i >= 12 ? `${i === 12 ? 12 : i - 12} PM` : `${i === 0 ? 12 : i} AM`})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Minute */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Minute
                    </label>
                    <select
                      value={minute}
                      onChange={(e) => setMinute(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      {Array.from({ length: 60 }).map((_, i) => (
                        <option key={i} value={i} className="text-black bg-white" style={{ color: "black", backgroundColor: "white" }}>
                          {i.toString().padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Second */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Second
                    </label>
                    <select
                      value={second}
                      onChange={(e) => setSecond(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      {Array.from({ length: 60 }).map((_, i) => (
                        <option key={i} value={i} className="text-black bg-white" style={{ color: "black", backgroundColor: "white" }}>
                          {i.toString().padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:opacity-55 text-white text-xs font-semibold cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Save Workflow"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
