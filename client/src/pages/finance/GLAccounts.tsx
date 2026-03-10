import CrudPage from "../CrudPage";

export default function GLAccounts() {
  return (
    <CrudPage
      title="GL Accounts"
      subtitle="Chart of Accounts management"
      breadcrumb={[{ label: "Finance" }, { label: "GL Accounts" }]}
      queryKey="gl-accounts"
      endpoint="/finance/gl-accounts"
      searchPlaceholder="Search accounts..."
      addLabel="New Account"
      fields={[
        { key: "accountNumber", label: "Account #", required: true },
        { key: "name", label: "Account Name", required: true },
        {
          key: "type",
          label: "Type",
          type: "select",
          required: true,
          options: [
            { value: "asset", label: "Asset" },
            { value: "liability", label: "Liability" },
            { value: "equity", label: "Equity" },
            { value: "revenue", label: "Revenue" },
            { value: "expense", label: "Expense" },
          ],
          tableRender: (r: any) => (
            <span className={`badge ${
              r.type === "asset" ? "badge-blue" :
              r.type === "liability" ? "badge-red" :
              r.type === "equity" ? "badge-purple" :
              r.type === "revenue" ? "badge-green" :
              "badge-yellow"
            }`}>{r.type}</span>
          ),
        },
        { key: "currency", label: "Currency", defaultValue: "USD" },
        { key: "companyCodeId", label: "Company Code", showInTable: false },
      ]}
    />
  );
}
