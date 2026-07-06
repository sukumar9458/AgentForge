"use client";

import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { LayoutDashboard, Users, FileText, Cpu, CheckCircle } from "lucide-react";

interface OverviewProps {
  stats: {
    workspacesCount: number;
    sessionsCount: number;
    agentRunsCount: number;
    documentsCount: number;
  };
}

const mockChartData = [
  { day: "Mon", runs: 12, speed: 4.2 },
  { day: "Tue", runs: 24, speed: 3.8 },
  { day: "Wed", runs: 18, speed: 4.5 },
  { day: "Thu", runs: 35, speed: 3.2 },
  { day: "Fri", runs: 28, speed: 3.6 },
  { day: "Sat", runs: 45, speed: 2.9 },
  { day: "Sun", runs: 50, speed: 2.5 },
];

export default function Overview({ stats }: OverviewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass rounded-xl p-5 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none group-hover:bg-white/10 transition-all"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 border border-slate-800 text-white rounded-lg">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Workspaces</p>
              <h3 className="text-2xl font-bold text-white mt-1">{stats.workspacesCount}</h3>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-5 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none group-hover:bg-white/10 transition-all"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 border border-slate-800 text-white rounded-lg">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Agent Invocations</p>
              <h3 className="text-2xl font-bold text-white mt-1">{stats.agentRunsCount}</h3>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-5 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none group-hover:bg-white/10 transition-all"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 border border-slate-800 text-white rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Knowledge Files</p>
              <h3 className="text-2xl font-bold text-white mt-1">{stats.documentsCount}</h3>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-5 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none group-hover:bg-white/10 transition-all"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 border border-slate-800 text-white rounded-lg">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Critic Success</p>
              <h3 className="text-2xl font-bold text-white mt-1">94.8%</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="glass rounded-xl border border-slate-800 shadow-xl p-6 relative">
        <h3 className="text-lg font-bold text-white mb-6">Multi-Agent Execution Patterns</h3>
        
        <div className="h-[300px] w-full">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRuns" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#737373" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#737373" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    color: "#f8fafc",
                  }}
                />
                <Area
                  name="Runs"
                  type="monotone"
                  dataKey="runs"
                  stroke="#ffffff"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRuns)"
                />
                <Area
                  name="Avg Speed (s)"
                  type="monotone"
                  dataKey="speed"
                  stroke="#737373"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorSpeed)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full bg-slate-900/10 border border-slate-800/40 animate-pulse rounded-lg flex items-center justify-center text-slate-400">
              Loading interactive dashboard metrics...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
