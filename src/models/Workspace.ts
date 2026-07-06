import mongoose, { Schema, model, models } from "mongoose";

export interface IWorkspaceMember {
  user: mongoose.Types.ObjectId;
  role: "owner" | "admin" | "editor" | "viewer";
  joinedAt: Date;
}

export interface IWorkspace {
  _id: string;
  name: string;
  description?: string;
  owner: mongoose.Types.ObjectId;
  members: IWorkspaceMember[];
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMemberSchema = new Schema<IWorkspaceMember>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  role: {
    type: String,
    enum: ["owner", "admin", "editor", "viewer"],
    default: "editor",
  },
  joinedAt: { type: Date, default: Date.now },
});

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true },
    description: { type: String },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [WorkspaceMemberSchema],
  },
  { timestamps: true }
);

export const Workspace = models.Workspace || model<IWorkspace>("Workspace", WorkspaceSchema);
