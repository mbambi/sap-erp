import CrudPage from "../CrudPage";
import StatusBadge from "../../components/StatusBadge";

export default function Employees() {
  return (
    <CrudPage
      title="Employees"
      subtitle="Employee master data"
      breadcrumb={[{ label: "Human Resources" }, { label: "Employees" }]}
      queryKey="employees"
      endpoint="/hr/employees"
      searchPlaceholder="Search employees..."
      addLabel="New Employee"
      fields={[
        { key: "employeeNumber", label: "Employee #", required: true },
        { key: "firstName", label: "First Name", required: true },
        { key: "lastName", label: "Last Name", required: true },
        { key: "email", label: "Email", type: "email" },
        { key: "department", label: "Department" },
        { key: "position", label: "Position" },
        { key: "hireDate", label: "Hire Date", type: "date", required: true,
          tableRender: (r: any) => r.hireDate ? new Date(r.hireDate).toLocaleDateString() : ""
        },
        {
          key: "status",
          label: "Status",
          type: "select",
          defaultValue: "active",
          options: [
            { value: "active", label: "Active" },
            { value: "on_leave", label: "On Leave" },
            { value: "terminated", label: "Terminated" },
          ],
          tableRender: (r: any) => <StatusBadge status={r.status} />,
        },
        {
          key: "employmentType",
          label: "Employment Type",
          type: "select",
          defaultValue: "full_time",
          options: [
            { value: "full_time", label: "Full Time" },
            { value: "part_time", label: "Part Time" },
            { value: "contractor", label: "Contractor" },
            { value: "intern", label: "Intern" },
          ],
          showInTable: false,
        },
        { key: "salary", label: "Salary", type: "number", showInTable: false },
        { key: "phone", label: "Phone", showInTable: false },
      ]}
    />
  );
}
