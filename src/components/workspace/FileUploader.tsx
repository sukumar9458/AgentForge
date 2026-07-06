"use client";

import React from "react";
import { UploadDropzone } from "@/lib/uploadthing";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";

interface FileUploaderProps {
  workspaceId: string;
}

export default function FileUploader({ workspaceId }: FileUploaderProps) {
  const router = useRouter();

  return (
    <div className="glass border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <FileUp className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-bold text-white">Ingest Workspace Documents</h3>
      </div>
      <p className="text-xs text-slate-400 mb-5">
        Upload Text or Markdown files to chunk and generate vector embeddings. The Researcher agent will index these documents automatically.
      </p>

      {/* UploadThing Dropzone */}
      <UploadDropzone
        endpoint="documentUploader"
        input={{ workspaceId }}
        onClientUploadComplete={(res) => {
          console.log("Files uploaded successfully:", res);
          // Refresh server component data
          router.refresh();
        }}
        onUploadError={(error: Error) => {
          alert(`File upload failed: ${error.message}`);
        }}
        appearance={{
          container: "border-slate-800 border-dashed bg-slate-900/20 hover:bg-slate-900/40 border-2 rounded-xl py-8 transition-all cursor-pointer",
          label: "text-slate-300 hover:text-white text-sm font-semibold",
          allowedContent: "text-xs text-slate-500 mt-1",
          button: "bg-white hover:bg-neutral-200 text-black font-semibold text-xs py-2 px-4 rounded-lg mt-4 cursor-pointer border-none",
        }}
      />
    </div>
  );
}
