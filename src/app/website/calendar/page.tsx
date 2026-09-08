import { createClient } from '@/lib/supabase/server';
import { CalendarEvent } from '@/types';
import { Calendar as CalendarIcon, Tag, AlertCircle } from 'lucide-react';

export const revalidate = 60;

export default async function WebsiteCalendarPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .order('start_date', { ascending: true });

  const events = (data || []) as CalendarEvent[];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-3">
          ปฏิทินกิจกรรมโรงเรียน
        </h1>
        <p className="text-foreground/60 text-sm sm:text-base">
          กำหนดการกิจกรรมวิชาการ กิจกรรมพัฒนาผู้เรียน วันสอบ และวันหยุดตลอดปีการศึกษา
        </p>
      </div>

      {events.length === 0 ? (
        <div className="bg-surface rounded-3xl p-16 text-center text-foreground/40 border border-foreground/5">
          <CalendarIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-bold">ยังไม่มีข้อมูลปฏิทินกิจกรรม</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((e) => {
            const startDate = new Date(e.start_date);
            const endDate = e.end_date ? new Date(e.end_date) : null;
            const isUpcoming = startDate >= new Date(new Date().setHours(0, 0, 0, 0));

            return (
              <div
                key={e.id}
                className={`bg-surface p-5 sm:p-6 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  e.is_holiday
                    ? 'border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10'
                    : 'border-foreground/5 hover:border-primary/20 shadow-sm'
                }`}
              >
                <div className="flex items-start sm:items-center gap-4">
                  {/* Date Block */}
                  <div
                    className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 ${
                      e.is_holiday
                        ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    <span className="text-lg font-black leading-none">
                      {startDate.getDate()}
                    </span>
                    <span className="text-[11px] font-bold mt-0.5">
                      {startDate.toLocaleDateString('th-TH', { month: 'short' })}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-extrabold text-foreground">
                        {e.title_th}
                      </h2>
                      {e.is_holiday && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                          วันหยุด
                        </span>
                      )}
                    </div>

                    {e.title_en && (
                      <p className="text-xs text-foreground/50 font-medium">
                        {e.title_en}
                      </p>
                    )}

                    <p className="text-xs text-foreground/60">
                      {startDate.toLocaleDateString('th-TH', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                      {endDate &&
                        ` ถึง ${endDate.toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}`}
                    </p>
                  </div>
                </div>

                {/* Category Badge */}
                <div className="self-end sm:self-center shrink-0">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-foreground/5 text-foreground/70">
                    <Tag className="w-3 h-3" />
                    {e.category === 'academic'
                      ? 'วิชาการ'
                      : e.category === 'activity'
                      ? 'กิจกรรม'
                      : 'ทั่วไป'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
