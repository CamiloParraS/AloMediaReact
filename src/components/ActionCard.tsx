interface ActionCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick?: () => void;
}

export default function ActionCard({ icon: Icon, label, description, onClick }: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-card rounded-2xl p-6 flex items-start gap-4 hover:border-blood-red/30 transition-all duration-300 group cursor-pointer hover:shadow-lg hover:shadow-blood-red/8 text-left"
    >
      <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blood-red/20 to-burgundy/20 flex items-center justify-center shrink-0 group-hover:from-blood-red/30 group-hover:to-burgundy/30 transition-all duration-300">
        <Icon className="w-5 h-5 text-accent-red" />
      </div>
      <div>
        <p className="text-accent-white font-semibold text-sm">{label}</p>
        <p className="text-muted text-xs mt-1 leading-relaxed">{description}</p>
      </div>
    </button>
  );
}
