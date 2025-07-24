export const getRelativeTime = (date: Date | string): string => {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds} seconds ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
};

export const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatDateTime = (date: Date | string): string => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export type FreshnessLevel = 'fresh' | 'recent' | 'moderate' | 'old' | 'stale';

export const getFreshnessLevel = (date: Date | string): FreshnessLevel => {
  const now = new Date();
  const then = new Date(date);
  const hours = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60));
  
  if (hours < 6) return 'fresh';      // Less than 6 hours
  if (hours < 24) return 'recent';    // Less than 1 day
  if (hours < 72) return 'moderate';  // Less than 3 days
  if (hours < 168) return 'old';      // Less than 1 week
  return 'stale';                      // More than 1 week
};

export const freshnessColors: Record<FreshnessLevel, string> = {
  fresh: 'text-green-600 dark:text-green-400',
  recent: 'text-blue-600 dark:text-blue-400',
  moderate: 'text-yellow-600 dark:text-yellow-400',
  old: 'text-orange-600 dark:text-orange-400',
  stale: 'text-red-600 dark:text-red-400'
};

export const freshnessBackgrounds: Record<FreshnessLevel, string> = {
  fresh: '',
  recent: '',
  moderate: '',
  old: '',
  stale: ''
};