interface DecisionCardProps {
  title: string;
  badge?: string;
  badgeColor?: "indigo" | "violet" | "amber" | "green" | "red";
  icon: React.ReactNode;
  children: React.ReactNode;
}

const BADGE_COLORS = {
  indigo: "bg-cyan-400/10 text-cyan-200 border border-cyan-300/20",
  violet: "bg-violet-400/10 text-violet-200 border border-violet-300/20",
  amber: "bg-amber-400/10 text-amber-200 border border-amber-300/20",
  green: "bg-emerald-400/10 text-emerald-200 border border-emerald-300/20",
  red: "bg-red-400/10 text-red-200 border border-red-300/20",
};

export default function DecisionCard({
  title,
  badge,
  badgeColor = "indigo",
  icon,
  children,
}: DecisionCardProps) {
  return (
    <div className="bg-[#08111f]/90 rounded-2xl border border-emerald-300/10 shadow-[0_18px_50px_rgba(0,0,0,0.28)] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/[0.03]">
        <span className="text-xl">{icon}</span>
        <h3 className="font-semibold text-slate-100 text-sm">{title}</h3>
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
