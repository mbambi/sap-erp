import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const tenantScope = (req: Request) => req.user!.tenantId;

function getPeriodBounds(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

/** GET / - List financial statements */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, year, month } = req.query;
    const where: { tenantId: string; type?: string; periodYear?: number; periodMonth?: number } = {
      tenantId: tenantScope(req),
    };
    const typeVal = Array.isArray(type) ? type[0] : type;
    const yearVal = Array.isArray(year) ? year[0] : year;
    const monthVal = Array.isArray(month) ? month[0] : month;
    if (typeVal && typeof typeVal === "string") where.type = typeVal;
    if (yearVal) where.periodYear = parseInt(String(yearVal));
    if (monthVal) where.periodMonth = parseInt(String(monthVal));

    const statements = await prisma.financialStatement.findMany({
      where,
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });
    res.json(statements);
  } catch (err) {
    next(err);
  }
});

/** POST /generate/balance-sheet - Generate balance sheet (admin/instructor) */
router.post("/generate/balance-sheet", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, month, companyCode } = req.body;
    if (!year || !month) throw new AppError(400, "year and month are required");

    const tid = tenantScope(req);
    const { start, end } = getPeriodBounds(Number(year), Number(month));

    let companyCodeIds: string[] = [];
    if (companyCode) {
      const cc = await prisma.companyCode.findFirst({
        where: { tenantId: tid, code: companyCode },
      });
      if (!cc) throw new AppError(404, "Company code not found");
      companyCodeIds = [cc.id];
    } else {
      const ccs = await prisma.companyCode.findMany({
        where: { tenantId: tid },
        select: { id: true },
      });
      companyCodeIds = ccs.map((c) => c.id);
    }

    const glAccounts = await prisma.gLAccount.findMany({
      where: {
        tenantId: tid,
        companyCodeId: { in: companyCodeIds },
        isActive: true,
      },
      include: {
        lineItems: {
          where: {
            journalEntry: {
              status: "posted",
              tenantId: tid,
              postingDate: { gte: start, lte: end },
            },
          },
        },
      },
    });

    const assets: { accountNumber: string; name: string; balance: number }[] = [];
    const liabilities: { accountNumber: string; name: string; balance: number }[] = [];
    const equity: { accountNumber: string; name: string; balance: number }[] = [];

    for (const acc of glAccounts) {
      const totalDebit = acc.lineItems.reduce((s, li) => s + li.debit, 0);
      const totalCredit = acc.lineItems.reduce((s, li) => s + li.credit, 0);
      const balance = totalDebit - totalCredit;

      const item = { accountNumber: acc.accountNumber, name: acc.name, balance };
      if (acc.type === "asset") assets.push(item);
      else if (acc.type === "liability") liabilities.push(item);
      else if (acc.type === "equity") equity.push(item);
    }

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
    const totalEquity = equity.reduce((s, e) => s + e.balance, 0);

    const diff = Math.abs(totalAssets - (totalLiabilities + totalEquity));
    if (diff > 0.01) {
      throw new AppError(400, `Balance sheet does not balance: Assets (${totalAssets}) != Liabilities + Equity (${totalLiabilities + totalEquity})`);
    }

    const data = {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
    };

    const stmt = await prisma.financialStatement.create({
      data: {
        tenantId: tid,
        type: "balance_sheet",
        periodYear: Number(year),
        periodMonth: Number(month),
        companyCode: companyCode || null,
        status: "draft",
        data: JSON.stringify(data),
        generatedBy: req.user!.userId,
      },
    });
    res.status(201).json(stmt);
  } catch (err) {
    next(err);
  }
});

/** POST /generate/income-statement - Generate P&L (admin/instructor) */
router.post("/generate/income-statement", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) throw new AppError(400, "year and month are required");

    const tid = tenantScope(req);
    const { start, end } = getPeriodBounds(Number(year), Number(month));

    const glAccounts = await prisma.gLAccount.findMany({
      where: {
        tenantId: tid,
        type: { in: ["revenue", "expense"] },
        isActive: true,
      },
      include: {
        lineItems: {
          where: {
            journalEntry: {
              status: "posted",
              tenantId: tid,
              postingDate: { gte: start, lte: end },
            },
          },
        },
      },
    });

    const revenue: { accountNumber: string; name: string; amount: number }[] = [];
    const expenses: { accountNumber: string; name: string; amount: number }[] = [];

    for (const acc of glAccounts) {
      const totalDebit = acc.lineItems.reduce((s, li) => s + li.debit, 0);
      const totalCredit = acc.lineItems.reduce((s, li) => s + li.credit, 0);
      const amount = acc.type === "revenue" ? totalCredit - totalDebit : totalDebit - totalCredit;

      const item = { accountNumber: acc.accountNumber, name: acc.name, amount };
      if (acc.type === "revenue") revenue.push(item);
      else expenses.push(item);
    }

    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const netIncome = totalRevenue - totalExpenses;

    const data = {
      revenue,
      expenses,
      totalRevenue,
      totalExpenses,
      netIncome,
    };

    const stmt = await prisma.financialStatement.create({
      data: {
        tenantId: tid,
        type: "income_statement",
        periodYear: Number(year),
        periodMonth: Number(month),
        companyCode: null,
        status: "draft",
        data: JSON.stringify(data),
        generatedBy: req.user!.userId,
      },
    });
    res.status(201).json(stmt);
  } catch (err) {
    next(err);
  }
});

/** POST /generate/cash-flow - Generate cash flow statement (admin/instructor) */
router.post("/generate/cash-flow", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) throw new AppError(400, "year and month are required");

    const tid = tenantScope(req);
    const { start, end } = getPeriodBounds(Number(year), Number(month));

    const incomeStmt = await prisma.financialStatement.findFirst({
      where: {
        tenantId: tid,
        type: "income_statement",
        periodYear: Number(year),
        periodMonth: Number(month),
      },
    });
    let netIncome = 0;
    if (incomeStmt) {
      const parsed = JSON.parse(incomeStmt.data) as { netIncome?: number };
      netIncome = parsed.netIncome ?? 0;
    }

    const depreciationEntries = await prisma.assetDepreciation.aggregate({
      where: {
        asset: { tenantId: tid },
        postedAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });
    const depreciation = depreciationEntries._sum.amount ?? 0;

    const operating = netIncome + depreciation;

    const assetChanges = await prisma.asset.findMany({
      where: { tenantId: tid },
      select: { acquisitionCost: true, disposalDate: true, disposalValue: true },
    });
    let investing = 0;
    for (const a of assetChanges) {
      if (a.disposalDate && a.disposalDate >= start && a.disposalDate <= end && a.disposalValue != null) {
        investing += a.disposalValue;
      }
    }

    const data = {
      operating: { netIncome, depreciation, total: operating },
      investing: { total: investing },
      financing: { total: 0 },
      netChange: operating + investing,
    };

    const stmt = await prisma.financialStatement.create({
      data: {
        tenantId: tid,
        type: "cash_flow",
        periodYear: Number(year),
        periodMonth: Number(month),
        companyCode: null,
        status: "draft",
        data: JSON.stringify(data),
        generatedBy: req.user!.userId,
      },
    });
    res.status(201).json(stmt);
  } catch (err) {
    next(err);
  }
});

/** GET /:id - Get specific statement with full data */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const stmt = await prisma.financialStatement.findFirst({
      where: { id, tenantId: tenantScope(req) },
    });
    if (!stmt) throw new AppError(404, "Financial statement not found");
    res.json(stmt);
  } catch (err) {
    next(err);
  }
});

/** POST /:id/finalize - Set status to final (admin/instructor) */
router.post("/:id/finalize", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const stmt = await prisma.financialStatement.findFirst({
      where: { id, tenantId: tenantScope(req) },
    });
    if (!stmt) throw new AppError(404, "Financial statement not found");
    const updated = await prisma.financialStatement.update({
      where: { id },
      data: { status: "final" },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
