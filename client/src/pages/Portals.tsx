import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../stores/auth";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { FormInput, FormSelect } from "../components/FormField";
import {
  Truck,
  Users,
  Shield,
  Plus,
  Loader2,
  ChevronDown,
  ChevronRight,
  Package,
  FileText,
  CheckCircle,
} from "lucide-react";

type TabId = "supplier" | "customer" | "access";

interface Vendor {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  orderDate: string;
  status: string;
  items?: { quantity: number; receivedQty: number; material?: { description: string } }[];
  vendor?: { name: string };
}

interface SupplierInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate?: string;
}

interface SalesOrder {
  id: string;
  soNumber: string;
  orderDate: string;
  status: string;
  total?: number;
  items?: { quantity: number; material?: { description: string } }[];
  customer?: { name: string };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  paid?: boolean;
}

interface Shipment {
  id: string;
  shipmentNumber?: string;
  carrier?: string;
  status: string;
  trackingNumber?: string;
  plannedDate?: string;
}

interface PortalAccess {
  id: string;
  portalType: string;
  externalId: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLogin: string | null;
}

const CARD_CLASS = "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700";
const BTN_CLASS = "bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50";

export default function Portals() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const isAdmin = hasRole("admin") || hasRole("instructor");

  const [activeTab, setActiveTab] = useState<TabId>("supplier");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [showGrantAccess, setShowGrantAccess] = useState(false);
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);

  const [grantForm, setGrantForm] = useState({
    portalType: "supplier",
    externalId: "",
    email: "",
    name: "",
    permissions: [] as string[],
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-list"],
    queryFn: () => api.get<{ data?: Vendor[] } | Vendor[]>("/finance/vendors").then((r) => ("data" in r && r.data) ? r.data : (Array.isArray(r) ? r : [])),
    enabled: activeTab === "supplier" || showGrantAccess,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: () => api.get<{ data?: Customer[] } | Customer[]>("/finance/customers").then((r) => ("data" in r && r.data) ? r.data : (Array.isArray(r) ? r : [])),
    enabled: activeTab === "customer" || showGrantAccess,
  });

  const { data: supplierOrders = [], isLoading: supplierOrdersLoading } = useQuery({
    queryKey: ["portals", "supplier", "orders", selectedVendorId],
    queryFn: () => api.get<PurchaseOrder[]>(`/portals/supplier/${selectedVendorId}/orders`),
    enabled: activeTab === "supplier" && !!selectedVendorId,
  });

  const { data: supplierInvoices = [] } = useQuery({
    queryKey: ["portals", "supplier", "invoices", selectedVendorId],
    queryFn: () => api.get<SupplierInvoice[]>(`/portals/supplier/${selectedVendorId}/invoices`),
    enabled: activeTab === "supplier" && !!selectedVendorId,
  });

  const { data: customerOrders = [] } = useQuery({
    queryKey: ["portals", "customer", "orders", selectedCustomerId],
    queryFn: () => api.get<SalesOrder[]>(`/portals/customer/${selectedCustomerId}/orders`),
    enabled: activeTab === "customer" && !!selectedCustomerId,
  });

  const { data: customerInvoices = [] } = useQuery({
    queryKey: ["portals", "customer", "invoices", selectedCustomerId],
    queryFn: () => api.get<Invoice[]>(`/portals/customer/${selectedCustomerId}/invoices`),
    enabled: activeTab === "customer" && !!selectedCustomerId,
  });

  const { data: customerShipments = [] } = useQuery({
    queryKey: ["portals", "customer", "shipments", selectedCustomerId],
    queryFn: () => api.get<Shipment[]>(`/portals/customer/${selectedCustomerId}/shipments`),
    enabled: activeTab === "customer" && !!selectedCustomerId,
  });

  const { data: supplierAccesses = [] } = useQuery({
    queryKey: ["portals", "access", "supplier"],
    queryFn: () => api.get<PortalAccess[]>("/portals/supplier"),
    enabled: activeTab === "access" && isAdmin,
  });

  const { data: customerAccesses = [] } = useQuery({
    queryKey: ["portals", "access", "customer"],
    queryFn: () => api.get<PortalAccess[]>("/portals/customer"),
    enabled: activeTab === "access" && isAdmin,
  });

  const confirmDeliveryMutation = useMutation({
    mutationFn: (poId: string) =>
      api.post(`/portals/supplier/${selectedVendorId}/confirm-delivery`, { poId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portals", "supplier"] }),
  });

  const grantAccessMutation = useMutation({
    mutationFn: (data: Record<string, string | string[]>) =>
      api.post("/portals/grant-access", { ...data, permissions: grantForm.permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portals", "access"] });
      setShowGrantAccess(false);
      setGrantForm({ portalType: "supplier", externalId: "", email: "", name: "", permissions: [] });
    },
  });

  const revokeAccessMutation = useMutation({
    mutationFn: (id: string) => api.put(`/portals/${id}/revoke`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portals", "access"] }),
  });

  const allAccesses = [...(supplierAccesses as PortalAccess[]), ...(customerAccesses as PortalAccess[])];

  const vendorList = Array.isArray(vendors) ? vendors : [];
  const customerList = Array.isArray(customers) ? customers : [];

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "supplier", label: "Supplier Portal", icon: Truck },
    { id: "customer", label: "Customer Portal", icon: Users },
    { id: "access", label: "Access Management", icon: Shield },
  ];

  return (
    <div>
      <PageHeader title="Portals" subtitle="Supplier and customer portal views with access management" />

      <div className={`${CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-gray-200 dark:border-gray-700 flex gap-1 p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Supplier Portal Tab */}
        {activeTab === "supplier" && (
          <div className="p-4">
            <div className="mb-4">
              <label className="label">Select Vendor</label>
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="input max-w-md"
              >
                <option value="">Select vendor...</option>
                {vendorList.map((v: Vendor) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            {selectedVendorId && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" /> Purchase Orders
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">PO #</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Amount</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierOrdersLoading ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center">
                              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                            </td>
                          </tr>
                        ) : (
                          (supplierOrders as PurchaseOrder[]).map((po) => (
                            <React.Fragment key={po.id}>
                              <tr className="border-b border-gray-100 dark:border-gray-700">
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => setExpandedPoId(expandedPoId === po.id ? null : po.id)}
                                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                                  >
                                    {expandedPoId === po.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    {po.poNumber}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{po.orderDate ? new Date(po.orderDate).toLocaleDateString() : "-"}</td>
                                <td className="px-4 py-3">-</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs ${po.status === "received" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                    {po.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {po.status !== "received" && po.status !== "cancelled" && isAdmin && (
                                    <button
                                      onClick={() => confirmDeliveryMutation.mutate(po.id)}
                                      disabled={confirmDeliveryMutation.isPending}
                                      className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-xs font-medium flex items-center gap-1"
                                    >
                                      <CheckCircle className="w-3 h-3" /> Confirm Delivery
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {expandedPoId === po.id && Array.isArray(po.items) && po.items.length > 0 && (
                                <tr className="bg-gray-50 dark:bg-gray-700/30">
                                  <td colSpan={5} className="px-4 py-3">
                                    <div className="text-sm space-y-1">
                                      {po.items.map((item, i) => (
                                        <div key={i} className="flex justify-between">
                                          <span>{item.material?.description ?? "Item"}</span>
                                          <span>Qty: {item.quantity} (Received: {item.receivedQty ?? 0})</span>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Invoices
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Invoice #</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Amount</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Due Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(supplierInvoices as SupplierInvoice[]).map((inv) => (
                          <tr key={inv.id} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="px-4 py-3 font-medium">{inv.invoiceNumber}</td>
                            <td className="px-4 py-3">${(inv.amount ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs ${inv.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                {inv.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Customer Portal Tab */}
        {activeTab === "customer" && (
          <div className="p-4">
            <div className="mb-4">
              <label className="label">Select Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="input max-w-md"
              >
                <option value="">Select customer...</option>
                {customerList.map((c: Customer) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {selectedCustomerId && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Orders</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">SO #</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Total</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(customerOrders as SalesOrder[]).map((so) => (
                          <tr key={so.id} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="px-4 py-3 font-medium">{so.soNumber}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{so.orderDate ? new Date(so.orderDate).toLocaleDateString() : "-"}</td>
                            <td className="px-4 py-3">${(so.total ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs ${so.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                {so.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Invoices</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Invoice #</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Amount</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(customerInvoices as Invoice[]).map((inv) => (
                          <tr key={inv.id} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="px-4 py-3 font-medium">{inv.invoiceNumber}</td>
                            <td className="px-4 py-3">${(inv.amount ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs ${inv.paid || inv.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                {inv.paid || inv.status === "paid" ? "Paid" : "Unpaid"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Shipments</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Shipment #</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Carrier</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                          <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Tracking</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(customerShipments as Shipment[]).map((s) => (
                          <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="px-4 py-3 font-medium">{s.shipmentNumber ?? s.id.slice(0, 8)}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.carrier ?? "-"}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs ${s.status === "delivered" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.trackingNumber ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Access Management Tab */}
        {activeTab === "access" && (
          <div className="p-4">
            {!isAdmin ? (
              <p className="text-gray-500 dark:text-gray-400">Access management is restricted to administrators.</p>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Portal Accesses</h3>
                  <button onClick={() => setShowGrantAccess(true)} className={`${BTN_CLASS} flex items-center gap-2`}>
                    <Plus className="w-4 h-4" /> Grant Access
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Name</th>
                        <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Email</th>
                        <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                        <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">External ID</th>
                        <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                        <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Last Login</th>
                        <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allAccesses.map((a) => (
                        <tr key={a.id} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{a.name}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{a.email}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs ${a.portalType === "supplier" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}>
                              {a.portalType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{a.externalId}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs ${a.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                              {a.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                            {a.lastLogin ? new Date(a.lastLogin).toLocaleString() : "Never"}
                          </td>
                          <td className="px-4 py-3">
                            {a.isActive && (
                              <button
                                onClick={() => revokeAccessMutation.mutate(a.id)}
                                disabled={revokeAccessMutation.isPending}
                                className="text-red-600 hover:text-red-700 text-xs font-medium"
                              >
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Grant Access Modal */}
      <Modal
        isOpen={showGrantAccess}
        onClose={() => setShowGrantAccess(false)}
        title="Grant Portal Access"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowGrantAccess(false)}>Cancel</button>
            <button
              className={BTN_CLASS}
              onClick={() => grantAccessMutation.mutate({
                portalType: grantForm.portalType,
                externalId: grantForm.externalId,
                email: grantForm.email,
                name: grantForm.name,
              })}
              disabled={grantAccessMutation.isPending || !grantForm.externalId || !grantForm.email || !grantForm.name}
            >
              {grantAccessMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Grant Access
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormSelect
            label="Portal Type"
            value={grantForm.portalType}
            onChange={(e) => {
              setGrantForm((f) => ({ ...f, portalType: e.target.value, externalId: "" }));
            }}
            options={[
              { value: "supplier", label: "Supplier" },
              { value: "customer", label: "Customer" },
            ]}
          />
          <FormSelect
            label={grantForm.portalType === "supplier" ? "Vendor" : "Customer"}
            value={grantForm.externalId}
            onChange={(e) => setGrantForm((f) => ({ ...f, externalId: e.target.value }))}
            options={[
              { value: "", label: "Select..." },
              ...(grantForm.portalType === "supplier"
                ? vendorList.map((v: Vendor) => ({ value: v.id, label: v.name }))
                : customerList.map((c: Customer) => ({ value: c.id, label: c.name })))
            ]}
          />
          <FormInput label="Email" type="email" value={grantForm.email} onChange={(e) => setGrantForm((f) => ({ ...f, email: e.target.value }))} required />
          <FormInput label="Name" value={grantForm.name} onChange={(e) => setGrantForm((f) => ({ ...f, name: e.target.value }))} required />
          <div>
            <label className="label">Permissions</label>
            <div className="space-y-2">
              {["view_orders", "view_invoices", "confirm_delivery"].map((p) => (
                <label key={p} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={grantForm.permissions.includes(p)}
                    onChange={(e) =>
                      setGrantForm((f) => ({
                        ...f,
                        permissions: e.target.checked ? [...f.permissions, p] : f.permissions.filter((x) => x !== p),
                      }))
                    }
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{p.replace(/_/g, " ")}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
