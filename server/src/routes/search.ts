import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) {
      return res.json({ results: [] });
    }

    const limit = 5;

    const [materials, customers, vendors, salesOrders, purchaseOrders, employees] = await Promise.all([
      prisma.material.findMany({
        where: {
          tenantId,
          OR: [
            { materialNumber: { contains: q } },
            { description: { contains: q } },
          ],
        },
        select: { id: true, materialNumber: true, description: true, type: true },
        take: limit,
      }),
      prisma.customer.findMany({
        where: {
          tenantId,
          OR: [
            { customerNumber: { contains: q } },
            { name: { contains: q } },
            { email: { contains: q } },
          ],
        },
        select: { id: true, customerNumber: true, name: true },
        take: limit,
      }),
      prisma.vendor.findMany({
        where: {
          tenantId,
          OR: [
            { vendorNumber: { contains: q } },
            { name: { contains: q } },
          ],
        },
        select: { id: true, vendorNumber: true, name: true },
        take: limit,
      }),
      prisma.salesOrder.findMany({
        where: {
          tenantId,
          OR: [{ soNumber: { contains: q } }],
        },
        select: { id: true, soNumber: true, status: true, totalAmount: true },
        take: limit,
      }),
      prisma.purchaseOrder.findMany({
        where: {
          tenantId,
          OR: [{ poNumber: { contains: q } }],
        },
        select: { id: true, poNumber: true, status: true, totalAmount: true },
        take: limit,
      }),
      prisma.employee.findMany({
        where: {
          tenantId,
          OR: [
            { employeeNumber: { contains: q } },
            { firstName: { contains: q } },
            { lastName: { contains: q } },
          ],
        },
        select: { id: true, employeeNumber: true, firstName: true, lastName: true },
        take: limit,
      }),
    ]);

    const results: any[] = [];

    materials.forEach((m) =>
      results.push({ type: "material", id: m.id, title: m.description, subtitle: m.materialNumber, link: "/materials/items" })
    );
    customers.forEach((c) =>
      results.push({ type: "customer", id: c.id, title: c.name, subtitle: c.customerNumber, link: "/finance/customers" })
    );
    vendors.forEach((v) =>
      results.push({ type: "vendor", id: v.id, title: v.name, subtitle: v.vendorNumber, link: "/finance/vendors" })
    );
    salesOrders.forEach((s) =>
      results.push({ type: "sales_order", id: s.id, title: s.soNumber, subtitle: `${s.status} - $${s.totalAmount}`, link: "/sales/orders" })
    );
    purchaseOrders.forEach((p) =>
      results.push({ type: "purchase_order", id: p.id, title: p.poNumber, subtitle: `${p.status} - $${p.totalAmount}`, link: "/materials/purchase-orders" })
    );
    employees.forEach((e) =>
      results.push({ type: "employee", id: e.id, title: `${e.firstName} ${e.lastName}`, subtitle: e.employeeNumber, link: "/hr/employees" })
    );

    res.json({ results });
  } catch (err) {
    next(err);
  }
});

export default router;
