import { useState } from 'react';
import { Settings } from 'lucide-react';
import './prototype.css';
import { cn } from './cn';
import AuthView from './views/AuthView';
import HomeView from './views/HomeView';
import TimelineView from './views/TimelineView';
import MemoriesView from './views/MemoriesView';

type View = 'auth' | 'home' | 'timeline' | 'memories';

const NAV_TABS: { id: Exclude<View, 'auth'>; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'timeline', label: 'Planned / Timeline' },
  { id: 'memories', label: 'Memories' },
];

export default function PrototypePage() {
  const [view, setView] = useState<View>('auth');

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {view !== 'auth' && (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            {/* Logo */}
            <span className="text-lg font-bold text-violet-600 tracking-tight">Go Fish</span>

            {/* Tabs */}
            <nav className="flex items-center gap-1">
              {NAV_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    view === tab.id
                      ? 'bg-violet-600 text-white'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Settings */}
            <button className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <Settings size={18} />
            </button>
          </div>
        </header>
      )}

      <main>
        {view === 'auth' && <AuthView onLogin={() => setView('home')} />}
        {view === 'home' && <HomeView />}
        {view === 'timeline' && <TimelineView />}
        {view === 'memories' && <MemoriesView />}
      </main>
    </div>
  );
}
