import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const hl = formData.get('hl') as string;
    const fbCaption = formData.get('fbCaption') as string;
    
    const supabase = await createClient();

    const files = formData.getAll('files') as File[];
    
    // Concurrent Upload using Promise.all
    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `post/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('website-content')
        .upload(filePath, file);

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
    const uploadedUrls = results.filter((url): url is string => url !== null);

    let albumId = null;

    if (uploadedUrls.length > 0) {
      const { data: album, error: albumError } = await supabase.from('albums').insert({
        title_th: hl,
        title_en: hl,
        title_zh: hl,
        description_th: fbCaption,
        description_en: '',
        description_zh: '',
        cover_image: uploadedUrls[0],
        is_published: true,
        published_at: new Date().toISOString()
      }).select().single();
      
      if (albumError) throw albumError;
      albumId = album.id;

      const photos = uploadedUrls.map((url, index) => ({
        album_id: album.id,
        photo_url: url,
        display_order: index
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
      album_id: albumId
    }).select().single();
    
    if (newsError) throw newsError;

    return NextResponse.json({ success: true, news: newsData });
  } catch (error: any) {
    console.error('Sync post error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
