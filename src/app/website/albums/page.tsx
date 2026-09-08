import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Album } from '@/types';
import { Image as ImageIcon, Calendar } from 'lucide-react';

export const revalidate = 60;

export default async function WebsiteAlbumsListPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('albums')
    .select('*')
    .order('event_date', { ascending: false });

  const albums = (data || []) as Album[];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-3">
          ภาพกิจกรรมและแกลลอรี่
        </h1>
        <p className="text-foreground/60 text-sm sm:text-base">
          ประมวลภาพบรรยากาศกิจกรรมการเรียนรู้ กิจกรรมพัฒนาผู้เรียน และความประทับใจต่างๆ
        </p>
      </div>

      {albums.length === 0 ? (
        <div className="bg-surface rounded-3xl p-16 text-center text-foreground/40 border border-foreground/5">
          <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-bold">ยังไม่มีอัลบั้มภาพกิจกรรม</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {albums.map((album) => (
            <Link
              key={album.id}
              href={`/website/albums/${album.id}`}
              className="group bg-surface rounded-3xl border border-foreground/5 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col hover:-translate-y-1"
            >
              <div className="relative aspect-video bg-foreground/5 overflow-hidden">
                {album.cover_image_url ? (
                  <Image
                    src={album.cover_image_url}
                    alt={album.title_th}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-foreground/20">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-bold bg-primary px-4 py-1.5 rounded-full shadow-md">
                    ดูภาพทั้งหมด
                  </span>
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground/40 mb-1.5">
                  <Calendar className="w-3 h-3" />
                  {new Date(album.event_date).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <h2 className="font-extrabold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {album.title_th}
                </h2>
                {album.description_th && (
                  <p className="text-xs text-foreground/50 line-clamp-2 mt-1">
                    {album.description_th}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
