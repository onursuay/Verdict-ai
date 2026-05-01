interface DecisionCardProps {
  title: string;
  badge?: string;
  badgeColor?: "indigo" | "violet" | "amber" | "green" | "red";
  icon: React.ReactNode;
  children: React.ReactNode;
}

const BADGE_COLORS = {
  indigo: "bg-indigo-100 text-indigo-700",
  violet: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-700",
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
};

export default function DecisionCard({
  title,
  badge,
  badgeColor = "indigo",
  icon,
  children,
}: DecisionCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <span className="text-xl">{icon}</span>
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        {badge && (
          <span
            className={`ml-auto text-xs font-medium px-2.5 py-1 rounded-full ${BADGE_COLORS[badgeColor]}`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
