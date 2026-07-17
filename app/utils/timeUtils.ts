// Time utility functions for consistent time handling across the app

/**
 * Generates an array of time options in 30-minute increments
 * Returns times from 00:00 to 23:30 in HH:MM format
 */
export function generateTimeOptions(): string[] {
  const times: string[] = [];
  
  for (let hour = 0; hour < 24; hour++) {
    const hourStr = hour.toString().padStart(2, '0');
    times.push(`${hourStr}:00`);
    times.push(`${hourStr}:30`);
  }
  
  return times;
}

/**
 * Formats a time string to ensure it's in HH:MM format
 */
export function formatTimeDisplay(time: string): string {
  if (!time) return '';
  
  // If time is already in HH:MM format, return it
  if (/^\d{2}:\d{2}$/.test(time)) {
    return time;
  }
  
  // If time includes seconds (HH:MM:SS), strip them
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    return time.substring(0, 5);
  }
  
  return time;
}

/**
 * Validates if a time string is in valid 30-minute increment
 */
export function isValidTimeIncrement(time: string): boolean {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return false;
  }
  
  const [, minutes] = time.split(':');
  return minutes === '00' || minutes === '30';
}
