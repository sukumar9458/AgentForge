import mongoose, { Schema, model, models } from "mongoose";

export interface IChat {
  _id: string;
  sessionId: mongoose.Types.ObjectId;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
    title: { type: String, required: true },
  },
  { timestamps: true }
);

export const Chat = models.Chat || model<IChat>("Chat", ChatSchema);
