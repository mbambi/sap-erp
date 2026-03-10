import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ReferenceLine,
} from "recharts";
import { Play, RotateCcw, Settings2, TrendingDown, TrendingUp, AlertTriangle, Package, DollarSign } from "lucide-react";
import PageHeader from "../../components/PageHeader";

interface SimConfig {
  policy: "eoq" | "ss" | "min_max" | "periodic_review";
  dailyDemandMean: number;
  dailyDemandStd: number;
  leadTimeDays: number;
  orderingCost: number;
  holdingCostPerUnit: number;
  stockoutCostPerUnit: number;
  unitCost: number;
  initialStock: number;
  simulationDays: number;
  reorderPoint: number;
  maxStock: number;
  fixedOrderQty: number;
  reviewPeriodDays: number;
}

function gaussianRandom(mean: number, std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function runSimulation(config: SimConfig) {
  const {
    policy, dailyDemandMean, dailyDemandStd, leadTimeDays, orderingCost,
    holdingCostPerUnit, stockoutCostPerUnit, initialStock, simulationDays,
    reorderPoint, maxStock, fixedOrderQty, reviewPeriodDays, unitCost,
  } = config;

  // EOQ calculation
  const annualDemand = dailyDemandMean * 365;
  const eoq = Math.ceil(Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit));

  let stock = initialStock;
  const pendingOrders: { arrivalDay: number; qty: number }[] = [];
  const results: any[] = [];

  let totalHoldingCost = 0;
  let totalOrderingCost = 0;
  let totalStockoutCost = 0;
  let totalOrders = 0;
  let stockoutDays = 0;
  let totalDemand = 0;
  let totalFulfilled = 0;

  for (let day = 1; day <= simulationDays; day++) {
    // Receive orders
    const arriving = pendingOrders.filter((o) => o.arrivalDay === day);
    for (const order of arriving) {
      stock += order.qty;
    }

    // Generate demand
    const demand = Math.max(0, Math.round(gaussianRandom(dailyDemandMean, dailyDemandStd)));
    totalDemand += demand;

    // Fulfill demand
    const fulfilled = Math.min(stock, demand);
    const unfulfilled = demand - fulfilled;
    stock -= fulfilled;
    totalFulfilled += fulfilled;

    if (unfulfilled > 0) stockoutDays++;

    // Costs
    const holdingCost = Math.max(0, stock) * holdingCostPerUnit / 365;
    const stockoutCost = unfulfilled * stockoutCostPerUnit;
    totalHoldingCost += holdingCost;
    totalStockoutCost += stockoutCost;

    // Reorder logic
    let orderQty = 0;
    switch (policy) {
      case "eoq":
        if (stock <= reorderPoint && !pendingOrders.some((o) => o.arrivalDay > day)) {
          orderQty = eoq;
        }
        break;
      case "ss":
        if (stock <= reorderPoint && !pendingOrders.some((o) => o.arrivalDay > day)) {
          orderQty = maxStock - stock;
        }
        break;
      case "min_max":
        if (stock <= reorderPoint) {
          orderQty = maxStock - stock;
        }
        break;
      case "periodic_review":
        if (day % reviewPeriodDays === 0) {
          orderQty = Math.max(0, maxStock - stock);
        }
        break;
    }

    if (orderQty > 0) {
      pendingOrders.push({ arrivalDay: day + leadTimeDays, qty: orderQty });
      totalOrderingCost += orderingCost;
      totalOrders++;
    }

    results.push({
      day,
      stock: Math.max(0, stock),
      demand,
      fulfilled,
      unfulfilled,
      reorderPoint,
      orderPlaced: orderQty > 0 ? orderQty : null,
      holdingCost: Math.round(totalHoldingCost),
      orderingCost: Math.round(totalOrderingCost),
      stockoutCost: Math.round(totalStockoutCost),
    });
  }

  return {
    daily: results,
    summary: {
      totalCost: Math.round(totalHoldingCost + totalOrderingCost + totalStockoutCost),
      holdingCost: Math.round(totalHoldingCost),
      orderingCost: Math.round(totalOrderingCost),
      stockoutCost: Math.round(totalStockoutCost),
      serviceLevel: totalDemand > 0 ? Math.round((totalFulfilled / totalDemand) * 10000) / 100 : 100,
      avgStock: Math.round(results.reduce((s, r) => s + r.stock, 0) / simulationDays),
      totalOrders,
      stockoutDays,
      eoq,
      inventoryTurnover: totalDemand > 0 ? Math.round((totalFulfilled * unitCost) / (results.reduce((s, r) => s + r.stock, 0) / simulationDays * unitCost || 1) * 100) / 100 : 0,
    },
  };
}

export default function InventorySimulator() {
  const [config, setConfig] = useState<SimConfig>({
    policy: "eoq",
    dailyDemandMean: 20,
    dailyDemandStd: 5,
    leadTimeDays: 7,
    orderingCost: 50,
    holdingCostPerUnit: 2,
    stockoutCostPerUnit: 10,
    unitCost: 25,
    initialStock: 200,
    simulationDays: 180,
    reorderPoint: 150,
    maxStock: 500,
    fixedOrderQty: 200,
    reviewPeriodDays: 14,
  });

  const [results, setResults] = useState<ReturnType<typeof runSimulation> | null>(null);

  const handleRun = () => setResults(runSimulation(config));
  const handleReset = () => { setResults(null); };

  const update = (key: keyof SimConfig, value: any) => setConfig({ ...config, [key]: value });

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Policy Simulator" subtitle="Compare EOQ, (s,S), min-max, and periodic review policies" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Controls */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary-600" /> Configuration
          </h3>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Policy</label>
            <select value={config.policy} onChange={(e) => update("policy", e.target.value)} className="input text-sm">
              <option value="eoq">EOQ (Economic Order Quantity)</option>
              <option value="ss">(s,S) Policy</option>
              <option value="min_max">Min-Max</option>
              <option value="periodic_review">Periodic Review</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Avg Demand/Day</label>
              <input type="number" value={config.dailyDemandMean} onChange={(e) => update("dailyDemandMean", +e.target.value)} className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Demand Std Dev</label>
              <input type="number" value={config.dailyDemandStd} onChange={(e) => update("dailyDemandStd", +e.target.value)} className="input text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lead Time (days)</label>
              <input type="number" value={config.leadTimeDays} onChange={(e) => update("leadTimeDays", +e.target.value)} className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Initial Stock</label>
              <input type="number" value={config.initialStock} onChange={(e) => update("initialStock", +e.target.value)} className="input text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reorder Point</label>
              <input type="number" value={config.reorderPoint} onChange={(e) => update("reorderPoint", +e.target.value)} className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Stock</label>
              <input type="number" value={config.maxStock} onChange={(e) => update("maxStock", +e.target.value)} className="input text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ordering Cost ($)</label>
              <input type="number" value={config.orderingCost} onChange={(e) => update("orderingCost", +e.target.value)} className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Holding $/unit/yr</label>
              <input type="number" value={config.holdingCostPerUnit} onChange={(e) => update("holdingCostPerUnit", +e.target.value)} className="input text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stockout $/unit</label>
              <input type="number" value={config.stockoutCostPerUnit} onChange={(e) => update("stockoutCostPerUnit", +e.target.value)} className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sim Days</label>
              <input type="number" value={config.simulationDays} onChange={(e) => update("simulationDays", +e.target.value)} className="input text-sm" />
            </div>
          </div>

          {config.policy === "periodic_review" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Review Period (days)</label>
              <input type="number" value={config.reviewPeriodDays} onChange={(e) => update("reviewPeriodDays", +e.target.value)} className="input text-sm" />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={handleRun} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
              <Play className="w-4 h-4" /> Run
            </button>
            <button onClick={handleReset} className="btn-secondary px-3"><RotateCcw className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-3 space-y-6">
          {results ? (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="bg-white rounded-xl border p-4">
                  <DollarSign className="w-4 h-4 text-blue-600 mb-1" />
                  <p className="text-xl font-bold">${results.summary.totalCost.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500">Total Cost</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <TrendingUp className="w-4 h-4 text-green-600 mb-1" />
                  <p className="text-xl font-bold">{results.summary.serviceLevel}%</p>
                  <p className="text-[10px] text-gray-500">Service Level</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <Package className="w-4 h-4 text-purple-600 mb-1" />
                  <p className="text-xl font-bold">{results.summary.avgStock}</p>
                  <p className="text-[10px] text-gray-500">Avg Inventory</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <AlertTriangle className="w-4 h-4 text-red-600 mb-1" />
                  <p className="text-xl font-bold">{results.summary.stockoutDays}</p>
                  <p className="text-[10px] text-gray-500">Stockout Days</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <TrendingDown className="w-4 h-4 text-amber-600 mb-1" />
                  <p className="text-xl font-bold">{results.summary.inventoryTurnover}x</p>
                  <p className="text-[10px] text-gray-500">Turnover</p>
                </div>
              </div>

              {/* Inventory Level Chart */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Inventory Level Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={results.daily}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} />
                    <Tooltip />
                    <ReferenceLine y={config.reorderPoint} stroke="#ef4444" strokeDasharray="5 5" label="Reorder Point" />
                    <Area type="monotone" dataKey="stock" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} strokeWidth={2} />
                    <Line type="monotone" dataKey="demand" stroke="#f59e0b" strokeWidth={1} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Cost breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
                  <p className="text-xs font-medium text-blue-700 mb-1">Holding Cost</p>
                  <p className="text-2xl font-bold text-blue-900">${results.summary.holdingCost.toLocaleString()}</p>
                  <p className="text-xs text-blue-600 mt-1">{Math.round((results.summary.holdingCost / results.summary.totalCost) * 100)}% of total</p>
                </div>
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                  <p className="text-xs font-medium text-amber-700 mb-1">Ordering Cost</p>
                  <p className="text-2xl font-bold text-amber-900">${results.summary.orderingCost.toLocaleString()}</p>
                  <p className="text-xs text-amber-600 mt-1">{results.summary.totalOrders} orders placed</p>
                </div>
                <div className="bg-red-50 rounded-xl border border-red-200 p-5">
                  <p className="text-xs font-medium text-red-700 mb-1">Stockout Cost</p>
                  <p className="text-2xl font-bold text-red-900">${results.summary.stockoutCost.toLocaleString()}</p>
                  <p className="text-xs text-red-600 mt-1">{results.summary.stockoutDays} days without stock</p>
                </div>
              </div>

              {config.policy === "eoq" && (
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-5">
                  <p className="text-sm font-semibold text-indigo-900 mb-1">Calculated EOQ</p>
                  <p className="text-3xl font-bold text-indigo-700">{results.summary.eoq} units</p>
                  <p className="text-xs text-indigo-600 mt-1">
                    Based on annual demand of {Math.round(config.dailyDemandMean * 365)} units, ordering cost of ${config.orderingCost}, and holding cost of ${config.holdingCostPerUnit}/unit/year
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-16 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Inventory Policy Simulator</h3>
              <p className="text-sm text-gray-400 mb-4 max-w-md mx-auto">
                Configure your inventory parameters and run a Monte Carlo simulation to compare the impact of different ordering policies on cost and service level.
              </p>
              <button onClick={handleRun} className="btn-primary inline-flex items-center gap-2">
                <Play className="w-4 h-4" /> Run Simulation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
