import CrudPage from "../CrudPage";

export default function Plants() {
  return (
    <CrudPage
      title="Plants"
      subtitle="Manufacturing and logistics plants"
      breadcrumb={[{ label: "Materials Management" }, { label: "Plants" }]}
      queryKey="plants"
      endpoint="/materials/plants"
      addLabel="New Plant"
      fields={[
        { key: "code", label: "Plant Code", required: true },
        { key: "name", label: "Name", required: true },
        { key: "address", label: "Address", type: "textarea" },
      ]}
    />
  );
}
