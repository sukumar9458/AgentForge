import { GoogleGenerativeAI } from "@google/generative-ai";
import { connectToDatabase } from "@/lib/db/mongodb";
import { VectorDocument } from "@/models/VectorDocument";
import mongoose from "mongoose";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is not defined in environment variables");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");

/**
 * Generate a 768-dimension vector embedding for a given text using text-embedding-004.
 */
export async function getEmbedding(text: string, retries = 5, delayMs = 2000): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
    const result = await model.embedContent(text);
    if (!result.embedding?.values) {
      throw new Error("Failed to get embedding values from Gemini API");
    }
    return result.embedding.values;
  } catch (error: any) {
    const errorString = error?.message || String(error);
    const is429 = errorString.includes("429") || errorString.includes("quota") || errorString.includes("Too Many Requests");

    if (is429 && retries > 0) {
      console.warn(`[EMBEDDING] Rate limited (429). Retrying in ${delayMs}ms... (Remaining retries: ${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return getEmbedding(text, retries - 1, delayMs * 2);
    }

    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Splitting utility that divides text into overlaps.
 */
export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let i = 0;

  while (i < text.length) {
    const chunk = text.substring(i, i + chunkSize);
    chunks.push(chunk);
    i += chunkSize - overlap;
  }

  return chunks;
}

interface IngestFileArgs {
  workspaceId: string;
  fileName: string;
  fileUrl: string;
  fileKey: string;
  textContent: string;
}

/**
 * Ingestion entry point: chunks the text, embeds it, and writes documents to MongoDB
 */
export async function ingestDocumentText({
  workspaceId,
  fileName,
  fileUrl,
  fileKey,
  textContent,
}: IngestFileArgs): Promise<number> {
  await connectToDatabase();

  const chunks = chunkText(textContent);
  if (chunks.length === 0) return 0;

  const wId = new mongoose.Types.ObjectId(workspaceId);

  // Remove existing vectors for this file key to prevent duplicate ingestion
  await VectorDocument.deleteMany({ fileKey });

  let successCount = 0;

  for (const chunk of chunks) {
    try {
      const embedding = await getEmbedding(chunk);
      await VectorDocument.create({
        workspaceId: wId,
        fileName,
        fileUrl,
        fileKey,
        content: chunk,
        embedding,
      });
      successCount++;
      // Wait 1.5 seconds between chunk insertions to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err) {
      console.error(`Failed to ingest chunk of file ${fileName}:`, err);
    }
  }

  return successCount;
}

/**
 * Performs vector search against MongoDB using Atlas Vector Search
 */
export async function searchVectorDocuments(
  workspaceId: string,
  queryText: string,
  limit = 5
): Promise<Array<{ fileName: string; content: string; score?: number }>> {
  await connectToDatabase();
  const queryEmbedding = await getEmbedding(queryText);

  // Standard MongoDB Vector Search Aggregation Pipeline
  // NOTE: This assumes an Atlas Vector Search index named "vector_index" on the "vectordocuments" collection
  let results = [];
  try {
    results = await VectorDocument.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: limit * 10,
          limit: limit,
          filter: {
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
          },
        },
      },
      {
        $project: {
          fileName: 1,
          content: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);
  } catch (vectorError) {
    console.warn(
      "Atlas Vector Search failed or index is not yet built. Falling back to keyword search:",
      (vectorError as any).message || vectorError
    );
  }

  // Fallback: If no vector search results are returned (e.g. index is still building or local MongoDB without vector search support),
  // we do a smart keyword regex search on the text content to make development seamless.
  if (results.length === 0) {
    // Clean, stem (prefix), and filter words to maximize matches
    const keywords = queryText
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()) // Strip punctuation
      .filter((w) => w.length >= 3)
      .map((w) => (w.length > 5 ? w.substring(0, 5) : w)) // Stemming prefix
      .filter((w) => !["what", "with", "from", "that", "this", "your", "have", "were"].includes(w)); // Remove common stop-words

    const queryFilter: any = {
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    };

    if (keywords.length > 0) {
      queryFilter.content = {
        $regex: keywords.join("|"),
        $options: "i",
      };
    }

    const regexResults = await VectorDocument.find(queryFilter)
      .limit(limit)
      .select("fileName content")
      .lean();

    return regexResults.map((doc: any) => ({
      fileName: doc.fileName,
      content: doc.content,
      score: 1.0,
    }));
  }

  return results;
}
