import mongoose, { Schema, model, models } from "mongoose";

export interface IAgentStep {
  agentName: string;
  action: string;
  input?: string;
  output?: string;
  duration?: number;
  timestamp: Date;
}

export interface IMessageFile {
  name: string;
  url: string;
  type: string;
  key: string;
}

export interface IMessage {
  _id: string;
  sessionId: mongoose.Types.ObjectId;
  chatId?: mongoose.Types.ObjectId;
  sender: string; // "User", "Supervisor", "Researcher", etc.
  senderId?: mongoose.Types.ObjectId; // User object ref if senderType is user
  senderType: "user" | "agent" | "system";
  content: string;
  steps: IAgentStep[];
  files: IMessageFile[];
  createdAt: Date;
}

const AgentStepSchema = new Schema<IAgentStep>({
  agentName: { type: String, required: true },
  action: { type: String, required: true },
  input: { type: String },
  output: { type: String },
  duration: { type: Number },
  timestamp: { type: Date, default: Date.now },
});

const MessageFileSchema = new Schema<IMessageFile>({
  name: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, required: true },
  key: { type: String, required: true },
});

const MessageSchema = new Schema<IMessage>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
    chatId: { type: Schema.Types.ObjectId, ref: "Chat", required: false },
    sender: { type: String, required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User" },
    senderType: { type: String, enum: ["user", "agent", "system"], required: true },
    content: { type: String, required: true },
    steps: [AgentStepSchema],
    files: [MessageFileSchema],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Message = models.Message || model<IMessage>("Message", MessageSchema);
