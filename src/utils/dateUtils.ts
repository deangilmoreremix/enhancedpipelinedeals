/**
 * Date and time utility functions for deal calculations
 */

/**
 * Calculate the number of days between two dates
 * Returns absolute difference, always positive
 */
export const daysBetween = (startDate: Date | string, endDate: Date | string = new Date()): number => {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Calculate days since a given date
 */
export const daysSince = (date: Date | string): number => {
  return daysBetween(date, new Date());
};

/**
 * Calculate days until a given date
 */
export const daysUntil = (date: Date | string): number => {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  
  if (targetDate < today) {
    return 0; // Already passed
  }
  
  return daysBetween(today, targetDate);
};

/**
 * Format a date relative to now (e.g., "2 days ago", "in 3 days")
 * Normalizes to start of day to avoid timezone issues
 */
export const formatRelativeDate = (date: Date | string): string => {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  
  // Normalize both dates to start of day
  const targetDayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const days = Math.round((targetDayStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
};

/**
 * Check if a date is within a certain number of days from now
 */
export const isWithinDays = (date: Date | string, days: number): boolean => {
  return daysSince(date) <= days;
};

/**
 * Check if a deal is stale (no activity for more than specified days)
 */
export const isDealStale = (lastActivityDate: Date | string, staleDays: number = 7): boolean => {
  return daysSince(lastActivityDate) > staleDays;
};
