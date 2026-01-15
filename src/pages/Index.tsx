import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, RefreshCw, Sun, Moon, Timer, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useAdminChat, formatUserId, Message } from '@/hooks/useAdminChat';
import { StatusPill } from '@/components/StatusPill';
import { IconButton } from '@/components/IconButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { UsersList } from '@/components/UsersList';
import { ChatMessages } from '@/components/ChatMessages';
import { ChatComposer } from '@/components/ChatComposer';
import { SettingsModal } from '@/components/SettingsModal';
import { AttachmentPreview } from '@/components/AttachmentPreview';
import { toast } from 'sonner';

const Index = () => {
  const {
    cache,
    groupedUsers,
    selectedMessages,
    selectUser,
    setMode,
    setTheme,
    setSettings,
    setAutoRefresh,
    refreshData,
    refreshCurrentUser,
    sendMessage,
    loadCsv,
    downloadCsv,
    testDbConnection,
  } = useAdminChat();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<Message | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mobileUsersExpanded, setMobileUsersExpanded] = useState(true);
  
  const dividerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(320);

  const handleMainRefresh = useCallback(async () => {
    if (cache.mode !== 'db') return;
    setIsRefreshing(true);
    await refreshData(true);
    setIsRefreshing(false);
    toast.success('Refreshed');
  }, [cache.mode, refreshData]);

  const handleRefreshFiltered = useCallback(async () => {
    if (cache.mode !== 'db') return;
    await refreshCurrentUser(true);
    toast.success('Refreshed (filtered)');
  }, [cache.mode, refreshCurrentUser]);

  const handleRefreshAll = useCallback(async () => {
    if (cache.mode !== 'db') return;
    await refreshCurrentUser(false);
    toast.success('Refreshed (all)');
  }, [cache.mode, refreshCurrentUser]);

  const handleDividerDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;

    const onMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(220, Math.min(520, startWidth + delta));
      setLeftWidth(newWidth);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [leftWidth]);

  const handleSavePgUrl = useCallback(async (url: string) => {
    setSettings({ pgUrl: url });
    const connected = await testDbConnection();
    if (connected) {
      toast.success('Connected to database');
    }
  }, [setSettings, testDbConnection]);

  return (
    <div className="h-full flex flex-col gradient-bg">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-line backdrop-blur-xl bg-background/85">
        <div className="flex items-center gap-3">
          <StatusPill
            isGood={cache.apiHealthOk}
            label="API"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SegmentedControl
            options={[
              { value: 'db', label: 'DB' },
              { value: 'csv', label: 'CSV' },
            ]}
            value={cache.mode}
            onChange={setMode}
          />

          <IconButton
            onClick={() => setTheme(cache.theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {cache.theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </IconButton>

          {cache.mode === 'db' && (
            <IconButton
              onClick={handleMainRefresh}
              aria-label="Refresh"
              className={isRefreshing ? 'animate-spin' : ''}
            >
              <RefreshCw className="w-5 h-5" />
            </IconButton>
          )}

          <IconButton onClick={() => setSettingsOpen(true)} aria-label="Settings">
            <Settings className="w-5 h-5" />
          </IconButton>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex flex-col md:flex-row min-h-0 p-3 gap-3">
        {/* Users Panel - Mobile Collapsible */}
        <section
          className="md:hidden glass-panel rounded-2xl overflow-hidden flex flex-col"
          style={{ height: mobileUsersExpanded ? '220px' : '56px' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-line cursor-pointer"
            onClick={() => setMobileUsersExpanded(!mobileUsersExpanded)}
          >
            <span className="font-semibold text-sm">Users ({groupedUsers().size})</span>
            {mobileUsersExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <AnimatePresence>
            {mobileUsersExpanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-hidden"
              >
                <UsersList
                  groupedUsers={groupedUsers()}
                  selectedUser={cache.selectedUser}
                  unread={cache.unread}
                  onSelectUser={selectUser}
                  isCollapsed={false}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Users Panel - Desktop */}
        <section
          className="hidden md:flex glass-panel rounded-2xl overflow-hidden flex-col flex-shrink-0"
          style={{ width: `${leftWidth}px` }}
        >
          <div className="px-4 py-3 border-b border-line font-semibold text-sm">
            Users ({groupedUsers().size})
          </div>
          <div className="flex-1 overflow-hidden">
            <UsersList
              groupedUsers={groupedUsers()}
              selectedUser={cache.selectedUser}
              unread={cache.unread}
              onSelectUser={selectUser}
            />
          </div>
        </section>

        {/* Divider - Desktop Only */}
        <div
          ref={dividerRef}
          onPointerDown={handleDividerDrag}
          className="hidden md:block w-2.5 rounded-full bg-line/75 cursor-col-resize hover:bg-primary/35 transition-colors flex-shrink-0"
        />

        {/* Chat Panel */}
        <section className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col min-h-0">
          {/* Chat Header */}
          <div className="flex items-start justify-between px-4 py-3 border-b border-line">
            <div>
              <h2 className="font-bold">
                {cache.selectedUser ? formatUserId(cache.selectedUser) : 'Select a user'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cache.selectedUser && cache.adminName
                  ? `Admin • ${cache.adminName}`
                  : cache.selectedUser
                  ? 'Admin'
                  : '\u00A0'}
              </p>
            </div>

            {cache.selectedUser && cache.mode === 'db' && (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <IconButton
                    size="sm"
                    onClick={handleRefreshFiltered}
                    aria-label="Refresh current user (filtered)"
                    title="Refresh with date filter"
                  >
                    <Timer className="w-4 h-4" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    onClick={handleRefreshAll}
                    aria-label="Refresh current user (all)"
                    title="Refresh all messages"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </IconButton>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {cache.mode === 'db' ? 'DB mode' : 'CSV mode'}
                </span>
              </div>
            )}
          </div>

          {/* Messages */}
          <ChatMessages
            messages={selectedMessages}
            onOpenAttachment={setAttachmentPreview}
          />

          {/* Composer */}
          <ChatComposer
            onSend={sendMessage}
            disabled={!cache.selectedUser}
          />
        </section>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        mode={cache.mode}
        pgUrl={cache.pgUrl}
        pgConnected={cache.pgConnected}
        tableName={cache.tableName}
        tableCols={cache.tableCols}
        afterDateDraft={cache.afterDateDraft}
        adminName={cache.adminName}
        autoRefreshSec={cache.autoRefreshSec}
        autoRefreshType={cache.autoRefreshType}
        csvFileName={cache.csvFileName}
        onSavePgUrl={handleSavePgUrl}
        onSetTableName={(name) => {
          setSettings({ tableName: name });
          toast.success(`Table set to: ${name}`);
        }}
        onSetTableCols={(cols) => {
          setSettings({ tableCols: cols });
          toast.success('Table attributes updated');
        }}
        onSetAfterDate={(date) => {
          setSettings({ afterDateSet: date, afterDateDraft: date });
          toast.success('Date filter set');
        }}
        onSetAdminName={(name) => {
          setSettings({ adminName: name });
          toast.success('Admin name set');
        }}
        onSetAutoRefresh={(sec, type) => {
          setAutoRefresh(sec, type);
          if (sec) {
            toast.success(`Auto refresh set: ${sec}s (${type})`);
          } else {
            toast.success('Auto refresh cleared');
          }
        }}
        onLoadCsv={async (file) => {
          await loadCsv(file);
          toast.success('CSV loaded');
        }}
        onDownloadCsv={downloadCsv}
      />

      {/* Attachment Preview */}
      <AttachmentPreview
        message={attachmentPreview}
        onClose={() => setAttachmentPreview(null)}
      />
    </div>
  );
};

export default Index;
