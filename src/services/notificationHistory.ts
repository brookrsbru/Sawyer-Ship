import { toast } from 'sonner';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'default';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  description?: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = 'sawyer_notification_history';
export const MAX_NOTIFICATIONS = 100;

export function getNotificationHistory(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_NOTIFICATIONS);
  } catch (e) {
    console.error('Failed to load notification history:', e);
    return [];
  }
}

export function saveNotificationHistory(items: NotificationItem[]): void {
  try {
    // Purge any older than 100
    const limited = items.slice(0, MAX_NOTIFICATIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
    window.dispatchEvent(new CustomEvent('sawyer_notifications_updated'));
  } catch (e) {
    console.error('Failed to save notification history:', e);
  }
}

export function addNotificationHistoryItem(item: {
  id?: string;
  type: NotificationType;
  message: string;
  description?: string;
  timestamp?: number;
  read?: boolean;
}): NotificationItem {
  const current = getNotificationHistory();
  const newItem: NotificationItem = {
    id: item.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    type: item.type,
    message: String(item.message || ''),
    description: item.description ? String(item.description) : undefined,
    timestamp: item.timestamp ?? Date.now(),
    read: item.read ?? false,
  };

  // Add to top of list
  const updated = [newItem, ...current];
  // Purge any more than 100 notifications old
  const purged = updated.slice(0, MAX_NOTIFICATIONS);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(purged));
    window.dispatchEvent(new CustomEvent('sawyer_notifications_updated'));
  } catch (e) {
    console.error('Failed to add notification history item:', e);
  }

  return newItem;
}

export function deleteNotificationHistoryItem(id: string): void {
  const current = getNotificationHistory();
  const updated = current.filter(item => item.id !== id);
  saveNotificationHistory(updated);
}

export function clearNotificationHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('sawyer_notifications_updated'));
  } catch (e) {
    console.error('Failed to clear notification history:', e);
  }
}

export function markAllNotificationsAsRead(): void {
  const current = getNotificationHistory();
  const updated = current.map(item => ({ ...item, read: true }));
  saveNotificationHistory(updated);
}

export function markNotificationAsRead(id: string): void {
  const current = getNotificationHistory();
  const updated = current.map(item => item.id === id ? { ...item, read: true } : item);
  saveNotificationHistory(updated);
}

let isTrackingInitialized = false;

function extractText(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (obj.title) return extractText(obj.title);
    if (obj.message) return extractText(obj.message);
    if (obj.props && typeof obj.props === 'object' && (obj.props as any).children) {
      return extractText((obj.props as any).children);
    }
    return JSON.stringify(val);
  }
  return String(val);
}

/**
 * Automatically intercepts Sonner toast calls so that every toast appearing in the top right
 * is tracked into persistent history, capping at 100 items and purging older entries.
 */
export function initToastNotificationTracking(): void {
  if (isTrackingInitialized) return;
  isTrackingInitialized = true;

  const originalSuccess = toast.success;
  const originalError = toast.error;
  const originalWarning = toast.warning;
  const originalInfo = toast.info;
  const originalMessage = toast.message;
  const originalCustom = toast.custom;

  const handleIntercept = (
    type: NotificationType, 
    msg: unknown, 
    data?: any, 
    originalFn?: Function
  ) => {
    const message = extractText(msg);
    let description: string | undefined = undefined;
    if (data?.description) {
      description = extractText(data.description);
    }

    // Generate unique ID for tracing
    const id = data?.id ? String(data.id) : `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    addNotificationHistoryItem({
      id,
      type,
      message: message || `System Notification (${type})`,
      description,
    });

    if (originalFn) {
      return originalFn(msg, { ...data, id });
    }
  };

  toast.success = (msg: any, data?: any) => {
    return handleIntercept('success', msg, data, originalSuccess);
  };

  toast.error = (msg: any, data?: any) => {
    return handleIntercept('error', msg, data, originalError);
  };

  toast.warning = (msg: any, data?: any) => {
    return handleIntercept('warning', msg, data, originalWarning);
  };

  toast.info = (msg: any, data?: any) => {
    return handleIntercept('info', msg, data, originalInfo);
  };

  toast.message = (msg: any, data?: any) => {
    return handleIntercept('default', msg, data, originalMessage);
  };

  toast.custom = (jsx: any, data?: any) => {
    return handleIntercept('default', 'Custom Notification', data, originalCustom);
  };
}
