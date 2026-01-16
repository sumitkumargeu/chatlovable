import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

// Dynamic API endpoints configuration - JSON layout
export const API_ENDPOINTS: Record<string, string> = {
  A: "https://chatapi101.onrender.com",
  // Add more endpoints as needed:
  B: "https://chatapi102.onrender.com",
  C: "https://chatapi102.onrender.com",
  D: "https://chatapi102.onrender.com",
  E: "https://chatapi-fgqu.onrender.com"
};

export interface Message {
  id?: string | number | null;
  user_identifier?: string;
  sender: string;
  admin_name?: string;
  message: string;
  file?: string | null;
  created_at: string;
  _status?: 'pending' | 'sent' | 'failed';
  [key: string]: unknown; // Allow dynamic properties for custom user identifier columns
}

export type Mode = 'db' | 'csv';
export type Theme = 'dark' | 'light';
export type RefreshType = 'main' | 'filtered' | 'all';

interface CacheData {
  mode: Mode;
  theme: Theme;
  selectedApiKey: string; // Selected API endpoint key from JSON
  pgUrl: string;
  pgConnected: boolean;
  tableName: string;
  tableCols: string;
  userIdentifierCol: string; // Dynamic user identifier column name
  afterDateDraft: string;
  afterDateSet: string;
  adminName: string;
  autoRefreshSec: string;
  autoRefreshType: RefreshType;
  rows: Message[];
  byKey: Set<string>;
  selectedUser: string;
  unread: Record<string, number>;
  hasLoadedOnce: boolean;
  lastIncrementalSince: string | null;
  csvFileName: string;
  apiHealthOk: boolean;
}

// Get the list of available API endpoint keys
export const getApiEndpointKeys = (): string[] => Object.keys(API_ENDPOINTS);

// Get API base URL for the selected key
const getApiBase = (selectedKey: string): string => {
  const url = API_ENDPOINTS[selectedKey];
  if (url) return url.trim();
  // Fallback to first available or window origin
  const keys = getApiEndpointKeys();
  if (keys.length > 0) return (API_ENDPOINTS[keys[0]] || "").trim();
  return window.location.origin;
};

const parseTimeMs = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
};

const messageKey = (m: Message, userIdCol: string = 'user_identifier'): string => {
  const userId = String((m as Record<string, unknown>)[userIdCol] || m.user_identifier || "");
  const time = parseTimeMs(m.created_at) ?? 0;
  const id = m.id !== null && m.id !== undefined ? String(m.id) : `opt_${time}`;
  return `${userId}__${id}__${m.message}`;
};

const parseColumns = (cols: string): string[] =>
  cols
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);

// Helper functions exported for components
export const formatUserId = (uid: string): string => {
  if (uid.length > 20) return uid.slice(0, 20) + '...';
  return uid;
};

export const initialsFor = (uid: string): string => {
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '');
  return clean.slice(0, 2).toUpperCase() || '??';
};

export const toMessageTimeLabel = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const isAdminSender = (sender: string): boolean => {
  return sender?.toLowerCase() === 'admin';
};

const formatSize = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}MB` : `${(n / 1_000).toFixed(1)}KB`;

export function useAdminChat() {
  const [cache, setCache] = useState<CacheData>(() => {
    const keys = getApiEndpointKeys();
    return {
      mode: 'db',
      theme: 'dark',
      selectedApiKey: keys.length > 0 ? keys[0] : '',
      pgUrl: '',
      pgConnected: false,
      tableName: 'messages',
      tableCols: 'id, visitor_id, sender, admin_name, message, file, created_at',
      userIdentifierCol: 'visitor_id',
      afterDateDraft: new Date().toISOString().slice(0, 10),
      afterDateSet: new Date().toISOString().slice(0, 10),
      adminName: '',
      autoRefreshSec: '',
      autoRefreshType: 'main',
      rows: [],
      byKey: new Set(),
      selectedUser: '',
      unread: {},
      hasLoadedOnce: false,
      lastIncrementalSince: null,
      csvFileName: '',
      apiHealthOk: false,
    };
  });

  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parseCols = useCallback((): string[] => parseColumns(cache.tableCols), [cache.tableCols]);

  // Helper to get user identifier from a row using the dynamic column name
  const getUserId = useCallback((row: Message | Record<string, unknown>): string => {
    const col = cache.userIdentifierCol || 'user_identifier';
    return String((row as Record<string, unknown>)[col] || row.user_identifier || "");
  }, [cache.userIdentifierCol]);

  // Set selected API endpoint
  const setSelectedApiKey = useCallback((key: string) => {
    if (API_ENDPOINTS[key]) {
      setCache(prev => ({ ...prev, selectedApiKey: key, apiHealthOk: false }));
    }
  }, []);

  const checkApiHealth = useCallback(async () => {
    const base = getApiBase(cache.selectedApiKey);
    if (!base) {
      setCache(prev => ({ ...prev, apiHealthOk: false }));
      return;
    }
    try {
      const r = await fetch(`${base}/api/health`, { method: "GET" });
      const j = await r.json();
      setCache(prev => ({ ...prev, apiHealthOk: !!j.ok }));
    } catch {
      setCache(prev => ({ ...prev, apiHealthOk: false }));
    }
  }, [cache.selectedApiKey]);

  const testDbConnection = useCallback(async (): Promise<boolean> => {
    const base = getApiBase(cache.selectedApiKey);
    if (!base) {
      setCache(prev => ({ ...prev, pgConnected: false }));
      toast.error("API_BASE is empty. Set it to your backend URL.");
      return false;
    }

    try {
      const r = await fetch(`${base}/api/db-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ db_url: cache.pgUrl }),
      });
      const j = await r.json();
      const connected = !!j.connected;
      setCache(prev => ({ ...prev, pgConnected: connected }));
      return connected;
    } catch {
      setCache(prev => ({ ...prev, pgConnected: false }));
      toast.error(`DB test failed. API unreachable at ${base}`);
      return false;
    }
  }, [cache.pgUrl, cache.selectedApiKey]);

  const normalizeRow = (r: Partial<Message>): Message => {
    const out = { ...r } as Message;
    if (!out.sender) out.sender = "user";
    if (!out.created_at) out.created_at = new Date().toISOString();
    if (out.file === "") out.file = null;
    return out;
  };

  const addRows = useCallback((rows: Partial<Message>[], markUnread = true) => {
    setCache(prev => {
      const newRows = [...prev.rows];
      const newByKey = new Set(prev.byKey);
      const newUnread = { ...prev.unread };
      const userIdCol = prev.userIdentifierCol || 'user_identifier';
      
      for (const raw of rows) {
        const r = normalizeRow(raw);
        const key = messageKey(r, userIdCol);
        
        // Check if this is a database version of a pending message
        if (r.id !== null && r.id !== undefined) {
          // This is a database message, check if it matches any pending message
          const matchingPendingIndex = newRows.findIndex(existing => {
            if (existing.id !== null) return false; // Only match with optimistic messages
            // Check if content matches (ignoring exact timestamp)
            return existing.sender === r.sender && 
                   existing.message === r.message &&
                   String((existing as Record<string, unknown>)[userIdCol] || existing.user_identifier || "") === String((r as Record<string, unknown>)[userIdCol] || r.user_identifier || "");
          });
          
          if (matchingPendingIndex !== -1) {
            // Replace the optimistic message with the database version
            newRows[matchingPendingIndex] = r;
            const oldKey = messageKey(newRows[matchingPendingIndex], userIdCol);
            newByKey.delete(oldKey);
            newByKey.add(key);
            continue;
          }
        }
        
        if (newByKey.has(key)) continue;
        newByKey.add(key);
        newRows.push(r);

        // Mark unread only for user messages, not currently selected
        if (markUnread && r.sender === 'user') {
          const uid = String((r as Record<string, unknown>)[userIdCol] || r.user_identifier || "");
          if (uid && uid !== prev.selectedUser) {
            newUnread[uid] = (newUnread[uid] || 0) + 1;
          }
        }
      }

      // Sort by created_at
      newRows.sort((a, b) => parseTimeMs(a.created_at)! - parseTimeMs(b.created_at)!);
      return { ...prev, rows: newRows, byKey: newByKey, unread: newUnread };
    });
  }, []);

  const setMode = useCallback((m: Mode) => {
    setCache(prev => ({ ...prev, mode: m }));
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setCache(prev => ({ ...prev, theme: t }));
  }, []);

  interface SettingsPayload {
    pgUrl?: string;
    tableName?: string;
    tableCols?: string;
    userIdentifierCol?: string;
    afterDateDraft?: string;
    afterDateSet?: string;
    adminName?: string;
  }

  const setSettings = useCallback((s: SettingsPayload) => {
    setCache(prev => ({ ...prev, ...s }));
  }, []);

  const setAutoRefresh = useCallback((sec: string, type: RefreshType) => {
    setCache(prev => ({ ...prev, autoRefreshSec: sec, autoRefreshType: type }));
  }, []);

  const selectUser = useCallback((uid: string) => {
    setCache(prev => {
      const newUnread = { ...prev.unread };
      delete newUnread[uid];
      return { ...prev, selectedUser: uid, unread: newUnread };
    });
  }, []);

  // Incremental refresh - fetches only new rows since last check
  const refreshData = useCallback(async (incremental: boolean) => {
    if (cache.mode !== 'db') return;
    const base = getApiBase(cache.selectedApiKey);
    if (!base) return;

    const cols = parseCols();
    let since: string | null = null;

    if (incremental && cache.lastIncrementalSince) {
      since = cache.lastIncrementalSince;
    } else if (!cache.hasLoadedOnce && cache.afterDateSet) {
      since = cache.afterDateSet;
    }

    try {
      const r = await fetch(`${base}/api/messages/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_url: cache.pgUrl,
          table: cache.tableName,
          columns: cols,
          since,
          limit: 5000,
        }),
      });
      const j = await r.json();
      const rows: Partial<Message>[] = j.rows || [];
      
      if (rows.length > 0) {
        addRows(rows, cache.hasLoadedOnce);
        // Update lastIncrementalSince to the latest created_at
        const latestRow = rows[rows.length - 1];
        if (latestRow?.created_at) {
          setCache(prev => ({ 
            ...prev, 
            hasLoadedOnce: true,
            lastIncrementalSince: latestRow.created_at ?? null 
          }));
        }
      } else {
        setCache(prev => ({ ...prev, hasLoadedOnce: true }));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Fetch rows failed: ${msg}`);
    }
  }, [cache.mode, cache.pgUrl, cache.tableName, cache.afterDateSet, cache.hasLoadedOnce, cache.lastIncrementalSince, cache.selectedApiKey, parseCols, addRows]);

  // Refresh for a specific user with optional date filter
  const refreshCurrentUser = useCallback(async (useAfter: boolean) => {
    if (cache.mode !== 'db' || !cache.selectedUser) return;
    const base = getApiBase(cache.selectedApiKey);
    if (!base) return;

    const cols = parseCols();
    const after = useAfter ? cache.afterDateSet : null;

    try {
      const r = await fetch(`${base}/api/messages/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_url: cache.pgUrl,
          table: cache.tableName,
          columns: cols,
          since: after || null,
          limit: 5000,
        }),
      });
      const j = await r.json();
      const rows: Partial<Message>[] = j.rows || [];
      
      // Filter to just the selected user
      const userIdCol = cache.userIdentifierCol || 'user_identifier';
      const userRows = rows.filter(row => {
        const rowUserId = String((row as Record<string, unknown>)[userIdCol] || row.user_identifier || "");
        return rowUserId === cache.selectedUser;
      });
      
      if (userRows.length > 0) {
        addRows(userRows, false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Refresh user failed: ${msg}`);
    }
  }, [cache.mode, cache.pgUrl, cache.tableName, cache.afterDateSet, cache.selectedUser, cache.userIdentifierCol, cache.selectedApiKey, parseCols, addRows]);

  const sendMessage = useCallback(async (msg: string, fileBase64: string | null) => {
    if (!cache.selectedUser) return;
    const userIdCol = cache.userIdentifierCol || 'user_identifier';
    
    const temp: Message = {
      id: null,
      sender: 'admin',
      admin_name: cache.adminName || 'Admin',
      message: msg,
      file: fileBase64,
      created_at: new Date().toISOString(),
      _status: 'pending',
    };
    // Set the dynamic user identifier
    (temp as Record<string, unknown>)[userIdCol] = cache.selectedUser;
    temp.user_identifier = cache.selectedUser;

    // Optimistic UI
    addRows([temp], false);

    if (cache.mode === 'csv') return; // CSV mode only

    const base = getApiBase(cache.selectedApiKey);
    if (!base) return;

    try {
      const r = await fetch(`${base}/api/messages/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_url: cache.pgUrl,
          table: cache.tableName,
          columns: parseCols(),
          user_identifier_col: userIdCol,
          user_identifier: cache.selectedUser,
          sender: "admin",
          admin_name: temp.admin_name,
          message: temp.message,
          file_base64: temp.file,
          created_at: temp.created_at,
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        toast.error(`Send failed: ${j.error || 'unknown'}`);
      }
      // Don't refresh after send - the optimistic message is enough
      // The next refresh cycle will confirm the message
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      toast.error(`Send failed: ${err}`);
    }
  }, [cache.selectedUser, cache.adminName, cache.mode, cache.pgUrl, cache.tableName, cache.userIdentifierCol, cache.selectedApiKey, parseCols, addRows]);

  const loadCsv = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        toast.warning('CSV must have header + at least 1 row');
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim());
      
      const rows: Partial<Message>[] = [];
      for (let i = 1; i < lines.length; i++) {
        // Handle quoted values
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (const char of lines[i]) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        
        const row: Record<string, string> = {};
        headers.forEach((h, j) => {
          row[h] = values[j] || '';
        });
        rows.push(row as unknown as Partial<Message>);
      }
      
      setCache(prev => ({
        ...prev,
        mode: 'csv',
        rows: [],
        byKey: new Set(),
        unread: {},
        selectedUser: '',
        hasLoadedOnce: false,
        csvFileName: file.name,
        tableCols: headers.join(', '),
      }));
      
      // Then add all rows
      setTimeout(() => {
        addRows(rows, false);
        toast.success(`Loaded ${rows.length} rows from ${file.name}`);
      }, 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`CSV load failed: ${msg}`);
    }
  }, [addRows]);

  const downloadCsv = useCallback(() => {
    if (cache.rows.length === 0) {
      toast.warning('No data to export');
      return;
    }
    const headers = parseCols();
    const csvRows = [headers.join(',')];
    for (const row of cache.rows) {
      const values = headers.map(h => {
        const val = (row as Record<string, unknown>)[h];
        const str = val == null ? '' : String(val);
        // Escape quotes and wrap in quotes if contains comma
        if (str.includes(',') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvRows.push(values.join(','));
    }
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cache.csvFileName || `${cache.tableName}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${cache.rows.length} rows (${formatSize(blob.size)})`);
  }, [cache.rows, cache.csvFileName, cache.tableName, parseCols]);

  // Grouped users from rows
  const groupedUsers = useCallback(() => {
    const map = new Map<string, { count: number; lastTime: number }>();
    const userIdCol = cache.userIdentifierCol || 'user_identifier';
    for (const row of cache.rows) {
      const uid = getUserId(row);
      if (!uid) continue;
      const t = parseTimeMs(row.created_at) ?? 0;
      const prev = map.get(uid);
      if (!prev) {
        map.set(uid, { count: 1, lastTime: t });
      } else {
        prev.count++;
        if (t > prev.lastTime) prev.lastTime = t;
      }
    }
    return map;
  }, [cache.rows, cache.userIdentifierCol, getUserId]);

  // Messages for selected user
  const selectedMessages = useCallback((): Message[] => {
    if (!cache.selectedUser) return [];
    return cache.rows.filter(r => getUserId(r) === cache.selectedUser);
  }, [cache.rows, cache.selectedUser, getUserId]);

  // API health check effect - every 15 seconds
  useEffect(() => {
    checkApiHealth();
    const interval = setInterval(checkApiHealth, 15000);
    return () => clearInterval(interval);
  }, [checkApiHealth]);

  // Re-check API health when endpoint changes
  useEffect(() => {
    checkApiHealth();
  }, [cache.selectedApiKey, checkApiHealth]);

  // Auto-refresh timer
  useEffect(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }

    const n = Number(cache.autoRefreshSec);
    if (!Number.isFinite(n) || n <= 0 || cache.mode !== 'db') return;

    autoTimerRef.current = setInterval(() => {
      if (cache.autoRefreshType === 'main') {
        refreshData(true);
      } else if (cache.autoRefreshType === 'filtered') {
        refreshCurrentUser(true);
      } else {
        refreshCurrentUser(false);
      }
    }, n * 1000);

    return () => {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current);
      }
    };
  }, [cache.autoRefreshSec, cache.autoRefreshType, cache.mode, refreshData, refreshCurrentUser]);

  // Theme effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', cache.theme === 'dark');
  }, [cache.theme]);

  return {
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
  };
}
