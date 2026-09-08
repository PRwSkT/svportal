import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { News, Album, CalendarEvent } from '@/types';
import { 
  ArrowRight, 
  Calendar, 
  FileText, 
  Image as ImageIcon, 
  Sparkles, 
  BookOpen, 
  Award, 
  Users, 
  FolderDown, 
  ChevronRight 
} from 'lucide-react';

export const revalidate = 60; // ISR cache 60s

export default async function WebsiteHomePage() {
  const supabase = await createClient();

  // Fetch published news
  const { data: newsData } = await supabase
    .from('news')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(3);

  // Fetch albums
  const { data: albumsData } = await supabase
    .from('albums')
    .select('*')
    .order('event_date', { ascending: false })
    .limit(4);

  // Fetch upcoming calendar events
  const today = new Date().toISOString().split('T')[0];
  const { data: eventsData } = await supabase
    .from('calendar_events')
    .select('*')
    .gte('start_date', today)
    .order('start_date', { ascending: true })
    .limit(4);

  const newsList = (newsData || []) as News[];
  const albumsList = (albumsData || []) as Album[];
  const eventsList = (eventsData || []) as CalendarEvent[];

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-32 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-extrabold shadow-sm border border-primary/20 animate-fade-in">
              <Sparkles className="w-4 h-4" />
              ยินดีต้อนรับสู่เว็บไซต์ทางการ
            </div>
            
            <h1 className="text-4xl sm:text-6xl font-black text-foreground tracking-tight leading-tight">
              พัฒนาปัญญา <br className="hidden sm:inline" />
              <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/90 to-primary/70">
                คู่คุณธรรมนำเทคโนโลยี
              </span>
            </h1>

            <p className="text-base sm:text-xl text-foreground/70 font-medium leading-relaxed">
              โรงเรียนสมคิดวิทยา มุ่งเน้นการศึกษาคุณภาพ ส่งเสริมทักษะภาษา เทคโนโลยี และความเป็นเลิศในทุกด้าน
            </p>

            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Link
                href="/website/news"
                className="px-6 py-3.5 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all flex items-center gap-2 hover:-translate-y-0.5 active:scale-95"
              >
                อ่านข่าวสารล่าสุด <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/website/albums"
                className="px-6 py-3.5 bg-surface text-foreground/80 font-bold rounded-2xl hover:bg-foreground/5 border border-foreground/10 transition-all flex items-center gap-2 hover:-translate-y-0.5"
              >
                ชมภาพกิจกรรม <ImageIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Highlight features */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface/80 backdrop-blur-xl p-6 rounded-3xl border border-foreground/5 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-black text-lg mb-2 text-foreground">วิชาการเข้มข้น</h3>
              <p className="text-sm text-foreground/60 leading-relaxed">
                หลักสูตรมาตรฐานสากล บูรณาการวิทยาศาสตร์ คณิตศาสตร์ ภาษาต่างประเทศ และเทคโนโลยีอย่างรอบด้าน
              </p>
            </div>

            <div className="bg-surface/80 backdrop-blur-xl p-6 rounded-3xl border border-foreground/5 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="font-black text-lg mb-2 text-foreground">คุณธรรมและความสุข</h3>
              <p className="text-sm text-foreground/60 leading-relaxed">
                สร้างเสริมวินัย กิริยามารยาท จิตสาธารณะ และสิ่งแวดล้อมที่อบอุ่นปลอดภัยสำหรับนักเรียนทุกคน
              </p>
            </div>

            <div className="bg-surface/80 backdrop-blur-xl p-6 rounded-3xl border border-foreground/5 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-black text-lg mb-2 text-foreground">บุคลากรมืออาชีพ</h3>
              <p className="text-sm text-foreground/60 leading-relaxed">
                คณะครูผู้มีความเชี่ยวชาญ ใส่ใจในการดูแลนักเรียนอย่างใกล้ชิด พัฒนาการเรียนรู้เฉพาะบุคคล
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Latest News Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="inline-flex items-center gap-1 text-primary text-xs font-black uppercase tracking-wider mb-1">
              <FileText className="w-3.5 h-3.5" /> News & Updates
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              ข่าวสารและประชาสัมพันธ์
            </h2>
          </div>
          <Link
            href="/website/news"
            className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
          >
            ดูทั้งหมด <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {newsList.length === 0 ? (
          <div className="bg-surface/60 rounded-3xl p-12 text-center text-foreground/40 border border-foreground/5">
            ยังไม่มีข่าวสารที่เผยแพร่
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                  <div className="text-xs font-bold text-foreground/40 mb-2">
                    {new Date(item.created_at).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <h3 className="font-extrabold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                    {item.title_th}
                  </h3>
                  <p className="text-xs sm:text-sm text-foreground/60 line-clamp-3 mb-4">
                    {item.content_th}
                  </p>
                  <span className="mt-auto text-xs font-extrabold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    อ่านต่อ <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Activity Albums Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="inline-flex items-center gap-1 text-primary text-xs font-black uppercase tracking-wider mb-1">
              <ImageIcon className="w-3.5 h-3.5" /> Gallery & Activities
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              ภาพกิจกรรมล่าสุด
            </h2>
          </div>
          <Link
            href="/website/albums"
            className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
          >
            ดูทั้งหมด <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {albumsList.length === 0 ? (
          <div className="bg-surface/60 rounded-3xl p-12 text-center text-foreground/40 border border-foreground/5">
            ยังไม่มีอัลบั้มภาพกิจกรรม
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {albumsList.map((album) => (
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <span className="text-white text-xs font-bold bg-primary px-3 py-1 rounded-full">
                      เปิดดูภาพ
                    </span>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <span className="text-[11px] font-bold text-foreground/40 mb-1">
                    {new Date(album.event_date).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <h3 className="font-extrabold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {album.title_th}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Events & Documents Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Calendar Box */}
          <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-foreground/5 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-extrabold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                ปฏิทินกิจกรรมเร็วๆ นี้
              </h3>
              <Link href="/website/calendar" className="text-xs font-bold text-primary hover:underline">
                ปฏิทินทั้งหมด
              </Link>
            </div>

            {eventsList.length === 0 ? (
              <div className="py-8 text-center text-foreground/40 text-sm">
                ไม่มีกิจกรรมที่กำลังจะถึงเร็วๆ นี้
              </div>
            ) : (
              <div className="space-y-3">
                {eventsList.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-4 p-3 rounded-2xl bg-foreground/[0.02] hover:bg-foreground/5 transition-colors border border-foreground/5"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs font-extrabold leading-none">
                        {new Date(e.start_date).getDate()}
                      </span>
                      <span className="text-[10px] font-bold text-primary/70 mt-0.5">
                        {new Date(e.start_date).toLocaleDateString('th-TH', { month: 'short' })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{e.title_th}</p>
                      <p className="text-xs text-foreground/50">
                        {e.category === 'academic' ? 'วิชาการ' : e.category === 'activity' ? 'กิจกรรม' : 'ทั่วไป'}
                      </p>
                    </div>
                    {e.is_holiday && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 shrink-0">
                        วันหยุด
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links Card */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-surface rounded-3xl p-6 sm:p-8 border border-primary/20 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center mb-4 shadow-md shadow-primary/20">
                <FolderDown className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-foreground mb-2">
                เอกสารดาวน์โหลด & ทำเนียบบุคลากร
              </h3>
              <p className="text-sm text-foreground/70 leading-relaxed mb-6">
                ดาวน์โหลดแบบฟอร์มคำร้อง ระเบียบการโรงเรียน และค้นหาข้อมูลการติดต่อคณะครูและบุคลากร
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="/website/documents"
                className="p-4 bg-surface rounded-2xl border border-foreground/10 hover:border-primary font-bold text-sm text-foreground hover:text-primary transition-all flex items-center justify-between group shadow-sm"
              >
                <span>ดาวน์โหลดเอกสาร</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/website/personnel"
                className="p-4 bg-surface rounded-2xl border border-foreground/10 hover:border-primary font-bold text-sm text-foreground hover:text-primary transition-all flex items-center justify-between group shadow-sm"
              >
                <span>คณะครูและบุคลากร</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
