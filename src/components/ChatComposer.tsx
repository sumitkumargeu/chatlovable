import { useState, useRef, KeyboardEvent } from 'react';
import { Paperclip, Send } from 'lucide-react';
import { IconButton } from './IconButton';
import { toast } from 'sonner';

interface ChatComposerProps {
  onSend: (text: string, attachment: File | null) => void;
  disabled?: boolean;
}

export const ChatComposer = ({ onSend, disabled }: ChatComposerProps) => {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!text.trim() && !attachment) return;
    onSend(text.trim(), attachment);
    setText('');
    setAttachment(null);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Max file size is 10MB');
      return;
    }

    const okTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!okTypes.includes(file.type)) {
      toast.error('Only PDF, PNG, JPG allowed');
      return;
    }

    setAttachment(file);
    toast.success(`Attached: ${file.name}`);
  };

  return (
    <div className="flex items-center gap-3 p-3 border-t border-line bg-panel/90 backdrop-blur-sm">
      <IconButton
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        aria-label="Attach file"
      >
        <Paperclip className="w-5 h-5" />
      </IconButton>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpg,image/jpeg"
        className="hidden"
        onChange={handleFileChange}
      />

      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={attachment ? `📎 ${attachment.name}` : "Type a message"}
        disabled={disabled}
        className="flex-1 h-10 px-4 rounded-xl border border-line bg-panel-secondary/55 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/55 transition-colors"
      />

      <IconButton
        variant="primary"
        onClick={handleSend}
        disabled={disabled || (!text.trim() && !attachment)}
        aria-label="Send"
      >
        <Send className="w-5 h-5" />
      </IconButton>
    </div>
  );
};
