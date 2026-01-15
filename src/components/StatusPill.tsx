import { cn } from '@/lib/utils';

interface StatusPillProps {
  isGood: boolean;
  label: string;
  showDot?: boolean;
  className?: string;
}

export const StatusPill = ({ isGood, label, showDot = true, className }: StatusPillProps) => {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        isGood
          ? "border-status-good/50 text-status-good bg-status-good/10"
          : "border-status-bad/50 text-status-bad bg-status-bad/10",
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "w-2.5 h-2.5 rounded-full",
            isGood
              ? "bg-status-good shadow-[0_0_0_3px_hsl(var(--good)/0.2)]"
              : "bg-status-bad shadow-[0_0_0_3px_hsl(var(--bad)/0.2)]"
          )}
        />
      )}
      <span className="tracking-wide">{label}</span>
    </div>
  );
};
