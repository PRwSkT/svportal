'use client';

import { useState, useRef } from 'react';
import { importFeeItemsFromCSV } from '@/lib/supabase/fees';

type CSVRow = {
  student_id: string;
  fee_type_id: string;
  amount: number;
  isValid: boolean;
};

export default function ImportFeesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('กรุณาเลือกไฟล์ .csv เท่านั้น');
      setFile(null);
      setRows([]);
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.onerror = () => {
      setError('ไม่สามารถอ่านไฟล์ได้');
    };
    reader.readAsText(selectedFile);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Assume first line might be header if it contains non-numeric student_id
    let startIndex = 0;
    if (lines.length > 0) {
      const firstLineParts = lines[0].split(',');
      if (firstLineParts.length >= 3 && isNaN(Number(firstLineParts[0]))) {
        startIndex = 1; // Skip header
      }
    }

    const parsedRows: CSVRow[] = [];
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (parts.length < 3) continue;

      const student_id = parts[0];
      const fee_type_id = parts[1];
      const amount = parseFloat(parts[2]);

      const isValidStudentId = /^[0-9]{4,5}$/.test(student_id);
      const isValidAmount = !isNaN(amount) && amount > 0;
      const isValidFeeTypeId = fee_type_id.length > 0; // Basic check

      parsedRows.push({
        student_id,
        fee_type_id,
        amount,
        isValid: isValidStudentId && isValidAmount && isValidFeeTypeId
      });
    }

    setRows(parsedRows);
  };

  const handleImport = async () => {
    const validRows = rows.filter(r => r.isValid);
    if (validRows.length === 0) {
      setError('ไม่มีข้อมูลที่ถูกต้องให้ทำการนำเข้า');
      return;
    }

    setIsImporting(true);
    setError(null);
    setProgress(0);

    try {
      // The DAL handles chunking, but we want to show a progress bar
      // We can modify the DAL or chunk it here to update the progress state.
      // Since the prompt asks for a progress bar during import, let's chunk here
      // and call a single-insert or we rewrite the DAL logic here to update UI.
      // We will just do it here to have access to setProgress.
      
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      const { data: existing, error: fetchErr } = await supabase
        .from('fee_items')
        .select('student_id, fee_type_id');
        
      if (fetchErr) throw fetchErr;
        
      const existingSet = new Set(existing?.map((e: any) => `${e.student_id}_${e.fee_type_id}`));
      
      const toInsert = validRows
        .filter(r => !existingSet.has(`${r.student_id}_${r.fee_type_id}`))
        .map(({ student_id, fee_type_id, amount }) => ({ student_id, fee_type_id, amount }));
      
      let insertedCount = 0;
      const chunkSize = 50;
      
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error: insertErr } = await supabase.from('fee_items').insert(chunk);
        if (insertErr) throw insertErr;
        
        insertedCount += chunk.length;
        setProgress(Math.round(((i + chunk.length) / toInsert.length) * 100));
      }

      setResult({
        inserted: insertedCount,
        skipped: validRows.length - insertedCount
      });
      setRows([]);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Import Error:', err);
      setError(`เกิดข้อผิดพลาดในการนำเข้าข้อมูล: ${err.message || JSON.stringify(err)}`);
    } finally {
      setIsImporting(false);
      setProgress(100);
    }
  };

  const invalidCount = rows.filter(r => !r.isValid).length;
  const validCount = rows.filter(r => r.isValid).length;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">นำเข้าข้อมูลค่าธรรมเนียม (CSV Import)</h1>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <label className="block mb-2 font-medium text-gray-700">เลือกไฟล์ CSV</label>
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={isImporting}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          รูปแบบที่รองรับ: <code className="bg-gray-100 px-1 py-0.5 rounded">student_id,fee_type_id,amount</code>
        </p>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="bg-green-50 p-6 rounded-lg shadow-sm border border-green-200 mb-6">
          <h3 className="text-lg font-medium text-green-800 mb-2">นำเข้าสำเร็จ</h3>
          <p className="text-green-700">นำเข้าสำเร็จ {result.inserted} รายการ, ข้ามไป {result.skipped} รายการ (ซ้ำ)</p>
        </div>
      )}

      {rows.length > 0 && !result && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-800">ตัวอย่างข้อมูล (20 รายการแรก)</h2>
            <div className="text-sm text-gray-600">
              พบทั้งหมด {rows.length} รายการ (พร้อมนำเข้า {validCount}, ไม่ถูกต้อง {invalidCount})
            </div>
          </div>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-6 py-3">รหัสนักเรียน</th>
                  <th className="px-6 py-3">Fee Type ID</th>
                  <th className="px-6 py-3">ยอดเงิน (บาท)</th>
                  <th className="px-6 py-3">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((row, idx) => (
                  <tr key={idx} className="bg-white border-b">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.student_id}</td>
                    <td className="px-6 py-4 font-mono text-xs">{row.fee_type_id}</td>
                    <td className="px-6 py-4">{row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4">
                      {row.isValid ? (
                        <span className="text-green-600 bg-green-50 px-2 py-1 rounded">ถูกต้อง</span>
                      ) : (
                        <span className="text-red-600 bg-red-50 px-2 py-1 rounded">ข้อมูลไม่ถูกต้อง</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isImporting && (
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-1">
                <span>กำลังนำเข้า...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleImport}
              disabled={isImporting || validCount === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {isImporting ? 'กำลังนำเข้า...' : `ยืนยันการนำเข้า (${validCount} รายการ)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
