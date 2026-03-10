import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Shield, Clock, Plus } from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import { FormInput, FormSelect } from "../../components/FormField";

export default function AdminPanel() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"users" | "roles" | "audit">("users");
  const [showAddUser, setShowAddUser] = useState(false);
  const [userForm, setUserForm] = useState({ email: "", firstName: "", lastName: "", password: "Student123!", roleNames: ["student"] });

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get("/admin/users"),
    enabled: tab === "users",
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => api.get("/admin/roles"),
    enabled: tab === "roles",
  });

  const { data: auditData } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => api.get("/admin/audit-log"),
    enabled: tab === "audit",
  });

  const createUser = useMutation({
    mutationFn: (data: any) => api.post("/admin/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowAddUser(false);
    },
  });

  const tabClass = (t: string) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      tab === t ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  return (
    <div>
      <PageHeader title="Administration" subtitle="Manage users, roles, and system settings" />

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab("users")} className={tabClass("users")}>
          <Users className="w-4 h-4 inline mr-1.5" /> Users
        </button>
        <button onClick={() => setTab("roles")} className={tabClass("roles")}>
          <Shield className="w-4 h-4 inline mr-1.5" /> Roles
        </button>
        <button onClick={() => setTab("audit")} className={tabClass("audit")}>
          <Clock className="w-4 h-4 inline mr-1.5" /> Audit Log
        </button>
      </div>

      {tab === "users" && (
        <>
          <DataTable
            columns={[
              { key: "email", label: "Email" },
              { key: "name", label: "Name", render: (r: any) => `${r.firstName} ${r.lastName}` },
              { key: "roles", label: "Roles", render: (r: any) => (
                <div className="flex gap-1">{(r.roles || []).map((role: string) => (
                  <span key={role} className="badge badge-blue">{role}</span>
                ))}</div>
              )},
              { key: "isActive", label: "Active", render: (r: any) => (
                <span className={`badge ${r.isActive ? "badge-green" : "badge-red"}`}>
                  {r.isActive ? "Active" : "Inactive"}
                </span>
              )},
              { key: "lastLogin", label: "Last Login", render: (r: any) =>
                r.lastLogin ? new Date(r.lastLogin).toLocaleString() : "Never"
              },
            ]}
            data={users}
            onAdd={() => setShowAddUser(true)}
            addLabel="Add User"
          />

          <Modal
            isOpen={showAddUser}
            onClose={() => setShowAddUser(false)}
            title="Add User"
            footer={
              <>
                <button onClick={() => setShowAddUser(false)} className="btn-secondary">Cancel</button>
                <button onClick={() => createUser.mutate(userForm)} className="btn-primary">
                  <Plus className="w-4 h-4" /> Create User
                </button>
              </>
            }
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="First Name" value={userForm.firstName} onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })} required />
                <FormInput label="Last Name" value={userForm.lastName} onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })} required />
              </div>
              <FormInput label="Email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
              <FormInput label="Password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} helpText="Default: Student123!" />
              <FormSelect
                label="Role"
                value={userForm.roleNames[0]}
                onChange={(e) => setUserForm({ ...userForm, roleNames: [e.target.value] })}
                options={[
                  { value: "student", label: "Student" },
                  { value: "instructor", label: "Instructor" },
                  { value: "admin", label: "Admin" },
                  { value: "auditor", label: "Auditor" },
                ]}
              />
            </div>
          </Modal>
        </>
      )}

      {tab === "roles" && (
        <DataTable
          columns={[
            { key: "name", label: "Role Name", render: (r: any) => (
              <span className="font-medium capitalize">{r.name}</span>
            )},
            { key: "isSystem", label: "System", render: (r: any) => r.isSystem ? "Yes" : "No" },
            { key: "permissions", label: "Permissions", render: (r: any) => (
              <span className="text-sm text-gray-500">{r.permissions?.length || 0} rules</span>
            )},
          ]}
          data={roles}
        />
      )}

      {tab === "audit" && (
        <DataTable
          columns={[
            { key: "createdAt", label: "Time", render: (r: any) => new Date(r.createdAt).toLocaleString() },
            { key: "user", label: "User", render: (r: any) => r.user ? `${r.user.firstName} ${r.user.lastName}` : "System" },
            { key: "action", label: "Action", render: (r: any) => (
              <span className={`badge ${r.action === "POST" ? "badge-green" : r.action === "PUT" ? "badge-blue" : r.action === "DELETE" ? "badge-red" : "badge-gray"}`}>
                {r.action}
              </span>
            )},
            { key: "module", label: "Module" },
            { key: "resource", label: "Resource" },
          ]}
          data={auditData?.data || []}
          pagination={auditData?.pagination}
        />
      )}
    </div>
  );
}
