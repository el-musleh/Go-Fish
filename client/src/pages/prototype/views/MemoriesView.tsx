import { useState } from 'react';
import { Search, Pencil, Save } from 'lucide-react';
import { mockCategories, mockItems, mockMemoryContent, type MemoryContent } from '../mockData';
import { cn } from '../cn';

const DEFAULT_CONTENT: MemoryContent = {
  season: '—',
  setting: 'Both',
  checklist: [],
  essentials: '—',
  feedback: '',
};

export default function MemoriesView() {
  const [categorySearch, setCategorySearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Activities');
  const [selectedItem, setSelectedItem] = useState('Football');
  const [editing, setEditing] = useState(false);

  const filteredCategories = mockCategories.filter((c) =>
    c.toLowerCase().includes(categorySearch.toLowerCase()),
  );

  const items = mockItems[selectedCategory] ?? [];
  const filteredItems = items.filter((i) =>
    i.toLowerCase().includes(itemSearch.toLowerCase()),
  );

  const content: MemoryContent = mockMemoryContent[selectedItem] ?? DEFAULT_CONTENT;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid grid-cols-4 gap-0 bg-white rounded-2xl border border-gray-200 overflow-hidden h-[calc(100vh-9rem)]">
        {/* Pane 1: Categories (1/4) */}
        <div className="border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search categories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {filteredCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  const first = mockItems[cat]?.[0];
                  if (first) setSelectedItem(first);
                }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5',
                  selectedCategory === cat
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Pane 2: Items (1/4) */}
        <div className="border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {filteredItems.map((item) => (
              <button
                key={item}
                onClick={() => setSelectedItem(item)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5',
                  selectedItem === item
                    ? 'bg-emerald-50 text-emerald-700'
                    : item === 'Mini-golf'
                      ? 'border border-violet-300 text-violet-600 hover:bg-violet-50'
                      : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Pane 3: Content Editor (2/4) */}
        <div className="col-span-2 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
            <h2 className="text-base font-bold text-gray-900">{selectedItem}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing((e) => !e)}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  editing
                    ? 'bg-violet-100 text-violet-600'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
                )}
              >
                <Pencil size={15} />
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors">
                <Save size={13} />
                Save
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Season */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Season</p>
              {editing ? (
                <input
                  defaultValue={content.season}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              ) : (
                <p className="text-sm text-gray-700">{content.season}</p>
              )}
            </div>

            {/* Indoor/Outdoor */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Indoor / Outdoor
              </p>
              {editing ? (
                <select
                  defaultValue={content.setting}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option>Indoor</option>
                  <option>Outdoor</option>
                  <option>Both</option>
                </select>
              ) : (
                <span className="inline-block text-xs bg-sky-50 text-sky-600 border border-sky-200 px-2.5 py-1 rounded-full font-medium">
                  {content.setting}
                </span>
              )}
            </div>

            {/* Checklist */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Checklist
              </p>
              {content.checklist.length > 0 ? (
                <ul className="space-y-1.5">
                  {content.checklist.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-violet-600 flex-shrink-0"
                        readOnly
                      />
                      <span className="text-sm text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 italic">No checklist items yet.</p>
              )}
            </div>

            {/* Essentials */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Essentials
              </p>
              {editing ? (
                <textarea
                  rows={2}
                  defaultValue={content.essentials}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              ) : (
                <p className="text-sm text-gray-700">{content.essentials}</p>
              )}
            </div>

            {/* Feedback */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Feedback
              </p>
              <textarea
                rows={4}
                defaultValue={content.feedback}
                key={selectedItem}
                placeholder="Add feedback from past events..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none placeholder-gray-300"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
