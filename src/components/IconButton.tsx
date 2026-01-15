import { cn } from '@/lib/utils';
import { forwardRef, ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost';
  size?: 'sm' | 'md';
  spinning?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'default', size = 'md', spinning, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl border border-line transition-all duration-200",
          "hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
          size === 'md' && "w-10 h-10 text-lg",
          size === 'sm' && "w-8 h-8 text-base",
          variant === 'default' && "bg-panel text-foreground",
          variant === 'primary' && "bg-primary/70 text-primary-foreground border-primary/50",
          variant === 'ghost' && "bg-transparent border-transparent hover:bg-muted",
          spinning && "animate-spin",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
