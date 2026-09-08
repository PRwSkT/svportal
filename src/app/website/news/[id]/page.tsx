import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { News } from '@/types';
import { Calendar, ArrowLeft, Share2 } from 'lucide-react';

export const revalidate = 60;

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('news')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    notFound();
  }

  const news = data as News;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/website/news"
          className="inline-flex items-center gap-2 text-sm font-bold text-foreground/60 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> กลับสู่หน้ารวมข่าวสาร
        </Link>
      </div>

      <article className="bg-surface rounded-3xl border border-foreground/5 shadow-sm overflow-hidden">
        {/* Cover Image */}
        {news.cover_image_url && (
          <div className="relative aspect-video w-full bg-foreground/5 overflow-hidden">
            <Image
              src={news.cover_image_url}
              alt={news.title_th}
              fill
              className="object-cover"
              priority
              unoptimized
            />
          </div>
        )}

        <div className="p-6 sm:p-10 space-y-6">
          {/* Header */}
          <div className="space-y-3 border-b border-foreground/5 pb-6">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground/40">
              <Calendar className="w-4 h-4" />
              {new Date(news.created_at).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight leading-tight">
              {news.title_th}
            </h1>

            {news.title_en && (
              <p className="text-lg text-foreground/50 font-medium">
                {news.title_en}
              </p>
            )}
          </div>

          {/* Thai Content */}
          <div className="prose prose-lg max-w-none text-foreground/80 leading-relaxed whitespace-pre-line text-base sm:text-lg">
            {news.content_th}
          </div>

          {/* English Content (if available) */}
          {news.content_en && (
            <div className="border-t border-foreground/5 pt-6 mt-8 space-y-3">
              <h3 className="text-sm font-extrabold text-foreground/50 uppercase tracking-wider">
                English Description
              </h3>
              <div className="prose max-w-none text-foreground/70 leading-relaxed whitespace-pre-line text-sm sm:text-base">
                {news.content_en}
              </div>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
