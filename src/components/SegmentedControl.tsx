import { cn } from '@/lib/utils';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "flex border border-line rounded-full overflow-hidden",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-3 py-2 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-primary/35 text-foreground"
              : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
