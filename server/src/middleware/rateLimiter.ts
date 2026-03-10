import rateLimit from "express-rate-limit";
import { config } from "../config";

const isDev = config.nodeEnv === "development";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,
  message: { error: { message: "Too many login attempts. Please try again later.", code: "RATE_LIMITED" } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip + ":" + (req.body?.email || "unknown"),
});

export const mrpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: isDev ? 50 : 5,
  message: { error: { message: "MRP run limit reached. Please wait before running again.", code: "RATE_LIMITED" } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const datasetLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isDev ? 20 : 3,
  message: { error: { message: "Dataset generation limit reached. Please wait.", code: "RATE_LIMITED" } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const simulationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: isDev ? 50 : 10,
  message: { error: { message: "Simulation rate limit reached.", code: "RATE_LIMITED" } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const exportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: isDev ? 50 : 10,
  message: { error: { message: "Export rate limit reached. Please wait.", code: "RATE_LIMITED" } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 2000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 50 : 5,
  message: { error: { message: "Too many registration attempts. Please try again later.", code: "RATE_LIMITED" } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || "unknown",
});
