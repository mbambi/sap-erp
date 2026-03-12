import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";

if (!process.env.JWT_SECRET && nodeEnv === "production") {
  throw new Error("FATAL: JWT_SECRET environment variable must be set in production");
}

// In development, generate a random secret per process start to avoid hardcoded fallback
const devSecret = crypto.randomBytes(32).toString("hex");

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  jwtSecret: process.env.JWT_SECRET || devSecret,
  jwtExpiry: process.env.JWT_EXPIRY || "8h",
  nodeEnv,
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  redisUrl: process.env.REDIS_URL || "",
  // Rate limiting is enabled by default.
  // Set RATE_LIMITING_ENABLED=false to disable rate limiting.
  rateLimitingEnabled: (process.env.RATE_LIMITING_ENABLED || "true").toLowerCase() === "true",
};
