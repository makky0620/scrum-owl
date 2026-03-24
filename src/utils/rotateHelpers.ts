export function selectParticipants(participants: string[], count: number): string[] {
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
