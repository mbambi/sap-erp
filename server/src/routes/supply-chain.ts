import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// GET /nodes - list nodes
router.get("/nodes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const nodes = await prisma.supplyChainNode.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    });
    res.json(nodes);
  } catch (err) {
    next(err);
  }
});

// POST /nodes - create node
router.post("/nodes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, type, latitude, longitude, capacity, holdingCost, fixedCost, address } = req.body;
    if (!name || !type) throw new AppError(400, "name and type are required");
    const node = await prisma.supplyChainNode.create({
      data: {
        tenantId,
        name,
        type,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        capacity: capacity ?? null,
        holdingCost: holdingCost ?? null,
        fixedCost: fixedCost ?? null,
        address: address ?? null,
      },
    });
    res.status(201).json(node);
  } catch (err) {
    next(err);
  }
});

// PUT /nodes/:id - update node
router.put("/nodes/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const existing = await prisma.supplyChainNode.findFirst({ where: { id, tenantId } });
    if (!existing) throw new AppError(404, "Node not found");
    const { name, type, latitude, longitude, capacity, holdingCost, fixedCost, address } = req.body;
    const node = await prisma.supplyChainNode.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(capacity !== undefined && { capacity }),
        ...(holdingCost !== undefined && { holdingCost }),
        ...(fixedCost !== undefined && { fixedCost }),
        ...(address !== undefined && { address }),
      },
    });
    res.json(node);
  } catch (err) {
    next(err);
  }
});

// DELETE /nodes/:id - delete node
router.delete("/nodes/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const existing = await prisma.supplyChainNode.findFirst({ where: { id, tenantId } });
    if (!existing) throw new AppError(404, "Node not found");
    await prisma.supplyChainLink.deleteMany({
      where: { OR: [{ fromNodeId: id }, { toNodeId: id }] },
    });
    await prisma.supplyChainNode.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /links - list links
router.get("/links", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const links = await prisma.supplyChainLink.findMany({
      where: { tenantId, isActive: true },
      include: { fromNode: true, toNode: true },
      orderBy: { fromNodeId: "asc" },
    });
    res.json(links);
  } catch (err) {
    next(err);
  }
});

// POST /links - create link
router.post("/links", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { fromNodeId, toNodeId, transportMode, distance, costPerUnit, leadTimeDays, capacity } = req.body;
    if (!fromNodeId || !toNodeId) throw new AppError(400, "fromNodeId and toNodeId are required");
    const link = await prisma.supplyChainLink.create({
      data: {
        tenantId,
        fromNodeId,
        toNodeId,
        transportMode: transportMode ?? "truck",
        distance: distance ?? null,
        costPerUnit: costPerUnit ?? 0,
        leadTimeDays: leadTimeDays ?? 1,
        capacity: capacity ?? null,
      },
      include: { fromNode: true, toNode: true },
    });
    res.status(201).json(link);
  } catch (err) {
    next(err);
  }
});

// PUT /links/:id - update link
router.put("/links/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const existing = await prisma.supplyChainLink.findFirst({ where: { id, tenantId } });
    if (!existing) throw new AppError(404, "Link not found");
    const { fromNodeId, toNodeId, transportMode, distance, costPerUnit, leadTimeDays, capacity } = req.body;
    const link = await prisma.supplyChainLink.update({
      where: { id },
      data: {
        ...(fromNodeId !== undefined && { fromNodeId }),
        ...(toNodeId !== undefined && { toNodeId }),
        ...(transportMode !== undefined && { transportMode }),
        ...(distance !== undefined && { distance }),
        ...(costPerUnit !== undefined && { costPerUnit }),
        ...(leadTimeDays !== undefined && { leadTimeDays }),
        ...(capacity !== undefined && { capacity }),
      },
      include: { fromNode: true, toNode: true },
    });
    res.json(link);
  } catch (err) {
    next(err);
  }
});

// DELETE /links/:id - delete link
router.delete("/links/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const existing = await prisma.supplyChainLink.findFirst({ where: { id, tenantId } });
    if (!existing) throw new AppError(404, "Link not found");
    await prisma.supplyChainLink.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /network - full network graph for visualization
router.get("/network", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const [nodes, links] = await Promise.all([
      prisma.supplyChainNode.findMany({ where: { tenantId, isActive: true } }),
      prisma.supplyChainLink.findMany({
        where: { tenantId, isActive: true },
        include: { fromNode: true, toNode: true },
      }),
    ]);
    res.json({ nodes, links });
  } catch (err) {
    next(err);
  }
});

// POST /optimize - transportation cost optimization (greedy)
router.post("/optimize", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { demand, supply } = req.body as {
      demand?: Record<string, number>; // nodeId -> quantity needed
      supply?: Record<string, number>; // nodeId -> quantity available
    };
    if (!demand || !supply) throw new AppError(400, "demand and supply objects are required");

    const links = await prisma.supplyChainLink.findMany({
      where: { tenantId, isActive: true },
      include: { fromNode: true, toNode: true },
    });

    const routes: Array<{ from: string; to: string; quantity: number; cost: number; totalCost: number }> = [];
    const remainingSupply = { ...supply };
    const remainingDemand = { ...demand };

    const customerNodes = Object.keys(demand);
    const supplierNodes = Object.keys(supply);

    for (const customerId of customerNodes) {
      let need = remainingDemand[customerId] || 0;
      if (need <= 0) continue;

      const incomingLinks = links
        .filter((l) => l.toNodeId === customerId && supplierNodes.includes(l.fromNodeId))
        .sort((a, b) => (a.costPerUnit || 0) - (b.costPerUnit || 0));

      for (const link of incomingLinks) {
        if (need <= 0) break;
        const available = remainingSupply[link.fromNodeId] || 0;
        if (available <= 0) continue;

        const qty = Math.min(need, available, link.capacity ?? Infinity);
        if (qty <= 0) continue;

        const cost = (link.costPerUnit || 0) * qty;
        routes.push({
          from: link.fromNode.name,
          to: link.toNode.name,
          quantity: qty,
          cost: link.costPerUnit || 0,
          totalCost: cost,
        });

        remainingSupply[link.fromNodeId] = (remainingSupply[link.fromNodeId] || 0) - qty;
        remainingDemand[customerId] = (remainingDemand[customerId] || 0) - qty;
        need -= qty;
      }
    }

    const totalCost = routes.reduce((sum, r) => sum + r.totalCost, 0);
    res.json({ routes, totalCost });
  } catch (err) {
    next(err);
  }
});

// ─── Map Editor: layout persistence ───────────────────────────────────

// PUT /layout - save node positions for visual editor
router.put("/layout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { positions } = req.body as { positions: Array<{ nodeId: string; x: number; y: number }> };
    if (!Array.isArray(positions)) throw new AppError(400, "positions array required");

    for (const pos of positions) {
      await prisma.supplyChainNode.updateMany({
        where: { id: pos.nodeId, tenantId },
        data: { latitude: pos.y, longitude: pos.x },
      });
    }

    res.json({ updated: positions.length });
  } catch (err) {
    next(err);
  }
});

// GET /editor - full editor state (nodes with positions + links + templates)
router.get("/editor", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const [nodes, links] = await Promise.all([
      prisma.supplyChainNode.findMany({ where: { tenantId, isActive: true } }),
      prisma.supplyChainLink.findMany({
        where: { tenantId, isActive: true },
        include: { fromNode: true, toNode: true },
      }),
    ]);

    const nodeTemplates = [
      { type: "supplier", label: "Supplier", color: "#3B82F6", icon: "truck" },
      { type: "factory", label: "Factory", color: "#F59E0B", icon: "factory" },
      { type: "warehouse", label: "Warehouse", color: "#10B981", icon: "warehouse" },
      { type: "distribution_center", label: "Distribution Center", color: "#8B5CF6", icon: "building" },
      { type: "retail", label: "Retail Store", color: "#EC4899", icon: "store" },
      { type: "customer", label: "Customer", color: "#6366F1", icon: "users" },
    ];

    const transportModes = [
      { id: "truck", label: "Truck", avgSpeed: 60, costPerKm: 1.5 },
      { id: "rail", label: "Rail", avgSpeed: 80, costPerKm: 0.8 },
      { id: "ship", label: "Ship", avgSpeed: 30, costPerKm: 0.3 },
      { id: "air", label: "Air", avgSpeed: 800, costPerKm: 5.0 },
    ];

    res.json({
      nodes: nodes.map((n) => ({
        ...n,
        x: n.longitude ?? Math.random() * 800,
        y: n.latitude ?? Math.random() * 600,
      })),
      links,
      nodeTemplates,
      transportModes,
    });
  } catch (err) {
    next(err);
  }
});

// POST /simulate - run supply chain simulation on current network
router.post("/simulate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { periods = 12, demandMean = 100, demandStdDev = 20, disruptions = [] } = req.body as {
      periods?: number;
      demandMean?: number;
      demandStdDev?: number;
      disruptions?: Array<{ period: number; nodeId: string; type: string; severity: number }>;
    };

    const [nodes, links] = await Promise.all([
      prisma.supplyChainNode.findMany({ where: { tenantId, isActive: true } }),
      prisma.supplyChainLink.findMany({ where: { tenantId, isActive: true }, include: { fromNode: true, toNode: true } }),
    ]);

    if (nodes.length === 0) throw new AppError(400, "No supply chain nodes to simulate");

    const suppliers = nodes.filter((n) => n.type === "supplier");
    const factories = nodes.filter((n) => n.type === "factory");
    const warehouses = nodes.filter((n) => ["warehouse", "distribution_center"].includes(n.type));
    const customers = nodes.filter((n) => ["customer", "retail"].includes(n.type));

    // Build adjacency
    const outgoing = new Map<string, typeof links>();
    for (const link of links) {
      if (!outgoing.has(link.fromNodeId)) outgoing.set(link.fromNodeId, []);
      outgoing.get(link.fromNodeId)!.push(link);
    }

    // Simulate each period
    const timeline: Array<Record<string, unknown>> = [];
    const nodeInventory: Record<string, number> = {};
    for (const n of nodes) nodeInventory[n.id] = n.capacity ? n.capacity * 0.5 : 500;

    let totalCost = 0;
    let totalStockouts = 0;
    let totalDelivered = 0;

    for (let period = 1; period <= periods; period++) {
      const periodEvents: string[] = [];
      let periodCost = 0;

      // Apply disruptions
      const activeDisruptions = disruptions.filter((d) => d.period === period);
      for (const d of activeDisruptions) {
        if (d.type === "shutdown") {
          nodeInventory[d.nodeId] = 0;
          periodEvents.push(`Disruption: ${nodes.find((n) => n.id === d.nodeId)?.name} shut down`);
        } else if (d.type === "delay") {
          periodEvents.push(`Disruption: ${nodes.find((n) => n.id === d.nodeId)?.name} delayed (${d.severity}x lead time)`);
        } else if (d.type === "capacity_reduction") {
          nodeInventory[d.nodeId] *= (1 - d.severity / 100);
          periodEvents.push(`Disruption: ${nodes.find((n) => n.id === d.nodeId)?.name} capacity reduced ${d.severity}%`);
        }
      }

      // Suppliers produce
      for (const sup of suppliers) {
        const production = (sup.capacity ?? 200) * (0.8 + Math.random() * 0.4);
        nodeInventory[sup.id] = (nodeInventory[sup.id] ?? 0) + production;
      }

      // Flow through network: suppliers → factories → warehouses
      for (const link of links) {
        const available = nodeInventory[link.fromNodeId] ?? 0;
        const capacity = link.capacity ?? 500;
        const flow = Math.min(available * 0.6, capacity);
        if (flow > 0) {
          nodeInventory[link.fromNodeId] -= flow;
          nodeInventory[link.toNodeId] = (nodeInventory[link.toNodeId] ?? 0) + flow;
          periodCost += flow * (link.costPerUnit ?? 1);
        }
      }

      // Customer demand
      let periodStockouts = 0;
      let periodDelivered = 0;
      for (const cust of customers) {
        const demand = Math.max(0, demandMean + (Math.random() - 0.5) * 2 * demandStdDev);
        const available = nodeInventory[cust.id] ?? 0;
        const fulfilled = Math.min(demand, available);
        nodeInventory[cust.id] = Math.max(0, available - demand);
        periodDelivered += fulfilled;
        if (fulfilled < demand) periodStockouts++;
      }

      // Holding costs
      for (const n of nodes) {
        periodCost += (nodeInventory[n.id] ?? 0) * (n.holdingCost ?? 0.5);
      }

      totalCost += periodCost;
      totalStockouts += periodStockouts;
      totalDelivered += periodDelivered;

      timeline.push({
        period,
        cost: Math.round(periodCost),
        stockouts: periodStockouts,
        delivered: Math.round(periodDelivered),
        events: periodEvents,
        inventory: { ...nodeInventory },
      });
    }

    const serviceLevel = customers.length > 0
      ? Math.round(((periods * customers.length - totalStockouts) / (periods * customers.length)) * 10000) / 100
      : 100;

    res.json({
      summary: {
        totalCost: Math.round(totalCost),
        totalDelivered: Math.round(totalDelivered),
        totalStockouts,
        serviceLevel,
        avgCostPerPeriod: Math.round(totalCost / periods),
      },
      timeline,
      network: { nodes: nodes.length, links: links.length, suppliers: suppliers.length, factories: factories.length, warehouses: warehouses.length, customers: customers.length },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
