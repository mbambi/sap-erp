import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Bot, User } from "lucide-react";
import PageHeader from "../../components/PageHeader";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const KNOWLEDGE_BASE: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["create", "purchase order", "po", "me21n"],
    answer:
      "To create a purchase order:\n\n1. Navigate to **Materials (MM)** > **Purchase Orders** or use **T-Code: ME21N**\n2. Enter vendor, material numbers, quantities, and prices\n3. Set delivery date and payment terms\n4. Save the purchase order\n\n[Open Purchase Orders](/materials/purchase-orders)",
  },
  {
    keywords: ["mrp", "material requirements planning", "md01", "run mrp"],
    answer:
      "**Material Requirements Planning (MRP)** calculates net requirements based on demand (sales orders, forecasts) and current stock. It generates planned orders for procurement or production.\n\nTo run MRP:\n1. Navigate to **MRP** module or use **T-Code: MD01**\n2. Select plant and materials (or run for all)\n3. Execute the MRP run\n4. Review planned orders and convert to POs or production orders\n\n[Open MRP Dashboard](/mrp)",
  },
  {
    keywords: ["procure", "pay", "p2p", "procure-to-pay"],
    answer:
      "The **Procure-to-Pay (P2P)** cycle:\n\n1. **Requisition** – Create purchase requisition (or direct PO)\n2. **Purchase Order** – Create PO (ME21N), get approval\n3. **Goods Receipt** – Post GR when goods arrive (MIGO)\n4. **Invoice** – Match invoice to PO and GR\n5. **Payment** – Process payment to vendor\n\n[Purchase Orders](/materials/purchase-orders) | [Goods Receipts](/materials/goods-receipts)",
  },
  {
    keywords: ["journal entry", "post", "fb50", "general ledger"],
    answer:
      "A **journal entry** records financial transactions in the general ledger. Each entry has debit and credit lines that must balance.\n\nTo post a journal entry:\n1. Navigate to **Finance** > **Journal Entries** or use **T-Code: FB50**\n2. Enter company code, posting date, document date\n3. Add line items with GL accounts, debit/credit amounts\n4. Post the document\n\n[Create Journal Entry](/finance/journal-entries)",
  },
  {
    keywords: ["mrp run", "run mrp", "md01", "planned order"],
    answer:
      "To run MRP:\n\n1. Navigate to **MRP** module or use **T-Code: MD01**\n2. Select plant and materials (or run for all)\n3. Execute the MRP run\n4. Review planned orders in MRP dashboard\n5. Convert planned orders to purchase orders or production orders\n\n[Open MRP](/mrp)",
  },
  {
    keywords: ["oee", "overall equipment effectiveness", "equipment effectiveness"],
    answer:
      "**OEE (Overall Equipment Effectiveness)** measures manufacturing productivity:\n\n`OEE = Availability × Performance × Quality`\n\n- **Availability** – Uptime vs planned downtime\n- **Performance** – Actual output vs theoretical max\n- **Quality** – Good units vs total produced\n\n[Operations Dashboard](/operations/dashboard)",
  },
  {
    keywords: ["sales order", "create", "va01", "va"],
    answer:
      "To create a sales order:\n\n1. Navigate to **Sales (SD)** > **Sales Orders** or use **T-Code: VA01**\n2. Enter sold-to party (customer), material, quantity, price\n3. Set delivery date and shipping details\n4. Save the order\n\n[Create Sales Order](/sales/orders)",
  },
  {
    keywords: ["abc analysis", "abc", "inventory classification"],
    answer:
      "**ABC analysis** classifies inventory by value:\n\n- **A items** – High value, low turnover; need tight control\n- **B items** – Moderate value; standard management\n- **C items** – Low value, high turnover; simple replenishment\n\nUsed for cycle counting, prioritization, and reorder policies.\n\n[Inventory Analytics](/inventory/analytics)",
  },
  {
    keywords: ["goods receipt", "gr", "migo", "receipt"],
    answer:
      "**Goods receipt** confirms physical receipt of materials. In SAP:\n\n1. Use **T-Code: MIGO**\n2. Select movement type (e.g., 101 for PO)\n3. Enter PO number, quantity received\n4. Post the document\n\n[Goods Receipts](/materials/goods-receipts)",
  },
  {
    keywords: ["cost center", "cost centre"],
    answer:
      "A **cost center** is an organizational unit for cost allocation. It tracks expenses (labor, materials, overhead) by department or activity. Used in Controlling (CO) for reporting and budgeting.\n\n[Cost Centers](/controlling/cost-centers)",
  },
  {
    keywords: ["check inventory", "stock", "mmbe", "inventory"],
    answer:
      "To check inventory:\n\n1. Use **T-Code: MMBE** for stock overview\n2. Or navigate to **Materials** > **Inventory**\n3. View stock by material, plant, storage location\n\n[View Inventory](/materials/inventory)",
  },
  {
    keywords: ["bom", "bill of materials", "bill of material", "cs01"],
    answer:
      "A **Bill of Materials (BOM)** lists components for a product. It defines what materials and quantities are needed for production.\n\nTo create: **T-Code: CS01**\n\n[BOMs](/production/boms)",
  },
  {
    keywords: ["workflow", "workflow engine", "approval"],
    answer:
      "The **workflow engine** automates approval processes. When a document (e.g., PO) is created, a workflow can route it to approvers based on rules (amount, type). Users approve or reject from their task list.\n\n[Workflow](/workflow) | [Workflow Builder](/workflow/builder)",
  },
  {
    keywords: ["safety stock", "buffer stock", "safety"],
    answer:
      "**Safety stock** is buffer inventory to prevent stockouts. It covers demand variability and supply delays. Set in material master; MRP uses it when calculating net requirements.\n\n[Materials](/materials/items)",
  },
  {
    keywords: ["financial report", "report", "reporting", "trial balance"],
    answer:
      "To view financial reports:\n\n1. **Trial Balance** – **T-Code: F.01** or [Trial Balance](/finance/trial-balance)\n2. **Reporting Dashboard** – [Reporting](/reporting)\n3. **Financial Analytics** – [Financial Analytics](/finance/analytics)",
  },
];

function parseAnswer(text: string, navigate: (path: string) => void): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;
  let keyIdx = 0;
  const addText = (s: string) => {
    s.split("\n").forEach((line, j) => {
      if (j > 0) parts.push(<br key={`k-${keyIdx++}`} />);
      const segs = line.split(/\*\*([^*]+)\*\*/);
      segs.forEach((seg, k) => {
        if (k % 2 === 1) parts.push(<strong key={`k-${keyIdx++}`}>{seg}</strong>);
        else if (seg) parts.push(seg);
      });
    });
  };
  while ((match = linkRegex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) addText(before);
    parts.push(
      <button
        key={`k-${keyIdx++}`}
        onClick={() => navigate(match![2])}
        className="text-primary-600 hover:text-primary-700 underline font-medium"
      >
        {match[1]}
      </button>
    );
    lastIndex = match.index + match[0].length;
  }
  const after = text.slice(lastIndex);
  if (after) addText(after);
  return parts;
}

export default function ERPCopilot() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const findAnswer = (text: string): string => {
    const lower = text.toLowerCase();
    for (const kb of KNOWLEDGE_BASE) {
      if (kb.keywords.some((k) => lower.includes(k))) {
        return kb.answer;
      }
    }
    return "";
  };

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    setTimeout(() => {
      const answer = findAnswer(trimmed);
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content:
          answer ||
          "I'm not sure about that. Try searching for specific ERP terms like 'purchase order', 'MRP', 'journal entry', 'goods receipt', 'OEE', 'BOM', etc.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setLoading(false);
    }, 400);
  };

  const suggestions = [
    "How to create a PO?",
    "What is MRP?",
    "Procure-to-Pay flow",
    "OEE explained",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <PageHeader
        title="ERP Copilot"
        subtitle="Your intelligent ERP assistant"
      />

      <div className="flex-1 card overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Ask me anything about ERP processes.</p>
              <p className="text-xs mt-1">Try: &quot;How do I create a purchase order?&quot;</p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}
            >
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-gray-600" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                  m.role === "user"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {m.role === "user" ? (
                  <p className="text-sm">{m.content}</p>
                ) : (
                  <div className="text-sm whitespace-pre-wrap">
                    {parseAnswer(m.content, navigate)}
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary-600" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-gray-600" />
              </div>
              <div className="bg-gray-100 rounded-lg px-4 py-2.5 flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <div className="p-4 border-t">
          <div className="flex flex-wrap gap-2 mb-3">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="Ask about ERP processes..."
              className="input flex-1"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading}
              className="btn-primary"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
