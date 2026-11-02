/**
 * Get the current academic year in Thai format (e.g., '2568')
 * Academic year usually starts around May.
 */
export function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed (0 = Jan, 4 = May)

  // Convert to Thai Buddhist Era
  let thaiYear = year + 543;

  // If before May, we are technically still in the previous academic year
  // But usually tuition fee collection for the next year starts early.
  // We will assume that if we are in Jan-Apr, the "current" active year could be the old one,
  // but let's stick to a simple rule: if it's before May, we are in the previous academic year.
  if (month < 4) {
    thaiYear -= 1;
  }

  return thaiYear.toString();
}

/**
 * Get current date in Asia/Bangkok timezone (YYYY-MM-DD)
 * Prevents UTC-offset date drift before 07:00 AM local time in Thailand.
 */
export function getBangkokDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Get current time string in Asia/Bangkok timezone (HH:MM)
 */
export function getBangkokTimeString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

