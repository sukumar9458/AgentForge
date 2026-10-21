import { redis } from "@/lib/redis";

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
  // If Redis is not configured, warn and bypass rate limiting (fail open for developer convenience)
  if (!redis) {
    console.warn(
      `[RATE LIMIT] Redis is not configured. Allowing request for user: ${userId}`
    );
    return {
      allowed: true,
      rpmLimit: rpmMax,
      rpmRemaining: rpmMax,
      rpdLimit: rpdMax,
      rpdRemaining: rpdMax,
      retryAfterSeconds: 0,
    };
  }

  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const keyRpm = `rate:rpm:${userId}`;
  const keyRpd = `rate:rpd:${userId}`;

  try {
    // 1. Run pipeline to clean up expired slide records and read window counts
    const p = redis.pipeline();
    
    // Clean and read Minute window (RPM)
    p.zremrangebyscore(keyRpm, 0, oneMinuteAgo);
    p.zcard(keyRpm);
    p.zrange(keyRpm, 0, 0); // Get the oldest element in the last minute

    // Clean and read Day window (RPD)
    p.zremrangebyscore(keyRpd, 0, oneDayAgo);
    p.zcard(keyRpd);
    p.zrange(keyRpd, 0, 0); // Get the oldest element in the last 24h

    const results = await p.exec();

    // Check pipeline responses safely
    const rpmCount = (results[1] as number) || 0;
    const oldestMinuteEntries = (results[2] as string[]) || [];

    const rpdCount = (results[4] as number) || 0;
    const oldestDailyEntries = (results[5] as string[]) || [];

    const rpmRemaining = Math.max(0, rpmMax - rpmCount);
    const rpdRemaining = Math.max(0, rpdMax - rpdCount);

    // 2. Check Minute limit (RPM)
    if (rpmCount >= rpmMax) {
      let retryAfter = 60; // fallback default
      if (oldestMinuteEntries.length > 0 && oldestMinuteEntries[0]) {
        const oldestTimestamp = parseInt(oldestMinuteEntries[0].split(":")[0]);
        if (!isNaN(oldestTimestamp)) {
          const timePassedMs = now - oldestTimestamp;
          retryAfter = Math.ceil((60 * 1000 - timePassedMs) / 1000);
        }
      }

      return {
        allowed: false,
        rpmLimit: rpmMax,
        rpmRemaining: 0,
        rpdLimit: rpdMax,
        rpdRemaining,
        retryAfterSeconds: Math.max(1, retryAfter),
      };
    }

    // 3. Check Daily limit (RPD)
    if (rpdCount >= rpdMax) {
      let retryAfter = 3600; // fallback default (1 hour)
      if (oldestDailyEntries.length > 0 && oldestDailyEntries[0]) {
        const oldestTimestamp = parseInt(oldestDailyEntries[0].split(":")[0]);
        if (!isNaN(oldestTimestamp)) {
          const timePassedMs = now - oldestTimestamp;
          retryAfter = Math.ceil((24 * 60 * 60 * 1000 - timePassedMs) / 1000);
        }
      }

      return {
        allowed: false,
        rpmLimit: rpmMax,
        rpmRemaining,
        rpdLimit: rpdMax,
        rpdRemaining: 0,
        retryAfterSeconds: Math.max(1, retryAfter),
      };
    }

    // 4. Log the new event in Redis since limits are respected
    const member = `${now}:${Math.random()}`;
    const writePipeline = redis.pipeline();

    writePipeline.zadd(keyRpm, { score: now, member });
    writePipeline.zadd(keyRpd, { score: now, member });
    writePipeline.expire(keyRpm, 60);
    writePipeline.expire(keyRpd, 86400);

    await writePipeline.exec();

    return {
      allowed: true,
      rpmLimit: rpmMax,
      rpmRemaining: Math.max(0, rpmMax - (rpmCount + 1)),
      rpdLimit: rpdMax,
      rpdRemaining: Math.max(0, rpdMax - (rpdCount + 1)),
      retryAfterSeconds: 0,
    };

  } catch (error) {
    console.error("[RATE LIMIT] Redis rate limiter error, failing open for safety:", error);
    // Fail-open for rate limiting to ensure API availability if Redis goes down
    return {
      allowed: true,
      rpmLimit: rpmMax,
      rpmRemaining: rpmMax,
      rpdLimit: rpdMax,
      rpdRemaining: rpdMax,
      retryAfterSeconds: 0,
    };
  }
}
