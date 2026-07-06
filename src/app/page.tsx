import React from "react";
import Link from "next/link";
import { ArrowRight, Cpu, ShieldCheck, Sparkles, FolderLock, FileJson } from "lucide-react";
import { auth } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div className="relative min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col justify-between overflow-hidden">
      {/* Background glowing effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header navbar */}
      <header className="max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg">
            <span className="text-sm font-black text-black">AF</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-white">AgentForge</span>
        </div>
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-white hover:bg-neutral-200 text-black transition-all shadow-md"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-sm text-slate-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-white hover:bg-neutral-200 text-black transition-all shadow-md"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 flex flex-col justify-center text-center items-center py-20 z-10 relative space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-800/40 bg-purple-950/30 text-xs font-semibold text-purple-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Multi-Agent State Graph In Action</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-[1.15]">
          AI-Powered Multi-Agent{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400">
            Collaborative Workspace
          </span>
        </h1>

        <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
          Create shared sandboxes, embed knowledge files, and collaborate alongside a structured network of specialist agents: Supervisor, Researcher, Coder, Critic, and Writer.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Link
            href={isLoggedIn ? "/dashboard" : "/auth/register"}
            className="px-6 py-3.5 text-base font-semibold rounded-xl bg-white hover:bg-neutral-200 text-black flex items-center justify-center gap-2 shadow-lg cursor-pointer transform hover:-translate-y-0.5 transition-all"
          >
            <span>Start Collaborating</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 w-full text-left">
          <div className="glass border border-slate-800/80 rounded-xl p-6 relative overflow-hidden group hover:border-purple-500/30 transition-all duration-300">
            <div className="p-2.5 bg-purple-950/40 border border-purple-800/40 text-purple-400 rounded-lg w-fit mb-4">
              <Cpu className="w-5.5 h-5.5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">LangGraph Multi-Agent</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Supervisor routes prompts dynamically through specialists. The Critic verifies accuracy and loops back to fix errors.
            </p>
          </div>

          <div className="glass border border-slate-800/80 rounded-xl p-6 relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
            <div className="p-2.5 bg-indigo-950/40 border border-indigo-800/40 text-indigo-400 rounded-lg w-fit mb-4">
              <FileJson className="w-5.5 h-5.5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Workspace Vector RAG</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Upload docs to generate embeddings automatically. The Researcher agent retrieves relevant file facts to answer queries.
            </p>
          </div>

          <div className="glass border border-slate-800/80 rounded-xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
            <div className="p-2.5 bg-blue-950/40 border border-blue-800/40 text-blue-400 rounded-lg w-fit mb-4">
              <ShieldCheck className="w-5.5 h-5.5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Protected Quota Limits</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Sliding-window MongoDB rate limiters restrict request frequencies to stay within Gemini API free-tier allowances.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 z-10 relative py-6 text-center text-xs text-slate-500">
        <p>© 2026 AgentForge Multi-Agent Sandbox. Powered by Next.js 15, LangGraph.js, and Google Gemini.</p>
      </footer>
    </div>
  );
}
