import React, { useState, useMemo, useEffect } from 'react';
import { 
  Bell, 
  Trash2, 
  Search, 
  CheckCheck, 
  CheckCircle2, 
  OctagonX, 
  TriangleAlert, 
  Info, 
  Clock,
  Filter,
  Check,
  AlertCircle
} from 'lucide-react';
import { useNotificationHistory } from '@/src/hooks/use-notification-history';
import { NotificationItem, NotificationType, MAX_NOTIFICATIONS, markAllNotificationsAsRead } from '@/src/services/notificationHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';

function formatTimestamp(ts: number): { relative: string; exact: string } {
  const date = new Date(ts);
  const now = Date.now();
  const diffSec = Math.floor((now - ts) / 1000);

  let relative = '';
  if (diffSec < 10) {
    relative = 'Just now';
  } else if (diffSec < 60) {
    relative = `${diffSec}s ago`;
  } else if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    relative = `${mins}m ago`;
  } else if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    relative = `${hours}h ago`;
  } else {
    const days = Math.floor(diffSec / 86400);
    relative = `${days}d ago`;
  }

  const exact = date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return { relative, exact };
}

export default function NotificationHistory() {
  const { 
    notifications, 
    unreadCount, 
    clearHistory, 
    deleteNotification, 
    markAllAsRead, 
    markAsRead 
  } = useNotificationHistory();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  // Automatically mark all notifications as read when the notifications page is left
  useEffect(() => {
    const handleBeforeUnload = () => {
      markAllNotificationsAsRead();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      markAllNotificationsAsRead();
    };
  }, []);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      // Type filter
      if (selectedType === 'unread') {
        if (item.read) return false;
      } else if (selectedType !== 'all' && item.type !== selectedType) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const msgMatch = item.message.toLowerCase().includes(q);
        const descMatch = item.description?.toLowerCase().includes(q);
        const typeMatch = item.type.toLowerCase().includes(q);
        return msgMatch || descMatch || typeMatch;
      }

      return true;
    });
  }, [notifications, selectedType, searchQuery]);

  // Counts by type
  const counts = useMemo(() => {
    const c = {
      all: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      success: notifications.filter(n => n.type === 'success').length,
      error: notifications.filter(n => n.type === 'error').length,
      warning: notifications.filter(n => n.type === 'warning').length,
      info: notifications.filter(n => n.type === 'info').length,
    };
    return c;
  }, [notifications]);

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
      case 'error':
        return <OctagonX className="w-5 h-5 text-rose-600 shrink-0" />;
      case 'warning':
        return <TriangleAlert className="w-5 h-5 text-amber-600 shrink-0" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600 shrink-0" />;
      default:
        return <Bell className="w-5 h-5 text-zinc-600 shrink-0" />;
    }
  };

  const getTypeBadgeClass = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'error':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'info':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Notification History</h1>
            <span className="text-xs font-semibold px-2.5 py-1 bg-zinc-100 text-zinc-700 rounded-full border border-zinc-200">
              {notifications.length} / {MAX_NOTIFICATIONS}
            </span>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Audit trail of the last 100 system notifications and toasts (automatically purged beyond 100).
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={markAllAsRead}
              className="gap-1.5 text-zinc-700"
            >
              <CheckCheck size={16} />
              <span>Mark All Read</span>
            </Button>
          )}

          {notifications.length > 0 && (
            <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                >
                  <Trash2 size={16} />
                  <span>Clear History</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                    Clear All Notifications?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {notifications.length} stored notifications from this device's history.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel variant="outline" size="default">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    variant="default"
                    size="default"
                    onClick={() => {
                      clearHistory();
                      setIsClearDialogOpen(false);
                      toast.success("Notification history cleared");
                    }}
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    Clear History
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedType === 'all'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            All ({counts.all})
          </button>
          {counts.unread > 0 && (
            <button
              onClick={() => setSelectedType('unread')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedType === 'unread'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              Unread ({counts.unread})
            </button>
          )}
          <button
            onClick={() => setSelectedType('success')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedType === 'success'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white border border-zinc-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Success ({counts.success})
          </button>
          <button
            onClick={() => setSelectedType('error')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedType === 'error'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white border border-zinc-200 text-rose-700 hover:bg-rose-50'
            }`}
          >
            Errors ({counts.error})
          </button>
          <button
            onClick={() => setSelectedType('warning')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedType === 'warning'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white border border-zinc-200 text-amber-700 hover:bg-amber-50'
            }`}
          >
            Warnings ({counts.warning})
          </button>
          <button
            onClick={() => setSelectedType('info')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedType === 'info'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-zinc-200 text-blue-700 hover:bg-blue-50'
            }`}
          >
            Info ({counts.info})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-sm h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-xs text-zinc-400 hover:text-zinc-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
              <Bell size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-zinc-900">
                {notifications.length === 0 
                  ? "No notifications recorded yet" 
                  : "No notifications match your current filter"}
              </h3>
              <p className="text-sm text-zinc-500 max-w-sm">
                {notifications.length === 0
                  ? "Any toasts displayed in Sawyer-Ship will automatically be logged here, up to the last 100 entries."
                  : "Try clearing your search query or selecting a different notification category."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifications.map((item) => {
            const { relative, exact } = formatTimestamp(item.timestamp);
            return (
              <div
                key={item.id}
                className={`group flex items-start justify-between gap-4 p-4 rounded-xl border transition-all ${
                  item.read
                    ? 'bg-white border-zinc-200 hover:border-zinc-300'
                    : 'bg-zinc-50/70 border-zinc-300/80 shadow-xs hover:border-zinc-400'
                }`}
              >
                {/* Left: Icon & Content */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="mt-0.5">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${getTypeBadgeClass(item.type)}`}>
                        {item.type}
                      </span>
                      <h4 className="font-semibold text-sm text-zinc-900 truncate">
                        {item.message}
                      </h4>
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="Unread" />
                      )}
                    </div>

                    {item.description && (
                      <p className="text-xs text-zinc-600 leading-relaxed break-words">
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 pt-0.5" title={exact}>
                      <Clock size={12} />
                      <span>{relative}</span>
                      <span>•</span>
                      <span>{exact}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                  {!item.read && (
                    <button
                      onClick={() => markAsRead(item.id)}
                      className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition-colors"
                      title="Mark as read"
                    >
                      <Check size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      deleteNotification(item.id);
                    }}
                    className="p-1.5 rounded-md hover:bg-rose-50 text-zinc-400 hover:text-rose-600 transition-colors"
                    title="Delete notification"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-200">
        <span>Capacity: Maximum 100 notifications retained</span>
        <span>FIFO Purge Active</span>
      </div>
    </div>
  );
}
