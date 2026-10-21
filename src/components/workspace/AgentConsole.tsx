"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Cpu,
  User,
  Clock,
  CheckCircle2,
  FileCode,
  FileSearch,
  PenTool,
  AlertCircle,
  Play,
  Copy,
  Check,
  Terminal,
  X,
  Plus,
  Eye,
  Sparkles,
  Cloud,
  Laptop,
} from "lucide-react";
import { createChatSession, createChatThread } from "@/app/dashboard/actions";
import { useRouter } from "next/navigation";
import ArtifactCanvas, { ArtifactData, SandboxOutput } from "./ArtifactCanvas";
import { isPreviewableLanguage, isExecutableLanguage } from "@/lib/sandbox/languages";
import { buildPreviewHtml } from "@/lib/sandbox/previewHelper";

interface StepItem {
  agentName: string;
  action: string;
  timestamp: string;
  duration?: number;
  output?: string;
}

interface MessageItem {
  _id: string;
  sender: string;
  senderType: "user" | "agent" | "system";
  content: string;
  steps?: StepItem[];
  createdAt: string;
}

interface AgentConsoleProps {
  sessionId: string;
  chatId: string;
  workspaceId: string;
  initialMessages: MessageItem[];
  userName: string;
}

export default function AgentConsole({
  sessionId,
  chatId,
  workspaceId,
  initialMessages,
  userName,
}: AgentConsoleProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [currentSteps, setCurrentSteps] = useState<StepItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sandbox & Artifact Canvas states
  const [activeArtifact, setActiveArtifact] = useState<ArtifactData | null>(null);
  const [inlinePreviewBlocks, setInlinePreviewBlocks] = useState<Record<string, boolean>>({});
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [sandboxProviderName, setSandboxProviderName] = useState("Local Sandbox");
  const [runningBlocks, setRunningBlocks] = useState<Record<string, boolean>>({});
  const [blockOutputs, setBlockOutputs] = useState<Record<string, SandboxOutput | null>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check sandbox capability on mount
  useEffect(() => {
    fetch("/api/sandbox/status")
      .then((res) => res.json())
      .then((data) => {
        if (data?.cloudAvailable) setCloudAvailable(true);
        if (data?.providerName) setSandboxProviderName(data.providerName);
      })
      .catch(() => {});
  }, []);

  const handleRunCode = async (
    blockId: string,
    code: string,
    language: string,
    provider?: "auto" | "e2b" | "local"
  ) => {
    setRunningBlocks((prev) => ({ ...prev, [blockId]: true }));
    setBlockOutputs((prev) => ({ ...prev, [blockId]: null }));

    try {
      const response = await fetch("/api/sandbox/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, provider }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Sandbox code execution failed");
      }

      const result = await response.json();
      setBlockOutputs((prev) => ({ ...prev, [blockId]: result }));
    } catch (err: any) {
      setBlockOutputs((prev) => ({
        ...prev,
        [blockId]: {
          stdout: "",
          stderr: err.message || "Failed to execute code in sandbox",
          exitCode: 1,
          provider: "local-sandbox",
          durationMs: 0,
        },
      }));
    } finally {
      setRunningBlocks((prev) => ({ ...prev, [blockId]: false }));
    }
  };

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating, statusText, currentSteps]);

  // Reset local state when switching chats/threads
  useEffect(() => {
    setMessages(initialMessages);
    setCurrentSteps([]);
    setIsGenerating(false);
    setActiveAgent(null);
    setStatusText("");
  }, [chatId, initialMessages]);

  // Markdown code block parser helper
  const renderMessageContent = (content: string, messageId: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith("```")) {
        // Extract language and code
        const lines = part.split("\n");
        const header = lines[0].replace("```", "").trim();
        const code = lines.slice(1, -1).join("\n");
        const blockId = `${messageId}-${index}`;
        const normalizedLang = header.toLowerCase();
        const isExecutable = isExecutableLanguage(normalizedLang);
        const isPreviewable = isPreviewableLanguage(normalizedLang);
        const isRunning = !!runningBlocks[blockId];
        const runOutput = blockOutputs[blockId];
        const showInlinePreview = !!inlinePreviewBlocks[blockId];

        const artifactTitle =
          normalizedLang === "tsx" || normalizedLang === "jsx"
            ? "React / TSX Component"
            : normalizedLang === "html" || normalizedLang === "htm"
            ? "Interactive Web App / Page"
            : normalizedLang === "svg"
            ? "SVG Vector Graphic"
            : `${header || "Code"} Script`;

        return (
          <div key={index} className="my-4 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/90 shadow-xl">
            {/* Code Block Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900/60 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <FileCode className="w-4 h-4 text-purple-400" />
                  <span>{header || "code"}</span>
                </span>

                {/* Inline Toggle: Code vs Live Preview */}
                {isPreviewable && (
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 ml-2 font-sans">
                    <button
                      onClick={() =>
                        setInlinePreviewBlocks((prev) => ({ ...prev, [blockId]: false }))
                      }
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        !showInlinePreview
                          ? "bg-purple-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Code
                    </button>
                    <button
                      onClick={() =>
                        setInlinePreviewBlocks((prev) => ({ ...prev, [blockId]: true }))
                      }
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                        showInlinePreview
                          ? "bg-purple-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>Preview</span>
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 font-sans">
                {/* Open in full side-by-side Canvas */}
                <button
                  onClick={() =>
                    setActiveArtifact({
                      id: blockId,
                      title: artifactTitle,
                      code,
                      language: header || "code",
                    })
                  }
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-950/70 hover:bg-purple-900/90 text-purple-300 border border-purple-800/60 text-xs font-medium transition-colors cursor-pointer shadow-sm"
                  title="Open in Side-by-Side Canvas"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Open Canvas</span>
                </button>

                {/* Run in Sandbox */}
                {isExecutable && (
                  <button
                    onClick={() => handleRunCode(blockId, code, normalizedLang)}
                    disabled={isRunning}
                    className="flex items-center gap-1 hover:text-white text-indigo-400 disabled:opacity-50 transition-colors cursor-pointer text-xs px-2 py-1 rounded hover:bg-indigo-950/40"
                  >
                    {isRunning ? (
                      <>
                        <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></span>
                        <span>Running...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 text-indigo-400" />
                        <span>Run</span>
                      </>
                    )}
                  </button>
                )}

                {/* Copy button */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(code);
                    setCopiedId(blockId);
                    setTimeout(() => setCopiedId(null), 2000);
                  }}
                  className="flex items-center gap-1 hover:text-white text-slate-400 hover:bg-slate-800 px-2 py-1 rounded transition-colors cursor-pointer"
                  title="Copy code"
                >
                  {copiedId === blockId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-xs">Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Body: Either Inline Preview or Code */}
            {isPreviewable && showInlinePreview ? (
              <div className="h-80 w-full bg-[#0b0f19] border-t border-slate-900 overflow-hidden relative">
                <iframe
                  title={`Inline Preview ${blockId}`}
                  srcDoc={buildPreviewHtml(code, normalizedLang)}
                  sandbox="allow-scripts allow-modals allow-same-origin allow-forms"
                  className="w-full h-full border-0"
                />
              </div>
            ) : (
              <pre className="p-4 overflow-x-auto text-xs font-mono text-indigo-200 bg-slate-950/90 leading-relaxed select-text">
                <code>{code}</code>
              </pre>
            )}

            {/* Sandbox Console Output Container */}
            {(isRunning || runOutput) && (
              <div className="border-t border-slate-800 bg-slate-950 font-mono text-xs text-slate-300 p-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Sandbox Console</span>
                    </span>
                    {runOutput && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-900 border border-slate-800 text-slate-400">
                        {runOutput.provider === "e2b-cloud" ? "E2B Cloud" : "Local Runner"}
                      </span>
                    )}
                  </div>
                  {runOutput && (
                    <button
                      onClick={() => setBlockOutputs((prev) => ({ ...prev, [blockId]: null }))}
                      className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      title="Clear Console"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isRunning && (
                  <div className="flex items-center gap-2 text-indigo-400 animate-pulse py-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                    <span>Executing in isolated sandbox environment...</span>
                  </div>
                )}

                {runOutput && (
                  <div className="space-y-2 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
                    {runOutput.stdout && (
                      <div className="text-emerald-400 font-mono">
                        {runOutput.stdout}
                      </div>
                    )}
                    {runOutput.stderr && (
                      <div className="text-rose-400 font-mono">
                        {runOutput.stderr}
                      </div>
                    )}
                    {runOutput.exitCode !== undefined && (
                      <div className="text-slate-500 border-t border-slate-900/40 pt-1.5 text-[10px] flex justify-between">
                        <span>Exit code: {runOutput.exitCode}</span>
                        <div className="flex items-center gap-3">
                          {runOutput.durationMs !== undefined && (
                            <span className="font-mono text-slate-500">{runOutput.durationMs}ms</span>
                          )}
                          <span className={runOutput.exitCode === 0 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                            {runOutput.exitCode === 0 ? "PASSED" : "FAILED"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      // Handle simple newlines and text lines
      return (
        <p key={index} className="whitespace-pre-wrap leading-relaxed">
          {part}
        </p>
      );
    });
  };

  const getAgentTheme = (agentName: string) => {
    switch (agentName) {
      case "Supervisor":
        return {
          color: "text-purple-400 border-purple-800/40 bg-purple-950/20",
          icon: <Cpu className="w-4 h-4 text-purple-400" />,
          pulse: "bg-purple-500",
        };
      case "Researcher":
        return {
          color: "text-blue-400 border-blue-800/40 bg-blue-950/20",
          icon: <FileSearch className="w-4 h-4 text-blue-400" />,
          pulse: "bg-blue-500",
        };
      case "Coder":
        return {
          color: "text-indigo-400 border-indigo-800/40 bg-indigo-950/20",
          icon: <FileCode className="w-4 h-4 text-indigo-400" />,
          pulse: "bg-indigo-500",
        };
      case "Critic":
        return {
          color: "text-amber-400 border-amber-800/40 bg-amber-950/20",
          icon: <AlertCircle className="w-4 h-4 text-amber-400" />,
          pulse: "bg-amber-500",
        };
      case "Writer":
        return {
          color: "text-emerald-400 border-emerald-800/40 bg-emerald-950/20",
          icon: <PenTool className="w-4 h-4 text-emerald-400" />,
          pulse: "bg-emerald-500",
        };
      default:
        return {
          color: "text-slate-400 border-slate-800 bg-slate-900/40",
          icon: <Cpu className="w-4 h-4 text-slate-400" />,
          pulse: "bg-slate-500",
        };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const query = input;
    setInput("");
    setIsGenerating(true);
    setStatusText("Initializing Multi-Agent collaboration workflow...");
    setActiveAgent("Supervisor");
    setCurrentSteps([]);

    // Push local temporary user message
    const tempUserMsg: MessageItem = {
      _id: `temp-user-${Date.now()}`,
      sender: userName,
      senderType: "user",
      content: query,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      // POST request to SSE endpoint
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          chatId,
          workspaceId,
          content: query,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Failed to start stream");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("Null stream reader");

      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        // Keep the last partial line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          // Parse SSE formats: "event: [type]\ndata: [json]"
          const matchEvent = line.match(/^event:\s*(.+)$/m);
          const matchData = line.match(/^data:\s*(.+)$/m);

          const event = matchEvent ? matchEvent[1].trim() : "";
          const dataJson = matchData ? matchData[1].trim() : "";

          if (dataJson) {
            try {
              const payload = JSON.parse(dataJson);

              if (event === "status") {
                setStatusText(payload.message);
              } else if (event === "step") {
                setActiveAgent(payload.agentName);
                setStatusText(`Specialist running: ${payload.agentName}`);
                
                const stepItem: StepItem = {
                  agentName: payload.agentName,
                  action: payload.action,
                  timestamp: payload.timestamp,
                  duration: payload.duration,
                  output: payload.output,
                };
                
                setCurrentSteps((prev) => [...prev, stepItem]);
              } else if (event === "complete") {
                setIsGenerating(false);
                setActiveAgent(null);
                setStatusText("");

                // Push compiled final system message
                const newAgentMsg: MessageItem = {
                  _id: payload.messageId,
                  sender: "AgentForge System",
                  senderType: "agent",
                  content: payload.content,
                  steps: payload.steps,
                  createdAt: new Date().toISOString(),
                };

                setMessages((prev) => [...prev, newAgentMsg]);
                setCurrentSteps([]);
              } else if (event === "error") {
                setIsGenerating(false);
                setActiveAgent(null);
                setStatusText(`Error: ${payload.message}`);
              }
            } catch (jsonErr) {
              console.error("Failed to parse SSE data packet:", jsonErr, line);
            }
          }
        }
      }
    } catch (err: any) {
      console.error("SSE connection failure:", err);
      setIsGenerating(false);
      setActiveAgent(null);
      setStatusText("");
      
      const errorMsg: MessageItem = {
        _id: `temp-error-${Date.now()}`,
        sender: "System Error",
        senderType: "system",
        content: err.message || "An execution interruption occurred in the stream connection.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const handleNewChat = async () => {
    try {
      const title = prompt("Enter a title for the new chat:", "New Chat");
      if (title === null) return; // User cancelled
      
      const result = await createChatThread(workspaceId, sessionId, title.trim() || "New Chat");
      if (result.success && result.chatId) {
        router.push(`/workspaces/${workspaceId}/chat/${sessionId}/${result.chatId}`);
      } else {
        alert(result.error || "Failed to create new chat.");
      }
    } catch (e: any) {
      alert("Failed to create new chat.");
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* Left Column (Chat Screen) */}
      <div
        className={`flex flex-col h-full border-r border-slate-900 transition-all duration-300 ${
          activeArtifact ? "w-full lg:w-1/2" : "flex-1"
        }`}
      >
        {/* Active Visualizer Header */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between min-h-[57px]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-slate-300" />
              <h3 className="text-sm font-bold text-white">Interactive Console</h3>
            </div>
            
            <button
              onClick={handleNewChat}
              disabled={isGenerating}
              className="text-[10px] font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Create a new chat session"
            >
              <Plus className="w-3 h-3" />
              <span>New Chat</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Sandbox Status Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-slate-900/80 border-slate-800/80">
              {cloudAvailable ? (
                <>
                  <Cloud className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-300">Sandbox: E2B Cloud</span>
                </>
              ) : (
                <>
                  <Laptop className="w-3 h-3 text-indigo-400" />
                  <span className="text-slate-300">Sandbox: Local</span>
                </>
              )}
            </div>

            {/* Glowing node status */}
            {isGenerating && activeAgent && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 hidden sm:inline">{statusText}</span>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${
                    getAgentTheme(activeAgent).color
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        getAgentTheme(activeAgent).pulse
                      }`}
                    ></span>
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        getAgentTheme(activeAgent).pulse
                      }`}
                    ></span>
                  </span>
                  <span>Active: {activeAgent}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Messages Feed Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-slate-950/30">
          {messages.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
              <Cpu className="w-10 h-10 text-slate-700 animate-pulse" />
              <h4 className="font-bold text-slate-400">Initialize Agent Collaboration</h4>
              <p className="max-w-xs text-xs">
                Write a request below to spin up the multi-agent graph system. The agents will query your documents and write code.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.senderType === "user";
              const isSystem = msg.senderType === "system";

              if (isSystem) {
                return (
                  <div key={msg._id} className="flex justify-center my-3">
                    <div className="bg-red-950/30 border border-red-900/50 rounded-lg py-2 px-4 text-xs text-red-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{msg.content}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg._id}
                  className={`flex gap-4 max-w-[85%] ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold border ${
                      isUser
                        ? "bg-slate-800 border-slate-700 text-white"
                        : "bg-slate-900 border-slate-800 text-slate-200"
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                  </div>

                  <div className="space-y-1">
                    <div className={`flex items-center gap-2 text-xs text-slate-400 ${isUser ? "justify-end" : ""}`}>
                      <span className="font-bold text-slate-200">{msg.sender}</span>
                      <span>•</span>
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div
                      className={`rounded-xl px-4 py-3 text-sm shadow ${
                        isUser
                          ? "bg-white text-black font-medium"
                          : "glass border border-slate-800 text-slate-200"
                      }`}
                    >
                      {isUser ? <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p> : renderMessageContent(msg.content, msg._id)}
                    </div>

                    {/* Historical steps tree drawer */}
                    {!isUser && msg.steps && msg.steps.length > 0 && (
                      <div className="mt-2.5 pl-2">
                        <details className="group">
                          <summary className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-400 cursor-pointer flex items-center gap-1.5 select-none focus:outline-none">
                            <Clock className="w-3.5 h-3.5" />
                            <span>View agent run timeline ({msg.steps.length} steps)</span>
                          </summary>
                          <div className="mt-2.5 border-l border-slate-800 pl-4 space-y-3.5">
                            {msg.steps.map((st, sIdx) => (
                              <div key={sIdx} className="text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-200">{st.agentName}</span>
                                  <span className="text-[10px] text-slate-500">{st.duration}ms</span>
                                </div>
                                <p className="text-slate-400 mt-0.5 text-[11px] leading-relaxed">{st.action}</p>
                                {st.output && (
                                  <details className="mt-1 ml-2">
                                    <summary className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer select-none focus:outline-none">
                                      Show step output
                                    </summary>
                                    <div className="mt-1.5 p-2 bg-slate-950/60 border border-slate-900 rounded-lg text-[11px] text-slate-300 max-h-60 overflow-y-auto font-sans leading-relaxed">
                                      {renderMessageContent(st.output, `${msg._id}-step-${sIdx}`)}
                                    </div>
                                  </details>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Local streaming steps list builder */}
          {isGenerating && currentSteps.length > 0 && (
            <div className="flex gap-4 max-w-[85%] mr-auto">
              <div className="w-8 h-8 rounded-lg bg-purple-950/20 border border-purple-800/40 text-purple-400 flex items-center justify-center text-xs animate-pulse">
                <Cpu className="w-4 h-4" />
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-bold text-slate-200">AgentForge System</span>
                  <span className="text-[10px] italic">collaborating...</span>
                </div>
                <div className="glass border border-slate-800 rounded-xl p-4 space-y-3 shadow-md max-w-lg">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                    <span>Real-time graph steps</span>
                  </h4>
                  <div className="space-y-2">
                    {currentSteps.map((st, idx) => (
                      <div key={idx} className="flex gap-2.5 items-start text-xs border-l-2 border-slate-800 pl-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-300">{st.agentName}:</span>
                          <span className="text-slate-400 ml-1.5">{st.action}</span>
                          {st.duration && <span className="text-[10px] text-slate-500 ml-2 font-mono">({st.duration}ms)</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Interactive Prompt Form Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-900 bg-slate-950/80">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isGenerating}
              placeholder={
                isGenerating
                  ? "Multi-agent run actively processing..."
                  : "Ask AgentForge (e.g. Generate database connection logic based on schema files)..."
              }
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-white focus:border-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            />
            <button
              type="submit"
              disabled={!input.trim() || isGenerating}
              className="absolute right-2.5 p-2 rounded-lg bg-white hover:bg-slate-200 text-black disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all duration-200"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>

      </div>

      {/* Right Column: Either ArtifactCanvas (if active) or Diagnostics Panel */}
      {activeArtifact ? (
        <div className="w-full lg:w-1/2 bg-slate-950 flex flex-col h-full border-l border-slate-800 animate-in slide-in-from-right duration-300 z-20">
          <ArtifactCanvas
            artifact={activeArtifact}
            onClose={() => setActiveArtifact(null)}
            onRunCode={(code, lang, provider) =>
              handleRunCode(activeArtifact.id, code, lang, provider)
            }
            runOutput={blockOutputs[activeArtifact.id]}
            isRunning={runningBlocks[activeArtifact.id]}
            cloudAvailable={cloudAvailable}
          />
        </div>
      ) : (
        <div className="w-80 bg-slate-900/60 overflow-y-auto hidden xl:flex flex-col p-6 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Active Run Diagnostics</h3>
          </div>

          {isGenerating ? (
            <div className="space-y-5">
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl shadow-inner space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stream Execution Stats</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Execution Phase:</span>
                    <span className="text-purple-400 font-bold animate-pulse">{activeAgent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Steps Compiled:</span>
                    <span className="text-slate-300 font-semibold font-mono">{currentSteps.length}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Graph Routing Timeline</h4>
                <div className="relative border-l border-slate-800 pl-4 ml-2 space-y-4">
                  {currentSteps.map((st, idx) => (
                    <div key={idx} className="relative text-xs">
                      <div className="absolute -left-[23px] top-0.5 p-0.5 bg-slate-900 border border-slate-800 rounded-full">
                        {getAgentTheme(st.agentName).icon}
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-200">{st.agentName}</h5>
                        <p className="text-slate-500 text-[10px] leading-relaxed mt-0.5">{st.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 text-slate-500 space-y-3">
              <Play className="w-8 h-8 text-slate-700" />
              <p className="text-xs max-w-[200px]">
                No active agent runs. Trigger a request in the console to observe pipeline graphs.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
