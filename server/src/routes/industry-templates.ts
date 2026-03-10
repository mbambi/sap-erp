import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const PREBUILT_TEMPLATES = [
  {
    id: "prebuilt-automotive",
    industry: "automotive",
    name: "Automotive Manufacturer",
    description: "Complex multi-level BOMs, high-volume manufacturing, JIT supply chain with tier-1 and tier-2 suppliers",
    config: {
      materials: [
        { name: "steel-sheet", type: "raw", unit: "KG", price: 2.5, safetyStock: 5000 },
        { name: "aluminum-ingot", type: "raw", unit: "KG", price: 4.8, safetyStock: 3000 },
        { name: "rubber-compound", type: "raw", unit: "KG", price: 3.2, safetyStock: 2000 },
        { name: "glass-panel", type: "raw", unit: "EA", price: 45, safetyStock: 500 },
        { name: "engine-block", type: "semi_finished", unit: "EA", price: 1200, safetyStock: 100 },
        { name: "transmission-assy", type: "semi_finished", unit: "EA", price: 800, safetyStock: 80 },
        { name: "body-panel-set", type: "semi_finished", unit: "EA", price: 350, safetyStock: 150 },
        { name: "wheel-assembly", type: "semi_finished", unit: "EA", price: 280, safetyStock: 200 },
        { name: "sedan-model-A", type: "finished", unit: "EA", price: 25000, safetyStock: 20 },
        { name: "suv-model-B", type: "finished", unit: "EA", price: 35000, safetyStock: 15 },
      ],
      boms: [
        { finished: "sedan-model-A", components: [
          { material: "engine-block", qty: 1 }, { material: "transmission-assy", qty: 1 },
          { material: "body-panel-set", qty: 1 }, { material: "wheel-assembly", qty: 4 }, { material: "glass-panel", qty: 6 },
        ]},
        { finished: "suv-model-B", components: [
          { material: "engine-block", qty: 1 }, { material: "transmission-assy", qty: 1 },
          { material: "body-panel-set", qty: 2 }, { material: "wheel-assembly", qty: 4 }, { material: "glass-panel", qty: 8 },
        ]},
        { finished: "engine-block", components: [
          { material: "steel-sheet", qty: 45 }, { material: "aluminum-ingot", qty: 20 },
        ]},
      ],
      suppliers: [
        { name: "SteelMax Corp", materials: ["steel-sheet"], leadTime: 14 },
        { name: "AluTech Industries", materials: ["aluminum-ingot"], leadTime: 21 },
        { name: "RubberWorld Ltd", materials: ["rubber-compound"], leadTime: 10 },
      ],
      customers: [
        { name: "Metro Auto Dealers", region: "Northeast" },
        { name: "Sunbelt Motors", region: "Southeast" },
        { name: "Pacific Auto Group", region: "West Coast" },
        { name: "Midwest Fleet Services", region: "Midwest" },
        { name: "National Rental Corp", region: "National" },
      ],
      demandPattern: "high-volume",
      productionFlow: "assembly-line",
      workCenters: ["Stamping", "Welding", "Painting", "Assembly", "QC"],
    },
  },
  {
    id: "prebuilt-retail",
    industry: "retail",
    name: "Retail Supply Chain",
    description: "Seasonal demand, no BOMs, many SKUs, multi-warehouse distribution",
    config: {
      materials: [
        { name: "winter-jacket", type: "trading", unit: "EA", price: 89.99, safetyStock: 200 },
        { name: "summer-dress", type: "trading", unit: "EA", price: 49.99, safetyStock: 300 },
        { name: "laptop-15inch", type: "trading", unit: "EA", price: 899, safetyStock: 50 },
        { name: "smartphone-case", type: "trading", unit: "EA", price: 19.99, safetyStock: 500 },
        { name: "organic-coffee", type: "trading", unit: "KG", price: 24.99, safetyStock: 1000 },
        { name: "dining-table", type: "trading", unit: "EA", price: 450, safetyStock: 30 },
      ],
      boms: null,
      suppliers: [
        { name: "Fashion Wholesale Asia", materials: ["winter-jacket", "summer-dress"], leadTime: 45 },
        { name: "TechDist Global", materials: ["laptop-15inch", "smartphone-case"], leadTime: 14 },
        { name: "Organic Farms Co-op", materials: ["organic-coffee"], leadTime: 7 },
        { name: "Furniture Direct", materials: ["dining-table"], leadTime: 30 },
      ],
      customers: Array.from({ length: 10 }, (_, i) => ({ name: `Store Location ${i + 1}`, region: `Region ${Math.floor(i / 3) + 1}` })),
      demandPattern: "seasonal",
      warehouses: ["Central DC", "East Coast DC", "West Coast DC"],
    },
  },
  {
    id: "prebuilt-electronics",
    industry: "electronics",
    name: "Electronics Factory",
    description: "2-level BOMs, component sourcing, short product lifecycles, high-mix low-volume",
    config: {
      materials: [
        { name: "PCB-board", type: "raw", unit: "EA", price: 8.5, safetyStock: 1000 },
        { name: "SMD-resistor", type: "raw", unit: "EA", price: 0.02, safetyStock: 50000 },
        { name: "MLCC-capacitor", type: "raw", unit: "EA", price: 0.05, safetyStock: 50000 },
        { name: "ARM-processor", type: "raw", unit: "EA", price: 12, safetyStock: 2000 },
        { name: "OLED-display", type: "raw", unit: "EA", price: 45, safetyStock: 500 },
        { name: "li-ion-battery", type: "raw", unit: "EA", price: 18, safetyStock: 1000 },
        { name: "smartphone-X", type: "finished", unit: "EA", price: 699, safetyStock: 100 },
        { name: "tablet-Y", type: "finished", unit: "EA", price: 499, safetyStock: 50 },
      ],
      boms: [
        { finished: "smartphone-X", components: [
          { material: "PCB-board", qty: 1 }, { material: "SMD-resistor", qty: 120 },
          { material: "MLCC-capacitor", qty: 80 }, { material: "ARM-processor", qty: 1 },
          { material: "OLED-display", qty: 1 }, { material: "li-ion-battery", qty: 1 },
        ]},
        { finished: "tablet-Y", components: [
          { material: "PCB-board", qty: 2 }, { material: "SMD-resistor", qty: 200 },
          { material: "MLCC-capacitor", qty: 150 }, { material: "ARM-processor", qty: 1 },
          { material: "OLED-display", qty: 1 }, { material: "li-ion-battery", qty: 2 },
        ]},
      ],
      suppliers: [
        { name: "Shenzhen Components Ltd", materials: ["PCB-board", "SMD-resistor", "MLCC-capacitor"], leadTime: 21 },
        { name: "Taiwan Semiconductor", materials: ["ARM-processor"], leadTime: 60 },
        { name: "Samsung Display", materials: ["OLED-display"], leadTime: 30 },
        { name: "LG Energy", materials: ["li-ion-battery"], leadTime: 25 },
      ],
      customers: [
        { name: "TechMart Online", region: "E-Commerce" },
        { name: "ElectroWorld Retail", region: "Physical Retail" },
        { name: "Enterprise Solutions Inc", region: "B2B" },
      ],
      demandPattern: "technology-cycle",
      workCenters: ["SMT Line", "Assembly", "Testing", "Packaging"],
    },
  },
  {
    id: "prebuilt-pharmaceutical",
    industry: "pharmaceutical",
    name: "Pharmaceutical Company",
    description: "GMP-regulated, batch tracking, validation requirements, long lead times, strict quality",
    config: {
      materials: [
        { name: "active-ingredient-A", type: "raw", unit: "KG", price: 850, safetyStock: 50 },
        { name: "excipient-lactose", type: "raw", unit: "KG", price: 12, safetyStock: 500 },
        { name: "gelatin-capsule", type: "raw", unit: "EA", price: 0.03, safetyStock: 100000 },
        { name: "blister-foil", type: "raw", unit: "M", price: 2.5, safetyStock: 5000 },
        { name: "carton-box", type: "raw", unit: "EA", price: 0.45, safetyStock: 10000 },
        { name: "painkiller-500mg", type: "finished", unit: "BOX", price: 24.99, safetyStock: 2000 },
        { name: "antibiotic-250mg", type: "finished", unit: "BOX", price: 39.99, safetyStock: 1500 },
      ],
      boms: [
        { finished: "painkiller-500mg", components: [
          { material: "active-ingredient-A", qty: 0.5 }, { material: "excipient-lactose", qty: 0.2 },
          { material: "gelatin-capsule", qty: 30 }, { material: "blister-foil", qty: 2 },
          { material: "carton-box", qty: 1 },
        ]},
      ],
      suppliers: [
        { name: "PharmaChem India", materials: ["active-ingredient-A"], leadTime: 90 },
        { name: "Excipient GmbH", materials: ["excipient-lactose"], leadTime: 30 },
      ],
      customers: [
        { name: "National Pharmacy Chain", region: "Domestic" },
        { name: "Hospital Group Alpha", region: "Institutional" },
        { name: "Export Distributor", region: "International" },
      ],
      demandPattern: "regulated",
      quality: "strict-gmp",
      batchTracking: true,
    },
  },
  {
    id: "prebuilt-food",
    industry: "food",
    name: "Food Distribution Network",
    description: "Perishable goods, expiry dates, cold chain logistics, FIFO management",
    config: {
      materials: [
        { name: "wheat-flour", type: "raw", unit: "KG", price: 0.85, safetyStock: 10000 },
        { name: "sugar-refined", type: "raw", unit: "KG", price: 0.95, safetyStock: 5000 },
        { name: "butter-unsalted", type: "raw", unit: "KG", price: 4.5, safetyStock: 500 },
        { name: "fresh-eggs", type: "raw", unit: "DZ", price: 3.2, safetyStock: 200 },
        { name: "packaging-film", type: "raw", unit: "M", price: 0.15, safetyStock: 20000 },
        { name: "artisan-bread", type: "finished", unit: "EA", price: 4.99, safetyStock: 100 },
        { name: "birthday-cake", type: "finished", unit: "EA", price: 29.99, safetyStock: 20 },
        { name: "croissant-pack", type: "finished", unit: "PACK", price: 6.99, safetyStock: 150 },
      ],
      boms: [
        { finished: "artisan-bread", components: [
          { material: "wheat-flour", qty: 0.5 }, { material: "sugar-refined", qty: 0.02 },
          { material: "butter-unsalted", qty: 0.05 }, { material: "packaging-film", qty: 1 },
        ]},
        { finished: "birthday-cake", components: [
          { material: "wheat-flour", qty: 0.3 }, { material: "sugar-refined", qty: 0.2 },
          { material: "butter-unsalted", qty: 0.25 }, { material: "fresh-eggs", qty: 1 },
          { material: "packaging-film", qty: 2 },
        ]},
      ],
      suppliers: [
        { name: "Regional Mill Co", materials: ["wheat-flour", "sugar-refined"], leadTime: 3 },
        { name: "Dairy Fresh Farm", materials: ["butter-unsalted", "fresh-eggs"], leadTime: 1 },
        { name: "PackCo Supplies", materials: ["packaging-film"], leadTime: 7 },
      ],
      customers: Array.from({ length: 8 }, (_, i) => ({ name: `Bakery Outlet ${i + 1}`, region: `Zone ${Math.floor(i / 2) + 1}` })),
      demandPattern: "perishable",
      logistics: "cold-chain",
      shelfLife: { "artisan-bread": 3, "birthday-cake": 5, "croissant-pack": 4 },
    },
  },
];

// GET / - list all (global + tenant-specific)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const dbTemplates = await prisma.industryTemplate.findMany({
      where: { OR: [{ isGlobal: true }, { tenantId }] },
      orderBy: { name: "asc" },
    });
    res.json([...PREBUILT_TEMPLATES, ...dbTemplates]);
  } catch (err) {
    next(err);
  }
});

// GET /prebuilt - hardcoded templates
router.get("/prebuilt", (_req: Request, res: Response) => {
  res.json(PREBUILT_TEMPLATES);
});

// GET /:id - get template detail
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id ?? "");
    const prebuilt = PREBUILT_TEMPLATES.find((t) => t.id === id);
    if (prebuilt) return res.json(prebuilt);
    const template = await prisma.industryTemplate.findFirst({
      where: { id, OR: [{ tenantId }, { isGlobal: true }] },
    });
    if (!template) throw new AppError(404, "Template not found");
    res.json(template);
  } catch (err) {
    next(err);
  }
});

// POST / - create template (admin/instructor)
router.post("/", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const createdBy = req.user!.userId;
    const { industry, name, description, config, isGlobal } = req.body;
    if (!industry || !name || !config) throw new AppError(400, "industry, name, and config required");
    const template = await prisma.industryTemplate.create({
      data: {
        tenantId: isGlobal ? null : tenantId,
        industry,
        name,
        description: description ?? null,
        config: JSON.stringify(config),
        isGlobal: isGlobal ?? false,
        createdBy: isGlobal ? null : createdBy,
      },
    });
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

// POST /:id/apply - apply template to current tenant (admin/instructor)
router.post("/:id/apply", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id ?? "");
    type TemplateMaterial = string | { name: string; type?: string; unit?: string; price?: number; safetyStock?: number };
    type TemplateSupplier = { name: string; materials?: string[]; leadTime?: number };
    type TemplateConfig = {
      materials?: TemplateMaterial[];
      boms?: unknown;
      suppliers?: number | TemplateSupplier[];
      customers?: number;
      demandPattern?: string;
    };
    let config: TemplateConfig;
    const prebuilt = PREBUILT_TEMPLATES.find((t) => t.id === id);
    if (prebuilt) {
      config = prebuilt.config as unknown as TemplateConfig;
    } else {
      const template = await prisma.industryTemplate.findFirst({
        where: { id, OR: [{ tenantId }, { isGlobal: true }] },
      });
      if (!template) throw new AppError(404, "Template not found");
      config = JSON.parse(template.config) as TemplateConfig;
    }
    let materialsCreated = 0;
    let bomsCreated = 0;
    let vendorsCreated = 0;
    let customersCreated = 0;
    const materials = config.materials ?? [];
    for (const mat of materials) {
      const matName = typeof mat === "string" ? mat : mat.name;
      const existing = await prisma.material.findFirst({
        where: { tenantId, materialNumber: matName.replace(/\s/g, "-").toUpperCase() },
      });
      if (!existing) {
        await prisma.material.create({
          data: {
            tenantId,
            materialNumber: matName.replace(/\s/g, "-").toUpperCase(),
            description: matName,
            type: (typeof mat !== "string" && mat.type) ? mat.type : (materials.indexOf(mat) < materials.length - 1 ? "raw" : "finished"),
          },
        });
        materialsCreated++;
      }
    }
    const vendorCount = Array.isArray(config.suppliers) ? config.suppliers.length : (config.suppliers ?? 3);
    for (let i = 0; i < vendorCount; i++) {
      const num = String(i + 1).padStart(4, "0");
      const existing = await prisma.vendor.findFirst({
        where: { tenantId, vendorNumber: `VEND-${num}` },
      });
      if (!existing) {
        await prisma.vendor.create({
          data: {
            tenantId,
            vendorNumber: `VEND-${num}`,
            name: `Supplier ${i + 1}`,
          },
        });
        vendorsCreated++;
      }
    }
    const customerCount = config.customers ?? 5;
    for (let i = 0; i < customerCount; i++) {
      const num = String(i + 1).padStart(4, "0");
      const existing = await prisma.customer.findFirst({
        where: { tenantId, customerNumber: `CUST-${num}` },
      });
      if (!existing) {
        await prisma.customer.create({
          data: {
            tenantId,
            customerNumber: `CUST-${num}`,
            name: `Customer ${i + 1}`,
          },
        });
        customersCreated++;
      }
    }
    if (config.boms && materials.length >= 2) {
      const lastMaterial = materials[materials.length - 1];
      const lastMaterialName = typeof lastMaterial === "string" ? lastMaterial : lastMaterial.name;
      const finishedMat = await prisma.material.findFirst({
        where: { tenantId, materialNumber: lastMaterialName.replace(/\s/g, "-").toUpperCase() },
      });
      if (finishedMat) {
        const existingBom = await prisma.billOfMaterial.findFirst({
          where: { tenantId, materialId: finishedMat.id },
        });
        if (!existingBom) {
          await prisma.billOfMaterial.create({
            data: {
              tenantId,
              bomNumber: `BOM-${finishedMat.materialNumber}`,
              materialId: finishedMat.id,
              description: `BOM for ${finishedMat.description}`,
            },
          });
          bomsCreated++;
        }
      }
    }
    res.json({
      materialsCreated,
      bomsCreated,
      vendorsCreated,
      customersCreated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
