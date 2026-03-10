import { prisma } from "../prisma";

interface CopilotContext {
  tenantId: string;
  userId: string;
  query: string;
}

interface CopilotResponse {
  answer: string;
  context: Record<string, unknown>;
  sources: Array<{ type: string; description: string }>;
  suggestions: string[];
}

// ─── Context Builder: gathers relevant ERP data based on the question ─
async function buildContext(query: string, tenantId: string) {
  const lowerQuery = query.toLowerCase();
  const context: Record<string, unknown> = {};
  const sources: Array<{ type: string; description: string }> = [];

  // Detect intent from query keywords
  const intents = {
    mrp: /\b(mrp|material.?requirement|planned.?order|why.*(purchase|order|buy))\b/i,
    inventory: /\b(inventory|stock|negative|safety.?stock|reorder|shortage)\b/i,
    production: /\b(production|manufactur|bom|bill.?of.?material|work.?center|capacity)\b/i,
    finance: /\b(journal|posting|payment|invoice|account|gl|ledger|balance|cost|profit)\b/i,
    sales: /\b(sales.?order|delivery|customer|revenue|shipment)\b/i,
    purchasing: /\b(purchase.?order|vendor|supplier|procurement|pr|requisition)\b/i,
    quality: /\b(quality|inspection|non.?conformance|defect)\b/i,
    assignment: /\b(assignment|exercise|course|learn|complete|grade|progress)\b/i,
    workflow: /\b(workflow|approval|task|pending|approve|reject)\b/i,
    process: /\b(process|flow|bottleneck|lead.?time|cycle.?time)\b/i,
  };

  // Gather data based on detected intents
  if (intents.inventory.test(lowerQuery)) {
    const materials = await prisma.material.findMany({
      where: { tenantId },
      orderBy: { stockQuantity: "asc" },
      take: 10,
    });
    const lowStock = materials.filter((m) => m.stockQuantity <= m.safetyStock && m.safetyStock > 0);
    const negativeStock = materials.filter((m) => m.stockQuantity < 0);

    context.materials = materials;
    context.lowStockItems = lowStock;
    context.negativeStockItems = negativeStock;
    context.totalMaterials = await prisma.material.count({ where: { tenantId } });
    sources.push({ type: "materials", description: `${materials.length} materials checked` });

    const recentMovements = await prisma.inventoryMovement.findMany({
      where: { material: { tenantId } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    context.recentMovements = recentMovements;
    sources.push({ type: "inventory_movements", description: `${recentMovements.length} recent movements` });
  }

  if (intents.mrp.test(lowerQuery)) {
    const plannedOrders = await prisma.plannedOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    context.plannedOrders = plannedOrders;

    const mrpRuns = await prisma.mrpRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    context.mrpRuns = mrpRuns;

    const forecasts = await prisma.demandForecast.findMany({
      where: { tenantId },
      orderBy: { periodStart: "desc" },
      take: 10,
    });
    context.forecasts = forecasts;
    sources.push({ type: "mrp", description: `${plannedOrders.length} planned orders, ${mrpRuns.length} MRP runs` });
  }

  if (intents.production.test(lowerQuery)) {
    const prodOrders = await prisma.productionOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    context.productionOrders = prodOrders;

    const boms = await prisma.billOfMaterial.findMany({
      where: { tenantId },
      include: { components: { include: { material: true } }, material: true },
      take: 5,
    });
    context.boms = boms;
    sources.push({ type: "production", description: `${prodOrders.length} production orders` });
  }

  if (intents.finance.test(lowerQuery)) {
    const recentEntries = await prisma.journalEntry.findMany({
      where: { tenantId },
      orderBy: { postingDate: "desc" },
      take: 10,
      include: { lineItems: true },
    });
    context.journalEntries = recentEntries;

    const accounts = await prisma.gLAccount.findMany({
      where: { tenantId },
      take: 20,
    });
    context.glAccounts = accounts;
    sources.push({ type: "finance", description: `${recentEntries.length} journal entries` });
  }

  if (intents.sales.test(lowerQuery)) {
    const salesOrders = await prisma.salesOrder.findMany({
      where: { tenantId },
      orderBy: { orderDate: "desc" },
      take: 10,
      include: { items: true, customer: true },
    });
    context.salesOrders = salesOrders;
    sources.push({ type: "sales", description: `${salesOrders.length} sales orders` });
  }

  if (intents.purchasing.test(lowerQuery)) {
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { items: true, vendor: true },
    });
    context.purchaseOrders = purchaseOrders;
    sources.push({ type: "purchasing", description: `${purchaseOrders.length} purchase orders` });
  }

  if (intents.assignment.test(lowerQuery)) {
    const exercises = await prisma.exercise.findMany({
      where: { tenantId },
      take: 20,
    });
    context.exercises = exercises;
    sources.push({ type: "learning", description: `${exercises.length} exercises` });
  }

  if (intents.workflow.test(lowerQuery)) {
    const pendingTasks = await prisma.workflowTask.findMany({
      where: { instance: { definition: { tenantId } }, status: "pending" },
      include: { instance: { include: { definition: true } } },
      take: 10,
    });
    context.pendingWorkflowTasks = pendingTasks;
    sources.push({ type: "workflow", description: `${pendingTasks.length} pending tasks` });
  }

  if (intents.process.test(lowerQuery)) {
    const events = await prisma.processEvent.findMany({
      where: { tenantId },
      orderBy: { timestamp: "desc" },
      take: 50,
    });
    context.processEvents = events;
    sources.push({ type: "process_events", description: `${events.length} process events` });
  }

  // Always include audit log for context
  const recentAudit = await prisma.auditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  context.recentAuditLog = recentAudit;
  sources.push({ type: "audit_log", description: `${recentAudit.length} recent actions` });

  return { context, sources };
}

// ─── Response Generator: builds intelligent explanations ──────────────
function generateResponse(query: string, context: Record<string, unknown>): CopilotResponse {
  const lowerQuery = query.toLowerCase();
  let answer = "";
  const suggestions: string[] = [];

  // Inventory-related questions
  if (/\b(negative.?stock|inventory.?negative)\b/i.test(lowerQuery)) {
    const negItems = (context.negativeStockItems as Array<{ description: string; stockQuantity: number; materialNumber: string }>) ?? [];
    if (negItems.length > 0) {
      answer = `Found ${negItems.length} material(s) with negative stock:\n\n`;
      for (const m of negItems) {
        answer += `- **${m.materialNumber}** (${m.description}): ${m.stockQuantity} units\n`;
      }
      answer += `\n**Common causes:**\n`;
      answer += `1. Goods issue posted before goods receipt\n`;
      answer += `2. Backdated stock adjustments\n`;
      answer += `3. Missing inventory movement postings\n`;
      answer += `4. BOM component consumption exceeding available stock\n\n`;
      answer += `**Recommended actions:**\n`;
      answer += `1. Check pending goods receipts for these materials\n`;
      answer += `2. Review recent inventory movements\n`;
      answer += `3. Run inventory reconciliation\n`;
      answer += `4. Post corrective adjustments if needed`;
      suggestions.push("Show me recent inventory movements", "Run inventory reconciliation", "Check pending purchase orders");
    } else {
      answer = "No materials currently have negative stock. Your inventory looks healthy!";
      suggestions.push("Show low stock items", "Run MRP to check requirements");
    }
  }

  // MRP questions
  else if (/\b(why.*(mrp|purchase|planned).*(create|order|generate))\b/i.test(lowerQuery)) {
    const planned = (context.plannedOrders as Array<{ material?: { description: string }; quantity: number; orderType: string }>) ?? [];
    const forecasts = (context.forecasts as Array<{ quantity: number }>) ?? [];
    answer = `MRP creates planned orders based on:\n\n`;
    answer += `**1. Net Requirements Calculation:**\n`;
    answer += `   Requirement = Demand - Available Stock - Scheduled Receipts\n\n`;
    answer += `**2. Current State:**\n`;
    answer += `   - ${planned.length} planned orders exist\n`;
    answer += `   - ${forecasts.length} demand forecasts loaded\n\n`;
    answer += `**3. MRP Logic:**\n`;
    answer += `   - Independent demand (sales orders, forecasts)\n`;
    answer += `   - Dependent demand (BOM explosion)\n`;
    answer += `   - Safety stock requirements\n`;
    answer += `   - Lot sizing rules (EOQ, fixed, lot-for-lot)\n\n`;
    if (planned.length > 0) {
      answer += `**Recent planned orders:**\n`;
      for (const po of planned.slice(0, 5)) {
        answer += `- ${po.orderType}: ${po.quantity} units of ${po.material?.description ?? "material"}\n`;
      }
    }
    suggestions.push("Show me the BOM explosion", "What are my safety stock levels?", "When was the last MRP run?");
  }

  // Assignment/learning questions
  else if (/\b(how.*(complete|do|finish).*(assignment|exercise|task))\b/i.test(lowerQuery)) {
    const exercises = (context.exercises as Array<{ title: string; module: string; difficulty: string }>) ?? [];
    answer = `**How to complete assignments:**\n\n`;
    answer += `1. Go to **Learning Hub** → My Progress\n`;
    answer += `2. Each exercise has step-by-step instructions\n`;
    answer += `3. Complete the required ERP actions (e.g., create PO, post GR)\n`;
    answer += `4. The system automatically tracks your completion\n\n`;
    if (exercises.length > 0) {
      answer += `**Available exercises (${exercises.length}):**\n`;
      for (const ex of exercises.slice(0, 5)) {
        answer += `- ${ex.title} (${ex.module}, ${ex.difficulty})\n`;
      }
    }
    suggestions.push("Show my progress", "What exercises are pending?", "How do I create a purchase order?");
  }

  // Process/bottleneck questions
  else if (/\b(bottleneck|slow|long.?time|delay)\b/i.test(lowerQuery)) {
    const events = (context.processEvents as Array<{ activity: string; duration: number | null }>) ?? [];
    const activityDurations = new Map<string, number[]>();
    for (const e of events) {
      if (e.duration != null) {
        const arr = activityDurations.get(e.activity) || [];
        arr.push(e.duration);
        activityDurations.set(e.activity, arr);
      }
    }
    const bottlenecks = Array.from(activityDurations.entries())
      .map(([act, durs]) => ({ activity: act, avg: durs.reduce((a, b) => a + b, 0) / durs.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);

    answer = `**Process Bottleneck Analysis:**\n\n`;
    if (bottlenecks.length > 0) {
      answer += `Slowest activities:\n`;
      for (const b of bottlenecks) {
        answer += `- **${b.activity}**: avg ${formatDuration(b.avg * 1000)}\n`;
      }
      answer += `\n**Recommendations:**\n`;
      answer += `1. Review approval workflows for the slowest steps\n`;
      answer += `2. Check resource availability for bottleneck activities\n`;
      answer += `3. Consider parallel processing where possible\n`;
    } else {
      answer += `No duration data available yet. Process events need duration tracking enabled.\n`;
    }
    suggestions.push("Show process map", "Run conformance check", "Show process variants");
  }

  // Purchase order questions
  else if (/\b(purchase.?order|how.*(buy|procure|order))\b/i.test(lowerQuery)) {
    const pos = (context.purchaseOrders as Array<{ poNumber: string; status: string; totalAmount: number; vendor?: { name: string } }>) ?? [];
    answer = `**Purchase Order Process:**\n\n`;
    answer += `1. **Create PR** (Purchase Requisition) — from MRP or manual\n`;
    answer += `2. **Convert to PO** — select vendor, confirm price\n`;
    answer += `3. **Approve PO** — workflow approval if over threshold\n`;
    answer += `4. **Goods Receipt** — receive goods in warehouse\n`;
    answer += `5. **Invoice Verification** — match PO, GR, Invoice (3-way match)\n`;
    answer += `6. **Payment** — execute payment to vendor\n\n`;
    if (pos.length > 0) {
      answer += `**Recent POs (${pos.length}):**\n`;
      for (const po of pos.slice(0, 5)) {
        answer += `- ${po.poNumber}: ${po.status} (${po.vendor?.name ?? "—"}) — $${po.totalAmount?.toFixed(2) ?? 0}\n`;
      }
    }
    suggestions.push("Show pending approvals", "What vendors do we use?", "Show goods receipt status");
  }

  // General fallback
  else {
    answer = `I'll help you understand your ERP system. Here's what I found:\n\n`;

    const audit = (context.recentAuditLog as Array<{ action: string; module: string; createdAt: Date }>) ?? [];
    if (audit.length > 0) {
      answer += `**Recent Activity:**\n`;
      for (const a of audit.slice(0, 5)) {
        answer += `- ${a.action} in ${a.module} (${new Date(a.createdAt).toLocaleString()})\n`;
      }
      answer += `\n`;
    }

    answer += `**What I can help with:**\n`;
    answer += `- Explain why MRP created purchase orders\n`;
    answer += `- Investigate negative inventory\n`;
    answer += `- Identify process bottlenecks\n`;
    answer += `- Guide you through ERP transactions\n`;
    answer += `- Help complete assignments\n`;
    answer += `- Explain financial postings\n`;

    suggestions.push(
      "Why is my inventory negative?",
      "Why did MRP create this purchase order?",
      "How do I complete my assignment?",
      "Show me process bottlenecks",
      "Explain the procure-to-pay process"
    );
  }

  return {
    answer,
    context,
    sources: [],
    suggestions,
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)} min`;
  if (ms < 86400000) return `${(ms / 3600000).toFixed(1)} hours`;
  return `${(ms / 86400000).toFixed(1)} days`;
}

export async function handleCopilotQuery(input: CopilotContext): Promise<CopilotResponse> {
  const { context, sources } = await buildContext(input.query, input.tenantId);
  const response = generateResponse(input.query, context);
  response.sources = sources;
  return response;
}
