import { Prisma } from "@prisma/client";

const TENANT_SCOPED_MODELS = new Set([
  "User", "Role", "AuditLog", "CompanyCode", "GLAccount", "JournalEntry",
  "Vendor", "Customer", "Plant", "Material", "PurchaseOrder", "SalesOrder",
  "BillOfMaterial", "ProductionOrder", "Warehouse", "Equipment", "WorkOrder",
  "Employee", "CostCenter", "InternalOrder", "WorkflowDefinition", "Exercise",
  "Scenario", "InspectionLot", "NonConformance", "SavedReport", "MrpRun", "DemandForecast",
  "PlannedOrder", "WorkCenter", "ProductionSchedule", "SupplyChainNode",
  "SupplyChainLink", "ProcessEvent", "InventoryPolicy", "UserXP",
  "OperationsMetric", "FiscalPeriod", "PurchaseRequisition", "SupplierInvoice",
  "Payment", "PricingCondition", "Shipment", "Asset", "CostEstimate",
  "ERPEvent", "SimulationSession", "InstructorAction", "Company",
  "IntercompanyTransaction", "TransferPricingRule", "FinancialStatement",
  "ClosingPeriod", "PortalAccess", "FactSales", "FactInventory",
  "OptimizationRun", "IntegrationEndpoint", "IntegrationLog", "Document",
  "Course", "Certification", "DatasetTemplate", "ProcessFlow",
  "DigitalTwinState", "DecisionImpact", "BenchmarkRun", "StressTest",
  "UserPresence", "Notification", "UserProfile", "StudentCompany",
  "GameSession", "BackgroundJob",
]);

/**
 * Prisma Client extension for tenant isolation (Prisma 6+ compatible).
 * Safety net: blocks creates without tenantId, strips tenantId from updates.
 */
export const tenantIsolationExtension = Prisma.defineExtension({
  query: {
    $allModels: {
      async create({ model, args, query }) {
        if (TENANT_SCOPED_MODELS.has(model) && args.data && !(args.data as Record<string, unknown>).tenantId) {
          throw new Error(`Tenant isolation violation: ${model}.create() called without tenantId`);
        }
        return query(args);
      },
      async createMany({ model, args, query }) {
        if (TENANT_SCOPED_MODELS.has(model) && args.data) {
          const items = Array.isArray(args.data) ? args.data : [args.data];
          for (const item of items) {
            if (!(item as Record<string, unknown>).tenantId) {
              throw new Error(`Tenant isolation violation: ${model}.createMany() called without tenantId`);
            }
          }
        }
        return query(args);
      },
      async update({ model, args, query }) {
        if (TENANT_SCOPED_MODELS.has(model) && args.data && (args.data as Record<string, unknown>).tenantId !== undefined) {
          delete (args.data as Record<string, unknown>).tenantId;
        }
        return query(args);
      },
      async updateMany({ model, args, query }) {
        if (TENANT_SCOPED_MODELS.has(model) && args.data && (args.data as Record<string, unknown>).tenantId !== undefined) {
          delete (args.data as Record<string, unknown>).tenantId;
        }
        return query(args);
      },
    },
  },
});
