import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import KPICard from "../../components/KPICard";
import StatusBadge from "../../components/StatusBadge";
import { FormInput, FormSelect } from "../../components/FormField";
import {
  Package,
  Truck,
  CheckCircle,
  DollarSign,
  Plus,
  Loader2,
  Send,
} from "lucide-react";

interface Shipment {
  id: string;
  shipmentNumber?: string;
  type?: string;
  carrier?: string;
  mode?: string;
  originAddress?: string;
  destAddress?: string;
  status?: string;
  freightCost?: number;
}

interface CostAnalysis {
  byCarrier?: { carrier: string; cost: number }[];
  byMode?: { mode: string; cost: number }[];
}

const SHIPMENT_TYPES = [
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
  { value: "transfer", label: "Transfer" },
];

const MODES = [
  { value: "truck", label: "Truck" },
  { value: "rail", label: "Rail" },
  { value: "air", label: "Air" },
  { value: "sea", label: "Sea" },
  { value: "courier", label: "Courier" },
];

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function TransportDashboard() {
  const queryClient = useQueryClient();
  const [showCreateShipment, setShowCreateShipment] = useState(false);
  const [shipmentForm, setShipmentForm] = useState({
    type: "outbound",
    carrier: "",
    mode: "truck",
    originAddress: "",
    destAddress: "",
    referenceDoc: "",
    weight: "",
    volume: "",
    freightCost: "",
    plannedDate: "",
  });

  const { data: shipments = [], isLoading: shipmentsLoading } = useQuery({
    queryKey: ["transport-shipments"],
    queryFn: () => api.get<Shipment[] | { data?: Shipment[] }>("/transport/shipments"),
  });

  const { data: costAnalysis } = useQuery({
    queryKey: ["transport-cost-analysis"],
    queryFn: () => api.get<CostAnalysis>("/transport/cost-analysis"),
  });

  const createShipmentMutation = useMutation({
    mutationFn: (data: Record<string, string | number>) => api.post("/transport/shipments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport-shipments"] });
      queryClient.invalidateQueries({ queryKey: ["transport-cost-analysis"] });
      setShowCreateShipment(false);
      setShipmentForm({
        type: "outbound",
        carrier: "",
        mode: "truck",
        originAddress: "",
        destAddress: "",
        referenceDoc: "",
        weight: "",
        volume: "",
        freightCost: "",
        plannedDate: "",
      });
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: (id: string) => api.post(`/transport/shipments/${id}/dispatch`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transport-shipments"] }),
  });

  const deliverMutation = useMutation({
    mutationFn: (id: string) => api.post(`/transport/shipments/${id}/deliver`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transport-shipments"] }),
  });

  const shipmentList = Array.isArray(shipments) ? shipments : (shipments as { data?: Shipment[] })?.data ?? [];
  const activeShipments = shipmentList.filter((s) => s.status === "dispatched" || s.status === "in_transit").length;
  const inTransit = shipmentList.filter((s) => s.status === "in_transit").length;
  const deliveredThisMonth = shipmentList.filter((s) => s.status === "delivered").length;
  const totalFreightCost = shipmentList.reduce((s, sh) => s + (sh.freightCost ?? 0), 0);

  const byCarrier = costAnalysis?.byCarrier ?? [];
  const byMode = costAnalysis?.byMode ?? [];

  return (
    <div>
      <PageHeader
        title="Transport & Logistics"
        breadcrumb={[{ label: "Home", path: "/" }, { label: "Transport" }]}
        children={
          <button className="btn-primary btn-sm" onClick={() => setShowCreateShipment(true)}>
            <Plus className="w-3.5 h-3.5" /> Create Shipment
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="Active Shipments" value={activeShipments} icon={Package} color="blue" />
        <KPICard title="In Transit" value={inTransit} icon={Truck} color="purple" />
        <KPICard title="Delivered This Month" value={deliveredThisMonth} icon={CheckCircle} color="green" />
        <KPICard title="Total Freight Cost" value={`$${totalFreightCost.toLocaleString()}`} icon={DollarSign} color="yellow" />
      </div>

      <div className="card mb-6">
        <div className="p-4">
          <DataTable<Shipment>
            columns={[
              { key: "shipmentNumber", label: "Shipment #", render: (r) => r.shipmentNumber ?? r.id },
              { key: "type", label: "Type", render: (r) => <StatusBadge status={r.type ?? "unknown"} /> },
              { key: "carrier", label: "Carrier" },
              { key: "mode", label: "Mode" },
              { key: "originAddress", label: "Origin" },
              { key: "destAddress", label: "Destination" },
              { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status ?? "pending"} /> },
              { key: "freightCost", label: "Freight Cost", render: (r) => `$${(r.freightCost ?? 0).toLocaleString()}` },
              {
                key: "actions",
                label: "Actions",
                render: (r) => (
                  <div className="flex gap-2">
                    <button
                      className="btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatchMutation.mutate(r.id);
                      }}
                      disabled={dispatchMutation.isPending || r.status === "delivered"}
                    >
                      {dispatchMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Dispatch
                    </button>
                    <button
                      className="btn-primary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deliverMutation.mutate(r.id);
                      }}
                      disabled={deliverMutation.isPending || r.status === "delivered"}
                    >
                      Deliver
                    </button>
                  </div>
                ),
              },
            ]}
            data={shipmentList}
            isLoading={shipmentsLoading}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Cost by Carrier</h3>
          {byCarrier.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byCarrier}>
                <XAxis dataKey="carrier" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="cost" fill="#3b82f6" name="Cost" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No cost data by carrier
            </div>
          )}
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Cost by Mode</h3>
          {byMode.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={byMode}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="cost"
                  nameKey="mode"
                  label={({ mode, cost }) => `${mode}: $${(cost ?? 0).toLocaleString()}`}
                >
                  {byMode.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No cost data by mode
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showCreateShipment}
        onClose={() => setShowCreateShipment(false)}
        title="Create Shipment"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowCreateShipment(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={() =>
                createShipmentMutation.mutate({
                  type: shipmentForm.type,
                  carrier: shipmentForm.carrier,
                  mode: shipmentForm.mode,
                  originAddress: shipmentForm.originAddress,
                  destAddress: shipmentForm.destAddress,
                  referenceDoc: shipmentForm.referenceDoc,
                  weight: Number(shipmentForm.weight) || undefined,
                  volume: Number(shipmentForm.volume) || undefined,
                  freightCost: Number(shipmentForm.freightCost) || undefined,
                  plannedDate: shipmentForm.plannedDate || undefined,
                })
              }
              disabled={createShipmentMutation.isPending || !shipmentForm.carrier}
            >
              {createShipmentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormSelect
            label="Type"
            value={shipmentForm.type}
            onChange={(e) => setShipmentForm((f) => ({ ...f, type: e.target.value }))}
            options={SHIPMENT_TYPES}
          />
          <FormInput label="Carrier" value={shipmentForm.carrier} onChange={(e) => setShipmentForm((f) => ({ ...f, carrier: e.target.value }))} required />
          <FormSelect
            label="Mode"
            value={shipmentForm.mode}
            onChange={(e) => setShipmentForm((f) => ({ ...f, mode: e.target.value }))}
            options={MODES}
          />
          <FormInput label="Reference Doc" value={shipmentForm.referenceDoc} onChange={(e) => setShipmentForm((f) => ({ ...f, referenceDoc: e.target.value }))} />
          <FormInput label="Weight" type="number" value={shipmentForm.weight} onChange={(e) => setShipmentForm((f) => ({ ...f, weight: e.target.value }))} />
          <FormInput label="Volume" type="number" value={shipmentForm.volume} onChange={(e) => setShipmentForm((f) => ({ ...f, volume: e.target.value }))} />
          <FormInput label="Freight Cost" type="number" value={shipmentForm.freightCost} onChange={(e) => setShipmentForm((f) => ({ ...f, freightCost: e.target.value }))} />
          <FormInput label="Planned Date" type="date" value={shipmentForm.plannedDate} onChange={(e) => setShipmentForm((f) => ({ ...f, plannedDate: e.target.value }))} />
          <div className="md:col-span-2">
            <FormInput label="Origin Address" value={shipmentForm.originAddress} onChange={(e) => setShipmentForm((f) => ({ ...f, originAddress: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <FormInput label="Destination Address" value={shipmentForm.destAddress} onChange={(e) => setShipmentForm((f) => ({ ...f, destAddress: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
