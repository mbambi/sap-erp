declare namespace Express {
  interface Request {
    params: Record<string, string>;
    query: Record<string, string | undefined>;
  }
}