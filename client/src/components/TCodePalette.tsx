import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

interface TCode {
  code: string;
  name: string;
  module: string;
  path: string;
  description?: string;
}

const LOCAL_TCODES: TCode[] = [
  {
    code: "ME21N",
    name: "Create Purchase Order",
    module: "materials",
    path: "/materials/purchase-orders",
    description: "Create a new purchase order",
  },
  {
    code: "MIGO",
    name: "Goods Receipt",
    module: "materials",
    path: "/materials/goods-receipts",
    description: "Post goods receipt for purchase order",
  },
  {
    code: "FB50",
    name: "Post Journal Entry",
    module: "finance",
    path: "/finance/journal-entries",
    description: "Post a general ledger journal entry",
  },
  {
    code: "VA01",
    name: "Create Sales Order",
    module: "sales",
    path: "/sales/orders",
    description: "Create a new sales order",
  },
  {
    code: "VL01N",
    name: "Create Delivery",
    module: "sales",
    path: "/sales/deliveries",
    description: "Create outbound delivery",
  },
  {
    code: "VF01",
    name: "Create Billing Document",
    module: "sales",
    path: "/sales/invoices",
    description: "Create billing document from delivery",
  },
  {
    code: "MD01",
    name: "MRP Run",
    module: "mrp",
    path: "/mrp",
    description: "Run material requirements planning",
  },
  {
    code: "CO01",
    name: "Create Production Order",
    module: "production",
    path: "/production/orders",
    description: "Create production order",
  },
];

const TCODE_FALLBACK_ROUTES: Record<string, string> = {
  ME21N: "/materials/purchase-orders",
  MIGO: "/materials/goods-receipts",
  FB50: "/finance/journal-entries",
  VA01: "/sales/orders",
  VL01N: "/sales/deliveries",
  VF01: "/sales/invoices",
  MD01: "/mrp",
  CO01: "/production/orders",
  IW31: "/maintenance/work-orders",
  QA01: "/quality/inspections",
  XD01: "/finance/customers",
  XK01: "/finance/vendors",
};

export default function TCodePalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { data: tcodes = [] } = useQuery({
    queryKey: ["tcodes"],
    queryFn: () => api.get<TCode[]>("/utilities/tcodes"),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const mergedTcodes = (() => {
    const map = new Map<string, TCode>();
    for (const t of LOCAL_TCODES) map.set(t.code.toUpperCase(), t);
    for (const t of tcodes) map.set(t.code.toUpperCase(), t);
    return Array.from(map.values());
  })();

  const filtered = query.trim()
    ? mergedTcodes.filter(
        (t) =>
          t.code.toLowerCase().includes(query.toLowerCase()) ||
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          (t.description || "").toLowerCase().includes(query.toLowerCase()) ||
          t.module.toLowerCase().includes(query.toLowerCase())
      )
    : mergedTcodes;

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setSelectedIdx(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const navigateByQuery = useCallback(() => {
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery) return false;

    const exactMatch = tcodes.find((t) => t.code.toUpperCase() === normalizedQuery);
    if (exactMatch) {
      navigate(exactMatch.path);
      closePalette();
      return true;
    }

    const fallbackPath = TCODE_FALLBACK_ROUTES[normalizedQuery];
    if (fallbackPath) {
      navigate(fallbackPath);
      closePalette();
      return true;
    }

    return false;
  }, [query, tcodes, navigate, closePalette]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/") {
        const target = e.target as HTMLElement;
        const tag = target.tagName;
        const isInput =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (target as HTMLElement).isContentEditable;
        if (!isInput) {
          e.preventDefault();
          openPalette();
        }
      }
      if (e.key === "Escape") closePalette();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openPalette, closePalette]);

  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && filtered[selectedIdx]) {
          e.preventDefault();
          navigate(filtered[selectedIdx].path);
          closePalette();
        } else if (e.key === "Enter") {
          e.preventDefault();
          navigateByQuery();
        }
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }
  }, [open, filtered, selectedIdx, navigate, closePalette, navigateByQuery]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  if (!open) return null;

  const moduleBadge = (m: string) => {
    const colors: Record<string, string> = {
      materials: "bg-emerald-100 text-emerald-800",
      sales: "bg-purple-100 text-purple-800",
      finance: "bg-blue-100 text-blue-800",
      production: "bg-amber-100 text-amber-800",
      hr: "bg-red-100 text-red-800",
      maintenance: "bg-orange-100 text-orange-800",
      quality: "bg-cyan-100 text-cyan-800",
      controlling: "bg-indigo-100 text-indigo-800",
      warehouse: "bg-teal-100 text-teal-800",
      mrp: "bg-pink-100 text-pink-800",
      learning: "bg-violet-100 text-violet-800",
      "supply-chain": "bg-sky-100 text-sky-800",
      operations: "bg-rose-100 text-rose-800",
    };
    return colors[m] || "bg-gray-100 text-gray-700";
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/60"
      onClick={closePalette}
    >
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transaction codes..."
            className="input w-full text-base"
            autoFocus
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No matching transaction codes
            </div>
          ) : (
            filtered.map((t, i) => (
              <button
                key={t.code}
                onClick={() => {
                  navigate(t.path);
                  closePalette();
                }}
                className={`w-full px-4 py-3 flex items-start gap-3 text-left transition-colors ${
                  i === selectedIdx ? "bg-primary-50" : "hover:bg-gray-50"
                }`}
              >
                <span className="font-mono font-bold text-primary-600 text-sm shrink-0">
                  {t.code}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{t.name}</p>
                  {t.description && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{t.description}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${moduleBadge(t.module)}`}
                >
                  {t.module}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-t">
          Type a transaction code (e.g. ME21N) or search by name
        </div>
      </div>
    </div>
  );
}
