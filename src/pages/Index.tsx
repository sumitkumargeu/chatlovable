import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  RefreshCcw, 
  Sun, 
  Moon, 
  Timer, 
  RotateCcw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAdminChat, getApiEndpointKeys, API_ENDPOINTS } from '@/hooks/useAdminChat';
import { StatusPill } from '@/components/StatusPill';
import { IconButton } from '@/components/IconButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { UsersList } from '@/components/UsersList';
import { ChatMessages } from '@/components/ChatMessages';
import { ChatComposer } from '@/components/ChatComposer';
import { SettingsModal } from '@/components/SettingsModal';
import ApiSelector from '@/components/ApiSelector';
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
    setSelectedApiKey,
    refreshData,
    refreshCurrentUser,
    sendMessage,
    loadCsv,
    downloadCsv,
    testDbConnection,
  } = useAdminChat();

  const [showSettings, setShowSettings] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mobileUsersExpanded, setMobileUsersExpanded] = useState(false);
  const [leftWidth, setLeftWidth] = useState(280);
  const dividerRef = useRef<HTMLDivElement>(null);

  // Prepare API endpoints for selector
  const apiEndpoints = getApiEndpointKeys().map(key => ({
    key,
    url: API_ENDPOINTS[key] || ''
  }));

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

  // Divider drag handler
  const handleDividerDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = leftWidth;

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      setLeftWidth(Math.max(200, Math.min(500, startW + delta)));
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [leftWidth]);

  const formatUserId = (uid: string) => {
    if (uid.length > 20) return uid.slice(0, 20) + '...';
    return uid;
  };

  // Initial data load
  useEffect(() => {
    if (cache.mode === 'db' && cache.pgUrl && !cache.hasLoadedOnce) {
      refreshData(false);
    }
  }, [cache.mode, cache.pgUrl, cache.hasLoadedOnce, refreshData]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-line backdrop-blur-xl bg-background/85">
        <div className="flex items-center gap-3 flex-wrap">
          <StatusPill
            isGood={cache.apiHealthOk}
            label="API"
          />
          <ApiSelector
            endpoints={apiEndpoints}
            selectedKey={cache.selectedApiKey}
            onSelect={setSelectedApiKey}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh Button */}
          <IconButton
            icon={RefreshCcw}
            label="Refresh"
            onClick={handleMainRefresh}
            disabled={cache.mode !== 'db'}
            className={isRefreshing ? 'animate-spin' : ''}
          />

          {/* DB/CSV Toggle */}
          <SegmentedControl
            options={['DB', 'CSV']}
            value={cache.mode === 'db' ? 'DB' : 'CSV'}
            onChange={(v) => setMode(v === 'DB' ? 'db' : 'csv')}
          />

          {/* Theme Toggle */}
          <IconButton
            icon={cache.theme === 'dark' ? Sun : Moon}
            label={cache.theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={() => setTheme(cache.theme === 'dark' ? 'light' : 'dark')}
          />

          {/* Settings */}
          <IconButton
            icon={Settings}
            label="Settings"
            onClick={() => setShowSettings(true)}
          />
        </div>
      </header>

      {/* Main Content */}
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
                    ? 'No admin name set'
                    : 'Choose a conversation'}
              </p>
            </div>
            
            {cache.selectedUser && cache.mode === 'db' && (
              <div className="flex items-center gap-2">
                <IconButton
                  icon={Timer}
                  label="Refresh with filter"
                  size="sm"
                  onClick={handleRefreshFiltered}
                />
                <IconButton
                  icon={RotateCcw}
                  label="Refresh all"
                  size="sm"
                  onClick={handleRefreshAll}
                />
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-hidden">
            <ChatMessages
              messages={selectedMessages()}
            />
          </div>

          {/* Composer */}
          <ChatComposer
            disabled={!cache.selectedUser}
            onSend={sendMessage}
          />
        </section>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        mode={cache.mode}
        pgUrl={cache.pgUrl}
        pgConnected={cache.pgConnected}
        tableName={cache.tableName}
        tableCols={cache.tableCols}
        userIdentifierCol={cache.userIdentifierCol}
        afterDateDraft={cache.afterDateDraft}
        adminName={cache.adminName}
        autoRefreshSec={cache.autoRefreshSec}
        autoRefreshType={cache.autoRefreshType}
        csvFileName={cache.csvFileName}
        onSavePgUrl={(v) => setSettings({ pgUrl: v })}
        onSetTableName={(v) => setSettings({ tableName: v })}
        onSetTableCols={(v) => setSettings({ tableCols: v })}
        onSetUserIdentifierCol={(v) => setSettings({ userIdentifierCol: v })}
        onSetAfterDate={(v) => setSettings({ afterDateDraft: v, afterDateSet: v })}
        onSetAdminName={(v) => setSettings({ adminName: v })}
        onSetAutoRefresh={setAutoRefresh}
        onLoadCsv={loadCsv}
        onDownloadCsv={downloadCsv}
      />
    </div>
  );
};

export default Index;
