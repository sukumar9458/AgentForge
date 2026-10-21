"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Code2,
  Eye,
  Terminal,
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  ExternalLink,
  Download,
  X,
  Play,
  Copy,
  Check,
  Cpu,
  Cloud,
  Laptop,
  AlertTriangle,
} from "lucide-react";
import { buildPreviewHtml } from "@/lib/sandbox/previewHelper";

export interface ArtifactData {
  id: string;
  title: string;
  code: string;
  language: string;
}

export interface SandboxOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
  provider?: "e2b-cloud" | "local-sandbox";
  durationMs?: number;
  artifacts?: Array<{ type: string; data: string }>;
}

interface ArtifactCanvasProps {
  artifact: ArtifactData;
  onClose: () => void;
  onRunCode: (code: string, language: string, provider?: "auto" | "e2b" | "local") => Promise<void>;
  runOutput?: SandboxOutput | null;
  isRunning?: boolean;
  cloudAvailable?: boolean;
}

export default function ArtifactCanvas({
  artifact,
  onClose,
  onRunCode,
  runOutput,
  isRunning = false,
  cloudAvailable = false,
}: ArtifactCanvasProps) {
  const normalizedLang = artifact.language.toLowerCase().trim();
  const isPreviewable = [
    "html",
    "htm",
    "xhtml",
    "svg",
    "xml",
    "tsx",
    "jsx",
    "react",
  ].includes(normalizedLang);

  const [activeTab, setActiveTab] = useState<"preview" | "code" | "terminal">(
    isPreviewable ? "preview" : "terminal"
  );
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"auto" | "e2b" | "local">(
    cloudAvailable ? "e2b" : "auto"
  );

  useEffect(() => {
    setActiveTab(isPreviewable ? "preview" : "terminal");
  }, [artifact.id, isPreviewable]);

  // Construct isolated iframe HTML template for live previewing
  const previewHtml = useMemo(() => {
    if (!isPreviewable) return "";
    return buildPreviewHtml(artifact.code, normalizedLang);
  }, [artifact.code, normalizedLang, isPreviewable]);

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    let ext = "txt";
    if (["javascript", "js"].includes(normalizedLang)) ext = "js";
    else if (["typescript", "ts"].includes(normalizedLang)) ext = "ts";
    else if (["tsx"].includes(normalizedLang)) ext = "tsx";
    else if (["jsx"].includes(normalizedLang)) ext = "jsx";
    else if (["html", "htm"].includes(normalizedLang)) ext = "html";
    else if (["python", "py"].includes(normalizedLang)) ext = "py";
    else if (["svg"].includes(normalizedLang)) ext = "svg";

    const blob = new Blob([artifact.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `artifact_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenInNewTab = () => {
    const blob = new Blob([previewHtml || artifact.code], {
      type: isPreviewable ? "text/html" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-purple-950/60 border border-purple-800/40 text-purple-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
              <span>{artifact.title || "Interactive Artifact Canvas"}</span>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-purple-300 border border-slate-700/60 uppercase">
                {artifact.language}
              </span>
            </h3>
          </div>
        </div>

        {/* Viewport Switcher (When in Live Preview) */}
        {activeTab === "preview" && isPreviewable && (
          <div className="hidden sm:flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewport("desktop")}
              className={`p-1.5 rounded-md transition-colors ${
                viewport === "desktop"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Desktop View (100%)"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewport("tablet")}
              className={`p-1.5 rounded-md transition-colors ${
                viewport === "tablet"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Tablet View (768px)"
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewport("mobile")}
              className={`p-1.5 rounded-md transition-colors ${
                viewport === "mobile"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Mobile View (375px)"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {activeTab === "preview" && isPreviewable && (
            <button
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Refresh Preview"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleOpenInNewTab}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Open in new window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Download file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
            title="Close Canvas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900/40 text-xs">
        <div className="flex items-center gap-1">
          {isPreviewable && (
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === "preview"
                  ? "border-purple-500 text-purple-400 bg-purple-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Preview</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === "code"
                ? "border-purple-500 text-purple-400 bg-purple-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Source Code</span>
          </button>

          <button
            onClick={() => setActiveTab("terminal")}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === "terminal"
                ? "border-purple-500 text-purple-400 bg-purple-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Sandbox Runner</span>
          </button>
        </div>

        {/* Sandbox Provider Status Pill */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
          {cloudAvailable ? (
            <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
              <Cloud className="w-3 h-3" />
              <span>E2B Cloud Ready</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-indigo-400 bg-indigo-950/40 border border-indigo-800/40 px-2 py-0.5 rounded-full">
              <Laptop className="w-3 h-3" />
              <span>Local Sandbox</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative overflow-hidden bg-slate-950">
        {/* Tab 1: Live Preview */}
        {activeTab === "preview" && isPreviewable && (
          <div className="h-full w-full overflow-auto flex items-center justify-center p-4 bg-slate-900/30">
            <div
              className={`h-full transition-all duration-300 flex flex-col bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl ${
                viewport === "desktop"
                  ? "w-full"
                  : viewport === "tablet"
                  ? "w-[768px] max-w-full"
                  : "w-[375px] max-w-full rounded-3xl border-4 border-slate-700"
              }`}
            >
              <iframe
                key={`${artifact.id}-${refreshTrigger}`}
                title="Interactive Live Preview"
                srcDoc={previewHtml}
                sandbox="allow-scripts allow-modals allow-same-origin allow-forms"
                className="w-full h-full border-0 bg-[#0b0f19]"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Source Code */}
        {activeTab === "code" && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60 bg-slate-900/30 text-xs text-slate-400">
              <span className="font-mono">
                {artifact.code.split("\n").length} lines &bull; {artifact.code.length} characters
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 font-mono text-xs text-indigo-200 bg-slate-950 leading-relaxed select-text">
              <code>{artifact.code}</code>
            </pre>
          </div>
        )}

        {/* Tab 3: Sandbox Terminal Runner */}
        {activeTab === "terminal" && (
          <div className="h-full flex flex-col bg-slate-950">
            {/* Terminal Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-slate-800 bg-slate-900/40 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Provider:</span>
                <select
                  value={selectedProvider}
                  onChange={(e) =>
                    setSelectedProvider(e.target.value as "auto" | "e2b" | "local")
                  }
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="auto">Auto (Cloud if Key Available)</option>
                  <option value="e2b" disabled={!cloudAvailable}>
                    E2B Cloud MicroVM {!cloudAvailable ? "(Key Missing)" : ""}
                  </option>
                  <option value="local">Local Isolated Sandbox</option>
                </select>
              </div>

              <button
                onClick={() =>
                  onRunCode(artifact.code, artifact.language, selectedProvider)
                }
                disabled={isRunning}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors cursor-pointer shadow-md"
              >
                {isRunning ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Executing in Sandbox...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run in Sandbox</span>
                  </>
                )}
              </button>
            </div>

            {/* Execution Console Output */}
            <div className="flex-1 overflow-auto p-4 font-mono text-xs select-text">
              {!runOutput && !isRunning && (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center space-y-2">
                  <Terminal className="w-8 h-8 text-slate-600" />
                  <p>Click &quot;Run in Sandbox&quot; above to execute this code block in an isolated environment.</p>
                  <span className="text-[11px] text-slate-600">
                    Supports JavaScript, TypeScript, Python, and Bash.
                  </span>
                </div>
              )}

              {isRunning && (
                <div className="flex items-center gap-2 text-purple-400 animate-pulse py-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping"></span>
                  <span>
                    Spinning up {selectedProvider === "e2b" ? "E2B Cloud MicroVM" : "Isolated Sandbox"} and executing...
                  </span>
                </div>
              )}

              {runOutput && (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold px-2 py-0.5 rounded ${
                          runOutput.exitCode === 0
                            ? "bg-emerald-950/60 border border-emerald-800/60 text-emerald-400"
                            : "bg-rose-950/60 border border-rose-800/60 text-rose-400"
                        }`}
                      >
                        {runOutput.exitCode === 0 ? "PASSED (0)" : `FAILED (${runOutput.exitCode})`}
                      </span>
                      <span className="text-slate-400">
                        Environment:{" "}
                        <strong className="text-slate-300">
                          {runOutput.provider === "e2b-cloud" ? "E2B Cloud MicroVM" : "Local Sandbox"}
                        </strong>
                      </span>
                    </div>

                    {runOutput.durationMs !== undefined && (
                      <span className="text-slate-500 font-mono">
                        {runOutput.durationMs}ms
                      </span>
                    )}
                  </div>

                  {/* Stdout */}
                  {runOutput.stdout && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                        Standard Output (stdout)
                      </span>
                      <pre className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg text-emerald-400 whitespace-pre-wrap leading-relaxed">
                        {runOutput.stdout}
                      </pre>
                    </div>
                  )}

                  {/* Stderr */}
                  {runOutput.stderr && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-rose-500 tracking-wider block mb-1">
                        Standard Error (stderr)
                      </span>
                      <pre className="p-3 bg-rose-950/30 border border-rose-900/40 rounded-lg text-rose-300 whitespace-pre-wrap leading-relaxed">
                        {runOutput.stderr}
                      </pre>
                    </div>
                  )}

                  {/* Generated Artifacts / Images */}
                  {runOutput.artifacts && runOutput.artifacts.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider block mb-2">
                        Generated Visual Artifacts ({runOutput.artifacts.length})
                      </span>
                      <div className="grid grid-cols-1 gap-3">
                        {runOutput.artifacts.map((art, idx) => (
                          <div
                            key={idx}
                            className="p-2 bg-slate-900 rounded-lg border border-slate-800 flex justify-center"
                          >
                            {art.type.startsWith("image/") ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={
                                  art.data.startsWith("data:")
                                    ? art.data
                                    : `data:${art.type};base64,${art.data}`
                                }
                                alt={`Sandbox Artifact ${idx + 1}`}
                                className="max-w-full rounded"
                              />
                            ) : (
                              <div
                                dangerouslySetInnerHTML={{ __html: art.data }}
                                className="w-full text-slate-200"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
