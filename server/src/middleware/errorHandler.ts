import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error(err.message, { stack: err.stack });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code },
    });
  }

  res.status(500).json({
    error: { message: "Internal server error", code: "INTERNAL_ERROR" },
  });
}
