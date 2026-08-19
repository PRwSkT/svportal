'use client';

import { useState, useEffect, useRef, use } from 'react';
import { Album, AlbumPhoto } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { insertRecord, updateRecord, deleteRecord } from '@/app/admin/website/actions';
import { uploadWebsiteFile } from '@/lib/supabase/storage';
import { toast } from 'sonner';
import { ArrowLeft, Upload, Loader2, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function AlbumPhotosManager({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const loadData = async () => {
    setIsLoading(true);
    
    // Load Album details
    const { data: albumData, error: albumError } = await supabase
      .from('albums')
      .select('*')
      .eq('id', id)
      .single();
      
    if (albumError) {
      toast.error('ไม่พบอัลบั้มนี้');
      return;
    }
    setAlbum(albumData as Album);

    // Load Photos
    const { data: photosData, error: photosError } = await supabase
      .from('album_photos')
      .select('*')
      .eq('album_id', id)
      .order('sort_order');
      
    if (photosError) toast.error('ไม่สามารถโหลดรูปภาพได้');
    else setPhotos(photosData as AlbumPhoto[]);
    
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, [id]);

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsUploading(true);
    const files = Array.from(e.target.files);
    let successCount = 0;
    
    const loadingToast = toast.loading(`กำลังอัปโหลด ${files.length} รูปภาพ...`);

    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i];
        const imageUrl = await uploadWebsiteFile(file, `albums/${id}`);
        
        const payload = {
          album_id: id,
          image_url: imageUrl,
          sort_order: photos.length + i,
        };
        
        await insertRecord('album_photos', payload);
        successCount++;
      } catch (err) {
        console.error('Upload error:', err);
      }
    }

    toast.success(`อัปโหลดสำเร็จ ${successCount} จาก ${files.length} รูป`, { id: loadingToast });
    setIsUploading(false);
    
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    loadData();
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm('คุณต้องการลบรูปภาพนี้ใช่หรือไม่?')) return;
    
    const loadingToast = toast.loading('กำลังลบรูปภาพ...');
    try {
      await deleteRecord('album_photos', photoId);
      
      toast.success('ลบรูปภาพสำเร็จ', { id: loadingToast });
      loadData();
    } catch (err: any) {
      toast.error('ไม่สามารถลบได้', { id: loadingToast, description: err.message });
    }
  };

  if (isLoading && !album) {
    return <div className="flex justify-center items-center h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary/40" /></div>;
  }

  if (!album) {
    return <div>ไม่พบอัลบั้ม</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/20">
        <Link href="/admin/website/albums" className="p-2 bg-foreground/5 hover:bg-foreground/10 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground/70" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">{album.title_th}</h1>
          <p className="text-foreground/60 text-sm mt-1">{new Date(album.event_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 text-sm"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} 
          เพิ่มรูปภาพ
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleBulkUpload} 
          accept="image/*" 
          multiple 
          className="hidden" 
        />
      </div>

      <div className="bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/20 min-h-[400px]">
        {photos.length === 0 && !isUploading ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-foreground/40 space-y-4">
            <p className="text-sm font-medium">ยังไม่มีรูปภาพในอัลบั้มนี้</p>
            <button onClick={() => fileInputRef.current?.click()} className="text-primary hover:underline text-sm font-bold">
              คลิกที่นี่เพื่ออัปโหลด
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {photos.map((p, idx) => (
              <div key={p.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-foreground/5 border border-foreground/10">
                <Image src={p.image_url} alt={`Photo ${idx+1}`} fill className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    onClick={() => handleDelete(p.id)}
                    className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors transform translate-y-4 group-hover:translate-y-0"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
