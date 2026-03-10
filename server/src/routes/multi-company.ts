import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const tenantScope = (req: Request) => req.user!.tenantId;

// ─── Companies ─────────────────────────────────────────────────────────

/** GET /companies - List companies for tenant */
router.get("/companies", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companies = await prisma.company.findMany({
      where: { tenantId: tenantScope(req) },
      include: { children: true },
      orderBy: { code: "asc" },
    });
    res.json(companies);
  } catch (err) {
    next(err);
  }
});

/** POST /companies - Create company (admin/instructor) */
router.post("/companies", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, type, currency, country, parentId } = req.body;
    if (!code || !name || !type) {
      throw new AppError(400, "code, name, and type are required");
    }
    const company = await prisma.company.create({
      data: {
        tenantId: tenantScope(req),
        code,
        name,
        type,
        currency: currency || "USD",
        country: country || "US",
        parentId: parentId || null,
      },
    });
    res.status(201).json(company);
  } catch (err) {
    next(err);
  }
});

/** PUT /companies/:id - Update company (admin/instructor) */
router.put("/companies/:id", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const company = await prisma.company.findFirst({
      where: { id, tenantId: tenantScope(req) },
    });
    if (!company) throw new AppError(404, "Company not found");
    const updated = await prisma.company.update({
      where: { id },
      data: req.body,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** GET /companies/:id - Get one company with children */
router.get("/companies/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const company = await prisma.company.findFirst({
      where: { id, tenantId: tenantScope(req) },
      include: { children: true, parent: true },
    });
    if (!company) throw new AppError(404, "Company not found");
    res.json(company);
  } catch (err) {
    next(err);
  }
});

// ─── Intercompany Transactions ────────────────────────────────────────

/** GET /transactions - List intercompany transactions */
router.get("/transactions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, fromCompanyCode, toCompanyCode } = req.query;
    const where: { tenantId: string; status?: string; fromCompanyCode?: string; toCompanyCode?: string } = {
      tenantId: tenantScope(req),
    };
    const statusVal = Array.isArray(status) ? status[0] : status;
    const fromVal = Array.isArray(fromCompanyCode) ? fromCompanyCode[0] : fromCompanyCode;
    const toVal = Array.isArray(toCompanyCode) ? toCompanyCode[0] : toCompanyCode;
    if (statusVal && typeof statusVal === "string") where.status = statusVal;
    if (fromVal && typeof fromVal === "string") where.fromCompanyCode = fromVal;
    if (toVal && typeof toVal === "string") where.toCompanyCode = toVal;

    const transactions = await prisma.intercompanyTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    res.json(transactions);
  } catch (err) {
    next(err);
  }
});

/** POST /transactions - Create intercompany transaction */
router.post("/transactions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromCompanyCode, toCompanyCode, type, materialId, quantity, amount, currency, referenceDoc, notes } = req.body;
    if (!fromCompanyCode || !toCompanyCode || !type || amount == null) {
      throw new AppError(400, "fromCompanyCode, toCompanyCode, type, and amount are required");
    }

    const count = await prisma.intercompanyTransaction.count({ where: { tenantId: tenantScope(req) } });
    const transactionNumber = `ICT-${String(count + 1).padStart(7, "0")}`;

    let transferPrice: number | null = null;
    const rule = await prisma.transferPricingRule.findFirst({
      where: {
        tenantId: tenantScope(req),
        fromCompanyCode,
        toCompanyCode,
        materialId: materialId || null,
        isActive: true,
      },
    });
    if (rule) {
      if (rule.method === "cost_plus" && rule.markupPct != null) {
        transferPrice = amount * (1 + rule.markupPct / 100);
      } else if (rule.method === "fixed" || rule.fixedPrice != null) {
        transferPrice = rule.fixedPrice ?? amount;
      }
    }

    const txn = await prisma.intercompanyTransaction.create({
      data: {
        tenantId: tenantScope(req),
        transactionNumber,
        fromCompanyCode,
        toCompanyCode,
        type,
        materialId: materialId || null,
        quantity: quantity ?? null,
        amount: Number(amount),
        currency: currency || "USD",
        transferPrice,
        status: "draft",
        referenceDoc: referenceDoc || null,
        notes: notes || null,
        createdBy: req.user!.userId,
      },
    });
    res.status(201).json(txn);
  } catch (err) {
    next(err);
  }
});

/** POST /transactions/:id/approve - Approve transaction (admin/instructor) */
router.post("/transactions/:id/approve", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const txn = await prisma.intercompanyTransaction.findFirst({
      where: { id, tenantId: tenantScope(req) },
    });
    if (!txn) throw new AppError(404, "Transaction not found");
    const updated = await prisma.intercompanyTransaction.update({
      where: { id },
      data: { status: "approved" },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /transactions/:id/post - Post transaction (admin/instructor) */
router.post("/transactions/:id/post", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const txn = await prisma.intercompanyTransaction.findFirst({
      where: { id, tenantId: tenantScope(req) },
    });
    if (!txn) throw new AppError(404, "Transaction not found");
    const updated = await prisma.intercompanyTransaction.update({
      where: { id },
      data: { status: "posted" },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── Transfer Pricing Rules ───────────────────────────────────────────

/** GET /pricing-rules - List transfer pricing rules */
router.get("/pricing-rules", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await prisma.transferPricingRule.findMany({
      where: { tenantId: tenantScope(req) },
      orderBy: [{ fromCompanyCode: "asc" }, { toCompanyCode: "asc" }],
    });
    res.json(rules);
  } catch (err) {
    next(err);
  }
});

/** POST /pricing-rules - Create transfer pricing rule (admin/instructor) */
router.post("/pricing-rules", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromCompanyCode, toCompanyCode, materialId, method, markupPct, fixedPrice } = req.body;
    if (!fromCompanyCode || !toCompanyCode || !method) {
      throw new AppError(400, "fromCompanyCode, toCompanyCode, and method are required");
    }
    const rule = await prisma.transferPricingRule.create({
      data: {
        tenantId: tenantScope(req),
        fromCompanyCode,
        toCompanyCode,
        materialId: materialId || null,
        method,
        markupPct: markupPct ?? null,
        fixedPrice: fixedPrice ?? null,
      },
    });
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
});

/** PUT /pricing-rules/:id - Update transfer pricing rule (admin/instructor) */
router.put("/pricing-rules/:id", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const rule = await prisma.transferPricingRule.findFirst({
      where: { id, tenantId: tenantScope(req) },
    });
    if (!rule) throw new AppError(404, "Transfer pricing rule not found");
    const updated = await prisma.transferPricingRule.update({
      where: { id },
      data: req.body,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── Consolidated View ─────────────────────────────────────────────────

/** GET /consolidated - Consolidated financial view across all companies */
router.get("/consolidated", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = tenantScope(req);

    const companies = await prisma.company.findMany({
      where: { tenantId: tid },
      select: { code: true, name: true },
    });
    const companyCodes = companies.map((c) => c.code);

    const intercompanyTxns = await prisma.intercompanyTransaction.findMany({
      where: { tenantId: tid, status: "posted" },
    });

    const companyCodeIds = await prisma.companyCode.findMany({
      where: { tenantId: tid, code: { in: companyCodes } },
      select: { id: true, code: true },
    });
    const ccMap = Object.fromEntries(companyCodeIds.map((cc) => [cc.code, cc.id]));

    const glAccounts = await prisma.gLAccount.findMany({
      where: {
        tenantId: tid,
        companyCodeId: { in: companyCodeIds.map((cc) => cc.id) },
      },
      include: {
        lineItems: {
          where: {
            journalEntry: { status: "posted", tenantId: tid },
          },
        },
      },
    });

    const byType: Record<string, number> = {};
    for (const acc of glAccounts) {
      const totalDebit = acc.lineItems.reduce((s, li) => s + li.debit, 0);
      const totalCredit = acc.lineItems.reduce((s, li) => s + li.credit, 0);
      const balance = acc.type === "asset" || acc.type === "expense" ? totalDebit - totalCredit : totalCredit - totalDebit;
      byType[acc.type] = (byType[acc.type] ?? 0) + balance;
    }

    const icElimination = intercompanyTxns.reduce((sum, t) => sum + (t.amount ?? 0), 0);

    res.json({
      assets: byType.asset ?? 0,
      liabilities: byType.liability ?? 0,
      equity: byType.equity ?? 0,
      revenue: byType.revenue ?? 0,
      expenses: byType.expense ?? 0,
      intercompanyElimination: icElimination,
      netIncome: (byType.revenue ?? 0) - (byType.expense ?? 0),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
