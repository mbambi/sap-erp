import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { handleCopilotQuery } from "../services/copilot";

const router = Router();
router.use(authenticate);

// POST /ask — ask the AI copilot a question
router.post("/ask", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { query } = req.body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      throw new AppError(400, "query is required");
    }
    if (query.length > 2000) {
      throw new AppError(400, "query must be under 2000 characters");
    }

    const response = await handleCopilotQuery({ tenantId, userId, query: query.trim() });

    res.json({
      query: query.trim(),
      ...response,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /suggestions — get contextual suggestions based on user's current activity
router.get("/suggestions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page } = req.query;
    const suggestions: Record<string, string[]> = {
      dashboard: [
        "What are today's key metrics?",
        "Show me overdue purchase orders",
        "Any stock alerts?",
      ],
      materials: [
        "Which materials are below safety stock?",
        "Why did MRP create these planned orders?",
        "Show me slow-moving inventory",
      ],
      production: [
        "What's the current production utilization?",
        "Which production orders are delayed?",
        "Explain the BOM for this product",
      ],
      finance: [
        "What's the current trial balance?",
        "Show me unmatched invoices",
        "Explain this journal entry",
      ],
      sales: [
        "Which sales orders are pending delivery?",
        "What's our order fulfillment rate?",
        "Show me top customers by revenue",
      ],
      warehouse: [
        "Which bins are near capacity?",
        "Show me pending goods receipts",
        "What's the warehouse utilization?",
      ],
      default: [
        "How do I create a purchase order?",
        "Why is my inventory negative?",
        "How do I complete my assignment?",
        "Show me process bottlenecks",
        "Explain the procure-to-pay process",
      ],
    };

    const pageKey = (page as string)?.toLowerCase() ?? "default";
    const matched = suggestions[pageKey] ?? suggestions.default;

    res.json({ page: pageKey, suggestions: matched });
  } catch (err) {
    next(err);
  }
});

export default router;
