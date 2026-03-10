import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import { Loader2 } from "lucide-react";

export default function TrialBalance() {
  const { data, isLoading } = useQuery({
    queryKey: ["trial-balance"],
    queryFn: () => api.get("/finance/trial-balance"),
  });

  const accounts = data || [];
  const totalDebit = accounts.reduce((s: number, a: any) => s + a.debit, 0);
  const totalCredit = accounts.reduce((s: number, a: any) => s + a.credit, 0);

  return (
    <div>
      <PageHeader
        title="Trial Balance"
        subtitle="Summary of all posted GL account balances"
        breadcrumb={[{ label: "Finance" }, { label: "Trial Balance" }]}
      />

      <div className="card">
        {isLoading ? (
          <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Account</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Type</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Debit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Credit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {accounts.map((acc: any) => (
                <tr key={acc.accountNumber} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{acc.accountNumber}</td>
                  <td className="px-4 py-2">{acc.name}</td>
                  <td className="px-4 py-2 capitalize text-gray-500">{acc.type}</td>
                  <td className="px-4 py-2 text-right">{acc.debit > 0 ? `$${acc.debit.toFixed(2)}` : ""}</td>
                  <td className="px-4 py-2 text-right">{acc.credit > 0 ? `$${acc.credit.toFixed(2)}` : ""}</td>
                  <td className={`px-4 py-2 text-right font-medium ${acc.balance < 0 ? "text-red-600" : ""}`}>
                    ${Math.abs(acc.balance).toFixed(2)} {acc.balance < 0 ? "Cr" : "Dr"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold bg-gray-50">
                <td className="px-4 py-3" colSpan={3}>Totals</td>
                <td className="px-4 py-3 text-right">${totalDebit.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">${totalCredit.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  {Math.abs(totalDebit - totalCredit) < 0.01 ? (
                    <span className="text-emerald-600">Balanced</span>
                  ) : (
                    <span className="text-red-600">${Math.abs(totalDebit - totalCredit).toFixed(2)}</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
