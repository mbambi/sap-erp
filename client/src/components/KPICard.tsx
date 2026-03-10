import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ElementType;
  color?: "blue" | "green" | "yellow" | "red" | "purple";
}

const colorMap = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  yellow: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  purple: "bg-purple-50 text-purple-600",
};

const accentMap = {
  blue: "border-l-blue-500",
  green: "border-l-emerald-500",
  yellow: "border-l-amber-500",
  red: "border-l-red-500",
  purple: "border-l-purple-500",
};

export default function KPICard({ title, value, subtitle, trend, trendValue, icon: Icon, color = "blue" }: Props) {
  return (
    <div className={`card p-5 border-l-[3px] ${accentMap[color]} hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {(subtitle || trendValue) && (
            <div className="flex items-center gap-1.5 mt-2">
              {trend && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                    trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-gray-500"
                  }`}
                >
                  {trend === "up" ? <TrendingUp className="w-3 h-3" /> : trend === "down" ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {trendValue}
                </span>
              )}
              {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${colorMap[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
