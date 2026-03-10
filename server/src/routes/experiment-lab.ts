import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// ─── Experiment Templates ─────────────────────────────────────────────
const EXPERIMENT_TEMPLATES = [
  {
    id: "eoq-vs-ss",
    name: "EOQ vs (s,S) Policy",
    description: "Compare Economic Order Quantity with (s,S) inventory policy under demand volatility",
    category: "inventory",
    parameters: [
      { name: "annualDemand", label: "Annual Demand", type: "number", default: 10000 },
      { name: "orderingCost", label: "Ordering Cost ($)", type: "number", default: 50 },
      { name: "holdingCostPct", label: "Holding Cost (%)", type: "number", default: 25 },
      { name: "demandStdDev", label: "Demand Std Dev", type: "number", default: 20 },
      { name: "leadTimeDays", label: "Lead Time (days)", type: "number", default: 7 },
      { name: "serviceLevelPct", label: "Service Level (%)", type: "number", default: 95 },
      { name: "simulationDays", label: "Simulation Days", type: "number", default: 365 },
    ],
    metrics: ["service_level", "total_cost", "stockouts", "avg_inventory"],
  },
  {
    id: "lot-sizing-comparison",
    name: "Lot Sizing Comparison",
    description: "Compare lot-for-lot, EOQ, fixed period, and Silver-Meal lot sizing",
    category: "mrp",
    parameters: [
      { name: "periods", label: "Number of Periods", type: "number", default: 12 },
      { name: "demandPattern", label: "Demand Pattern", type: "select", options: ["constant", "seasonal", "random", "trending"], default: "seasonal" },
      { name: "avgDemand", label: "Average Demand/Period", type: "number", default: 100 },
      { name: "orderingCost", label: "Ordering Cost ($)", type: "number", default: 200 },
      { name: "holdingCost", label: "Holding Cost ($/unit/period)", type: "number", default: 2 },
    ],
    metrics: ["total_cost", "ordering_cost", "holding_cost", "avg_inventory", "num_orders"],
  },
  {
    id: "safety-stock-service",
    name: "Safety Stock vs Service Level",
    description: "Analyze the tradeoff between safety stock investment and service level",
    category: "inventory",
    parameters: [
      { name: "avgDemand", label: "Daily Demand", type: "number", default: 50 },
      { name: "demandStdDev", label: "Demand Std Dev", type: "number", default: 15 },
      { name: "leadTimeDays", label: "Lead Time (days)", type: "number", default: 5 },
      { name: "unitCost", label: "Unit Cost ($)", type: "number", default: 10 },
      { name: "holdingCostPct", label: "Holding Cost (%)", type: "number", default: 25 },
      { name: "serviceLevels", label: "Service Levels to Test (%)", type: "array", default: [80, 85, 90, 95, 97, 99, 99.5] },
    ],
    metrics: ["safety_stock", "holding_cost", "expected_stockouts", "total_cost"],
  },
  {
    id: "bullwhip-effect",
    name: "Bullwhip Effect Simulation",
    description: "Demonstrate information distortion in supply chains",
    category: "supply_chain",
    parameters: [
      { name: "stages", label: "Supply Chain Stages", type: "number", default: 4 },
      { name: "periods", label: "Simulation Periods", type: "number", default: 52 },
      { name: "baseDemand", label: "Base Customer Demand", type: "number", default: 100 },
      { name: "demandVariability", label: "Demand Variability (%)", type: "number", default: 10 },
      { name: "orderUpToMultiplier", label: "Order-Up-To Multiplier", type: "number", default: 1.2 },
    ],
    metrics: ["demand_amplification", "order_variance_ratio", "inventory_variance", "cost_per_stage"],
  },
  {
    id: "scheduling-rules",
    name: "Scheduling Rule Comparison",
    description: "Compare FIFO, SPT, EDD, and CR dispatching rules",
    category: "production",
    parameters: [
      { name: "numJobs", label: "Number of Jobs", type: "number", default: 20 },
      { name: "numMachines", label: "Number of Machines", type: "number", default: 3 },
      { name: "maxProcessingTime", label: "Max Processing Time", type: "number", default: 10 },
      { name: "maxDueDate", label: "Max Due Date", type: "number", default: 50 },
    ],
    metrics: ["makespan", "avg_flow_time", "avg_tardiness", "num_late_jobs", "utilization"],
  },
];

// GET /templates — list experiment templates
router.get("/templates", (_req: Request, res: Response) => {
  res.json(EXPERIMENT_TEMPLATES);
});

// GET /templates/:id — get template details
router.get("/templates/:id", (req: Request, res: Response) => {
  const template = EXPERIMENT_TEMPLATES.find((t) => t.id === req.params.id);
  if (!template) return res.status(404).json({ error: "Template not found" });
  res.json(template);
});

// POST /run — run an experiment
router.post("/run", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { templateId, parameters, name } = req.body;

    if (!templateId) throw new AppError(400, "templateId required");

    const template = EXPERIMENT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) throw new AppError(404, "Template not found");

    const params = parameters ?? {};
    // Apply defaults
    for (const p of template.parameters) {
      if (params[p.name] === undefined) params[p.name] = p.default;
    }

    let results: Record<string, unknown>;

    switch (templateId) {
      case "eoq-vs-ss":
        results = runEOQvsSS(params);
        break;
      case "lot-sizing-comparison":
        results = runLotSizingComparison(params);
        break;
      case "safety-stock-service":
        results = runSafetyStockAnalysis(params);
        break;
      case "bullwhip-effect":
        results = runBullwhipSimulation(params);
        break;
      case "scheduling-rules":
        results = runSchedulingComparison(params);
        break;
      default:
        throw new AppError(400, "Unknown experiment template");
    }

    // Store results
    const run = await prisma.optimizationRun.create({
      data: {
        tenantId,
        type: `experiment_${templateId}`,
        name: name ?? `${template.name} — ${new Date().toISOString().slice(0, 16)}`,
        parameters: JSON.stringify(params),
        algorithm: templateId,
        status: "completed",
        result: JSON.stringify(results),
        objectiveValue: 0,
        createdBy: userId,
        completedAt: new Date(),
      },
    });

    res.status(201).json({
      experimentId: run.id,
      template: template.name,
      parameters: params,
      results,
    });
  } catch (err) {
    next(err);
  }
});

// GET /history — get experiment history
router.get("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const runs = await prisma.optimizationRun.findMany({
      where: { tenantId, type: { startsWith: "experiment_" } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json(runs.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      parameters: JSON.parse(r.parameters),
      results: JSON.parse(r.result ?? "{}"),
      createdAt: r.createdAt,
    })));
  } catch (err) {
    next(err);
  }
});

// GET /export/:id — export experiment results as CSV-compatible JSON
router.get("/export/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const run = await prisma.optimizationRun.findFirst({
      where: { id: req.params.id as string, tenantId, type: { startsWith: "experiment_" } },
    });
    if (!run) throw new AppError(404, "Experiment not found");

    const results = JSON.parse(run.result ?? "{}");
    const params = JSON.parse(run.parameters);

    res.json({
      metadata: {
        experimentName: run.name,
        experimentType: run.type,
        runDate: run.createdAt,
        parameters: params,
      },
      data: results,
      exportFormats: ["json", "csv"],
    });
  } catch (err) {
    next(err);
  }
});

// ─── Experiment Runners ───────────────────────────────────────────────

function runEOQvsSS(params: Record<string, number>): Record<string, unknown> {
  const { annualDemand: D, orderingCost: S, holdingCostPct, demandStdDev, leadTimeDays, serviceLevelPct, simulationDays } = params;
  const H = holdingCostPct / 100;
  const z = serviceLevelPct >= 99 ? 2.33 : serviceLevelPct >= 95 ? 1.65 : serviceLevelPct >= 90 ? 1.28 : 1;

  // EOQ Policy
  const eoq = Math.sqrt((2 * D * S) / Math.max(H, 0.001));
  const eqSafetyStock = z * demandStdDev * Math.sqrt(leadTimeDays);
  const eoqROP = (D / 365) * leadTimeDays + eqSafetyStock;
  const eoqTotalCost = (D / eoq) * S + (eoq / 2) * H + eqSafetyStock * H;

  // (s,S) Policy: s = reorder point, S = order-up-to level
  const sLevel = eoqROP; // reorder point
  const SLevel = sLevel + eoq; // order-up-to level

  // Simulate both policies
  const dailyDemand = D / 365;
  let eoqStock = eoq / 2 + eqSafetyStock;
  let ssStock = SLevel;
  let eoqStockouts = 0, ssStockouts = 0;
  let eoqOrders = 0, ssOrders = 0;
  let eoqTotalInv = 0, ssTotalInv = 0;
  const eoqTimeline: Array<{ day: number; stock: number }> = [];
  const ssTimeline: Array<{ day: number; stock: number }> = [];

  for (let day = 1; day <= simulationDays; day++) {
    const demand = Math.max(0, dailyDemand + (Math.random() - 0.5) * 2 * demandStdDev / Math.sqrt(365));

    // EOQ
    eoqStock -= demand;
    if (eoqStock < 0) { eoqStockouts++; eoqStock = 0; }
    if (eoqStock <= eoqROP) { eoqStock += eoq; eoqOrders++; }
    eoqTotalInv += eoqStock;

    // (s,S)
    ssStock -= demand;
    if (ssStock < 0) { ssStockouts++; ssStock = 0; }
    if (ssStock <= sLevel) { ssStock = SLevel; ssOrders++; }
    ssTotalInv += ssStock;

    if (day % 7 === 0) {
      eoqTimeline.push({ day, stock: Math.round(eoqStock) });
      ssTimeline.push({ day, stock: Math.round(ssStock) });
    }
  }

  return {
    eoq: {
      orderQuantity: Math.round(eoq),
      reorderPoint: Math.round(eoqROP),
      safetyStock: Math.round(eqSafetyStock),
      totalCost: Math.round(eoqTotalCost),
      serviceLevel: Math.round(((simulationDays - eoqStockouts) / simulationDays) * 10000) / 100,
      stockoutDays: eoqStockouts,
      numOrders: eoqOrders,
      avgInventory: Math.round(eoqTotalInv / simulationDays),
      timeline: eoqTimeline,
    },
    ss: {
      sLevel: Math.round(sLevel),
      SLevel: Math.round(SLevel),
      serviceLevel: Math.round(((simulationDays - ssStockouts) / simulationDays) * 10000) / 100,
      stockoutDays: ssStockouts,
      numOrders: ssOrders,
      avgInventory: Math.round(ssTotalInv / simulationDays),
      timeline: ssTimeline,
    },
    winner: eoqStockouts <= ssStockouts ? "EOQ" : "(s,S)",
    comparison: {
      serviceLevelDiff: Math.round(((simulationDays - eoqStockouts) / simulationDays - (simulationDays - ssStockouts) / simulationDays) * 10000) / 100,
      inventoryDiff: Math.round((eoqTotalInv - ssTotalInv) / simulationDays),
    },
  };
}

function runLotSizingComparison(params: Record<string, unknown>): Record<string, unknown> {
  const periods = params.periods as number;
  const avgDemand = params.avgDemand as number;
  const orderingCost = params.orderingCost as number;
  const holdingCost = params.holdingCost as number;
  const pattern = params.demandPattern as string;

  // Generate demand
  const demand: number[] = [];
  for (let i = 0; i < periods; i++) {
    let d = avgDemand;
    if (pattern === "seasonal") d *= 1 + 0.5 * Math.sin((2 * Math.PI * i) / 12);
    else if (pattern === "random") d *= 0.5 + Math.random();
    else if (pattern === "trending") d *= 1 + 0.05 * i;
    demand.push(Math.round(d));
  }

  function simulate(rule: string) {
    let totalOrder = 0, totalHolding = 0, numOrders = 0, inventory = 0;
    const invLevels: number[] = [];

    if (rule === "lot-for-lot") {
      for (const d of demand) {
        numOrders++;
        totalOrder += orderingCost;
        invLevels.push(0);
      }
    } else if (rule === "eoq") {
      const eoq = Math.round(Math.sqrt((2 * avgDemand * periods * orderingCost) / holdingCost));
      for (const d of demand) {
        if (inventory < d) { inventory += eoq; numOrders++; totalOrder += orderingCost; }
        inventory -= d;
        totalHolding += inventory * holdingCost;
        invLevels.push(inventory);
      }
    } else if (rule === "fixed-period") {
      const fixedPeriods = 3;
      for (let i = 0; i < demand.length; i++) {
        if (i % fixedPeriods === 0) {
          const qty = demand.slice(i, i + fixedPeriods).reduce((a, b) => a + b, 0);
          inventory += qty;
          numOrders++;
          totalOrder += orderingCost;
        }
        inventory -= demand[i];
        totalHolding += Math.max(0, inventory) * holdingCost;
        invLevels.push(Math.max(0, inventory));
      }
    } else if (rule === "silver-meal") {
      let i = 0;
      while (i < demand.length) {
        let bestCost = Infinity;
        let bestPeriods = 1;
        for (let j = 1; j <= Math.min(6, demand.length - i); j++) {
          let holdCost = 0;
          for (let k = 1; k < j; k++) {
            holdCost += demand[i + k] * k * holdingCost;
          }
          const avgCost = (orderingCost + holdCost) / j;
          if (avgCost < bestCost) { bestCost = avgCost; bestPeriods = j; }
          else break;
        }
        const qty = demand.slice(i, i + bestPeriods).reduce((a, b) => a + b, 0);
        inventory += qty;
        numOrders++;
        totalOrder += orderingCost;
        for (let k = 0; k < bestPeriods && i + k < demand.length; k++) {
          inventory -= demand[i + k];
          totalHolding += Math.max(0, inventory) * holdingCost;
          invLevels.push(Math.max(0, inventory));
        }
        i += bestPeriods;
      }
    }

    return {
      totalCost: Math.round(totalOrder + totalHolding),
      orderingCost: Math.round(totalOrder),
      holdingCost: Math.round(totalHolding),
      numOrders,
      avgInventory: invLevels.length > 0 ? Math.round(invLevels.reduce((a, b) => a + b, 0) / invLevels.length) : 0,
      inventoryLevels: invLevels,
    };
  }

  const rules = ["lot-for-lot", "eoq", "fixed-period", "silver-meal"];
  const results: Record<string, unknown> = { demand };
  let bestRule = "";
  let bestCost = Infinity;

  for (const rule of rules) {
    const r = simulate(rule);
    results[rule] = r;
    if (r.totalCost < bestCost) { bestCost = r.totalCost; bestRule = rule; }
  }

  results.bestRule = bestRule;
  results.bestCost = bestCost;

  return results;
}

function runSafetyStockAnalysis(params: Record<string, unknown>): Record<string, unknown> {
  const avgDemand = params.avgDemand as number;
  const demandStdDev = params.demandStdDev as number;
  const leadTimeDays = params.leadTimeDays as number;
  const unitCost = params.unitCost as number;
  const holdingCostPct = params.holdingCostPct as number;
  const serviceLevels = params.serviceLevels as number[];

  const zMap: Record<number, number> = { 80: 0.84, 85: 1.04, 90: 1.28, 95: 1.65, 97: 1.88, 99: 2.33, 99.5: 2.58 };

  const results = serviceLevels.map((sl) => {
    const z = zMap[sl] ?? 1.65;
    const safetyStock = Math.round(z * demandStdDev * Math.sqrt(leadTimeDays));
    const holdingCost = Math.round(safetyStock * unitCost * (holdingCostPct / 100) * 100) / 100;
    const expectedStockouts = Math.round((1 - sl / 100) * 365 * 100) / 100;

    return {
      serviceLevel: sl,
      zValue: z,
      safetyStock,
      holdingCostPerYear: holdingCost,
      expectedStockoutsPerYear: expectedStockouts,
      reorderPoint: Math.round(avgDemand * leadTimeDays + safetyStock),
    };
  });

  return {
    analysis: results,
    recommendation: results.find((r) => r.serviceLevel === 95) ?? results[Math.floor(results.length / 2)],
    marginalAnalysis: results.slice(1).map((r, i) => ({
      from: results[i].serviceLevel,
      to: r.serviceLevel,
      additionalSafetyStock: r.safetyStock - results[i].safetyStock,
      additionalCost: Math.round((r.holdingCostPerYear - results[i].holdingCostPerYear) * 100) / 100,
      stockoutsAvoided: Math.round((results[i].expectedStockoutsPerYear - r.expectedStockoutsPerYear) * 100) / 100,
    })),
  };
}

function runBullwhipSimulation(params: Record<string, number>): Record<string, unknown> {
  const { stages, periods, baseDemand, demandVariability, orderUpToMultiplier } = params;

  // Generate customer demand
  const customerDemand: number[] = [];
  for (let p = 0; p < periods; p++) {
    const noise = (Math.random() - 0.5) * 2 * (demandVariability / 100) * baseDemand;
    customerDemand.push(Math.round(baseDemand + noise));
  }

  // Simulate each stage
  const stageOrders: number[][] = [customerDemand];
  const stageInventory: number[][] = [];

  for (let s = 1; s <= stages; s++) {
    const orders: number[] = [];
    const inventory: number[] = [];
    let currentInventory = baseDemand * 2;
    let movingAvg = baseDemand;

    for (let p = 0; p < periods; p++) {
      const incomingDemand = stageOrders[s - 1][p];
      currentInventory -= incomingDemand;

      // Exponential smoothing for demand estimate
      movingAvg = 0.3 * incomingDemand + 0.7 * movingAvg;
      const orderQty = Math.max(0, Math.round(movingAvg * orderUpToMultiplier - currentInventory));

      orders.push(orderQty);
      currentInventory += orderQty;
      inventory.push(currentInventory);
    }

    stageOrders.push(orders);
    stageInventory.push(inventory);
  }

  // Calculate statistics
  const stageStats = stageOrders.map((orders, i) => {
    const mean = orders.reduce((a, b) => a + b, 0) / orders.length;
    const variance = orders.reduce((a, b) => a + (b - mean) ** 2, 0) / orders.length;
    return {
      stage: i === 0 ? "Customer" : `Stage ${i}`,
      meanOrder: Math.round(mean * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
      cv: mean > 0 ? Math.round((Math.sqrt(variance) / mean) * 10000) / 100 : 0,
    };
  });

  const varianceRatios = stageStats.slice(1).map((s, i) => ({
    from: stageStats[i].stage,
    to: s.stage,
    ratio: stageStats[i].variance > 0
      ? Math.round((s.variance / stageStats[i].variance) * 100) / 100
      : 0,
  }));

  return {
    customerDemand: customerDemand.slice(0, 52),
    stageOrders: stageOrders.map((o, i) => ({
      stage: i === 0 ? "Customer" : `Stage ${i}`,
      orders: o.slice(0, 52),
    })),
    stageStats,
    varianceRatios,
    bullwhipRatio: stageStats.length > 1
      ? Math.round((stageStats[stageStats.length - 1].variance / stageStats[0].variance) * 100) / 100
      : 1,
  };
}

function runSchedulingComparison(params: Record<string, number>): Record<string, unknown> {
  const { numJobs, numMachines, maxProcessingTime, maxDueDate } = params;

  // Generate random jobs
  const jobs = Array.from({ length: numJobs }, (_, i) => ({
    id: `J${i + 1}`,
    processingTime: Math.ceil(Math.random() * maxProcessingTime),
    dueDate: Math.ceil(Math.random() * maxDueDate),
    priority: Math.ceil(Math.random() * 5),
  }));

  function schedule(rule: string) {
    let sorted: typeof jobs;
    switch (rule) {
      case "FIFO": sorted = [...jobs]; break;
      case "SPT": sorted = [...jobs].sort((a, b) => a.processingTime - b.processingTime); break;
      case "EDD": sorted = [...jobs].sort((a, b) => a.dueDate - b.dueDate); break;
      case "CR": sorted = [...jobs].sort((a, b) => {
        const crA = a.dueDate / Math.max(a.processingTime, 1);
        const crB = b.dueDate / Math.max(b.processingTime, 1);
        return crA - crB;
      }); break;
      default: sorted = [...jobs];
    }

    const machineEnd = Array(numMachines).fill(0);
    const results = sorted.map((job) => {
      const machineIdx = machineEnd.indexOf(Math.min(...machineEnd));
      const start = machineEnd[machineIdx];
      const end = start + job.processingTime;
      machineEnd[machineIdx] = end;
      const tardiness = Math.max(0, end - job.dueDate);
      return { ...job, start, end, tardiness, late: tardiness > 0, machine: machineIdx + 1 };
    });

    const makespan = Math.max(...machineEnd);
    const avgFlowTime = results.reduce((s, r) => s + r.end, 0) / results.length;
    const avgTardiness = results.reduce((s, r) => s + r.tardiness, 0) / results.length;
    const numLate = results.filter((r) => r.late).length;
    const totalWork = jobs.reduce((s, j) => s + j.processingTime, 0);
    const utilization = (totalWork / (numMachines * makespan)) * 100;

    return {
      schedule: results,
      makespan: Math.round(makespan),
      avgFlowTime: Math.round(avgFlowTime * 100) / 100,
      avgTardiness: Math.round(avgTardiness * 100) / 100,
      numLateJobs: numLate,
      utilization: Math.round(utilization * 100) / 100,
    };
  }

  const rules = ["FIFO", "SPT", "EDD", "CR"];
  const results: Record<string, unknown> = { jobs };

  for (const rule of rules) {
    results[rule] = schedule(rule);
  }

  // Find best rule per metric
  const comparison = {
    bestMakespan: rules.reduce((best, r) => (results[r] as any).makespan < (results[best] as any).makespan ? r : best, rules[0]),
    bestFlowTime: rules.reduce((best, r) => (results[r] as any).avgFlowTime < (results[best] as any).avgFlowTime ? r : best, rules[0]),
    bestTardiness: rules.reduce((best, r) => (results[r] as any).avgTardiness < (results[best] as any).avgTardiness ? r : best, rules[0]),
    fewestLateJobs: rules.reduce((best, r) => (results[r] as any).numLateJobs < (results[best] as any).numLateJobs ? r : best, rules[0]),
    bestUtilization: rules.reduce((best, r) => (results[r] as any).utilization > (results[best] as any).utilization ? r : best, rules[0]),
  };

  results.comparison = comparison;
  return results;
}

export default router;
