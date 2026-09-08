'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Album, AlbumPhoto } from '@/types';
import { ArrowLeft, Calendar, Image as ImageIcon, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export default function AlbumPhotosPage() {
  const params = useParams();
  const id = params?.id as string;

  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (!id) return;

    async function loadAlbumAndPhotos() {
      setIsLoading(true);
      const [albumRes, photosRes] = await Promise.all([
        supabase.from('albums').select('*').eq('id', id).single(),
        supabase.from('album_photos').select('*').eq('album_id', id).order('sort_order', { ascending: true })
      ]);

      if (albumRes.data) {
        setAlbum(albumRes.data as Album);
      }
      if (photosRes.data) {
        setPhotos(photosRes.data as AlbumPhoto[]);
      }
      setIsLoading(false);
    }

    loadAlbumAndPhotos();
  }, [id, supabase]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activePhotoIndex === null) return;
      if (e.key === 'Escape') setActivePhotoIndex(null);
      if (e.key === 'ArrowRight') {
        setActivePhotoIndex((prev) => (prev !== null && prev < photos.length - 1 ? prev + 1 : 0));
      }
      if (e.key === 'ArrowLeft') {
        setActivePhotoIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : photos.length - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePhotoIndex, photos.length]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-xl font-bold text-foreground/50">ไม่พบอัลบั้มภาพกิจกรรม</p>
        <Link href="/website/albums" className="mt-4 inline-block text-primary font-bold hover:underline">
          กลับสู่หน้ารวมอัลบั้ม
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/website/albums"
          className="inline-flex items-center gap-2 text-sm font-bold text-foreground/60 hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> กลับสู่หน้ารวมอัลบั้ม
        </Link>
        <div className="flex items-center gap-2 text-xs font-bold text-foreground/40 mb-2">
          <Calendar className="w-4 h-4" />
          {new Date(album.event_date).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
          <span>• {photos.length} รูปภาพ</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight">
          {album.title_th}
        </h1>
        {album.description_th && (
          <p className="mt-2 text-foreground/60 text-sm sm:text-base max-w-3xl">
            {album.description_th}
          </p>
        )}
      </div>

      {/* Photos Grid */}
      {photos.length === 0 ? (
        <div className="bg-surface rounded-3xl p-16 text-center text-foreground/40 border border-foreground/5">
          <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-bold">ยังไม่มีรูปภาพในอัลบั้มนี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => setActivePhotoIndex(index)}
              className="group relative aspect-square bg-foreground/5 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all focus:outline-none focus:ring-4 focus:ring-primary/20"
            >
              <Image
                src={photo.image_url}
                alt={photo.caption_th || `ภาพที่ ${index + 1}`}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-bold bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                  ขยาย
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {activePhotoIndex !== null && photos[activePhotoIndex] && (
        <div 
          onClick={() => setActivePhotoIndex(null)}
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center cursor-default"
          >
            {/* Close button */}
            <button
              onClick={() => setActivePhotoIndex(null)}
              className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
              aria-label="Close lightbox"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Navigation Buttons */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setActivePhotoIndex((prev) =>
                      prev !== null && prev > 0 ? prev - 1 : photos.length - 1
                    )
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70 backdrop-blur-sm transition-all"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() =>
                    setActivePhotoIndex((prev) =>
                      prev !== null && prev < photos.length - 1 ? prev + 1 : 0
                    )
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70 backdrop-blur-sm transition-all"
                  aria-label="Next photo"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Main Image */}
            <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] max-h-[80vh] rounded-2xl overflow-hidden">
              <Image
                src={photos[activePhotoIndex].image_url}
                alt={photos[activePhotoIndex].caption_th || 'ภาพกิจกรรม'}
                fill
                className="object-contain"
                unoptimized
              />
            </div>

            {/* Caption & Counter */}
            <div className="mt-4 text-center text-white/80 text-sm">
              <p className="font-bold">
                {photos[activePhotoIndex].caption_th || `ภาพที่ ${activePhotoIndex + 1} จาก ${photos.length}`}
              </p>
              <p className="text-xs text-white/50 mt-1">
                กดลูกศร ซ้าย-ขวา เพื่อเปลี่ยนรูป หรือกด Esc เพื่อปิด
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
