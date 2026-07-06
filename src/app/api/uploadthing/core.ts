import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/lib/auth/auth";
import { ingestDocumentText } from "@/lib/rag/embedder";
import { ActivityLog } from "@/models/ActivityLog";
import mongoose from "mongoose";
import { z } from "zod";

const f = createUploadthing();

export const ourFileRouter = {
  documentUploader: f({
    blob: { maxFileSize: "4MB", maxFileCount: 5 },
    text: { maxFileSize: "4MB", maxFileCount: 5 },
  })
    .input(z.object({ workspaceId: z.string() }))
    .middleware(async ({ req, input }) => {
      const userSession = await auth();
      if (!userSession?.user?.id) throw new Error("Unauthorized");

      return { userId: userSession.user.id, workspaceId: input.workspaceId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("File URL:", file.url);

      try {
        // Fetch raw text content from the uploaded file URL
        const response = await fetch(file.url);
        if (!response.ok) {
          throw new Error(`Failed to download uploaded file: ${response.statusText}`);
        }
        
        const textContent = await response.text();

        if (metadata.workspaceId && textContent.trim()) {
          const successCount = await ingestDocumentText({
            workspaceId: metadata.workspaceId,
            fileName: file.name,
            fileUrl: file.url,
            fileKey: file.key,
            textContent: textContent,
          });

          console.log(`Successfully ingested file ${file.name} into ${successCount} vector chunks.`);

          // Log workspace action
          await ActivityLog.create({
            workspaceId: new mongoose.Types.ObjectId(metadata.workspaceId),
            userId: new mongoose.Types.ObjectId(metadata.userId),
            action: "upload_file",
            details: `Uploaded and embedded document "${file.name}"`,
          });
        }
      } catch (error) {
        console.error("Error during file ingestion processing:", error);
      }

      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
