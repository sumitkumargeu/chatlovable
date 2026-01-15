import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, Download, Upload } from 'lucide-react';
import { IconButton } from './IconButton';
import { StatusPill } from './StatusPill';
import { SegmentedControl } from './SegmentedControl';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Mode, RefreshType } from '@/hooks/useAdminChat';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  pgUrl: string;
  pgConnected: boolean;
  tableName: string;
  tableCols: string;
  userIdentifierCol: string;
  afterDateDraft: string;
  adminName: string;
  autoRefreshSec: string;
  autoRefreshType: RefreshType;
  csvFileName: string;
  onSavePgUrl: (url: string) => void;
  onSetTableName: (name: string) => void;
  onSetTableCols: (cols: string) => void;
  onSetUserIdentifierCol: (col: string) => void;
  onSetAfterDate: (date: string) => void;
  onSetAdminName: (name: string) => void;
  onSetAutoRefresh: (sec: string, type: RefreshType) => void;
  onLoadCsv: (file: File) => void;
  onDownloadCsv: () => void;
}

export const SettingsModal = ({
  open,
  onClose,
  mode,
  pgUrl,
  pgConnected,
  tableName,
  tableCols,
  userIdentifierCol,
  afterDateDraft,
  adminName,
  autoRefreshSec,
  autoRefreshType,
  csvFileName,
  onSavePgUrl,
  onSetTableName,
  onSetTableCols,
  onSetUserIdentifierCol,
  onSetAfterDate,
  onSetAdminName,
  onSetAutoRefresh,
  onLoadCsv,
  onDownloadCsv,
}: SettingsModalProps) => {
  const [localPgUrl, setLocalPgUrl] = useState(pgUrl);
  const [localTableName, setLocalTableName] = useState(tableName);
  const [localTableCols, setLocalTableCols] = useState(tableCols);
  const [localUserIdCol, setLocalUserIdCol] = useState(userIdentifierCol);
  const [localAfterDate, setLocalAfterDate] = useState(afterDateDraft);
  const [localAdminName, setLocalAdminName] = useState(adminName);
  const [localAutoSec, setLocalAutoSec] = useState(autoRefreshSec);
  const [localAutoType, setLocalAutoType] = useState(autoRefreshType);
  
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [localCsvFile, setLocalCsvFile] = useState<File | null>(null);

  const isDbMode = mode === 'db';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-panel border border-line rounded-2xl shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-line sticky top-0 bg-panel z-10">
              <h2 className="text-lg font-bold">Settings</h2>
              <IconButton onClick={onClose} variant="ghost">
                <X className="w-5 h-5" />
              </IconButton>
            </div>

            {/* Content */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* DB Settings */}
              {isDbMode && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Postgres URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={localPgUrl}
                      onChange={(e) => setLocalPgUrl(e.target.value)}
                      placeholder="postgres://..."
                      className="flex-1"
                    />
                    <IconButton onClick={() => {}}>
                      <Pencil className="w-4 h-4" />
                    </IconButton>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => onSavePgUrl(localPgUrl)}
                    >
                      Save connection
                    </Button>
                    <StatusPill
                      isGood={pgConnected}
                      label={pgConnected ? "✓ Connected" : "✕ Not connected"}
                      showDot={false}
                    />
                  </div>
                </div>
              )}

              {/* Table Name - Works for both DB and CSV */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Table name</Label>
                <div className="flex gap-2">
                  <Input
                    value={localTableName}
                    onChange={(e) => setLocalTableName(e.target.value)}
                    placeholder="messages"
                    className="flex-1"
                  />
                  <Button size="sm" onClick={() => onSetTableName(localTableName)}>
                    Set
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Used for both DB and CSV modes.</p>
              </div>

              {/* User Identifier Column */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">User identifier column</Label>
                <div className="flex gap-2">
                  <Input
                    value={localUserIdCol}
                    onChange={(e) => setLocalUserIdCol(e.target.value)}
                    placeholder="user_identifier"
                    className="flex-1"
                  />
                  <Button size="sm" onClick={() => onSetUserIdentifierCol(localUserIdCol)}>
                    Set
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Column name for grouping users (e.g. visitor_id, user_identifier).</p>
              </div>

              {/* Table Attributes */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs text-muted-foreground">Table attributes (comma separated)</Label>
                <Input
                  value={localTableCols}
                  onChange={(e) => setLocalTableCols(e.target.value)}
                  placeholder="id, user_identifier, sender, admin_name, message, file, created_at"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onSetTableCols(localTableCols)}>
                    Save Attributes
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must include: user id column, sender, message, created_at. file optional.
                </p>
              </div>

              {/* After Date Filter */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Show messages after (ISO-8601)</Label>
                <Input
                  type="date"
                  value={localAfterDate}
                  onChange={(e) => setLocalAfterDate(e.target.value)}
                />
                <Button size="sm" onClick={() => onSetAfterDate(localAfterDate)}>
                  Set
                </Button>
                <p className="text-xs text-muted-foreground">Applied on refresh.</p>
              </div>

              {/* Admin Name */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Admin name</Label>
                <div className="flex gap-2">
                  <Input
                    value={localAdminName}
                    onChange={(e) => setLocalAdminName(e.target.value)}
                    placeholder="e.g. Sumit"
                  />
                  <Button size="sm" onClick={() => onSetAdminName(localAdminName)}>
                    Set
                  </Button>
                </div>
              </div>

              {/* Auto Refresh */}
              {isDbMode && (
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Auto refresh (seconds)</Label>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Input
                      type="number"
                      min={1}
                      value={localAutoSec}
                      onChange={(e) => setLocalAutoSec(e.target.value)}
                      placeholder="(empty)"
                      className="w-24"
                    />
                    <SegmentedControl
                      options={[
                        { value: 'main', label: 'Main ⟳' },
                        { value: 'filtered', label: 'Filtered ⏳' },
                        { value: 'all', label: 'All ↻' },
                      ]}
                      value={localAutoType}
                      onChange={(v) => setLocalAutoType(v as RefreshType)}
                    />
                    <Button size="sm" onClick={() => onSetAutoRefresh(localAutoSec, localAutoType)}>
                      Set
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setLocalAutoSec('');
                        onSetAutoRefresh('', localAutoType);
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    If empty: behaves like CSV mode (manual refresh only). Select which refresh type the timer should use.
                  </p>
                </div>
              )}

              {/* CSV Settings */}
              {!isDbMode && (
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">CSV upload (chat history viewer)</Label>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Input
                      value={localCsvFile?.name || csvFileName}
                      placeholder="Choose a file"
                      disabled
                      className="flex-1 max-w-xs"
                    />
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept="text/csv,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setLocalCsvFile(f);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => csvInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Choose CSV
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (localCsvFile) onLoadCsv(localCsvFile);
                      }}
                      disabled={!localCsvFile}
                    >
                      Load CSV
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={onDownloadCsv}>
                      <Download className="w-4 h-4 mr-1" />
                      Download CSV
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    CSV stays in session cache until refresh/reload.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
