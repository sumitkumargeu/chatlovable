import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ApiEndpoint {
  key: string;
  url: string;
}

interface ApiSelectorProps {
  endpoints: ApiEndpoint[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

const ApiSelector = ({ endpoints, selectedKey, onSelect }: ApiSelectorProps) => {
  const [open, setOpen] = useState(false);

  if (endpoints.length <= 1) return null;

  const selectedEndpoint = endpoints.find(e => e.key === selectedKey);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg
            bg-primary/10 text-primary border border-primary/20
            hover:bg-primary/15 hover:border-primary/30
            transition-all duration-200"
        >
          <span className="font-semibold">{selectedKey}</span>
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
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
            const isSelected = endpoint.key === selectedKey;
            return (
              <motion.button
                key={endpoint.key}
                onClick={() => {
                  onSelect(endpoint.key);
                  setOpen(false);
                }}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left
                  transition-all duration-150
                  ${isSelected 
                    ? 'bg-primary/15 text-primary' 
                    : 'text-foreground hover:bg-muted/50'
                  }
                `}
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

export default ApiSelector;
