import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ═══════════════════════════════════════════════════════════════════
  // CORE SETUP
  // ═══════════════════════════════════════════════════════════════════

  // Create ENSAK tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "ensak" },
    update: {},
    create: {
      name: "ENSAK",
      slug: "ensak",
      university: "ENSAK — École Nationale des Sciences Appliquées de Khouribga",
      description: "ERP Learning Platform for ENSAK students",
    },
  });

  // Create roles
  const roleNames = ["admin", "instructor", "student", "auditor"];
  const roles: Record<string, any> = {};
  for (const name of roleNames) {
    roles[name] = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name, isSystem: true },
    });
  }

  // Create users
  const passwordHash = await bcrypt.hash("password123", 12);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@ensak.ma" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "admin@ensak.ma",
      passwordHash,
      firstName: "Admin",
      lastName: "ENSAK",
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: roles.admin.id } },
    update: {},
    create: { userId: adminUser.id, roleId: roles.admin.id },
  });

  const instructorUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "teacher@ensak.ma" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "teacher@ensak.ma",
      passwordHash,
      firstName: "Teacher",
      lastName: "ENSAK",
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: instructorUser.id, roleId: roles.instructor.id } },
    update: {},
    create: { userId: instructorUser.id, roleId: roles.instructor.id },
  });

  // Note: No demo student account is created.
  // Students register themselves via the sign-up form.
  // We create a placeholder reference for seed data that references studentUser.
  const studentUser = adminUser; // placeholder — demo student removed

  // Company code
  const companyCode = await prisma.companyCode.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "1000" } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: "1000",
      name: "Global Trading Corp",
      currency: "USD",
      country: "US",
    },
  });

  // GL Accounts (Chart of Accounts)
  const glData = [
    { accountNumber: "100000", name: "Cash and Equivalents", type: "asset" },
    { accountNumber: "110000", name: "Accounts Receivable", type: "asset" },
    { accountNumber: "120000", name: "Inventory", type: "asset" },
    { accountNumber: "150000", name: "Fixed Assets", type: "asset" },
    { accountNumber: "200000", name: "Accounts Payable", type: "liability" },
    { accountNumber: "210000", name: "Accrued Liabilities", type: "liability" },
    { accountNumber: "300000", name: "Common Stock", type: "equity" },
    { accountNumber: "310000", name: "Retained Earnings", type: "equity" },
    { accountNumber: "400000", name: "Sales Revenue", type: "revenue" },
    { accountNumber: "410000", name: "Service Revenue", type: "revenue" },
    { accountNumber: "500000", name: "Cost of Goods Sold", type: "expense" },
    { accountNumber: "600000", name: "Salaries Expense", type: "expense" },
    { accountNumber: "610000", name: "Rent Expense", type: "expense" },
    { accountNumber: "620000", name: "Utilities Expense", type: "expense" },
    { accountNumber: "630000", name: "Office Supplies", type: "expense" },
    { accountNumber: "700000", name: "Depreciation Expense", type: "expense" },
  ];

  for (const gl of glData) {
    await prisma.gLAccount.upsert({
      where: {
        tenantId_companyCodeId_accountNumber: {
          tenantId: tenant.id,
          companyCodeId: companyCode.id,
          accountNumber: gl.accountNumber,
        },
      },
      update: {},
      create: { tenantId: tenant.id, companyCodeId: companyCode.id, ...gl },
    });
  }

  // Plant
  const plant = await prisma.plant.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "P001" } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: "P001",
      name: "Main Manufacturing Plant",
      address: "123 Industrial Ave, Manufacturing City, MC 12345",
    },
  });

  // Vendors
  const vendorData = [
    { vendorNumber: "V-001", name: "Steel Suppliers Inc.", email: "orders@steelsup.com", paymentTerms: "NET30" },
    { vendorNumber: "V-002", name: "Electronic Parts Co.", email: "sales@eparts.com", paymentTerms: "NET45" },
    { vendorNumber: "V-003", name: "Raw Materials Ltd.", email: "info@rawmat.com", paymentTerms: "NET30" },
    { vendorNumber: "V-004", name: "Packaging Solutions", email: "orders@packsol.com", paymentTerms: "NET15" },
    { vendorNumber: "V-005", name: "Chemical Supply Corp.", email: "chem@chemsup.com", paymentTerms: "NET60" },
  ];
  for (const v of vendorData) {
    await prisma.vendor.upsert({
      where: { tenantId_vendorNumber: { tenantId: tenant.id, vendorNumber: v.vendorNumber } },
      update: {},
      create: { tenantId: tenant.id, ...v },
    });
  }

  // Customers
  const customerData = [
    { customerNumber: "C-001", name: "Acme Industries", email: "purchasing@acme.com", creditLimit: 50000 },
    { customerNumber: "C-002", name: "TechWorld Inc.", email: "orders@techworld.com", creditLimit: 100000 },
    { customerNumber: "C-003", name: "Retail Masters", email: "buyer@retailmasters.com", creditLimit: 75000 },
    { customerNumber: "C-004", name: "Global Exports Ltd.", email: "import@globalex.com", creditLimit: 200000 },
    { customerNumber: "C-005", name: "Smart Solutions Co.", email: "procurement@smartsol.com", creditLimit: 30000 },
  ];
  for (const c of customerData) {
    await prisma.customer.upsert({
      where: { tenantId_customerNumber: { tenantId: tenant.id, customerNumber: c.customerNumber } },
      update: {},
      create: { tenantId: tenant.id, ...c },
    });
  }

  // Materials
  const materialData = [
    { materialNumber: "MAT-001", description: "Steel Sheet 4x8 ft", type: "raw", standardPrice: 45.00, stockQuantity: 500, reorderPoint: 100 },
    { materialNumber: "MAT-002", description: "Circuit Board PCB-A", type: "semi-finished", standardPrice: 12.50, stockQuantity: 1200, reorderPoint: 200 },
    { materialNumber: "MAT-003", description: "Aluminum Bar 6ft", type: "raw", standardPrice: 28.00, stockQuantity: 300, reorderPoint: 50 },
    { materialNumber: "MAT-004", description: "Finished Widget A", type: "finished", standardPrice: 89.99, stockQuantity: 150, reorderPoint: 25 },
    { materialNumber: "MAT-005", description: "Packaging Box Large", type: "trading", standardPrice: 3.50, stockQuantity: 2000, reorderPoint: 500 },
    { materialNumber: "MAT-006", description: "Electronic Sensor XR", type: "semi-finished", standardPrice: 35.00, stockQuantity: 800, reorderPoint: 150 },
    { materialNumber: "MAT-007", description: "Finished Widget B", type: "finished", standardPrice: 149.99, stockQuantity: 75, reorderPoint: 15 },
    { materialNumber: "MAT-008", description: "Lubricant Oil 5L", type: "raw", standardPrice: 22.00, stockQuantity: 100, reorderPoint: 20 },
  ];
  for (const m of materialData) {
    await prisma.material.upsert({
      where: { tenantId_materialNumber: { tenantId: tenant.id, materialNumber: m.materialNumber } },
      update: {},
      create: { tenantId: tenant.id, baseUnit: "EA", lotSize: 1, safetyStock: 10, leadTimeDays: 7, ...m },
    });
  }

  // Warehouse + Bins
  const warehouse = await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "WH01" } },
    update: {},
    create: { tenantId: tenant.id, plantId: plant.id, code: "WH01", name: "Main Warehouse" },
  });
  const bins = ["A-01-01", "A-01-02", "A-02-01", "B-01-01", "B-02-01", "R-01-01", "S-01-01"];
  for (const code of bins) {
    await prisma.warehouseBin.upsert({
      where: { warehouseId_binCode: { warehouseId: warehouse.id, binCode: code } },
      update: {},
      create: {
        warehouseId: warehouse.id,
        binCode: code,
        zone: code.charAt(0),
        aisle: code.split("-")[1],
        binType: code.startsWith("R") ? "receiving" : code.startsWith("S") ? "shipping" : "storage",
      },
    });
  }

  // Equipment
  const equipmentData = [
    { equipmentNumber: "EQ-001", description: "CNC Milling Machine", category: "machine", manufacturer: "Haas", criticality: "critical" },
    { equipmentNumber: "EQ-002", description: "Hydraulic Press 200T", category: "machine", manufacturer: "Schuler", criticality: "high" },
    { equipmentNumber: "EQ-003", description: "Forklift Toyota 8FD", category: "vehicle", manufacturer: "Toyota", criticality: "medium" },
    { equipmentNumber: "EQ-004", description: "Temperature Sensor Array", category: "instrument", manufacturer: "Omega", criticality: "low" },
  ];
  for (const eq of equipmentData) {
    await prisma.equipment.upsert({
      where: { tenantId_equipmentNumber: { tenantId: tenant.id, equipmentNumber: eq.equipmentNumber } },
      update: {},
      create: { tenantId: tenant.id, plantId: plant.id, ...eq },
    });
  }

  // Cost Centers
  const ccData = [
    { code: "CC-1000", name: "Production", category: "production" },
    { code: "CC-2000", name: "Administration", category: "admin" },
    { code: "CC-3000", name: "Sales & Marketing", category: "sales" },
    { code: "CC-4000", name: "Research & Development", category: "research" },
  ];
  for (const cc of ccData) {
    await prisma.costCenter.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: cc.code } },
      update: {},
      create: { tenantId: tenant.id, ...cc },
    });
  }

  // Employees (original 5)
  const empData = [
    { employeeNumber: "EMP-001", firstName: "John", lastName: "Smith", department: "Production", position: "Floor Manager", hireDate: new Date("2020-01-15"), salary: 75000 },
    { employeeNumber: "EMP-002", firstName: "Sarah", lastName: "Johnson", department: "Finance", position: "Accountant", hireDate: new Date("2019-06-01"), salary: 65000 },
    { employeeNumber: "EMP-003", firstName: "Mike", lastName: "Williams", department: "Sales", position: "Sales Rep", hireDate: new Date("2021-03-20"), salary: 55000 },
    { employeeNumber: "EMP-004", firstName: "Emily", lastName: "Brown", department: "HR", position: "HR Specialist", hireDate: new Date("2020-09-10"), salary: 60000 },
    { employeeNumber: "EMP-005", firstName: "David", lastName: "Martinez", department: "Warehouse", position: "Warehouse Lead", hireDate: new Date("2018-11-01"), salary: 50000 },
  ];
  for (const emp of empData) {
    await prisma.employee.upsert({
      where: { tenantId_employeeNumber: { tenantId: tenant.id, employeeNumber: emp.employeeNumber } },
      update: {},
      create: { tenantId: tenant.id, plantId: plant.id, ...emp },
    });
  }

  // Sample Exercises
  const exercises = [
    {
      title: "Create Your First Purchase Order",
      description: "Learn the procure-to-pay process by creating a purchase order, approving it, and receiving goods.",
      module: "materials",
      difficulty: "beginner",
      estimatedMinutes: 20,
      sortOrder: 1,
      steps: JSON.stringify([
        { title: "Navigate to Materials Management", instruction: "Click on 'Materials Management' in the sidebar, then select 'Purchase Orders'.", hint: "Look for the MM icon in the left navigation." },
        { title: "Create New PO", instruction: "Click the 'New Purchase Order' button. Select vendor 'Steel Suppliers Inc.' from the dropdown.", hint: "The vendor field is required before you can add items." },
        { title: "Add Line Items", instruction: "Add material 'Steel Sheet 4x8 ft' with quantity 100 and unit price $45.00.", hint: "Check that the total amount calculates correctly." },
        { title: "Save and Submit", instruction: "Save the purchase order. Note the PO number assigned.", hint: "The status should change to 'Draft'." },
        { title: "Approve the PO", instruction: "Click the 'Approve' button on the purchase order.", hint: "In a real system, this might require a different user with approval authority." },
      ]),
      hints: JSON.stringify(["Remember: A purchase order needs at least one line item", "The PO number is auto-generated", "Approval changes the status to 'Approved'"]),
    },
    {
      title: "Post a Journal Entry",
      description: "Practice double-entry bookkeeping by recording a business transaction in the general ledger.",
      module: "finance",
      difficulty: "beginner",
      estimatedMinutes: 15,
      sortOrder: 2,
      steps: JSON.stringify([
        { title: "Open Finance Module", instruction: "Navigate to Finance > Journal Entries.", hint: "The Finance module is the first item in the sidebar." },
        { title: "Create Entry", instruction: "Click 'New Journal Entry'. Set the posting date to today.", hint: "A company code is required." },
        { title: "Add Debit Line", instruction: "Add a line: Debit 'Office Supplies' (630000) for $500.", hint: "Enter the amount in the Debit column." },
        { title: "Add Credit Line", instruction: "Add a line: Credit 'Accounts Payable' (200000) for $500.", hint: "Debits must equal Credits for the entry to be valid." },
        { title: "Post the Entry", instruction: "Click 'Post' to finalize the journal entry.", hint: "Posted entries cannot be edited—only reversed." },
      ]),
    },
    {
      title: "Order-to-Cash Process",
      description: "Complete the full sales cycle: create a sales order, deliver goods, and generate an invoice.",
      module: "sales",
      difficulty: "intermediate",
      estimatedMinutes: 30,
      sortOrder: 3,
      steps: JSON.stringify([
        { title: "Create Sales Order", instruction: "Go to Sales > Orders and create a new sales order for customer 'Acme Industries'." },
        { title: "Add Products", instruction: "Add 'Finished Widget A' (qty: 50, price: $89.99) and 'Finished Widget B' (qty: 20, price: $149.99)." },
        { title: "Confirm Order", instruction: "Confirm the sales order to move it to 'Confirmed' status." },
        { title: "Create Delivery", instruction: "Create a delivery note from the sales order." },
        { title: "Generate Invoice", instruction: "Generate an invoice for the delivered goods." },
      ]),
    },
  ];

  for (const ex of exercises) {
    const existing = await prisma.exercise.findFirst({
      where: { tenantId: tenant.id, title: ex.title },
    });
    if (!existing) {
      await prisma.exercise.create({ data: { tenantId: tenant.id, ...ex } });
    }
  }

  // Sample Scenarios
  const scenarios = [
    {
      name: "Procure-to-Pay",
      description: "Complete procurement cycle from purchase requisition to vendor payment.",
      type: "procure_to_pay",
      steps: JSON.stringify([
        { name: "Create Purchase Order", module: "materials", path: "/materials/purchase-orders" },
        { name: "Approve Purchase Order", module: "materials", path: "/materials/purchase-orders" },
        { name: "Goods Receipt", module: "materials", path: "/materials/purchase-orders" },
        { name: "Invoice Verification", module: "finance", path: "/finance/journal-entries" },
        { name: "Payment Processing", module: "finance", path: "/finance/journal-entries" },
      ]),
    },
    {
      name: "Order-to-Cash",
      description: "Complete sales cycle from customer inquiry to payment receipt.",
      type: "order_to_cash",
      steps: JSON.stringify([
        { name: "Create Sales Order", module: "sales", path: "/sales/orders" },
        { name: "Confirm Order", module: "sales", path: "/sales/orders" },
        { name: "Create Delivery", module: "sales", path: "/sales/orders" },
        { name: "Post Goods Issue", module: "warehouse", path: "/warehouse" },
        { name: "Create Invoice", module: "sales", path: "/sales/orders" },
        { name: "Receive Payment", module: "finance", path: "/finance/journal-entries" },
      ]),
    },
  ];

  for (const sc of scenarios) {
    const existing = await prisma.scenario.findFirst({
      where: { tenantId: tenant.id, name: sc.name },
    });
    if (!existing) {
      await prisma.scenario.create({ data: { tenantId: tenant.id, ...sc } });
    }
  }

  // Transaction Codes (SAP-style)
  const tcodes = [
    { code: "ME21N", name: "Create Purchase Order", module: "materials", path: "/materials/purchase-orders", description: "Create a new purchase requisition/order" },
    { code: "ME23N", name: "Display Purchase Order", module: "materials", path: "/materials/purchase-orders", description: "Display an existing purchase order" },
    { code: "MIGO", name: "Goods Receipt", module: "materials", path: "/materials/goods-receipts", description: "Post goods receipt for purchase order" },
    { code: "MM01", name: "Create Material", module: "materials", path: "/materials/items", description: "Create a new material master record" },
    { code: "MM03", name: "Display Material", module: "materials", path: "/materials/items", description: "Display material master data" },
    { code: "MMBE", name: "Stock Overview", module: "materials", path: "/materials/inventory", description: "View stock overview for materials" },
    { code: "VA01", name: "Create Sales Order", module: "sales", path: "/sales/orders", description: "Create a new sales order" },
    { code: "VA03", name: "Display Sales Order", module: "sales", path: "/sales/orders", description: "Display sales order details" },
    { code: "VL01N", name: "Create Delivery", module: "sales", path: "/sales/deliveries", description: "Create outbound delivery" },
    { code: "VF01", name: "Create Invoice", module: "sales", path: "/sales/invoices", description: "Create billing document" },
    { code: "FB50", name: "Post Journal Entry", module: "finance", path: "/finance/journal-entries", description: "Post a general ledger journal entry" },
    { code: "FS00", name: "GL Account Master", module: "finance", path: "/finance/gl-accounts", description: "Manage GL account master data" },
    { code: "FK01", name: "Create Vendor", module: "finance", path: "/finance/vendors", description: "Create vendor master record" },
    { code: "FD01", name: "Create Customer", module: "finance", path: "/finance/customers", description: "Create customer master record" },
    { code: "F.01", name: "Trial Balance", module: "finance", path: "/finance/trial-balance", description: "Display trial balance report" },
    { code: "CO01", name: "Create Production Order", module: "production", path: "/production/orders", description: "Create a production order" },
    { code: "CS01", name: "Create BOM", module: "production", path: "/production/boms", description: "Create bill of materials" },
    { code: "MD01", name: "MRP Run", module: "mrp", path: "/mrp", description: "Execute material requirements planning" },
    { code: "MD04", name: "Stock/Requirements", module: "mrp", path: "/mrp", description: "Display stock/requirements list" },
    { code: "PA20", name: "Display HR Master", module: "hr", path: "/hr/employees", description: "Display employee master data" },
    { code: "PA30", name: "Maintain HR Master", module: "hr", path: "/hr/employees", description: "Maintain employee master data" },
    { code: "PT01", name: "Create Work Schedule", module: "hr", path: "/hr/time-entries", description: "Create work schedule" },
    { code: "IW31", name: "Create Maintenance Order", module: "maintenance", path: "/maintenance/work-orders", description: "Create maintenance work order" },
    { code: "IE01", name: "Create Equipment", module: "maintenance", path: "/maintenance/equipment", description: "Create equipment master record" },
    { code: "QA01", name: "Create Inspection Lot", module: "quality", path: "/quality/inspections", description: "Create quality inspection lot" },
    { code: "KS01", name: "Create Cost Center", module: "controlling", path: "/controlling/cost-centers", description: "Create cost center" },
    { code: "KO01", name: "Create Internal Order", module: "controlling", path: "/controlling/internal-orders", description: "Create internal order" },
    { code: "LS01", name: "Create Warehouse Bin", module: "warehouse", path: "/warehouse/bins", description: "Create storage bin" },
    { code: "ZLEARN", name: "Learning Hub", module: "learning", path: "/learning", description: "Open learning exercises and tutorials" },
    { code: "ZSCN", name: "Supply Chain Network", module: "supply-chain", path: "/supply-chain", description: "Supply chain network modeling" },
    { code: "ZOPS", name: "Operations Dashboard", module: "operations", path: "/operations", description: "View operations KPIs and metrics" },
  ];

  for (const tc of tcodes) {
    await prisma.transactionCode.upsert({
      where: { code: tc.code },
      update: {},
      create: tc,
    });
  }

  // Achievements
  const achievements = [
    { code: "FIRST_LOGIN", name: "First Steps", description: "Logged into the ERP system for the first time", icon: "🎯", xpReward: 10, category: "milestone", condition: '{"type":"login","count":1}' },
    { code: "FIRST_PO", name: "Procurement Rookie", description: "Created your first purchase order", icon: "📦", xpReward: 50, category: "module", condition: '{"type":"create","entity":"purchase_order","count":1}' },
    { code: "FIRST_SO", name: "Sales Starter", description: "Created your first sales order", icon: "🛒", xpReward: 50, category: "module", condition: '{"type":"create","entity":"sales_order","count":1}' },
    { code: "FIRST_JE", name: "Bookkeeper", description: "Posted your first journal entry", icon: "📒", xpReward: 50, category: "module", condition: '{"type":"create","entity":"journal_entry","count":1}' },
    { code: "P2P_COMPLETE", name: "Procure-to-Pay Master", description: "Completed a full procure-to-pay cycle", icon: "🏆", xpReward: 200, category: "process", condition: '{"type":"process","name":"procure_to_pay"}' },
    { code: "O2C_COMPLETE", name: "Order-to-Cash Champion", description: "Completed a full order-to-cash cycle", icon: "💰", xpReward: 200, category: "process", condition: '{"type":"process","name":"order_to_cash"}' },
    { code: "MRP_RUN", name: "Planning Pro", description: "Executed your first MRP run", icon: "📊", xpReward: 100, category: "module", condition: '{"type":"create","entity":"mrp_run","count":1}' },
    { code: "EXERCISE_1", name: "Quick Learner", description: "Completed your first exercise", icon: "📝", xpReward: 75, category: "milestone", condition: '{"type":"exercise_complete","count":1}' },
    { code: "EXERCISE_ALL", name: "Straight-A Student", description: "Completed all available exercises", icon: "🎓", xpReward: 500, category: "milestone", condition: '{"type":"exercise_complete","count":"all"}' },
    { code: "TEN_POS", name: "Procurement Expert", description: "Created 10 purchase orders", icon: "📋", xpReward: 150, category: "module", condition: '{"type":"create","entity":"purchase_order","count":10}' },
    { code: "INVENTORY_ABC", name: "Inventory Analyst", description: "Ran ABC classification on inventory", icon: "📈", xpReward: 100, category: "module", condition: '{"type":"action","name":"abc_classification"}' },
    { code: "SCENARIO_SIM", name: "Risk Manager", description: "Ran a scenario simulation", icon: "⚡", xpReward: 100, category: "module", condition: '{"type":"action","name":"scenario_simulation"}' },
  ];

  for (const ach of achievements) {
    await prisma.achievement.upsert({
      where: { code: ach.code },
      update: {},
      create: ach,
    });
  }

  // Work Centers
  const workCenters = [
    { code: "WC-MILL", name: "CNC Milling Center", type: "machine", capacity: 8, efficiency: 95, costRate: 75 },
    { code: "WC-LATHE", name: "CNC Lathe Center", type: "machine", capacity: 8, efficiency: 90, costRate: 65 },
    { code: "WC-ASSY", name: "Assembly Line 1", type: "assembly_line", capacity: 16, efficiency: 85, costRate: 45 },
    { code: "WC-TEST", name: "Quality Testing", type: "testing", capacity: 8, efficiency: 98, costRate: 55 },
    { code: "WC-PACK", name: "Packaging Station", type: "manual", capacity: 8, efficiency: 92, costRate: 30 },
  ];

  for (const wc of workCenters) {
    await prisma.workCenter.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: wc.code } },
      update: {},
      create: { tenantId: tenant.id, ...wc },
    });
  }

  // Fiscal Periods
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  for (let i = 0; i < 12; i++) {
    const start = new Date(2026, i, 1);
    const end = new Date(2026, i + 1, 0);
    await prisma.fiscalPeriod.upsert({
      where: { tenantId_year_period: { tenantId: tenant.id, year: 2026, period: i + 1 } },
      update: {},
      create: { tenantId: tenant.id, year: 2026, period: i + 1, name: months[i], startDate: start, endDate: end, status: i < 2 ? "closed" : "open" },
    });
  }

  // Assets
  const assets = [
    { assetNumber: "AST-001", description: "CNC Milling Machine Model X200", category: "machinery", acquisitionDate: new Date("2024-01-15"), acquisitionCost: 150000, currentValue: 125000, usefulLifeMonths: 120, salvageValue: 15000, accumulatedDepr: 25000, monthlyDepr: 1125 },
    { assetNumber: "AST-002", description: "Forklift Toyota 8FBN25", category: "vehicle", acquisitionDate: new Date("2024-06-01"), acquisitionCost: 35000, currentValue: 30625, usefulLifeMonths: 60, salvageValue: 5000, accumulatedDepr: 4375, monthlyDepr: 500 },
    { assetNumber: "AST-003", description: "ERP Server Rack Dell PowerEdge", category: "computer", acquisitionDate: new Date("2025-01-01"), acquisitionCost: 25000, currentValue: 21875, usefulLifeMonths: 48, salvageValue: 1000, accumulatedDepr: 3125, monthlyDepr: 500 },
    { assetNumber: "AST-004", description: "Automated Packaging Line", category: "machinery", acquisitionDate: new Date("2023-06-01"), acquisitionCost: 200000, currentValue: 155000, usefulLifeMonths: 120, salvageValue: 20000, accumulatedDepr: 45000, monthlyDepr: 1500 },
    { assetNumber: "AST-005", description: "Office Furniture Set - Floor 2", category: "furniture", acquisitionDate: new Date("2025-03-01"), acquisitionCost: 12000, currentValue: 10800, usefulLifeMonths: 84, salvageValue: 600, accumulatedDepr: 1200, monthlyDepr: 135.71 },
  ];
  for (const a of assets) {
    await prisma.asset.upsert({
      where: { tenantId_assetNumber: { tenantId: tenant.id, assetNumber: a.assetNumber } },
      update: {},
      create: { tenantId: tenant.id, ...a, depreciationMethod: "straight_line", status: "active" },
    });
  }

  // Pricing Conditions
  const materials = await prisma.material.findMany({ where: { tenantId: tenant.id }, take: 5 });
  const customers = await prisma.customer.findMany({ where: { tenantId: tenant.id }, take: 3 });
  if (materials.length > 0) {
    const conditions = [
      { conditionType: "discount_pct", name: "Volume Discount 5%", materialId: materials[0]?.id, value: 5, minQuantity: 100 },
      { conditionType: "discount_pct", name: "Preferred Customer 10%", customerId: customers[0]?.id, value: 10 },
      { conditionType: "surcharge", name: "Expedite Surcharge", value: 50, currency: "USD" },
      { conditionType: "freight", name: "Standard Freight", value: 25, currency: "USD" },
      { conditionType: "tax", name: "Sales Tax 8.25%", value: 8.25 },
    ];
    for (const c of conditions) {
      await prisma.pricingCondition.create({
        data: { tenantId: tenant.id, conditionType: c.conditionType, name: c.name, materialId: c.materialId || null, customerId: c.customerId || null, value: c.value, currency: c.currency || "USD", minQuantity: c.minQuantity || null, validFrom: new Date() },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOOKUP MAPS FOR NEW DATA
  // ═══════════════════════════════════════════════════════════════════

  const allMaterials = await prisma.material.findMany({ where: { tenantId: tenant.id } });
  const matMap: Record<string, any> = {};
  for (const m of allMaterials) matMap[m.materialNumber] = m;

  const allVendors = await prisma.vendor.findMany({ where: { tenantId: tenant.id } });
  const vendorMap: Record<string, any> = {};
  for (const v of allVendors) vendorMap[v.vendorNumber] = v;

  const allCustomers = await prisma.customer.findMany({ where: { tenantId: tenant.id } });
  const custMap: Record<string, any> = {};
  for (const c of allCustomers) custMap[c.customerNumber] = c;

  const allEquipment = await prisma.equipment.findMany({ where: { tenantId: tenant.id } });
  const eqMap: Record<string, any> = {};
  for (const e of allEquipment) eqMap[e.equipmentNumber] = e;

  const allWorkCenters = await prisma.workCenter.findMany({ where: { tenantId: tenant.id } });
  const wcMap: Record<string, any> = {};
  for (const wc of allWorkCenters) wcMap[wc.code] = wc;

  const allGLAccounts = await prisma.gLAccount.findMany({ where: { tenantId: tenant.id } });
  const glMap: Record<string, any> = {};
  for (const gl of allGLAccounts) glMap[gl.accountNumber] = gl;

  // ═══════════════════════════════════════════════════════════════════
  // 1. MORE EMPLOYEES (EMP-006 through EMP-010)
  // ═══════════════════════════════════════════════════════════════════

  const moreEmpData = [
    { employeeNumber: "EMP-006", firstName: "Lisa", lastName: "Chen", department: "IT", position: "Systems Administrator", hireDate: new Date("2021-07-15"), salary: 72000 },
    { employeeNumber: "EMP-007", firstName: "Robert", lastName: "Taylor", department: "Quality", position: "QA Inspector", hireDate: new Date("2020-04-01"), salary: 58000 },
    { employeeNumber: "EMP-008", firstName: "Maria", lastName: "Garcia", department: "Logistics", position: "Logistics Coordinator", hireDate: new Date("2022-01-10"), salary: 52000 },
    { employeeNumber: "EMP-009", firstName: "James", lastName: "Wilson", department: "Engineering", position: "Process Engineer", hireDate: new Date("2019-11-20"), salary: 80000 },
    { employeeNumber: "EMP-010", firstName: "Anna", lastName: "Kowalski", department: "Procurement", position: "Buyer", hireDate: new Date("2023-02-01"), salary: 56000 },
  ];
  for (const emp of moreEmpData) {
    await prisma.employee.upsert({
      where: { tenantId_employeeNumber: { tenantId: tenant.id, employeeNumber: emp.employeeNumber } },
      update: {},
      create: { tenantId: tenant.id, plantId: plant.id, ...emp },
    });
  }

  const allEmployees = await prisma.employee.findMany({ where: { tenantId: tenant.id } });
  const empMap: Record<string, any> = {};
  for (const e of allEmployees) empMap[e.employeeNumber] = e;

  // ═══════════════════════════════════════════════════════════════════
  // 2. JOURNAL ENTRIES
  // ═══════════════════════════════════════════════════════════════════

  const je1 = await prisma.journalEntry.upsert({
    where: { tenantId_companyCodeId_documentNumber: { tenantId: tenant.id, companyCodeId: companyCode.id, documentNumber: "JE-0001" } },
    update: {},
    create: {
      tenantId: tenant.id, companyCodeId: companyCode.id, documentNumber: "JE-0001",
      postingDate: new Date("2026-03-01"), documentDate: new Date("2026-03-01"),
      description: "Office supplies purchase", status: "posted", createdBy: adminUser.id,
    },
  });
  if ((await prisma.journalLineItem.count({ where: { journalEntryId: je1.id } })) === 0) {
    await prisma.journalLineItem.createMany({ data: [
      { journalEntryId: je1.id, glAccountId: glMap["630000"].id, lineNumber: 1, debit: 500, credit: 0, description: "Office Supplies" },
      { journalEntryId: je1.id, glAccountId: glMap["200000"].id, lineNumber: 2, debit: 0, credit: 500, description: "Accounts Payable" },
    ]});
  }

  const je2 = await prisma.journalEntry.upsert({
    where: { tenantId_companyCodeId_documentNumber: { tenantId: tenant.id, companyCodeId: companyCode.id, documentNumber: "JE-0002" } },
    update: {},
    create: {
      tenantId: tenant.id, companyCodeId: companyCode.id, documentNumber: "JE-0002",
      postingDate: new Date("2026-03-02"), documentDate: new Date("2026-03-02"),
      description: "Sales revenue recording", status: "posted", createdBy: adminUser.id,
    },
  });
  if ((await prisma.journalLineItem.count({ where: { journalEntryId: je2.id } })) === 0) {
    await prisma.journalLineItem.createMany({ data: [
      { journalEntryId: je2.id, glAccountId: glMap["110000"].id, lineNumber: 1, debit: 12000, credit: 0, description: "Accounts Receivable" },
      { journalEntryId: je2.id, glAccountId: glMap["400000"].id, lineNumber: 2, debit: 0, credit: 12000, description: "Sales Revenue" },
    ]});
  }

  const je3 = await prisma.journalEntry.upsert({
    where: { tenantId_companyCodeId_documentNumber: { tenantId: tenant.id, companyCodeId: companyCode.id, documentNumber: "JE-0003" } },
    update: {},
    create: {
      tenantId: tenant.id, companyCodeId: companyCode.id, documentNumber: "JE-0003",
      postingDate: new Date("2026-03-05"), documentDate: new Date("2026-03-05"),
      description: "Monthly salary and utilities payment", status: "posted", createdBy: adminUser.id,
    },
  });
  if ((await prisma.journalLineItem.count({ where: { journalEntryId: je3.id } })) === 0) {
    await prisma.journalLineItem.createMany({ data: [
      { journalEntryId: je3.id, glAccountId: glMap["600000"].id, lineNumber: 1, debit: 25000, credit: 0, description: "Salaries Expense" },
      { journalEntryId: je3.id, glAccountId: glMap["620000"].id, lineNumber: 2, debit: 3000, credit: 0, description: "Utilities Expense" },
      { journalEntryId: je3.id, glAccountId: glMap["100000"].id, lineNumber: 3, debit: 0, credit: 28000, description: "Cash Payment" },
    ]});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3. PURCHASE ORDERS
  // ═══════════════════════════════════════════════════════════════════

  const po1 = await prisma.purchaseOrder.upsert({
    where: { tenantId_poNumber: { tenantId: tenant.id, poNumber: "PO-0000001" } },
    update: {},
    create: {
      tenantId: tenant.id, poNumber: "PO-0000001", vendorId: vendorMap["V-001"].id,
      orderDate: new Date("2026-02-15"), deliveryDate: new Date("2026-03-01"),
      status: "received", totalAmount: 12900, createdBy: adminUser.id,
      approvedBy: adminUser.id, approvedAt: new Date("2026-02-16"),
    },
  });
  if ((await prisma.purchaseOrderItem.count({ where: { poId: po1.id } })) === 0) {
    await prisma.purchaseOrderItem.createMany({ data: [
      { poId: po1.id, lineNumber: 10, materialId: matMap["MAT-001"].id, quantity: 200, unitPrice: 45, totalPrice: 9000, receivedQty: 200 },
      { poId: po1.id, lineNumber: 20, materialId: matMap["MAT-003"].id, quantity: 100, unitPrice: 28, totalPrice: 2800, receivedQty: 100 },
      { poId: po1.id, lineNumber: 30, materialId: matMap["MAT-008"].id, quantity: 50, unitPrice: 22, totalPrice: 1100, receivedQty: 50 },
    ]});
  }

  const po2 = await prisma.purchaseOrder.upsert({
    where: { tenantId_poNumber: { tenantId: tenant.id, poNumber: "PO-0000002" } },
    update: {},
    create: {
      tenantId: tenant.id, poNumber: "PO-0000002", vendorId: vendorMap["V-002"].id,
      orderDate: new Date("2026-02-20"), deliveryDate: new Date("2026-03-10"),
      status: "approved", totalAmount: 16750, createdBy: adminUser.id,
      approvedBy: adminUser.id, approvedAt: new Date("2026-02-21"),
    },
  });
  if ((await prisma.purchaseOrderItem.count({ where: { poId: po2.id } })) === 0) {
    await prisma.purchaseOrderItem.createMany({ data: [
      { poId: po2.id, lineNumber: 10, materialId: matMap["MAT-002"].id, quantity: 500, unitPrice: 12.50, totalPrice: 6250 },
      { poId: po2.id, lineNumber: 20, materialId: matMap["MAT-006"].id, quantity: 300, unitPrice: 35, totalPrice: 10500 },
    ]});
  }

  const po3 = await prisma.purchaseOrder.upsert({
    where: { tenantId_poNumber: { tenantId: tenant.id, poNumber: "PO-0000003" } },
    update: {},
    create: {
      tenantId: tenant.id, poNumber: "PO-0000003", vendorId: vendorMap["V-004"].id,
      orderDate: new Date("2026-03-01"), deliveryDate: new Date("2026-03-15"),
      status: "ordered", totalAmount: 3500, createdBy: adminUser.id,
    },
  });
  if ((await prisma.purchaseOrderItem.count({ where: { poId: po3.id } })) === 0) {
    await prisma.purchaseOrderItem.createMany({ data: [
      { poId: po3.id, lineNumber: 10, materialId: matMap["MAT-005"].id, quantity: 1000, unitPrice: 3.50, totalPrice: 3500 },
    ]});
  }

  const po4 = await prisma.purchaseOrder.upsert({
    where: { tenantId_poNumber: { tenantId: tenant.id, poNumber: "PO-0000004" } },
    update: {},
    create: {
      tenantId: tenant.id, poNumber: "PO-0000004", vendorId: vendorMap["V-003"].id,
      orderDate: new Date("2026-03-05"), status: "draft", totalAmount: 12350, createdBy: adminUser.id,
    },
  });
  if ((await prisma.purchaseOrderItem.count({ where: { poId: po4.id } })) === 0) {
    await prisma.purchaseOrderItem.createMany({ data: [
      { poId: po4.id, lineNumber: 10, materialId: matMap["MAT-001"].id, quantity: 150, unitPrice: 45, totalPrice: 6750 },
      { poId: po4.id, lineNumber: 20, materialId: matMap["MAT-003"].id, quantity: 200, unitPrice: 28, totalPrice: 5600 },
    ]});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4. GOODS RECEIPTS (for PO-0000001)
  // ═══════════════════════════════════════════════════════════════════

  let gr1 = await prisma.goodsReceipt.findFirst({ where: { grNumber: "GR-0001" } });
  if (!gr1) {
    gr1 = await prisma.goodsReceipt.create({ data: {
      poId: po1.id, grNumber: "GR-0001", receiptDate: new Date("2026-03-01"),
      notes: "Full receipt of PO-0000001 items", createdBy: adminUser.id,
    }});
    await prisma.goodsReceiptItem.createMany({ data: [
      { goodsReceiptId: gr1.id, materialId: matMap["MAT-001"].id, quantity: 200, batchNumber: "BATCH-STL-2026-001", storageLocation: "A-01-01" },
      { goodsReceiptId: gr1.id, materialId: matMap["MAT-003"].id, quantity: 100, batchNumber: "BATCH-ALU-2026-001", storageLocation: "A-02-01" },
      { goodsReceiptId: gr1.id, materialId: matMap["MAT-008"].id, quantity: 50, batchNumber: "BATCH-LUB-2026-001", storageLocation: "B-01-01" },
    ]});
  }

  let gr2 = await prisma.goodsReceipt.findFirst({ where: { grNumber: "GR-0002" } });
  if (!gr2) {
    gr2 = await prisma.goodsReceipt.create({ data: {
      poId: po1.id, grNumber: "GR-0002", receiptDate: new Date("2026-03-02"),
      notes: "Quality inspection receipt for PO-0000001", createdBy: adminUser.id,
    }});
    await prisma.goodsReceiptItem.createMany({ data: [
      { goodsReceiptId: gr2.id, materialId: matMap["MAT-001"].id, quantity: 200, batchNumber: "BATCH-STL-2026-001", storageLocation: "A-01-02" },
    ]});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5. SALES ORDERS
  // ═══════════════════════════════════════════════════════════════════

  const so1 = await prisma.salesOrder.upsert({
    where: { tenantId_soNumber: { tenantId: tenant.id, soNumber: "SO-0000001" } },
    update: {},
    create: {
      tenantId: tenant.id, soNumber: "SO-0000001", customerId: custMap["C-001"].id,
      orderDate: new Date("2026-02-10"), requestedDate: new Date("2026-02-25"),
      status: "completed", totalAmount: 7499.30, createdBy: adminUser.id,
    },
  });
  if ((await prisma.salesOrderItem.count({ where: { soId: so1.id } })) === 0) {
    await prisma.salesOrderItem.createMany({ data: [
      { soId: so1.id, lineNumber: 10, materialId: matMap["MAT-004"].id, quantity: 50, unitPrice: 89.99, totalPrice: 4499.50, deliveredQty: 50 },
      { soId: so1.id, lineNumber: 20, materialId: matMap["MAT-007"].id, quantity: 20, unitPrice: 149.99, totalPrice: 2999.80, deliveredQty: 20 },
    ]});
  }

  const so2 = await prisma.salesOrder.upsert({
    where: { tenantId_soNumber: { tenantId: tenant.id, soNumber: "SO-0000002" } },
    update: {},
    create: {
      tenantId: tenant.id, soNumber: "SO-0000002", customerId: custMap["C-002"].id,
      orderDate: new Date("2026-02-20"), requestedDate: new Date("2026-03-10"),
      status: "processing", totalAmount: 10749, createdBy: adminUser.id,
    },
  });
  if ((await prisma.salesOrderItem.count({ where: { soId: so2.id } })) === 0) {
    await prisma.salesOrderItem.createMany({ data: [
      { soId: so2.id, lineNumber: 10, materialId: matMap["MAT-004"].id, quantity: 100, unitPrice: 89.99, totalPrice: 8999 },
      { soId: so2.id, lineNumber: 20, materialId: matMap["MAT-006"].id, quantity: 50, unitPrice: 35, totalPrice: 1750 },
    ]});
  }

  const so3 = await prisma.salesOrder.upsert({
    where: { tenantId_soNumber: { tenantId: tenant.id, soNumber: "SO-0000003" } },
    update: {},
    create: {
      tenantId: tenant.id, soNumber: "SO-0000003", customerId: custMap["C-004"].id,
      orderDate: new Date("2026-03-01"), requestedDate: new Date("2026-03-20"),
      status: "confirmed", totalAmount: 4499.70, createdBy: adminUser.id,
    },
  });
  if ((await prisma.salesOrderItem.count({ where: { soId: so3.id } })) === 0) {
    await prisma.salesOrderItem.createMany({ data: [
      { soId: so3.id, lineNumber: 10, materialId: matMap["MAT-007"].id, quantity: 30, unitPrice: 149.99, totalPrice: 4499.70 },
    ]});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 6. DELIVERIES
  // ═══════════════════════════════════════════════════════════════════

  let del1 = await prisma.delivery.findFirst({ where: { deliveryNumber: "DEL-0001" } });
  if (!del1) {
    del1 = await prisma.delivery.create({ data: {
      deliveryNumber: "DEL-0001", soId: so1.id, customerId: custMap["C-001"].id,
      deliveryDate: new Date("2026-02-25"), status: "delivered",
      trackingNumber: "FDX-9876543210", carrier: "FedEx", createdBy: adminUser.id,
    }});
    await prisma.deliveryItem.createMany({ data: [
      { deliveryId: del1.id, materialId: matMap["MAT-004"].id, quantity: 50 },
      { deliveryId: del1.id, materialId: matMap["MAT-007"].id, quantity: 20 },
    ]});
  }

  let del2 = await prisma.delivery.findFirst({ where: { deliveryNumber: "DEL-0002" } });
  if (!del2) {
    del2 = await prisma.delivery.create({ data: {
      deliveryNumber: "DEL-0002", soId: so2.id, customerId: custMap["C-002"].id,
      deliveryDate: new Date("2026-03-08"), status: "shipped",
      trackingNumber: "UPS-1234567890", carrier: "UPS", createdBy: adminUser.id,
    }});
    await prisma.deliveryItem.createMany({ data: [
      { deliveryId: del2.id, materialId: matMap["MAT-004"].id, quantity: 100 },
      { deliveryId: del2.id, materialId: matMap["MAT-006"].id, quantity: 50 },
    ]});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 7. INVOICES (customer invoices)
  // ═══════════════════════════════════════════════════════════════════

  let inv1 = await prisma.invoice.findFirst({ where: { invoiceNumber: "INV-0001" } });
  if (!inv1) {
    inv1 = await prisma.invoice.create({ data: {
      invoiceNumber: "INV-0001", soId: so1.id, customerId: custMap["C-001"].id,
      invoiceDate: new Date("2026-02-26"), dueDate: new Date("2026-03-28"),
      status: "paid", subtotal: 7499.30, taxAmount: 0, totalAmount: 7499.30, paidAmount: 7499.30,
      createdBy: adminUser.id,
    }});
    await prisma.invoiceItem.createMany({ data: [
      { invoiceId: inv1.id, description: "Finished Widget A", quantity: 50, unitPrice: 89.99, totalPrice: 4499.50 },
      { invoiceId: inv1.id, description: "Finished Widget B", quantity: 20, unitPrice: 149.99, totalPrice: 2999.80 },
    ]});
  }

  let inv2 = await prisma.invoice.findFirst({ where: { invoiceNumber: "INV-0002" } });
  if (!inv2) {
    inv2 = await prisma.invoice.create({ data: {
      invoiceNumber: "INV-0002", soId: so2.id, customerId: custMap["C-002"].id,
      invoiceDate: new Date("2026-03-08"), dueDate: new Date("2026-04-07"),
      status: "sent", subtotal: 10749, taxAmount: 0, totalAmount: 10749, paidAmount: 0,
      createdBy: adminUser.id,
    }});
    await prisma.invoiceItem.createMany({ data: [
      { invoiceId: inv2.id, description: "Finished Widget A", quantity: 100, unitPrice: 89.99, totalPrice: 8999 },
      { invoiceId: inv2.id, description: "Electronic Sensor XR", quantity: 50, unitPrice: 35, totalPrice: 1750 },
    ]});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 8. BILL OF MATERIALS
  // ═══════════════════════════════════════════════════════════════════

  const bom1 = await prisma.billOfMaterial.upsert({
    where: { tenantId_bomNumber: { tenantId: tenant.id, bomNumber: "BOM-001" } },
    update: {},
    create: {
      tenantId: tenant.id, bomNumber: "BOM-001", materialId: matMap["MAT-004"].id,
      description: "Finished Widget A - Assembly BOM",
    },
  });
  if ((await prisma.bOMComponent.count({ where: { bomId: bom1.id } })) === 0) {
    await prisma.bOMComponent.createMany({ data: [
      { bomId: bom1.id, materialId: matMap["MAT-001"].id, quantity: 2, position: 10 },
      { bomId: bom1.id, materialId: matMap["MAT-002"].id, quantity: 1, position: 20 },
      { bomId: bom1.id, materialId: matMap["MAT-006"].id, quantity: 1, position: 30 },
    ]});
  }

  const bom2 = await prisma.billOfMaterial.upsert({
    where: { tenantId_bomNumber: { tenantId: tenant.id, bomNumber: "BOM-002" } },
    update: {},
    create: {
      tenantId: tenant.id, bomNumber: "BOM-002", materialId: matMap["MAT-007"].id,
      description: "Finished Widget B - Assembly BOM",
    },
  });
  if ((await prisma.bOMComponent.count({ where: { bomId: bom2.id } })) === 0) {
    await prisma.bOMComponent.createMany({ data: [
      { bomId: bom2.id, materialId: matMap["MAT-001"].id, quantity: 3, position: 10 },
      { bomId: bom2.id, materialId: matMap["MAT-002"].id, quantity: 2, position: 20 },
      { bomId: bom2.id, materialId: matMap["MAT-003"].id, quantity: 1, position: 30 },
      { bomId: bom2.id, materialId: matMap["MAT-006"].id, quantity: 2, position: 40 },
    ]});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 9. ROUTINGS
  // ═══════════════════════════════════════════════════════════════════

  if ((await prisma.routing.count({ where: { bomId: bom1.id } })) === 0) {
    await prisma.routing.createMany({ data: [
      { bomId: bom1.id, stepNo: 10, workCenter: "WC-MILL", operation: "CUT_STEEL", description: "Cut Steel Sheets to Size", setupTime: 0.5, runTime: 0.1, laborRate: 35, machineRate: 75 },
      { bomId: bom1.id, stepNo: 20, workCenter: "WC-ASSY", operation: "ASSEMBLE", description: "Assemble Components", setupTime: 0.25, runTime: 0.2, laborRate: 25, machineRate: 45 },
      { bomId: bom1.id, stepNo: 30, workCenter: "WC-TEST", operation: "QA_CHECK", description: "Quality Check", setupTime: 0, runTime: 0.05, laborRate: 30, machineRate: 55 },
      { bomId: bom1.id, stepNo: 40, workCenter: "WC-PACK", operation: "PACKAGE", description: "Package Finished Product", setupTime: 0, runTime: 0.02, laborRate: 20, machineRate: 30 },
    ]});
  }

  if ((await prisma.routing.count({ where: { bomId: bom2.id } })) === 0) {
    await prisma.routing.createMany({ data: [
      { bomId: bom2.id, stepNo: 10, workCenter: "WC-MILL", operation: "CUT_STEEL", description: "Cut Steel Sheets to Size", setupTime: 0.5, runTime: 0.15, laborRate: 35, machineRate: 75 },
      { bomId: bom2.id, stepNo: 20, workCenter: "WC-LATHE", operation: "PRECISION_TURN", description: "Precision Turning", setupTime: 0.3, runTime: 0.12, laborRate: 35, machineRate: 65 },
      { bomId: bom2.id, stepNo: 30, workCenter: "WC-ASSY", operation: "COMPLEX_ASSY", description: "Complex Assembly", setupTime: 0.5, runTime: 0.35, laborRate: 25, machineRate: 45 },
      { bomId: bom2.id, stepNo: 40, workCenter: "WC-TEST", operation: "FULL_QA", description: "Full QA Inspection", setupTime: 0.1, runTime: 0.1, laborRate: 30, machineRate: 55 },
      { bomId: bom2.id, stepNo: 50, workCenter: "WC-PACK", operation: "PREMIUM_PACK", description: "Premium Packaging", setupTime: 0, runTime: 0.05, laborRate: 20, machineRate: 30 },
    ]});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 10. PRODUCTION ORDERS
  // ═══════════════════════════════════════════════════════════════════

  const prd1 = await prisma.productionOrder.upsert({
    where: { tenantId_orderNumber: { tenantId: tenant.id, orderNumber: "PRD-0001" } },
    update: {},
    create: {
      tenantId: tenant.id, orderNumber: "PRD-0001", materialId: matMap["MAT-004"].id,
      quantity: 100, plannedStart: new Date("2026-03-01"), plannedEnd: new Date("2026-03-05"),
      actualStart: new Date("2026-03-01"), status: "in_progress", priority: 3, createdBy: adminUser.id,
    },
  });

  const prd2 = await prisma.productionOrder.upsert({
    where: { tenantId_orderNumber: { tenantId: tenant.id, orderNumber: "PRD-0002" } },
    update: {},
    create: {
      tenantId: tenant.id, orderNumber: "PRD-0002", materialId: matMap["MAT-007"].id,
      quantity: 50, plannedStart: new Date("2026-03-10"), plannedEnd: new Date("2026-03-18"),
      status: "planned", priority: 5, createdBy: adminUser.id,
    },
  });

  const prd3 = await prisma.productionOrder.upsert({
    where: { tenantId_orderNumber: { tenantId: tenant.id, orderNumber: "PRD-0003" } },
    update: {},
    create: {
      tenantId: tenant.id, orderNumber: "PRD-0003", materialId: matMap["MAT-004"].id,
      quantity: 200, plannedStart: new Date("2026-03-20"), plannedEnd: new Date("2026-03-28"),
      status: "released", priority: 4, createdBy: adminUser.id,
    },
  });

  // ═══════════════════════════════════════════════════════════════════
  // 11. PRODUCTION SCHEDULES (for PRD-0001)
  // ═══════════════════════════════════════════════════════════════════

  const existingSchedules = await prisma.productionSchedule.count({
    where: { tenantId: tenant.id, productionOrderId: prd1.id },
  });
  if (existingSchedules === 0) {
    await prisma.productionSchedule.createMany({ data: [
      {
        tenantId: tenant.id, productionOrderId: prd1.id, workCenterId: wcMap["WC-MILL"].id,
        operation: "Cut Steel Sheets", setupTime: 0.5, runTime: 10,
        plannedStart: new Date("2026-03-01T06:00:00"), plannedEnd: new Date("2026-03-02T08:30:00"),
        actualStart: new Date("2026-03-01T06:15:00"), status: "completed", sequence: 10,
      },
      {
        tenantId: tenant.id, productionOrderId: prd1.id, workCenterId: wcMap["WC-ASSY"].id,
        operation: "Assemble Components", setupTime: 0.25, runTime: 20,
        plannedStart: new Date("2026-03-02T09:00:00"), plannedEnd: new Date("2026-03-04T05:15:00"),
        actualStart: new Date("2026-03-02T09:00:00"), status: "in_progress", sequence: 20,
      },
      {
        tenantId: tenant.id, productionOrderId: prd1.id, workCenterId: wcMap["WC-TEST"].id,
        operation: "Quality Check", setupTime: 0, runTime: 5,
        plannedStart: new Date("2026-03-04T06:00:00"), plannedEnd: new Date("2026-03-04T11:00:00"),
        status: "scheduled", sequence: 30,
      },
      {
        tenantId: tenant.id, productionOrderId: prd1.id, workCenterId: wcMap["WC-PACK"].id,
        operation: "Package Finished Product", setupTime: 0, runTime: 2,
        plannedStart: new Date("2026-03-04T11:00:00"), plannedEnd: new Date("2026-03-04T13:00:00"),
        status: "scheduled", sequence: 40,
      },
    ]});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 12. INSPECTION LOTS
  // ═══════════════════════════════════════════════════════════════════

  const il1 = await prisma.inspectionLot.upsert({
    where: { tenantId_lotNumber: { tenantId: tenant.id, lotNumber: "IL-0001" } },
    update: {},
    create: {
      tenantId: tenant.id, lotNumber: "IL-0001", materialId: matMap["MAT-001"].id,
      quantity: 200, origin: "goods_receipt", referenceDoc: "GR-0001",
      status: "accepted", inspectedQty: 200, defectiveQty: 2,
      inspectedBy: empMap["EMP-007"]?.id || adminUser.id,
      inspectedAt: new Date("2026-03-01"),
    },
  });
  if ((await prisma.inspectionResult.count({ where: { inspectionLotId: il1.id } })) === 0) {
    await prisma.inspectionResult.createMany({ data: [
      { inspectionLotId: il1.id, characteristic: "Thickness", specification: "4.0mm +/- 0.1mm", measuredValue: "4.02mm", result: "pass", inspectedBy: empMap["EMP-007"]?.id || adminUser.id },
      { inspectionLotId: il1.id, characteristic: "Surface Finish", specification: "Ra <= 1.6", measuredValue: "Ra 1.2", result: "pass", inspectedBy: empMap["EMP-007"]?.id || adminUser.id },
    ]});
  }

  const il2 = await prisma.inspectionLot.upsert({
    where: { tenantId_lotNumber: { tenantId: tenant.id, lotNumber: "IL-0002" } },
    update: {},
    create: {
      tenantId: tenant.id, lotNumber: "IL-0002", materialId: matMap["MAT-006"].id,
      quantity: 300, origin: "goods_receipt", referenceDoc: "GR-0002",
      status: "in_inspection", inspectedQty: 150, defectiveQty: 8,
    },
  });
  if ((await prisma.inspectionResult.count({ where: { inspectionLotId: il2.id } })) === 0) {
    await prisma.inspectionResult.createMany({ data: [
      { inspectionLotId: il2.id, characteristic: "Voltage Output", specification: "3.3V +/- 0.05V", measuredValue: "3.28V", result: "pass", inspectedBy: empMap["EMP-007"]?.id || adminUser.id },
      { inspectionLotId: il2.id, characteristic: "Response Time", specification: "<= 10ms", measuredValue: "12ms", result: "fail", notes: "8 units exceed response time spec", inspectedBy: empMap["EMP-007"]?.id || adminUser.id },
    ]});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 13. WORK ORDERS / MAINTENANCE
  // ═══════════════════════════════════════════════════════════════════

  await prisma.workOrder.upsert({
    where: { tenantId_woNumber: { tenantId: tenant.id, woNumber: "WO-0001" } },
    update: {},
    create: {
      tenantId: tenant.id, woNumber: "WO-0001", equipmentId: eqMap["EQ-001"].id,
      type: "preventive", priority: "high", description: "Scheduled preventive maintenance - CNC Mill spindle inspection and lubrication",
      status: "completed", plannedStart: new Date("2026-02-20"), plannedEnd: new Date("2026-02-21"),
      actualStart: new Date("2026-02-20"), actualEnd: new Date("2026-02-21"),
      estimatedHours: 8, actualHours: 7.5, estimatedCost: 1200, actualCost: 1100,
      assignedTo: empMap["EMP-001"]?.id, createdBy: adminUser.id,
    },
  });

  await prisma.workOrder.upsert({
    where: { tenantId_woNumber: { tenantId: tenant.id, woNumber: "WO-0002" } },
    update: {},
    create: {
      tenantId: tenant.id, woNumber: "WO-0002", equipmentId: eqMap["EQ-002"].id,
      type: "corrective", priority: "urgent", description: "Hydraulic pressure loss detected - replace seals and check pump",
      status: "in_progress", plannedStart: new Date("2026-03-07"), plannedEnd: new Date("2026-03-09"),
      actualStart: new Date("2026-03-07"), estimatedHours: 16, estimatedCost: 3500,
      assignedTo: empMap["EMP-009"]?.id, createdBy: adminUser.id,
    },
  });

  await prisma.workOrder.upsert({
    where: { tenantId_woNumber: { tenantId: tenant.id, woNumber: "WO-0003" } },
    update: {},
    create: {
      tenantId: tenant.id, woNumber: "WO-0003", equipmentId: eqMap["EQ-003"].id,
      type: "inspection", priority: "medium", description: "Annual safety inspection - forklift brakes, mast, and hydraulics",
      status: "open", plannedStart: new Date("2026-03-15"), plannedEnd: new Date("2026-03-15"),
      estimatedHours: 4, estimatedCost: 500,
      assignedTo: empMap["EMP-005"]?.id, createdBy: adminUser.id,
    },
  });

  // ═══════════════════════════════════════════════════════════════════
  // 14. MAINTENANCE PLANS
  // ═══════════════════════════════════════════════════════════════════

  const existingMP1 = await prisma.maintenancePlan.findFirst({ where: { equipmentId: eqMap["EQ-001"].id, name: "CNC Mill Preventive Maintenance" } });
  if (!existingMP1) {
    await prisma.maintenancePlan.create({ data: {
      equipmentId: eqMap["EQ-001"].id, name: "CNC Mill Preventive Maintenance",
      type: "time_based", intervalDays: 30, lastExecuted: new Date("2026-02-21"),
      nextDue: new Date("2026-03-23"), isActive: true,
    }});
  }

  const existingMP2 = await prisma.maintenancePlan.findFirst({ where: { equipmentId: eqMap["EQ-002"].id, name: "Hydraulic Press Counter-Based Service" } });
  if (!existingMP2) {
    await prisma.maintenancePlan.create({ data: {
      equipmentId: eqMap["EQ-002"].id, name: "Hydraulic Press Counter-Based Service",
      type: "counter_based", intervalHours: 500, lastExecuted: new Date("2026-01-15"),
      nextDue: new Date("2026-04-15"), isActive: true,
    }});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 15. LEAVE REQUESTS
  // ═══════════════════════════════════════════════════════════════════

  const existingLeave1 = await prisma.leaveRequest.findFirst({ where: { employeeId: empMap["EMP-001"].id, startDate: new Date("2026-03-16") } });
  if (!existingLeave1) {
    await prisma.leaveRequest.create({ data: {
      employeeId: empMap["EMP-001"].id, leaveType: "annual", startDate: new Date("2026-03-16"),
      endDate: new Date("2026-03-20"), days: 5, status: "approved", reason: "Family vacation",
      approvedBy: adminUser.id, approvedAt: new Date("2026-03-01"),
    }});
  }

  const existingLeave2 = await prisma.leaveRequest.findFirst({ where: { employeeId: empMap["EMP-003"].id, startDate: new Date("2026-03-06") } });
  if (!existingLeave2) {
    await prisma.leaveRequest.create({ data: {
      employeeId: empMap["EMP-003"].id, leaveType: "sick", startDate: new Date("2026-03-06"),
      endDate: new Date("2026-03-07"), days: 2, status: "approved", reason: "Flu",
      approvedBy: adminUser.id, approvedAt: new Date("2026-03-06"),
    }});
  }

  const existingLeave3 = await prisma.leaveRequest.findFirst({ where: { employeeId: empMap["EMP-004"].id, startDate: new Date("2026-03-12") } });
  if (!existingLeave3) {
    await prisma.leaveRequest.create({ data: {
      employeeId: empMap["EMP-004"].id, leaveType: "personal", startDate: new Date("2026-03-12"),
      endDate: new Date("2026-03-12"), days: 1, status: "pending", reason: "Personal appointment",
    }});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 16. TIME ENTRIES
  // ═══════════════════════════════════════════════════════════════════

  const timeEntryData = [
    { employeeId: empMap["EMP-001"].id, date: new Date("2026-03-03"), hoursWorked: 8, overtime: 1.5, project: "PRD-0001", activity: "Production supervision", status: "approved" },
    { employeeId: empMap["EMP-002"].id, date: new Date("2026-03-03"), hoursWorked: 8, overtime: 0, project: "FIN-CLOSE", activity: "Month-end closing", status: "approved" },
    { employeeId: empMap["EMP-005"].id, date: new Date("2026-03-03"), hoursWorked: 8, overtime: 2, project: "WH-RECV", activity: "Goods receipt processing", status: "approved" },
    { employeeId: empMap["EMP-009"].id, date: new Date("2026-03-04"), hoursWorked: 8, overtime: 0, project: "ENG-OPT", activity: "Process optimization study", status: "submitted" },
    { employeeId: empMap["EMP-010"].id, date: new Date("2026-03-04"), hoursWorked: 8, overtime: 0.5, project: "PROC-PO", activity: "PO processing and vendor follow-up", status: "draft" },
  ];
  for (const te of timeEntryData) {
    const existing = await prisma.timeEntry.findFirst({ where: { employeeId: te.employeeId, date: te.date } });
    if (!existing) {
      await prisma.timeEntry.create({ data: te });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 17. INTERNAL ORDERS
  // ═══════════════════════════════════════════════════════════════════

  await prisma.internalOrder.upsert({
    where: { tenantId_orderNumber: { tenantId: tenant.id, orderNumber: "IO-001" } },
    update: {},
    create: {
      tenantId: tenant.id, orderNumber: "IO-001", description: "Factory Floor Overhead Allocation",
      type: "overhead", status: "released", budget: 50000, actualCost: 32000,
      responsiblePerson: empMap["EMP-001"]?.id,
      validFrom: new Date("2026-01-01"), validTo: new Date("2026-12-31"),
    },
  });

  await prisma.internalOrder.upsert({
    where: { tenantId_orderNumber: { tenantId: tenant.id, orderNumber: "IO-002" } },
    update: {},
    create: {
      tenantId: tenant.id, orderNumber: "IO-002", description: "New Assembly Line Installation",
      type: "investment", status: "open", budget: 150000, actualCost: 0,
      responsiblePerson: empMap["EMP-009"]?.id,
      validFrom: new Date("2026-04-01"), validTo: new Date("2026-12-31"),
    },
  });

  // ═══════════════════════════════════════════════════════════════════
  // 18. ORG UNITS
  // ═══════════════════════════════════════════════════════════════════

  const orgUnitData = [
    { code: "OU-MFG", name: "Manufacturing" },
    { code: "OU-FIN", name: "Finance & Admin" },
    { code: "OU-SAL", name: "Sales & Marketing" },
    { code: "OU-ENG", name: "Engineering" },
  ];
  for (const ou of orgUnitData) {
    const existing = await prisma.orgUnit.findFirst({ where: { code: ou.code } });
    if (!existing) {
      await prisma.orgUnit.create({ data: ou });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 19. INVENTORY MOVEMENTS
  // ═══════════════════════════════════════════════════════════════════

  const invMovements = [
    { materialId: matMap["MAT-001"].id, movementType: "receipt", quantity: 200, toLocation: "WH01-A-01-01", reference: "GR-0001", reason: "PO-0000001 receipt", createdBy: adminUser.id },
    { materialId: matMap["MAT-003"].id, movementType: "receipt", quantity: 100, toLocation: "WH01-A-02-01", reference: "GR-0001", reason: "PO-0000001 receipt", createdBy: adminUser.id },
    { materialId: matMap["MAT-004"].id, movementType: "issue", quantity: 50, fromLocation: "WH01-A-01-01", reference: "SO-0000001", reason: "Sales order delivery", createdBy: adminUser.id },
    { materialId: matMap["MAT-001"].id, movementType: "transfer", quantity: 50, fromLocation: "WH01-A-01-01", toLocation: "WH01-A-01-02", reason: "Bin consolidation", createdBy: adminUser.id },
    { materialId: matMap["MAT-008"].id, movementType: "adjustment", quantity: -5, fromLocation: "WH01-B-01-01", reason: "Cycle count adjustment", createdBy: adminUser.id },
    { materialId: matMap["MAT-002"].id, movementType: "scrap", quantity: 15, fromLocation: "WH01-B-02-01", reason: "Damaged during handling", createdBy: adminUser.id },
  ];
  const existingMovCount = await prisma.inventoryMovement.count({ where: { materialId: matMap["MAT-001"].id } });
  if (existingMovCount === 0) {
    for (const mv of invMovements) {
      await prisma.inventoryMovement.create({ data: mv });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 20. MRP RUNS + PLANNED ORDERS
  // ═══════════════════════════════════════════════════════════════════

  const mrp1 = await prisma.mrpRun.upsert({
    where: { tenantId_runNumber: { tenantId: tenant.id, runNumber: "MRP-001" } },
    update: {},
    create: {
      tenantId: tenant.id, runNumber: "MRP-001", runDate: new Date("2026-03-01"),
      planningHorizonDays: 90, status: "completed", createdBy: adminUser.id,
      parameters: JSON.stringify({ includedMaterials: "all", planningStrategy: "MRP", lotSizing: "EOQ" }),
      results: JSON.stringify({ plannedOrders: 3, shortages: 1, totalRequirements: 15 }),
    },
  });

  const mrp2 = await prisma.mrpRun.upsert({
    where: { tenantId_runNumber: { tenantId: tenant.id, runNumber: "MRP-002" } },
    update: {},
    create: {
      tenantId: tenant.id, runNumber: "MRP-002", runDate: new Date("2026-03-08"),
      planningHorizonDays: 60, status: "completed", createdBy: adminUser.id,
      parameters: JSON.stringify({ includedMaterials: ["MAT-004", "MAT-007"], planningStrategy: "MRP", lotSizing: "fixed" }),
      results: JSON.stringify({ plannedOrders: 1, shortages: 0, totalRequirements: 8 }),
    },
  });

  const existingPlannedOrders = await prisma.plannedOrder.count({ where: { tenantId: tenant.id, mrpRunId: mrp1.id } });
  if (existingPlannedOrders === 0) {
    await prisma.plannedOrder.createMany({ data: [
      { tenantId: tenant.id, mrpRunId: mrp1.id, materialId: matMap["MAT-001"].id, orderType: "purchase", quantity: 500, plannedDate: new Date("2026-03-15"), dueDate: new Date("2026-03-22"), status: "planned" },
      { tenantId: tenant.id, mrpRunId: mrp1.id, materialId: matMap["MAT-002"].id, orderType: "purchase", quantity: 300, plannedDate: new Date("2026-03-18"), dueDate: new Date("2026-03-25"), status: "planned" },
      { tenantId: tenant.id, mrpRunId: mrp1.id, materialId: matMap["MAT-004"].id, orderType: "production", quantity: 200, plannedDate: new Date("2026-03-20"), dueDate: new Date("2026-03-28"), status: "firmed" },
    ]});
  }
  const existingPlannedOrders2 = await prisma.plannedOrder.count({ where: { tenantId: tenant.id, mrpRunId: mrp2.id } });
  if (existingPlannedOrders2 === 0) {
    await prisma.plannedOrder.createMany({ data: [
      { tenantId: tenant.id, mrpRunId: mrp2.id, materialId: matMap["MAT-007"].id, orderType: "production", quantity: 100, plannedDate: new Date("2026-04-01"), dueDate: new Date("2026-04-10"), status: "planned" },
    ]});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 21. DEMAND FORECASTS
  // ═══════════════════════════════════════════════════════════════════

  const forecastData = [
    { materialId: matMap["MAT-004"].id, periodStart: new Date("2026-03-01"), periodEnd: new Date("2026-03-31"), forecastQty: 350, actualQty: 200, method: "moving_avg", confidence: 0.85 },
    { materialId: matMap["MAT-004"].id, periodStart: new Date("2026-04-01"), periodEnd: new Date("2026-04-30"), forecastQty: 400, method: "moving_avg", confidence: 0.80 },
    { materialId: matMap["MAT-007"].id, periodStart: new Date("2026-03-01"), periodEnd: new Date("2026-03-31"), forecastQty: 120, actualQty: 50, method: "exponential", confidence: 0.78 },
    { materialId: matMap["MAT-007"].id, periodStart: new Date("2026-04-01"), periodEnd: new Date("2026-04-30"), forecastQty: 150, method: "exponential", confidence: 0.75 },
  ];
  for (const fc of forecastData) {
    const existing = await prisma.demandForecast.findFirst({
      where: { tenantId: tenant.id, materialId: fc.materialId, periodStart: fc.periodStart },
    });
    if (!existing) {
      await prisma.demandForecast.create({ data: { tenantId: tenant.id, ...fc, createdBy: adminUser.id } });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 22. SUPPLY CHAIN NODES + LINKS
  // ═══════════════════════════════════════════════════════════════════

  const nodeData = [
    { name: "Supplier A - Steel", type: "supplier", latitude: 41.8781, longitude: -87.6298, capacity: 5000, holdingCost: 0, fixedCost: 0, address: "Chicago, IL" },
    { name: "Supplier B - Electronics", type: "supplier", latitude: 37.7749, longitude: -122.4194, capacity: 3000, holdingCost: 0, fixedCost: 0, address: "San Francisco, CA" },
    { name: "Main Factory", type: "factory", latitude: 39.7684, longitude: -86.1581, capacity: 2000, holdingCost: 0.50, fixedCost: 25000, address: "Indianapolis, IN" },
    { name: "Warehouse North", type: "warehouse", latitude: 42.3314, longitude: -83.0458, capacity: 10000, holdingCost: 0.25, fixedCost: 8000, address: "Detroit, MI" },
    { name: "Warehouse South", type: "warehouse", latitude: 33.749, longitude: -84.388, capacity: 8000, holdingCost: 0.20, fixedCost: 6000, address: "Atlanta, GA" },
    { name: "Customer Hub East", type: "distribution_center", latitude: 40.7128, longitude: -74.006, capacity: 15000, holdingCost: 0.30, fixedCost: 12000, address: "New York, NY" },
  ];
  const scNodes: Record<string, any> = {};
  for (const nd of nodeData) {
    let existing = await prisma.supplyChainNode.findFirst({ where: { tenantId: tenant.id, name: nd.name } });
    if (!existing) {
      existing = await prisma.supplyChainNode.create({ data: { tenantId: tenant.id, ...nd } });
    }
    scNodes[nd.name] = existing;
  }

  const linkData = [
    { from: "Supplier A - Steel", to: "Main Factory", transportMode: "truck", distance: 180, costPerUnit: 2.50, leadTimeDays: 3 },
    { from: "Supplier B - Electronics", to: "Main Factory", transportMode: "air", distance: 2000, costPerUnit: 8.00, leadTimeDays: 2 },
    { from: "Main Factory", to: "Warehouse North", transportMode: "truck", distance: 290, costPerUnit: 1.50, leadTimeDays: 2 },
    { from: "Main Factory", to: "Warehouse South", transportMode: "truck", distance: 500, costPerUnit: 2.00, leadTimeDays: 3 },
    { from: "Warehouse North", to: "Customer Hub East", transportMode: "truck", distance: 610, costPerUnit: 3.00, leadTimeDays: 2 },
    { from: "Warehouse South", to: "Customer Hub East", transportMode: "truck", distance: 880, costPerUnit: 3.50, leadTimeDays: 3 },
    { from: "Supplier A - Steel", to: "Warehouse North", transportMode: "rail", distance: 280, costPerUnit: 1.00, leadTimeDays: 5 },
  ];
  for (const lk of linkData) {
    const from = scNodes[lk.from];
    const to = scNodes[lk.to];
    if (from && to) {
      const existing = await prisma.supplyChainLink.findFirst({
        where: { tenantId: tenant.id, fromNodeId: from.id, toNodeId: to.id },
      });
      if (!existing) {
        await prisma.supplyChainLink.create({ data: {
          tenantId: tenant.id, fromNodeId: from.id, toNodeId: to.id,
          transportMode: lk.transportMode, distance: lk.distance,
          costPerUnit: lk.costPerUnit, leadTimeDays: lk.leadTimeDays,
        }});
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 23. PROCESS EVENTS (P2P + O2C cases)
  // ═══════════════════════════════════════════════════════════════════

  const processEventData = [
    { caseId: "P2P-001", activity: "PO Created", timestamp: new Date("2026-02-15T09:00:00"), resource: "Admin User", module: "materials", documentId: "PO-0000001", duration: 0 },
    { caseId: "P2P-001", activity: "PO Approved", timestamp: new Date("2026-02-16T10:30:00"), resource: "Admin User", module: "materials", documentId: "PO-0000001", duration: 91800 },
    { caseId: "P2P-001", activity: "GR Posted", timestamp: new Date("2026-03-01T14:00:00"), resource: "David Martinez", module: "materials", documentId: "GR-0001", duration: 1130600 },
    { caseId: "P2P-001", activity: "Invoice Received", timestamp: new Date("2026-03-03T09:00:00"), resource: "Sarah Johnson", module: "finance", documentId: "SI-0001", duration: 154800 },
    { caseId: "P2P-001", activity: "Invoice Matched", timestamp: new Date("2026-03-03T11:00:00"), resource: "Sarah Johnson", module: "finance", documentId: "SI-0001", duration: 7200 },
    { caseId: "P2P-001", activity: "Payment Made", timestamp: new Date("2026-03-05T15:00:00"), resource: "Admin User", module: "finance", documentId: "PAY-OUT-001", duration: 187200 },
    { caseId: "O2C-001", activity: "SO Created", timestamp: new Date("2026-02-10T08:00:00"), resource: "Mike Williams", module: "sales", documentId: "SO-0000001", duration: 0 },
    { caseId: "O2C-001", activity: "SO Confirmed", timestamp: new Date("2026-02-10T14:00:00"), resource: "Admin User", module: "sales", documentId: "SO-0000001", duration: 21600 },
    { caseId: "O2C-001", activity: "Delivery Created", timestamp: new Date("2026-02-24T09:00:00"), resource: "David Martinez", module: "sales", documentId: "DEL-0001", duration: 1209600 },
    { caseId: "O2C-001", activity: "Goods Issued", timestamp: new Date("2026-02-25T07:00:00"), resource: "David Martinez", module: "warehouse", documentId: "DEL-0001", duration: 79200 },
    { caseId: "O2C-001", activity: "Invoice Sent", timestamp: new Date("2026-02-26T10:00:00"), resource: "Sarah Johnson", module: "sales", documentId: "INV-0001", duration: 97200 },
    { caseId: "O2C-001", activity: "Payment Received", timestamp: new Date("2026-03-05T16:00:00"), resource: "Sarah Johnson", module: "finance", documentId: "PAY-IN-001", duration: 626400 },
  ];
  const existingPE = await prisma.processEvent.count({ where: { tenantId: tenant.id, caseId: "P2P-001" } });
  if (existingPE === 0) {
    for (const pe of processEventData) {
      await prisma.processEvent.create({ data: { tenantId: tenant.id, ...pe } });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 24. INVENTORY POLICIES
  // ═══════════════════════════════════════════════════════════════════

  await prisma.inventoryPolicy.upsert({
    where: { tenantId_materialId: { tenantId: tenant.id, materialId: matMap["MAT-001"].id } },
    update: {},
    create: {
      tenantId: tenant.id, materialId: matMap["MAT-001"].id, policyType: "eoq", abcClass: "A",
      orderQuantity: 250, reorderPoint: 100, safetyStock: 50, annualDemand: 2400,
      orderingCost: 75, holdingCostPct: 0.25, serviceLevelPct: 0.95,
      calculatedEOQ: 240, calculatedROP: 110, lastCalculated: new Date("2026-03-01"),
    },
  });

  await prisma.inventoryPolicy.upsert({
    where: { tenantId_materialId: { tenantId: tenant.id, materialId: matMap["MAT-002"].id } },
    update: {},
    create: {
      tenantId: tenant.id, materialId: matMap["MAT-002"].id, policyType: "rop", abcClass: "A",
      reorderPoint: 200, safetyStock: 80, annualDemand: 3600,
      orderingCost: 50, holdingCostPct: 0.20, serviceLevelPct: 0.98,
      calculatedROP: 215, lastCalculated: new Date("2026-03-01"),
    },
  });

  await prisma.inventoryPolicy.upsert({
    where: { tenantId_materialId: { tenantId: tenant.id, materialId: matMap["MAT-005"].id } },
    update: {},
    create: {
      tenantId: tenant.id, materialId: matMap["MAT-005"].id, policyType: "min_max", abcClass: "C",
      minStock: 500, maxStock: 3000, safetyStock: 200, annualDemand: 8000,
      holdingCostPct: 0.15, lastCalculated: new Date("2026-03-01"),
    },
  });

  await prisma.inventoryPolicy.upsert({
    where: { tenantId_materialId: { tenantId: tenant.id, materialId: matMap["MAT-004"].id } },
    update: {},
    create: {
      tenantId: tenant.id, materialId: matMap["MAT-004"].id, policyType: "periodic", abcClass: "A",
      reviewPeriodDays: 7, safetyStock: 30, annualDemand: 4200,
      orderingCost: 100, holdingCostPct: 0.30, serviceLevelPct: 0.97,
      lastCalculated: new Date("2026-03-01"),
    },
  });

  // ═══════════════════════════════════════════════════════════════════
  // 25. OPERATIONS METRICS
  // ═══════════════════════════════════════════════════════════════════

  const metricsData = [
    { metricType: "oee", workCenterId: wcMap["WC-MILL"].id, value: 87.5, target: 90, unit: "percent" },
    { metricType: "oee", workCenterId: wcMap["WC-LATHE"].id, value: 82, target: 85, unit: "percent" },
    { metricType: "oee", workCenterId: wcMap["WC-ASSY"].id, value: 78, target: 85, unit: "percent" },
    { metricType: "oee", workCenterId: wcMap["WC-TEST"].id, value: 95, target: 95, unit: "percent" },
    { metricType: "throughput", value: 450, target: 500, unit: "units/day" },
    { metricType: "cycle_time", value: 0.37, target: 0.35, unit: "hours/unit" },
    { metricType: "inventory_turnover", value: 8.5, target: 10, unit: "turns/year" },
    { metricType: "fill_rate", value: 96.5, target: 98, unit: "percent" },
  ];
  const existingMetrics = await prisma.operationsMetric.count({ where: { tenantId: tenant.id } });
  if (existingMetrics === 0) {
    for (const mt of metricsData) {
      await prisma.operationsMetric.create({ data: {
        tenantId: tenant.id,
        metricType: mt.metricType,
        workCenterId: mt.workCenterId || null,
        periodStart: new Date("2026-03-01"),
        periodEnd: new Date("2026-03-31"),
        value: mt.value,
        target: mt.target,
        unit: mt.unit,
      }});
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 26. USER XP
  // ═══════════════════════════════════════════════════════════════════

  await prisma.userXP.upsert({
    where: { userId_tenantId: { userId: adminUser.id, tenantId: tenant.id } },
    update: {},
    create: { userId: adminUser.id, tenantId: tenant.id, totalXP: 500, level: 3, streak: 12 },
  });

  await prisma.userXP.upsert({
    where: { userId_tenantId: { userId: instructorUser.id, tenantId: tenant.id } },
    update: {},
    create: { userId: instructorUser.id, tenantId: tenant.id, totalXP: 200, level: 2, streak: 5 },
  });

  await prisma.userXP.upsert({
    where: { userId_tenantId: { userId: studentUser.id, tenantId: tenant.id } },
    update: {},
    create: { userId: studentUser.id, tenantId: tenant.id, totalXP: 1250, level: 5, streak: 21 },
  });

  // ═══════════════════════════════════════════════════════════════════
  // 27. USER ACHIEVEMENTS (for student user)
  // ═══════════════════════════════════════════════════════════════════

  const studentAchievementCodes = ["FIRST_LOGIN", "FIRST_PO", "FIRST_SO", "FIRST_JE"];
  for (const code of studentAchievementCodes) {
    const ach = await prisma.achievement.findUnique({ where: { code } });
    if (ach) {
      await prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId: studentUser.id, achievementId: ach.id } },
        update: {},
        create: { userId: studentUser.id, achievementId: ach.id },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 28. PURCHASE REQUISITIONS
  // ═══════════════════════════════════════════════════════════════════

  await prisma.purchaseRequisition.upsert({
    where: { tenantId_prNumber: { tenantId: tenant.id, prNumber: "PR-0000001" } },
    update: {},
    create: {
      tenantId: tenant.id, prNumber: "PR-0000001", materialId: matMap["MAT-001"].id,
      description: "Steel Sheets for Q2 production", quantity: 300, estimatedPrice: 45,
      requestedDate: new Date("2026-03-20"), vendorId: vendorMap["V-001"].id,
      status: "approved", requestedBy: empMap["EMP-010"]?.id || adminUser.id,
      approvedBy: adminUser.id, approvedAt: new Date("2026-03-06"),
    },
  });

  await prisma.purchaseRequisition.upsert({
    where: { tenantId_prNumber: { tenantId: tenant.id, prNumber: "PR-0000002" } },
    update: {},
    create: {
      tenantId: tenant.id, prNumber: "PR-0000002", materialId: matMap["MAT-006"].id,
      description: "Electronic Sensors for Widget B production", quantity: 200, estimatedPrice: 35,
      requestedDate: new Date("2026-03-25"), status: "open",
      requestedBy: empMap["EMP-009"]?.id || adminUser.id,
    },
  });

  await prisma.purchaseRequisition.upsert({
    where: { tenantId_prNumber: { tenantId: tenant.id, prNumber: "PR-0000003" } },
    update: {},
    create: {
      tenantId: tenant.id, prNumber: "PR-0000003", materialId: matMap["MAT-005"].id,
      description: "Packaging boxes for shipping backlog", quantity: 2000, estimatedPrice: 3.50,
      requestedDate: new Date("2026-03-10"), vendorId: vendorMap["V-004"].id,
      status: "converted", convertedPOId: po3.id,
      requestedBy: empMap["EMP-008"]?.id || adminUser.id,
      approvedBy: adminUser.id, approvedAt: new Date("2026-02-28"),
    },
  });

  // ═══════════════════════════════════════════════════════════════════
  // 29. SUPPLIER INVOICES
  // ═══════════════════════════════════════════════════════════════════

  await prisma.supplierInvoice.upsert({
    where: { tenantId_invoiceNumber: { tenantId: tenant.id, invoiceNumber: "SI-0001" } },
    update: {},
    create: {
      tenantId: tenant.id, invoiceNumber: "SI-0001", vendorId: vendorMap["V-001"].id,
      poId: po1.id, invoiceDate: new Date("2026-03-03"), dueDate: new Date("2026-04-02"),
      grossAmount: 12900, taxAmount: 0, netAmount: 12900,
      status: "matched", matchStatus: "3way_matched",
      poAmount: 12900, grAmount: 12900, variance: 0,
      createdBy: adminUser.id,
    },
  });

  await prisma.supplierInvoice.upsert({
    where: { tenantId_invoiceNumber: { tenantId: tenant.id, invoiceNumber: "SI-0002" } },
    update: {},
    create: {
      tenantId: tenant.id, invoiceNumber: "SI-0002", vendorId: vendorMap["V-002"].id,
      invoiceDate: new Date("2026-03-08"), dueDate: new Date("2026-04-22"),
      grossAmount: 16750, taxAmount: 0, netAmount: 16750,
      status: "pending", matchStatus: "unmatched",
      createdBy: adminUser.id,
    },
  });

  // ═══════════════════════════════════════════════════════════════════
  // 30. PAYMENTS
  // ═══════════════════════════════════════════════════════════════════

  await prisma.payment.upsert({
    where: { tenantId_paymentNumber: { tenantId: tenant.id, paymentNumber: "PAY-OUT-001" } },
    update: {},
    create: {
      tenantId: tenant.id, paymentNumber: "PAY-OUT-001", type: "outgoing",
      vendorId: vendorMap["V-001"].id, invoiceRef: "SI-0001",
      amount: 12900, paymentMethod: "bank_transfer", paymentDate: new Date("2026-03-05"),
      bankAccount: "ACCT-1001", reference: "Wire Ref 2026-0305-001", status: "completed",
      createdBy: adminUser.id,
    },
  });

  await prisma.payment.upsert({
    where: { tenantId_paymentNumber: { tenantId: tenant.id, paymentNumber: "PAY-IN-001" } },
    update: {},
    create: {
      tenantId: tenant.id, paymentNumber: "PAY-IN-001", type: "incoming",
      customerId: custMap["C-001"].id, invoiceRef: "INV-0001",
      amount: 7499.30, paymentMethod: "bank_transfer", paymentDate: new Date("2026-03-05"),
      reference: "ACH Deposit C-001", status: "completed",
      createdBy: adminUser.id,
    },
  });

  await prisma.payment.upsert({
    where: { tenantId_paymentNumber: { tenantId: tenant.id, paymentNumber: "PAY-IN-002" } },
    update: {},
    create: {
      tenantId: tenant.id, paymentNumber: "PAY-IN-002", type: "incoming",
      customerId: custMap["C-002"].id, invoiceRef: "INV-0002",
      amount: 5000, paymentMethod: "bank_transfer", paymentDate: new Date("2026-03-09"),
      reference: "Partial payment C-002", status: "completed", notes: "Partial payment - balance $5,749 outstanding",
      createdBy: adminUser.id,
    },
  });

  // ═══════════════════════════════════════════════════════════════════
  // 31. SHIPMENTS
  // ═══════════════════════════════════════════════════════════════════

  await prisma.shipment.upsert({
    where: { tenantId_shipmentNumber: { tenantId: tenant.id, shipmentNumber: "SHP-0000001" } },
    update: {},
    create: {
      tenantId: tenant.id, shipmentNumber: "SHP-0000001", type: "outbound",
      carrier: "FedEx", mode: "truck", originAddress: "123 Industrial Ave, Manufacturing City, MC 12345",
      destAddress: "456 Commerce St, Acme City, AC 67890",
      referenceDoc: "SO-0000001", referenceType: "sales_order",
      weight: 450, freightCost: 250, insuranceCost: 50,
      status: "delivered", plannedDate: new Date("2026-02-24"), actualDate: new Date("2026-02-25"),
      trackingNumber: "FDX-9876543210", createdBy: adminUser.id,
    },
  });

  await prisma.shipment.upsert({
    where: { tenantId_shipmentNumber: { tenantId: tenant.id, shipmentNumber: "SHP-0000002" } },
    update: {},
    create: {
      tenantId: tenant.id, shipmentNumber: "SHP-0000002", type: "inbound",
      carrier: "DHL", mode: "air", originAddress: "789 Supply Rd, San Francisco, CA 94105",
      destAddress: "123 Industrial Ave, Manufacturing City, MC 12345",
      referenceDoc: "PO-0000002", referenceType: "purchase_order",
      weight: 120, freightCost: 800, insuranceCost: 200,
      status: "in_transit", plannedDate: new Date("2026-03-10"),
      trackingNumber: "DHL-5432109876", createdBy: adminUser.id,
    },
  });

  await prisma.shipment.upsert({
    where: { tenantId_shipmentNumber: { tenantId: tenant.id, shipmentNumber: "SHP-0000003" } },
    update: {},
    create: {
      tenantId: tenant.id, shipmentNumber: "SHP-0000003", type: "outbound",
      carrier: "UPS", mode: "courier", originAddress: "123 Industrial Ave, Manufacturing City, MC 12345",
      destAddress: "321 Export Blvd, New York, NY 10001",
      referenceDoc: "SO-0000003", referenceType: "sales_order",
      weight: 85, freightCost: 150, insuranceCost: 30,
      status: "planned", plannedDate: new Date("2026-03-18"),
      createdBy: adminUser.id,
    },
  });

  // ═══════════════════════════════════════════════════════════════════
  // 32. COST ESTIMATES
  // ═══════════════════════════════════════════════════════════════════

  const existingCE1 = await prisma.costEstimate.findFirst({ where: { tenantId: tenant.id, materialId: matMap["MAT-004"].id } });
  if (!existingCE1) {
    await prisma.costEstimate.create({ data: {
      tenantId: tenant.id, materialId: matMap["MAT-004"].id,
      materialCost: 92.50, laborCost: 28.50, overheadCost: 9.98, totalCost: 130.98,
      costPerUnit: 130.98, quantity: 1, status: "released",
      breakdown: JSON.stringify({
        materials: [
          { material: "MAT-001", qty: 2, cost: 90 },
          { material: "MAT-002", qty: 1, cost: 12.50 },
          { material: "MAT-006", qty: 1, cost: 35 },
        ],
        subtotalMaterial: 92.50,
        labor: { milling: 7.50, assembly: 14, testing: 3.50, packaging: 3.50 },
        subtotalLabor: 28.50,
        overhead: { rate: "7.62%", amount: 9.98 },
      }),
    }});
  }

  const existingCE2 = await prisma.costEstimate.findFirst({ where: { tenantId: tenant.id, materialId: matMap["MAT-007"].id } });
  if (!existingCE2) {
    await prisma.costEstimate.create({ data: {
      tenantId: tenant.id, materialId: matMap["MAT-007"].id,
      materialCost: 235, laborCost: 72, overheadCost: 25.20, totalCost: 332.20,
      costPerUnit: 332.20, quantity: 1, status: "released",
      breakdown: JSON.stringify({
        materials: [
          { material: "MAT-001", qty: 3, cost: 135 },
          { material: "MAT-002", qty: 2, cost: 25 },
          { material: "MAT-003", qty: 1, cost: 28 },
          { material: "MAT-006", qty: 2, cost: 70 },
        ],
        subtotalMaterial: 235,
        labor: { milling: 12.75, lathe: 10.10, assembly: 33.25, testing: 8.50, packaging: 7.40 },
        subtotalLabor: 72,
        overhead: { rate: "7.59%", amount: 25.20 },
      }),
    }});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 33. ERP TIME MACHINE EVENTS (original + extended)
  // ═══════════════════════════════════════════════════════════════════

  const existingErpEvents = await prisma.eRPEvent.count({ where: { tenantId: tenant.id } });
  if (existingErpEvents === 0) {
    const erpEvents = [
      { eventType: "SYSTEM_INITIALIZED", entityType: "system", entityId: "system", simulationDay: 1, payload: JSON.stringify({ action: "System initialized with demo data" }) },
      { eventType: "MATERIAL_CREATED", entityType: "material", entityId: matMap["MAT-001"]?.id || "m1", simulationDay: 1, payload: JSON.stringify({ material: "MAT-001", description: "Steel Sheet 4x8 ft" }) },
      { eventType: "VENDOR_ONBOARDED", entityType: "vendor", entityId: vendorMap["V-001"]?.id || "v1", simulationDay: 2, payload: JSON.stringify({ vendor: "Steel Suppliers Inc.", status: "approved" }) },
      { eventType: "PURCHASE_ORDER_CREATED", entityType: "purchase_order", entityId: po1?.id || "po1", simulationDay: 3, payload: JSON.stringify({ poNumber: "PO-0000001", vendor: "Steel Suppliers Inc.", amount: 12900 }) },
      { eventType: "PURCHASE_ORDER_APPROVED", entityType: "purchase_order", entityId: po1?.id || "po1", simulationDay: 3, payload: JSON.stringify({ poNumber: "PO-0000001", approvedBy: "Admin" }) },
      { eventType: "GOODS_RECEIVED", entityType: "purchase_order", entityId: po1?.id || "po1", simulationDay: 5, payload: JSON.stringify({ poNumber: "PO-0000001", grNumber: "GR-0001", quantity: 350, location: "Main Warehouse" }) },
      { eventType: "MATERIAL_STOCK_UPDATED", entityType: "material", entityId: matMap["MAT-001"]?.id || "m1", simulationDay: 5, payload: JSON.stringify({ material: "MAT-001", previousQty: 500, newQty: 700, movement: "receipt" }) },
      { eventType: "PRODUCTION_ORDER_CREATED", entityType: "production_order", entityId: prd1?.id || "prod1", simulationDay: 6, payload: JSON.stringify({ orderNumber: "PRD-0001", material: "Finished Widget A", quantity: 100 }) },
      { eventType: "PRODUCTION_STARTED", entityType: "production_order", entityId: prd1?.id || "prod1", simulationDay: 6, payload: JSON.stringify({ orderNumber: "PRD-0001", workCenter: "WC-MILL", operation: "Cut Steel" }) },
      { eventType: "MRP_RUN_COMPLETED", entityType: "mrp_run", entityId: mrp1?.id || "mrp1", simulationDay: 7, payload: JSON.stringify({ runNumber: "MRP-001", plannedOrders: 3, shortages: 1 }) },
      { eventType: "QUALITY_CHECK_PASSED", entityType: "inspection_lot", entityId: il1?.id || "il1", simulationDay: 7, payload: JSON.stringify({ lotNumber: "IL-0001", material: "MAT-001", result: "accepted", defects: 2 }) },
      { eventType: "SALES_ORDER_CREATED", entityType: "sales_order", entityId: so1?.id || "so1", simulationDay: 8, payload: JSON.stringify({ soNumber: "SO-0000001", customer: "Acme Industries", amount: 7499.30 }) },
      { eventType: "DELIVERY_DISPATCHED", entityType: "delivery", entityId: "del1", simulationDay: 9, payload: JSON.stringify({ deliveryNumber: "DEL-0001", carrier: "FedEx", tracking: "FDX-9876543210" }) },
      { eventType: "INVOICE_POSTED", entityType: "invoice", entityId: "inv1", simulationDay: 10, payload: JSON.stringify({ invoiceNumber: "INV-0001", amount: 7499.30, customer: "Acme Industries" }) },
      { eventType: "SUPPLIER_INVOICE_RECEIVED", entityType: "supplier_invoice", entityId: "si1", simulationDay: 10, payload: JSON.stringify({ invoiceNumber: "SI-0001", vendor: "Steel Suppliers Inc.", amount: 12900 }) },
      { eventType: "PAYMENT_PROCESSED", entityType: "payment", entityId: "pay-out-1", simulationDay: 11, payload: JSON.stringify({ paymentNumber: "PAY-OUT-001", type: "outgoing", vendor: "Steel Suppliers Inc.", amount: 12900 }) },
      { eventType: "PAYMENT_RECEIVED", entityType: "payment", entityId: "pay-in-1", simulationDay: 12, payload: JSON.stringify({ paymentNumber: "PAY-IN-001", customer: "Acme Industries", amount: 7499.30, method: "bank_transfer" }) },
      { eventType: "INVENTORY_COUNT_COMPLETED", entityType: "warehouse", entityId: warehouse?.id || "wh1", simulationDay: 13, payload: JSON.stringify({ warehouse: "WH01", itemsCounted: 8, adjustments: 2 }) },
      { eventType: "MAINTENANCE_ORDER_CREATED", entityType: "work_order", entityId: "wo2", simulationDay: 14, payload: JSON.stringify({ woNumber: "WO-0002", equipment: "EQ-002", type: "corrective", priority: "urgent" }) },
      { eventType: "EMPLOYEE_ONBOARDED", entityType: "employee", entityId: empMap["EMP-010"]?.id || "emp10", simulationDay: 14, payload: JSON.stringify({ employee: "EMP-010", name: "Anna Kowalski", department: "Procurement" }) },
      { eventType: "COST_CENTER_ALLOCATION", entityType: "cost_center", entityId: "cc1000", simulationDay: 15, payload: JSON.stringify({ costCenter: "CC-1000", period: "March 2026", amount: 32000 }) },
      { eventType: "PRODUCTION_ORDER_COMPLETED", entityType: "production_order", entityId: prd1?.id || "prod1", simulationDay: 15, payload: JSON.stringify({ orderNumber: "PRD-0001", yieldQty: 98, scrapQty: 2 }) },
    ];
    for (const ev of erpEvents) {
      await prisma.eRPEvent.create({
        data: {
          tenantId: tenant.id, ...ev, userId: adminUser.id,
          timestamp: new Date(Date.now() - (16 - (ev.simulationDay || 1)) * 86400000),
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 34. NON-CONFORMANCES
  // ═══════════════════════════════════════════════════════════════════

  const existingNC1 = await prisma.nonConformance.findFirst({ where: { ncNumber: "NC-001" } });
  if (!existingNC1) {
    await prisma.nonConformance.create({ data: {
      tenantId: tenant.id, ncNumber: "NC-001", inspectionLotId: il2.id,
      description: "Electronic Sensor XR batch exceeds response time specification on 8 of 150 inspected units (5.3% defect rate)",
      severity: "major", status: "investigating",
      rootCause: "Suspected component batch variation from supplier",
      assignedTo: empMap["EMP-007"]?.id, dueDate: new Date("2026-03-15"),
    }});
  }

  const existingNC2 = await prisma.nonConformance.findFirst({ where: { ncNumber: "NC-002" } });
  if (!existingNC2) {
    await prisma.nonConformance.create({ data: {
      tenantId: tenant.id, ncNumber: "NC-002",
      description: "Minor dimensional variance on steel sheet edges - within acceptable tolerance but noted for monitoring",
      severity: "minor", status: "closed",
      rootCause: "Normal tool wear on cutting equipment",
      correctiveAction: "Adjusted cutting parameters and scheduled earlier tool replacement",
      closedAt: new Date("2026-03-02"),
    }});
  }

  // ═══════════════════════════════════════════════════════════════════
  // 35. SAVED REPORTS
  // ═══════════════════════════════════════════════════════════════════

  const reportData = [
    {
      name: "Monthly Inventory Valuation", module: "materials", reportType: "table",
      description: "End-of-month inventory valuation report by material and storage location",
      config: JSON.stringify({
        columns: ["materialNumber", "description", "stockQuantity", "standardPrice", "totalValue"],
        filters: { type: ["raw", "semi-finished", "finished"] },
        groupBy: "type", sortBy: "totalValue", sortOrder: "desc",
      }),
      isPublic: true,
    },
    {
      name: "Sales Revenue Dashboard", module: "sales", reportType: "dashboard",
      description: "Real-time sales performance dashboard with revenue trends and top customers",
      config: JSON.stringify({
        widgets: [
          { type: "kpi", metric: "totalRevenue", period: "month" },
          { type: "chart", chartType: "line", metric: "dailyRevenue", period: "30days" },
          { type: "table", metric: "topCustomers", limit: 5 },
          { type: "chart", chartType: "pie", metric: "revenueByProduct" },
        ],
      }),
      isPublic: true,
    },
    {
      name: "Production Efficiency KPIs", module: "production", reportType: "kpi",
      description: "Key production performance indicators including OEE, throughput, and cycle time",
      config: JSON.stringify({
        kpis: [
          { name: "OEE", metric: "oee", target: 85, unit: "%" },
          { name: "Throughput", metric: "throughput", target: 500, unit: "units/day" },
          { name: "Cycle Time", metric: "cycle_time", target: 0.35, unit: "hrs/unit" },
          { name: "Scrap Rate", metric: "scrap_rate", target: 2, unit: "%" },
        ],
        period: "current_month",
      }),
      isPublic: false,
    },
  ];
  for (const rpt of reportData) {
    const existing = await prisma.savedReport.findFirst({ where: { tenantId: tenant.id, name: rpt.name } });
    if (!existing) {
      await prisma.savedReport.create({ data: { tenantId: tenant.id, ...rpt, createdBy: adminUser.id } });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 36. WORKFLOW DEFINITION + INSTANCE + TASKS
  // ═══════════════════════════════════════════════════════════════════

  let wfDef = await prisma.workflowDefinition.findFirst({
    where: { tenantId: tenant.id, name: "Purchase Order Approval Workflow" },
  });
  if (!wfDef) {
    wfDef = await prisma.workflowDefinition.create({ data: {
      tenantId: tenant.id, name: "Purchase Order Approval Workflow",
      description: "Two-step approval workflow for purchase orders exceeding $5,000",
      module: "materials", triggerEvent: "po_created",
      steps: JSON.stringify([
        { stepNumber: 1, name: "Manager Approval", role: "instructor", action: "approve", condition: "amount > 5000" },
        { stepNumber: 2, name: "Finance Approval", role: "admin", action: "approve", condition: "amount > 10000" },
      ]),
    }});
  }

  let wfInstance = await prisma.workflowInstance.findFirst({ where: { definitionId: wfDef.id } });
  if (!wfInstance) {
    wfInstance = await prisma.workflowInstance.create({ data: {
      definitionId: wfDef.id, referenceId: po2.id, currentStep: 2, status: "active",
      context: JSON.stringify({ poNumber: "PO-0000002", amount: 16750, vendor: "Electronic Parts Co." }),
    }});

    await prisma.workflowTask.createMany({ data: [
      {
        instanceId: wfInstance.id, stepNumber: 1, assigneeId: instructorUser.id,
        action: "approve", status: "completed", comment: "Approved - vendor is preferred supplier",
        completedAt: new Date("2026-02-21T10:00:00"),
      },
      {
        instanceId: wfInstance.id, stepNumber: 2, assigneeId: adminUser.id,
        action: "approve", status: "pending", dueDate: new Date("2026-03-10"),
      },
    ]});
  }

  // ═══════════════════════════════════════════════════════════════════
  // NEW MODULES SEED DATA
  // ═══════════════════════════════════════════════════════════════════

  // Clear existing new-module data to allow re-seeding
  await prisma.certificationAttempt.deleteMany({});
  await prisma.certification.deleteMany({});
  await prisma.lessonProgress.deleteMany({});
  await prisma.lesson.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.datasetTemplate.deleteMany({});
  await prisma.systemMetric.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.integrationLog.deleteMany({});
  await prisma.integrationEndpoint.deleteMany({});
  await prisma.optimizationRun.deleteMany({});
  await prisma.factInventory.deleteMany({});
  await prisma.factSales.deleteMany({});
  await prisma.portalAccess.deleteMany({});
  await prisma.closingPeriod.deleteMany({});
  await prisma.financialStatement.deleteMany({});
  await prisma.intercompanyTransaction.deleteMany({});
  await prisma.transferPricingRule.deleteMany({});
  await prisma.company.deleteMany({});

  // Multi-Company
  const companyA = await prisma.company.create({ data: {
    tenantId: tenant.id, code: "COMP-A", name: "ENSAK Manufacturing", type: "factory", currency: "MAD", country: "MA",
  }});
  const companyB = await prisma.company.create({ data: {
    tenantId: tenant.id, code: "COMP-B", name: "ENSAK Distribution", type: "distribution", currency: "MAD", country: "MA",
  }});
  const companyC = await prisma.company.create({ data: {
    tenantId: tenant.id, code: "COMP-C", name: "ENSAK Retail", type: "retail", currency: "EUR", country: "FR", parentId: companyA.id,
  }});
  await prisma.company.create({ data: {
    tenantId: tenant.id, code: "COMP-H", name: "ENSAK Holding", type: "holding", currency: "MAD", country: "MA",
  }});

  await prisma.intercompanyTransaction.createMany({ data: [
    { tenantId: tenant.id, transactionNumber: "ICT-0000001", fromCompanyCode: "COMP-A", toCompanyCode: "COMP-B", type: "transfer", quantity: 500, amount: 25000, transferPrice: 50, status: "posted", createdBy: adminUser.id },
    { tenantId: tenant.id, transactionNumber: "ICT-0000002", fromCompanyCode: "COMP-B", toCompanyCode: "COMP-C", type: "purchase", quantity: 200, amount: 14000, transferPrice: 70, status: "approved", createdBy: adminUser.id },
    { tenantId: tenant.id, transactionNumber: "ICT-0000003", fromCompanyCode: "COMP-A", toCompanyCode: "COMP-C", type: "service", amount: 5000, status: "draft", createdBy: instructorUser.id },
  ]});

  await prisma.transferPricingRule.createMany({ data: [
    { tenantId: tenant.id, fromCompanyCode: "COMP-A", toCompanyCode: "COMP-B", method: "cost_plus", markupPct: 15 },
    { tenantId: tenant.id, fromCompanyCode: "COMP-B", toCompanyCode: "COMP-C", method: "market_price", fixedPrice: 70 },
    { tenantId: tenant.id, fromCompanyCode: "COMP-A", toCompanyCode: "COMP-C", method: "negotiated", markupPct: 20, fixedPrice: 60 },
  ]});

  // Financial Statements
  await prisma.financialStatement.createMany({ data: [
    {
      tenantId: tenant.id, type: "balance_sheet", periodYear: 2026, periodMonth: 1, companyCode: "CC01", status: "final",
      data: JSON.stringify({
        assets: { cash: 150000, inventory: 280000, equipment: 520000, receivables: 95000, total: 1045000 },
        liabilities: { accountsPayable: 120000, loans: 300000, accruals: 25000, total: 445000 },
        equity: { shareCapital: 500000, retainedEarnings: 100000, total: 600000 },
        balanced: true,
      }),
      generatedBy: adminUser.id,
    },
    {
      tenantId: tenant.id, type: "income_statement", periodYear: 2026, periodMonth: 1, companyCode: "CC01", status: "final",
      data: JSON.stringify({
        revenue: { productSales: 420000, serviceRevenue: 35000, total: 455000 },
        expenses: { cogs: 260000, salaries: 85000, rent: 12000, utilities: 4500, depreciation: 8000, total: 369500 },
        netIncome: 85500,
      }),
      generatedBy: adminUser.id,
    },
    {
      tenantId: tenant.id, type: "cash_flow", periodYear: 2026, periodMonth: 1, companyCode: "CC01", status: "draft",
      data: JSON.stringify({
        operating: { netIncome: 85500, depreciation: 8000, receivableChange: -15000, payableChange: 10000, total: 88500 },
        investing: { equipmentPurchase: -45000, total: -45000 },
        financing: { loanPayment: -15000, total: -15000 },
        netChange: 28500,
      }),
      generatedBy: adminUser.id,
    },
  ]});

  // Period Closing
  await prisma.closingPeriod.createMany({ data: [
    {
      tenantId: tenant.id, year: 2026, month: 1, status: "closed",
      checklist: JSON.stringify([
        { id: "review_journals", name: "Review Journal Entries", status: "completed", completedAt: "2026-02-01T09:00:00Z", completedBy: adminUser.id },
        { id: "run_depreciation", name: "Run Depreciation", status: "completed", completedAt: "2026-02-01T10:00:00Z", completedBy: adminUser.id },
        { id: "inventory_valuation", name: "Inventory Valuation", status: "completed", completedAt: "2026-02-01T11:00:00Z", completedBy: adminUser.id },
        { id: "reconcile_ap", name: "Reconcile AP", status: "completed", completedAt: "2026-02-02T09:00:00Z", completedBy: adminUser.id },
        { id: "reconcile_ar", name: "Reconcile AR", status: "completed", completedAt: "2026-02-02T10:00:00Z", completedBy: adminUser.id },
        { id: "review_accruals", name: "Review Accruals", status: "completed", completedAt: "2026-02-02T11:00:00Z", completedBy: adminUser.id },
        { id: "generate_statements", name: "Generate Statements", status: "completed", completedAt: "2026-02-03T09:00:00Z", completedBy: adminUser.id },
        { id: "close_period", name: "Close Period", status: "completed", completedAt: "2026-02-03T10:00:00Z", completedBy: adminUser.id },
      ]),
      startedAt: new Date("2026-02-01"), completedAt: new Date("2026-02-03"), completedBy: adminUser.id,
    },
    {
      tenantId: tenant.id, year: 2026, month: 2, status: "in_progress",
      checklist: JSON.stringify([
        { id: "review_journals", name: "Review Journal Entries", status: "completed", completedAt: "2026-03-01T09:00:00Z", completedBy: adminUser.id },
        { id: "run_depreciation", name: "Run Depreciation", status: "completed", completedAt: "2026-03-01T10:00:00Z", completedBy: adminUser.id },
        { id: "inventory_valuation", name: "Inventory Valuation", status: "pending" },
        { id: "reconcile_ap", name: "Reconcile AP", status: "pending" },
        { id: "reconcile_ar", name: "Reconcile AR", status: "pending" },
        { id: "review_accruals", name: "Review Accruals", status: "pending" },
        { id: "generate_statements", name: "Generate Statements", status: "pending" },
        { id: "close_period", name: "Close Period", status: "pending" },
      ]),
      startedAt: new Date("2026-03-01"),
    },
  ]});

  // Portal Access
  await prisma.portalAccess.createMany({ data: [
    { tenantId: tenant.id, portalType: "supplier", externalId: "VEND001", email: "supplier@steelworks.com", name: "Steel Works Contact", permissions: JSON.stringify(["view_pos", "confirm_delivery", "send_invoices"]), lastLogin: new Date("2026-03-05") },
    { tenantId: tenant.id, portalType: "supplier", externalId: "VEND002", email: "contact@electroparts.com", name: "Electronic Parts Rep", permissions: JSON.stringify(["view_pos", "confirm_delivery"]) },
    { tenantId: tenant.id, portalType: "customer", externalId: "CUST001", email: "orders@acme.com", name: "Acme Corp Buyer", permissions: JSON.stringify(["view_orders", "view_invoices", "track_shipments"]), lastLogin: new Date("2026-03-08") },
    { tenantId: tenant.id, portalType: "customer", externalId: "CUST003", email: "procurement@globalretail.com", name: "Global Retail Purchasing", permissions: JSON.stringify(["view_orders", "view_invoices"]) },
  ]});

  // Data Warehouse - Fact Sales
  const dwDates = ["2026-01-15", "2026-01-22", "2026-02-05", "2026-02-18", "2026-03-01"];
  const dwSalesData = [
    { customerId: "CUST001", materialId: "MAT001", quantity: 100, revenue: 15000, cost: 9000, profit: 6000, region: "North America" },
    { customerId: "CUST002", materialId: "MAT002", quantity: 50, revenue: 22500, cost: 12500, profit: 10000, region: "North America" },
    { customerId: "CUST003", materialId: "MAT003", quantity: 200, revenue: 5000, cost: 3000, profit: 2000, region: "Europe" },
    { customerId: "CUST001", materialId: "MAT004", quantity: 30, revenue: 18000, cost: 10800, profit: 7200, region: "North America" },
    { customerId: "CUST002", materialId: "MAT001", quantity: 75, revenue: 11250, cost: 6750, profit: 4500, region: "Europe" },
  ];
  for (let i = 0; i < dwDates.length; i++) {
    await prisma.factSales.create({ data: {
      tenantId: tenant.id, dateKey: dwDates[i], ...dwSalesData[i], discount: Math.random() * 500,
    }});
  }

  // Data Warehouse - Fact Inventory
  for (const mat of ["MAT001", "MAT002", "MAT003", "MAT004"]) {
    for (const date of ["2026-01-31", "2026-02-28"]) {
      await prisma.factInventory.create({ data: {
        tenantId: tenant.id, dateKey: date, materialId: mat, stockQuantity: Math.floor(Math.random() * 500 + 100),
        stockValue: Math.floor(Math.random() * 50000 + 10000), inboundQty: Math.floor(Math.random() * 200), outboundQty: Math.floor(Math.random() * 150),
      }});
    }
  }

  // Optimization Runs
  await prisma.optimizationRun.createMany({ data: [
    {
      tenantId: tenant.id, type: "warehouse_location", name: "Q1 Warehouse Network Optimization",
      algorithm: "greedy", status: "completed",
      parameters: JSON.stringify({ facilities: [{ name: "WH-East", fixedCost: 50000, capacity: 1000 }, { name: "WH-West", fixedCost: 45000, capacity: 800 }, { name: "WH-Central", fixedCost: 60000, capacity: 1200 }], maxWarehouses: 2 }),
      result: JSON.stringify({ selected: ["WH-East", "WH-Central"], totalCost: 185000, savingsVsAll: 32000 }),
      iterations: 15, objectiveValue: 185000, runtime: 0.45, createdBy: adminUser.id, completedAt: new Date("2026-02-15"),
    },
    {
      tenantId: tenant.id, type: "inventory_policy", name: "Steel Plate EOQ Analysis",
      algorithm: "eoq", status: "completed",
      parameters: JSON.stringify({ materialId: "MAT001", annualDemand: 12000, orderingCost: 150, holdingCostPct: 0.2, serviceLevelPct: 0.95, leadTimeDays: 14, demandStdDev: 50 }),
      result: JSON.stringify({ eoq: 424, reorderPoint: 578, safetyStock: 115, totalAnnualCost: 8485 }),
      objectiveValue: 8485, runtime: 0.02, createdBy: instructorUser.id, completedAt: new Date("2026-03-01"),
    },
    {
      tenantId: tenant.id, type: "production_scheduling", name: "March Production Schedule",
      algorithm: "spt", status: "completed",
      parameters: JSON.stringify({ jobs: [{ id: "J1", duration: 4, deadline: 10, priority: 1 }, { id: "J2", duration: 2, deadline: 5, priority: 2 }, { id: "J3", duration: 6, deadline: 15, priority: 1 }], machines: 2 }),
      result: JSON.stringify({ schedule: { M1: ["J2", "J3"], M2: ["J1"] }, makespan: 8, utilization: { M1: 100, M2: 50 } }),
      iterations: 6, objectiveValue: 8, runtime: 0.01, createdBy: adminUser.id, completedAt: new Date("2026-03-05"),
    },
  ]});

  // Integration Endpoints
  const ep1 = await prisma.integrationEndpoint.create({ data: {
    tenantId: tenant.id, name: "CRM Sync - Salesforce", type: "rest_api", direction: "outbound",
    url: "https://crm.example.com/api/orders", method: "POST", authType: "oauth2",
    eventTrigger: "SO_CREATED", lastTriggered: new Date("2026-03-08"),
  }});
  await prisma.integrationEndpoint.create({ data: {
    tenantId: tenant.id, name: "IoT Sensor Data", type: "webhook", direction: "inbound",
    url: "/api/integration/webhook/receive", method: "POST", authType: "api_key", eventTrigger: "SENSOR_DATA",
  }});
  await prisma.integrationEndpoint.create({ data: {
    tenantId: tenant.id, name: "E-Commerce Orders", type: "message_queue", direction: "inbound",
    authType: "api_key", eventTrigger: "ECOM_ORDER",
  }});
  await prisma.integrationEndpoint.create({ data: {
    tenantId: tenant.id, name: "Transport Tracking", type: "rest_api", direction: "outbound",
    url: "https://logistics.example.com/tracking", method: "GET", authType: "basic",
    eventTrigger: "SHIPMENT_DISPATCHED",
  }});

  // Integration Logs
  await prisma.integrationLog.createMany({ data: [
    { tenantId: tenant.id, endpointId: ep1.id, direction: "outbound", eventType: "SO_CREATED", payload: JSON.stringify({ orderId: "SO-0000001", customer: "CUST001" }), response: JSON.stringify({ status: "synced", crmId: "CRM-4521" }), statusCode: 200, success: true, duration: 245 },
    { tenantId: tenant.id, endpointId: ep1.id, direction: "outbound", eventType: "SO_CREATED", payload: JSON.stringify({ orderId: "SO-0000002", customer: "CUST002" }), response: JSON.stringify({ error: "timeout" }), statusCode: 504, success: false, errorMessage: "Gateway timeout", duration: 30000 },
    { tenantId: tenant.id, direction: "inbound", eventType: "SENSOR_DATA", payload: JSON.stringify({ sensorId: "TEMP-01", value: 72.5, unit: "F" }), statusCode: 200, success: true, duration: 12 },
  ]});

  // Documents
  await prisma.document.createMany({ data: [
    { tenantId: tenant.id, name: "PO-0000001 Purchase Order", type: "po_pdf", mimeType: "application/pdf", entityType: "purchase_order", entityId: "PO-0000001", description: "Official purchase order document for Steel Works", uploadedBy: adminUser.id, tags: JSON.stringify(["procurement", "steel"]) },
    { tenantId: tenant.id, name: "Vendor Contract - Steel Works", type: "contract", entityType: "vendor", entityId: "VEND001", description: "Annual supply contract 2026", uploadedBy: adminUser.id, tags: JSON.stringify(["contract", "vendor", "2026"]) },
    { tenantId: tenant.id, name: "INV-2026-001 Invoice", type: "invoice_pdf", mimeType: "application/pdf", entityType: "invoice", entityId: "INV-001", description: "Customer invoice for Acme Corp order", uploadedBy: instructorUser.id, tags: JSON.stringify(["invoice", "acme"]) },
    { tenantId: tenant.id, name: "Quality Report Q1 2026", type: "report", entityType: "inspection_lot", description: "Quarterly quality summary report", uploadedBy: instructorUser.id, tags: JSON.stringify(["quality", "report", "Q1"]) },
    { tenantId: tenant.id, name: "Equipment Manual - CNC Mill", type: "attachment", entityType: "equipment", entityId: "EQ-001", description: "CNC milling machine operating manual", uploadedBy: adminUser.id, tags: JSON.stringify(["manual", "equipment"]) },
  ]});

  // System Metrics
  await prisma.systemMetric.createMany({ data: [
    { tenantId: tenant.id, metricType: "api_response_time", endpoint: "/api/purchasing/purchase-orders", value: 45, unit: "ms" },
    { tenantId: tenant.id, metricType: "api_response_time", endpoint: "/api/sales/sales-orders", value: 62, unit: "ms" },
    { tenantId: tenant.id, metricType: "api_response_time", endpoint: "/api/finance/journal-entries", value: 38, unit: "ms" },
    { tenantId: tenant.id, metricType: "active_users", value: 15, unit: "count" },
    { tenantId: tenant.id, metricType: "db_query_time", endpoint: "/api/mrp-board/planning-board", value: 120, unit: "ms" },
    { tenantId: tenant.id, metricType: "error_rate", value: 0.8, unit: "percent" },
    { metricType: "memory_usage", value: 256, unit: "MB" },
    { metricType: "active_users", value: 42, unit: "count" },
  ]});

  // Courses
  const course1 = await prisma.course.create({ data: {
    tenantId: tenant.id, code: "ERP-101", title: "ERP Fundamentals", description: "Introduction to Enterprise Resource Planning concepts and core modules. Learn procurement, sales, production, and financial workflows.",
    instructor: instructorUser.id, difficulty: "beginner", estimatedHours: 12, isPublished: true, sortOrder: 1,
  }});
  const course2 = await prisma.course.create({ data: {
    tenantId: tenant.id, code: "ERP-201", title: "Advanced Supply Chain Management", description: "Deep dive into MRP, production scheduling, inventory optimization, and supply chain network design.",
    instructor: instructorUser.id, difficulty: "intermediate", estimatedHours: 20, isPublished: true, sortOrder: 2,
  }});
  await prisma.course.create({ data: {
    tenantId: tenant.id, code: "ERP-301", title: "Financial Accounting in ERP", description: "Master financial accounting: GL, AP, AR, financial statements, period closing, and cost accounting.",
    instructor: adminUser.id, difficulty: "advanced", estimatedHours: 16, isPublished: true, sortOrder: 3,
  }});
  await prisma.course.create({ data: {
    tenantId: tenant.id, code: "ERP-102", title: "ERP Integration & Architecture", description: "Learn how ERP systems integrate with external applications. Webhooks, APIs, event-driven architecture.",
    instructor: instructorUser.id, difficulty: "intermediate", estimatedHours: 8, isPublished: true, sortOrder: 4,
  }});
  await prisma.course.create({ data: {
    tenantId: tenant.id, code: "ERP-103", title: "Warehouse & Inventory Management", description: "Master warehouse operations: bin management, goods receipt, putaway, picking, packing, shipping, cycle counts, and ABC classification.",
    instructor: instructorUser.id, difficulty: "beginner", estimatedHours: 10, isPublished: true, sortOrder: 5,
  }});
  await prisma.course.create({ data: {
    tenantId: tenant.id, code: "ERP-202", title: "Quality Management & Maintenance", description: "Learn inspection lot processing, non-conformance handling, corrective actions, and preventive/corrective maintenance planning.",
    instructor: instructorUser.id, difficulty: "intermediate", estimatedHours: 14, isPublished: true, sortOrder: 6,
  }});
  await prisma.course.create({ data: {
    tenantId: tenant.id, code: "ERP-203", title: "Production Planning & Scheduling", description: "BOMs, routings, work centers, production orders, capacity planning, Gantt scheduling, and shop floor control.",
    instructor: instructorUser.id, difficulty: "intermediate", estimatedHours: 18, isPublished: true, sortOrder: 7,
  }});
  await prisma.course.create({ data: {
    tenantId: tenant.id, code: "ERP-302", title: "Controlling & Cost Analysis", description: "Cost centers, internal orders, overhead allocation, product costing, cost estimates, and variance analysis.",
    instructor: adminUser.id, difficulty: "advanced", estimatedHours: 12, isPublished: true, sortOrder: 8,
  }});
  await prisma.course.create({ data: {
    tenantId: tenant.id, code: "ERP-303", title: "Supply Chain Optimization & Analytics", description: "EOQ, safety stock modeling, bullwhip effect simulation, multi-echelon inventory, vehicle routing, and digital twin concepts.",
    instructor: instructorUser.id, difficulty: "advanced", estimatedHours: 22, isPublished: true, sortOrder: 9,
  }});
  await prisma.course.create({ data: {
    tenantId: tenant.id, code: "ERP-104", title: "Human Resources in ERP", description: "Employee master data, organizational structures, time management, leave processing, and workforce analytics.",
    instructor: instructorUser.id, difficulty: "beginner", estimatedHours: 8, isPublished: true, sortOrder: 10,
  }});
  await prisma.course.create({ data: {
    tenantId: tenant.id, code: "ERP-204", title: "MRP & Demand Planning", description: "Net requirements calculation, lot sizing methods, safety stock, demand forecasting techniques, and MRP run interpretation.",
    instructor: instructorUser.id, difficulty: "intermediate", estimatedHours: 16, isPublished: true, sortOrder: 11,
  }});
  await prisma.course.create({ data: {
    tenantId: tenant.id, code: "ERP-304", title: "Multi-Company & Consolidation", description: "Intercompany transactions, transfer pricing, multi-currency accounting, and financial consolidation across entities.",
    instructor: adminUser.id, difficulty: "advanced", estimatedHours: 14, isPublished: true, sortOrder: 12,
  }});
  await prisma.course.create({ data: {
    tenantId: tenant.id, code: "ERP-105", title: "Sales & Distribution Essentials", description: "Sales order processing, pricing engine, deliveries, billing, customer credit management, and revenue recognition.",
    instructor: instructorUser.id, difficulty: "beginner", estimatedHours: 10, isPublished: true, sortOrder: 13,
  }});

  // Lessons for ERP-101
  const lesson1 = await prisma.lesson.create({ data: {
    courseId: course1.id, lessonNumber: 1, title: "Introduction to ERP Systems", description: "What is an ERP? History, benefits, and key concepts.",
    content: JSON.stringify({ sections: [{ type: "text", text: "Enterprise Resource Planning (ERP) systems integrate all facets of an operation, including product planning, development, manufacturing, sales, and marketing." }, { type: "text", text: "Modern ERP systems evolved from MRP (Material Requirements Planning) systems in the 1960s." }] }),
    modulesUsed: JSON.stringify(["overview"]), objectives: JSON.stringify(["Understand what ERP is", "Know the history of ERP", "Identify core ERP modules"]), estimatedMinutes: 30, sortOrder: 1,
  }});
  const lesson2 = await prisma.lesson.create({ data: {
    courseId: course1.id, lessonNumber: 2, title: "The Procurement Cycle (P2P)", description: "Master the Procure-to-Pay process: purchase requisitions, POs, goods receipt, invoicing.",
    content: JSON.stringify({ sections: [{ type: "text", text: "The Procure-to-Pay (P2P) cycle is one of the most important business processes in any organization." }, { type: "task", text: "Create a purchase order for 100 units of Steel Plate from Steel Works vendor." }] }),
    modulesUsed: JSON.stringify(["MM", "FI-AP"]), objectives: JSON.stringify(["Create purchase requisitions", "Convert PR to PO", "Process goods receipt", "Handle supplier invoices"]), estimatedMinutes: 45, sortOrder: 2,
  }});
  await prisma.lesson.create({ data: {
    courseId: course1.id, lessonNumber: 3, title: "The Sales Cycle (O2C)", description: "Order-to-Cash process: sales orders, deliveries, invoicing, payment collection.",
    content: JSON.stringify({ sections: [{ type: "text", text: "The Order-to-Cash (O2C) cycle covers the entire process from receiving a customer order to collecting payment." }] }),
    modulesUsed: JSON.stringify(["SD", "FI-AR"]), objectives: JSON.stringify(["Create sales orders", "Process deliveries", "Generate customer invoices"]), estimatedMinutes: 45, sortOrder: 3,
  }});
  await prisma.lesson.create({ data: {
    courseId: course1.id, lessonNumber: 4, title: "Production Planning Basics", description: "BOMs, routings, production orders, and capacity planning fundamentals.",
    content: JSON.stringify({ sections: [{ type: "text", text: "Production planning ensures that the right products are manufactured at the right time in the right quantities." }] }),
    modulesUsed: JSON.stringify(["PP", "MM"]), objectives: JSON.stringify(["Understand BOMs", "Create production orders", "Plan capacity"]), estimatedMinutes: 60, sortOrder: 4,
  }});
  await prisma.lesson.create({ data: {
    courseId: course1.id, lessonNumber: 5, title: "Financial Accounting Fundamentals", description: "Journal entries, GL accounts, trial balance, and financial reports.",
    content: JSON.stringify({ sections: [{ type: "text", text: "Financial accounting in ERP follows double-entry bookkeeping: every debit must have a corresponding credit." }] }),
    modulesUsed: JSON.stringify(["FI-GL"]), objectives: JSON.stringify(["Post journal entries", "Run trial balance", "Read financial statements"]), estimatedMinutes: 45, sortOrder: 5,
  }});

  // Lessons for ERP-201
  await prisma.lesson.create({ data: {
    courseId: course2.id, lessonNumber: 1, title: "MRP Concepts & Configuration", description: "Material Requirements Planning: demand forecasting, net requirements, planned orders.",
    content: JSON.stringify({ sections: [{ type: "text", text: "MRP answers three questions: What to produce? How much? When?" }] }),
    modulesUsed: JSON.stringify(["MRP", "MM"]), objectives: JSON.stringify(["Run MRP", "Interpret planned orders", "Configure safety stock"]), estimatedMinutes: 60, sortOrder: 1,
  }});
  await prisma.lesson.create({ data: {
    courseId: course2.id, lessonNumber: 2, title: "Advanced Production Scheduling", description: "Gantt charts, bottleneck detection, capacity leveling, and production simulation.",
    content: JSON.stringify({ sections: [{ type: "text", text: "Advanced scheduling goes beyond MRP by considering machine capacity, setup times, and priorities." }] }),
    modulesUsed: JSON.stringify(["PP"]), objectives: JSON.stringify(["Use the scheduling board", "Identify bottlenecks", "Level capacity"]), estimatedMinutes: 75, sortOrder: 2,
  }});
  await prisma.lesson.create({ data: {
    courseId: course2.id, lessonNumber: 3, title: "Inventory Optimization", description: "EOQ, safety stock, ABC analysis, and reorder point calculation.",
    content: JSON.stringify({ sections: [{ type: "text", text: "Inventory optimization balances holding costs against shortage costs to find the economically optimal inventory levels." }] }),
    modulesUsed: JSON.stringify(["MM", "WM"]), objectives: JSON.stringify(["Calculate EOQ", "Set safety stock", "Perform ABC classification"]), estimatedMinutes: 60, sortOrder: 3,
  }});

  // Lesson Progress
  await prisma.lessonProgress.createMany({ data: [
    { lessonId: lesson1.id, userId: studentUser.id, status: "completed", score: 95, startedAt: new Date("2026-03-01"), completedAt: new Date("2026-03-01"), attempts: 1 },
    { lessonId: lesson2.id, userId: studentUser.id, status: "in_progress", startedAt: new Date("2026-03-05"), attempts: 1 },
  ]});

  // Certifications
  const cert1 = await prisma.certification.create({ data: {
    tenantId: tenant.id, code: "CERT-P2P", title: "Procure-to-Pay Certification", description: "Demonstrate mastery of the complete procurement cycle: from purchase requisition through vendor payment.",
    modulesCovered: JSON.stringify(["MM", "FI-AP", "WM"]), passingScore: 70, timeLimit: 60,
    tasks: JSON.stringify([
      { id: "t1", description: "Create a purchase requisition for 50 units of Steel Plate", validation: "purchase_requisition_exists" },
      { id: "t2", description: "Convert the PR to a purchase order", validation: "po_from_pr" },
      { id: "t3", description: "Post goods receipt for the PO", validation: "goods_receipt_posted" },
      { id: "t4", description: "Create and approve supplier invoice", validation: "invoice_approved" },
      { id: "t5", description: "Execute payment run for the invoice", validation: "payment_executed" },
    ]),
  }});
  await prisma.certification.create({ data: {
    tenantId: tenant.id, code: "CERT-O2C", title: "Order-to-Cash Certification", description: "Master the sales cycle from order entry to cash collection.",
    modulesCovered: JSON.stringify(["SD", "FI-AR", "WM"]), passingScore: 75, timeLimit: 45,
    tasks: JSON.stringify([
      { id: "t1", description: "Create a sales order for a customer", validation: "sales_order_created" },
      { id: "t2", description: "Create delivery for the sales order", validation: "delivery_created" },
      { id: "t3", description: "Post goods issue", validation: "goods_issued" },
      { id: "t4", description: "Generate customer invoice", validation: "invoice_generated" },
    ]),
  }});
  await prisma.certification.create({ data: {
    tenantId: tenant.id, code: "CERT-PP", title: "Production Planning Certification", description: "Prove your ability to plan and execute production orders.",
    modulesCovered: JSON.stringify(["PP", "MM", "QM"]), passingScore: 70, timeLimit: 90,
    tasks: JSON.stringify([
      { id: "t1", description: "Create a BOM for a finished product", validation: "bom_created" },
      { id: "t2", description: "Create a routing with work center assignments", validation: "routing_created" },
      { id: "t3", description: "Run MRP to generate planned orders", validation: "mrp_run_completed" },
      { id: "t4", description: "Convert planned order to production order", validation: "prod_order_created" },
      { id: "t5", description: "Confirm production and post goods receipt", validation: "production_confirmed" },
    ]),
  }});

  // Certification Attempts
  await prisma.certificationAttempt.createMany({ data: [
    { certificationId: cert1.id, userId: studentUser.id, status: "passed", score: 85, startedAt: new Date("2026-03-02"), completedAt: new Date("2026-03-02"), taskResults: JSON.stringify([{ taskId: "t1", completed: true }, { taskId: "t2", completed: true }, { taskId: "t3", completed: true }, { taskId: "t4", completed: false }, { taskId: "t5", completed: true }]), timeSpent: 2400 },
    { certificationId: cert1.id, userId: instructorUser.id, status: "passed", score: 100, startedAt: new Date("2026-02-28"), completedAt: new Date("2026-02-28"), taskResults: JSON.stringify([{ taskId: "t1", completed: true }, { taskId: "t2", completed: true }, { taskId: "t3", completed: true }, { taskId: "t4", completed: true }, { taskId: "t5", completed: true }]), timeSpent: 1800 },
  ]});

  // Dataset Templates
  await prisma.datasetTemplate.create({ data: {
    tenantId: tenant.id, name: "Small Company Dataset", description: "Minimal dataset for quick testing",
    config: JSON.stringify({ customers: 10, vendors: 5, materials: 20, purchaseOrders: 30, salesOrders: 25, journalEntries: 15 }),
    status: "ready", createdBy: adminUser.id,
  }});
  await prisma.datasetTemplate.create({ data: {
    tenantId: tenant.id, name: "Medium Enterprise Dataset", description: "Realistic dataset for a mid-size company",
    config: JSON.stringify({ customers: 100, vendors: 30, materials: 200, purchaseOrders: 500, salesOrders: 400, journalEntries: 100 }),
    status: "ready", createdBy: adminUser.id,
  }});
  await prisma.datasetTemplate.create({ data: {
    tenantId: tenant.id, name: "Large Corporation Dataset", description: "Full-scale dataset simulating a large enterprise",
    config: JSON.stringify({ customers: 500, vendors: 100, materials: 1000, purchaseOrders: 2000, salesOrders: 1500, journalEntries: 500 }),
    status: "ready", createdBy: instructorUser.id,
  }});

  console.log("  New module seed data created successfully!");

  // ═══════════════════════════════════════════════════════════════════
  // ADVANCED FEATURES SEED DATA
  // ═══════════════════════════════════════════════════════════════════

  console.log("Seeding advanced features...");

  // Clear old advanced feature data first
  await prisma.userPresence.deleteMany({});
  await prisma.stressTest.deleteMany({});
  await prisma.benchmarkRun.deleteMany({});
  await prisma.decisionImpact.deleteMany({});
  await prisma.industryTemplate.deleteMany({});
  await prisma.digitalTwinState.deleteMany({});
  await prisma.processFlow.deleteMany({});

  // Process Flows
  await prisma.processFlow.createMany({ data: [
    {
      tenantId: tenant.id, name: "Procure-to-Pay Flow", description: "End-to-end procurement process from requisition to payment", processType: "procure_to_pay", isTemplate: true, createdBy: adminUser.id,
      nodes: JSON.stringify([
        { id: "n1", type: "start", label: "Purchase Requisition", description: "Create purchase request", tcode: "ME51N", x: 100, y: 200, module: "MM" },
        { id: "n2", type: "approval", label: "Approval", description: "Manager approval for PR", tcode: "", x: 300, y: 200, module: "WF" },
        { id: "n3", type: "action", label: "Purchase Order", description: "Create PO from PR", tcode: "ME21N", x: 500, y: 200, module: "MM" },
        { id: "n4", type: "action", label: "Goods Receipt", description: "Receive goods", tcode: "MIGO", x: 700, y: 200, module: "MM" },
        { id: "n5", type: "action", label: "Invoice Verification", description: "3-way matching", tcode: "MIRO", x: 900, y: 200, module: "FI" },
        { id: "n6", type: "end", label: "Payment", description: "Pay vendor", tcode: "F110", x: 1100, y: 200, module: "FI" },
      ]),
      edges: JSON.stringify([
        { id: "e1", source: "n1", target: "n2", label: "Submit" },
        { id: "e2", source: "n2", target: "n3", label: "Approved" },
        { id: "e3", source: "n3", target: "n4", label: "Send to vendor" },
        { id: "e4", source: "n4", target: "n5", label: "GR posted" },
        { id: "e5", source: "n5", target: "n6", label: "Invoice matched" },
      ]),
    },
    {
      tenantId: tenant.id, name: "Order-to-Cash Flow", description: "Sales process from order to payment collection", processType: "order_to_cash", isTemplate: true, createdBy: adminUser.id,
      nodes: JSON.stringify([
        { id: "n1", type: "start", label: "Sales Order", description: "Create sales order", tcode: "VA01", x: 100, y: 200, module: "SD" },
        { id: "n2", type: "action", label: "Delivery", description: "Create delivery", tcode: "VL01N", x: 300, y: 200, module: "SD" },
        { id: "n3", type: "action", label: "Goods Issue", description: "Post goods issue", tcode: "VL02N", x: 500, y: 200, module: "WM" },
        { id: "n4", type: "action", label: "Billing", description: "Create invoice", tcode: "VF01", x: 700, y: 200, module: "FI" },
        { id: "n5", type: "end", label: "Payment", description: "Receive payment", tcode: "F-28", x: 900, y: 200, module: "FI" },
      ]),
      edges: JSON.stringify([
        { id: "e1", source: "n1", target: "n2", label: "Confirmed" },
        { id: "e2", source: "n2", target: "n3", label: "Picked & packed" },
        { id: "e3", source: "n3", target: "n4", label: "Shipped" },
        { id: "e4", source: "n4", target: "n5", label: "Invoice sent" },
      ]),
    },
    {
      tenantId: tenant.id, name: "Make-to-Stock Flow", description: "Production planning to finished goods", processType: "production", isTemplate: false, createdBy: instructorUser.id,
      nodes: JSON.stringify([
        { id: "n1", type: "start", label: "Demand Forecast", description: "Forecast customer demand", tcode: "", x: 100, y: 200, module: "PP" },
        { id: "n2", type: "action", label: "MRP Run", description: "Material requirements planning", tcode: "MD01", x: 300, y: 200, module: "PP" },
        { id: "n3", type: "action", label: "Planned Order", description: "Generated planned order", tcode: "MD04", x: 500, y: 200, module: "PP" },
        { id: "n4", type: "action", label: "Production Order", description: "Create production order", tcode: "CO01", x: 700, y: 200, module: "PP" },
        { id: "n5", type: "action", label: "Confirmation", description: "Confirm production", tcode: "CO11N", x: 900, y: 200, module: "PP" },
        { id: "n6", type: "end", label: "Goods Receipt", description: "Post finished goods", tcode: "MIGO", x: 1100, y: 200, module: "MM" },
      ]),
      edges: JSON.stringify([
        { id: "e1", source: "n1", target: "n2", label: "Run MRP" },
        { id: "e2", source: "n2", target: "n3", label: "Requirements" },
        { id: "e3", source: "n3", target: "n4", label: "Convert" },
        { id: "e4", source: "n4", target: "n5", label: "Execute" },
        { id: "e5", source: "n5", target: "n6", label: "Complete" },
      ]),
    },
  ]});

  // Digital Twin State
  await prisma.digitalTwinState.create({ data: {
    tenantId: tenant.id,
    factories: JSON.stringify([
      { id: "f1", name: "Main Factory", status: "running", utilization: 78, activeOrders: 5 },
      { id: "f2", name: "Assembly Plant", status: "running", utilization: 62, activeOrders: 3 },
    ]),
    warehouses: JSON.stringify([
      { id: "w1", name: "Central Warehouse", stockLevel: 85, capacity: 100, inbound: 12, outbound: 8 },
      { id: "w2", name: "Distribution Center", stockLevel: 45, capacity: 100, inbound: 5, outbound: 15 },
    ]),
    suppliers: JSON.stringify([
      { id: "s1", name: "Steel Corp", status: "active", inTransit: 3, reliability: 92 },
      { id: "s2", name: "ElectroParts", status: "active", inTransit: 1, reliability: 88 },
      { id: "s3", name: "ChemSupply", status: "delayed", inTransit: 2, reliability: 75 },
    ]),
    customers: JSON.stringify([
      { id: "c1", name: "AutoMakers Inc", pendingOrders: 4, satisfaction: 90 },
      { id: "c2", name: "TechRetail", pendingOrders: 2, satisfaction: 95 },
      { id: "c3", name: "BuildRight", pendingOrders: 6, satisfaction: 82 },
    ]),
    transport: JSON.stringify([
      { id: "t1", from: "Steel Corp", to: "Central Warehouse", status: "in_transit", cargo: "Raw Steel 5T", eta: "2h" },
      { id: "t2", from: "Central Warehouse", to: "Main Factory", status: "loading", cargo: "Components", eta: "1h" },
      { id: "t3", from: "Main Factory", to: "Distribution Center", status: "in_transit", cargo: "Finished Goods", eta: "3h" },
    ]),
    kpis: JSON.stringify({ revenue: 2450000, cost: 1820000, inventory: 1200000, serviceLevel: 94.5, onTimeDelivery: 91.2 }),
    alerts: JSON.stringify([
      { type: "low_stock", severity: "warning", message: "Material M-003 below safety stock", entity: "M-003" },
      { type: "delay", severity: "critical", message: "Supplier ChemSupply delivery delayed 3 days", entity: "ChemSupply" },
    ]),
  }});

  // Industry Templates
  await prisma.industryTemplate.createMany({ data: [
    {
      tenantId: tenant.id, industry: "automotive", name: "Automotive Manufacturing",
      description: "Full automotive factory with multi-level BOMs, JIT delivery, and quality inspection",
      config: JSON.stringify({
        materials: ["Steel Sheet", "Aluminum Block", "Rubber Seal", "Windshield", "Engine Block", "Transmission", "Body Panel", "Wheel Assembly", "Sedan-A"],
        boms: [{ product: "Sedan-A", components: [{ material: "Engine Block", qty: 1 }, { material: "Transmission", qty: 1 }, { material: "Body Panel", qty: 4 }, { material: "Wheel Assembly", qty: 4 }, { material: "Windshield", qty: 1 }] }],
        vendors: ["Global Steel", "Precision Aluminum", "RubberTech"],
        customers: ["National Auto Dealers", "Fleet Services Corp", "Export Motors", "Premium Cars Ltd", "City Transport"],
        demandPattern: "high_volume_stable",
      }),
      isGlobal: true, createdBy: adminUser.id,
    },
    {
      tenantId: tenant.id, industry: "retail", name: "Retail Distribution",
      description: "Multi-channel retail company with seasonal demand patterns and high SKU count",
      config: JSON.stringify({
        materials: ["Clothing-LineA", "Electronics-Gadget", "Food-Package", "Furniture-Item", "Home-Appliance"],
        boms: [],
        vendors: ["Fashion Imports", "Tech Direct", "Food Wholesale", "Home Goods Co"],
        customers: Array.from({ length: 10 }, (_, i) => `Retail Customer ${i + 1}`),
        demandPattern: "seasonal_variable",
      }),
      isGlobal: true, createdBy: adminUser.id,
    },
    {
      tenantId: tenant.id, industry: "pharma", name: "Pharmaceutical Manufacturing",
      description: "Pharma company with strict batch tracking, quality, and long lead times",
      config: JSON.stringify({
        materials: ["API-Compound-X", "Excipient-Base", "Capsule-Shell", "Blister-Pack", "Drug-Alpha"],
        boms: [{ product: "Drug-Alpha", components: [{ material: "API-Compound-X", qty: 0.5 }, { material: "Excipient-Base", qty: 2 }, { material: "Capsule-Shell", qty: 100 }, { material: "Blister-Pack", qty: 10 }] }],
        vendors: ["ChemPure International", "PackagePharma"],
        customers: ["Hospital Network A", "Pharmacy Chain B", "Government Health"],
        demandPattern: "regulated_stable",
        qualityRequirements: "strict",
      }),
      isGlobal: true, createdBy: adminUser.id,
    },
    {
      tenantId: tenant.id, industry: "electronics", name: "Electronics Assembly",
      description: "Circuit board and device assembly with multi-level BOMs",
      config: JSON.stringify({
        materials: ["PCB-Board", "Resistor-10k", "Capacitor-100uF", "IC-Chip-ARM", "LCD-Display", "Li-Battery", "Phone-X", "Tablet-Y"],
        boms: [
          { product: "Phone-X", components: [{ material: "PCB-Board", qty: 1 }, { material: "IC-Chip-ARM", qty: 1 }, { material: "LCD-Display", qty: 1 }, { material: "Li-Battery", qty: 1 }, { material: "Resistor-10k", qty: 20 }, { material: "Capacitor-100uF", qty: 15 }] },
        ],
        vendors: ["Silicon Source", "Display Masters", "Battery World"],
        customers: ["Tech Retailers United", "Online Marketplace", "Enterprise Buyers"],
        demandPattern: "high_variability",
      }),
      isGlobal: true, createdBy: adminUser.id,
    },
    {
      tenantId: tenant.id, industry: "food", name: "Food Supply Chain",
      description: "Bakery/food processing with perishable goods and cold chain logistics",
      config: JSON.stringify({
        materials: ["Flour", "Sugar", "Butter", "Packaging-Box", "Bread-Loaf", "Cake-Standard"],
        boms: [
          { product: "Bread-Loaf", components: [{ material: "Flour", qty: 0.5 }, { material: "Sugar", qty: 0.05 }, { material: "Butter", qty: 0.1 }, { material: "Packaging-Box", qty: 1 }] },
          { product: "Cake-Standard", components: [{ material: "Flour", qty: 0.3 }, { material: "Sugar", qty: 0.2 }, { material: "Butter", qty: 0.25 }, { material: "Packaging-Box", qty: 1 }] },
        ],
        vendors: ["Farm Fresh Flour", "Sugar Refinery", "Dairy Direct"],
        customers: ["Supermarket Chain", "Cafes United", "Hotel Group"],
        demandPattern: "daily_perishable",
        logistics: "cold_chain",
      }),
      isGlobal: true, createdBy: adminUser.id,
    },
  ]});

  // Decision Impacts (sample analyses)
  await prisma.decisionImpact.createMany({ data: [
    {
      tenantId: tenant.id, decisionType: "increase_safety_stock", createdBy: studentUser.id,
      parameters: JSON.stringify({ materialId: "MAT-001", materialName: "Raw Steel", currentLevel: 100, newLevel: 150 }),
      impacts: JSON.stringify([
        { metric: "Holding Cost", before: 5000, after: 7500, change: 50, explanation: "Inventory holding cost increases with higher safety stock" },
        { metric: "Stockout Probability", before: 12, after: 3, change: -75, explanation: "Significantly reduced risk of stockout" },
        { metric: "Service Level", before: 88, after: 97, change: 10.2, explanation: "Better ability to fulfill customer orders on time" },
        { metric: "Working Capital", before: 50000, after: 75000, change: 50, explanation: "More capital tied up in inventory" },
      ]),
      tradeoffs: JSON.stringify([{ positive: "Higher service level (97%), fewer stockouts", negative: "50% higher holding costs, more capital locked in inventory" }]),
      recommendation: "Recommended for critical materials with high demand variability. Consider a moderate increase to 130 units as a compromise.",
    },
    {
      tenantId: tenant.id, decisionType: "change_supplier", createdBy: instructorUser.id,
      parameters: JSON.stringify({ materialId: "MAT-002", materialName: "Aluminum", currentVendor: "AlumCorp", newVendor: "MetalDirect" }),
      impacts: JSON.stringify([
        { metric: "Unit Price", before: 45.00, after: 42.50, change: -5.6, explanation: "New supplier offers lower unit price" },
        { metric: "Lead Time", before: 7, after: 12, change: 71.4, explanation: "New supplier has longer delivery times" },
        { metric: "Reliability", before: 95, after: 88, change: -7.4, explanation: "New supplier has lower on-time delivery rate" },
        { metric: "Annual Savings", before: 0, after: 15000, change: 100, explanation: "Cost savings from lower unit price" },
      ]),
      tradeoffs: JSON.stringify([{ positive: "5.6% cost reduction, $15K annual savings", negative: "71% longer lead time, 7% lower reliability" }]),
      recommendation: "Not recommended as primary supplier. Consider dual sourcing: keep AlumCorp for urgent needs, use MetalDirect for bulk/planned orders.",
    },
  ]});

  // Benchmark Runs
  await prisma.benchmarkRun.create({ data: {
    tenantId: tenant.id, name: "Spring 2026 ERP Challenge", description: "Semester-wide ERP performance competition",
    startDate: new Date("2026-03-01"), endDate: new Date("2026-06-30"), createdBy: instructorUser.id,
    metrics: JSON.stringify([
      { name: "profit", weight: 25 },
      { name: "inventory_turnover", weight: 20 },
      { name: "service_level", weight: 20 },
      { name: "production_efficiency", weight: 15 },
      { name: "cash_flow", weight: 10 },
      { name: "on_time_delivery", weight: 10 },
    ]),
    status: "active",
    results: JSON.stringify([
      { userId: studentUser.id, userName: "Student User", scores: { profit: 82, inventory_turnover: 75, service_level: 90, production_efficiency: 68, cash_flow: 85, on_time_delivery: 88 }, overall: 81.4, rank: 1 },
    ]),
  }});

  // Stress Tests
  await prisma.stressTest.createMany({ data: [
    {
      tenantId: tenant.id, name: "Black Friday Simulation", scenario: "black_friday",
      description: "Handle a 200% demand spike across all product lines",
      config: JSON.stringify({ demandMultiplier: 3, duration: 48, affectedProducts: "all" }),
      status: "completed", score: 78, userId: studentUser.id,
      startedAt: new Date("2026-03-05"), completedAt: new Date("2026-03-05"),
      events: JSON.stringify([
        { time: "00:00", type: "demand_spike", severity: "critical", message: "Customer demand surged 200% across all products" },
        { time: "02:00", type: "stock_warning", severity: "warning", message: "5 materials below safety stock" },
        { time: "06:00", type: "stockout", severity: "critical", message: "Material M-001 out of stock" },
      ]),
      studentActions: JSON.stringify([
        { time: "00:15", action: "run_mrp", details: "Ran emergency MRP to identify shortages" },
        { time: "00:30", action: "emergency_po", details: "Created emergency POs for critical materials" },
        { time: "01:00", action: "adjust_forecast", details: "Updated demand forecast for next 2 weeks" },
      ]),
    },
    {
      tenantId: tenant.id, name: "Supplier Bankruptcy Challenge", scenario: "supplier_bankruptcy",
      description: "Top supplier goes bankrupt — all pending POs cancelled",
      config: JSON.stringify({ vendorId: "top", cancelledPOs: 8 }),
      status: "ready", userId: studentUser.id,
      events: JSON.stringify([]),
      studentActions: JSON.stringify([]),
    },
  ]});

  // User Presences
  await prisma.userPresence.createMany({ data: [
    { tenantId: tenant.id, userId: adminUser.id, userName: "Admin User", currentPage: "/admin", role: "admin", isOnline: true },
    { tenantId: tenant.id, userId: instructorUser.id, userName: "Instructor User", currentPage: "/instructor", role: "instructor", isOnline: true },
    { tenantId: tenant.id, userId: studentUser.id, userName: "Student User", currentPage: "/process-flows", role: "student", isOnline: true },
  ]});

  console.log("  Advanced features seed data created successfully!");

  // ═══════════════════════════════════════════════════════════════════

  console.log("Seed complete!");
  console.log("\nAccounts:");
  console.log("  Tenant slug: ensak");
  console.log("  Admin:   admin@ensak.ma / password123");
  console.log("  Teacher: teacher@ensak.ma / password123");
  console.log("  Students: register via the sign-up form");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
