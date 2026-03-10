import CrudPage from "../CrudPage";

export default function CompanyCodes() {
  return (
    <CrudPage
      title="Company Codes"
      subtitle="Manage organizational units for financial reporting"
      breadcrumb={[{ label: "Finance" }, { label: "Company Codes" }]}
      queryKey="company-codes"
      endpoint="/finance/company-codes"
      addLabel="New Company Code"
      fields={[
        { key: "code", label: "Code", required: true },
        { key: "name", label: "Name", required: true },
        { key: "currency", label: "Currency", defaultValue: "USD" },
        { key: "country", label: "Country", defaultValue: "US" },
      ]}
    />
  );
}
