const STATUS_STYLES: Record<string, string> = {
  draft: "badge-gray",
  posted: "badge-green",
  reversed: "badge-red",
  approved: "badge-blue",
  ordered: "badge-blue",
  received: "badge-green",
  closed: "badge-gray",
  cancelled: "badge-red",
  confirmed: "badge-blue",
  processing: "badge-yellow",
  shipped: "badge-blue",
  completed: "badge-green",
  delivered: "badge-green",
  open: "badge-yellow",
  in_progress: "badge-blue",
  on_hold: "badge-yellow",
  pending: "badge-yellow",
  rejected: "badge-red",
  active: "badge-green",
  inactive: "badge-gray",
  not_started: "badge-gray",
  planned: "badge-purple",
  released: "badge-blue",
  sent: "badge-blue",
  paid: "badge-green",
  overdue: "badge-red",
  created: "badge-gray",
  in_inspection: "badge-yellow",
  accepted: "badge-green",
  minor: "badge-yellow",
  major: "badge-red",
  critical: "badge-red",
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || "badge-gray";
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className={style}>{label}</span>;
}
