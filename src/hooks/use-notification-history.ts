import { useState, useEffect } from 'react';
import {
  NotificationItem,
  getNotificationHistory,
  clearNotificationHistory,
  deleteNotificationHistoryItem,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  addNotificationHistoryItem,
} from '@/src/services/notificationHistory';

export function useNotificationHistory() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(getNotificationHistory);

  useEffect(() => {
    const handleUpdate = () => {
      setNotifications(getNotificationHistory());
    };

    window.addEventListener('sawyer_notifications_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('sawyer_notifications_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    clearHistory: clearNotificationHistory,
    deleteNotification: deleteNotificationHistoryItem,
    markAllAsRead: markAllNotificationsAsRead,
    markAsRead: markNotificationAsRead,
    addNotification: addNotificationHistoryItem,
  };
}
