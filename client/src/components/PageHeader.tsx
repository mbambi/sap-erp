interface Props {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  breadcrumb?: { label: string; path?: string }[];
}

export default function PageHeader({ title, subtitle, children, breadcrumb }: Props) {
  return (
    <div className="mb-6">
      {breadcrumb && (
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span>/</span>}
              {item.path ? (
                <a href={item.path} className="hover:text-gray-600">
                  {item.label}
                </a>
              ) : (
                <span className="text-gray-600">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}
