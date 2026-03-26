import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../api/client';
import { toast } from '../components/Toaster';
import ValidatedInput from '../components/ValidatedInput';
import StepIndicator from '../components/StepIndicator';

const STEPS = [{ label: 'Create' }, { label: 'Invite' }, { label: 'Pick' }, { label: 'Confirm' }];

// Define the validation schema using zod
const eventSchema = z.object({
  title: z.string().min(3, 'Event title must be at least 3 characters long.'),
  description: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

export default function EventCreationForm() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
  });

  const onSubmit = async (data: EventFormData) => {
    const promise = api.post<{ id: string }>('/events', data);

    toast.promise(promise, {
      loading: 'Creating your event...',
      success: (result) => {
        navigate(`/events/${result.id}/respond`);
        return 'Event created successfully!';
      },
      error: 'Failed to create event. Please try again.',
    });
  };

  return (
    <div className="gf-stack gf-stack--xl">
      <StepIndicator steps={STEPS} currentStep={0} />

      <div className="gf-card">
        <form onSubmit={handleSubmit(onSubmit)} className="gf-form" noValidate>
          <h2 className="gf-card-title">Create a New Event</h2>
          <p className="gf-muted">
            Start by giving your event a name. You'll be able to add more details and invite friends
            in the next step.
          </p>

          <ValidatedInput
            label="Title"
            registration={register('title')}
            error={errors.title}
            placeholder="e.g., Team Lunch, Weekend Hike"
            autoFocus
          />

          <ValidatedInput
            label="Description (Optional)"
            registration={register('description')}
            error={errors.description}
            placeholder="A brief description of the event"
          />

          <div className="gf-actions">
            <button type="submit" className="gf-button gf-button--primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                'Create Event & Continue'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
