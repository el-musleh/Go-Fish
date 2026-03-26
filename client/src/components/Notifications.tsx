import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import {
  type Notification,
  getRecentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getCurrentUserId,
} from '../api/client';

export default function Notifications() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!getCurrentUserId()) return;

    setLoading(true);
    try {
      const data = await getRecentNotifications(5);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      try {
        await markNotificationRead(notification.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Navigate to the notification link
    if (notification.link) {
      setIsOpen(false);
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleShowAll = () => {
    setIsOpen(false);
    navigate('/settings?tab=notifications');
  };

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  function getNotificationIcon(type: Notification['type']): string {
    switch (type) {
      case 'rsvp_received':
        return '👥';
      case 'event_finalized':
        return '✅';
      case 'event_invited':
        return '📬';
      case 'options_ready':
        return '✨';
      default:
        return '🔔';
    }
  }

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        type="button"
        className="gf-notifications-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="gf-notifications-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="gf-notifications-dropdown">
          <div className="gf-notifications-header">
            <span className="gf-notifications-title">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="gf-notifications-clear" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          {loading && notifications.length === 0 ? (
            <div className="gf-notifications-loading">
              <span className="gf-muted">Loading...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="gf-notifications-empty">
              <div className="gf-notifications-empty-icon">
                <Bell size={32} />
              </div>
              <p style={{ margin: 0 }}>No notifications yet</p>
            </div>
          ) : (
            <>
              <div className="gf-notifications-list">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`gf-notification-item${!n.read ? ' gf-notification-item--unread' : ''}${n.expired ? ' gf-notification-item--expired' : ''}`}
                    onClick={() => !n.expired && handleNotificationClick(n)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (!n.expired) handleNotificationClick(n);
                      }
                    }}
                  >
                    <div className="gf-notification-item__icon">{getNotificationIcon(n.type)}</div>
                    <div className="gf-notification-item__content">
                      <p className="gf-notification-title">{n.title}</p>
                      {n.description && <p className="gf-notification-desc">{n.description}</p>}
                      <p className="gf-notification-time">{formatTime(n.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && (
                <div className="gf-notifications-footer">
                  <button
                    type="button"
                    className="gf-notifications-show-all"
                    onClick={handleShowAll}
                  >
                    Show all notifications
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
