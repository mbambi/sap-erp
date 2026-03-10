import { Router, Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);
router.use(requireRoles("admin", "instructor"));

// Allowlist of tenant-scoped tables students/instructors may query
const ALLOWED_TABLES = new Set([
  "Material", "PurchaseOrder", "SalesOrder", "JournalEntry", "GLAccount",
  "Vendor", "Customer", "Plant", "BillOfMaterial", "ProductionOrder",
  "Warehouse", "WarehouseBin", "Equipment", "WorkOrder", "Employee",
  "CostCenter", "InternalOrder", "InspectionLot", "DemandForecast",
  "WorkCenter", "ProductionSchedule", "SupplyChainNode", "SupplyChainLink",
  "InventoryPolicy", "FiscalPeriod", "Asset", "CostEstimate", "Shipment",
  "NonConformance", "CompanyCode",
]);

const FORBIDDEN_PATTERNS = [
  /insert\s+/i,
  /update\s+/i,
  /delete\s+/i,
  /\bdrop\s+/i,
  /\balter\s+/i,
  /\bcreate\s+/i,
  /\btruncate\s+/i,
  /;\s*insert/i,
  /;\s*update/i,
  /;\s*delete/i,
  /;\s*drop/i,
  /;\s*alter/i,
  /;\s*create/i,
  /;\s*truncate/i,
];

function validateReadOnly(sql: string): void {
  const trimmed = sql.trim();
  if (!trimmed.toLowerCase().startsWith("select")) {
    throw new AppError(400, "Only SELECT statements are allowed");
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(sql)) {
      throw new AppError(400, "Query contains forbidden operation (INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE)");
    }
  }
}

function validateTableName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && name.length < 100;
}

// POST /query - execute READ-ONLY SQL with mandatory tenant isolation
router.post("/query", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== "string") throw new AppError(400, "sql required");
    if (sql.length > 2000) throw new AppError(400, "Query too long (max 2000 chars)");
    validateReadOnly(sql);

    // Reject multi-statement queries (semicolons not at end)
    const trimmed = sql.trim().replace(/;$/, "");
    if (trimmed.includes(";")) {
      throw new AppError(400, "Multi-statement queries are not allowed");
    }

    // Reject subqueries/unions that could bypass tenant filter
    if (/\bunion\b/i.test(sql)) {
      throw new AppError(400, "UNION queries are not allowed");
    }

    // Reject PRAGMA, ATTACH, and other SQLite meta commands
    if (/\b(pragma|attach|detach|vacuum|reindex|explain)\b/i.test(sql)) {
      throw new AppError(400, "Meta commands are not allowed");
    }

    // Force tenant isolation: wrap query as subquery with tenant filter
    const tenantId = req.user!.tenantId;

    // Use parameterized tenant filtering to prevent SQL injection
    // The user's query is wrapped, but tenantId is parameterized
    const wrappedSql = `SELECT * FROM (${trimmed}) AS _q WHERE _q."tenantId" = $1`;

    const start = Date.now();
    let rows: unknown;
    try {
      rows = await prisma.$queryRawUnsafe(wrappedSql, tenantId);
    } catch {
      // If the wrapped query fails (table may not have tenantId), try direct with limit
      // Only for tables without tenantId (system tables like Role)
      throw new AppError(400, "Query failed. Ensure you are querying tenant-scoped tables with a tenantId column.");
    }
    const executionTime = Date.now() - start;
    const arr = Array.isArray(rows) ? rows : [rows];
    const columns = arr.length > 0 ? Object.keys(arr[0] as object) : [];
    res.json({
      columns,
      rows: arr,
      rowCount: arr.length,
      executionTime,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      next(new AppError(400, `Query error: ${err.message}`));
    } else {
      next(err);
    }
  }
});

// GET /tables - list allowed tenant-scoped tables
router.get("/tables", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = CURRENT_SCHEMA() AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;
    const allowedTables = tables.filter((t) => ALLOWED_TABLES.has(t.name));
    const result: Array<{ name: string; columns: Array<{ name: string; type: string }> }> = [];
    for (const t of allowedTables) {
      if (!validateTableName(t.name)) continue;
      const cols = await prisma.$queryRaw<Array<{ name: string; type: string }>>(
        Prisma.sql`SELECT COLUMN_NAME as name, DATA_TYPE as type FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = CURRENT_SCHEMA() AND TABLE_NAME = ${t.name} ORDER BY ORDINAL_POSITION`
      );
      result.push({ name: t.name, columns: cols.map((c) => ({ name: c.name, type: c.type })) });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /sample/:table - first 20 rows (tenant-scoped)
router.get("/sample/:table", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const table = String(req.params.table ?? "");
    if (!validateTableName(table)) throw new AppError(400, "Invalid table name");
    if (!ALLOWED_TABLES.has(table)) throw new AppError(403, "Table not allowed");
    const tenantId = req.user!.tenantId;
    // Use allowlisted table name (already validated) with parameterized tenantId
    const safeTable = table.replace(/"/g, "");
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "${safeTable}" WHERE "tenantId" = $1 LIMIT 20`, tenantId
    );
    res.json(Array.isArray(rows) ? rows : [rows]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      next(new AppError(400, `Query error: ${err.message}`));
    } else {
      next(err);
    }
  }
});

// GET /schema - schema for allowed tables only
router.get("/schema", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = await prisma.$queryRaw<Array<{ name: string; create_stmt: string }>>`
      SELECT TABLE_NAME as name, '' as create_stmt FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = CURRENT_SCHEMA() AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;
    // Build schema info from INFORMATION_SCHEMA
    const schemaLines: string[] = [];
    for (const s of schema.filter((s) => ALLOWED_TABLES.has(s.name))) {
      const cols = await prisma.$queryRaw<Array<{ name: string; type: string; nullable: string }>>(
        Prisma.sql`SELECT COLUMN_NAME as name, UDT_NAME as type, IS_NULLABLE as nullable FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = CURRENT_SCHEMA() AND TABLE_NAME = ${s.name} ORDER BY ORDINAL_POSITION`
      );
      const colDefs = cols.map(c => `  ${c.name} ${c.type}${c.nullable === 'NO' ? ' NOT NULL' : ''}`).join(',\n');
      schemaLines.push(`CREATE TABLE ${s.name} (\n${colDefs}\n);`);
    }
    const readable = schemaLines.join('\n\n');
    res.json({ schema: readable });
  } catch (err) {
    next(err);
  }
});

export default router;
