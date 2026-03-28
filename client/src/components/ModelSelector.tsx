import { useState, useMemo } from 'react';
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
}

// Recommended default models to show first
const RECOMMENDED_MODELS = [
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    description: 'Fast & cost-effective for general tasks',
  },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    description: 'Latest Google model, great performance',
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'High quality reasoning & analysis',
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

export function ModelSelector({ currentModel, onSelect }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [allModels, setAllModels] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return allModels;
    const query = searchQuery.toLowerCase();
    return allModels.filter(
      (m) =>
        m.id.toLowerCase().includes(query) ||
        m.name?.toLowerCase().includes(query) ||
        m.description?.toLowerCase().includes(query)
    );
  }, [allModels, searchQuery]);

  // Get recommended models that are in the full list
  const displayRecommended = useMemo(() => {
    return RECOMMENDED_MODELS.map((rec) => {
      const fullModel = allModels.find((m) => m.id === rec.id);
      return fullModel || rec;
    });
  }, [allModels]);

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
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Select AI Model</h3>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
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
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    flex: 1,
                    fontSize: '0.95rem',
                  }}
                />
              </div>
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
                                currentModel === model.id
                                  ? 'var(--color-primary)'
                                  : 'var(--bg-subtle)',
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
                                  currentModel === model.id
                                    ? 'var(--color-primary)'
                                    : 'var(--bg-subtle)',
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
          </div>
        </div>
      )}
    </div>
  );
}
