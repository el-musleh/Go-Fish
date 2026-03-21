import { useState } from 'react';
import { Users, MapPin, Calendar, Navigation, Split, Bot } from 'lucide-react';
import { mockTimelineEvents, type TimelineEvent } from '../mockData';
import { cn } from '../cn';

function groupByDate(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
  return events.reduce<Record<string, TimelineEvent[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = [];
    acc[ev.date].push(ev);
    return acc;
  }, {});
}

type DetailRowProps = { label: string; value: string };
function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export default function TimelineView() {
  const [selected, setSelected] = useState<TimelineEvent>(mockTimelineEvents[0]);
  const grouped = groupByDate(mockTimelineEvents);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid grid-cols-3 gap-6 h-[calc(100vh-9rem)]">
        {/* Left: Timeline list (1/3) */}
        <div className="col-span-1 overflow-y-auto pr-1">
          {Object.entries(grouped).map(([date, events]) => (
            <div key={date} className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">
                {date}
              </p>
              <div className="space-y-2">
                {events.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelected(ev)}
                    className={cn(
                      'w-full text-left bg-white rounded-xl border p-4 transition-all',
                      selected.id === ev.id
                        ? 'border-violet-400 ring-1 ring-violet-300'
                        : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <p className="text-sm font-semibold text-gray-800">{ev.title}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users size={11} />
                        {ev.participants}
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <MapPin size={11} />
                        {ev.location.split(',')[0]}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(ev);
                      }}
                      className="mt-2.5 text-xs text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg font-medium transition-colors"
                    >
                      Find more details
                    </button>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Event detail (2/3) */}
        <div className="col-span-2 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 relative">
            {/* AI Agent control button */}
            <button className="absolute top-5 right-5 flex items-center gap-1.5 text-xs bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
              <Bot size={13} />
              AI Agent control
            </button>

            {/* Header */}
            <div className="mb-5 pr-32">
              <h2 className="text-xl font-bold text-gray-900">
                {selected.title},{' '}
                <span className="font-normal text-gray-500">{selected.participants} members</span>
              </h2>
            </div>

            {/* Details */}
            <div className="mb-5">
              <DetailRow label="Venue / Location" value={selected.location} />
              <DetailRow label="Total Cost" value={selected.cost} />
              <DetailRow label="Per Person" value={selected.perPerson} />
              <DetailRow label="Payment Status" value={selected.paymentStatus} />
              <DetailRow label="Organizer" value={selected.organizer} />
              <DetailRow label="Duration" value={selected.duration} />
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Description
              </label>
              <textarea
                rows={3}
                defaultValue={selected.description}
                key={selected.id}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              <button className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
                RSVP
              </button>
              <button className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors flex items-center gap-1.5">
                <Split size={13} />
                Split Cost
              </button>
              <button className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors flex items-center gap-1.5">
                <Calendar size={13} />
                Add to Calendar
              </button>
              <button className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors flex items-center gap-1.5">
                <Navigation size={13} />
                Map &amp; Navigation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
