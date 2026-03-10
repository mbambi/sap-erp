import CrudPage from "../CrudPage";

export default function Customers() {
  return (
    <CrudPage
      title="Customers"
      subtitle="Manage customer master data"
      breadcrumb={[{ label: "Finance" }, { label: "Customers" }]}
      queryKey="customers"
      endpoint="/finance/customers"
      searchPlaceholder="Search customers..."
      addLabel="New Customer"
      fields={[
        { key: "customerNumber", label: "Customer #", required: true },
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", type: "email" },
        { key: "phone", label: "Phone", showInTable: false },
        { key: "city", label: "City" },
        { key: "country", label: "Country", defaultValue: "US" },
        { key: "creditLimit", label: "Credit Limit", type: "number", defaultValue: 0,
          tableRender: (r: any) => `$${(r.creditLimit || 0).toLocaleString()}`
        },
        {
          key: "paymentTerms",
          label: "Payment Terms",
          type: "select",
          options: [
            { value: "NET15", label: "Net 15" },
            { value: "NET30", label: "Net 30" },
            { value: "NET45", label: "Net 45" },
            { value: "NET60", label: "Net 60" },
          ],
        },
        { key: "street", label: "Street", showInTable: false },
        { key: "state", label: "State", showInTable: false },
        { key: "postalCode", label: "Postal Code", showInTable: false },
      ]}
    />
  );
}
