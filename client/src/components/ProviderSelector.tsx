import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronDown, Search, Check } from 'lucide-react';

interface ProviderSelectorProps {
  selectedProvider: string;
  onSelect: (provider: string) => void;
}

const PROVIDERS = [
  { id: 'google', name: 'Google AI', url: 'https://aistudio.google.com/app/apikey' },
  { id: 'anthropic', name: 'Anthropic', url: 'https://console.anthropic.com/settings/keys' },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://platform.deepseek.com/api-keys' },
  { id: 'openai', name: 'OpenAI', url: 'https://platform.openai.com/api-keys' },
  { id: 'cohere', name: 'Cohere', url: 'https://dashboard.cohere.com/api-keys' },
  { id: 'meta', name: 'Meta', url: 'https://developers.meta.com/' },
  { id: 'mistralai', name: 'Mistral AI', url: 'https://console.mistral.ai/api-keys/' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/pro' },
];

export function ProviderSelector({ selectedProvider, onSelect }: ProviderSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedProviderData = PROVIDERS.find((p) => p.id === selectedProvider);

  const filteredProviders = searchQuery.trim()
    ? PROVIDERS.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : PROVIDERS;

  const handleSelect = (providerId: string) => {
    onSelect(providerId);
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="gf-input"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <span>{selectedProviderData?.name || 'Select a provider'}</span>
          <ChevronDown size={16} />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="gf-dialog-overlay" />
        <Dialog.Content
          className="gf-dialog"
          style={{ width: 'min(400px, 100%)', maxHeight: '60vh' }}
        >
          <Dialog.Title className="gf-card-title" style={{ marginBottom: '16px' }}>
            Select AI Provider
          </Dialog.Title>

          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-subtle)',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
            >
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search providers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  flex: 1,
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              maxHeight: '300px',
              overflowY: 'auto',
            }}
          >
            {filteredProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => handleSelect(provider.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background:
                    selectedProvider === provider.id ? 'var(--color-primary)' : 'var(--bg-subtle)',
                  border:
                    selectedProvider === provider.id
                      ? '2px solid var(--color-primary)'
                      : '2px solid transparent',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--text-primary)',
                }}
              >
                <span style={{ fontWeight: 500 }}>{provider.name}</span>
                {selectedProvider === provider.id && (
                  <Check size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                )}
              </button>
            ))}
          </div>

          {filteredProviders.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
              No providers found
            </p>
          )}

          <Dialog.Close asChild>
            <button
              type="button"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
              }}
              aria-label="Close"
            >
              ×
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
