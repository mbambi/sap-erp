import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const FIRST_NAMES = ["Alice", "Bob", "Carol", "David", "Eve", "Frank", "Grace", "Henry", "Ivy", "Jack"];
const LAST_NAMES = ["Smith", "Jones", "Brown", "Davis", "Wilson", "Taylor", "Anderson", "Thomas", "Jackson", "White"];
const MATERIAL_TYPES = ["raw", "semi-finished", "finished", "trading", "service"];
const PAYMENT_TERMS = ["NET15", "NET30", "NET60", "NET90", "IMMEDIATE"];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// GET /templates - list templates
router.get("/templates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.datasetTemplate.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /templates - create template (admin/instructor)
router.post(
  "/templates",
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, config } = req.body;
      if (!name) throw new AppError(400, "name required");

      const defaultConfig = {
        customers: 50,
        vendors: 20,
        materials: 100,
        purchaseOrders: 200,
        salesOrders: 150,
        journalEntries: 50,
      };
      const template = await prisma.datasetTemplate.create({
        data: {
          tenantId: req.user!.tenantId,
          name,
          description: description ?? null,
          config: JSON.stringify(config || defaultConfig),
          status: "ready",
          createdBy: req.user!.userId,
        },
      });
      res.status(201).json(template);
    } catch (err) {
      next(err);
    }
  }
);

// POST /generate - generate data from template (admin/instructor)
router.post(
  "/generate",
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { templateId } = req.body;
      if (!templateId) throw new AppError(400, "templateId required");

      const template = await prisma.datasetTemplate.findUnique({ where: { id: templateId } });
      if (!template || template.tenantId !== tenantId) throw new AppError(404, "Template not found");

      const config = JSON.parse(template.config) as {
        customers?: number;
        vendors?: number;
        materials?: number;
        purchaseOrders?: number;
        salesOrders?: number;
        journalEntries?: number;
      };

      await prisma.datasetTemplate.update({
        where: { id: templateId },
        data: { status: "generating" },
      });

      const counts = { customers: 0, vendors: 0, materials: 0, purchaseOrders: 0, salesOrders: 0 };

      const numCustomers = config.customers ?? 50;
      const numVendors = config.vendors ?? 20;
      const numMaterials = config.materials ?? 100;
      const numPOs = config.purchaseOrders ?? 200;
      const numSOs = config.salesOrders ?? 150;

      for (let i = 0; i < numCustomers; i++) {
        await prisma.customer.create({
          data: {
            tenantId,
            customerNumber: `CUST-${String(i + 1).padStart(5, "0")}`,
            name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
            creditLimit: randomInt(1000, 50000),
            paymentTerms: pick(PAYMENT_TERMS),
          },
        });
        counts.customers++;
      }

      for (let i = 0; i < numVendors; i++) {
        await prisma.vendor.create({
          data: {
            tenantId,
            vendorNumber: `VEND-${String(i + 1).padStart(5, "0")}`,
            name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} Corp`,
            paymentTerms: pick(PAYMENT_TERMS),
          },
        });
        counts.vendors++;
      }

      const materials: { id: string }[] = [];
      for (let i = 0; i < numMaterials; i++) {
        const m = await prisma.material.create({
          data: {
            tenantId,
            materialNumber: `MAT-${String(i + 1).padStart(5, "0")}`,
            description: `Material ${i + 1}`,
            type: pick(MATERIAL_TYPES),
            standardPrice: randomInt(10, 500),
            movingAvgPrice: randomInt(10, 500),
          },
        });
        materials.push({ id: m.id });
        counts.materials++;
      }

      const vendors = await prisma.vendor.findMany({ where: { tenantId }, select: { id: true } });
      const customers = await prisma.customer.findMany({ where: { tenantId }, select: { id: true } });
      const companyCodes = await prisma.companyCode.findMany({ where: { tenantId }, take: 1 });

      for (let i = 0; i < numPOs; i++) {
        const vendor = pick(vendors);
        if (!vendor) continue;
        const itemCount = randomInt(1, 5);
        const items: { materialId: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];
        for (let j = 0; j < itemCount; j++) {
          const mat = pick(materials);
          const qty = randomInt(1, 100);
          const price = randomInt(5, 200);
          items.push({ materialId: mat.id, quantity: qty, unitPrice: price, totalPrice: qty * price });
        }
        const totalAmount = items.reduce((s, it) => s + it.totalPrice, 0);
        const po = await prisma.purchaseOrder.create({
          data: {
            tenantId,
            poNumber: `PO-${String(i + 1).padStart(7, "0")}`,
            vendorId: vendor.id,
            status: pick(["draft", "approved", "ordered", "received"]),
            totalAmount,
            createdBy: req.user!.userId,
            items: {
              create: items.map((it, idx) => ({
                lineNumber: idx + 1,
                materialId: it.materialId,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                totalPrice: it.totalPrice,
              })),
            },
          },
        });
        counts.purchaseOrders++;
      }

      for (let i = 0; i < numSOs; i++) {
        const customer = pick(customers);
        if (!customer) continue;
        const itemCount = randomInt(1, 5);
        const items: { materialId: string; quantity: number; unitPrice: number; discount: number; totalPrice: number }[] = [];
        for (let j = 0; j < itemCount; j++) {
          const mat = pick(materials);
          const qty = randomInt(1, 50);
          const price = randomInt(10, 300);
          const discount = randomInt(0, 10);
          const totalPrice = qty * price * (1 - discount / 100);
          items.push({ materialId: mat.id, quantity: qty, unitPrice: price, discount, totalPrice });
        }
        const totalAmount = items.reduce((s, it) => s + it.totalPrice, 0);
        await prisma.salesOrder.create({
          data: {
            tenantId,
            soNumber: `SO-${String(i + 1).padStart(7, "0")}`,
            customerId: customer.id,
            status: pick(["draft", "confirmed", "processing", "completed"]),
            totalAmount,
            createdBy: req.user!.userId,
            items: {
              create: items.map((it, idx) => ({
                lineNumber: idx + 1,
                materialId: it.materialId,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                discount: it.discount,
                totalPrice: it.totalPrice,
              })),
            },
          },
        });
        counts.salesOrders++;
      }

      await prisma.datasetTemplate.update({
        where: { id: templateId },
        data: { status: "completed", lastGenerated: new Date() },
      });

      res.json({ counts });
    } catch (err) {
      next(err);
    }
  }
);

// POST /generate-preset - generate using Small/Medium/Large presets
router.post(
  "/generate-preset",
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const { size = "small" } = req.body;

      const PRESETS: Record<string, any> = {
        small: {
          customers: 10, vendors: 5, materials: 15, boms: 3,
          purchaseOrders: 20, salesOrders: 15, employees: 8,
          warehouses: 1, plants: 1, costCenters: 3,
        },
        medium: {
          customers: 50, vendors: 20, materials: 80, boms: 12,
          purchaseOrders: 100, salesOrders: 75, employees: 30,
          warehouses: 3, plants: 2, costCenters: 8,
        },
        large: {
          customers: 200, vendors: 50, materials: 300, boms: 40,
          purchaseOrders: 500, salesOrders: 350, employees: 100,
          warehouses: 6, plants: 4, costCenters: 15,
        },
      };

      const preset = PRESETS[size] || PRESETS.small;
      const counts: Record<string, number> = {};

      const CITIES = ["New York", "Chicago", "Houston", "Phoenix", "LA", "Seattle", "Denver", "Miami"];
      const STATES = ["NY", "IL", "TX", "AZ", "CA", "WA", "CO", "FL"];
      const DEPARTMENTS = ["Engineering", "Production", "Quality", "Logistics", "Finance", "HR", "Sales"];
      const RAW_NAMES = ["Steel Sheet", "Aluminum Rod", "Copper Wire", "Rubber Seal", "Glass Panel", "Plastic Pellets",
        "Carbon Fiber", "Stainless Bolt", "Nylon Bearing", "Ceramic Plate", "Silicon Wafer", "Brass Fitting"];
      const SEMI_NAMES = ["Sub-Assembly A", "Motor Unit", "Circuit Board", "Hydraulic Cylinder", "Gearbox Module",
        "Sensor Package", "Frame Assembly", "Wiring Harness"];
      const FINISHED_NAMES = ["Industrial Pump", "Control Panel", "Conveyor Belt", "Power Generator", "CNC Machine",
        "Robot Arm", "Compressor Unit", "Turbine Blade"];
      const VENDOR_NAMES = ["Global Steel Co", "Pacific Materials", "Euro Parts GmbH", "Atlantic Supply",
        "Precision Components", "BestFit Industrial", "QuickShip Logistics", "TechParts Inc"];

      // Create plants
      const createdPlants: { id: string }[] = [];
      for (let i = 0; i < preset.plants; i++) {
        try {
          const p = await prisma.plant.create({
            data: {
              tenantId,
              code: `P${String(i + 1).padStart(3, "0")}`,
              name: `Plant ${CITIES[i % CITIES.length]}`,
              address: `${randomInt(100, 9999)} Industrial Blvd, ${CITIES[i % CITIES.length]}, ${STATES[i % STATES.length]}`,
            },
          });
          createdPlants.push({ id: p.id });
          counts.plants = (counts.plants || 0) + 1;
        } catch (e) {
          // Log plant creation errors but continue
        }
      }

      const plants = createdPlants.length > 0 ? createdPlants : await prisma.plant.findMany({ where: { tenantId }, select: { id: true } });

      // Create warehouses (only if plants exist to satisfy foreign key)
      for (let i = 0; i < preset.warehouses && plants.length > 0; i++) {
        const plant = pick(plants);
        if (plant?.id) {
          try {
            await prisma.warehouse.create({
              data: {
                tenantId,
                plantId: plant.id,
                code: `WH${String(i + 1).padStart(3, "0")}`,
                name: `Warehouse ${String.fromCharCode(65 + i)}`,
                type: pick(["standard", "cold", "hazmat", "staging"]),
              },
            });
            counts.warehouses = (counts.warehouses || 0) + 1;
          } catch (e) {
            // Log warehouse creation errors but continue
          }
        }
      }

      // Create cost centers
      for (let i = 0; i < preset.costCenters; i++) {
        try {
          await prisma.costCenter.create({
            data: {
              tenantId,
              code: `CC${String(i + 1).padStart(4, "0")}`,
              name: `${DEPARTMENTS[i % DEPARTMENTS.length]} Cost Center`,
              category: pick(["production", "admin", "sales", "research"]),
            },
          });
          counts.costCenters = (counts.costCenters || 0) + 1;
        } catch (e) {
          // Log cost center creation errors but continue
        }
      }

      // Create customers with realistic data
      for (let i = 0; i < preset.customers; i++) {
        try {
          await prisma.customer.create({
            data: {
              tenantId,
              customerNumber: `C-${String(i + 1).padStart(5, "0")}`,
              name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} ${pick(["Industries", "Corp", "LLC", "Group", "Enterprises"])}`,
              city: pick(CITIES),
              state: pick(STATES),
              country: "US",
              email: `customer${i + 1}@example.com`,
              phone: `+1-${randomInt(200, 999)}-${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
              creditLimit: randomInt(5000, 100000),
              paymentTerms: pick(PAYMENT_TERMS),
            },
          });
          counts.customers = (counts.customers || 0) + 1;
        } catch (e) {
          // Log customer creation errors but continue
        }
      }

      // Create vendors with realistic data
      for (let i = 0; i < preset.vendors; i++) {
        try {
          await prisma.vendor.create({
            data: {
              tenantId,
              vendorNumber: `V-${String(i + 1).padStart(5, "0")}`,
              name: i < VENDOR_NAMES.length ? VENDOR_NAMES[i] : `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} Supply`,
              city: pick(CITIES),
              state: pick(STATES),
              country: "US",
              email: `vendor${i + 1}@supplier.com`,
              paymentTerms: pick(PAYMENT_TERMS),
            },
          });
          counts.vendors = (counts.vendors || 0) + 1;
        } catch (e) {
          // Log vendor creation errors but continue
        }
      }

      // Create materials with realistic manufacturing names
      const createdMaterials: { id: string; type: string }[] = [];
      const rawCount = Math.floor(preset.materials * 0.4);
      const semiCount = Math.floor(preset.materials * 0.3);
      const finishedCount = preset.materials - rawCount - semiCount;

      for (let i = 0; i < rawCount; i++) {
        const m = await prisma.material.create({
          data: {
            tenantId,
            materialNumber: `RM-${String(i + 1).padStart(5, "0")}`,
            description: RAW_NAMES[i % RAW_NAMES.length] + (i >= RAW_NAMES.length ? ` ${i + 1}` : ""),
            type: "raw",
            standardPrice: randomInt(5, 100),
            movingAvgPrice: randomInt(5, 100),
            stockQuantity: randomInt(50, 500),
            safetyStock: randomInt(10, 50),
            reorderPoint: randomInt(20, 80),
            leadTimeDays: randomInt(3, 21),
            lotSize: pick([1, 10, 25, 50, 100]),
          },
          }).catch((err) => {
            console.error(`[DatasetGenerator] Failed to create raw material RM-${String(i + 1).padStart(5, "0")}:`, err);
            return null;
          });
        if (m) createdMaterials.push({ id: m.id, type: "raw" });
      }

      for (let i = 0; i < semiCount; i++) {
        const m = await prisma.material.create({
          data: {
            tenantId,
            materialNumber: `SF-${String(i + 1).padStart(5, "0")}`,
            description: SEMI_NAMES[i % SEMI_NAMES.length] + (i >= SEMI_NAMES.length ? ` ${i + 1}` : ""),
            type: "semi-finished",
            standardPrice: randomInt(50, 500),
            movingAvgPrice: randomInt(50, 500),
            stockQuantity: randomInt(10, 100),
            safetyStock: randomInt(5, 20),
            leadTimeDays: randomInt(2, 10),
            lotSize: pick([1, 5, 10, 25]),
          },
          }).catch((err) => {
            console.error(`[DatasetGenerator] Failed to create semi-finished material SF-${String(i + 1).padStart(5, "0")}:`, err);
            return null;
          });
        if (m) createdMaterials.push({ id: m.id, type: "semi-finished" });
      }

      for (let i = 0; i < finishedCount; i++) {
        const m = await prisma.material.create({
          data: {
            tenantId,
            materialNumber: `FG-${String(i + 1).padStart(5, "0")}`,
            description: FINISHED_NAMES[i % FINISHED_NAMES.length] + (i >= FINISHED_NAMES.length ? ` ${i + 1}` : ""),
            type: "finished",
            standardPrice: randomInt(200, 5000),
            movingAvgPrice: randomInt(200, 5000),
            stockQuantity: randomInt(0, 50),
            safetyStock: randomInt(3, 10),
            leadTimeDays: randomInt(5, 30),
            lotSize: pick([1, 5, 10]),
          },
          }).catch((err) => {
            console.error(`[DatasetGenerator] Failed to create finished material FG-${String(i + 1).padStart(5, "0")}:`, err);
            return null;
          });
        if (m) createdMaterials.push({ id: m.id, type: "finished" });
      }
      counts.materials = createdMaterials.length;

      // Create BOMs
      const finishedMats = createdMaterials.filter((m) => m.type === "finished");
      const rawMats = createdMaterials.filter((m) => m.type === "raw" || m.type === "semi-finished");
      for (let i = 0; i < Math.min(preset.boms, finishedMats.length); i++) {
        const fg = finishedMats[i];
        const componentCount = randomInt(2, 5);
        const components = [];
        for (let j = 0; j < componentCount && j < rawMats.length; j++) {
          components.push({
            materialId: rawMats[(i * componentCount + j) % rawMats.length].id,
            quantity: randomInt(1, 10),
            position: j + 1,
            unit: "EA",
          });
        }
        await prisma.billOfMaterial.create({
          data: {
            tenantId,
            bomNumber: `BOM-${String(i + 1).padStart(5, "0")}`,
            materialId: fg.id,
            description: `BOM for finished product ${i + 1}`,
            components: { create: components },
          },
        }).catch((err) => {
          // BOM creation failed, continue
          console.error(`[DatasetGenerator] BOM ${i + 1} creation failed:`, err);
        });
        counts.boms = (counts.boms || 0) + 1;
      }

      // Create employees
      for (let i = 0; i < preset.employees; i++) {
        try {
          await prisma.employee.create({
            data: {
              tenantId,
              employeeNumber: `E-${String(i + 1).padStart(5, "0")}`,
              firstName: pick(FIRST_NAMES),
              lastName: pick(LAST_NAMES),
              department: pick(DEPARTMENTS),
              position: pick(["Engineer", "Operator", "Supervisor", "Manager", "Analyst", "Technician"]),
              hireDate: new Date(2020 + randomInt(0, 5), randomInt(0, 11), randomInt(1, 28)),
              status: "active",
              plantId: plants.length > 0 ? pick(plants).id : undefined,
              salary: randomInt(40000, 120000),
            },
          });
          counts.employees = (counts.employees || 0) + 1;
        } catch (e) {
          // Log employee creation errors but continue
        }
      }

      // Create purchase orders
      const vendors = await prisma.vendor.findMany({ where: { tenantId }, select: { id: true } });
      for (let i = 0; i < preset.purchaseOrders; i++) {
        const vendor = pick(vendors);
        if (!vendor || rawMats.length === 0) continue;
        const mat = pick(rawMats);
        if (!mat) continue;
        const qty = randomInt(10, 200);
        const price = randomInt(5, 150);
        try {
          await prisma.purchaseOrder.create({
            data: {
              tenantId,
              poNumber: `PO-${String(i + 1).padStart(7, "0")}`,
              vendorId: vendor.id,
              status: pick(["draft", "approved", "ordered", "received", "closed"]),
              totalAmount: qty * price,
              createdBy: userId,
              items: {
                create: [{
                  lineNumber: 1,
                  materialId: mat.id,
                  quantity: qty,
                  unitPrice: price,
                  totalPrice: qty * price,
                }],
              },
            },
          });
          counts.purchaseOrders = (counts.purchaseOrders || 0) + 1;
        } catch (e) {
          // Log PO creation errors but continue
        }
      }

      // Create sales orders
      const customers = await prisma.customer.findMany({ where: { tenantId }, select: { id: true } });
      for (let i = 0; i < preset.salesOrders; i++) {
        const customer = pick(customers);
        if (!customer || finishedMats.length === 0) continue;
        const mat = pick(finishedMats);
        if (!mat) continue;
        const qty = randomInt(1, 50);
        const price = randomInt(100, 2000);
        try {
          await prisma.salesOrder.create({
            data: {
              tenantId,
              soNumber: `SO-${String(i + 1).padStart(7, "0")}`,
              customerId: customer.id,
              status: pick(["draft", "confirmed", "processing", "completed"]),
              totalAmount: qty * price,
              createdBy: userId,
              items: {
                create: [{
                  lineNumber: 1,
                  materialId: mat.id,
                  quantity: qty,
                  unitPrice: price,
                  totalPrice: qty * price,
                }],
              },
            },
          });
          counts.salesOrders = (counts.salesOrders || 0) + 1;
        } catch (e) {
          // Log SO creation errors but continue
        }
      }

      res.json({ size, counts });
    } catch (err) {
      next(err);
    }
  }
);

// POST /generate-quick - quick generate (admin/instructor)
router.post(
  "/generate-quick",
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const config = {
        customers: 10,
        vendors: 5,
        materials: 20,
        purchaseOrders: 30,
        salesOrders: 25,
      };

      const counts = { customers: 0, vendors: 0, materials: 0, purchaseOrders: 0, salesOrders: 0 };

      for (let i = 0; i < config.customers!; i++) {
        await prisma.customer.create({
          data: {
            tenantId,
            customerNumber: `QC-${String(i + 1).padStart(4, "0")}`,
            name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
            creditLimit: randomInt(1000, 20000),
            paymentTerms: pick(PAYMENT_TERMS),
          },
        });
        counts.customers++;
      }

      for (let i = 0; i < config.vendors!; i++) {
        await prisma.vendor.create({
          data: {
            tenantId,
            vendorNumber: `QV-${String(i + 1).padStart(4, "0")}`,
            name: `${pick(FIRST_NAMES)} Corp`,
            paymentTerms: pick(PAYMENT_TERMS),
          },
        });
        counts.vendors++;
      }

      const materials: { id: string }[] = [];
      for (let i = 0; i < config.materials!; i++) {
        const m = await prisma.material.create({
          data: {
            tenantId,
            materialNumber: `QM-${String(i + 1).padStart(4, "0")}`,
            description: `Quick Material ${i + 1}`,
            type: pick(MATERIAL_TYPES),
            standardPrice: randomInt(10, 200),
          },
        });
        materials.push({ id: m.id });
        counts.materials++;
      }

      const vendors = await prisma.vendor.findMany({ where: { tenantId }, select: { id: true } });
      const customers = await prisma.customer.findMany({ where: { tenantId }, select: { id: true } });

      for (let i = 0; i < config.purchaseOrders!; i++) {
        const vendor = pick(vendors);
        if (!vendor) continue;
        const mat = pick(materials);
        const qty = randomInt(1, 50);
        const price = randomInt(5, 100);
        await prisma.purchaseOrder.create({
          data: {
            tenantId,
            poNumber: `QPO-${String(i + 1).padStart(5, "0")}`,
            vendorId: vendor.id,
            status: pick(["draft", "approved", "ordered"]),
            totalAmount: qty * price,
            createdBy: req.user!.userId,
            items: {
              create: [
                {
                  lineNumber: 1,
                  materialId: mat!.id,
                  quantity: qty,
                  unitPrice: price,
                  totalPrice: qty * price,
                },
              ],
            },
          },
        });
        counts.purchaseOrders++;
      }

      for (let i = 0; i < config.salesOrders!; i++) {
        const customer = pick(customers);
        if (!customer) continue;
        const mat = pick(materials);
        const qty = randomInt(1, 30);
        const price = randomInt(10, 150);
        await prisma.salesOrder.create({
          data: {
            tenantId,
            soNumber: `QSO-${String(i + 1).padStart(5, "0")}`,
            customerId: customer.id,
            status: pick(["draft", "confirmed", "completed"]),
            totalAmount: qty * price,
            createdBy: req.user!.userId,
            items: {
              create: [
                {
                  lineNumber: 1,
                  materialId: mat!.id,
                  quantity: qty,
                  unitPrice: price,
                  totalPrice: qty * price,
                },
              ],
            },
          },
        });
        counts.salesOrders++;
      }

      res.json({ counts });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /clear-generated - clear all generated data (admin only)
router.delete(
  "/clear-generated",
  requireRoles("admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      // Delete in order to respect FK constraints
      await prisma.deliveryItem.deleteMany({ where: { delivery: { salesOrder: { tenantId } } } });
      await prisma.delivery.deleteMany({ where: { salesOrder: { tenantId } } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { salesOrder: { tenantId } } } });
      await prisma.invoice.deleteMany({ where: { salesOrder: { tenantId } } });
      await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { tenantId } } });
      await prisma.salesOrder.deleteMany({ where: { tenantId } });
      await prisma.goodsReceiptItem.deleteMany({ where: { goodsReceipt: { purchaseOrder: { tenantId } } } });
      await prisma.goodsReceipt.deleteMany({ where: { purchaseOrder: { tenantId } } });
      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { tenantId } } });
      await prisma.purchaseOrder.deleteMany({ where: { tenantId } });
      await prisma.material.deleteMany({ where: { tenantId } });
      await prisma.customer.deleteMany({ where: { tenantId } });
      await prisma.vendor.deleteMany({ where: { tenantId } });

      res.json({ message: "Generated data cleared" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
