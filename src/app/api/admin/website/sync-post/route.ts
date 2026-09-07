import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const hl = formData.get('hl') as string;
    const fbCaption = formData.get('fbCaption') as string;
    
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error('Missing Supabase Service Role configuration');
    }

    const supabase = createClient(url, serviceRoleKey);

    const rawFiles = formData.getAll('files') as File[];
    // Filter and validate files: max 10MB and image only
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const files = rawFiles.filter(file => {
      if (!file || typeof file.size !== 'number') return false;
      if (file.size > MAX_FILE_SIZE) return false;
      return file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
    });
    
    // Concurrent Upload using Promise.all
    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${crypto.randomUUID()}.${fileExt.toLowerCase()}`;
      const filePath = `post/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('website-content')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('website-content')
        .getPublicUrl(uploadData.path);
        
      return publicUrl;
    });

    const results = await Promise.all(uploadPromises);
    const uploadedUrls = results.filter((item): item is string => item !== null);

    let albumId: string | null = null;

    if (uploadedUrls.length > 0) {
      const { data: album, error: albumError } = await supabase.from('albums').insert({
        title_th: hl,
        title_en: hl,
        description_th: fbCaption,
        description_en: '',
        cover_image_url: uploadedUrls[0],
        event_date: new Date().toISOString().split('T')[0],
      }).select().single();
      
      if (albumError) throw albumError;
      albumId = album.id;

      const photos = uploadedUrls.map((url, index) => ({
        album_id: album.id,
        image_url: url,
        sort_order: index,
      }));

      const { error: photosError } = await supabase.from('album_photos').insert(photos);
      if (photosError) throw photosError;
    }

    const { data: newsData, error: newsError } = await supabase.from('news').insert({
      title_th: hl,
      title_en: hl,
      content_th: fbCaption,
      content_en: '',
      cover_image_url: uploadedUrls.length > 0 ? uploadedUrls[0] : null,
      is_published: true,
      published_at: new Date().toISOString(),
      album_id: albumId,
    }).select().single();
    
    if (newsError) throw newsError;

    return NextResponse.json({ success: true, news: newsData });
  } catch (error: any) {
    console.error('Sync post error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
