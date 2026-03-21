import { useState } from 'react';
import { MapPin, Link as LinkIcon } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../components/Dialog';
import { mockConfirmation } from '../mockData';

type DetailRowProps = { label: string; value: string };
function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export default function HomeView() {
  const [eventName, setEventName] = useState('Football Match');
  const [date, setDate] = useState('2026-05-04');
  const [time, setTime] = useState('18:00');
  const [location, setLocation] = useState('Hall of Soccer GmbH, Berlin');
  const [participants, setParticipants] = useState(13);
  const [description, setDescription] = useState(
    'Weekly 5-a-side indoor football match. All skill levels welcome!',
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Create form (2/3) */}
        <div className="col-span-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-5">Create Event</h2>

            <div className="space-y-4">
              {/* Event Name */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Event Name
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Time
                  </label>
                  <select
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
                  >
                    {['08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00', '19:00', '20:00'].map(
                      (t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Location
                </label>
                <div className="relative">
                  <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Participants & Cost */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Participants
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={participants}
                    onChange={(e) => setParticipants(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Cost Budgeting
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                      -1 (unlimited)
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                />
                {/* Assigned person */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-400">Assigned to</span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                    Muhamad Ibrahim
                  </span>
                </div>
              </div>
            </div>

            {/* Setup AI Agent button + Dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <button className="mt-6 w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">
                  setup AI Agent
                </button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmation Dialog</DialogTitle>
                  <DialogDescription>
                    Done. The event is created and the AI agent has finished planning.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-0 divide-y divide-gray-100">
                  <DetailRow label="Venue" value={mockConfirmation.venue} />
                  <DetailRow label="Location" value={mockConfirmation.location} />
                  <DetailRow label="Total Cost" value={mockConfirmation.cost} />
                  <DetailRow label="Per Person" value={mockConfirmation.perPerson} />
                  <DetailRow label="Payment Status" value={mockConfirmation.paymentStatus} />
                  <DetailRow label="Organizer" value={mockConfirmation.organizer} />
                  <DetailRow label="Duration" value={mockConfirmation.duration} />
                  <DetailRow label="Participants" value={String(mockConfirmation.participants)} />
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <button className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      Edit
                    </button>
                  </DialogClose>
                  <DialogClose asChild>
                    <button className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
                      Approve and get sharable link
                    </button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Right: Active request (1/3) */}
        <div className="col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Active request</h2>
              <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                Planning
              </span>
            </div>

            <p className="text-sm text-gray-700 font-medium leading-snug">
              Max request: AI is planning an event with Max (alone)
            </p>
            <p className="text-xs text-gray-400 mt-1">Waiting for participants...</p>

            {/* Progress dots */}
            <div className="mt-4 space-y-2">
              {[
                { label: 'Gathering availability', done: true },
                { label: 'Finding venue options', done: true },
                { label: 'Calculating costs', done: false },
                { label: 'Generating itinerary', done: false },
              ].map((step) => (
                <div key={step.label} className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      step.done ? 'bg-emerald-400' : 'bg-gray-200'
                    }`}
                  />
                  <span className={`text-xs ${step.done ? 'text-gray-600' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2">
              <button className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                RSVP Deadline
              </button>
              <button className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
                <LinkIcon size={12} />
                Copy sharable link
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
