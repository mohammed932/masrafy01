/**
 * Principle XXXVII — age is ALWAYS derived from `birthday`, never stored.
 * Returns the number of full years between `birthday` and `now`, or null when
 * birthday is not set (lite/incomplete profiles).
 */
export function deriveAge(birthday: Date | null | undefined, now: Date = new Date()): number | null {
  if (!birthday) return null;
  let age = now.getFullYear() - birthday.getFullYear();
  const monthDelta = now.getMonth() - birthday.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthday.getDate())) {
    age -= 1;
  }
  return age;
}
