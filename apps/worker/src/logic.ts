export function eventReadyForGeneration(input: { deadline: Date; pendingInvitees: number; totalInvitees: number }) {
  if (input.totalInvitees === 0) {
    return false;
  }

  return input.pendingInvitees === 0 || input.deadline <= new Date();
}
