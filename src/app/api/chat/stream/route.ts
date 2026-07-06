import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { checkRateLimit } from "@/lib/ratelimit/limiter";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Message } from "@/models/Message";
import { Session } from "@/models/Session";
import { Chat } from "@/models/Chat";
import { multiAgentGraph, GraphMessage, GraphStep } from "@/lib/agents/graph";
import mongoose from "mongoose";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const userSession = await auth();
    if (!userSession?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userSession.user.id;

    // 2. Check rate limiting (10 RPM, 500 RPD)
    const rateLimit = await checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
          retryAfter: rateLimit.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    // 3. Parse request payload
    const { sessionId, chatId, content, workspaceId } = await req.json();

    if (!sessionId || !chatId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await connectToDatabase();

    // Verify chat session exists
    const chatSession = await Session.findById(sessionId);
    if (!chatSession) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }

    // Verify chat thread exists
    const chatThread = await Chat.findById(chatId);
    if (!chatThread) {
      return NextResponse.json({ error: "Chat thread not found" }, { status: 404 });
    }

    // 4. Save User's Message to Database
    const userMessageId = new mongoose.Types.ObjectId();
    await Message.create({
      _id: userMessageId,
      sessionId: new mongoose.Types.ObjectId(sessionId),
      chatId: new mongoose.Types.ObjectId(chatId),
      sender: userSession.user.name || "User",
      senderId: new mongoose.Types.ObjectId(userId),
      senderType: "user",
      content: content,
      steps: [],
      files: [],
    });

    // 5. Load past messages for conversation history inside this thread
    const pastMessagesDocs = await Message.find({ chatId: new mongoose.Types.ObjectId(chatId) })
      .sort({ createdAt: 1 })
      .limit(30)
      .lean();

    const graphHistory: GraphMessage[] = pastMessagesDocs.map((msg: any) => ({
      role: msg.senderType === "user" ? "user" : "model",
      content: msg.content,
    }));

    // 6. Setup SSE Encoder & Stream Response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Safe helper to write data to SSE stream
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendEvent("status", { message: "Initializing Multi-Agent Collaboration..." });

          // Start LangGraph.js execution streaming
          const graphStream = await multiAgentGraph.stream(
            {
              messages: graphHistory,
              workspaceId: workspaceId || "",
              steps: [],
            },
            {
              recursionLimit: 20,
            }
          );

          let finalNextState = "";
          let finalMessages: GraphMessage[] = [];
          let finalSteps: GraphStep[] = [];

          for await (const chunk of graphStream) {
            // Identify which node executed and capture state delta
            const activeNode = Object.keys(chunk)[0];
            const nodeState = chunk[activeNode];

            if (nodeState) {
              if (nodeState.next) finalNextState = nodeState.next;
              if (nodeState.messages) {
                finalMessages = finalMessages.concat(nodeState.messages);
              }
              if (nodeState.steps && nodeState.steps.length > 0) {
                const latestStep = nodeState.steps[nodeState.steps.length - 1];
                finalSteps.push(latestStep);

                // Stream active step update to client
                sendEvent("step", {
                  agentName: latestStep.agentName,
                  action: latestStep.action,
                  timestamp: latestStep.timestamp,
                  duration: latestStep.duration,
                  output: latestStep.output,
                });
              }
            }
          }

          // Fetch final content from Writer or Coder
          let agentResponseContent = "Multi-agent run succeeded but no final text was output.";
          if (finalMessages.length > 0) {
            // Find the last model message compiled (usually the final response)
            const modelMsgs = finalMessages.filter((m) => m.role === "model");
            if (modelMsgs.length > 0) {
              // The final compiled output is usually from the Writer (the last message)
              agentResponseContent = modelMsgs[modelMsgs.length - 1].content;
            }
          }

          // 7. Save compiled Agent Response in database
          const agentMessageId = new mongoose.Types.ObjectId();
          await Message.create({
            _id: agentMessageId,
            sessionId: new mongoose.Types.ObjectId(sessionId),
            chatId: new mongoose.Types.ObjectId(chatId),
            sender: "AgentForge System",
            senderType: "agent",
            content: agentResponseContent,
            steps: finalSteps.map((s) => ({
              agentName: s.agentName,
              action: s.action,
              input: s.input || "",
              output: s.output || "",
              duration: s.duration || 0,
              timestamp: new Date(s.timestamp),
            })),
            files: [],
          });

          // Touch the Chat thread to update its updatedAt timestamp
          await Chat.updateOne(
            { _id: new mongoose.Types.ObjectId(chatId) },
            { updatedAt: new Date() }
          );

          // 8. Stream completion payload
          sendEvent("complete", {
            messageId: agentMessageId.toString(),
            content: agentResponseContent,
            steps: finalSteps,
          });

          controller.close();
        } catch (streamError) {
          console.error("Error during agent stream execution:", streamError);
          sendEvent("error", { message: "Internal Agent execution error." });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("SSE stream route error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
