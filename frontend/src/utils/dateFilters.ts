import { DurationOption } from '@/components/feeds/DurationFilter';

export function filterByDuration<T extends { published_at?: string; created_at?: string }>(
  items: T[],
  duration: DurationOption
): T[] {
  if (duration === 'all') return items;

  const now = new Date();
  const cutoffTime = new Date(now);

  switch (duration) {
    case '1h':
      cutoffTime.setHours(cutoffTime.getHours() - 1);
      break;
    case '6h':
      cutoffTime.setHours(cutoffTime.getHours() - 6);
      break;
    case '24h':
      cutoffTime.setDate(cutoffTime.getDate() - 1);
      break;
    case '7d':
      cutoffTime.setDate(cutoffTime.getDate() - 7);
      break;
    case '30d':
      cutoffTime.setDate(cutoffTime.getDate() - 30);
      break;
  }

  return items.filter(item => {
    const itemDate = new Date(item.published_at || item.created_at || '');
    return itemDate >= cutoffTime;
  });
}

export function getDurationLabel(duration: DurationOption): string {
  switch (duration) {
    case '1h':
      return 'Last Hour';
    case '6h':
      return 'Last 6 Hours';
    case '24h':
      return 'Last 24 Hours';
    case '7d':
      return 'Last Week';
    case '30d':
      return 'Last Month';
    case 'all':
      return 'All Time';
    default:
      return 'All Time';
  }
}