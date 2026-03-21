import { useState } from 'react';
import { api } from '../api/client';
import { colors, shared } from '../theme';

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
    <div style={{ ...shared.card, marginTop: 16 }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 12px' }}>📎 Invitation Link</h2>
      {error && <div style={shared.errorBox} role="alert">{error}</div>}

      {!link ? (
        <button onClick={handleGenerate} disabled={generating}
          style={{ ...shared.btn, ...(generating ? shared.btnDisabled : {}) }}>
          {generating ? 'Generating…' : 'Generate Link'}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="text" readOnly value={link} aria-label="Invitation link"
            style={{ ...shared.input, flex: 1, backgroundColor: '#F9FAFB', fontSize: '0.85rem' }} />
          <button onClick={handleCopy}
            style={{ ...shared.btnOutline, padding: '10px 16px', whiteSpace: 'nowrap' as const }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
