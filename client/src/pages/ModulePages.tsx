import CrudPage from "./CrudPage";
import StatusBadge from "../components/StatusBadge";

/* ── Sales Sub-pages ──────────────────────────────────── */

export function Deliveries() {
  return (
    <CrudPage
      title="Deliveries"
      subtitle="Track outbound deliveries"
      breadcrumb={[{ label: "Sales & Distribution" }, { label: "Deliveries" }]}
      queryKey="deliveries"
      endpoint="/sales/deliveries"
      readOnly
      fields={[
        { key: "deliveryNumber", label: "Delivery #" },
        { key: "customer", label: "Customer", tableRender: (r: any) => r.customer?.name },
        { key: "deliveryDate", label: "Date", tableRender: (r: any) => new Date(r.deliveryDate).toLocaleDateString() },
        { key: "status", label: "Status", tableRender: (r: any) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}

export function Invoices() {
  return (
    <CrudPage
      title="Invoices"
      subtitle="Customer invoices and billing"
      breadcrumb={[{ label: "Sales & Distribution" }, { label: "Invoices" }]}
      queryKey="invoices"
      endpoint="/sales/invoices"
      readOnly
      fields={[
        { key: "invoiceNumber", label: "Invoice #" },
        { key: "customer", label: "Customer", tableRender: (r: any) => r.customer?.name },
        { key: "invoiceDate", label: "Date", tableRender: (r: any) => new Date(r.invoiceDate).toLocaleDateString() },
        { key: "totalAmount", label: "Amount", tableRender: (r: any) => `$${(r.totalAmount || 0).toFixed(2)}` },
        { key: "status", label: "Status", tableRender: (r: any) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}

/* ── Production ───────────────────────────────────────── */

export function BOMs() {
  return (
    <CrudPage
      title="Bills of Material"
      subtitle="Product structure and component lists"
      breadcrumb={[{ label: "Production Planning" }, { label: "BOMs" }]}
      queryKey="boms"
      endpoint="/production/boms"
      addLabel="New BOM"
      fields={[
        { key: "bomNumber", label: "BOM #", required: true },
        { key: "description", label: "Description" },
        { key: "materialId", label: "Parent Material", showInTable: false },
        { key: "version", label: "Version", type: "number", defaultValue: 1 },
      ]}
    />
  );
}

export function ProductionOrders() {
  return (
    <CrudPage
      title="Production Orders"
      subtitle="Manufacturing order management"
      breadcrumb={[{ label: "Production Planning" }, { label: "Production Orders" }]}
      queryKey="production-orders"
      endpoint="/production/orders"
      addLabel="New Order"
      fields={[
        { key: "orderNumber", label: "Order #", required: true },
        { key: "quantity", label: "Quantity", type: "number", defaultValue: 1 },
        { key: "plannedStart", label: "Planned Start", type: "date", tableRender: (r: any) => r.plannedStart ? new Date(r.plannedStart).toLocaleDateString() : "" },
        { key: "plannedEnd", label: "Planned End", type: "date", showInTable: false },
        { key: "priority", label: "Priority", type: "number", defaultValue: 5 },
        { key: "status", label: "Status", type: "select", defaultValue: "planned",
          options: [
            { value: "planned", label: "Planned" },
            { value: "released", label: "Released" },
            { value: "in_progress", label: "In Progress" },
            { value: "completed", label: "Completed" },
          ],
          tableRender: (r: any) => <StatusBadge status={r.status} />,
        },
      ]}
    />
  );
}

/* ── Warehouse ────────────────────────────────────────── */

export function Warehouses() {
  return (
    <CrudPage
      title="Warehouses"
      subtitle="Warehouse master data"
      breadcrumb={[{ label: "Warehouse Management" }, { label: "Warehouses" }]}
      queryKey="warehouses"
      endpoint="/warehouse/warehouses"
      addLabel="New Warehouse"
      fields={[
        { key: "code", label: "Code", required: true },
        { key: "name", label: "Name", required: true },
        { key: "type", label: "Type", type: "select", defaultValue: "standard",
          options: [
            { value: "standard", label: "Standard" },
            { value: "cold", label: "Cold Storage" },
            { value: "hazmat", label: "Hazardous Materials" },
            { value: "staging", label: "Staging" },
          ],
        },
        { key: "plant", label: "Plant", tableRender: (r: any) => r.plant?.name, showInTable: true },
        { key: "plantId", label: "Plant ID", showInTable: false },
      ]}
    />
  );
}

export function WarehouseBins() {
  return (
    <CrudPage
      title="Warehouse Bins"
      subtitle="Storage location management"
      breadcrumb={[{ label: "Warehouse Management" }, { label: "Bins" }]}
      queryKey="warehouse-bins"
      endpoint="/warehouse/bins"
      addLabel="New Bin"
      fields={[
        { key: "binCode", label: "Bin Code", required: true },
        { key: "zone", label: "Zone" },
        { key: "aisle", label: "Aisle" },
        { key: "rack", label: "Rack", showInTable: false },
        { key: "level", label: "Level", showInTable: false },
        { key: "quantity", label: "Quantity", type: "number" },
        { key: "maxCapacity", label: "Max Capacity", type: "number", defaultValue: 1000, showInTable: false },
        { key: "binType", label: "Type", type: "select", defaultValue: "storage",
          options: [
            { value: "storage", label: "Storage" },
            { value: "picking", label: "Picking" },
            { value: "receiving", label: "Receiving" },
            { value: "shipping", label: "Shipping" },
          ],
        },
      ]}
    />
  );
}

/* ── Quality ──────────────────────────────────────────── */

export function InspectionLots() {
  return (
    <CrudPage
      title="Inspection Lots"
      subtitle="Quality inspection management"
      breadcrumb={[{ label: "Quality Management" }, { label: "Inspections" }]}
      queryKey="inspection-lots"
      endpoint="/quality/inspection-lots"
      addLabel="New Lot"
      fields={[
        { key: "lotNumber", label: "Lot #", required: true },
        { key: "materialId", label: "Material ID", showInTable: false },
        { key: "material", label: "Material", tableRender: (r: any) => r.material?.description },
        { key: "quantity", label: "Quantity", type: "number" },
        { key: "origin", label: "Origin", type: "select",
          options: [
            { value: "goods_receipt", label: "Goods Receipt" },
            { value: "production", label: "Production" },
            { value: "return", label: "Return" },
          ],
        },
        { key: "status", label: "Status", type: "select", defaultValue: "created",
          options: [
            { value: "created", label: "Created" },
            { value: "in_inspection", label: "In Inspection" },
            { value: "accepted", label: "Accepted" },
            { value: "rejected", label: "Rejected" },
          ],
          tableRender: (r: any) => <StatusBadge status={r.status} />,
        },
      ]}
    />
  );
}

export function NonConformances() {
  return (
    <CrudPage
      title="Non-Conformances"
      subtitle="Track quality issues and corrective actions"
      breadcrumb={[{ label: "Quality Management" }, { label: "Non-Conformances" }]}
      queryKey="non-conformances"
      endpoint="/quality/non-conformances"
      addLabel="New NC"
      fields={[
        { key: "ncNumber", label: "NC #", required: true },
        { key: "description", label: "Description", type: "textarea", required: true },
        { key: "severity", label: "Severity", type: "select", defaultValue: "minor",
          options: [
            { value: "minor", label: "Minor" },
            { value: "major", label: "Major" },
            { value: "critical", label: "Critical" },
          ],
          tableRender: (r: any) => <StatusBadge status={r.severity} />,
        },
        { key: "status", label: "Status", type: "select", defaultValue: "open",
          options: [
            { value: "open", label: "Open" },
            { value: "investigating", label: "Investigating" },
            { value: "corrective_action", label: "Corrective Action" },
            { value: "closed", label: "Closed" },
          ],
          tableRender: (r: any) => <StatusBadge status={r.status} />,
        },
        { key: "rootCause", label: "Root Cause", type: "textarea", showInTable: false },
        { key: "correctiveAction", label: "Corrective Action", type: "textarea", showInTable: false },
      ]}
    />
  );
}

/* ── Maintenance ──────────────────────────────────────── */

export function Equipment() {
  return (
    <CrudPage
      title="Equipment"
      subtitle="Equipment master records"
      breadcrumb={[{ label: "Plant Maintenance" }, { label: "Equipment" }]}
      queryKey="equipment"
      endpoint="/maintenance/equipment"
      searchPlaceholder="Search equipment..."
      addLabel="New Equipment"
      fields={[
        { key: "equipmentNumber", label: "Equipment #", required: true },
        { key: "description", label: "Description", required: true },
        { key: "category", label: "Category", type: "select",
          options: [
            { value: "machine", label: "Machine" },
            { value: "vehicle", label: "Vehicle" },
            { value: "instrument", label: "Instrument" },
            { value: "building", label: "Building" },
          ],
        },
        { key: "manufacturer", label: "Manufacturer" },
        { key: "status", label: "Status", type: "select", defaultValue: "active",
          options: [
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "under_maintenance", label: "Under Maintenance" },
            { value: "decommissioned", label: "Decommissioned" },
          ],
          tableRender: (r: any) => <StatusBadge status={r.status} />,
        },
        { key: "criticality", label: "Criticality", type: "select", defaultValue: "medium",
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "critical", label: "Critical" },
          ],
          showInTable: false,
        },
        { key: "plantId", label: "Plant ID", showInTable: false },
        { key: "plant", label: "Plant", tableRender: (r: any) => r.plant?.name },
        { key: "serialNumber", label: "Serial Number", showInTable: false },
        { key: "model", label: "Model", showInTable: false },
      ]}
    />
  );
}

export function WorkOrders() {
  return (
    <CrudPage
      title="Work Orders"
      subtitle="Maintenance work order management"
      breadcrumb={[{ label: "Plant Maintenance" }, { label: "Work Orders" }]}
      queryKey="work-orders"
      endpoint="/maintenance/work-orders"
      searchPlaceholder="Search work orders..."
      addLabel="New Work Order"
      fields={[
        { key: "woNumber", label: "WO #", required: true },
        { key: "description", label: "Description", required: true },
        { key: "type", label: "Type", type: "select",
          options: [
            { value: "corrective", label: "Corrective" },
            { value: "preventive", label: "Preventive" },
            { value: "inspection", label: "Inspection" },
            { value: "calibration", label: "Calibration" },
          ],
        },
        { key: "priority", label: "Priority", type: "select", defaultValue: "medium",
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "urgent", label: "Urgent" },
          ],
        },
        { key: "status", label: "Status", type: "select", defaultValue: "open",
          options: [
            { value: "open", label: "Open" },
            { value: "in_progress", label: "In Progress" },
            { value: "on_hold", label: "On Hold" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ],
          tableRender: (r: any) => <StatusBadge status={r.status} />,
        },
        { key: "equipmentId", label: "Equipment ID", showInTable: false },
        { key: "equipment", label: "Equipment", tableRender: (r: any) => r.equipment?.description },
        { key: "plannedStart", label: "Planned Start", type: "date", showInTable: false },
        { key: "plannedEnd", label: "Planned End", type: "date", showInTable: false },
        { key: "estimatedHours", label: "Est. Hours", type: "number", showInTable: false },
      ]}
    />
  );
}

/* ── HR Sub-pages ─────────────────────────────────────── */

export function OrgUnits() {
  return (
    <CrudPage
      title="Org Structure"
      subtitle="Organizational hierarchy"
      breadcrumb={[{ label: "Human Resources" }, { label: "Org Structure" }]}
      queryKey="org-units"
      endpoint="/hr/org-units"
      addLabel="New Org Unit"
      fields={[
        { key: "code", label: "Code", required: true },
        { key: "name", label: "Name", required: true },
        { key: "parent", label: "Parent", tableRender: (r: any) => r.parent?.name || "—" },
        { key: "parentId", label: "Parent ID", showInTable: false },
      ]}
    />
  );
}

export function LeaveRequests() {
  return (
    <CrudPage
      title="Leave Requests"
      subtitle="Employee leave management"
      breadcrumb={[{ label: "Human Resources" }, { label: "Leave Requests" }]}
      queryKey="leave-requests"
      endpoint="/hr/leave-requests"
      addLabel="New Request"
      fields={[
        { key: "employee", label: "Employee", tableRender: (r: any) => `${r.employee?.firstName} ${r.employee?.lastName}` },
        { key: "employeeId", label: "Employee ID", showInTable: false },
        { key: "leaveType", label: "Type", type: "select",
          options: [
            { value: "annual", label: "Annual" },
            { value: "sick", label: "Sick" },
            { value: "personal", label: "Personal" },
            { value: "maternity", label: "Maternity" },
            { value: "unpaid", label: "Unpaid" },
          ],
        },
        { key: "startDate", label: "Start Date", type: "date", tableRender: (r: any) => r.startDate ? new Date(r.startDate).toLocaleDateString() : "" },
        { key: "endDate", label: "End Date", type: "date", tableRender: (r: any) => r.endDate ? new Date(r.endDate).toLocaleDateString() : "" },
        { key: "days", label: "Days", type: "number" },
        { key: "status", label: "Status", type: "select", defaultValue: "pending",
          options: [
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
          ],
          tableRender: (r: any) => <StatusBadge status={r.status} />,
        },
        { key: "reason", label: "Reason", type: "textarea", showInTable: false },
      ]}
    />
  );
}

export function TimeEntries() {
  return (
    <CrudPage
      title="Time Entries"
      subtitle="Employee time tracking"
      breadcrumb={[{ label: "Human Resources" }, { label: "Time Entries" }]}
      queryKey="time-entries"
      endpoint="/hr/time-entries"
      addLabel="New Entry"
      fields={[
        { key: "employee", label: "Employee", tableRender: (r: any) => `${r.employee?.firstName} ${r.employee?.lastName}` },
        { key: "employeeId", label: "Employee ID", showInTable: false },
        { key: "date", label: "Date", type: "date", tableRender: (r: any) => r.date ? new Date(r.date).toLocaleDateString() : "" },
        { key: "hoursWorked", label: "Hours", type: "number" },
        { key: "overtime", label: "Overtime", type: "number", defaultValue: 0 },
        { key: "project", label: "Project" },
        { key: "activity", label: "Activity", showInTable: false },
        { key: "status", label: "Status", type: "select", defaultValue: "draft",
          options: [
            { value: "draft", label: "Draft" },
            { value: "submitted", label: "Submitted" },
            { value: "approved", label: "Approved" },
          ],
          tableRender: (r: any) => <StatusBadge status={r.status} />,
        },
      ]}
    />
  );
}

/* ── Controlling ──────────────────────────────────────── */

export function CostCenters() {
  return (
    <CrudPage
      title="Cost Centers"
      subtitle="Cost center management"
      breadcrumb={[{ label: "Controlling" }, { label: "Cost Centers" }]}
      queryKey="cost-centers"
      endpoint="/controlling/cost-centers"
      addLabel="New Cost Center"
      fields={[
        { key: "code", label: "Code", required: true },
        { key: "name", label: "Name", required: true },
        { key: "category", label: "Category", type: "select",
          options: [
            { value: "production", label: "Production" },
            { value: "admin", label: "Administration" },
            { value: "sales", label: "Sales" },
            { value: "research", label: "Research" },
          ],
        },
        { key: "description", label: "Description", showInTable: false },
      ]}
    />
  );
}

export function InternalOrders() {
  return (
    <CrudPage
      title="Internal Orders"
      subtitle="Overhead and investment order tracking"
      breadcrumb={[{ label: "Controlling" }, { label: "Internal Orders" }]}
      queryKey="internal-orders"
      endpoint="/controlling/internal-orders"
      addLabel="New Order"
      fields={[
        { key: "orderNumber", label: "Order #", required: true },
        { key: "description", label: "Description", required: true },
        { key: "type", label: "Type", type: "select",
          options: [
            { value: "overhead", label: "Overhead" },
            { value: "investment", label: "Investment" },
            { value: "accrual", label: "Accrual" },
          ],
        },
        { key: "budget", label: "Budget", type: "number", tableRender: (r: any) => `$${(r.budget || 0).toLocaleString()}` },
        { key: "actualCost", label: "Actual Cost", type: "number", tableRender: (r: any) => `$${(r.actualCost || 0).toLocaleString()}` },
        { key: "status", label: "Status", type: "select", defaultValue: "open",
          options: [
            { value: "open", label: "Open" },
            { value: "released", label: "Released" },
            { value: "closed", label: "Closed" },
            { value: "locked", label: "Locked" },
          ],
          tableRender: (r: any) => <StatusBadge status={r.status} />,
        },
      ]}
    />
  );
}
