import React from "react";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Workspace } from "@/models/Workspace";
import { VectorDocument } from "@/models/VectorDocument";
import FileUploader from "@/components/workspace/FileUploader";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { FileText, Trash2, ShieldAlert, Cpu } from "lucide-react";

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>;
}

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const userSession = await auth();
  if (!userSession?.user) {
    redirect("/auth/login");
  }

  const { workspaceId } = await params;
  const userId = userSession.user.id;

  await connectToDatabase();

  const wId = new mongoose.Types.ObjectId(workspaceId);
  const uId = new mongoose.Types.ObjectId(userId);

  // 1. Verify workspace and user membership
  const workspace = await Workspace.findOne({
    _id: wId,
    "members.user": uId,
  });

  if (!workspace) {
    redirect("/dashboard");
  }

  // 2. Load and aggregate uploaded documents in the vector DB
  const documents = await VectorDocument.aggregate([
    {
      $match: {
        workspaceId: wId,
      },
    },
    {
      $group: {
        _id: "$fileKey",
        fileName: { $first: "$fileName" },
        fileUrl: { $first: "$fileUrl" },
        fileKey: { $first: "$fileKey" },
        chunksCount: { $sum: 1 },
        createdAt: { $first: "$createdAt" },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);

  // Server Action to delete files
  const deleteFile = async (formData: FormData) => {
    "use server";
    const fileKey = formData.get("fileKey") as string;
    if (!fileKey) return;

    await connectToDatabase();
    
    // Delete all vector chunks associated with the file key
    await VectorDocument.deleteMany({ fileKey });

    revalidatePath(`/workspaces/${workspaceId}`);
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
      {/* Workspace Dashboard Welcome */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 border border-slate-800/80 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/5 rounded-full blur-2xl pointer-events-none"></div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Collaborative sandbox: {workspace.name}
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Load file vectors and run agent streams to collaborate with AI specialists.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ingest panel (left column) */}
        <div className="lg:col-span-1 space-y-6">
          <FileUploader workspaceId={workspaceId} />

          <div className="glass border border-slate-800 rounded-xl p-5 shadow-lg flex gap-4 items-center">
            <div className="p-3 bg-purple-950/40 border border-purple-800/40 text-purple-400 rounded-lg">
              <Cpu className="w-5.5 h-5.5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Multi-Agent Sandbox</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Create a chat session in the sidebar to start running agents on your ingested files.
              </p>
            </div>
          </div>
        </div>

        {/* Catalog of documents (right columns) */}
        <div className="lg:col-span-2">
          <div className="glass border border-slate-800 rounded-xl p-6 shadow-xl min-h-[300px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-bold text-white">Ingested Knowledge Files</h3>
                </div>
                <span className="text-xs bg-slate-900 border border-slate-800 px-2 py-0.5 text-slate-400 rounded-full font-mono">
                  {documents.length} Files
                </span>
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
                  <ShieldAlert className="w-8 h-8 text-slate-600" />
                  <span>No documents ingested in this workspace yet. Upload files to get started.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="pb-3 pl-2">File Name</th>
                        <th className="pb-3 text-center">Vector Chunks</th>
                        <th className="pb-3 text-right pr-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {documents.map((doc) => (
                        <tr key={doc._id} className="group hover:bg-slate-900/20 transition-all">
                          <td className="py-3.5 pl-2 font-medium text-slate-200 group-hover:text-purple-400 transition-colors">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline flex items-center gap-2"
                            >
                              <FileText className="w-4.5 h-4.5 text-slate-400" />
                              <span className="truncate max-w-[240px]">{doc.fileName}</span>
                            </a>
                          </td>
                          <td className="py-3.5 text-center text-xs text-slate-400 font-mono">
                            {doc.chunksCount} chunks
                          </td>
                          <td className="py-3.5 text-right pr-2">
                            <form action={deleteFile} className="inline-block m-0">
                              <input type="hidden" name="fileKey" value={doc.fileKey} />
                              <button
                                type="submit"
                                className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-red-950/20 transition-all cursor-pointer"
                                title="Delete Document"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
