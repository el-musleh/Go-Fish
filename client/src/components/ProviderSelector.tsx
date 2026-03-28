import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronDown, Search, Check, X } from 'lucide-react';

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
          style={{ width: 'min(700px, 95%)', maxHeight: '80vh' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Dialog.Title className="gf-card-title" style={{ margin: 0 }}>
              Select AI Provider
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="gf-dialog__close" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-subtle)',
              borderRadius: '8px',
              padding: '10px 14px',
            }}
          >
            <Search size={18} style={{ color: 'var(--text-muted)' }} />
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
                fontSize: '1rem',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              maxHeight: '400px',
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
                  padding: '14px 16px',
                  background:
                    selectedProvider === provider.id ? 'var(--accent)' : 'var(--bg-subtle)',
                  border:
                    selectedProvider === provider.id
                      ? '2px solid var(--accent)'
                      : '2px solid transparent',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: selectedProvider === provider.id ? 'white' : 'var(--text-primary)',
                  fontWeight: 500,
                  transition: 'all 150ms ease',
                }}
              >
                <span>{provider.name}</span>
                {selectedProvider === provider.id && (
                  <Check size={18} style={{ color: 'white', flexShrink: 0 }} />
                )}
              </button>
            ))}
          </div>

          {filteredProviders.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
              No providers found
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
