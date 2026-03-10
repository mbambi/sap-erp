import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { auditLog } from "../middleware/audit";
import { AppError } from "../middleware/errorHandler";
import { buildCrudRouter } from "../services/crud";

const router = Router();

// GL Accounts
router.use(
  "/gl-accounts",
  buildCrudRouter({
    model: "gLAccount",
    module: "finance",
    resource: "gl_account",
    searchFields: ["accountNumber", "name"],
    include: { companyCode: true },
    defaultSort: { accountNumber: "asc" },
  })
);

// Company Codes
router.use(
  "/company-codes",
  buildCrudRouter({
    model: "companyCode",
    module: "finance",
    resource: "company_code",
    searchFields: ["code", "name"],
    defaultSort: { code: "asc" },
  })
);

// Journal Entries with balanced debit/credit validation
const journalRouter = Router();
journalRouter.use(authenticate);
journalRouter.use(auditLog("finance", "journal_entry"));

journalRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
    const where: any = { tenantId: req.user!.tenantId };
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) {
      where.OR = [
        { documentNumber: { contains: req.query.search as string } },
        { description: { contains: req.query.search as string } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: { lineItems: { include: { glAccount: true } }, companyCode: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.journalEntry.count({ where }),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

journalRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await prisma.journalEntry.findUnique({
      where: { id: req.params.id },
      include: { lineItems: { include: { glAccount: true } }, companyCode: true },
    });
    if (!entry || entry.tenantId !== req.user!.tenantId) {
      throw new AppError(404, "Journal entry not found");
    }
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

journalRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lineItems, ...header } = req.body;
    if (!lineItems || lineItems.length < 2) {
      throw new AppError(400, "At least two line items required");
    }

    const totalDebit = lineItems.reduce((s: number, l: any) => s + (l.debit || 0), 0);
    const totalCredit = lineItems.reduce((s: number, l: any) => s + (l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new AppError(400, `Debits (${totalDebit}) must equal credits (${totalCredit})`);
    }

    const count = await prisma.journalEntry.count({ where: { tenantId: req.user!.tenantId } });
    const docNum = `JE-${String(count + 1).padStart(7, "0")}`;

    const entry = await prisma.journalEntry.create({
      data: {
        ...header,
        tenantId: req.user!.tenantId,
        documentNumber: docNum,
        createdBy: req.user!.userId,
        lineItems: {
          create: lineItems.map((li: any, idx: number) => ({
            ...li,
            lineNumber: idx + 1,
          })),
        },
      },
      include: { lineItems: { include: { glAccount: true } } },
    });
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

journalRouter.post("/:id/post", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await prisma.journalEntry.findUnique({ where: { id: req.params.id } });
    if (!entry || entry.tenantId !== req.user!.tenantId) {
      throw new AppError(404, "Journal entry not found");
    }
    if (entry.status !== "draft") {
      throw new AppError(400, "Only draft entries can be posted");
    }
    const updated = await prisma.journalEntry.update({
      where: { id: req.params.id },
      data: { status: "posted" },
      include: { lineItems: { include: { glAccount: true } } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

journalRouter.post("/:id/reverse", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await prisma.journalEntry.findUnique({
      where: { id: req.params.id },
      include: { lineItems: true },
    });
    if (!entry || entry.tenantId !== req.user!.tenantId) {
      throw new AppError(404, "Journal entry not found");
    }
    if (entry.status !== "posted") {
      throw new AppError(400, "Only posted entries can be reversed");
    }

    const count = await prisma.journalEntry.count({ where: { tenantId: req.user!.tenantId } });
    const docNum = `JE-${String(count + 1).padStart(7, "0")}`;

    const [, reversal] = await prisma.$transaction([
      prisma.journalEntry.update({
        where: { id: req.params.id },
        data: { status: "reversed" },
      }),
      prisma.journalEntry.create({
        data: {
          tenantId: entry.tenantId,
          companyCodeId: entry.companyCodeId,
          documentNumber: docNum,
          postingDate: new Date(),
          documentDate: new Date(),
          description: `Reversal of ${entry.documentNumber}`,
          status: "posted",
          reversalOf: entry.id,
          createdBy: req.user!.userId,
          lineItems: {
            create: entry.lineItems.map((li) => ({
              glAccountId: li.glAccountId,
              lineNumber: li.lineNumber,
              debit: li.credit,
              credit: li.debit,
              description: `Reversal: ${li.description || ""}`,
            })),
          },
        },
        include: { lineItems: true },
      }),
    ]);
    res.status(201).json(reversal);
  } catch (err) {
    next(err);
  }
});

router.use("/journal-entries", journalRouter);

// Vendors
router.use(
  "/vendors",
  buildCrudRouter({
    model: "vendor",
    module: "finance",
    resource: "vendor",
    searchFields: ["vendorNumber", "name", "email"],
    defaultSort: { vendorNumber: "asc" },
  })
);

// Customers
router.use(
  "/customers",
  buildCrudRouter({
    model: "customer",
    module: "finance",
    resource: "customer",
    searchFields: ["customerNumber", "name", "email"],
    defaultSort: { customerNumber: "asc" },
  })
);

// Trial Balance / Financial Summary
router.get("/trial-balance", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accounts = await prisma.gLAccount.findMany({
      where: { tenantId: req.user!.tenantId },
      include: {
        lineItems: {
          where: {
            journalEntry: { status: "posted", tenantId: req.user!.tenantId },
          },
        },
      },
      orderBy: { accountNumber: "asc" },
    });

    const trialBalance = accounts.map((acc) => {
      const totalDebit = acc.lineItems.reduce((s, li) => s + li.debit, 0);
      const totalCredit = acc.lineItems.reduce((s, li) => s + li.credit, 0);
      return {
        accountNumber: acc.accountNumber,
        name: acc.name,
        type: acc.type,
        debit: totalDebit,
        credit: totalCredit,
        balance: totalDebit - totalCredit,
      };
    });

    res.json(trialBalance);
  } catch (err) {
    next(err);
  }
});

export default router;
