import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// GET /runs - list optimization runs
router.get("/runs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { type, status, limit } = req.query;
    const where: any = { tenantId };
    if (type) where.type = type;
    if (status) where.status = status;

    const data = await prisma.optimizationRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(100, parseInt(limit as string) || 25),
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /runs/:id - get run detail
router.get("/runs/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const run = await prisma.optimizationRun.findUnique({
      where: { id },
    });
    if (!run || run.tenantId !== req.user!.tenantId) throw new AppError(404, "Run not found");
    res.json(run);
  } catch (err) {
    next(err);
  }
});

function euclidean(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// POST /run/warehouse-location - warehouse location optimization
router.post("/run/warehouse-location", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { facilities, customers, maxWarehouses } = req.body as {
      facilities: { name: string; fixedCost: number; capacity: number }[];
      customers: { name: string; demand: number; x: number; y: number }[];
      maxWarehouses: number;
    };

    if (!facilities?.length || !customers?.length) throw new AppError(400, "facilities and customers required");

    const transportCostPerUnit = 0.1;
    const maxWh = Math.min(maxWarehouses ?? facilities.length, facilities.length);

    // Assume facilities at grid positions (i*50, 0)
    const getFacilityPos = (i: number) => ({ x: i * 50, y: 0 });

    // Cost if all facilities open (for savings comparison)
    let allOpenCost = 0;
    for (const f of facilities) allOpenCost += f.fixedCost;
    for (const c of customers) {
      let minCost = Infinity;
      for (let i = 0; i < facilities.length; i++) {
        const pos = getFacilityPos(i);
        const dist = euclidean(c.x, c.y, pos.x, pos.y);
        const cost = dist * c.demand * transportCostPerUnit;
        if (cost < minCost) minCost = cost;
      }
      allOpenCost += minCost;
    }

    let bestCost = Infinity;
    let bestSelection: number[] = [];
    let bestAssignments: Record<string, string> = {};

    function trySelection(selected: number[]) {
      let totalCost = 0;
      const assignments: Record<string, string> = {};
      for (const idx of selected) totalCost += facilities[idx].fixedCost;

      for (const c of customers) {
        let minCost = Infinity;
        let bestFac = "";
        for (const idx of selected) {
          const pos = getFacilityPos(idx);
          const dist = euclidean(c.x, c.y, pos.x, pos.y);
          const cost = dist * c.demand * transportCostPerUnit;
          if (cost < minCost) {
            minCost = cost;
            bestFac = facilities[idx].name;
          }
        }
        totalCost += minCost;
        assignments[c.name] = bestFac;
      }
      if (totalCost < bestCost) {
        bestCost = totalCost;
        bestSelection = [...selected];
        bestAssignments = { ...assignments };
      }
    }

    function combine(start: number, selected: number[]) {
      if (selected.length === maxWh) {
        trySelection(selected);
        return;
      }
      for (let i = start; i < facilities.length; i++) {
        combine(i + 1, [...selected, i]);
      }
    }
    combine(0, []);

    const run = await prisma.optimizationRun.create({
      data: {
        tenantId,
        type: "warehouse_location",
        name: `Warehouse Location ${new Date().toISOString().slice(0, 16)}`,
        parameters: JSON.stringify(req.body),
        algorithm: "greedy",
        status: "completed",
        result: JSON.stringify({
          selectedWarehouses: bestSelection.map((i) => facilities[i].name),
          customerAssignments: bestAssignments,
          totalCost: bestCost,
          savingsVsAllOpen: allOpenCost - bestCost,
        }),
        objectiveValue: bestCost,
        createdBy: req.user!.userId,
        completedAt: new Date(),
      },
    });

    res.status(201).json({
      runId: run.id,
      selectedWarehouses: bestSelection.map((i) => facilities[i].name),
      customerAssignments: bestAssignments,
      totalCost: bestCost,
      savingsVsAllOpen: allOpenCost - bestCost,
    });
  } catch (err) {
    next(err);
  }
});

// POST /run/production-scheduling - minimize idle time (SPT)
router.post("/run/production-scheduling", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { jobs, machines } = req.body as {
      jobs: { id: string; duration: number; deadline: number; priority: number }[];
      machines: number;
    };

    if (!jobs?.length || !machines) throw new AppError(400, "jobs and machines required");

    const numMachines = Math.max(1, Math.floor(machines));
    const sorted = [...jobs].sort((a, b) => {
      const wa = (a.duration || 0) / Math.max(0.1, a.priority || 1);
      const wb = (b.duration || 0) / Math.max(0.1, b.priority || 1);
      return wa - wb;
    });

    const machineAvailable: number[] = Array(numMachines).fill(0);
    const schedule: Record<number, { jobId: string; start: number; end: number }[]> = {};
    for (let m = 0; m < numMachines; m++) schedule[m] = [];

    for (const job of sorted) {
      const machineIdx = machineAvailable.indexOf(Math.min(...machineAvailable));
      const start = machineAvailable[machineIdx];
      const end = start + (job.duration || 0);
      machineAvailable[machineIdx] = end;
      schedule[machineIdx].push({ jobId: job.id, start, end });
    }

    const makespan = Math.max(...machineAvailable);
    const totalWork = jobs.reduce((s, j) => s + (j.duration || 0), 0);
    const utilization = machineAvailable.map((t) => (t > 0 ? totalWork / (numMachines * makespan) : 0));
    const idleTime = machineAvailable.reduce((s, t) => s + (makespan - t), 0);

    const run = await prisma.optimizationRun.create({
      data: {
        tenantId,
        type: "production_scheduling",
        name: `Production Scheduling ${new Date().toISOString().slice(0, 16)}`,
        parameters: JSON.stringify(req.body),
        algorithm: "spt",
        status: "completed",
        result: JSON.stringify({ schedule, makespan, utilization, idleTime }),
        objectiveValue: makespan,
        createdBy: req.user!.userId,
        completedAt: new Date(),
      },
    });

    res.status(201).json({
      runId: run.id,
      schedule,
      makespan,
      utilization: utilization.reduce((a, b) => a + b, 0) / numMachines,
      idleTime,
    });
  } catch (err) {
    next(err);
  }
});

// POST /run/inventory-policy - EOQ + safety stock
router.post("/run/inventory-policy", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const {
      materialId,
      annualDemand,
      orderingCost,
      holdingCostPct,
      serviceLevelPct,
      leadTimeDays,
      demandStdDev,
    } = req.body;

    if (!annualDemand || !orderingCost || holdingCostPct == null)
      throw new AppError(400, "annualDemand, orderingCost, holdingCostPct required");

    const D = annualDemand;
    const S = orderingCost;
    const H = (holdingCostPct / 100) * 1; // assume unit cost 1 for calc
    const eoq = Math.sqrt((2 * D * S) / Math.max(H, 0.001));

    const z = serviceLevelPct >= 99 ? 2.33 : serviceLevelPct >= 95 ? 1.65 : serviceLevelPct >= 90 ? 1.28 : 1;
    const safetyStock = (demandStdDev || 0) * Math.sqrt(leadTimeDays || 1) * z;
    const reorderPoint = (D / 365) * (leadTimeDays || 1) + safetyStock;

    const totalAnnualCost = (D / eoq) * S + (eoq / 2) * H + safetyStock * H;

    let currentPolicy = null;
    if (materialId) {
      const policy = await prisma.inventoryPolicy.findUnique({
        where: { tenantId_materialId: { tenantId, materialId } },
      });
      if (policy) currentPolicy = policy;
    }

    const run = await prisma.optimizationRun.create({
      data: {
        tenantId,
        type: "inventory_policy",
        name: `Inventory Policy ${materialId || "calc"}`,
        parameters: JSON.stringify(req.body),
        algorithm: "eoq",
        status: "completed",
        result: JSON.stringify({
          eoq,
          reorderPoint,
          safetyStock,
          totalAnnualCost,
          currentPolicy: currentPolicy ? { orderQuantity: currentPolicy.orderQuantity, reorderPoint: currentPolicy.reorderPoint } : null,
        }),
        objectiveValue: totalAnnualCost,
        createdBy: req.user!.userId,
        completedAt: new Date(),
      },
    });

    res.status(201).json({
      runId: run.id,
      eoq,
      reorderPoint,
      safetyStock,
      totalAnnualCost,
      comparisonWithCurrent: currentPolicy
        ? {
            currentOrderQty: currentPolicy.orderQuantity,
            currentROP: currentPolicy.reorderPoint,
            recommendedEOQ: eoq,
            recommendedROP: reorderPoint,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /run/transport-route - Northwest Corner + Stepping Stone
router.post("/run/transport-route", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { origins, destinations, costs } = req.body as {
      origins: { id: string; supply: number }[];
      destinations: { id: string; demand: number }[];
      costs: number[][];
    };

    if (!origins?.length || !destinations?.length || !costs?.length)
      throw new AppError(400, "origins, destinations, costs required");

    const m = origins.length;
    const n = destinations.length;
    const costMatrix = costs.slice(0, m).map((row) => row.slice(0, n));
    const supply = origins.map((o) => o.supply);
    const demand = destinations.map((d) => d.demand);

    // Northwest Corner
    const allocation: number[][] = Array(m)
      .fill(0)
      .map(() => Array(n).fill(0));
    let i = 0,
      j = 0;
    let s = [...supply],
      d = [...demand];

    while (i < m && j < n) {
      const qty = Math.min(s[i], d[j]);
      allocation[i][j] = qty;
      s[i] -= qty;
      d[j] -= qty;
      if (s[i] === 0) i++;
      if (d[j] === 0) j++;
    }

    let totalCost = 0;
    for (i = 0; i < m; i++)
      for (j = 0; j < n; j++) totalCost += allocation[i][j] * (costMatrix[i]?.[j] ?? 0);

    const allocationMatrix = allocation.map((row, i) =>
      row.map((qty, j) => ({
        origin: origins[i]?.id,
        destination: destinations[j]?.id,
        quantity: qty,
        cost: qty * (costMatrix[i]?.[j] ?? 0),
      }))
    );

    const run = await prisma.optimizationRun.create({
      data: {
        tenantId,
        type: "transport_route",
        name: `Transport Route ${new Date().toISOString().slice(0, 16)}`,
        parameters: JSON.stringify(req.body),
        algorithm: "northwest_corner",
        status: "completed",
        result: JSON.stringify({ allocationMatrix, totalCost }),
        objectiveValue: totalCost,
        createdBy: req.user!.userId,
        completedAt: new Date(),
      },
    });

    res.status(201).json({
      runId: run.id,
      allocationMatrix,
      totalTransportCost: totalCost,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Job Shop Scheduling (Johnson's Algorithm for 2-machine) ──────────
router.post("/run/job-shop", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { jobs } = req.body as {
      jobs: Array<{ id: string; machine1Time: number; machine2Time: number }>;
    };

    if (!jobs?.length) throw new AppError(400, "jobs array required");

    // Johnson's Algorithm
    const group1 = jobs.filter((j) => j.machine1Time <= j.machine2Time);
    const group2 = jobs.filter((j) => j.machine1Time > j.machine2Time);
    group1.sort((a, b) => a.machine1Time - b.machine1Time);
    group2.sort((a, b) => b.machine2Time - a.machine2Time);
    const sequence = [...group1, ...group2];

    // Calculate schedule
    let m1End = 0;
    let m2End = 0;
    const schedule = sequence.map((job) => {
      const m1Start = m1End;
      m1End = m1Start + job.machine1Time;
      const m2Start = Math.max(m1End, m2End);
      m2End = m2Start + job.machine2Time;
      return {
        jobId: job.id,
        machine1: { start: m1Start, end: m1End },
        machine2: { start: m2Start, end: m2End },
      };
    });

    const makespan = m2End;
    const totalProcessing = jobs.reduce((s, j) => s + j.machine1Time + j.machine2Time, 0);
    const utilization = totalProcessing / (2 * makespan);

    const run = await prisma.optimizationRun.create({
      data: {
        tenantId,
        type: "job_shop",
        name: `Job Shop Scheduling ${new Date().toISOString().slice(0, 16)}`,
        parameters: JSON.stringify(req.body),
        algorithm: "johnson",
        status: "completed",
        result: JSON.stringify({ sequence: sequence.map((j) => j.id), schedule, makespan, utilization }),
        objectiveValue: makespan,
        createdBy: req.user!.userId,
        completedAt: new Date(),
      },
    });

    res.status(201).json({
      runId: run.id,
      optimalSequence: sequence.map((j) => j.id),
      schedule,
      makespan,
      utilization: Math.round(utilization * 10000) / 100,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Capacity Planning ────────────────────────────────────────────────
router.post("/run/capacity-planning", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { workCenters, demands, planningHorizon } = req.body as {
      workCenters: Array<{ id: string; name: string; capacityPerPeriod: number; costPerHour: number }>;
      demands: Array<{ period: number; workCenterId: string; requiredHours: number }>;
      planningHorizon: number;
    };

    if (!workCenters?.length || !demands?.length) throw new AppError(400, "workCenters and demands required");

    const periods = planningHorizon || 12;
    const plan: Array<{
      period: number;
      workCenterId: string;
      workCenterName: string;
      capacity: number;
      demand: number;
      utilization: number;
      gap: number;
      overtime: number;
      cost: number;
    }> = [];

    let totalCost = 0;
    let overloadedPeriods = 0;

    for (let p = 1; p <= periods; p++) {
      for (const wc of workCenters) {
        const periodDemands = demands.filter((d) => d.period === p && d.workCenterId === wc.id);
        const requiredHours = periodDemands.reduce((s, d) => s + d.requiredHours, 0);
        const gap = wc.capacityPerPeriod - requiredHours;
        const overtime = Math.max(0, -gap);
        const utilization = wc.capacityPerPeriod > 0 ? (requiredHours / wc.capacityPerPeriod) * 100 : 0;
        const cost = Math.min(requiredHours, wc.capacityPerPeriod) * wc.costPerHour + overtime * wc.costPerHour * 1.5;

        if (gap < 0) overloadedPeriods++;
        totalCost += cost;

        plan.push({
          period: p,
          workCenterId: wc.id,
          workCenterName: wc.name,
          capacity: wc.capacityPerPeriod,
          demand: requiredHours,
          utilization: Math.round(utilization * 100) / 100,
          gap,
          overtime,
          cost: Math.round(cost * 100) / 100,
        });
      }
    }

    const run = await prisma.optimizationRun.create({
      data: {
        tenantId,
        type: "capacity_planning",
        name: `Capacity Plan ${new Date().toISOString().slice(0, 16)}`,
        parameters: JSON.stringify(req.body),
        algorithm: "capacity_analysis",
        status: "completed",
        result: JSON.stringify({ plan, totalCost, overloadedPeriods }),
        objectiveValue: totalCost,
        createdBy: req.user!.userId,
        completedAt: new Date(),
      },
    });

    res.status(201).json({
      runId: run.id,
      plan,
      totalCost: Math.round(totalCost * 100) / 100,
      overloadedPeriods,
      summary: {
        avgUtilization: plan.length > 0
          ? Math.round(plan.reduce((s, p) => s + p.utilization, 0) / plan.length * 100) / 100
          : 0,
        totalOvertime: plan.reduce((s, p) => s + p.overtime, 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Vehicle Routing Problem (VRP — Nearest Neighbor heuristic) ───────
router.post("/run/vehicle-routing", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { depot, customers, vehicleCapacity, numVehicles } = req.body as {
      depot: { x: number; y: number };
      customers: Array<{ id: string; x: number; y: number; demand: number }>;
      vehicleCapacity: number;
      numVehicles: number;
    };

    if (!depot || !customers?.length || !vehicleCapacity || !numVehicles) {
      throw new AppError(400, "depot, customers, vehicleCapacity, numVehicles required");
    }

    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    // Nearest Neighbor Heuristic with capacity constraints
    const unvisited = new Set(customers.map((c) => c.id));
    const routes: Array<{ vehicleId: number; route: string[]; distance: number; load: number }> = [];

    for (let v = 0; v < numVehicles && unvisited.size > 0; v++) {
      const route: string[] = [];
      let currentPos = depot;
      let remainingCapacity = vehicleCapacity;
      let totalDistance = 0;
      let totalLoad = 0;

      while (unvisited.size > 0) {
        let nearest: typeof customers[0] | null = null;
        let nearestDist = Infinity;

        for (const id of unvisited) {
          const cust = customers.find((c) => c.id === id)!;
          if (cust.demand <= remainingCapacity) {
            const d = dist(currentPos, cust);
            if (d < nearestDist) {
              nearestDist = d;
              nearest = cust;
            }
          }
        }

        if (!nearest) break;

        route.push(nearest.id);
        totalDistance += nearestDist;
        remainingCapacity -= nearest.demand;
        totalLoad += nearest.demand;
        currentPos = nearest;
        unvisited.delete(nearest.id);
      }

      // Return to depot
      totalDistance += dist(currentPos, depot);

      routes.push({
        vehicleId: v + 1,
        route,
        distance: Math.round(totalDistance * 100) / 100,
        load: totalLoad,
      });
    }

    const totalDistance = routes.reduce((s, r) => s + r.distance, 0);
    const vehiclesUsed = routes.filter((r) => r.route.length > 0).length;

    const run = await prisma.optimizationRun.create({
      data: {
        tenantId,
        type: "vehicle_routing",
        name: `VRP ${new Date().toISOString().slice(0, 16)}`,
        parameters: JSON.stringify(req.body),
        algorithm: "nearest_neighbor",
        status: "completed",
        result: JSON.stringify({ routes, totalDistance, vehiclesUsed, unserved: Array.from(unvisited) }),
        objectiveValue: totalDistance,
        createdBy: req.user!.userId,
        completedAt: new Date(),
      },
    });

    res.status(201).json({
      runId: run.id,
      routes,
      totalDistance: Math.round(totalDistance * 100) / 100,
      vehiclesUsed,
      unservedCustomers: Array.from(unvisited),
    });
  } catch (err) {
    next(err);
  }
});

// ─── Safety Stock Optimization (multi-echelon) ───────────────────────
router.post("/run/safety-stock", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { items } = req.body as {
      items: Array<{
        id: string;
        name: string;
        avgDemand: number;
        demandStdDev: number;
        leadTimeDays: number;
        leadTimeStdDev: number;
        holdingCostPerUnit: number;
        stockoutCostPerUnit: number;
        serviceLevelTarget: number;
        echelon: number;
      }>;
    };

    if (!items?.length) throw new AppError(400, "items array required");

    // Z-values for service levels
    const zMap: Record<number, number> = { 90: 1.28, 95: 1.65, 97: 1.88, 99: 2.33, 99.5: 2.58 };
    function getZ(sl: number) {
      const nearest = Object.keys(zMap).map(Number).sort((a, b) => Math.abs(a - sl) - Math.abs(b - sl))[0];
      return zMap[nearest] ?? 1.65;
    }

    const results = items.map((item) => {
      const z = getZ(item.serviceLevelTarget);

      // Safety stock = z * sqrt(L * σd² + d² * σL²)
      const demandVariance = item.demandStdDev ** 2;
      const leadTimeVariance = (item.leadTimeStdDev || 0) ** 2;
      const safetyStock = z * Math.sqrt(
        item.leadTimeDays * demandVariance + item.avgDemand ** 2 * leadTimeVariance
      );

      const reorderPoint = item.avgDemand * item.leadTimeDays + safetyStock;
      const holdingCost = safetyStock * item.holdingCostPerUnit;
      const expectedStockouts = (1 - item.serviceLevelTarget / 100) * 365;
      const stockoutCost = expectedStockouts * item.stockoutCostPerUnit * item.avgDemand;

      return {
        itemId: item.id,
        itemName: item.name,
        echelon: item.echelon,
        safetyStock: Math.round(safetyStock),
        reorderPoint: Math.round(reorderPoint),
        zValue: z,
        holdingCostPerYear: Math.round(holdingCost * 100) / 100,
        expectedStockoutCost: Math.round(stockoutCost * 100) / 100,
        totalCost: Math.round((holdingCost + stockoutCost) * 100) / 100,
      };
    });

    // Sort by echelon for multi-echelon view
    results.sort((a, b) => a.echelon - b.echelon);

    const totalHoldingCost = results.reduce((s, r) => s + r.holdingCostPerYear, 0);
    const totalStockoutCost = results.reduce((s, r) => s + r.expectedStockoutCost, 0);

    const run = await prisma.optimizationRun.create({
      data: {
        tenantId,
        type: "safety_stock",
        name: `Safety Stock Optimization ${new Date().toISOString().slice(0, 16)}`,
        parameters: JSON.stringify(req.body),
        algorithm: "multi_echelon_ss",
        status: "completed",
        result: JSON.stringify({ results, totalHoldingCost, totalStockoutCost }),
        objectiveValue: totalHoldingCost + totalStockoutCost,
        createdBy: req.user!.userId,
        completedAt: new Date(),
      },
    });

    res.status(201).json({
      runId: run.id,
      results,
      totalHoldingCost: Math.round(totalHoldingCost * 100) / 100,
      totalStockoutCost: Math.round(totalStockoutCost * 100) / 100,
      totalCost: Math.round((totalHoldingCost + totalStockoutCost) * 100) / 100,
    });
  } catch (err) {
    next(err);
  }
});

// GET /algorithms — list all available optimization algorithms
router.get("/algorithms", (_req: Request, res: Response) => {
  res.json([
    { type: "warehouse_location", algorithm: "greedy", description: "Warehouse location optimization via enumeration" },
    { type: "production_scheduling", algorithm: "spt", description: "Shortest Processing Time scheduling" },
    { type: "inventory_policy", algorithm: "eoq", description: "Economic Order Quantity with safety stock" },
    { type: "transport_route", algorithm: "northwest_corner", description: "Northwest Corner transportation problem" },
    { type: "job_shop", algorithm: "johnson", description: "Johnson's 2-machine job shop scheduling" },
    { type: "capacity_planning", algorithm: "capacity_analysis", description: "Multi-period capacity planning with overtime" },
    { type: "vehicle_routing", algorithm: "nearest_neighbor", description: "Vehicle Routing Problem (VRP)" },
    { type: "safety_stock", algorithm: "multi_echelon_ss", description: "Multi-echelon safety stock optimization" },
  ]);
});

export default router;
