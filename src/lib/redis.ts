import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let redisClient: Redis | null = null;

if (redisUrl && redisToken) {
  redisClient = new Redis({
    url: redisUrl,
    token: redisToken,
  });
} else {
  console.warn(
    "[REDIS] WARNING: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN are not defined in environment variables. Rate limiting will fall back to mock mode."
  );
}

export const redis = redisClient;
