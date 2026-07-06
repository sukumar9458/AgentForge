import { GoogleGenerativeAI } from "@google/generative-ai";
import { StateGraph, Annotation, END } from "@langchain/langgraph";
import { searchVectorDocuments } from "../rag/embedder";
import { executeAllBlocksInText } from "../sandbox/executor";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");

export interface GraphMessage {
  role: "user" | "model" | "system";
  content: string;
}

export interface GraphStep {
  agentName: string;
  action: string;
  input?: string;
  output?: string;
  duration?: number;
  timestamp: string;
}

// 1. Define Agent State Schema
export const AgentState = Annotation.Root({
  messages: Annotation<GraphMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  next: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "Supervisor",
  }),
  workspaceId: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  steps: Annotation<GraphStep[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

// Helper: Format message history for Gemini text generation
function formatHistory(messages: GraphMessage[]): string {
  return messages
    .map((msg) => `${msg.role === "user" ? "User" : "Agent"}: ${msg.content}`)
    .join("\n\n");
}

// Helper: Standard Gemini text generation with retries and fallback
async function generateText(
  prompt: string,
  systemInstruction?: string,
  modelName = "gemini-2.5-flash",
  retriesRemaining = 3,
  delayMs = 2000
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      ...(systemInstruction ? { systemInstruction } : {}),
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error: any) {
    const errorString = error?.message || String(error);
    const isOverloaded =
      error.status === 503 ||
      error.status === 429 ||
      errorString.includes("503") ||
      errorString.includes("429") ||
      errorString.includes("high demand") ||
      errorString.includes("Service Unavailable") ||
      errorString.includes("quota");

    if (isOverloaded && retriesRemaining > 0) {
      let finalDelay = delayMs;

      // Extract delay from Google API error details if available
      if (error.errorDetails && Array.isArray(error.errorDetails)) {
        const retryInfo = error.errorDetails.find((d: any) => d && d.retryDelay);
        if (retryInfo && retryInfo.retryDelay) {
          const seconds = parseInt(retryInfo.retryDelay);
          if (!isNaN(seconds)) {
            finalDelay = seconds * 1000 + 2000; // wait specified time + 2s buffer
          }
        }
      } else {
        // Fallback: search regex for "Please retry in X.XXs" or similar
        const match = errorString.match(/Please retry in ([\d\.]+)s/i);
        if (match && match[1]) {
          const seconds = parseFloat(match[1]);
          if (!isNaN(seconds)) {
            finalDelay = Math.ceil(seconds) * 1000 + 2000;
          }
        }
      }

      // Enforce a minimum delay of 5 seconds for rate limit retries
      if (finalDelay < 5000) {
        finalDelay = 5000;
      }

      console.warn(
        `Gemini model ${modelName} rate limit/overloaded. Waiting ${finalDelay}ms before retry... (Retries left: ${retriesRemaining})`
      );
      await new Promise((resolve) => setTimeout(resolve, finalDelay));
      return generateText(prompt, systemInstruction, modelName, retriesRemaining - 1, finalDelay * 1.5);
    }

    // Fall back to gemini-2.0-flash if gemini-2.5-flash is exhausted
    if (modelName === "gemini-2.5-flash") {
      console.warn("gemini-2.5-flash failed or exhausted. Falling back to gemini-2.0-flash...");
      return generateText(prompt, systemInstruction, "gemini-2.0-flash", 3, 2000);
    }
    throw error;
  }
}

// Helper: Gemini text generation with built-in Google Search grounding
async function generateTextWithSearch(
  prompt: string,
  systemInstruction?: string,
  modelName = "gemini-2.5-flash"
): Promise<{ text: string; sources: Array<{ title: string; uri: string }> }> {
  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      ...(systemInstruction ? { systemInstruction } : {}),
      // Set the Google Search grounding tool
      tools: [{ googleSearch: {} }] as any,
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Extract grounding metadata containing search chunks and source URLs
    const candidates = (result.response as any).candidates;
    const groundingMetadata = candidates?.[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];
    
    const sources: Array<{ title: string; uri: string }> = [];
    const seenUris = new Set<string>();

    for (const chunk of groundingChunks) {
      if (chunk.web?.uri && chunk.web?.title) {
        const uri = chunk.web.uri;
        if (!seenUris.has(uri)) {
          seenUris.add(uri);
          sources.push({
            title: chunk.web.title,
            uri: uri,
          });
        }
      }
    }

    return { text, sources };
  } catch (error) {
    console.error("Gemini Search Grounding failed, falling back to standard generation:", error);
    const text = await generateText(prompt, systemInstruction, modelName);
    return { text, sources: [] };
  }
}

// 2. Define Node Invocations

// Node: Supervisor Agent
async function supervisorNode(state: typeof AgentState.State) {
  const startTime = Date.now();
  const history = formatHistory(state.messages);

  const systemInstruction = `You are the Supervisor Agent of AgentForge. Your job is to orchestrate a team of specialist agents to solve the user's request.
The team members are:
- Researcher: Can query the local workspace files (RAG database) to find answers and search technical specs.
- Coder: Generates code files, code snippets, or software details.
- Writer: Drafts, structures, and compiles the final answer in a polished, professional Markdown format.

Based on the conversation history:
1. Analyze what has been accomplished.
2. If the last message in the conversation history is from the User, you MUST NOT output 'FINISH'. You must route to a specialist ('Researcher', 'Coder', 'Writer') to address the user's input.
3. If the last message in the history is from an Agent (model) and the user's request has been fully addressed, output 'FINISH'.

Response format: You must output ONLY one of the following words: 'Researcher', 'Coder', 'Writer', or 'FINISH'. Do not add any explanation or punctuation.`;

  const prompt = `Conversation history so far:\n${history}\n\nBased on this history, which agent should run next?`;
  
  let response = await generateText(prompt, systemInstruction);
  response = response.trim().replace(/[.*+?^${}()|[\]\\]/g, ""); // Clean formatting

  // Fallback check
  const validNext = ["Researcher", "Coder", "Writer", "FINISH"];
  const nextAgent = validNext.includes(response) ? response : "Writer";

  const step: GraphStep = {
    agentName: "Supervisor",
    action: `Routings to next stage: ${nextAgent}`,
    input: history.slice(-500),
    output: nextAgent,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };

  return {
    next: nextAgent,
    steps: [step],
  };
}

// Node: Researcher Agent
async function researcherNode(state: typeof AgentState.State) {
  const startTime = Date.now();
  const userQuery = state.messages[state.messages.length - 1]?.content || "";
  
  let localDocsContent = "";
  
  if (state.workspaceId) {
    try {
      // Reduced chunk count from 4 to 3 for token efficiency
      const hits = await searchVectorDocuments(state.workspaceId, userQuery, 3);
      if (hits.length > 0) {
        localDocsContent = hits
          .map((h, i) => `[File: ${h.fileName}]: ${h.content.replace(/\s+/g, ' ').slice(0, 800)}`) // Minified layout
          .join("\n");
      }
    } catch (err) {
      console.error("Researcher vector search error:", err);
    }
  }

  // Synthesize research notes with Google Search grounding
  const prompt = `You are the Researcher Agent. Synthesize findings from local workspace files AND perform web search research to help address the query: "${userQuery}".

Local Workspace Files Content:
${localDocsContent || "No local files found."}

Provide a concise summary of facts, specifications, or code instructions. Be brief and direct (no fluff).`;

  const { text: summary, sources } = await generateTextWithSearch(
    prompt,
    "You are a professional Researcher Agent compiling context notes."
  );
  
  let citationsMarkdown = "";
  if (sources.length > 0) {
    // Limit to top 3 web citations to keep context windows small and token-efficient
    citationsMarkdown = "\n\n**Web Sources Citations:**\n" + 
      sources.slice(0, 3).map((src, i) => `[${i + 1}] [${src.title}](${src.uri})`).join("\n");
  }

  const finalOutput = `${summary}${citationsMarkdown}`;

  const step: GraphStep = {
    agentName: "Researcher",
    action: `Researched local files and performed Google Web Search grounding (${sources.length} sources found)`,
    input: userQuery,
    output: finalOutput.slice(0, 500) + "...",
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };

  return {
    messages: [{ role: "model" as const, content: `[Researcher Notes]:\n${finalOutput}` }],
    next: "Supervisor",
    steps: [step],
  };
}

// Node: Coder Agent
async function coderNode(state: typeof AgentState.State) {
  const startTime = Date.now();
  const history = formatHistory(state.messages);

  const systemInstruction = `You are the Coder Agent of AgentForge. Your job is to generate high-quality code, files, or technical implementations based on the context and the user request.
Explain the code clearly, wrap all code in appropriate markdown syntax blocks with languages, and detail any configurations needed.
Return the completed code and instructions.`;

  const prompt = `Review the history and context, then generate the required code/implementation:\n${history}`;
  const codeOutput = await generateText(prompt, systemInstruction);

  const step: GraphStep = {
    agentName: "Coder",
    action: "Generated code implementation & instructions",
    input: history.slice(-500),
    output: codeOutput.slice(0, 1000) + "...",
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };

  // We automatically route to the Critic agent for evaluation after the Coder finishes
  return {
    messages: [{ role: "model" as const, content: `[Coder Output]:\n${codeOutput}` }],
    next: "Critic",
    steps: [step],
  };
}

// Node: Critic Agent
async function criticNode(state: typeof AgentState.State) {
  const startTime = Date.now();
  const messagesCount = state.messages.length;
  // Get the last generated content (should be Coder's work)
  const codeContent = state.messages[messagesCount - 1]?.content || "";

  // Execute generated code blocks inside the sandbox
  let executionReport = "";
  let executionFailed = false;
  let executedCount = 0;

  try {
    const runResults = await executeAllBlocksInText(codeContent);
    executedCount = runResults.length;

    if (runResults.length > 0) {
      executionReport = "\n\n### Actual Code Execution Sandbox Results:\n";
      runResults.forEach(({ block, result }, index) => {
        executionReport += `\n**Block #${index + 1} (${block.language})**:\n`;
        if (result.stdout) {
          executionReport += `*Standard Output (stdout)*:\n\`\`\`\n${result.stdout}\n\`\`\`\n`;
        }
        if (result.stderr) {
          executionReport += `*Error Output (stderr)*:\n\`\`\`\n${result.stderr}\n\`\`\`\n`;
        }
        if (result.exitCode !== 0) {
          executionFailed = true;
          executionReport += `*Status*: FAILED (exit code ${result.exitCode}, error: ${result.error || "execution crash"})\n`;
        } else {
          executionReport += `*Status*: PASSED\n`;
        }
      });
    }
  } catch (executionError: any) {
    console.error("Sandbox evaluation crash in Critic:", executionError);
    executionFailed = true;
    executionReport = `\n\n### Actual Code Execution Sandbox Results:\nSandbox crashed during execution attempts: ${executionError.message}\n`;
  }

  const systemInstruction = `You are the Critic Agent of AgentForge. Your job is to review the code generated by the Coder Agent.
Check for:
1. Syntax correctness.
2. Security vulnerabilities.
3. Completeness relative to user requirements.
4. Optimal performance.

If there are sandbox code execution logs provided:
- Read the stdout and stderr logs to confirm if the code runs correctly.
- If the execution status indicates 'FAILED' or if there are errors (stderr), you MUST begin your review response with 'FAIL' and explain how to fix the error.

Your response MUST begin with either 'FAIL' or 'PASS'.
- If there are bugs, flaws, failing tests, or code crashes: start with 'FAIL: [detailed checklist of issues]' and explain what needs fixing.
- If it is correct, successfully executed, and complete: start with 'PASS: [optional approval notes]'.`;

  const prompt = `Review the history and evaluate the generated code.
  
Coder's Output:
${codeContent}
${executionReport}

Based on the above contents, perform your review. Remember, if execution failed, you must output 'FAIL: [error details]'.`;

  const evaluation = await generateText(prompt, systemInstruction);
  const passed = evaluation.trim().toUpperCase().startsWith("PASS");

  let nextStep = "Writer";
  if (!passed) {
    nextStep = "Coder"; // Route back to Coder to fix bugs!
  }

  const step: GraphStep = {
    agentName: "Critic",
    action: `Evaluated Coder's output: ${passed ? "PASS" : "FAIL"} (Executed ${executedCount} blocks, sandbox status: ${executionFailed ? "FAILING" : "OK"})`,
    input: (codeContent.slice(0, 500) + "\n" + executionReport).slice(0, 1000),
    output: evaluation,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };

  return {
    messages: [{ role: "model" as const, content: `[Critic Review]:\n${evaluation}` }],
    next: nextStep,
    steps: [step],
  };
}

// Node: Writer Agent
async function writerNode(state: typeof AgentState.State) {
  const startTime = Date.now();
  const history = formatHistory(state.messages);

  const systemInstruction = `You are the Writer Agent of AgentForge. Your job is to compile, format, and structure the final response for the user.
Review the conversation history, research notes, criticism, and code outputs, and build a unified, professional, and clear final response.
Use clean Markdown formatting, proper headers, lists, and bold text. Make it look like a highly premium report.
Do not output raw agent tags like '[Coder Output]' in your final content; present a cohesive final document.

CRITICAL: You MUST include the final, approved code blocks in full within your response. Use proper Markdown syntax with language tags (e.g. \`\`\`typescript, \`\`\`javascript, \`\`\`python) so the user is able to run the code in the sandbox. Do not just summarize the code without printing it.`;

  const prompt = `Here is the full collaborative work history so far:\n${history}\n\nCompile the final, polished response for the user.`;
  const finalResponse = await generateText(prompt, systemInstruction);

  const step: GraphStep = {
    agentName: "Writer",
    action: "Formatted and compiled final response report",
    input: history.slice(-500),
    output: finalResponse.slice(0, 1000) + "...",
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };

  return {
    messages: [{ role: "model" as const, content: finalResponse }],
    next: "Supervisor", // Supervisor will check the final result and yield FINISH
    steps: [step],
  };
}

// 3. Assemble and Compile the Graph
const workflow = new StateGraph(AgentState)
  .addNode("supervisor", supervisorNode)
  .addNode("researcher", researcherNode)
  .addNode("coder", coderNode)
  .addNode("critic", criticNode)
  .addNode("writer", writerNode);

// Define graph control flow edges
workflow.addEdge("researcher", "supervisor");
workflow.addEdge("coder", "critic");
workflow.addEdge("writer", "supervisor");

// Critic dynamic routing
workflow.addConditionalEdges("critic", (state) => state.next.toLowerCase());

// Supervisor dynamic routing
workflow.addConditionalEdges("supervisor", (state) => {
  if (state.next === "FINISH") {
    return END;
  }
  return state.next.toLowerCase(); // Map to 'researcher', 'coder', or 'writer'
});

// Set Entry Point
workflow.setEntryPoint("supervisor");

export const multiAgentGraph = workflow.compile();
