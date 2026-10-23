export function dailyEntryRoute({ date, entry, skippedDate }) {
  const confirmed = entry?.entry_date === date && entry?.check_in?.journeyVersion === 1 && Boolean(entry?.check_in?.confirmedAt);
  return confirmed || skippedDate === date ? '/your-day' : '/daily-check-in';
}
