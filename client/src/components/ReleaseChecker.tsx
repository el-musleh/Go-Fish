import { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw, X } from 'lucide-react';

const GITHUB_REPO = 'el-musleh/Go-Fish';
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

interface ReleaseCheckerProps {
  onDismiss?: () => void;
}

export function ReleaseChecker({ onDismiss }: ReleaseCheckerProps) {
  const [latestRelease, setLatestRelease] = useState<GitHubRelease | null>(null);
  const [, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  const checkForUpdates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: {
          Accept: 'application/vnd.github+json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch releases');
      }
      const data = await response.json();
      setLatestRelease(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setLoading(false);
    }
  };

  // Check on mount
  useEffect(() => {
    checkForUpdates();
  }, []);

  const isNewVersion = latestRelease
    ? latestRelease.tag_name
        .replace('v', '')
        .localeCompare(CURRENT_VERSION, undefined, { numeric: true }) > 0
    : false;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  // Don't show anything if dismissed or no new version
  if (dismissed || !isNewVersion) {
    return null;
  }

  return (
    <div
      style={{
        background: 'rgba(var(--accent-rgb), 0.1)',
        border: '1px solid rgba(var(--accent-rgb), 0.3)',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <ExternalLink
          size={20}
          style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            New version available: {latestRelease?.tag_name}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={() => setShowReleaseNotes(!showReleaseNotes)}
              style={{
                background: 'transparent',
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {showReleaseNotes ? 'Hide' : 'View'} Release Notes
            </button>
            <a
              href={latestRelease?.html_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'var(--accent)',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Download
            </a>
          </div>
          {showReleaseNotes && latestRelease?.body && (
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                background: 'var(--bg-subtle)',
                borderRadius: '6px',
                fontSize: '0.85rem',
                whiteSpace: 'pre-wrap',
                maxHeight: '200px',
                overflow: 'auto',
              }}
            >
              {latestRelease.body}
            </div>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--text-muted)',
            }}
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

// Version display component for Settings page
export function VersionInfo() {
  const [latestRelease, setLatestRelease] = useState<GitHubRelease | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkForUpdates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: {
          Accept: 'application/vnd.github+json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch releases');
      }
      const data = await response.json();
      setLatestRelease(data);
      setLastChecked(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setLoading(false);
    }
  };

  const isNewVersion = latestRelease
    ? latestRelease.tag_name
        .replace('v', '')
        .localeCompare(CURRENT_VERSION, undefined, { numeric: true }) > 0
    : false;

  return (
    <div className="gf-stack gf-stack--sm">
      <div className="gf-detail-row">
        <span className="gf-detail-row__label">Current Version</span>
        <span className="gf-detail-row__value">v{CURRENT_VERSION}</span>
      </div>
      <div className="gf-detail-row">
        <span className="gf-detail-row__label">Latest Release</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {loading ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : latestRelease ? (
            <>
              <span className="gf-detail-row__value">{latestRelease.tag_name}</span>
              {isNewVersion && (
                <span
                  style={{
                    background: 'var(--accent)',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                >
                  NEW
                </span>
              )}
            </>
          ) : (
            <span className="gf-detail-row__value">-</span>
          )}
        </div>
      </div>
      {error && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-error)', margin: 0 }}>{error}</p>
      )}
      <button
        onClick={checkForUpdates}
        disabled={loading}
        className="gf-button gf-button--ghost"
        style={{ alignSelf: 'flex-start', fontSize: '0.85rem' }}
      >
        {loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        <span style={{ marginLeft: '6px' }}>Check for Updates</span>
      </button>
      {lastChecked && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
          Last checked: {lastChecked.toLocaleString()}
        </p>
      )}
    </div>
  );
}

export { CURRENT_VERSION };
