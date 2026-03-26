import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Loader2, Trash2, ArrowLeft } from 'lucide-react';
import {
  type Notification,
  getNotifications,
  markNotificationRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../api/client';
import { toast } from '../components/Toaster';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmationDialog from '../components/ConfirmationDialog';

/* ── Toggle Component ─────────────────────────────────────── */

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="gf-toggle" style={{ opacity: disabled ? 0.6 : 1 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="gf-toggle__input"
        disabled={disabled}
      />
      <span className="gf-toggle__switch" />
      <span className="gf-toggle__label-group">
        <span className="gf-toggle__label">{label}</span>
        {description && <span className="gf-toggle__description">{description}</span>}
      </span>
    </label>
  );
}

/* ── Main Page ────────────────────────────────────────────── */

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState<NotificationPreferences>({
    email_on_event_confirmed: true,
    email_on_new_rsvp: false,
    email_on_options_ready: false,
  });
  const [savingEmail, setSavingEmail] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null);

  const fetchNotifications = useCallback(async (pageNum: number, append = false) => {
    if (pageNum === 1) setLoading(true);
    try {
      const data = await getNotifications(pageNum, 10);
      setNotifications((prev) => (append ? [...prev, ...data.notifications] : data.notifications));
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmailPreferences = useCallback(async () => {
    try {
      const prefs = await getNotificationPreferences();
      setEmailPrefs(prefs);
    } catch (error) {
      console.error('Failed to fetch email preferences:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1);
    fetchEmailPreferences();
  }, [fetchNotifications, fetchEmailPreferences]);

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
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification');
    } finally {
      setDeletingId(null);
      setNotificationToDelete(null);
    }
  };

  const handleEmailPrefChange = async (key: keyof NotificationPreferences) => {
    const newPrefs = { ...emailPrefs, [key]: !emailPrefs[key] };
    setEmailPrefs(newPrefs);
    setSavingEmail(true);
    try {
      await updateNotificationPreferences({ [key]: newPrefs[key] });
      toast.success('Email preferences updated');
    } catch (error) {
      console.error('Failed to update email preferences:', error);
      setEmailPrefs(emailPrefs); // Revert on error
      toast.error('Failed to update preferences');
    } finally {
      setSavingEmail(false);
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

  return (
    <div className="gf-stack gf-stack--xl" style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="gf-button gf-button--ghost"
          style={{ padding: '8px' }}
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="gf-section-title" style={{ margin: 0 }}>
            Notifications
          </h1>
          <p className="gf-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            {total === 0
              ? 'No notifications yet'
              : `${total} notification${total === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {/* Notification History */}
      <div className="gf-card">
        {loading && notifications.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <LoadingSpinner size="md" />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <Bell size={48} className="gf-muted" style={{ margin: '0 auto 16px' }} />
            <p className="gf-muted">You're all caught up!</p>
          </div>
        ) : (
          <>
            <div className="gf-stack gf-stack--sm">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`gf-settings-notification${!notification.read ? ' gf-settings-notification--unread' : ''}${notification.expired ? ' gf-settings-notification--expired' : ''}`}
                  onClick={() => !notification.expired && handleNotificationClick(notification)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !notification.expired) {
                      handleNotificationClick(notification);
                    }
                  }}
                >
                  <div className="gf-settings-notification__icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="gf-settings-notification__content">
                    <p className="gf-settings-notification__title">{notification.title}</p>
                    {notification.description && (
                      <p className="gf-settings-notification__desc">{notification.description}</p>
                    )}
                    <p className="gf-settings-notification__time">
                      {formatTime(notification.created_at)}
                    </p>
                    {notification.expired && (
                      <p className="gf-settings-notification__expired">Event no longer exists</p>
                    )}
                  </div>
                  {!notification.expired && (
                    <button
                      type="button"
                      className="gf-settings-notification__delete"
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
            </div>

            {hasMore && (
              <div
                style={{
                  marginTop: '16px',
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

      {/* Email Preferences */}
      <section className="gf-stack">
        <h2 className="gf-card-title">Email & Notifications</h2>
        <p className="gf-muted">Control when you receive email updates from Go Fish.</p>

        <div className="gf-card" style={{ marginTop: '12px' }}>
          <div className="gf-stack gf-stack--md">
            <Toggle
              checked={emailPrefs.email_on_event_confirmed}
              onChange={() => !savingEmail && handleEmailPrefChange('email_on_event_confirmed')}
              label="Event is confirmed"
              description="Get notified when an activity is selected (recommended)"
              disabled={savingEmail}
            />
            <Toggle
              checked={emailPrefs.email_on_new_rsvp}
              onChange={() => !savingEmail && handleEmailPrefChange('email_on_new_rsvp')}
              label="New participant RSVPs"
              description="Get notified when someone responds to your event"
              disabled={savingEmail}
            />
            <Toggle
              checked={emailPrefs.email_on_options_ready}
              onChange={() => !savingEmail && handleEmailPrefChange('email_on_options_ready')}
              label="Activity options are ready"
              description="Get notified when AI suggestions are generated"
              disabled={savingEmail}
            />
          </div>
          {savingEmail && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 size={14} className="animate-spin" />
              <span className="gf-muted" style={{ fontSize: '0.85rem' }}>
                Saving...
              </span>
            </div>
          )}
        </div>
      </section>

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
