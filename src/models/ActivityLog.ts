import mongoose, { Schema, model, models } from "mongoose";

export interface IActivityLog {
  _id: string;
  workspaceId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: string; // e.g. "create_workspace", "run_agent", "upload_file", "invite_member"
  details: string; // Human readable description
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace" },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    details: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ActivityLog = models.ActivityLog || model<IActivityLog>("ActivityLog", ActivityLogSchema);
