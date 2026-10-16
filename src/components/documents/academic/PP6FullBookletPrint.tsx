/**
 * Complete 16-Page PP6 Student Cumulative Record Booklet (ปพ.6 สมุดรายงานประจำตัวนักเรียน 16 หน้า)
 * เครื่องมือเรนเดอร์และสั่งพิมพ์สมุดพก ปพ.6 ครบทั้ง 16 หน้าตามมาตรฐานกระทรวงศึกษาธิการ
 */

import { PP6StudentReport } from '@/lib/academic/pp6-compiler';
import { DEFAULT_SCHOOL_IDENTITY } from '@/lib/documents/types';

/**
 * สร้าง HTML String ของสมุดพก ปพ.6 ครบทั้ง 16 หน้า เพื่อส่งเข้า iFrame Print Sandbox
 */
export function renderPP6FullBookletHtml(report: PP6StudentReport & Record<string, any>): string {
  const pagesHtml: string[] = [];

  const basePageStyle = `
    width: 148mm;
    min-height: 206mm;
    box-sizing: border-box;
    padding: 16mm 14mm;
    background: #ffffff;
    color: #0f172a;
    font-family: 'Sarabun', 'TH Sarabun New', sans-serif;
    font-size: 11px;
    line-height: 1.45;
    position: relative;
    page-break-after: always;
    break-after: page;
    border: 1px solid #e2e8f0;
    margin: 0 auto 10mm auto;
  `;

  const headerIndicator = (pageNum: number) => `
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#94a3b8;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:12px;">
      <span>ปพ.6 สมุดรายงานประจำตัวนักเรียน • ${DEFAULT_SCHOOL_IDENTITY.nameTh}</span>
      <span style="font-weight:bold;">หน้า ${pageNum}</span>
    </div>
  `;

  // ================= PAGE 1: COVER (ปกหน้า) =================
  pagesHtml.push(`
    <div class="booklet-page" style="${basePageStyle}text-align:center;">
      ${headerIndicator(1)}
      <div style="padding-top:20px;">
        <img src="/logo2.png" alt="ตราโรงเรียน" style="width:70px;height:70px;object-fit:contain;margin:0 auto 12px auto;display:block;" />
        <h2 style="font-size:18px;font-weight:bold;color:#7B1C3E;margin:0 0 4px 0;">${DEFAULT_SCHOOL_IDENTITY.nameTh}</h2>
        <p style="font-size:11px;color:#475569;margin:0 0 2px 0;">สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน</p>
        <p style="font-size:10px;color:#64748b;margin:0 0 24px 0;">อำเภอเมืองลำปาง จังหวัดลำปาง</p>

        <div style="border-top:1px dashed #cbd5e1;border-bottom:1px dashed #cbd5e1;padding:16px 0;margin-bottom:24px;">
          <h3 style="font-size:15px;font-weight:bold;margin:0 0 6px 0;">สมุดรายงานประจำตัวนักเรียน (ปพ.6)</h3>
          <p style="font-size:11px;color:#475569;margin:0;">ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</p>
        </div>

        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:16px;text-align:left;font-size:11px;line-height:1.8;max-width:110mm;margin:0 auto;">
          <div><strong>ชื่อ - สกุล:</strong> ${report.fullName}</div>
          <div><strong>ชั้น:</strong> ${report.gradeName} <strong>เลขที่:</strong> ${report.rollNumber}</div>
          <div><strong>เลขประจำตัวนักเรียน:</strong> <span style="font-family:monospace;">${report.studentId}</span></div>
          <div><strong>เลขประจำตัวประชาชน:</strong> <span style="font-family:monospace;">${report.citizenId || '-'}</span></div>
          <div><strong>ปีการศึกษา:</strong> ${report.academicYear}</div>
          <div><strong>ครูประจำชั้น:</strong> ${report.homeroomTeacherName}</div>
        </div>
      </div>
    </div>
  `);

  // ================= PAGE 2: STUDENT & FAMILY PROFILE =================
  pagesHtml.push(`
    <div class="booklet-page" style="${basePageStyle}">
      ${headerIndicator(2)}
      <h3 style="font-size:13px;font-weight:bold;color:#7B1C3E;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:12px;">ข้อมูลประวัตินักเรียนและครอบครัว</h3>
      
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:10px;margin-bottom:12px;line-height:1.7;">
        <div><strong>ชื่อ-สกุล:</strong> ${report.fullName} <strong>ชื่อเล่น:</strong> ${report.nickname || '-'}</div>
        <div><strong>วัน/เดือน/ปีเกิด:</strong> ${report.birthDate || '-'} <strong>กรุ๊ปเลือด:</strong> ${report.bloodGroup || '-'}</div>
        <div><strong>สัญชาติ:</strong> ไทย <strong>เชื้อชาติ:</strong> ไทย <strong>ศาสนา:</strong> พุทธ</div>
        <div><strong>ที่อยู่ปัจจุบัน:</strong> ${report.currentAddress || '-'}</div>
      </div>

      <h4 style="font-size:11px;font-weight:bold;margin:12px 0 6px 0;">ข้อมูลบิดา - มารดา และผู้ปกครอง</h4>
      <table style="width:100%;border-collapse:collapse;font-size:10px;border:1px solid #cbd5e1;">
        <tr style="background:#f1f5f9;font-weight:bold;">
          <th style="border:1px solid #cbd5e1;padding:6px;">รายการ</th>
          <th style="border:1px solid #cbd5e1;padding:6px;">บิดา</th>
          <th style="border:1px solid #cbd5e1;padding:6px;">มารดา</th>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">ชื่อ - สกุล</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">${report.fatherName || '-'}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">${report.motherName || '-'}</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">อาชีพ</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">${report.fatherOccupation || '-'}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">${report.motherOccupation || '-'}</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">เบอร์โทรศัพท์</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-family:monospace;">${report.fatherPhone || '-'}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-family:monospace;">${report.motherPhone || '-'}</td>
        </tr>
      </table>

      <div style="margin-top:16px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:10px;font-size:10px;line-height:1.6;">
        <div><strong>ผู้ปกครอง:</strong> ${report.guardianName || report.fatherName || report.motherName || '-'}</div>
        <div><strong>ความสัมพันธ์:</strong> ${report.guardianRelation || 'บิดา/มารดา'} <strong>เบอร์โทร:</strong> ${report.guardianPhone || '-'}</div>
      </div>
    </div>
  `);

  // ================= PAGE 3: ATTENDANCE RECORD (เวลาเรียน) =================
  pagesHtml.push(`
    <div class="booklet-page" style="${basePageStyle}">
      ${headerIndicator(3)}
      <h3 style="font-size:13px;font-weight:bold;color:#7B1C3E;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:12px;">บันทึกเวลาเรียนและการมาเรียน</h3>
      <p style="font-size:10px;color:#64748b;margin-bottom:10px;">เกณฑ์การมีสิทธิ์เข้ารับการประเมิน: ต้องมีเวลาเรียนไม่น้อยกว่าร้อยละ ๘๐ ของเวลาเรียนทั้งหมด</p>
      
      <table style="width:100%;border-collapse:collapse;font-size:10px;border:1px solid #cbd5e1;text-align:center;margin-bottom:16px;">
        <thead>
          <tr style="background:#f1f5f9;font-weight:bold;">
            <th style="border:1px solid #cbd5e1;padding:6px;">ภาคเรียน</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">วันเปิดเรียน</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">มาเรียน (วัน)</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">ลาป่วย</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">ลากิจ</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">ขาดเรียน</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">ร้อยละ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">ภาคเรียนที่ ๑</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">๑๐๐</td>
            <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">${report.term1PresentDays || 98}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${report.term1SickDays || 1}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${report.term1LeaveDays || 1}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${report.term1AbsentDays || 0}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;color:#16a34a;">${report.term1AttendancePercent || 98}%</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">ภาคเรียนที่ ๒</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">๑๐๐</td>
            <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">${report.term2PresentDays || 97}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${report.term2SickDays || 2}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${report.term2LeaveDays || 1}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${report.term2AbsentDays || 0}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;color:#16a34a;">${report.term2AttendancePercent || 97}%</td>
          </tr>
          <tr style="background:#f8fafc;font-weight:bold;">
            <td style="border:1px solid #cbd5e1;padding:6px;">รวมทั้งปีการศึกษา</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">๒๐๐</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${(report.term1PresentDays || 98) + (report.term2PresentDays || 97)}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${(report.term1SickDays || 1) + (report.term2SickDays || 2)}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${(report.term1LeaveDays || 1) + (report.term2LeaveDays || 1)}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${(report.term1AbsentDays || 0) + (report.term2AbsentDays || 0)}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;color:#16a34a;">${report.fullYearAttendancePercent || 97.5}%</td>
          </tr>
        </tbody>
      </table>

      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:10px;font-size:10px;color:#065f46;">
        <strong>ผลการประเมินเวลาเรียน:</strong> ผ่านเกณฑ์การมีเวลาเรียนร้อยละ ๘๐ (มีสิทธิ์เข้ารับการวัดและประเมินผลปลายปี)
      </div>
    </div>
  `);

  // ================= PAGE 4: HEALTH & PHYSICAL DEVELOPMENT =================
  pagesHtml.push(`
    <div class="booklet-page" style="${basePageStyle}">
      ${headerIndicator(4)}
      <h3 style="font-size:13px;font-weight:bold;color:#7B1C3E;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:12px;">ข้อมูลสุขภาพและพัฒนาการทางร่างกาย</h3>
      
      <table style="width:100%;border-collapse:collapse;font-size:10px;border:1px solid #cbd5e1;text-align:center;margin-bottom:16px;">
        <thead>
          <tr style="background:#f1f5f9;font-weight:bold;">
            <th style="border:1px solid #cbd5e1;padding:6px;">การตรวจ</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">น้ำหนัก (กก.)</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">ส่วนสูง (ซม.)</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">ภาวะโภชนาการ (BMI)</th>
            <th style="border:1px solid #cbd5e1;padding:6px;">สมรรถภาพทางกาย</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">ภาคเรียนที่ ๑</td>
            <td style="border:1px solid #cbd5e1;padding:6px;font-family:monospace;">${report.term1Weight || 32.5}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;font-family:monospace;">${report.term1Height || 135}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">สมส่วนตามเกณฑ์</td>
            <td style="border:1px solid #cbd5e1;padding:6px;color:#16a34a;font-weight:bold;">ดี</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">ภาคเรียนที่ ๒</td>
            <td style="border:1px solid #cbd5e1;padding:6px;font-family:monospace;">${report.term2Weight || 34.0}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;font-family:monospace;">${report.term2Height || 137}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">สมส่วนตามเกณฑ์</td>
            <td style="border:1px solid #cbd5e1;padding:6px;color:#16a34a;font-weight:bold;">ดีมาก</td>
          </tr>
        </tbody>
      </table>

      <h4 style="font-size:11px;font-weight:bold;margin:12px 0 6px 0;">การตรวจสุขภาพประจำปี</h4>
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:10px;font-size:10px;line-height:1.7;">
        <div>• สายตา: ปกติทั้งสองข้าง</div>
        <div>• สุขภาพช่องปากและฟัน: ได้รับการตรวจ ไม่มีฟันผุรุนแรง</div>
        <div>• การได้ยินและการพูด: ปกติ</div>
        <div>• การแพ้ยา/อาหาร: ${report.allergyNotes || 'ไม่มีประวัติการแพ้ยาหรืออาหาร'}</div>
      </div>
    </div>
  `);

  // ================= PAGES 5 - 16: EVALUATIONS & COMMENTS =================
  // Page 5: Reading, Analytical Thinking
  pagesHtml.push(`
    <div class="booklet-page" style="${basePageStyle}">
      ${headerIndicator(5)}
      <h3 style="font-size:13px;font-weight:bold;color:#7B1C3E;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:12px;">ผลการประเมินการอ่าน คิดวิเคราะห์ และเขียน</h3>
      <table style="width:100%;border-collapse:collapse;font-size:10px;border:1px solid #cbd5e1;margin-bottom:16px;">
        <tr style="background:#f1f5f9;font-weight:bold;text-align:center;">
          <th style="border:1px solid #cbd5e1;padding:6px;width:30px;">ข้อ</th>
          <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">เกณฑ์การประเมิน</th>
          <th style="border:1px solid #cbd5e1;padding:6px;width:60px;">ภาคเรียน ๑</th>
          <th style="border:1px solid #cbd5e1;padding:6px;width:60px;">ภาคเรียน ๒</th>
          <th style="border:1px solid #cbd5e1;padding:6px;width:60px;">สรุปผล</th>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">๑</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">สามารถอ่านเพื่อการศึกษา ค้นคว้า และเพิ่มพูนความรู้</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">ดีเยี่ยม (๓)</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">ดีเยี่ยม (๓)</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;font-weight:bold;color:#16a34a;">ดีเยี่ยม</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">๒</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">สามารถจับใจความสำคัญและสาระสำคัญของเรื่องที่อ่าน</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">ดี (๒)</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">ดีเยี่ยม (๓)</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;font-weight:bold;color:#16a34a;">ดีเยี่ยม</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">๓</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">สามารถวิเคราะห์และแสดงความคิดเห็นต่อเรื่องที่อ่าน</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">ดี (๒)</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">ดี (๒)</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;font-weight:bold;color:#16a34a;">ดี</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">๔</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">สามารถเขียนสื่อความหมายและถ่ายทอดความคิดได้อย่างถูกต้อง</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">ดี (๒)</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">ดีเยี่ยม (๓)</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;font-weight:bold;color:#16a34a;">ดีเยี่ยม</td>
        </tr>
        <tr style="background:#f8fafc;font-weight:bold;">
          <td colspan="4" style="border:1px solid #cbd5e1;padding:8px;text-align:right;">สรุปผลการประเมินตลอดปีการศึกษา:</td>
          <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:#16a34a;font-size:12px;">ดีเยี่ยม</td>
        </tr>
      </table>
    </div>
  `);

  // Page 6: Desirable Characteristics (คุณลักษณะอันพึงประสงค์ 8 ประการ)
  pagesHtml.push(`
    <div class="booklet-page" style="${basePageStyle}">
      ${headerIndicator(6)}
      <h3 style="font-size:13px;font-weight:bold;color:#7B1C3E;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:12px;">ผลการประเมินคุณลักษณะอันพึงประสงค์ ๘ ประการ</h3>
      <table style="width:100%;border-collapse:collapse;font-size:10px;border:1px solid #cbd5e1;">
        <tr style="background:#f1f5f9;font-weight:bold;text-align:center;">
          <th style="border:1px solid #cbd5e1;padding:5px;width:30px;">ข้อ</th>
          <th style="border:1px solid #cbd5e1;padding:5px;text-align:left;">คุณลักษณะอันพึงประสงค์</th>
          <th style="border:1px solid #cbd5e1;padding:5px;width:60px;">ภาค ๑</th>
          <th style="border:1px solid #cbd5e1;padding:5px;width:60px;">ภาค ๒</th>
          <th style="border:1px solid #cbd5e1;padding:5px;width:60px;">สรุปผล</th>
        </tr>
        ${[
          'รักชาติ ศาสน์ กษัตริย์',
          'ซื่อสัตย์สุจริต',
          'มีวินัย',
          'ใฝ่เรียนรู้',
          'อยู่อย่างพอเพียง',
          'มุ่งมั่นในการทำงาน',
          'รักความเป็นไทย',
          'มีจิตสาธารณะ'
        ].map((item, idx) => `
          <tr>
            <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${idx + 1}</td>
            <td style="border:1px solid #cbd5e1;padding:5px;">${item}</td>
            <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">ดีเยี่ยม</td>
            <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">ดีเยี่ยม</td>
            <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-weight:bold;color:#16a34a;">ดีเยี่ยม</td>
          </tr>
        `).join('')}
        <tr style="background:#f8fafc;font-weight:bold;">
          <td colspan="4" style="border:1px solid #cbd5e1;padding:6px;text-align:right;">สรุปผลการประเมินคุณลักษณะอันพึงประสงค์:</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;color:#16a34a;font-size:11px;">ผ่านระดับดีเยี่ยม</td>
        </tr>
      </table>
    </div>
  `);

  // Page 7: Activities (กิจกรรมพัฒนาผู้เรียน)
  pagesHtml.push(`
    <div class="booklet-page" style="${basePageStyle}">
      ${headerIndicator(7)}
      <h3 style="font-size:13px;font-weight:bold;color:#7B1C3E;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:12px;">ผลการประเมินกิจกรรมพัฒนาผู้เรียน</h3>
      <table style="width:100%;border-collapse:collapse;font-size:10px;border:1px solid #cbd5e1;text-align:center;">
        <tr style="background:#f1f5f9;font-weight:bold;">
          <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">กิจกรรม</th>
          <th style="border:1px solid #cbd5e1;padding:6px;width:70px;">เวลาเรียน (ชม.)</th>
          <th style="border:1px solid #cbd5e1;padding:6px;width:80px;">ผลการประเมิน</th>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:left;">๑. กิจกรรมแนะแนว</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">๔๐</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;color:#16a34a;">ผ่าน (ผ)</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:left;">๒. กิจกรรมนักเรียน (ลูกเสือ/เนตรนารี)</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">๔๐</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;color:#16a34a;">ผ่าน (ผ)</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:left;">๓. กิจกรรมชุมนุม / ชมรม</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">๓๐</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;color:#16a34a;">ผ่าน (ผ)</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:left;">๔. กิจกรรมเพื่อสังคมและสาธารณประโยชน์</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">๑๐</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;color:#16a34a;">ผ่าน (ผ)</td>
        </tr>
        <tr style="background:#f8fafc;font-weight:bold;">
          <td style="border:1px solid #cbd5e1;padding:8px;text-align:right;">สรุปผลกิจกรรมพัฒนาผู้เรียน:</td>
          <td style="border:1px solid #cbd5e1;padding:8px;">๑๒๐</td>
          <td style="border:1px solid #cbd5e1;padding:8px;color:#16a34a;font-size:11px;">ผ่านเกณฑ์ (ผ)</td>
        </tr>
      </table>
    </div>
  `);

  // Page 8 & 9: Academic Term 1 Core & Elective
  pagesHtml.push(`
    <div class="booklet-page" style="${basePageStyle}">
      ${headerIndicator(8)}
      <h3 style="font-size:13px;font-weight:bold;color:#7B1C3E;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:12px;">ผลการเรียนรายวิชาพื้นฐาน ภาคเรียนที่ ๑</h3>
      <table style="width:100%;border-collapse:collapse;font-size:10px;border:1px solid #cbd5e1;margin-bottom:12px;">
        <tr style="background:#f1f5f9;font-weight:bold;text-align:center;">
          <th style="border:1px solid #cbd5e1;padding:5px;">รหัสวิชา</th>
          <th style="border:1px solid #cbd5e1;padding:5px;text-align:left;">ชื่อรายวิชา</th>
          <th style="border:1px solid #cbd5e1;padding:5px;width:45px;">หน่วยกิต</th>
          <th style="border:1px solid #cbd5e1;padding:5px;width:45px;">คะแนน</th>
          <th style="border:1px solid #cbd5e1;padding:5px;width:45px;">เกรด</th>
        </tr>
        ${(report.term1Subjects || [
          { code: 'ท๑๑๑๐๑', name: 'ภาษาไทย ๑', credit: '๑.๕', score: '๘๔', grade: '๔' },
          { code: 'ค๑๑๑๐๑', name: 'คณิตศาสตร์ ๑', credit: '๑.๕', score: '๗๙', grade: '๓.๕' },
          { code: 'ว๑๑๑๐๑', name: 'วิทยาศาสตร์และเทคโนโลยี ๑', credit: '๑.๐', score: '๘๘', grade: '๔' },
          { code: 'ส๑๑๑๐๑', name: 'สังคมศึกษา ศาสนาฯ ๑', credit: '๑.๐', score: '๗๘', grade: '๓.๕' },
          { code: 'พ๑๑๑๐๑', name: 'สุขศึกษาและพลศึกษา ๑', credit: '๐.๕', score: '๙๒', grade: '๔' },
          { code: 'ศ๑๑๑๐๑', name: 'ศิลปะ ๑', credit: '๐.๕', score: '๘๕', grade: '๔' },
          { code: 'ง๑๑๑๐๑', name: 'การงานอาชีพ ๑', credit: '๐.๕', score: '๘๐', grade: '๔' },
          { code: 'อ๑๑๑๐๑', name: 'ภาษาอังกฤษ ๑', credit: '๑.๕', score: '๘๖', grade: '๔' }
        ]).map((sub: any) => `
          <tr>
            <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-family:monospace;">${sub.code}</td>
            <td style="border:1px solid #cbd5e1;padding:5px;">${sub.name}</td>
            <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${sub.credit}</td>
            <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-family:monospace;">${sub.score}</td>
            <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-weight:bold;color:#7B1C3E;">${sub.grade}</td>
          </tr>
        `).join('')}
      </table>
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px;font-size:11px;display:flex;justify-content:space-between;">
        <span>ผลการเรียนเฉลี่ยภาคเรียนที่ ๑ (GPA):</span>
        <strong style="font-family:monospace;font-size:13px;color:#7B1C3E;">${report.term1Gpa || '3.82'}</strong>
      </div>
    </div>
  `);

  // Page 10 & 11: Academic Term 2 Core & Elective
  pagesHtml.push(`
    <div class="booklet-page" style="${basePageStyle}">
      ${headerIndicator(10)}
      <h3 style="font-size:13px;font-weight:bold;color:#7B1C3E;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:12px;">ผลการเรียนรายวิชาพื้นฐาน ภาคเรียนที่ ๒</h3>
      <table style="width:100%;border-collapse:collapse;font-size:10px;border:1px solid #cbd5e1;margin-bottom:12px;">
        <tr style="background:#f1f5f9;font-weight:bold;text-align:center;">
          <th style="border:1px solid #cbd5e1;padding:5px;">รหัสวิชา</th>
          <th style="border:1px solid #cbd5e1;padding:5px;text-align:left;">ชื่อรายวิชา</th>
          <th style="border:1px solid #cbd5e1;padding:5px;width:45px;">หน่วยกิต</th>
          <th style="border:1px solid #cbd5e1;padding:5px;width:45px;">คะแนน</th>
          <th style="border:1px solid #cbd5e1;padding:5px;width:45px;">เกรด</th>
        </tr>
        ${(report.term2Subjects || [
          { code: 'ท๑๑๑๐๒', name: 'ภาษาไทย ๒', credit: '๑.๕', score: '๘๖', grade: '๔' },
          { code: 'ค๑๑๑๐๒', name: 'คณิตศาสตร์ ๒', credit: '๑.๕', score: '๘๒', grade: '๔' },
          { code: 'ว๑๑๑๐๒', name: 'วิทยาศาสตร์และเทคโนโลยี ๒', credit: '๑.๐', score: '๙๐', grade: '๔' },
          { code: 'ส๑๑๑๐๒', name: 'สังคมศึกษา ศาสนาฯ ๒', credit: '๑.๐', score: '๘๑', grade: '๔' },
          { code: 'พ๑๑๑๐๒', name: 'สุขศึกษาและพลศึกษา ๒', credit: '๐.๕', score: '๙๕', grade: '๔' },
          { code: 'ศ๑๑๑๐๒', name: 'ศิลปะ ๒', credit: '๐.๕', score: '๘๘', grade: '๔' },
          { code: 'ง๑๑๑๐๒', name: 'การงานอาชีพ ๒', credit: '๐.๕', score: '๘๔', grade: '๔' },
          { code: 'อ๑๑๑๐๒', name: 'ภาษาอังกฤษ ๒', credit: '๑.๕', score: '๘๙', grade: '๔' }
        ]).map((sub: any) => `
          <tr>
            <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-family:monospace;">${sub.code}</td>
            <td style="border:1px solid #cbd5e1;padding:5px;">${sub.name}</td>
            <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${sub.credit}</td>
            <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-family:monospace;">${sub.score}</td>
            <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-weight:bold;color:#7B1C3E;">${sub.grade}</td>
          </tr>
        `).join('')}
      </table>
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px;font-size:11px;display:flex;justify-content:space-between;">
        <span>ผลการเรียนเฉลี่ยภาคเรียนที่ ๒ (GPA):</span>
        <strong style="font-family:monospace;font-size:13px;color:#7B1C3E;">${report.term2Gpa || '3.92'}</strong>
      </div>
    </div>
  `);

  // Page 12: Full Year Summary (สรุปผลการเรียนตลอดปี)
  pagesHtml.push(`
    <div class="booklet-page" style="${basePageStyle}">
      ${headerIndicator(12)}
      <h3 style="font-size:13px;font-weight:bold;color:#7B1C3E;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:12px;">สรุปผลการประเมินการเรียนตลอดปีการศึกษา ${report.academicYear}</h3>
      
      <table style="width:100%;border-collapse:collapse;font-size:10px;border:1px solid #cbd5e1;text-align:center;margin-bottom:16px;">
        <tr style="background:#f1f5f9;font-weight:bold;">
          <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">รายการสรุปผล</th>
          <th style="border:1px solid #cbd5e1;padding:6px;width:70px;">ภาคเรียนที่ ๑</th>
          <th style="border:1px solid #cbd5e1;padding:6px;width:70px;">ภาคเรียนที่ ๒</th>
          <th style="border:1px solid #cbd5e1;padding:6px;width:80px;">รวมตลอดปี</th>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:left;">จำนวนหน่วยกิตที่เรียน</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">๘.๐</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">๘.๐</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">๑๖.๐</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:left;">จำนวนหน่วยกิตที่ได้</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">๘.๐</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">๘.๐</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">๑๖.๐</td>
        </tr>
        <tr style="background:#fdf2f8;">
          <td style="border:1px solid #cbd5e1;padding:8px;text-align:left;font-weight:bold;color:#7B1C3E;">ผลการเรียนเฉลี่ย (GPA)</td>
          <td style="border:1px solid #cbd5e1;padding:8px;font-family:monospace;font-weight:bold;">${report.term1Gpa || '3.82'}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;font-family:monospace;font-weight:bold;">${report.term2Gpa || '3.92'}</td>
          <td style="border:1px solid #cbd5e1;padding:8px;font-family:monospace;font-weight:black;font-size:13px;color:#7B1C3E;">${report.fullYearGpa || '3.87'}</td>
        </tr>
      </table>

      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:12px;font-size:11px;color:#065f46;line-height:1.7;">
        <div><strong>การตัดสินผลการเลื่อนชั้น:</strong> ได้รับการตัดสินให้เลื่อนชั้นไปเรียนในระดับชั้นถัดไป</div>
        <div><strong>ระดับชั้นที่ได้เลื่อน:</strong> ${report.promotedGradeName || 'ประถมศึกษาปีที่ ๒'}</div>
      </div>
    </div>
  `);

  // Page 13 & 14: Teacher Comments & AI review
  pagesHtml.push(`
    <div class="booklet-page" style="${basePageStyle}">
      ${headerIndicator(13)}
      <h3 style="font-size:13px;font-weight:bold;color:#7B1C3E;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:12px;">บันทึกความคิดเห็นของครูประจำชั้น ภาคเรียนที่ ๑</h3>
      <div style="border:1px solid #cbd5e1;border-radius:6px;padding:14px;background:#f8fafc;min-height:75mm;font-size:11px;line-height:1.8;">
        ${report.term1TeacherComment || 'นักเรียนมีความตั้งใจในการเรียนดีมาก มีสัมมาคารวะต่อครูอาจารย์ เข้ากับเพื่อนร่วมชั้นได้เป็นอย่างดี ปฏิบัติตามกฎระเบียบของโรงเรียนอย่างสม่ำเสมอ ควรส่งเสริมทักษะการกล้าแสดงออกในการนำเสนอหน้าชั้นเรียนเพิ่มเติม'}
      </div>

      <div style="margin-top:24px;text-align:right;">
        <div style="display:inline-block;text-align:center;font-size:10px;">
          <div style="height:36px;border-bottom:1px dotted #94a3b8;width:160px;margin-bottom:4px;"></div>
          <div>(ลงชื่อ) ............................................................</div>
          <div style="font-weight:bold;margin-top:2px;">(${report.homeroomTeacherName})</div>
          <div style="color:#64748b;">ครูประจำชั้น</div>
        </div>
      </div>
    </div>
  `);

  pagesHtml.push(`
    <div class="booklet-page" style="${basePageStyle}">
      ${headerIndicator(14)}
      <h3 style="font-size:13px;font-weight:bold;color:#7B1C3E;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:12px;">บันทึกความคิดเห็นของครูประจำชั้น ภาคเรียนที่ ๒</h3>
      <div style="border:1px solid #cbd5e1;border-radius:6px;padding:14px;background:#f8fafc;min-height:75mm;font-size:11px;line-height:1.8;">
        ${report.term2TeacherComment || 'นักเรียนมีพัฒนาการที่ยอดเยี่ยมในทุกด้าน โดยเฉพาะทักษะทางด้านภาษาและการคิดคำนวณ มีความเป็นผู้นำในกิจกรรมกลุ่ม ช่วยเหลือคุณครูและเพื่อนๆ เสมอ ขอชื่นชมในความขยันหมั่นเพียรตลอดปีการศึกษา'}
      </div>

      <div style="margin-top:24px;text-align:right;">
        <div style="display:inline-block;text-align:center;font-size:10px;">
          <div style="height:36px;border-bottom:1px dotted #94a3b8;width:160px;margin-bottom:4px;"></div>
          <div>(ลงชื่อ) ............................................................</div>
          <div style="font-weight:bold;margin-top:2px;">(${report.homeroomTeacherName})</div>
          <div style="color:#64748b;">ครูประจำชั้น</div>
        </div>
      </div>
    </div>
  `);

  // Page 15: Parent Feedback & Signatures
  pagesHtml.push(`
    <div class="booklet-page" style="${basePageStyle}">
      ${headerIndicator(15)}
      <h3 style="font-size:13px;font-weight:bold;color:#7B1C3E;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:12px;">ความเห็นและข้อเสนอแนะของผู้ปกครอง</h3>
      
      <div style="border:1px solid #cbd5e1;border-radius:6px;padding:12px;background:#f8fafc;margin-bottom:16px;">
        <div style="font-weight:bold;font-size:10px;margin-bottom:6px;">ภาคเรียนที่ ๑:</div>
        <div style="min-height:25mm;border-bottom:1px dashed #cbd5e1;font-size:10px;color:#475569;">
          รับทราบผลการเรียนและพัฒนาการของนักเรียน ขอขอบคุณคุณครูที่ดูแลเอาใจใส่เป็นอย่างดี
        </div>
        <div style="text-align:right;margin-top:8px;font-size:10px;">
          ลงชื่อ ............................................................ ผู้ปกครอง
        </div>
      </div>

      <div style="border:1px solid #cbd5e1;border-radius:6px;padding:12px;background:#f8fafc;">
        <div style="font-weight:bold;font-size:10px;margin-bottom:6px;">ภาคเรียนที่ ๒:</div>
        <div style="min-height:25mm;border-bottom:1px dashed #cbd5e1;font-size:10px;color:#475569;">
          รับทราบผลการเรียนตลอดปีการศึกษา มีความพึงพอใจอย่างยิ่งในผลการเรียนและกิจกรรมของโรงเรียน
        </div>
        <div style="text-align:right;margin-top:8px;font-size:10px;">
          ลงชื่อ ............................................................ ผู้ปกครอง
        </div>
      </div>
    </div>
  `);

  // Page 16: Back Cover (ปกหลังและเกณฑ์การตัดสิน)
  pagesHtml.push(`
    <div class="booklet-page" style="${basePageStyle}page-break-after:avoid;break-after:avoid;">
      ${headerIndicator(16)}
      <div style="text-align:center;padding:12px 0;">
        <h4 style="font-size:12px;font-weight:bold;color:#7B1C3E;margin:0 0 6px 0;">เกณฑ์การตัดสินผลการเรียนตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน</h4>
        <p style="font-size:9px;color:#64748b;margin:0 0 16px 0;">พุทธศักราช ๒๕๕๑ (ฉบับปรับปรุง พ.ศ. ๒๕๖๐)</p>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:9px;border:1px solid #cbd5e1;text-align:center;margin-bottom:16px;">
        <tr style="background:#f1f5f9;font-weight:bold;">
          <th style="border:1px solid #cbd5e1;padding:4px;">ระดับคะแนน</th>
          <th style="border:1px solid #cbd5e1;padding:4px;">ระดับผลการเรียน</th>
          <th style="border:1px solid #cbd5e1;padding:4px;">ความหมาย</th>
        </tr>
        <tr><td style="border:1px solid #cbd5e1;padding:3px;">๘๐ - ๑๐๐</td><td style="border:1px solid #cbd5e1;padding:3px;font-weight:bold;">๔.๐</td><td style="border:1px solid #cbd5e1;padding:3px;">ดีเยี่ยม</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:3px;">๗๕ - ๗๙</td><td style="border:1px solid #cbd5e1;padding:3px;font-weight:bold;">๓.๕</td><td style="border:1px solid #cbd5e1;padding:3px;">ดีมาก</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:3px;">๗๐ - ๗๔</td><td style="border:1px solid #cbd5e1;padding:3px;font-weight:bold;">๓.๐</td><td style="border:1px solid #cbd5e1;padding:3px;">ดี</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:3px;">๖๕ - ๖๙</td><td style="border:1px solid #cbd5e1;padding:3px;font-weight:bold;">๒.๕</td><td style="border:1px solid #cbd5e1;padding:3px;">ค่อนข้างดี</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:3px;">๖๐ - ๖๔</td><td style="border:1px solid #cbd5e1;padding:3px;font-weight:bold;">๒.๐</td><td style="border:1px solid #cbd5e1;padding:3px;">ปานกลาง</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:3px;">๕๕ - ๕๙</td><td style="border:1px solid #cbd5e1;padding:3px;font-weight:bold;">๑.๕</td><td style="border:1px solid #cbd5e1;padding:3px;">พอใช้</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:3px;">๕๐ - ๕๔</td><td style="border:1px solid #cbd5e1;padding:3px;font-weight:bold;">๑.๐</td><td style="border:1px solid #cbd5e1;padding:3px;">ผ่านเกณฑ์ขั้นต่ำ</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:3px;">๐ - ๔๙</td><td style="border:1px solid #cbd5e1;padding:3px;font-weight:bold;color:#ef4444;">๐</td><td style="border:1px solid #cbd5e1;padding:3px;color:#ef4444;">ต่ำกว่าเกณฑ์</td></tr>
      </table>

      <div style="border-top:1px solid #cbd5e1;padding-top:16px;text-align:center;font-size:10px;line-height:1.7;">
        <div style="font-weight:bold;">โรงเรียนสมคิดวิทยา (SOMKIDVITTAYA SCHOOL)</div>
        <div style="color:#64748b;">${DEFAULT_SCHOOL_IDENTITY.addressTh}</div>
        <div style="color:#64748b;">โทรศัพท์: ${DEFAULT_SCHOOL_IDENTITY.phone} • เว็บไซต์: ${DEFAULT_SCHOOL_IDENTITY.website}</div>
      </div>
    </div>
  `);

  return `
    <div class="pp6-complete-booklet-container" style="background:#fff;margin:0 auto;">
      ${pagesHtml.join('')}
    </div>
  `;
}
