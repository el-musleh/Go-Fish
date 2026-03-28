import { useState } from 'react';
import clsx from 'clsx';

// This is a placeholder for the actual event data structure
interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  details: string; // Content for the expanded view
}

const events: TimelineEvent[] = [
  {
    id: '1',
    date: 'Step 1',
    title: 'Gather Availability',
    description: 'Find out when everyone is free.',
    details: 'This is the detailed view for step 1. You can add more content here.',
  },
  {
    id: '2',
    date: 'Step 2',
    title: 'Collect Preferences',
    description: 'What does everyone want to do?',
    details: 'This is the detailed view for step 2. You can add more content here.',
  },
  {
    id: '3',
    date: 'Step 3',
    title: 'AI-Powered Suggestions',
    description: 'Get smart recommendations for activities.',
    details: 'This is the detailed view for step 3. You can add more content here.',
  },
  {
    id: '4',
    date: 'Step 4',
    title: 'Finalize & Confirm',
    description: 'Lock in the plan and send out invites.',
    details: 'This is the detailed view for step 4. You can add more content here.',
  },
];

const EventTimelinePage: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>('1');

  const handleToggle = (id: string) => {
    setExpandedId((prevId) => (prevId === id ? null : id));
  };

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="flex flex-col gap-4">
        {events.map((event) => {
          const isExpanded = expandedId === event.id;
          return (
            <div
              key={event.id}
              className={clsx('gf-timeline-card-wrapper relative transition-all duration-300', {
                'gf-timeline-card-wrapper--expanded': isExpanded,
              })}
            >
              {isExpanded ? (
                <div className="animate-fade-in rounded-lg border border-blue-500 bg-blue-50 p-4 dark:bg-blue-900/20 dark:border-blue-700">
                  <div
                    className="flex cursor-pointer items-center justify-between"
                    onClick={() => handleToggle(event.id)}
                  >
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {event.title}
                      </h3>
                      <p className="font-semibold text-slate-600 dark:text-slate-400">
                        {event.date}
                      </p>
                    </div>
                  </div>
                  <div className="pt-4">
                    <p className="text-gray-700 dark:text-gray-300">{event.details}</p>
                    <button
                      onClick={() => handleToggle(event.id)}
                      className="mt-4 cursor-pointer rounded bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className={clsx(
                    'gf-timeline-card grid w-full cursor-pointer grid-cols-[auto,1fr,auto] items-center gap-6 rounded-lg border bg-card p-4 text-left text-card-foreground transition-all duration-200 ease-in-out hover:bg-muted/50',
                    'md:gap-6'
                  )}
                  onClick={() => handleToggle(event.id)}
                >
                  <span className="font-semibold text-muted-foreground">{event.date}</span>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-semibold">{event.title}</h3>
                    <p className="hidden text-muted-foreground md:block">{event.description}</p>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={clsx('transition-transform duration-200 ease-in-out', {
                      'rotate-90': isExpanded,
                    })}
                    aria-hidden="true"
                  >
                    <path d="m9 18 6-6-6-6"></path>
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EventTimelinePage;
