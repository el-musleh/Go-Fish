import { useState } from 'react';
import { api } from '../api/client';

interface Props { eventId: string; }

export default function InvitationLinkPanel({ eventId }: Props) {
  const [link, setLink] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setError('');
    setGenerating(true);
    try {
      const result = await api.post<{ token: string }>(`/events/${eventId}/link`);
      setLink(`${window.location.origin}/invite/${result.token}`);
    } catch { setError('Failed to generate link.'); }
    finally { setGenerating(false); }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setError('Failed to copy.'); }
  }

  return (
    <div className="gf-card">
      <h3 className="gf-card-title" style={{ fontSize: '1.1rem', marginBottom: 12 }}>Invitation Link</h3>
      {error && <p className="gf-feedback gf-feedback--error" style={{ marginBottom: 12 }}>{error}</p>}

      {!link ? (
        <button type="button" onClick={handleGenerate} disabled={generating} className="gf-button gf-button--primary">
          {generating ? 'Generating…' : 'Generate Link'}
        </button>
      ) : (
        <div className="gf-actions">
          <input type="text" readOnly value={link} aria-label="Invitation link" className="gf-input" style={{ flex: 1 }} />
          <button type="button" onClick={handleCopy} className="gf-button gf-button--secondary" style={{ whiteSpace: 'nowrap' }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
