import { useState, useEffect } from "react";
import { useCrud } from "../hooks/useCrud";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import { FormInput, FormSelect, FormTextArea } from "../components/FormField";

interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "textarea" | "email";
  options?: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: any;
  helpText?: string;
  showInTable?: boolean;
  tableRender?: (row: any) => React.ReactNode;
  className?: string;
}

interface CrudPageProps {
  title: string;
  subtitle?: string;
  breadcrumb?: { label: string; path?: string }[];
  queryKey: string;
  endpoint: string;
  fields: FieldDef[];
  searchPlaceholder?: string;
  addLabel?: string;
  readOnly?: boolean;
}

export default function CrudPage({
  title,
  subtitle,
  breadcrumb,
  queryKey,
  endpoint,
  fields,
  searchPlaceholder,
  addLabel = "Add New",
  readOnly = false,
}: CrudPageProps) {
  const { data, pagination, isLoading, page, setPage, setSearch, create, update, remove } = useCrud({
    key: queryKey,
    endpoint,
  });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const defaultForm = () => {
    const f: Record<string, any> = {};
    fields.forEach((fd) => {
      f[fd.key] = fd.defaultValue ?? (fd.type === "number" ? 0 : "");
    });
    return f;
  };

  const [form, setForm] = useState<Record<string, any>>(defaultForm());

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm());
    setShowModal(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    const f: Record<string, any> = {};
    fields.forEach((fd) => {
      let val = row[fd.key];
      if (fd.type === "date" && val) val = val.split("T")[0];
      f[fd.key] = val ?? fd.defaultValue ?? "";
    });
    setForm(f);
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const payload: Record<string, any> = {};
      fields.forEach((fd) => {
        let val = form[fd.key];
        if (fd.type === "number") val = parseFloat(val) || 0;
        if (fd.type === "date" && val) val = new Date(val).toISOString();
        payload[fd.key] = val;
      });

      if (editing) {
        await update.mutateAsync({ id: editing.id, data: payload });
      } else {
        await create.mutateAsync(payload as any);
      }
      setShowModal(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const tableColumns = fields
    .filter((f) => f.showInTable !== false)
    .map((f) => ({
      key: f.key,
      label: f.label,
      render: f.tableRender,
      className: f.className,
    }));

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} breadcrumb={breadcrumb} />

      <DataTable
        columns={tableColumns}
        data={data}
        pagination={pagination}
        isLoading={isLoading}
        onPageChange={setPage}
        onSearch={setSearch}
        onAdd={readOnly ? undefined : openCreate}
        addLabel={addLabel}
        onRowClick={readOnly ? undefined : openEdit}
        searchPlaceholder={searchPlaceholder}
      />

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? `Edit ${title.replace(/s$/, "")}` : `New ${title.replace(/s$/, "")}`}
        size="lg"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-secondary">
              Cancel
            </button>
            {editing && (
              <button
                onClick={async () => {
                  if (confirm("Delete this record?")) {
                    await remove.mutateAsync(editing.id);
                    setShowModal(false);
                  }
                }}
                className="btn-danger"
              >
                Delete
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={create.isPending || update.isPending}
              className="btn-primary"
            >
              {editing ? "Update" : "Create"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          {fields.map((fd) => {
            const val = form[fd.key] ?? "";
            const onChange = (v: string) => setForm({ ...form, [fd.key]: v });

            if (fd.type === "select" && fd.options) {
              return (
                <FormSelect
                  key={fd.key}
                  label={fd.label}
                  value={val}
                  onChange={(e) => onChange(e.target.value)}
                  options={fd.options}
                  required={fd.required}
                  helpText={fd.helpText}
                />
              );
            }
            if (fd.type === "textarea") {
              return (
                <div key={fd.key} className="col-span-2">
                  <FormTextArea
                    label={fd.label}
                    value={val}
                    onChange={(e) => onChange(e.target.value)}
                    required={fd.required}
                    helpText={fd.helpText}
                  />
                </div>
              );
            }
            return (
              <FormInput
                key={fd.key}
                label={fd.label}
                type={fd.type || "text"}
                value={val}
                onChange={(e) => onChange(e.target.value)}
                required={fd.required}
                helpText={fd.helpText}
              />
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
