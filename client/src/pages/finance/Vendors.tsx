import CrudPage from "../CrudPage";
import StatusBadge from "../../components/StatusBadge";

export default function Vendors() {
  return (
    <CrudPage
      title="Vendors"
      subtitle="Manage supplier master data"
      breadcrumb={[{ label: "Finance" }, { label: "Vendors" }]}
      queryKey="vendors"
      endpoint="/finance/vendors"
      searchPlaceholder="Search vendors..."
      addLabel="New Vendor"
      fields={[
        { key: "vendorNumber", label: "Vendor #", required: true },
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", type: "email" },
        { key: "phone", label: "Phone", showInTable: false },
        { key: "city", label: "City" },
        { key: "country", label: "Country", defaultValue: "US" },
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
        { key: "currency", label: "Currency", defaultValue: "USD", showInTable: false },
        { key: "street", label: "Street", showInTable: false },
        { key: "state", label: "State", showInTable: false },
        { key: "postalCode", label: "Postal Code", showInTable: false },
      ]}
    />
  );
}
