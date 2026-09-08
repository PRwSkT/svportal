import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Personnel } from '@/types';
import { Users, Mail, Award, BookOpen } from 'lucide-react';

export const revalidate = 60;

export default async function WebsitePersonnelPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('personnel')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const allPersonnel = (data || []) as Personnel[];

  const executives = allPersonnel.filter((p) => p.category === 'executive');
  const teachers = allPersonnel.filter((p) => p.category === 'teacher');
  const staff = allPersonnel.filter((p) => p.category === 'staff' || !['executive', 'teacher'].includes(p.category));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-16">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-3">
          คณะครูและบุคลากรทางการศึกษา
        </h1>
        <p className="text-foreground/60 text-sm sm:text-base">
          ทีมงานบริหารและครูผู้สอนผู้เปี่ยมด้วยความรู้ ประสบการณ์ และความทุ่มเทในการพัฒนาผู้เรียน
        </p>
      </div>

      {allPersonnel.length === 0 ? (
        <div className="bg-surface rounded-3xl p-16 text-center text-foreground/40 border border-foreground/5">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-bold">ยังไม่มีข้อมูลบุคลากร</p>
        </div>
      ) : (
        <>
          {/* Executives Section */}
          {executives.length > 0 && (
            <section className="space-y-8">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-2">
                  <Award className="w-4 h-4" /> Management Team
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-foreground">
                  คณะผู้บริหารโรงเรียน
                </h2>
              </div>

              <div className="flex flex-wrap justify-center gap-8">
                {executives.map((person) => (
                  <div
                    key={person.id}
                    className="w-full sm:w-80 bg-surface rounded-3xl border border-foreground/5 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col items-center text-center p-6 hover:-translate-y-1"
                  >
                    <div className="relative w-40 h-52 rounded-2xl overflow-hidden mb-4 bg-foreground/5 shadow-inner">
                      {person.image_url ? (
                        <Image
                          src={person.image_url}
                          alt={person.name_th}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-foreground/20">
                          <Users className="w-12 h-12" />
                        </div>
                      )}
                    </div>
                    <h3 className="font-extrabold text-lg text-foreground">
                      {person.name_th}
                    </h3>
                    {person.name_en && (
                      <p className="text-xs text-foreground/50 font-medium mt-0.5">
                        {person.name_en}
                      </p>
                    )}
                    <span className="mt-2 text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary">
                      {person.position_th}
                    </span>
                    {person.bio_th && (
                      <p className="text-xs text-foreground/60 mt-3 line-clamp-3">
                        {person.bio_th}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Teachers Section */}
          {teachers.length > 0 && (
            <section className="space-y-8">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-xs font-bold uppercase tracking-wider mb-2">
                  <BookOpen className="w-4 h-4" /> Academic Staff
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-foreground">
                  คณะครูผู้สอน
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {teachers.map((person) => (
                  <div
                    key={person.id}
                    className="bg-surface rounded-3xl border border-foreground/5 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col items-center text-center p-5 hover:-translate-y-1"
                  >
                    <div className="relative w-32 h-44 rounded-2xl overflow-hidden mb-4 bg-foreground/5 shadow-inner">
                      {person.image_url ? (
                        <Image
                          src={person.image_url}
                          alt={person.name_th}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-foreground/20">
                          <Users className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    <h3 className="font-extrabold text-base text-foreground">
                      {person.name_th}
                    </h3>
                    {person.name_en && (
                      <p className="text-xs text-foreground/50 font-medium mt-0.5">
                        {person.name_en}
                      </p>
                    )}
                    <span className="mt-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-foreground/5 text-foreground/70">
                      {person.position_th}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Support Staff Section */}
          {staff.length > 0 && (
            <section className="space-y-8">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-foreground/5 text-foreground/70 text-xs font-bold uppercase tracking-wider mb-2">
                  <Users className="w-4 h-4" /> Support Staff
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-foreground">
                  บุคลากรทางการศึกษา
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {staff.map((person) => (
                  <div
                    key={person.id}
                    className="bg-surface rounded-3xl border border-foreground/5 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col items-center text-center p-5 hover:-translate-y-1"
                  >
                    <div className="relative w-32 h-44 rounded-2xl overflow-hidden mb-4 bg-foreground/5 shadow-inner">
                      {person.image_url ? (
                        <Image
                          src={person.image_url}
                          alt={person.name_th}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-foreground/20">
                          <Users className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    <h3 className="font-extrabold text-base text-foreground">
                      {person.name_th}
                    </h3>
                    <span className="mt-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-foreground/5 text-foreground/70">
                      {person.position_th}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
