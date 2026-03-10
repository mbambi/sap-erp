import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

type DecisionParams = Record<string, unknown>;

async function analyzeIncreaseSafetyStock(tenantId: string, params: DecisionParams) {
  const materialId = params.materialId as string;
  const newLevel = (params.newLevel as number) ?? 0;
  const material = await prisma.material.findFirst({ where: { id: materialId, tenantId } });
  if (!material) throw new AppError(404, "Material not found");
  const oldLevel = material.safetyStock;
  const holdingCostPct = 0.2;
  const unitCost = material.movingAvgPrice || material.standardPrice;
  const holdingCostChange = ((newLevel - oldLevel) * unitCost * holdingCostPct) / 365;
  const stockoutProbChange = oldLevel > 0 ? -((newLevel - oldLevel) / oldLevel) * 10 : -5;
  const serviceLevelImpact = Math.min(5, Math.max(0, (newLevel - oldLevel) * 0.5));
  const workingCapitalImpact = (newLevel - oldLevel) * unitCost;
  return {
    impacts: [
      { metric: "inventory_holding_cost", before: oldLevel * unitCost * holdingCostPct * 0.01, after: newLevel * unitCost * holdingCostPct * 0.01, change: holdingCostChange, explanation: "Annual holding cost change" },
      { metric: "stockout_probability", before: 5, after: Math.max(0, 5 + stockoutProbChange), change: stockoutProbChange, explanation: "Estimated stockout probability change" },
      { metric: "service_level", before: 95, after: Math.min(99, 95 + serviceLevelImpact), change: serviceLevelImpact, explanation: "Expected service level improvement" },
      { metric: "working_capital", before: oldLevel * unitCost, after: newLevel * unitCost, change: workingCapitalImpact, explanation: "Working capital impact" },
    ],
    tradeoffs: [
      { positive: "Reduced stockout risk", negative: "Higher holding costs and working capital" },
    ],
    recommendation: newLevel > oldLevel * 2 ? "Consider gradual increase to avoid excessive capital tie-up" : "Change appears reasonable",
  };
}

async function analyzeChangeSupplier(tenantId: string, params: DecisionParams) {
  const materialId = params.materialId as string;
  const newVendorId = params.newVendorId as string;
  const material = await prisma.material.findFirst({ where: { id: materialId, tenantId } });
  const newVendor = await prisma.vendor.findFirst({ where: { id: newVendorId, tenantId } });
  if (!material || !newVendor) throw new AppError(404, "Material or vendor not found");
  const existingPO = await prisma.purchaseOrder.findFirst({
    where: { tenantId, items: { some: { materialId } } },
    include: { vendor: true },
  });
  const oldLeadTime = 14;
  const newLeadTime = 10;
  const oldPrice = material.standardPrice;
  const newPrice = oldPrice * 0.95;
  return {
    impacts: [
      { metric: "lead_time", before: oldLeadTime, after: newLeadTime, change: newLeadTime - oldLeadTime, explanation: "Delivery lead time (days)" },
      { metric: "unit_price", before: oldPrice, after: newPrice, change: newPrice - oldPrice, explanation: "Price comparison" },
      { metric: "reliability", before: 92, after: 96, change: 4, explanation: "Supplier reliability score" },
      { metric: "delivery_schedule", before: "standard", after: "improved", change: "positive", explanation: "Impact on delivery schedule" },
    ],
    tradeoffs: [
      { positive: "Faster delivery, potentially lower price", negative: "Qualification and transition effort" },
    ],
    recommendation: "Evaluate total cost of ownership including transition costs",
  };
}

async function analyzeAdjustPrice(tenantId: string, params: DecisionParams) {
  const materialId = params.materialId as string;
  const newPrice = params.newPrice as number;
  const priceType = (params.priceType as string) ?? "selling";
  const material = await prisma.material.findFirst({ where: { id: materialId, tenantId } });
  if (!material) throw new AppError(404, "Material not found");
  const oldPrice = material.standardPrice;
  const elasticity = -1.5;
  const demandChange = elasticity * ((newPrice - oldPrice) / oldPrice) * 100;
  const revenueChange = (1 + demandChange / 100) * newPrice - oldPrice;
  const marginImpact = ((newPrice - material.movingAvgPrice) / newPrice - (oldPrice - material.movingAvgPrice) / oldPrice) * 100;
  return {
    impacts: [
      { metric: "revenue_forecast", before: 100, after: 100 + revenueChange, change: revenueChange, explanation: "Revenue change (%)" },
      { metric: "demand_elasticity", before: 100, after: 100 + demandChange, change: demandChange, explanation: "Estimated demand change (%)" },
      { metric: "margin_impact", before: 25, after: 25 + marginImpact, change: marginImpact, explanation: "Margin percentage change" },
      { metric: "competitive_position", before: "neutral", after: newPrice < oldPrice ? "improved" : "reduced", change: newPrice < oldPrice ? 1 : -1, explanation: "Competitive position" },
    ],
    tradeoffs: [
      { positive: newPrice > oldPrice ? "Higher margin per unit" : "Volume increase", negative: newPrice > oldPrice ? "Potential volume loss" : "Lower margin" },
    ],
    recommendation: "Run A/B test on sample customers before full rollout",
  };
}

async function analyzeChangeLotSize(tenantId: string, params: DecisionParams) {
  const materialId = params.materialId as string;
  const newLotSize = (params.newLotSize as number) ?? 1;
  const material = await prisma.material.findFirst({ where: { id: materialId, tenantId } });
  if (!material) throw new AppError(404, "Material not found");
  const oldLotSize = material.lotSize || 1;
  const setupCost = 100;
  const holdingCostPct = 0.2;
  const unitCost = material.movingAvgPrice || material.standardPrice;
  const annualDemand = 1000;
  const oldSetupCost = (annualDemand / oldLotSize) * setupCost;
  const newSetupCost = (annualDemand / newLotSize) * setupCost;
  const oldHoldingCost = (oldLotSize / 2) * unitCost * holdingCostPct;
  const newHoldingCost = (newLotSize / 2) * unitCost * holdingCostPct;
  const eoq = Math.sqrt((2 * annualDemand * setupCost) / (unitCost * holdingCostPct));
  return {
    impacts: [
      { metric: "setup_cost", before: oldSetupCost, after: newSetupCost, change: newSetupCost - oldSetupCost, explanation: "Annual setup cost" },
      { metric: "holding_cost", before: oldHoldingCost, after: newHoldingCost, change: newHoldingCost - oldHoldingCost, explanation: "Annual holding cost" },
      { metric: "ordering_frequency", before: annualDemand / oldLotSize, after: annualDemand / newLotSize, change: annualDemand / newLotSize - annualDemand / oldLotSize, explanation: "Orders per year" },
      { metric: "eoq_comparison", before: eoq, after: newLotSize, change: newLotSize - eoq, explanation: "EOQ vs new lot size" },
    ],
    tradeoffs: [
      { positive: newLotSize > oldLotSize ? "Fewer setups" : "Lower inventory", negative: newLotSize > oldLotSize ? "Higher inventory" : "More frequent ordering" },
    ],
    recommendation: `EOQ suggests ${Math.round(eoq)} units. Consider aligning with EOQ for optimal cost.`,
  };
}

async function analyzeAddShift(tenantId: string, params: DecisionParams) {
  const workCenterId = params.workCenterId as string;
  const shiftHours = (params.shiftHours as number) ?? 8;
  const workCenter = await prisma.workCenter.findFirst({ where: { id: workCenterId, tenantId } });
  if (!workCenter) throw new AppError(404, "Work center not found");
  const capacityIncrease = (shiftHours / workCenter.capacity) * 100;
  const laborCost = shiftHours * 25;
  const throughputGain = shiftHours * (workCenter.efficiency / 100);
  return {
    impacts: [
      { metric: "capacity_increase", before: 100, after: 100 + capacityIncrease, change: capacityIncrease, explanation: "Capacity increase (%)" },
      { metric: "labor_cost", before: 0, after: laborCost, change: laborCost, explanation: "Daily labor cost ($)" },
      { metric: "throughput_gain", before: workCenter.capacity, after: workCenter.capacity + throughputGain, change: throughputGain, explanation: "Additional capacity (hours)" },
      { metric: "bottleneck_relief", before: "potential", after: "improved", change: 1, explanation: "Bottleneck impact" },
    ],
    tradeoffs: [
      { positive: "Higher output, faster delivery", negative: "Labor cost, potential overtime" },
    ],
    recommendation: "Ensure demand justifies additional capacity; consider temporary vs permanent shift",
  };
}

const ANALYZERS: Record<string, (tenantId: string, params: DecisionParams) => Promise<{ impacts: unknown[]; tradeoffs: unknown[]; recommendation: string }>> = {
  increase_safety_stock: analyzeIncreaseSafetyStock,
  change_supplier: analyzeChangeSupplier,
  adjust_price: analyzeAdjustPrice,
  change_lot_size: analyzeChangeLotSize,
  add_shift: analyzeAddShift,
};

// GET / - list past impact analyses
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const analyses = await prisma.decisionImpact.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    res.json(analyses);
  } catch (err) {
    next(err);
  }
});

// GET /:id - get detail
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id ?? "");
    const impact = await prisma.decisionImpact.findFirst({
      where: { id, tenantId },
    });
    if (!impact) throw new AppError(404, "Analysis not found");
    res.json(impact);
  } catch (err) {
    next(err);
  }
});

// POST /analyze - analyze a decision
router.post("/analyze", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const createdBy = req.user!.userId;
    const { decisionType, parameters } = req.body;
    if (!decisionType || !parameters) throw new AppError(400, "decisionType and parameters required");
    const analyzer = ANALYZERS[decisionType];
    if (!analyzer) throw new AppError(400, `Unknown decision type: ${decisionType}`);
    const result = await analyzer(tenantId, parameters);
    const record = await prisma.decisionImpact.create({
      data: {
        tenantId,
        decisionType,
        parameters: JSON.stringify(parameters),
        impacts: JSON.stringify(result.impacts),
        tradeoffs: JSON.stringify(result.tradeoffs),
        recommendation: result.recommendation,
        createdBy,
      },
    });
    res.json({
      id: record.id,
      impacts: result.impacts,
      tradeoffs: result.tradeoffs,
      recommendation: result.recommendation,
    });
  } catch (err) {
    next(err);
  }
});

// POST /compare - compare two decisions
router.post("/compare", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { decision1, decision2 } = req.body;
    if (!decision1 || !decision2) throw new AppError(400, "decision1 and decision2 required");
    const a1 = ANALYZERS[decision1.decisionType];
    const a2 = ANALYZERS[decision2.decisionType];
    if (!a1 || !a2) throw new AppError(400, "Invalid decision type");
    const [r1, r2] = await Promise.all([a1(tenantId, decision1.parameters), a2(tenantId, decision2.parameters)]);
    res.json({
      decision1: { ...r1, params: decision1 },
      decision2: { ...r2, params: decision2 },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
