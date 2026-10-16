/**
 * Professional Excel Export Service
 * ระบบส่งออกตารางข้อมูลเป็นไฟล์ Microsoft Excel (.xlsx) มาตรฐานระดับองค์กร
 * รองรับภาษาไทยสมบูรณ์แบบ หัวตารางสีอัตลักษณ์โรงเรียน และความกว้างคอลัมน์อัตโนมัติ
 */

import ExcelJS from 'exceljs';
import { DEFAULT_SCHOOL_IDENTITY } from './types';

export interface ExcelColumnDef {
  header: string;
  key: string;
  width?: number;
  style?: Partial<ExcelJS.Style>;
  format?: 'currency' | 'number' | 'text' | 'date';
}

export interface ExcelExportOptions {
  filename: string;
  sheetName?: string;
  title: string;
  subtitle?: string;
  columns: ExcelColumnDef[];
  data: Record<string, any>[];
  summaryRows?: { label: string; value: any; colSpan?: number }[];
}

/**
 * สร้างและดาวน์โหลดไฟล์ Excel (.xlsx) มาตรฐานโรงเรียนสมคิดวิทยา
 */
export async function exportToExcel(options: ExcelExportOptions): Promise<void> {
  const {
    filename,
    sheetName = 'ข้อมูล',
    title,
    subtitle,
    columns,
    data,
    summaryRows
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = DEFAULT_SCHOOL_IDENTITY.nameTh;
  workbook.lastModifiedBy = 'SVPortal System';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  let currentRow = 1;

  // 1. หัวเรื่องหลัก: ชื่อโรงเรียน
  worksheet.mergeCells(currentRow, 1, currentRow, columns.length);
  const schoolCell = worksheet.getCell(currentRow, 1);
  schoolCell.value = DEFAULT_SCHOOL_IDENTITY.nameTh;
  schoolCell.font = { name: 'Sarabun', size: 16, bold: true, color: { argb: 'FF7B1C3E' } };
  schoolCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 28;
  currentRow++;

  // 2. ชื่อเอกสาร
  worksheet.mergeCells(currentRow, 1, currentRow, columns.length);
  const titleCell = worksheet.getCell(currentRow, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Sarabun', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 22;
  currentRow++;

  // 3. หัวข้อย่อย / วันที่ออกเอกสาร
  if (subtitle) {
    worksheet.mergeCells(currentRow, 1, currentRow, columns.length);
    const subCell = worksheet.getCell(currentRow, 1);
    subCell.value = `${subtitle} (ข้อมูล ณ วันที่: ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })})`;
    subCell.font = { name: 'Sarabun', size: 10, italic: true, color: { argb: 'FF64748B' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 18;
    currentRow++;
  }

  // เว้น 1 บรรทัดก่อนหัวตาราง
  currentRow++;

  // 4. บรรทัดหัวตาราง (Table Headers)
  const headerRowIndex = currentRow;
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.height = 26;

  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7B1C3E' } // สีเอกลักษณ์โรงเรียน
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF4A0F24' } },
      bottom: { style: 'medium', color: { argb: 'FF4A0F24' } },
      left: { style: 'thin', color: { argb: 'FF9B2C52' } },
      right: { style: 'thin', color: { argb: 'FF9B2C52' } }
    };
  });
  currentRow++;

  // 5. ข้อมูลในตาราง (Data Rows)
  data.forEach((rowItem, rIdx) => {
    const row = worksheet.getRow(currentRow);
    row.height = 20;
    const isEven = rIdx % 2 === 1;

    columns.forEach((col, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      const rawVal = rowItem[col.key];

      cell.value = rawVal !== undefined && rawVal !== null ? rawVal : '-';
      cell.font = { name: 'Sarabun', size: 10 };
      
      // การจัดรูปแบบตามประเภทข้อมูล
      if (col.format === 'currency') {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (col.format === 'number') {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: cIdx === 0 ? 'center' : 'left', vertical: 'middle' };
      }

      // Zebra striping
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }
        };
      }

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
    currentRow++;
  });

  // 6. แถวสรุปผลท้ายตาราง (Summary Rows ถ้ามี)
  if (summaryRows && summaryRows.length > 0) {
    summaryRows.forEach((sum) => {
      const row = worksheet.getRow(currentRow);
      row.height = 22;
      const span = sum.colSpan || columns.length - 1;

      if (span > 1) {
        worksheet.mergeCells(currentRow, 1, currentRow, span);
      }

      const labelCell = row.getCell(1);
      labelCell.value = sum.label;
      labelCell.font = { name: 'Sarabun', size: 10, bold: true };
      labelCell.alignment = { horizontal: 'right', vertical: 'middle' };

      const valCell = row.getCell(span + 1);
      valCell.value = sum.value;
      valCell.font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FF7B1C3E' } };
      valCell.alignment = { horizontal: 'right', vertical: 'middle' };

      row.eachCell({ includeEmpty: false }, (cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'double', color: { argb: 'FF94A3B8' } }
        };
      });

      currentRow++;
    });
  }

  // 7. คำนวณความกว้างคอลัมน์อัตโนมัติ
  columns.forEach((col, idx) => {
    const colNumber = idx + 1;
    if (col.width) {
      worksheet.getColumn(colNumber).width = col.width;
    } else {
      let maxLen = col.header.length;
      data.forEach((d) => {
        const val = String(d[col.key] || '');
        if (val.length > maxLen) maxLen = val.length;
      });
      // เผื่อ margin ภาษาไทย
      worksheet.getColumn(colNumber).width = Math.max(maxLen + 4, 12);
    }
  });

  // 8. สร้าง Buffer และสั่งดาวน์โหลดลงเครื่องผู้ใช้
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
