import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface ApiEndpoint {
  key: string;
  url: string;
}

interface StatusPillProps {
  isGood: boolean;
  label: string;
  showDot?: boolean;
  className?: string;
  endpoints?: ApiEndpoint[];
  selectedApiKey?: string;
  onSelectApi?: (key: string) => void;
}

export const StatusPill = ({ 
  isGood, 
  label, 
  showDot = true, 
  className,
  endpoints = [],
  selectedApiKey,
  onSelectApi
}: StatusPillProps) => {
  const [open, setOpen] = useState(false);
  const hasApiSelector = endpoints.length > 1 && onSelectApi;

  const pillContent = (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
        isGood
          ? "border-status-good/50 text-status-good bg-status-good/10"
          : "border-status-bad/50 text-status-bad bg-status-bad/10",
        hasApiSelector && "cursor-pointer hover:scale-105 active:scale-95",
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
      {hasApiSelector && (
        <>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
            {selectedApiKey}
          </span>
          <ChevronDown 
            className={cn(
              "w-3 h-3 transition-transform duration-200",
              open && "rotate-180"
            )} 
          />
        </>
      )}
    </div>
  );

  if (!hasApiSelector) {
    return pillContent;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button whileTap={{ scale: 0.98 }}>
          {pillContent}
        </motion.button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-56 p-1.5 bg-card/95 backdrop-blur-xl border-line rounded-xl shadow-xl"
        align="start"
        sideOffset={8}
      >
        <div className="flex flex-col gap-0.5">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Select API
          </div>
          {endpoints.map((endpoint) => {
            const isSelected = endpoint.key === selectedApiKey;
            return (
              <motion.button
                key={endpoint.key}
                onClick={() => {
                  onSelectApi(endpoint.key);
                  setOpen(false);
                }}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-all duration-150",
                  isSelected 
                    ? "bg-primary/15 text-primary" 
                    : "text-foreground hover:bg-muted/50"
                )}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-semibold text-sm">{endpoint.key}</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                    {endpoint.url}
                  </span>
                </div>
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                    >
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
