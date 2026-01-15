import { motion, AnimatePresence } from 'framer-motion';
import { X, Download } from 'lucide-react';
import { IconButton } from './IconButton';
import { Button } from './ui/button';
import { Message } from '@/hooks/useAdminChat';
import { useCallback, useState, useRef, useEffect } from 'react';

interface AttachmentPreviewProps {
  message: Message | null;
  onClose: () => void;
}

const b64ToBytes = (b64: string): { bytes: Uint8Array; buffer: ArrayBuffer } => {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return { bytes: arr, buffer: arr.buffer as ArrayBuffer };
};

const detectType = (bytes: Uint8Array): { mime: string; ext: string } => {
  const sig = Array.from(bytes.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (sig.startsWith("25504446")) return { mime: "application/pdf", ext: "pdf" };
  if (sig.startsWith("89504e47")) return { mime: "image/png", ext: "png" };
  if (sig.startsWith("ffd8")) return { mime: "image/jpeg", ext: "jpg" };
  return { mime: "application/octet-stream", ext: "bin" };
};

export const AttachmentPreview = ({ message, onClose }: AttachmentPreviewProps) => {
  const [url, setUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [ext, setExt] = useState<string>('bin');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!message?.file) {
      setUrl(null);
      return;
    }

    const { bytes, buffer } = b64ToBytes(message.file);
    const { mime, ext: fileExt } = detectType(bytes);
    const blob = new Blob([buffer], { type: mime });
    const objectUrl = URL.createObjectURL(blob);
    
    setUrl(objectUrl);
    setMimeType(mime);
    setExt(fileExt);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [message]);

  const handleDownload = useCallback(() => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `attachment_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [url, ext]);

  return (
    <AnimatePresence>
      {message && url && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl h-[85vh] bg-panel border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-line">
              <h2 className="font-bold">Attachment ({mimeType})</h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
                <IconButton onClick={onClose} variant="ghost">
                  <X className="w-5 h-5" />
                </IconButton>
              </div>
            </div>

            {/* Body */}
            <div
              ref={containerRef}
              className="flex-1 overflow-hidden relative bg-panel-secondary/35"
            >
              {mimeType.startsWith('image/') ? (
                <div className="absolute inset-0 flex items-center justify-center overflow-auto p-4">
                  <img
                    src={url}
                    alt="Attachment"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : mimeType === 'application/pdf' ? (
                <iframe
                  src={url}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Preview not available. Use Download.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
