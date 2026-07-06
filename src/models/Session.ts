import mongoose, { Schema, model, models } from "mongoose";

export interface ISession {
  _id: string;
  workspaceId: mongoose.Types.ObjectId;
  title: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    title: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Session = models.Session || model<ISession>("Session", SessionSchema);
