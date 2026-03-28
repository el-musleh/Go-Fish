import { useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Search, ChevronDown, Loader2, AlertCircle } from 'lucide-react';

// Cache for OpenRouter models - stored in sessionStorage
const MODELS_CACHE_KEY = 'gofish_openrouter_models';
const MODELS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  context_length?: number;
}

interface ModelSelectorProps {
  currentModel: string;
  onSelect: (model: string) => void;
  provider?: string;
}

type RecommendedModel = {
  id: string;
  name: string;
  description: string;
};

// Recommended models by provider
const RECOMMENDED_MODELS_BY_PROVIDER: Record<string, RecommendedModel[]> = {
  google: [
    {
      id: 'google/gemini-2.0-flash-001',
      name: 'Gemini 2.0 Flash',
      description: 'Latest Google model, fast & versatile',
    },
    {
      id: 'google/gemini-1.5-flash-002',
      name: 'Gemini 1.5 Flash',
      description: 'Great context window, fast responses',
    },
    { id: 'google/gemini-pro', name: 'Gemini Pro', description: 'Balanced performance & quality' },
  ],
  anthropic: [
    {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      description: 'Best reasoning & analysis',
    },
    {
      id: 'anthropic/claude-3-opus',
      name: 'Claude 3 Opus',
      description: 'Highest quality, slower',
    },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fast & efficient' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'Fast & cost-effective' },
    {
      id: 'deepseek-reasoner',
      name: 'DeepSeek Reasoner',
      description: 'Advanced reasoning capabilities',
    },
  ],
  openai: [
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & affordable' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'Latest OpenAI model' },
    { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Great all-around model' },
  ],
  cohere: [
    { id: 'cohere/command-r-plus', name: 'Command R+', description: 'Advanced reasoning & tools' },
    { id: 'cohere/command-r', name: 'Command R', description: 'Balanced performance' },
  ],
  meta: [
    {
      id: 'meta-llama/llama-3.1-70b-instruct',
      name: 'Llama 3.1 70B',
      description: 'Open source, high quality',
    },
    {
      id: 'meta-llama/llama-3.1-8b-instruct',
      name: 'Llama 3.1 8B',
      description: 'Fast & efficient',
    },
  ],
  mistralai: [
    {
      id: 'mistralai/mixtral-8x7b-instruct',
      name: 'Mixtral 8x7B',
      description: 'Mixture of experts',
    },
    { id: 'mistralai/mistral-small', name: 'Mistral Small', description: 'Fast & capable' },
  ],
  perplexity: [
    {
      id: 'perplexity/llama-3.1-sonar-small-128k-online',
      name: 'Sonar Small Online',
      description: 'Fast with web search',
    },
    {
      id: 'perplexity/llama-3.1-sonar-large-128k-online',
      name: 'Sonar Large Online',
      description: 'Best with web search',
    },
  ],
};

// Default recommendations when provider doesn't match or is openrouter
const RECOMMENDED_MODELS_DEFAULT: RecommendedModel[] = [
  { id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'Fast & cost-effective' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', description: 'Great performance' },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'High quality reasoning',
  },
];

function getCachedModels(): { models: OpenRouterModel[]; timestamp: number } | null {
  try {
    const cached = sessionStorage.getItem(MODELS_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    // Check if cache is still valid (less than 24 hours old)
    if (Date.now() - parsed.timestamp < MODELS_CACHE_DURATION) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function setCachedModels(models: OpenRouterModel[]): void {
  try {
    sessionStorage.setItem(MODELS_CACHE_KEY, JSON.stringify({ models, timestamp: Date.now() }));
  } catch {
    // Ignore storage errors
  }
}

async function fetchModels(): Promise<OpenRouterModel[]> {
  // Check cache first
  const cached = getCachedModels();
  if (cached) {
    return cached.models;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }

    const data = await response.json();
    const models: OpenRouterModel[] = data.data || [];

    // Cache the results
    setCachedModels(models);

    return models;
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    throw error;
  }
}

export function ModelSelector({ currentModel, onSelect, provider }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [allModels, setAllModels] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter models based on search query and provider
  const filteredModels = useMemo(() => {
    let models = allModels;

    // Filter by provider if selected
    if (provider && provider !== 'openrouter') {
      models = models.filter((m) => {
        const providerPrefix =
          provider === 'anthropic'
            ? 'anthropic'
            : provider === 'google'
              ? 'google'
              : provider === 'deepseek'
                ? 'deepseek'
                : provider === 'openai'
                  ? 'openai'
                  : provider === 'cohere'
                    ? 'cohere'
                    : provider === 'meta'
                      ? 'meta'
                      : provider === 'mistralai'
                        ? 'mistral'
                        : provider === 'perplexity'
                          ? 'perplexity'
                          : null;
        return providerPrefix ? m.id.toLowerCase().startsWith(providerPrefix) : true;
      });
    }

    if (!searchQuery.trim()) return models;
    const query = searchQuery.toLowerCase();
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(query) ||
        m.name?.toLowerCase().includes(query) ||
        m.description?.toLowerCase().includes(query)
    );
  }, [allModels, searchQuery, provider]);

  // Get recommended models based on provider
  const displayRecommended = useMemo(() => {
    const providerKey = provider && provider !== 'openrouter' ? provider : null;
    const recommendations = providerKey
      ? RECOMMENDED_MODELS_BY_PROVIDER[providerKey] || RECOMMENDED_MODELS_DEFAULT
      : RECOMMENDED_MODELS_DEFAULT;

    return recommendations.slice(0, 3).map((rec) => {
      const fullModel = allModels.find((m) => m.id === rec.id);
      return fullModel || rec;
    });
  }, [allModels, provider]);

  const handleOpen = async () => {
    setIsOpen(true);
    if (allModels.length === 0) {
      setLoading(true);
      setError(null);
      try {
        const models = await fetchModels();
        setAllModels(models);
      } catch {
        setError('Failed to load models. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSelect = (modelId: string) => {
    onSelect(modelId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="model-selector">
      {/* Current selection display */}
      <div className="gf-field">
        <label className="gf-field__label">AI Model</label>
        <button
          type="button"
          onClick={handleOpen}
          className="gf-input"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <span>{currentModel || 'Select a model'}</span>
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Modal */}
      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="gf-dialog-overlay" />
          <Dialog.Content
            className="gf-dialog"
            style={{ width: 'min(700px, 95%)', maxHeight: '80vh' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Dialog.Title className="gf-card-title" style={{ margin: 0 }}>
                Select AI Model
              </Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className="gf-dialog__close" aria-label="Close">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>

            {/* Search */}
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
                placeholder="Search models..."
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

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
              {loading && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px',
                    gap: '8px',
                  }}
                >
                  <Loader2 size={20} className="animate-spin" />
                  <span>Loading models...</span>
                </div>
              )}

              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '8px',
                    color: 'var(--color-error)',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {!loading && !error && (
                <>
                  {/* Recommended section */}
                  {!searchQuery && displayRecommended.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          color: 'var(--text-muted)',
                          marginBottom: '8px',
                        }}
                      >
                        Recommended
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {displayRecommended.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => handleSelect(model.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 12px',
                              background:
                                currentModel === model.id ? 'var(--accent)' : 'var(--bg-subtle)',
                              color: currentModel === model.id ? 'white' : 'var(--text-primary)',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>
                                {model.name}
                              </div>
                              {model.description && (
                                <div
                                  style={{
                                    fontSize: '0.8rem',
                                    opacity: 0.8,
                                    marginTop: '2px',
                                  }}
                                >
                                  {model.description}
                                </div>
                              )}
                            </div>
                            {currentModel === model.id && (
                              <div
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: 'white',
                                }}
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All models section */}
                  {filteredModels.length > 0 && (
                    <div>
                      <h4
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          color: 'var(--text-muted)',
                          marginBottom: '8px',
                        }}
                      >
                        {searchQuery ? `Results (${filteredModels.length})` : 'All Models'}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {(searchQuery ? filteredModels : filteredModels.slice(0, 20)).map(
                          (model) => (
                            <button
                              key={model.id}
                              onClick={() => handleSelect(model.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                background:
                                  currentModel === model.id ? 'var(--accent)' : 'var(--bg-subtle)',
                                color: currentModel === model.id ? 'white' : 'var(--text-primary)',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>
                                  {model.id}
                                </div>
                                {model.description && (
                                  <div
                                    style={{
                                      fontSize: '0.8rem',
                                      opacity: 0.8,
                                      marginTop: '2px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      maxWidth: '300px',
                                    }}
                                  >
                                    {model.description}
                                  </div>
                                )}
                              </div>
                              {currentModel === model.id && (
                                <div
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: 'white',
                                  }}
                                />
                              )}
                            </button>
                          )
                        )}
                      </div>
                      {!searchQuery && filteredModels.length > 20 && (
                        <p
                          style={{
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '0.85rem',
                            marginTop: '12px',
                          }}
                        >
                          Search above to see more models
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
