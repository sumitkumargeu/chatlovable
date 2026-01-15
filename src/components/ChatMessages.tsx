import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Message, isAdminSender, toMessageTimeLabel } from '@/hooks/useAdminChat';

interface ChatMessagesProps {
  messages: Message[];
  onOpenAttachment?: (message: Message) => void;
}

const statusIcon = (m: Message): string => {
  if (isAdminSender(m.sender)) {
    const s = m._status || "sent";
    if (s === "pending") return "◷";
    if (s === "failed") return "!";
    return "✓✓";
  }
  return "";
};

export const ChatMessages = ({ messages, onOpenAttachment }: ChatMessagesProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No messages yet
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 pb-24 flex flex-col gap-2 chat-gradient scrollbar-thin"
    >
      {messages.map((m, idx) => {
        const isRight = isAdminSender(m.sender);
        return (
          <motion.div
            key={`${m.created_at}-${idx}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "max-w-[min(78%,640px)] rounded-2xl px-3 py-2 shadow-lg flex flex-col gap-1.5",
              isRight
                ? "self-end bg-bubble-right rounded-br-md"
                : "self-start bg-bubble-left rounded-bl-md"
            )}
          >
            <div className="whitespace-pre-wrap break-words text-sm">
              {m.message}
            </div>
            {m.file && (
              <div
                onClick={() => onOpenAttachment?.(m)}
                className="mt-2 px-3 py-2 border border-dashed border-line rounded-xl cursor-pointer bg-panel-secondary/30 text-sm hover:bg-panel-secondary/50 transition-colors"
              >
                Open attachment
              </div>
            )}
            <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
              <span>{toMessageTimeLabel(m.created_at)}</span>
              {statusIcon(m) && <span>{statusIcon(m)}</span>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
