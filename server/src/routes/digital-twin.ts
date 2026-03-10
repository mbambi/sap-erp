import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

function buildStateFromData(data: {
  warehouses: unknown[];
  factories: unknown[];
  suppliers: unknown[];
  customers: unknown[];
  transport: unknown[];
  kpis: Record<string, number>;
  alerts: Array<{ type: string; severity: string; message: string; entity?: string }>;
}) {
  return {
    factories: data.factories,
    warehouses: data.warehouses,
    suppliers: data.suppliers,
    customers: data.customers,
    transport: data.transport,
    kpis: data.kpis,
    alerts: data.alerts,
  };
}

async function generateStateFromRealData(tenantId: string) {
  const [materials, workCenters, vendors, customers, shipments, purchaseOrders, salesOrders, productionOrders, warehousesData] =
    await Promise.all([
      prisma.material.findMany({ where: { tenantId, isActive: true } }),
      prisma.workCenter.findMany({ where: { tenantId, isActive: true } }),
      prisma.vendor.findMany({ where: { tenantId, isActive: true } }),
      prisma.customer.findMany({ where: { tenantId, isActive: true } }),
      prisma.shipment.findMany({ where: { tenantId }, take: 20, orderBy: { createdAt: "desc" } }),
      prisma.purchaseOrder.findMany({ where: { tenantId, status: { notIn: ["closed", "cancelled"] } } }),
      prisma.salesOrder.findMany({ where: { tenantId, status: { notIn: ["completed", "cancelled"] } } }),
      prisma.productionOrder.findMany({ where: { tenantId, status: { in: ["released", "in_progress"] } } }),
      prisma.warehouse.findMany({ where: { tenantId }, include: { bins: true } }),
    ]);
  const warehouses = warehousesData.map((w) => {
    const totalStock = w.bins.reduce((s, b) => s + b.quantity, 0);
    const capacity = w.bins.reduce((s, b) => s + b.maxCapacity, 0);
    return {
      id: w.id,
      name: w.name,
      stockLevel: totalStock,
      capacity,
      inbound: 0,
      outbound: 0,
    };
  });

  const schedules = await prisma.productionSchedule.findMany({
    where: { tenantId, status: { in: ["scheduled", "in_progress"] } },
  });
  const schedulesByWc = schedules.reduce((acc, s) => {
    acc[s.workCenterId] = (acc[s.workCenterId] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const factories = workCenters.map((wc) => ({
    id: wc.id,
    name: wc.name,
    status: wc.status,
    utilization: wc.status === "busy" ? 85 : wc.status === "maintenance" ? 0 : 40,
    activeOrders: schedulesByWc[wc.id] ?? 0,
  }));

  const suppliers = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    status: "active",
    inTransit: purchaseOrders.filter((po) => po.vendorId === v.id && po.status !== "closed").length,
    reliability: 95,
  }));

  const customersData = customers.map((c) => ({
    id: c.id,
    name: c.name,
    pendingOrders: salesOrders.filter((so) => so.customerId === c.id).length,
    satisfaction: 92,
  }));

  const transport = shipments.map((s) => ({
    id: s.id,
    from: s.originAddress ?? "Unknown",
    to: s.destAddress ?? "Unknown",
    status: s.status,
    cargo: s.referenceDoc ?? "-",
    eta: s.actualDate ?? s.plannedDate,
  }));

  const totalInventoryValue = materials.reduce((s, m) => s + m.stockQuantity * m.movingAvgPrice, 0);
  const openSOCount = salesOrders.length;
  const openPOCount = purchaseOrders.length;
  const totalCapacity = workCenters.reduce((s, w) => s + w.capacity * (w.efficiency / 100), 0);
  const usedCapacity = productionOrders.length * 4;
  const productionUtilization = totalCapacity > 0 ? Math.min(100, (usedCapacity / totalCapacity) * 100) : 0;

  const kpis = {
    totalInventoryValue,
    openSOCount,
    openPOCount,
    productionUtilization,
    serviceLevel: 95,
    onTimeDelivery: 88,
  };

  const alerts: Array<{ type: string; severity: string; message: string; entity?: string }> = [];
  for (const m of materials) {
    if (m.stockQuantity <= m.safetyStock && m.safetyStock > 0) {
      alerts.push({ type: "low_stock", severity: "warning", message: `Low stock: ${m.description}`, entity: m.id });
    }
  }
  for (const po of purchaseOrders) {
    if (po.deliveryDate && po.deliveryDate < new Date()) {
      alerts.push({ type: "overdue_po", severity: "high", message: `Overdue PO: ${po.poNumber}`, entity: po.id });
    }
  }
  const equipmentWithMaintenance = await prisma.equipment.findMany({
    where: { tenantId, status: "under_maintenance" },
  });
  for (const e of equipmentWithMaintenance) {
    alerts.push({ type: "maintenance_due", severity: "medium", message: `Maintenance: ${e.description}`, entity: e.id });
  }

  return buildStateFromData({
    warehouses,
    factories,
    suppliers: suppliers,
    customers: customersData,
    transport,
    kpis,
    alerts,
  });
}

// GET /state - get latest state, or generate from real data if none exists
router.get("/state", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    let state = await prisma.digitalTwinState.findFirst({
      where: { tenantId },
      orderBy: { timestamp: "desc" },
    });
    if (!state) {
      const generated = await generateStateFromRealData(tenantId);
      state = await prisma.digitalTwinState.create({
        data: {
          tenantId,
          factories: JSON.stringify(generated.factories),
          warehouses: JSON.stringify(generated.warehouses),
          suppliers: JSON.stringify(generated.suppliers),
          customers: JSON.stringify(generated.customers),
          transport: JSON.stringify(generated.transport),
          kpis: JSON.stringify(generated.kpis),
          alerts: JSON.stringify(generated.alerts),
        },
      });
    }
    const result = {
      id: state.id,
      timestamp: state.timestamp,
      factories: JSON.parse(state.factories),
      warehouses: JSON.parse(state.warehouses),
      suppliers: JSON.parse(state.suppliers),
      customers: JSON.parse(state.customers),
      transport: JSON.parse(state.transport),
      kpis: JSON.parse(state.kpis),
      alerts: state.alerts ? JSON.parse(state.alerts) : [],
    };
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /simulate-tick - advance simulation (admin/instructor)
router.post("/simulate-tick", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const lastState = await prisma.digitalTwinState.findFirst({
      where: { tenantId },
      orderBy: { timestamp: "desc" },
    });
    const baseData = lastState
      ? {
          warehouses: JSON.parse(lastState.warehouses),
          factories: JSON.parse(lastState.factories),
          suppliers: JSON.parse(lastState.suppliers),
          customers: JSON.parse(lastState.customers),
          transport: JSON.parse(lastState.transport),
          kpis: JSON.parse(lastState.kpis),
          alerts: lastState.alerts ? JSON.parse(lastState.alerts) : [],
        }
      : await generateStateFromRealData(tenantId);

    const events: string[] = [];
    let kpis = { ...baseData.kpis } as Record<string, number>;

    if (Math.random() < 0.2) {
      const change = (Math.random() - 0.5) * 0.4;
      kpis.openSOCount = Math.max(0, Math.round(kpis.openSOCount * (1 + change)));
      events.push(`Demand change: ${change > 0 ? "+" : ""}${(change * 100).toFixed(0)}%`);
    }
    if (Math.random() < 0.1) {
      events.push("Supplier delay: 2-day delay on next shipment");
    }
    if (Math.random() < 0.05) {
      events.push("Machine issue: Work center WC-01 temporarily offline");
    }

    const newState = await prisma.digitalTwinState.create({
      data: {
        tenantId,
        factories: JSON.stringify(baseData.factories),
        warehouses: JSON.stringify(baseData.warehouses),
        suppliers: JSON.stringify(baseData.suppliers),
        customers: JSON.stringify(baseData.customers),
        transport: JSON.stringify(baseData.transport),
        kpis: JSON.stringify(kpis),
        alerts: JSON.stringify(baseData.alerts),
      },
    });

    res.json({
      state: {
        id: newState.id,
        timestamp: newState.timestamp,
        factories: baseData.factories,
        warehouses: baseData.warehouses,
        suppliers: baseData.suppliers,
        customers: baseData.customers,
        transport: baseData.transport,
        kpis,
        alerts: baseData.alerts,
      },
      events,
    });
  } catch (err) {
    next(err);
  }
});

// GET /history - last 50 states for timeline
router.get("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const states = await prisma.digitalTwinState.findMany({
      where: { tenantId },
      orderBy: { timestamp: "desc" },
      take: 50,
    });
    res.json(
      states.map((s) => ({
        id: s.id,
        timestamp: s.timestamp,
        kpis: JSON.parse(s.kpis),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// POST /reset - clear all states and regenerate (admin/instructor)
router.post("/reset", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    await prisma.digitalTwinState.deleteMany({ where: { tenantId } });
    const generated = await generateStateFromRealData(tenantId);
    const state = await prisma.digitalTwinState.create({
      data: {
        tenantId,
        factories: JSON.stringify(generated.factories),
        warehouses: JSON.stringify(generated.warehouses),
        suppliers: JSON.stringify(generated.suppliers),
        customers: JSON.stringify(generated.customers),
        transport: JSON.stringify(generated.transport),
        kpis: JSON.stringify(generated.kpis),
        alerts: JSON.stringify(generated.alerts),
      },
    });
    res.json({
      id: state.id,
      timestamp: state.timestamp,
      ...generated,
    });
  } catch (err) {
    next(err);
  }
});

// GET /kpi-trend - KPI values over last 30 snapshots
router.get("/kpi-trend", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const states = await prisma.digitalTwinState.findMany({
      where: { tenantId },
      orderBy: { timestamp: "asc" },
      take: 30,
    });
    const trend = states.map((s) => ({
      timestamp: s.timestamp,
      kpis: JSON.parse(s.kpis),
    }));
    res.json(trend);
  } catch (err) {
    next(err);
  }
});

// ─── Supply Chain Network Graph (for Cytoscape.js) ────────────────────
router.get("/network-graph", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const [vendors, plants, warehouses, customers, materials, purchaseOrders, salesOrders, shipments] =
      await Promise.all([
        prisma.vendor.findMany({ where: { tenantId, isActive: true } }),
        prisma.plant.findMany({ where: { tenantId, isActive: true } }),
        prisma.warehouse.findMany({ where: { tenantId }, include: { bins: true } }),
        prisma.customer.findMany({ where: { tenantId, isActive: true } }),
        prisma.material.findMany({ where: { tenantId, isActive: true } }),
        prisma.purchaseOrder.findMany({ where: { tenantId, status: { notIn: ["closed", "cancelled"] } } }),
        prisma.salesOrder.findMany({ where: { tenantId, status: { notIn: ["completed", "cancelled"] } } }),
        prisma.shipment.findMany({ where: { tenantId }, take: 50, orderBy: { createdAt: "desc" } }),
      ]);

    // Build Cytoscape-compatible nodes and edges
    const nodes: Array<{ data: Record<string, unknown>; classes?: string }> = [];
    const edges: Array<{ data: Record<string, unknown>; classes?: string }> = [];

    // Supplier nodes
    for (const v of vendors) {
      const activePOs = purchaseOrders.filter((po) => po.vendorId === v.id).length;
      nodes.push({
        data: {
          id: `supplier_${v.id}`,
          label: v.name,
          type: "supplier",
          activePOs,
          status: "active",
        },
        classes: "supplier",
      });
    }

    // Plant nodes
    for (const p of plants) {
      nodes.push({
        data: {
          id: `plant_${p.id}`,
          label: p.name,
          type: "plant",
          location: p.address ?? "",
        },
        classes: "plant",
      });
    }

    // Warehouse nodes
    for (const w of warehouses) {
      const totalStock = w.bins.reduce((s, b) => s + b.quantity, 0);
      const capacity = w.bins.reduce((s, b) => s + b.maxCapacity, 0);
      nodes.push({
        data: {
          id: `warehouse_${w.id}`,
          label: w.name,
          type: "warehouse",
          stockLevel: totalStock,
          capacity,
          utilization: capacity > 0 ? Math.round((totalStock / capacity) * 100) : 0,
        },
        classes: "warehouse",
      });
    }

    // Customer nodes
    for (const c of customers) {
      const pendingOrders = salesOrders.filter((so) => so.customerId === c.id).length;
      nodes.push({
        data: {
          id: `customer_${c.id}`,
          label: c.name,
          type: "customer",
          pendingOrders,
        },
        classes: "customer",
      });
    }

    // Edges: Supplier → Plant (from POs)
    for (const po of purchaseOrders) {
      if (po.vendorId) {
        const plantId = plants[0]?.id; // Default to first plant
        if (plantId) {
          edges.push({
            data: {
              id: `edge_po_${po.id}`,
              source: `supplier_${po.vendorId}`,
              target: `plant_${plantId}`,
              label: `PO: ${po.poNumber}`,
              type: "procurement",
              value: po.totalAmount,
            },
            classes: "procurement",
          });
        }
      }
    }

    // Edges: Plant → Warehouse
    for (const p of plants) {
      for (const w of warehouses) {
        if (w.plantId === p.id || warehouses.length <= 2) {
          edges.push({
            data: {
              id: `edge_pw_${p.id}_${w.id}`,
              source: `plant_${p.id}`,
              target: `warehouse_${w.id}`,
              label: "Production Flow",
              type: "production",
            },
            classes: "production",
          });
        }
      }
    }

    // Edges: Warehouse → Customer (from SOs)
    for (const so of salesOrders) {
      const warehouseId = warehouses[0]?.id;
      if (so.customerId && warehouseId) {
        edges.push({
          data: {
            id: `edge_so_${so.id}`,
            source: `warehouse_${warehouseId}`,
            target: `customer_${so.customerId}`,
            label: `SO: ${so.soNumber}`,
            type: "distribution",
            value: so.totalAmount,
          },
          classes: "distribution",
        });
      }
    }

    // Transport edges
    for (const s of shipments) {
      edges.push({
        data: {
          id: `edge_ship_${s.id}`,
          source: s.originAddress ?? "unknown",
          target: s.destAddress ?? "unknown",
          label: `Ship: ${s.shipmentNumber}`,
          type: "transport",
          status: s.status,
        },
        classes: "transport",
      });
    }

    // Summary KPIs
    const totalInventoryValue = materials.reduce((s, m) => s + m.stockQuantity * m.movingAvgPrice, 0);
    const networkSummary = {
      totalSuppliers: vendors.length,
      totalPlants: plants.length,
      totalWarehouses: warehouses.length,
      totalCustomers: customers.length,
      activePurchaseOrders: purchaseOrders.length,
      activeSalesOrders: salesOrders.length,
      totalInventoryValue,
      activeShipments: shipments.filter((s) => s.status === "in_transit").length,
    };

    res.json({ nodes, edges, summary: networkSummary });
  } catch (err) {
    next(err);
  }
});

// GET /demand-signals — real-time demand data for digital twin
router.get("/demand-signals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const forecasts = await prisma.demandForecast.findMany({
      where: { tenantId },
      orderBy: { periodStart: "asc" },
      take: 50,
    });

    const salesTrend = await prisma.salesOrder.findMany({
      where: { tenantId },
      orderBy: { orderDate: "desc" },
      take: 30,
      select: { orderDate: true, totalAmount: true, status: true },
    });

    res.json({ forecasts, salesTrend });
  } catch (err) {
    next(err);
  }
});

export default router;
