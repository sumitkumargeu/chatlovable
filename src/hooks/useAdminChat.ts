import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

const API_BASE = "https://chatapi-fgqu.onrender.com";

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

const getApiBase = () => {
  const base = String(API_BASE || "").trim();
  return base || window.location.origin;
};

const parseTimeMs = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const t = d.getTime();
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
};

const hash = (s: string): string => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
};

const messageKey = (m: Message, userIdCol: string = 'user_identifier'): string => {
  // Use content-based hashing but normalize timestamps to handle slight differences
  const a = String((m as Record<string, unknown>)[userIdCol] || m.user_identifier || "");
  const b = String(m.sender || "");
  const d = String(m.message || "");
  const e = String(m.file || "");
  
  // Normalize timestamp to nearest second to handle database vs client differences
  let c = "";
  if (m.created_at) {
    try {
      const date = new Date(m.created_at);
      // Round to nearest second to eliminate millisecond differences
      const roundedTime = new Date(Math.floor(date.getTime() / 1000) * 1000);
      c = roundedTime.toISOString();
    } catch {
      c = String(m.created_at);
    }
  }
  
  return `h:${hash(`${a}|${b}|${c}|${d}|${e}`)}`;
};

const normalizeAfterDateForApi = (s: string): string => {
  const v = s.trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return `${v}T00:00:00Z`;
  }
  try {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return v;
};

export const formatUserId = (raw: string): string => {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s;
};

export const initialsFor = (raw: string): string => {
  const s = String(raw || "").trim();
  if (!s) return "?";
  
  // If the identifier contains digits, use the last 2 digits
  const digits = (s.match(/\d+/g) || []).join("");
  if (digits) {
    return digits.slice(-2).padStart(2, "0");
  }
  
  // Otherwise, use the first 2 characters of the string
  const words = s.split(/\s+/).filter(w => w.length > 0);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  
  // If single word, use first 2 characters
  return s.slice(0, 2).toUpperCase();
};

export const isAdminSender = (sender: string): boolean => {
  return String(sender || "").toLowerCase() === "admin";
};

export const toMessageTimeLabel = (iso: string): string => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const t = d.getTime();
    if (!Number.isFinite(t)) return String(iso);

    const now = Date.now();
    const diffMs = Math.max(0, now - t);
    const s = Math.floor(diffMs / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;

    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
};

const parseCsv = (text: string): Record<string, string>[] => {
  const lines = text.split(/\r?\n/).filter((x) => x.trim().length);
  if (!lines.length) return [];

  const splitCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
        continue;
      }
      if (ch === "," && !inQ) {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out;
  };

  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCsvLine(lines[i]);
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = vals[c] ?? "";
    }
    rows.push(obj);
  }
  return rows;
};

export const useAdminChat = () => {
  const [cache, setCache] = useState<CacheData>(() => ({
    mode: 'csv',
    theme: 'dark',
    pgUrl: '',
    pgConnected: false,
    tableName: 'messages',
    tableCols: 'id, visitor_id, sender, admin_name, message, file, created_at',
    userIdentifierCol: 'visitor_id',
    afterDateDraft: new Date().toISOString().slice(0, 10),
    afterDateSet: '',
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
  }));

  const [pendingMessages, setPendingMessages] = useState<Set<string>>(new Set());

  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const healthTimerRef = useRef<NodeJS.Timeout | null>(null);

  const parseCols = useCallback(() => {
    return cache.tableCols.split(",").map((s) => s.trim()).filter(Boolean);
  }, [cache.tableCols]);

  // Helper to get user identifier from a row using the dynamic column name
  const getUserId = useCallback((row: Message | Record<string, unknown>): string => {
    const col = cache.userIdentifierCol || 'user_identifier';
    return String((row as Record<string, unknown>)[col] || row.user_identifier || "");
  }, [cache.userIdentifierCol]);

  const checkApiHealth = useCallback(async () => {
    const base = getApiBase();
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
  }, []);

  const testDbConnection = useCallback(async (): Promise<boolean> => {
    const base = getApiBase();
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
  }, [cache.pgUrl]);

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
            const existingKey = messageKey(existing, userIdCol);
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

        const uid = String((r as Record<string, unknown>)[userIdCol] || r.user_identifier || "");
        const canInc = prev.hasLoadedOnce && markUnread;
        if (canInc && uid && uid !== prev.selectedUser) {
          newUnread[uid] = (newUnread[uid] || 0) + 1;
        }
      }

      newRows.sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return ta - tb;
      });

      return { ...prev, rows: newRows, byKey: newByKey, unread: newUnread };
    });
  }, []);

  const clearData = useCallback(() => {
    setCache(prev => ({
      ...prev,
      rows: [],
      byKey: new Set(),
      unread: {},
      lastIncrementalSince: null,
    }));
  }, []);

  const refreshData = useCallback(async (incremental: boolean) => {
    if (cache.mode === "csv") return;

    let connected = cache.pgConnected;
    if (!connected) {
      connected = await testDbConnection();
      if (!connected) return;
    }

    const base = getApiBase();
    if (!base) return;

    const cols = parseCols();
    const after = normalizeAfterDateForApi(cache.afterDateSet);

    let since: string | null = null;
    if (incremental) {
      since = cache.lastIncrementalSince || after || null;
    } else {
      since = after || null;
      clearData();
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
      if (!j.ok) return;

      const rows = Array.isArray(j.rows) ? j.rows : [];
      addRows(rows, true);

      setCache(prev => {
        const last = prev.rows.at(-1);
        return {
          ...prev,
          hasLoadedOnce: true,
          lastIncrementalSince: last?.created_at || prev.lastIncrementalSince,
        };
      });
    } catch {
      toast.error(`Refresh failed. Check backend at ${base}`);
    }
  }, [cache.mode, cache.pgConnected, cache.pgUrl, cache.tableName, cache.afterDateSet, cache.lastIncrementalSince, testDbConnection, parseCols, clearData, addRows]);

  const refreshCurrentUser = useCallback(async (useAfterFilter: boolean) => {
    if (cache.mode !== "db" || !cache.selectedUser) return;

    let connected = cache.pgConnected;
    if (!connected) {
      connected = await testDbConnection();
      if (!connected) return;
    }

    const base = getApiBase();
    if (!base) return;

    const cols = parseCols();
    const uid = cache.selectedUser;
    const after = useAfterFilter ? normalizeAfterDateForApi(cache.afterDateSet) : "";

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
      if (!j.ok) return;

      const rows = Array.isArray(j.rows) ? j.rows : [];
      const userIdCol = cache.userIdentifierCol || 'user_identifier';
      const onlyUser = rows.filter((x: Message) => String((x as Record<string, unknown>)[userIdCol] || x.user_identifier || "") === uid);

      if (useAfterFilter && after) {
        const afterT = parseTimeMs(after);
        if (afterT) {
          setCache(prev => {
            const filtered = prev.rows.filter((r) => {
              const rowUid = String((r as Record<string, unknown>)[userIdCol] || r.user_identifier || "");
              if (rowUid !== uid) return true;
              const t = parseTimeMs(r.created_at);
              return !t || t >= afterT;
            });
            return {
              ...prev,
              rows: filtered,
              byKey: new Set(filtered.map((r) => messageKey(r, userIdCol))),
            };
          });
        }
      }

      addRows(onlyUser, true);
      setCache(prev => ({ ...prev, hasLoadedOnce: true }));
    } catch {
      toast.error("Refresh failed for current user.");
    }
  }, [cache.mode, cache.pgConnected, cache.pgUrl, cache.tableName, cache.afterDateSet, cache.selectedUser, testDbConnection, parseCols, addRows]);

  const sendMessage = useCallback(async (text: string, attachment: File | null) => {
    if (!cache.selectedUser) return;
    if (!text && !attachment) return;

    // Temporarily disable auto-refresh to prevent duplicates
    const prevAutoRefreshSec = cache.autoRefreshSec;
    setAutoRefresh('', cache.autoRefreshType);

    const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = String(reader.result || "");
          const b64 = res.includes(",") ? res.split(",")[1] : res;
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };

    const userIdCol = cache.userIdentifierCol || 'user_identifier';
    const temp: Message = {
      id: null,
      sender: "admin",
      admin_name: cache.adminName || "",
      message: text,
      file: null,
      created_at: new Date().toISOString(),
      _status: "pending",
      [userIdCol]: cache.selectedUser, // Use dynamic column name
    };

    if (attachment) {
      const b64 = await fileToBase64(attachment);
      temp.file = b64;
    }

    addRows([temp], false);

    if (cache.mode === "csv") {
      setCache(prev => {
        const updated = prev.rows.map(r => {
          if (r === temp) return { ...r, _status: 'sent' as const };
          return r;
        });
        return { ...prev, rows: updated };
      });
      // Re-enable auto-refresh after a delay for CSV mode
      setTimeout(() => setAutoRefresh(prevAutoRefreshSec, cache.autoRefreshType), 2000);
      return;
    }

    if (!cache.pgConnected) {
      setCache(prev => {
        const updated = prev.rows.map(r => {
          if (r === temp) return { ...r, _status: 'failed' as const };
          return r;
        });
        return { ...prev, rows: updated };
      });
      // Re-enable auto-refresh after a delay for failed connection
      setTimeout(() => setAutoRefresh(prevAutoRefreshSec, cache.autoRefreshType), 2000);
      return;
    }

    const base = getApiBase();
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
      const status = j.ok ? 'sent' : 'failed';
      
      setCache(prev => {
        const updated = prev.rows.map(r => {
          if (r.created_at === temp.created_at && r.message === temp.message) {
            return { ...r, _status: status as 'sent' | 'failed' };
          }
          return r;
        });
        return { ...prev, rows: updated };
      });

      // Re-enable auto-refresh after a short delay to allow the message to be processed
      setTimeout(() => setAutoRefresh(prevAutoRefreshSec, cache.autoRefreshType), 3000);
    } catch {
      setCache(prev => {
        const updated = prev.rows.map(r => {
          if (r.created_at === temp.created_at && r.message === temp.message) {
            return { ...r, _status: 'failed' as const };
          }
          return r;
        });
        return { ...prev, rows: updated };
      });
      // Re-enable auto-refresh after a delay for failed send
      setTimeout(() => setAutoRefresh(prevAutoRefreshSec, cache.autoRefreshType), 2000);
    }
  }, [cache.selectedUser, cache.adminName, cache.mode, cache.pgConnected, cache.pgUrl, cache.tableName, cache.autoRefreshSec, cache.autoRefreshType, parseCols, addRows, refreshData]);

  const loadCsv = useCallback(async (file: File) => {
    const txt = await file.text();
    const rows = parseCsv(txt);
    
    clearData();

    const cols = parseCols();
    const normalized = rows.map((r) => {
      const o = { ...r } as Partial<Message>;
      for (const c of cols) {
        if ((o as Record<string, unknown>)[c] === undefined) (o as Record<string, unknown>)[c] = "";
      }
      if (!o.created_at) o.created_at = new Date().toISOString();
      return o;
    });

    addRows(normalized, true);
    setCache(prev => ({ ...prev, csvFileName: file.name }));
  }, [clearData, parseCols, addRows]);

  const toCsv = useCallback((): string => {
    const cols = parseCols();
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      if (s.includes('"') || s.includes(",") || s.includes("\n")) {
        return '"' + s.split('"').join('""') + '"';
      }
      return s;
    };

    const head = cols.join(",");
    const body = cache.rows
      .map((r) => cols.map((c) => esc((r as unknown as Record<string, unknown>)[c])).join(","))
      .join("\n");
    return head + "\n" + body + "\n";
  }, [cache.rows, parseCols]);

  const downloadCsv = useCallback(() => {
    const csv = toCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = cache.csvFileName || "messages.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [toCsv, cache.csvFileName]);

  const selectUser = useCallback((uid: string) => {
    setCache(prev => ({
      ...prev,
      selectedUser: uid,
      unread: { ...prev.unread, [uid]: 0 },
    }));
  }, []);

  const setMode = useCallback((mode: Mode) => {
    setCache(prev => ({ ...prev, mode }));
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    setCache(prev => ({ ...prev, theme }));
    if (theme === 'dark') {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  }, []);

  const setSettings = useCallback((settings: Partial<CacheData>) => {
    setCache(prev => ({ ...prev, ...settings }));
  }, []);

  const setAutoRefresh = useCallback((sec: string, type: RefreshType) => {
    setCache(prev => ({ ...prev, autoRefreshSec: sec, autoRefreshType: type }));
  }, []);

  // Auto refresh timer
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
    }, Math.max(1, Math.floor(n)) * 1000);

    return () => {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current);
      }
    };
  }, [cache.autoRefreshSec, cache.autoRefreshType, cache.mode, refreshData, refreshCurrentUser]);

  // API health polling - every 15 seconds
  useEffect(() => {
    checkApiHealth();
    healthTimerRef.current = setInterval(checkApiHealth, 15000);
    return () => {
      if (healthTimerRef.current) {
        clearInterval(healthTimerRef.current);
      }
    };
  }, [checkApiHealth]);

  // Theme init
  useEffect(() => {
    if (cache.theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [cache.theme]);

  const groupedUsers = useCallback(() => {
    const map = new Map<string, Message[]>();
    const userIdCol = cache.userIdentifierCol || 'user_identifier';
    for (const r of cache.rows) {
      const uid = String((r as Record<string, unknown>)[userIdCol] || r.user_identifier || "");
      if (!uid) continue;
      if (!map.has(uid)) map.set(uid, []);
      map.get(uid)!.push(r);
    }
    return map;
  }, [cache.rows, cache.userIdentifierCol]);

  const selectedMessages = cache.selectedUser
    ? cache.rows.filter((r) => {
        const userIdCol = cache.userIdentifierCol || 'user_identifier';
        return String((r as Record<string, unknown>)[userIdCol] || r.user_identifier || "") === cache.selectedUser;
      })
    : [];

  return {
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
    checkApiHealth,
  };
};
