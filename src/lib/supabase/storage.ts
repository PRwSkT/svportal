import { createClient } from './client';
import { v4 as uuidv4 } from 'uuid';

export async function uploadWebsiteFile(file: File, folderPath: string): Promise<string> {
  const supabase = createClient();
  const fileExtension = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`;
  const filePath = `${folderPath}/${fileName}`;

  const { data, error } = await supabase
    .storage
    .from('website-content')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw error;
  }

  const { data: { publicUrl } } = supabase
    .storage
    .from('website-content')
    .getPublicUrl(data.path);

  return publicUrl;
}
