import React from "react";
import { PlusCircle, Upload, Play, UserPlus, FileClock } from "lucide-react";

interface LogItem {
  _id: string;
  action: string;
  details: string;
  createdAt: string;
  userId?: { name: string; email: string };
}

interface ActivityFeedProps {
  logs: LogItem[];
}

export default function ActivityFeed({ logs }: ActivityFeedProps) {
  // Helpers to format timeline action icons and colors
  const getActionTheme = (action: string) => {
    switch (action) {
      case "create_workspace":
        return {
          icon: <PlusCircle className="w-4 h-4 text-emerald-400" />,
          bg: "bg-emerald-500/10 border-emerald-500/20",
        };
      case "upload_file":
        return {
          icon: <Upload className="w-4 h-4 text-blue-400" />,
          bg: "bg-blue-500/10 border-blue-500/20",
        };
      case "run_agent":
        return {
          icon: <Play className="w-4 h-4 text-white" />,
          bg: "bg-slate-500/10 border-slate-500/20",
        };
      case "invite_member":
        return {
          icon: <UserPlus className="w-4 h-4 text-slate-300" />,
          bg: "bg-slate-500/10 border-slate-500/20",
        };
      default:
        return {
          icon: <FileClock className="w-4 h-4 text-slate-400" />,
          bg: "bg-slate-500/10 border-slate-500/20",
        };
    }
  };

  const timeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="glass rounded-xl border border-slate-800 shadow-xl p-6 relative">
      <h3 className="text-lg font-bold text-white mb-6">Recent Team Activity</h3>

      {logs.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm">
          No team actions registered in this workspace yet.
        </div>
      ) : (
        <div className="relative border-l border-slate-800 pl-6 ml-3 space-y-6">
          {logs.map((log) => {
            const theme = getActionTheme(log.action);
            return (
              <div key={log._id} className="relative group">
                {/* Timeline node icon */}
                <div
                  className={`absolute -left-[37px] top-0 p-1.5 rounded-full border ${theme.bg} shadow-md group-hover:scale-110 transition-transform`}
                >
                  {theme.icon}
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-1">
                  <div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-slate-300 transition-colors">
                      {log.details}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Action performed by{" "}
                      <span className="text-slate-300 font-medium">
                        {log.userId?.name || "System"}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 font-mono self-end md:self-center">
                    {timeAgo(log.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
