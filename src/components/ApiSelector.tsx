import { motion } from "framer-motion";

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
  if (endpoints.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {endpoints.map((endpoint) => {
        const isSelected = endpoint.key === selectedKey;
        return (
          <motion.button
            key={endpoint.key}
            onClick={() => onSelect(endpoint.key)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`
              px-2 py-1 text-xs font-medium rounded-md
              transition-all duration-200 min-w-[28px]
              border
              ${isSelected 
                ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
                : 'bg-transparent text-muted-foreground border-border/50 hover:border-primary/50 hover:text-foreground'
              }
            `}
            title={endpoint.url}
          >
            {endpoint.key}
          </motion.button>
        );
      })}
    </div>
  );
};

export default ApiSelector;
