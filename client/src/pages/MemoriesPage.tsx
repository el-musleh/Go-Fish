import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Pencil, Save } from 'lucide-react';
import { getCurrentUserId } from '../api/client';
import { mockCategories, mockItems, mockMemoryContent, type MemoryContent } from './prototype/mockData';

const DEFAULT_CONTENT: MemoryContent = {
  season: '',
  setting: 'Both',
  checklist: [],
  essentials: '',
  feedback: '',
};

function storageKey(userId: string) {
  return `gofish_memories_${userId}`;
}

function loadMemories(userId: string): Record<string, MemoryContent> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) return { ...mockMemoryContent, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...mockMemoryContent };
}

function saveMemories(userId: string, data: Record<string, MemoryContent>) {
  localStorage.setItem(storageKey(userId), JSON.stringify(data));
}

export default function MemoriesPage() {
  const navigate = useNavigate();
  const userId = getCurrentUserId();

  const [memories, setMemories] = useState<Record<string, MemoryContent>>({});
  const [categorySearch, setCategorySearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Activities');
  const [selectedItem, setSelectedItem] = useState('Football');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  // Edit-mode controlled state
  const [editSeason, setEditSeason] = useState('');
  const [editSetting, setEditSetting] = useState<MemoryContent['setting']>('Both');
  const [editEssentials, setEditEssentials] = useState('');
  const [editFeedback, setEditFeedback] = useState('');

  useEffect(() => {
    if (!userId) {
      navigate('/login?returnTo=/memories', { replace: true });
      return;
    }
    setMemories(loadMemories(userId));
  }, [userId, navigate]);

  const content: MemoryContent = memories[selectedItem] ?? DEFAULT_CONTENT;

  function enterEdit() {
    setEditSeason(content.season);
    setEditSetting(content.setting);
    setEditEssentials(content.essentials);
    setEditFeedback(content.feedback);
    setEditing(true);
  }

  function handleSave() {
    if (!userId) return;
    const updated: MemoryContent = {
      ...content,
      season: editSeason,
      setting: editSetting,
      essentials: editEssentials,
      feedback: editFeedback,
    };
    const next = { ...memories, [selectedItem]: updated };
    setMemories(next);
    saveMemories(userId, next);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const filteredCategories = mockCategories.filter(c =>
    c.toLowerCase().includes(categorySearch.toLowerCase()),
  );
  const items = mockItems[selectedCategory] ?? [];
  const filteredItems = items.filter(i =>
    i.toLowerCase().includes(itemSearch.toLowerCase()),
  );

  if (!userId) return null;

  return (
    <div className="gf-stack gf-stack--xl">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 className="gf-section-title">Memories</h2>
        {saved && <p className="gf-feedback gf-feedback--success">✓ Saved</p>}
      </div>

      <div className="gf-panel-layout">
        {/* Pane 1: Categories */}
        <div className="gf-panel">
          <div className="gf-panel__search">
            <Search size={13} className="gf-panel__search-icon" />
            <input
              type="text"
              placeholder="Search categories..."
              value={categorySearch}
              onChange={e => setCategorySearch(e.target.value)}
            />
          </div>
          <div className="gf-panel__list">
            {filteredCategories.map(cat => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setEditing(false);
                  const first = mockItems[cat]?.[0];
                  if (first) setSelectedItem(first);
                }}
                className={`gf-panel-item${selectedCategory === cat ? ' gf-panel-item--active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Pane 2: Items */}
        <div className="gf-panel">
          <div className="gf-panel__search">
            <Search size={13} className="gf-panel__search-icon" />
            <input
              type="text"
              placeholder="Search items..."
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
            />
          </div>
          <div className="gf-panel__list">
            {filteredItems.map(item => (
              <button
                key={item}
                onClick={() => { setSelectedItem(item); setEditing(false); }}
                className={`gf-panel-item${
                  selectedItem === item
                    ? ' gf-panel-item--active'
                    : item === 'Mini-golf'
                      ? ' gf-panel-item--suggested'
                      : ''
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Pane 3: Content editor */}
        <div className="gf-panel-content">
          <div className="gf-panel-content__header">
            <h3 className="gf-card-title" style={{ fontSize: '1.3rem' }}>{selectedItem}</h3>
            <div className="gf-actions" style={{ gap: '8px' }}>
              {!editing && (
                <button
                  onClick={enterEdit}
                  className="gf-button gf-button--ghost"
                  style={{ minHeight: '36px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Pencil size={15} /> Edit
                </button>
              )}
              {editing && (
                <button
                  onClick={handleSave}
                  className="gf-button gf-button--primary"
                  style={{ minHeight: '36px', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={13} /> Save
                </button>
              )}
            </div>
          </div>

          <div className="gf-panel-content__body">
            {/* Season */}
            <div>
              <span className="gf-label">Season</span>
              {editing ? (
                <input
                  className="gf-input"
                  value={editSeason}
                  onChange={e => setEditSeason(e.target.value)}
                  style={{ padding: '8px 14px' }}
                />
              ) : (
                <p style={{ margin: 0, fontSize: '0.9rem', color: content.season ? 'var(--text)' : 'var(--muted)' }}>
                  {content.season || '—'}
                </p>
              )}
            </div>

            {/* Indoor / Outdoor */}
            <div>
              <span className="gf-label">Indoor / Outdoor</span>
              {editing ? (
                <select
                  className="gf-input"
                  value={editSetting}
                  onChange={e => setEditSetting(e.target.value as MemoryContent['setting'])}
                  style={{ padding: '8px 14px', cursor: 'pointer' }}
                >
                  <option>Indoor</option>
                  <option>Outdoor</option>
                  <option>Both</option>
                </select>
              ) : (
                <span className="gf-setting-badge">{content.setting}</span>
              )}
            </div>

            {/* Checklist */}
            <div>
              <span className="gf-label">Checklist</span>
              {content.checklist.length > 0 ? (
                <ul className="gf-checklist">
                  {content.checklist.map(item => (
                    <li key={item}>
                      <input type="checkbox" readOnly />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                  No checklist items yet.
                </p>
              )}
            </div>

            {/* Essentials */}
            <div>
              <span className="gf-label">Essentials</span>
              {editing ? (
                <textarea
                  rows={2}
                  className="gf-input"
                  value={editEssentials}
                  onChange={e => setEditEssentials(e.target.value)}
                  style={{ resize: 'none' }}
                />
              ) : (
                <p style={{ margin: 0, fontSize: '0.9rem', color: content.essentials ? 'var(--text)' : 'var(--muted)' }}>
                  {content.essentials || '—'}
                </p>
              )}
            </div>

            {/* Feedback */}
            <div>
              <span className="gf-label">Feedback</span>
              <textarea
                rows={4}
                key={`${selectedItem}-feedback`}
                placeholder="Add feedback from past events..."
                className="gf-input"
                value={editing ? editFeedback : content.feedback}
                onChange={e => editing && setEditFeedback(e.target.value)}
                readOnly={!editing}
                style={{ resize: 'none', opacity: !editing && !content.feedback ? 0.5 : 1 }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
