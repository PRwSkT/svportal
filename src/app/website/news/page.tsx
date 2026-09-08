import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { News } from '@/types';
import { FileText, Calendar, ArrowRight } from 'lucide-react';

export const revalidate = 60;

export default async function WebsiteNewsListPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('news')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  const newsList = (data || []) as News[];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-3">
          ข่าวสารและประกาศ
        </h1>
        <p className="text-foreground/60 text-sm sm:text-base">
          ติดตามข่าวสารกิจกรรม ผลงานนักเรียน และประกาศสำคัญจากโรงเรียนสมคิดวิทยา
        </p>
      </div>

      {newsList.length === 0 ? (
        <div className="bg-surface rounded-3xl p-16 text-center text-foreground/40 border border-foreground/5">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-bold">ยังไม่มีข่าวสารในขณะนี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {newsList.map((item) => (
            <Link
              key={item.id}
              href={`/website/news/${item.id}`}
              className="group bg-surface rounded-3xl border border-foreground/5 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col hover:-translate-y-1"
            >
              <div className="relative aspect-video bg-foreground/5 overflow-hidden">
                {item.cover_image_url ? (
                  <Image
                    src={item.cover_image_url}
                    alt={item.title_th}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-foreground/20">
                    <FileText className="w-12 h-12" />
                  </div>
                )}
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground/40 mb-2">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(item.created_at).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <h2 className="font-extrabold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                  {item.title_th}
                </h2>
                {item.title_en && (
                  <p className="text-xs text-foreground/40 font-medium line-clamp-1 mb-2">
                    {item.title_en}
                  </p>
                )}
                <p className="text-sm text-foreground/60 line-clamp-3 mb-4">
                  {item.content_th}
                </p>
                <span className="mt-auto text-xs font-extrabold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  อ่านรายละเอียด <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
