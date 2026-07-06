import mongoose, { Schema, model, models } from "mongoose";

export interface ICronJob {
  _id: string;
  name: string;
  workspaceId: mongoose.Types.ObjectId;
  type: "workspace" | "github";
  githubRepo?: string;
  email?: string;
  prompt: string;
  dayOfWeek: string; // "0"-"6" or "*"
  hour: number;      // 0-23
  minute: number;    // 0-59
  second: number;    // 0-59
  active: boolean;
  lastRunStatus?: "SUCCESS" | "FAILED" | "RUNNING";
  lastRunTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CronJobSchema = new Schema<ICronJob>(
  {
    name: { type: String, required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    type: { type: String, enum: ["workspace", "github"], default: "workspace" },
    githubRepo: { type: String },
    email: { type: String },
    prompt: { type: String, required: true },
    dayOfWeek: { type: String, default: "*" },
    hour: { type: Number, required: true },
    minute: { type: Number, default: 0 },
    second: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    lastRunStatus: { type: String, enum: ["SUCCESS", "FAILED", "RUNNING"] },
    lastRunTime: { type: Date },
  },
  { timestamps: true }
);

export const CronJob = models.CronJob || model<ICronJob>("CronJob", CronJobSchema);
