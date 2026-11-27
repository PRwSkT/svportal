/**
 * Netlify Scheduled Function: Attendance Check-In & Check-Out Reminders
 * Fires Mon-Fri at 07:00, 07:20, 17:00, and 17:20 Asia/Bangkok (UTC+7):
 *   00:00 UTC = 07:00 BKK (check_in_30)
 *   00:20 UTC = 07:20 BKK (check_in_10)
 *   10:00 UTC = 17:00 BKK (check_out_0)
 *   10:20 UTC = 17:20 BKK (check_out_20)
 */
export const config = {
  schedule: '0,20 0,10 * * 1-5',
};

function getBangkokSlot(now: Date): string | null {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hh = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const mm = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const mins = (hh === 24 ? 0 : hh) * 60 + mm;

  const slots: Array<[string, number]> = [
    ['check_in_30', 7 * 60],
    ['check_in_10', 7 * 60 + 20],
    ['check_out_0', 17 * 60],
    ['check_out_20', 17 * 60 + 20],
  ];

  for (const [name, target] of slots) {
    if (Math.abs(mins - target) <= 8) return name;
  }
  return null;
}

export default async function handler() {
  const slot = getBangkokSlot(new Date());
  if (!slot) {
    console.log('[attendance-reminders] Outside slot window, skipping.');
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const baseUrl = process.env.URL || 'https://sv-portal.somkidvittaya.ac.th';
  const cronSecret = process.env.CRON_SECRET || '';

  const res = await fetch(`${baseUrl}/api/cron/attendance-reminders?slot=${slot}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });

  const text = await res.text();
  console.log(`[attendance-reminders] slot=${slot} status=${res.status} body=${text}`);
  return new Response(text, { status: res.status });
}
