import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// ─── Echelon Types ────────────────────────────────────────────────────

interface EchelonNode {
  id: string;
  name: string;
  tier: number; // 0 = customer, 1 = retail, 2 = DC, 3 = warehouse, 4 = factory, 5 = supplier
  type: "customer" | "retail" | "distribution_center" | "regional_warehouse" | "factory" | "supplier";
  inventory: number;
  capacity: number;
  holdingCost: number;
  orderingCost: number;
  leadTimeDays: number;
  safetyStock: number;
  demandMean: number;
  demandStdDev: number;
}

interface EchelonLink {
  from: string;
  to: string;
  transportCost: number;
  leadTimeDays: number;
  capacity: number;
}

// GET /templates - pre-built multi-echelon network templates
router.get("/templates", (_req: Request, res: Response) => {
  const templates = [
    {
      id: "simple-3tier",
      name: "Simple 3-Tier",
      description: "Supplier → Factory → Customer",
      nodes: [
        { id: "sup1", name: "Raw Material Supplier", tier: 5, type: "supplier", inventory: 5000, capacity: 10000, holdingCost: 0.2, orderingCost: 100, leadTimeDays: 7, safetyStock: 500, demandMean: 0, demandStdDev: 0 },
        { id: "fac1", name: "Manufacturing Plant", tier: 4, type: "factory", inventory: 2000, capacity: 5000, holdingCost: 0.5, orderingCost: 200, leadTimeDays: 3, safetyStock: 300, demandMean: 0, demandStdDev: 0 },
        { id: "cust1", name: "End Customer", tier: 0, type: "customer", inventory: 0, capacity: 0, holdingCost: 0, orderingCost: 0, leadTimeDays: 0, safetyStock: 0, demandMean: 100, demandStdDev: 20 },
      ],
      links: [
        { from: "sup1", to: "fac1", transportCost: 2, leadTimeDays: 5, capacity: 1000 },
        { from: "fac1", to: "cust1", transportCost: 3, leadTimeDays: 2, capacity: 800 },
      ],
    },
    {
      id: "standard-5tier",
      name: "Standard 5-Tier",
      description: "Supplier → Factory → Regional Warehouse → Distribution Center → Retail → Customer",
      nodes: [
        { id: "sup1", name: "Tier-1 Supplier", tier: 5, type: "supplier", inventory: 8000, capacity: 15000, holdingCost: 0.15, orderingCost: 80, leadTimeDays: 10, safetyStock: 800, demandMean: 0, demandStdDev: 0 },
        { id: "sup2", name: "Tier-2 Supplier", tier: 5, type: "supplier", inventory: 6000, capacity: 12000, holdingCost: 0.18, orderingCost: 90, leadTimeDays: 12, safetyStock: 600, demandMean: 0, demandStdDev: 0 },
        { id: "fac1", name: "Assembly Factory", tier: 4, type: "factory", inventory: 3000, capacity: 8000, holdingCost: 0.4, orderingCost: 150, leadTimeDays: 5, safetyStock: 400, demandMean: 0, demandStdDev: 0 },
        { id: "rw1", name: "Regional Warehouse East", tier: 3, type: "regional_warehouse", inventory: 2000, capacity: 5000, holdingCost: 0.6, orderingCost: 120, leadTimeDays: 3, safetyStock: 300, demandMean: 0, demandStdDev: 0 },
        { id: "rw2", name: "Regional Warehouse West", tier: 3, type: "regional_warehouse", inventory: 1800, capacity: 4500, holdingCost: 0.6, orderingCost: 120, leadTimeDays: 3, safetyStock: 280, demandMean: 0, demandStdDev: 0 },
        { id: "dc1", name: "Distribution Center", tier: 2, type: "distribution_center", inventory: 1500, capacity: 4000, holdingCost: 0.8, orderingCost: 100, leadTimeDays: 2, safetyStock: 200, demandMean: 0, demandStdDev: 0 },
        { id: "ret1", name: "Retail Store A", tier: 1, type: "retail", inventory: 500, capacity: 1000, holdingCost: 1.0, orderingCost: 50, leadTimeDays: 1, safetyStock: 80, demandMean: 60, demandStdDev: 15 },
        { id: "ret2", name: "Retail Store B", tier: 1, type: "retail", inventory: 400, capacity: 800, holdingCost: 1.0, orderingCost: 50, leadTimeDays: 1, safetyStock: 60, demandMean: 40, demandStdDev: 12 },
        { id: "cust1", name: "Customer Segment", tier: 0, type: "customer", inventory: 0, capacity: 0, holdingCost: 0, orderingCost: 0, leadTimeDays: 0, safetyStock: 0, demandMean: 100, demandStdDev: 25 },
      ],
      links: [
        { from: "sup1", to: "fac1", transportCost: 1.5, leadTimeDays: 7, capacity: 2000 },
        { from: "sup2", to: "fac1", transportCost: 1.8, leadTimeDays: 8, capacity: 1500 },
        { from: "fac1", to: "rw1", transportCost: 2.0, leadTimeDays: 3, capacity: 1200 },
        { from: "fac1", to: "rw2", transportCost: 2.5, leadTimeDays: 4, capacity: 1000 },
        { from: "rw1", to: "dc1", transportCost: 1.0, leadTimeDays: 2, capacity: 800 },
        { from: "rw2", to: "dc1", transportCost: 1.2, leadTimeDays: 2, capacity: 700 },
        { from: "dc1", to: "ret1", transportCost: 0.8, leadTimeDays: 1, capacity: 500 },
        { from: "dc1", to: "ret2", transportCost: 0.9, leadTimeDays: 1, capacity: 400 },
        { from: "ret1", to: "cust1", transportCost: 0.5, leadTimeDays: 0, capacity: 300 },
        { from: "ret2", to: "cust1", transportCost: 0.5, leadTimeDays: 0, capacity: 250 },
      ],
    },
    {
      id: "dual-source",
      name: "Dual-Source Network",
      description: "Two parallel supply chains merging at distribution center",
      nodes: [
        { id: "supA", name: "Supplier A (Domestic)", tier: 5, type: "supplier", inventory: 5000, capacity: 8000, holdingCost: 0.2, orderingCost: 100, leadTimeDays: 5, safetyStock: 500, demandMean: 0, demandStdDev: 0 },
        { id: "supB", name: "Supplier B (Overseas)", tier: 5, type: "supplier", inventory: 10000, capacity: 20000, holdingCost: 0.1, orderingCost: 300, leadTimeDays: 30, safetyStock: 1000, demandMean: 0, demandStdDev: 0 },
        { id: "facA", name: "Factory A", tier: 4, type: "factory", inventory: 2000, capacity: 5000, holdingCost: 0.5, orderingCost: 200, leadTimeDays: 3, safetyStock: 300, demandMean: 0, demandStdDev: 0 },
        { id: "facB", name: "Factory B", tier: 4, type: "factory", inventory: 3000, capacity: 6000, holdingCost: 0.45, orderingCost: 180, leadTimeDays: 4, safetyStock: 350, demandMean: 0, demandStdDev: 0 },
        { id: "dc1", name: "Central DC", tier: 2, type: "distribution_center", inventory: 2500, capacity: 6000, holdingCost: 0.7, orderingCost: 100, leadTimeDays: 2, safetyStock: 400, demandMean: 0, demandStdDev: 0 },
        { id: "cust1", name: "Customer", tier: 0, type: "customer", inventory: 0, capacity: 0, holdingCost: 0, orderingCost: 0, leadTimeDays: 0, safetyStock: 0, demandMean: 120, demandStdDev: 30 },
      ],
      links: [
        { from: "supA", to: "facA", transportCost: 1.5, leadTimeDays: 3, capacity: 1500 },
        { from: "supB", to: "facB", transportCost: 0.8, leadTimeDays: 20, capacity: 3000 },
        { from: "facA", to: "dc1", transportCost: 2.0, leadTimeDays: 2, capacity: 1000 },
        { from: "facB", to: "dc1", transportCost: 1.8, leadTimeDays: 3, capacity: 1200 },
        { from: "dc1", to: "cust1", transportCost: 1.0, leadTimeDays: 1, capacity: 800 },
      ],
    },
  ];

  res.json(templates);
});

// POST /simulate - run multi-echelon inventory simulation
router.post("/simulate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodes, links, periods = 52, policy = "order-up-to" } = req.body as {
      nodes: EchelonNode[];
      links: EchelonLink[];
      periods?: number;
      policy?: "order-up-to" | "reorder-point" | "echelon-stock";
    };

    if (!nodes?.length || !links?.length) throw new AppError(400, "nodes and links are required");

    // Initialize simulation state
    const inventory: Record<string, number> = {};
    const backlog: Record<string, number> = {};
    const orders: Record<string, number[]> = {}; // orders placed per period
    const inTransit: Record<string, Array<{ qty: number; arriveAt: number }>> = {};

    for (const node of nodes) {
      inventory[node.id] = node.inventory;
      backlog[node.id] = 0;
      orders[node.id] = [];
      inTransit[node.id] = [];
    }

    const customerNodes = nodes.filter((n) => n.type === "customer");
    const supplyNodes = nodes.filter((n) => n.type !== "customer");

    // Build downstream map (who orders from whom)
    const downstream = new Map<string, Array<{ link: EchelonLink; node: EchelonNode }>>();
    for (const link of links) {
      if (!downstream.has(link.to)) downstream.set(link.to, []);
      const fromNode = nodes.find((n) => n.id === link.from);
      if (fromNode) downstream.get(link.to)!.push({ link, node: fromNode });
    }

    // Build upstream map (who to serve)
    const upstream = new Map<string, Array<{ link: EchelonLink; node: EchelonNode }>>();
    for (const link of links) {
      if (!upstream.has(link.from)) upstream.set(link.from, []);
      const toNode = nodes.find((n) => n.id === link.to);
      if (toNode) upstream.get(link.from)!.push({ link, node: toNode });
    }

    const timeline: Array<{
      period: number;
      inventory: Record<string, number>;
      orders: Record<string, number>;
      stockouts: string[];
      costs: Record<string, number>;
    }> = [];

    let totalCost = 0;
    const stockoutLog: string[] = [];

    for (let t = 1; t <= periods; t++) {
      const periodOrders: Record<string, number> = {};
      const periodCosts: Record<string, number> = {};
      const periodStockouts: string[] = [];

      // 1. Receive in-transit shipments
      for (const node of nodes) {
        const arriving = inTransit[node.id].filter((s) => s.arriveAt <= t);
        for (const shipment of arriving) {
          inventory[node.id] += shipment.qty;
        }
        inTransit[node.id] = inTransit[node.id].filter((s) => s.arriveAt > t);
      }

      // 2. Customer demand generation
      for (const cust of customerNodes) {
        const demand = Math.max(0, Math.round(cust.demandMean + (Math.random() - 0.5) * 2 * cust.demandStdDev));
        // Try to fulfill from retail/DC nodes that serve customers
        const sources = downstream.get(cust.id) ?? [];
        let remaining = demand;

        for (const { node: src } of sources) {
          if (remaining <= 0) break;
          const available = Math.max(0, inventory[src.id] - backlog[src.id]);
          const fulfilled = Math.min(remaining, available);
          inventory[src.id] -= fulfilled;
          remaining -= fulfilled;
        }

        if (remaining > 0) {
          periodStockouts.push(cust.name);
          stockoutLog.push(`Period ${t}: ${cust.name} short ${remaining} units`);
        }
      }

      // 3. Replenishment ordering (tier by tier, bottom-up)
      const sortedNodes = [...supplyNodes].sort((a, b) => a.tier - b.tier);

      for (const node of sortedNodes) {
        if (node.type === "supplier") continue; // Suppliers have infinite upstream

        let orderQty = 0;

        if (policy === "order-up-to") {
          const target = node.capacity * 0.8;
          if (inventory[node.id] < node.safetyStock) {
            orderQty = Math.round(target - inventory[node.id]);
          }
        } else if (policy === "reorder-point") {
          if (inventory[node.id] <= node.safetyStock + node.demandMean * node.leadTimeDays) {
            orderQty = Math.round(node.capacity * 0.5);
          }
        } else if (policy === "echelon-stock") {
          // Echelon stock: consider downstream inventory too
          const downstreamInv = (upstream.get(node.id) ?? []).reduce((s, { node: dn }) => s + (inventory[dn.id] ?? 0), 0);
          const echelonInv = inventory[node.id] + downstreamInv;
          const echelonTarget = node.capacity * 0.7 + (upstream.get(node.id) ?? []).reduce((s, { node: dn }) => s + dn.safetyStock, 0);
          if (echelonInv < echelonTarget * 0.6) {
            orderQty = Math.round(echelonTarget - echelonInv);
          }
        }

        if (orderQty > 0) {
          periodOrders[node.id] = orderQty;
          orders[node.id].push(orderQty);
          periodCosts[node.id] = (periodCosts[node.id] ?? 0) + node.orderingCost;

          // Fulfill from upstream (supplier) nodes
          const sources = downstream.get(node.id) ?? [];
          for (const { link, node: src } of sources) {
            const shipQty = Math.min(orderQty, inventory[src.id], link.capacity);
            if (shipQty > 0) {
              inventory[src.id] -= shipQty;
              inTransit[node.id].push({ qty: shipQty, arriveAt: t + link.leadTimeDays });
              periodCosts[node.id] = (periodCosts[node.id] ?? 0) + shipQty * link.transportCost;
              orderQty -= shipQty;
            }
            if (orderQty <= 0) break;
          }
        }

        // Holding cost
        periodCosts[node.id] = (periodCosts[node.id] ?? 0) + Math.max(0, inventory[node.id]) * node.holdingCost;
      }

      // Supplier replenishment (infinite supply)
      for (const node of nodes.filter((n) => n.type === "supplier")) {
        const production = node.capacity * (0.7 + Math.random() * 0.3) / periods * 4;
        inventory[node.id] = Math.min(node.capacity, inventory[node.id] + production);
        periodCosts[node.id] = inventory[node.id] * node.holdingCost;
      }

      const periodTotalCost = Object.values(periodCosts).reduce((s, c) => s + c, 0);
      totalCost += periodTotalCost;

      timeline.push({
        period: t,
        inventory: { ...inventory },
        orders: periodOrders,
        stockouts: periodStockouts,
        costs: periodCosts,
      });
    }

    // Bullwhip effect analysis
    const bullwhipAnalysis = supplyNodes
      .filter((n) => orders[n.id].length > 1)
      .map((node) => {
        const orderData = orders[node.id];
        const mean = orderData.reduce((a, b) => a + b, 0) / orderData.length;
        const variance = orderData.reduce((s, v) => s + (v - mean) ** 2, 0) / orderData.length;
        return {
          node: node.name,
          tier: node.tier,
          type: node.type,
          ordersMean: Math.round(mean),
          ordersVariance: Math.round(variance),
          ordersCV: mean > 0 ? Math.round((Math.sqrt(variance) / mean) * 100) / 100 : 0,
          orderCount: orderData.length,
        };
      })
      .sort((a, b) => a.tier - b.tier);

    // Compute variance ratios between tiers
    const tiers = [...new Set(bullwhipAnalysis.map((b) => b.tier))].sort();
    const varianceRatios = tiers.slice(1).map((tier, i) => {
      const currentTierVar = bullwhipAnalysis.filter((b) => b.tier === tier).reduce((s, b) => s + b.ordersVariance, 0);
      const prevTierVar = bullwhipAnalysis.filter((b) => b.tier === tiers[i]).reduce((s, b) => s + b.ordersVariance, 0);
      return {
        fromTier: tiers[i],
        toTier: tier,
        varianceRatio: prevTierVar > 0 ? Math.round((currentTierVar / prevTierVar) * 100) / 100 : 0,
      };
    });

    const totalStockouts = timeline.reduce((s, t) => s + t.stockouts.length, 0);
    const serviceLevel = Math.round(((periods * customerNodes.length - totalStockouts) / Math.max(1, periods * customerNodes.length)) * 10000) / 100;

    res.json({
      summary: {
        totalCost: Math.round(totalCost),
        serviceLevel,
        totalStockouts,
        periods,
        policy,
        networkSize: { nodes: nodes.length, links: links.length },
      },
      bullwhipAnalysis,
      varianceRatios,
      timeline: timeline.filter((_, i) => i % Math.max(1, Math.floor(periods / 52)) === 0 || i === timeline.length - 1),
    });
  } catch (err) {
    next(err);
  }
});

// POST /optimize-safety-stock - multi-echelon safety stock optimization
router.post("/optimize-safety-stock", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodes, links, targetServiceLevel = 95 } = req.body as {
      nodes: EchelonNode[];
      links: EchelonLink[];
      targetServiceLevel?: number;
    };

    if (!nodes?.length) throw new AppError(400, "nodes are required");

    const z = targetServiceLevel >= 99 ? 2.33 : targetServiceLevel >= 97 ? 1.88 : targetServiceLevel >= 95 ? 1.65 : targetServiceLevel >= 90 ? 1.28 : 1.0;

    const results = nodes
      .filter((n) => n.type !== "customer")
      .map((node) => {
        // Find downstream demand
        const downLinks = links.filter((l) => l.from === node.id);
        const downNodes = downLinks.map((l) => nodes.find((n) => n.id === l.to)).filter(Boolean) as EchelonNode[];

        const demandMean = downNodes.reduce((s, n) => s + (n.demandMean > 0 ? n.demandMean : 50), 0) || node.demandMean || 50;
        const demandStdDev = downNodes.reduce((s, n) => s + (n.demandStdDev > 0 ? n.demandStdDev : 10), 0) || node.demandStdDev || 10;

        const replenishmentLT = (downLinks[0]?.leadTimeDays ?? node.leadTimeDays) || 5;

        const safetyStock = Math.round(z * demandStdDev * Math.sqrt(replenishmentLT));
        const reorderPoint = Math.round(demandMean * replenishmentLT + safetyStock);
        const holdingCostPerYear = safetyStock * node.holdingCost * 365;

        return {
          node: node.name,
          tier: node.tier,
          type: node.type,
          currentSafetyStock: node.safetyStock,
          optimizedSafetyStock: safetyStock,
          reorderPoint,
          change: safetyStock - node.safetyStock,
          annualHoldingCost: Math.round(holdingCostPerYear),
          replenishmentLeadTime: replenishmentLT,
        };
      })
      .sort((a, b) => a.tier - b.tier);

    const totalCurrentCost = results.reduce((s, r) => s + r.currentSafetyStock * 0.5 * 365, 0);
    const totalOptimizedCost = results.reduce((s, r) => s + r.annualHoldingCost, 0);

    res.json({
      targetServiceLevel,
      zValue: z,
      results,
      summary: {
        totalCurrentSafetyStock: results.reduce((s, r) => s + r.currentSafetyStock, 0),
        totalOptimizedSafetyStock: results.reduce((s, r) => s + r.optimizedSafetyStock, 0),
        estimatedCurrentCost: Math.round(totalCurrentCost),
        estimatedOptimizedCost: Math.round(totalOptimizedCost),
        costDifference: Math.round(totalOptimizedCost - totalCurrentCost),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
