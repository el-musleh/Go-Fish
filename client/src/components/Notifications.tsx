/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';

export interface Notification {
  id: string;
  title: string;
  description: string;
  time: Date;
  read: boolean;
  link?: string;
}

interface NotificationsProps {
  onMarkRead?: (id: string) => void;
}

export default function Notifications({ onMarkRead }: NotificationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const stored = localStorage.getItem('gofish_notifications');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.map((n: Notification) => ({ ...n, time: new Date(n.time) }));
      } catch {
        return [];
      }
    }
    return [];
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

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

  const handleMarkRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    localStorage.setItem('gofish_notifications', JSON.stringify(updated));
    onMarkRead?.(id);
  };

  const handleClearAll = () => {
    setNotifications([]);
    localStorage.setItem('gofish_notifications', JSON.stringify([]));
  };

  function formatTime(date: Date): string {
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
            {notifications.length > 0 && (
              <button type="button" className="gf-notifications-clear" onClick={handleClearAll}>
                Clear all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="gf-notifications-empty">
              <div className="gf-notifications-empty-icon">
                <Bell size={32} />
              </div>
              <p style={{ margin: 0 }}>No notifications yet</p>
            </div>
          ) : (
            <div className="gf-notifications-list">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`gf-notification-item${!n.read ? ' gf-notification-item--unread' : ''}`}
                  onClick={() => handleMarkRead(n.id)}
                >
                  <p className="gf-notification-title">{n.title}</p>
                  <p className="gf-notification-desc">{n.description}</p>
                  <p className="gf-notification-time">{formatTime(n.time)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function addNotification(notification: Omit<Notification, 'id' | 'time' | 'read'>) {
  const stored = localStorage.getItem('gofish_notifications');
  const current: Notification[] = stored ? JSON.parse(stored) : [];
  const newNotification: Notification = {
    ...notification,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    time: new Date(),
    read: false,
  };
  const updated = [newNotification, ...current].slice(0, 20);
  localStorage.setItem('gofish_notifications', JSON.stringify(updated));
  return newNotification.id;
}
