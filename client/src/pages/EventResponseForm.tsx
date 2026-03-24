import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError, getCurrentUserId } from '../api/client';
import { toast } from '../components/Toaster';
import LoadingSpinner from '../components/LoadingSpinner';
import { Loader2 } from 'lucide-react';

interface EventData {
  id: string;
  title: string;
  description: string;
  status: string;
  response_window_end: string;
  preferred_date: string | null;
  preferred_time: string | null;
}

const dateAvailabilitySchema = z.object({
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
});

const responseSchema = z.object({
  available_dates: z.array(dateAvailabilitySchema).min(1, 'Please select at least one date.'),
});

type ResponseFormData = z.infer<typeof responseSchema>;

function getNext14Days() {
  const days: { label: string; value: string; day: string; month: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const value = d.toISOString().split('T')[0];
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const day = d.getDate().toString();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const label = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : weekday;
    days.push({ label, value, day, month });
  }
  return days;
}

function slotToTime(slot: number): string {
  const totalMinutes = slot * 30 + 360;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function timeToSlot(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return Math.round((h * 60 + (m || 0) - 360) / 30);
}

const DEFAULT_START_SLOT = 6; // 09:00
const DEFAULT_END_SLOT = 22; // 17:00

export default function EventResponseForm() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [windowClosed, setWindowClosed] = useState(false);
  const dates = useMemo(() => getNext14Days(), []);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResponseFormData>({
    resolver: zodResolver(responseSchema),
    defaultValues: { available_dates: [] },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'available_dates',
    keyName: 'customId',
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const availableDates = watch('available_dates');
  const selectedDateValues = useMemo(
    () => new Set(availableDates.map((d) => d.date)),
    [availableDates]
  );

  useEffect(() => {
    if (!getCurrentUserId()) {
      navigate(`/?auth=1&returnTo=/events/${eventId}/respond`, { replace: true });
      return;
    }
    if (!eventId) return;

    api
      .get<EventData>(`/events/${eventId}`)
      .then((data) => {
        setEvent(data);
        if (new Date(data.response_window_end) <= new Date()) {
          setWindowClosed(true);
        } else if (data.preferred_date) {
          const preferredDate = data.preferred_date.split('T')[0];
          let startSlot = DEFAULT_START_SLOT;
          let endSlot = DEFAULT_END_SLOT;
          if (data.preferred_time) {
            const slot = timeToSlot(data.preferred_time);
            startSlot = Math.max(0, Math.min(slot - 2, 34));
            endSlot = Math.min(36, startSlot + 4);
          }
          append({
            date: preferredDate,
            start_time: slotToTime(startSlot),
            end_time: slotToTime(endSlot),
          });
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401)
          navigate(`/?auth=1&returnTo=/events/${eventId}/respond`, { replace: true });
        else toast.error('Failed to load event details.');
      })
      .finally(() => setLoading(false));
  }, [eventId, navigate, append]);

  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => {
      navigate(`/dashboard?tab=timeline&event=${eventId}`, { replace: true });
    }, 3000);
    return () => clearTimeout(timer);
  }, [submitted, eventId, navigate]);

  const toggleDate = (dateValue: string) => {
    const index = availableDates.findIndex((d) => d.date === dateValue);
    if (index > -1) {
      remove(index);
    } else {
      append({
        date: dateValue,
        start_time: slotToTime(DEFAULT_START_SLOT),
        end_time: slotToTime(DEFAULT_END_SLOT),
      });
    }
  };

  const onSubmit = (data: ResponseFormData) => {
    const promise = api.post(`/events/${eventId}/responses`, data);

    toast.promise(promise, {
      loading: 'Submitting your availability...',
      success: () => {
        setSubmitted(true);
        return "You're in! Your availability has been recorded.";
      },
      error: (err) => {
        if (err instanceof ApiError) {
          if (err.status === 403) {
            const body = err.body as { error?: string };
            if (body?.error === 'benchmark_required') {
              navigate(`/benchmark?returnTo=/events/${eventId}/respond`);
              return 'Please complete your taste benchmark first.';
            }
            setWindowClosed(true);
            return 'The response window has closed.';
          }
          if (err.status === 409) return 'You have already responded to this event.';
        }
        return 'Failed to submit availability.';
      },
    });
  };

  if (loading)
    return (
      <div className="gf-page-center">
        <LoadingSpinner size="lg" label="Loading event..." />
      </div>
    );

  if (windowClosed)
    return (
      <div className="gf-card gf-page-center">
        <h3 className="gf-card-title">Response window closed</h3>
        <p className="gf-muted">The window for this event has closed.</p>
      </div>
    );

  if (submitted)
    return (
      <div className="gf-card gf-page-center">
        <h3 className="gf-card-title">You're in!</h3>
        <p className="gf-muted">
          Your availability has been recorded. Redirecting to your timeline...
        </p>
      </div>
    );

  const sortedSelected = [...fields].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <form className="gf-stack gf-stack--xl" onSubmit={handleSubmit(onSubmit)} noValidate>
      {event && <h2 className="gf-section-title">{event.title}</h2>}
      <h3 className="gf-card-title">When are you free?</h3>
      <div className="gf-date-grid">
        {dates.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => toggleDate(d.value)}
            className={`gf-date-card${selectedDateValues.has(d.value) ? ' gf-date-card--active' : ''}`}
            aria-pressed={selectedDateValues.has(d.value)}
          >
            <span className="gf-date-card__label">{d.label}</span>
            <span className="gf-date-card__day">{d.day}</span>
            <span className="gf-date-card__month">{d.month}</span>
          </button>
        ))}
      </div>

      {sortedSelected.length > 0 && (
        <div className="gf-time-windows">
          <h3 className="gf-card-title">Set your time window</h3>
          {sortedSelected.map((field, index) => {
            const dateInfo = dates.find((d) => d.value === field.date);
            const startSlot = timeToSlot(field.start_time);
            const endSlot = timeToSlot(field.end_time);

            return (
              <div key={field.customId} className="gf-time-window">
                <span className="gf-time-window__label">
                  {dateInfo?.label} {dateInfo?.day} {dateInfo?.month}
                </span>
                <div
                  className="gf-dual-range"
                  style={
                    {
                      '--start-pct': `${(startSlot / 36) * 100}%`,
                      '--end-pct': `${(endSlot / 36) * 100}%`,
                    } as React.CSSProperties
                  }
                >
                  <div className="gf-dual-range__track" />
                  <div className="gf-dual-range__fill" />
                  <Controller
                    name={`available_dates.${index}.start_time`}
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <input
                        type="range"
                        className="gf-dual-range__input"
                        min={0}
                        max={35}
                        value={timeToSlot(value)}
                        onChange={(e) =>
                          onChange(slotToTime(Math.min(Number(e.target.value), endSlot - 1)))
                        }
                      />
                    )}
                  />
                  <Controller
                    name={`available_dates.${index}.end_time`}
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <input
                        type="range"
                        className="gf-dual-range__input"
                        min={1}
                        max={36}
                        value={timeToSlot(value)}
                        onChange={(e) =>
                          onChange(slotToTime(Math.max(Number(e.target.value), startSlot + 1)))
                        }
                      />
                    )}
                  />
                </div>
                <div className="gf-dual-range__labels">
                  <span>{field.start_time}</span>
                  <span>{field.end_time}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {errors.available_dates && (
        <p className="gf-feedback gf-feedback--error">{errors.available_dates.message}</p>
      )}

      <button
        type="submit"
        className="gf-button gf-button--primary"
        disabled={isSubmitting || availableDates.length === 0}
      >
        {isSubmitting ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          `Submit availability (${availableDates.length})`
        )}
      </button>
    </form>
  );
}
