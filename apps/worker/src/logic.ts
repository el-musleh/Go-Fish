export function eventReadyForGeneration(input: { deadline: Date; pendingInvitees: number; totalInvitees: number }) {
  if (input.totalInvitees === 0) {
    return false;
  }

  // Only generate when deadline has passed (timer expired or organizer clicked "Generate options")
  return input.deadline <= new Date();
}
