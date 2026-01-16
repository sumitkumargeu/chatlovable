import { cn } from '@/lib/utils';

interface SegmentedControlProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps) {
  return (
    <div
      className={cn(
        "flex border border-line rounded-full overflow-hidden",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={cn(
            "px-3 py-2 text-sm font-medium transition-colors",
            value === option
              ? "bg-primary/35 text-foreground"
              : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
