export const SYSTEM_ADMIN_EMAILS = [
  'admin@somkidvittaya.ac.th',
  'peerawat@somkidvittaya.ac.th',
  'media@somkidvittaya.ac.th',
] as const;

export function isSystemAdmin(email?: string | null): boolean {
  if (!email) return false;
  return SYSTEM_ADMIN_EMAILS.includes(email.trim().toLowerCase() as any);
}
