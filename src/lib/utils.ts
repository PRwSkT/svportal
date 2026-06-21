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
