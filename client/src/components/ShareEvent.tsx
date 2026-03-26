import { useState, useEffect, useCallback } from 'react';
import { Share2, Link as LinkIcon, Check } from 'lucide-react';
import { api } from '../api/client';

type ShareTone = 'fun' | 'formal' | 'chill';

interface ShareEventProps {
  eventId: string;
  eventTitle: string;
  eventCity?: string;
  inline?: boolean;
}

function generateShareText(
  tone: ShareTone,
  eventTitle: string,
  eventCity: string | undefined,
  inviteLink: string
): string {
  const location = eventCity ? ` in ${eventCity}` : '';

  switch (tone) {
    case 'fun':
      return `Hey! Let's do this! \uD83C\uDF89 ${eventTitle}${location}

I just planned something awesome and I need YOU there! \uD83D\uDCAA

RSVP here \u{1F517} ${inviteLink}

Don't leave me hanging! \u{1F62D}`;
    case 'formal':
      return `You're invited to: ${eventTitle}

${eventCity ? `Location: ${eventCity}\n` : ''}Please follow the link below to indicate your availability.

RSVP: ${inviteLink}

Thank you for your response.`;
    case 'chill':
      return `${eventTitle}${location}

Figured I'd put something together \u{1F60E} Let me know if you're free!

${inviteLink}`;
  }
}

const SOCIAL_PLATFORMS = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    bgColor: '#25D366',
    getUrl: (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`,
  },
  {
    id: 'imessage',
    name: 'iMessage',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
      </svg>
    ),
    bgColor: '#007AFF',
    getUrl: (text: string) => `sms:?body=${encodeURIComponent(text)}`,
  },
  {
    id: 'twitter',
    name: 'X / Twitter',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    bgColor: '#000000',
    getUrl: (text: string, eventUrl: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(eventUrl)}`,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    bgColor: '#1877F2',
    getUrl: (_text: string, eventUrl: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
    bgColor: '#26A5E4',
    getUrl: (text: string, eventUrl: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(eventUrl)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: 'email',
    name: 'Email',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        width="22"
        height="22"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
    bgColor: '#EA4335',
    getUrl: (text: string, eventUrl: string) =>
      `mailto:?subject=${encodeURIComponent("You're invited!")}&body=${encodeURIComponent(text + '\n\n' + eventUrl)}`,
  },
];

export default function ShareEvent({
  eventId,
  eventTitle,
  eventCity,
  inline = false,
}: ShareEventProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tone, setTone] = useState<ShareTone>('fun');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateLink = useCallback(async () => {
    setGenerating(true);
    try {
      const result = await api.post<{ token: string }>(`/events/${eventId}/link`);
      setInviteLink(`${window.location.origin}/invite/${result.token}`);
    } catch {
      setInviteLink(`${window.location.origin}/invite/${eventId}`);
    } finally {
      setGenerating(false);
    }
  }, [eventId]);

  useEffect(() => {
    if ((inline || isOpen) && !inviteLink && !generating) {
      handleGenerateLink();
    }
  }, [inline, isOpen, inviteLink, generating, handleGenerateLink]);

  async function handleNativeShare() {
    if (!inviteLink) return;
    const text = generateShareText(tone, eventTitle, eventCity, inviteLink);
    if (navigator.share) {
      try {
        await navigator.share({
          title: eventTitle,
          text: text,
          url: inviteLink,
        });
      } catch {
        // User cancelled or share failed
      }
    }
  }

  function handlePlatformShare(platform: (typeof SOCIAL_PLATFORMS)[0]) {
    if (!inviteLink) return;
    const text = generateShareText(tone, eventTitle, eventCity, inviteLink);
    const url = platform.getUrl(text, inviteLink);
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500');
  }

  async function handleCopyMessage() {
    if (!inviteLink) return;
    const text = generateShareText(tone, eventTitle, eventCity, inviteLink);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  const shareText = inviteLink
    ? generateShareText(tone, eventTitle, eventCity, inviteLink)
    : 'Generating invite link...';
  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  if (!inline && !isOpen) {
    return (
      <button
        type="button"
        className="gf-button gf-button--primary"
        onClick={() => setIsOpen(true)}
      >
        <Share2 size={18} />
        Share Invite
      </button>
    );
  }

  const modalContent = (
    <>
      <div className="gf-share-header">
        {inline && <h3 className="gf-share-title">Share Invite</h3>}
        {!inline && (
          <button
            type="button"
            className="gf-share-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="20"
              height="20"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="gf-share-tone">
        <span className="gf-share-tone-label">Tone:</span>
        <div className="gf-share-tone-buttons">
          <button
            type="button"
            className={`gf-share-tone-btn${tone === 'fun' ? ' gf-share-tone-btn--active' : ''}`}
            onClick={() => setTone('fun')}
          >
            <span className="gf-share-tone-icon">&#127881;</span> Fun
          </button>
          <button
            type="button"
            className={`gf-share-tone-btn${tone === 'formal' ? ' gf-share-tone-btn--active' : ''}`}
            onClick={() => setTone('formal')}
          >
            <span className="gf-share-tone-icon">&#128188;</span> Formal
          </button>
          <button
            type="button"
            className={`gf-share-tone-btn${tone === 'chill' ? ' gf-share-tone-btn--active' : ''}`}
            onClick={() => setTone('chill')}
          >
            <span className="gf-share-tone-icon">&#9749;</span> Chill
          </button>
        </div>
      </div>

      <div className="gf-share-preview">
        <label className="gf-share-preview-label">Preview</label>
        <textarea
          className="gf-share-preview-text"
          value={shareText}
          onChange={() => {}}
          readOnly
          rows={6}
        />
      </div>

      <div className="gf-share-platforms">
        {SOCIAL_PLATFORMS.map((platform) => (
          <button
            key={platform.id}
            type="button"
            className="gf-share-platform-btn"
            onClick={() => handlePlatformShare(platform)}
            title={platform.name}
            style={{ '--platform-color': platform.bgColor } as React.CSSProperties}
          >
            {platform.icon}
            <span className="gf-share-platform-name">{platform.name}</span>
          </button>
        ))}
      </div>

      <div className="gf-share-actions">
        {hasNativeShare && (
          <button
            type="button"
            className="gf-button gf-button--primary"
            onClick={handleNativeShare}
          >
            <Share2 size={18} />
            Share via...
          </button>
        )}
        <button
          type="button"
          className="gf-button gf-button--secondary"
          onClick={handleCopyMessage}
          disabled={!inviteLink}
        >
          {copied ? (
            <>
              <Check size={18} /> Copied!
            </>
          ) : (
            <>
              <LinkIcon size={18} /> Copy Message
            </>
          )}
        </button>
      </div>

      {generating && <p className="gf-share-generating">Generating invite link...</p>}
    </>
  );

  if (inline) {
    return <div className="gf-share-inline">{modalContent}</div>;
  }

  return (
    <div className="gf-share-overlay" onClick={() => setIsOpen(false)}>
      <div className="gf-share-modal" onClick={(e) => e.stopPropagation()}>
        {modalContent}
      </div>
    </div>
  );
}
