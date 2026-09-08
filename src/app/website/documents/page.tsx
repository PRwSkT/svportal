import { createClient } from '@/lib/supabase/server';
import { Document as DocType } from '@/types';
import { FileText, Download, FolderDown, FileSpreadsheet, FileCode } from 'lucide-react';

export const revalidate = 60;

function formatBytes(bytes: number | null): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default async function WebsiteDocumentsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  const documents = (data || []) as DocType[];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-3">
          ดาวน์โหลดเอกสารและแบบฟอร์ม
        </h1>
        <p className="text-foreground/60 text-sm sm:text-base">
          แบบฟอร์มคำร้อง ระเบียบปฏิบัติ และเอกสารประชาสัมพันธ์ต่างๆ สำหรับผู้ปกครองและนักเรียน
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="bg-surface rounded-3xl p-16 text-center text-foreground/40 border border-foreground/5">
          <FolderDown className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-bold">ยังไม่มีเอกสารให้ดาวน์โหลด</p>
        </div>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-surface p-5 sm:p-6 rounded-3xl border border-foreground/5 shadow-sm hover:border-primary/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg font-extrabold text-foreground">
                    {doc.title_th}
                  </h2>
                  {doc.title_en && (
                    <p className="text-xs text-foreground/50 font-medium">
                      {doc.title_en}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-foreground/50">
                    <span className="font-bold uppercase bg-foreground/5 px-2 py-0.5 rounded">
                      {doc.file_type}
                    </span>
                    <span>{formatBytes(doc.file_size_bytes)}</span>
                    <span>•</span>
                    <span>
                      {doc.category === 'form'
                        ? 'แบบฟอร์ม'
                        : doc.category === 'policy'
                        ? 'ระเบียบการ'
                        : 'เอกสารทั่วไป'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="self-end sm:self-center shrink-0">
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="px-5 py-2.5 bg-primary text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-primary/90 shadow-md shadow-primary/20 transition-all flex items-center gap-2 active:scale-95"
                >
                  <Download className="w-4 h-4" /> ดาวน์โหลด
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
