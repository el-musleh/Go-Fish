import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Loader2 } from 'lucide-react';
import {
  type Notification,
  getNotifications,
  markNotificationRead,
  deleteNotification,
} from '../api/client';
import { toast } from '../components/Toaster';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmationDialog from '../components/ConfirmationDialog';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null);

  const fetchNotifications = useCallback(async (pageNum: number, append = false) => {
    if (pageNum === 1) setLoading(true);
    try {
      const data = await getNotifications(pageNum, 10);
      setNotifications((prev) => (append ? [...prev, ...data.notifications] : data.notifications));
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await markNotificationRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleDeleteClick = (notification: Notification) => {
    setNotificationToDelete(notification);
    setConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (!notificationToDelete) return;
    setDeletingId(notificationToDelete.id);
    setConfirmDelete(false);
    try {
      await deleteNotification(notificationToDelete.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationToDelete.id));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification');
    } finally {
      setDeletingId(null);
      setNotificationToDelete(null);
    }
  };

  const formatTime = (dateStr: string): string => {
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
  };

  const getNotificationIcon = (type: Notification['type']): string => {
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
  };

  const total = notifications.length;

  return (
    <div className="gf-stack gf-stack--xl" style={{ padding: '20px 0 60px' }}>
      <button type="button" className="gf-back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} />
        Back
      </button>

      <div>
        <h1 className="gf-section-title">Notifications</h1>
        <p className="gf-muted">
          {total === 0 ? 'No notifications' : `${total} notification${total === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="gf-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading && notifications.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <LoadingSpinner size="md" />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <p className="gf-muted">You're all caught up!</p>
          </div>
        ) : (
          <>
            {notifications.map((notification, index) => (
              <div
                key={notification.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '12px',
                  background: notification.read ? 'transparent' : 'rgba(var(--accent-rgb), 0.04)',
                  cursor: notification.expired ? 'default' : 'pointer',
                  transition: 'background 150ms ease',
                  borderBottom: index < notifications.length - 1 ? '1px solid var(--line)' : 'none',
                }}
                onClick={() => !notification.expired && handleNotificationClick(notification)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !notification.expired) {
                    handleNotificationClick(notification);
                  }
                }}
              >
                <div
                  style={{ fontSize: '1.4rem', flexShrink: 0, width: '32px', textAlign: 'center' }}
                >
                  {getNotificationIcon(notification.type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: '0 0 4px',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}
                  >
                    {notification.title}
                  </p>
                  {notification.description && (
                    <p
                      style={{
                        margin: '0 0 4px',
                        fontSize: '0.82rem',
                        color: 'var(--muted)',
                      }}
                    >
                      {notification.description}
                    </p>
                  )}
                  <p
                    style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)', opacity: 0.7 }}
                  >
                    {formatTime(notification.created_at)}
                  </p>
                  {notification.expired && (
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: '0.75rem',
                        color: 'var(--danger)',
                        fontStyle: 'italic',
                      }}
                    >
                      Event no longer exists
                    </p>
                  )}
                </div>
                {!notification.expired && (
                  <button
                    type="button"
                    style={{
                      flexShrink: 0,
                      width: '28px',
                      height: '28px',
                      border: 'none',
                      borderRadius: '6px',
                      background: 'transparent',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                      transition: 'all 150ms ease',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(notification);
                    }}
                    aria-label="Delete notification"
                    disabled={deletingId === notification.id}
                  >
                    {deletingId === notification.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                )}
              </div>
            ))}

            {hasMore && (
              <div
                style={{
                  textAlign: 'center',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <button
                  type="button"
                  className="gf-button gf-button--ghost"
                  onClick={() => {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    fetchNotifications(nextPage, true);
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmationDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Notification"
        description="Are you sure you want to delete this notification? This action cannot be undone."
        confirmText="Delete"
        isDestructive
        isLoading={!!deletingId}
      />
    </div>
  );
}
