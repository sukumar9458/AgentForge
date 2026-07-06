"use client";

import React, { useActionState, startTransition, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loginUser } from "../actions";
import { Mail, Lock, LogIn, ArrowRight } from "lucide-react";
import { signIn } from "next-auth/react";

function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const result = await loginUser(prevState, formData);
      if (result.success) {
        router.push(callbackUrl);
        router.refresh();
      }
      return result;
    },
    { success: false }
  );

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 font-sans px-4">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Login Card */}
      <div className="w-full max-w-md glass rounded-2xl p-8 shadow-2xl relative border border-slate-800 z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-lg mb-4">
            <span className="text-xl font-black text-black tracking-wider">AF</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
            AgentForge
          </h1>
          <p className="text-sm text-slate-400 mt-2 text-center">
            Log in to access your multi-agent collaborative workspace
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {state?.error && (
            <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/50 text-red-200 text-sm text-center">
              {state.error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <input
                type="email"
                name="email"
                required
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white transition-all duration-200"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <input
                type="password"
                name="password"
                required
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white transition-all duration-200"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold flex items-center justify-center gap-2 shadow-lg transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {isPending ? (
              <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
            ) : (
              <>
                <span>Sign In</span>
                <LogIn className="w-4.5 h-4.5" />
              </>
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-950/80 px-3 text-slate-400 glass border border-slate-800 rounded-full py-0.5">
              Or continue with
            </span>
          </div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          type="button"
          className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 font-semibold flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer shadow-md hover:-translate-y-0.5 active:translate-y-0"
        >
          {/* Custom Google SVG Icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24" width="24" height="24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.51 0-6.355-2.845-6.355-6.355s2.845-6.355 6.355-6.355c1.625 0 3.102.613 4.237 1.62l3.057-3.056C19.223 2.505 15.938 1.157 12 1.157c-6.079 0-11 4.92-11 11s4.92 11 11 11c5.795 0 10.74-4.228 10.74-10.872 0-.648-.065-1.287-.185-1.9H12.24z"
            />
          </svg>
          <span>Sign In with Google</span>
        </button>

        <p className="text-center text-sm text-slate-400 mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/register"
            className="text-white hover:text-slate-200 font-semibold inline-flex items-center gap-1 hover:underline transition-all duration-200"
          >
            <span>Create one</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950 font-sans text-slate-400">
        Loading...
      </div>
    }>
      <LoginCard />
    </Suspense>
  );
}
