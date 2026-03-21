export function eventReadyForGeneration(input: { deadline: Date; pendingInvitees: number; totalInvitees: number }) {
  if (input.totalInvitees === 0) {
    return false;
  }

  // Only generate when the deadline has passed (timer expired or organizer clicked "Generate Now")
  return input.deadline <= new Date();
}
