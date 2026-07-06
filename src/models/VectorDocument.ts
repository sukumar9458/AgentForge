import mongoose, { Schema, model, models } from "mongoose";

export interface IVectorDocument {
  _id: string;
  workspaceId: mongoose.Types.ObjectId;
  fileName: string;
  fileUrl: string;
  fileKey: string;
  content: string;
  embedding: number[]; // Array of floats representing vector embedding (768 dimensions for text-embedding-004)
  createdAt: Date;
}

const VectorDocumentSchema = new Schema<IVectorDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileKey: { type: String, required: true },
    content: { type: String, required: true },
    embedding: { type: [Number], required: true }, // Ensure this is mapped correctly for Vector Search
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Optional: Define vector index in comments for manual creation if necessary.
// Index configuration in MongoDB:
// {
//   "fields": [
//     {
//       "type": "vector",
//       "path": "embedding",
//       "numDimensions": 768,
//       "similarity": "cosine"
//     },
//     {
//       "type": "filter",
//       "path": "workspaceId"
//     }
//   ]
// }

export const VectorDocument = models.VectorDocument || model<IVectorDocument>("VectorDocument", VectorDocumentSchema);
