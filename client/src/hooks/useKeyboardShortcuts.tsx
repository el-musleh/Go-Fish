/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState, useCallback } from 'react';

export function useKeyboardShortcuts(
  onNewEvent: () => void,
  onFocusSearch: () => void,
  scopes: ('global' | 'dashboard' | 'event')[] = ['global']
) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        setShowHelp(false);
        return;
      }

      if (scopes.includes('global')) {
        if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onNewEvent();
        }
        if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onFocusSearch();
        }
      }
    },
    [onNewEvent, onFocusSearch, scopes]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}

export function KeyboardShortcutsHelp({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: 'C', description: 'Create new event' },
    { key: 'T', description: 'Go to dashboard' },
    { key: 'S', description: 'Focus search bar' },
    { key: '?', description: 'Show this help' },
    { key: 'Esc', description: 'Close dialog' },
  ];

  return (
    <div className="gf-shortcuts-overlay" onClick={onClose}>
      <div className="gf-shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gf-shortcuts-header">
          <h3 className="gf-shortcuts-title">Keyboard Shortcuts</h3>
          <button type="button" className="gf-shortcuts-close" onClick={onClose} aria-label="Close">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="18"
              height="18"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="gf-shortcuts-list">
          {shortcuts.map((s) => (
            <div key={s.key} className="gf-shortcuts-item">
              <kbd className="gf-shortcuts-key">{s.key}</kbd>
              <span className="gf-shortcuts-desc">{s.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const KEYBOARD_SHORTCUTS_INFO = [
  { key: 'C', description: 'Create new event' },
  { key: 'T', description: 'Go to dashboard' },
  { key: 'S', description: 'Focus search bar' },
  { key: '?', description: 'Show keyboard shortcuts' },
];
