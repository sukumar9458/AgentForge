import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";

// Dynamic schema registration to avoid Mongoose re-registration issues
const RateLimitEventSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, expires: 86400 }, // Auto delete after 24 hours
});

const RateLimitEvent =
  mongoose.models.RateLimitEvent ||
  mongoose.model("RateLimitEvent", RateLimitEventSchema);

export interface RateLimitResult {
  allowed: boolean;
  rpmLimit: number;
  rpmRemaining: number;
  rpdLimit: number;
  rpdRemaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  userId: string,
  rpmMax = 10, // Max 10 Requests Per Minute
  rpdMax = 500 // Max 500 Requests Per Day
): Promise<RateLimitResult> {
  await connectToDatabase();

  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Fetch counts inside sliding windows
  const [rpmCount, rpdCount] = await Promise.all([
    RateLimitEvent.countDocuments({
      userId,
      timestamp: { $gte: oneMinuteAgo },
    }),
    RateLimitEvent.countDocuments({
      userId,
      timestamp: { $gte: oneDayAgo },
    }),
  ]);

  const rpmRemaining = Math.max(0, rpmMax - rpmCount);
  const rpdRemaining = Math.max(0, rpdMax - rpdCount);

  // 2. Evaluate limits
  if (rpmCount >= rpmMax) {
    // Get the oldest event in the last minute to find out when it will slide out
    const oldestMinuteEvent = await RateLimitEvent.findOne({
      userId,
      timestamp: { $gte: oneMinuteAgo },
    }).sort({ timestamp: 1 });

    const timePassedMs = oldestMinuteEvent
      ? now.getTime() - oldestMinuteEvent.timestamp.getTime()
      : 0;
    const retryAfter = Math.ceil((60 * 1000 - timePassedMs) / 1000);

    return {
      allowed: false,
      rpmLimit: rpmMax,
      rpmRemaining: 0,
      rpdLimit: rpdMax,
      rpdRemaining,
      retryAfterSeconds: Math.max(1, retryAfter),
    };
  }

  if (rpdCount >= rpdMax) {
    // Daily limit hit
    return {
      allowed: false,
      rpmLimit: rpmMax,
      rpmRemaining,
      rpdLimit: rpdMax,
      rpdRemaining: 0,
      retryAfterSeconds: 3600, // Try again in 1 hour
    };
  }

  // 3. Register the new event
  await RateLimitEvent.create({ userId, timestamp: now });

  return {
    allowed: true,
    rpmLimit: rpmMax,
    rpmRemaining: Math.max(0, rpmMax - (rpmCount + 1)),
    rpdLimit: rpdMax,
    rpdRemaining: Math.max(0, rpdMax - (rpdCount + 1)),
    retryAfterSeconds: 0,
  };
}
