import { NextRequest, NextResponse } from 'next/server';
import { callGemma } from '@/lib/ai/gemma';
import { sanitizeTextForAI } from '@/lib/ai/pdpa-sanitizer';
import { getServerUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    // Allow access for authenticated staff, or fallback gracefully with a guest/staff role
    const userName = (user as any)?.name || (user as any)?.email?.split('@')[0] || 'คุณครู';
    const userRole = (user as any)?.role || 'teacher';

    const body = await req.json();
    const message = body?.message?.trim();

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุข้อความที่ต้องการคุยกับน้องฟ้า' },
        { status: 400 }
      );
    }

    const history: ChatHistoryItem[] = Array.isArray(body?.history) ? body.history : [];
    const context = body?.context || {};
    const pathname: string = context.pathname || '/';
    const pageTitle: string = context.pageTitle || '';
    const extraInfo: any = context.extraInfo || {};

    // 1. Determine active school department module from pathname
    let moduleContextName = 'ทั่วไป / ภาพรวมโรงเรียน';
    let moduleContextGuidance = '';
    let defaultSuggestions = [
      'น้องฟ้าช่วยงานอะไรได้บ้าง',
      'สรุปสิ่งที่ครูต้องทำวันนี้',
      'ระเบียบ สช. ล่าสุดมีอะไรบ้าง'
    ];

    if (pathname.includes('/forms')) {
      moduleContextName = 'ระบบสร้างและจัดการแบบฟอร์ม (Forms Studio & Responses)';
      moduleContextGuidance = `
ขณะนี้คุณครูกำลังเปิดหน้า: "${moduleContextName}" (เส้นทาง: ${pathname})
เป้าหมายหลักในหน้านี้:
- ช่วยออกแบบและเพิ่มข้อคำถาม (ปรนัย, อัตนัย, ติ๊กเลือก, อัปโหลดไฟล์)
- ตรวจสอบความถูกต้องและสุขภาวะของแบบฟอร์ม (Form Health & PDPA Audit) เช่น ต้องมีช่องยินยอม PDPA, เบอร์ฉุกเฉิน, อาหารที่แพ้
- สรุปผลการตอบกลับและสถิติของผู้ปกครองหรือนักเรียน
- หากครูสั่งว่า "ช่วยเพิ่มคำถามเรื่อง...", "แก้ตัวเลือก...", "ออกแบบฟอร์ม..." ให้ตอบแนะนำคำถามและตัวเลือกที่พร้อมใช้งานในฟอร์มทันที`;
      defaultSuggestions = [
        'ช่วยแนะนำข้อคำถามสำหรับฟอร์มนี้',
        'ตรวจสอบความสมบูรณ์และ PDPA ของฟอร์ม',
        'สรุปแนวโน้มการตอบกลับของผู้ปกครอง'
      ];
    } else if (pathname.includes('/academic/timetable')) {
      moduleContextName = 'ระบบตารางเรียนตารางสอน & จัดครูสอนแทน (Timetable Engine)';
      moduleContextGuidance = `
ขณะนี้คุณครูกำลังเปิดหน้า: "${moduleContextName}" (เส้นทาง: ${pathname})
เป้าหมายหลักในหน้านี้:
- ตรวจสอบชั่วโมงชน (Collision Detection)
- จัดหาครูสอนแทนฉุกเฉินตามอัลกอริทึม 5 ระดับ (ตรงกลุ่มสาระ -> ตรงสายชั้น -> เกลี่ยภาระงานสมดุล)
- สรุปภาระงานสอนและชั่วโมงสอนเกินเพดานของคณะครู`;
      defaultSuggestions = [
        'ตรวจสอบชั่วโมงชนในตารางสอน',
        'จัดหาครูสอนแทนด่วน',
        'สรุปภาระงานสอนของคณะครู'
      ];
    } else if (pathname.includes('/academic/documents')) {
      moduleContextName = 'ศูนย์พิมพ์เอกสาร ปพ. ควบคุม & ส่งออก สช. (Controlled Documents Hub)';
      moduleContextGuidance = `
ขณะนี้คุณครูกำลังเปิดหน้า: "${moduleContextName}" (เส้นทาง: ${pathname})
เป้าหมายหลักในหน้านี้:
- ปพ.1:บ (ระเบียนแสดงผลการเรียน): คำนวณ GPAX ถูกต้องตามระเบียบ สพฐ., รองรับโหมด "พิมพ์ทับกระดาษจริง (Overlay)" และ "พิมพ์ฉบับสำเนา (Full Copy)"
- ปพ.2 (ประกาศนียบัตร): พิมพ์ลงกระดาษการ์ดทองตราครุฑดุนนูน ไม่เยื้องกรอบ
- ปพ.3 (รน.ช.): จัดทำบัญชีรายชื่อ ป.6 จบการศึกษา ส่งออกไฟล์ Excel สำหรับนำเข้าสู่ระบบ ORSS ของ สช. (orss.opec.go.th) ใน 1 คลิก
- ปพ.6 ดิจิทัล (สมุดพก 16 หน้า): เชื่อมโยงผลการเรียน 8 สาระ, เวลาเรียน, คุณลักษณะอันพึงประสงค์, และข้อมูลโภชนาการกรมอนามัย พร้อมผู้ช่วย AI ช่วยเขียนสรุปความเห็นครูประจำชั้น
- หากครูถามเรื่องการปรับจูนพิกัดพิมพ์ ให้แนะนำใช้แผ่นทดสอบ 10mm (Test Grid) เพื่อวัดระยะเลื่อน X และ Y ในหน่วยมิลลิเมตรก่อนพิมพ์จริง`;
      defaultSuggestions = [
        'วิธีปรับพิกัดพิมพ์ ปพ.1 ไม่ให้ตกกรอบ',
        'ขั้นตอนส่งออก ปพ.3 เข้า ORSS สช.',
        'ช่วยร่างความเห็นครูประจำชั้นใน ปพ.6'
      ];
    } else if (pathname.includes('/academic')) {
      moduleContextName = 'ระบบวิชาการ การวัดผล และเล่ม ปพ. (Academic & Gradebook)';
      moduleContextGuidance = `
ขณะนี้คุณครูกำลังเปิดหน้า: "${moduleContextName}" (เส้นทาง: ${pathname})
เป้าหมายหลักในหน้านี้:
- ช่วยตัดเกรด วิเคราะห์คะแนน ปพ.5 และตัวชี้วัดหลักสูตรแกนกลาง
- ตรวจจับนักเรียนกลุ่มเสี่ยงติด มส. (เวลาเรียนต่ำกว่า 80%) หรือผลการเรียนตก
- ช่วยร่างข้อสอบปรนัยพร้อมช้อยส์หลอก 4 ตัวเลือกและคำอธิบายเฉลย 3 ภาษา`;
      defaultSuggestions = [
        'ช่วยออกข้อสอบปรนัย 5 ข้อ',
        'ตรวจสอบนักเรียนเสี่ยงติด มส.',
        'สรุปขั้นตอนการส่งเล่ม ปพ.5'
      ];
    } else if (pathname.includes('/pastoral')) {
      moduleContextName = 'ระบบดูแลช่วยเหลือนักเรียน 360° (Student Pastoral Care 360°)';
      moduleContextGuidance = `
ขณะนี้คุณครูกำลังเปิดหน้า: "${moduleContextName}" (เส้นทาง: ${pathname})
เป้าหมายหลักในหน้านี้:
- แบบประเมิน SDQ 25 ข้อมาตรฐานกรมสุขภาพจิต กระทรวงสาธารณสุข: ประเมิน 5 ด้าน (อารมณ์, ความประพฤติ, สมาธิสั้น/อยู่ไม่นิ่ง, เพื่อน, และจุดเด่นด้านสังคม) พร้อมระบบกลับคะแนนอัตโนมัติในข้อ 7, 11, 14, 21, 25
- รองรับการประเมิน 3 มิติ (Triangulation): ครู, ผู้ปกครอง, และนักเรียนประเมินตนเอง พร้อมระบบตรวจจับความขัดแย้งของพฤติกรรมระหว่างที่บ้านและโรงเรียน
- ระบบเยี่ยมบ้านนักเรียนเคลื่อนที่ (Mobile Home Visit Studio): รองรับการจับพิกัด GPS อัตโนมัติ, ภาพถ่าย, การเช็กลิสต์ความเสี่ยง, และระบบพิมพ์แบบบันทึกการเยี่ยมบ้าน สพฐ./สช. ทางการ
- น้องฟ้า AI สามารถช่วยครูเรียบเรียงบันทึกเสียงดิบ/ข้อความภาคสนามจากการเยี่ยมบ้านให้กลายเป็นรายงานสรุปทางการที่พร้อมพิมพ์ได้ทันที
- หากครูต้องการคำแนะนำเกี่ยวกับการแปลผลคะแนน SDQ หรือการส่งต่อนักเรียนกลุ่มเสี่ยง/มีปัญหา ให้น้องฟ้าให้คำแนะนำเชิงจิตวิทยาและการแนะแนวอย่างอบอุ่น`;
      defaultSuggestions = [
        'เกณฑ์ตัดคะแนน SDQ กรมสุขภาพจิต',
        'วิธีอ่านผลเปรียบเทียบครูและผู้ปกครอง (Triangulation)',
        'ช่วยเรียบเรียงสรุปการเยี่ยมบ้านนักเรียน'
      ];
    } else if (pathname.includes('/subsidy') || pathname.includes('/free15y')) {
      moduleContextName = 'ระบบเงินอุดหนุนเรียนฟรี 15 ปี & แบบ อร.1/1 (15-Year Free Education Subsidy)';
      moduleContextGuidance = `
ขณะนี้คุณครูกำลังเปิดหน้า: "${moduleContextName}" (เส้นทาง: ${pathname})
เป้าหมายหลักในหน้านี้:
- อัตราเงินอุดหนุนตามประกาศ ศธ./สช.:
  • อนุบาล (อ.1-3): ค่าเครื่องแบบ 325 บ./ปี, ค่าอุปกรณ์ 145 บ./เทอม (290 บ./ปี)
  • ประถม (ป.1-6): ค่าเครื่องแบบ 400 บ./ปี, ค่าอุปกรณ์ 220 บ./เทอม (440 บ./ปี)
- ระบบลงลายมือชื่อดิจิทัล (Digital Signature Canvas) บนแท็บเล็ต/มือถือสำหรับผู้ปกครอง
- การพิมพ์เอกสาร "แบบ อร.1/1 (หลักฐานการจ่ายเงินสด)" ที่มีลายเซ็นจริงพร้อมรับการตรวจสอบจาก สตง. 100%`;
      defaultSuggestions = [
        'อัตราเงินเรียนฟรี 15 ปีแต่ละระดับชั้น',
        'วิธีให้ผู้ปกครองเซ็นรับเงินบนมือถือ',
        'ขั้นตอนเตรียมเอกสาร อร.1/1 รับตรวจ สตง.'
      ];
    } else if (pathname.includes('/safety') || pathname.includes('/van')) {
      moduleContextName = 'ความปลอดภัยรถรับ-ส่งนักเรียน (Child In-Van Safety Alert)';
      moduleContextGuidance = `
ขณะนี้คุณครูกำลังเปิดหน้า: "${moduleContextName}" (เส้นทาง: ${pathname})
เป้าหมายหลักในหน้านี้:
- ตรวจสอบสถานะการขึ้น-ลงรถของนักเรียน (รอขึ้นรถ, อยู่บนรถ, ลงจากรถแล้ว, ขาด)
- ป้องกันเด็กลืมติดในรถตู้ 100% หากมีเด็กยังค้างอยู่ในรถเมื่อถึงปลายทาง ระบบจะส่งเสียงไซเรนฉุกเฉินและขึ้นเตือนสีแดงกะพริบทันที
- เมื่อครูและคนขับรถตรวจค้นรถเรียบร้อย ให้กด "แตะลงจากรถทุกคน" เพื่อปลดล็อกสถานะปลอดภัย`;
      defaultSuggestions = [
        'ขั้นตอนการเช็กชื่อขึ้น-ลงรถตู้',
        'วิธีเปิด/ปิดเสียงไซเรนเตือนภัย',
        'การจัดการกรณีเด็กขาดเรียนไม่ขึ้นรถ'
      ];
    } else if (pathname.includes('/health') || pathname.includes('/infirmary')) {
      moduleContextName = 'ห้องพยาบาล & ระบบเฝ้าระวังโรคระบาด (Infirmary & Outbreak Hub)';
      moduleContextGuidance = `
ขณะนี้คุณครูกำลังเปิดหน้า: "${moduleContextName}" (เส้นทาง: ${pathname})
เป้าหมายหลักในหน้านี้:
- บันทึกการเจ็บป่วยและจ่ายยาในห้องพยาบาล
- Drug Allergy Guard: ระบบตรวจจับประวัติแพ้ยาของนักเรียน หากครูเลือกยาที่ตรงกับประวัติแพ้ ระบบจะบล็อกและเตือนสีแดงทันที
- Outbreak Early-Warning: ระบบตรวจจับคลัสเตอร์โรคติดต่อ (มือ เท้า ปาก, RSV, ไข้หวัดใหญ่) หากพบ >= 3 รายในห้องเดียวกันใน 7 วัน จะแจ้งเตือนระดับสีแดงพร้อมแนวทางปฏิบัติกรมควบคุมโรคทันที`;
      defaultSuggestions = [
        'ตรวจจับคลัสเตอร์โรคมือเท้าปาก/RSV',
        'การแจ้งเตือนแพ้ยานักเรียน (Allergy Guard)',
        'แนวทางปฏิบัติเมื่อพบโรคระบาดในห้องเรียน'
      ];
    } else if (pathname.includes('/governance') || pathname.includes('/esar')) {
      moduleContextName = 'e-SAR Smart Engine & กำกับดูแลโรงเรียน (Governance Hub)';
      moduleContextGuidance = `
ขณะนี้คุณครูกำลังเปิดหน้า: "${moduleContextName}" (เส้นทาง: ${pathname})
เป้าหมายหลักในหน้านี้:
- เล่มประเมินตนเองของสถานศึกษา e-SAR 93 หน้า: สังเคราะห์ข้อมูลผลสัมฤทธิ์ 8 กลุ่มสาระ, โภชนาการ, SDQ และคุณลักษณะอันพึงประสงค์แบบสดตามมาตรฐาน สมศ./สช. 3 มาตรฐาน
- Teacher License Guard (คุรุสภา): ตรวจจับวันหมดอายุใบอนุญาตครู (เตือน 180 วัน, 90 วัน, 30 วัน) และชั่วโมง CPD ป้องกันการถูก สช. ตัดเงินสมทบเงินเดือน
- การประชุมคณะกรรมการบริหารโรงเรียน (ม.30): บันทึกการประชุมอย่างน้อย 4 ครั้ง/ปี พร้อมตรวจสอบองค์ประชุม
- การเงินและบัญชี (ม.32): คำนวณต้นทุนต่อหน่วยนักเรียนต่อคนต่อปี (Unit Cost) และจัดทำสมุดบัญชีมาตรฐาน สช. 5 หมวดเพื่อส่งผู้สอบบัญชี CPA
- หากครูหรือผู้บริหารต้องการทราบจุดเด่น/จุดควรพัฒนา หรือวิธีเตรียมรับการประเมิน สมศ. รอบ 5 ให้น้องฟ้าให้คำแนะนำเชิงกลยุทธ์ได้อย่างชาญฉลาด`;
      defaultSuggestions = [
        'สรุปภาพรวม 3 มาตรฐานในเล่ม e-SAR',
        'ตรวจสอบใบอนุญาตครูที่ใกล้หมดอายุ',
        'วิธีคำนวณต้นทุนต่อหน่วยนักเรียน (ม.32)'
      ];
    } else if (pathname.includes('/admin/students') || pathname.includes('/opec')) {
      moduleContextName = 'ระบบทะเบียนนักเรียน & ข้อมูลส่ง สช. (Student Registry & OPEC REGIS)';
      moduleContextGuidance = `
ขณะนี้คุณครูกำลังเปิดหน้า: "${moduleContextName}" (เส้นทาง: ${pathname})
เป้าหมายหลักในหน้านี้:
- ระบบมีปุ่ม "ส่งออก สช. REGIS (1-Click)" อยู่ด้านบนขวาข้างปุ่มส่งออก CSV
- เมื่อกดปุ่มดังกล่าว ระบบจะเปิดหน้าต่าง "ตรวจสุขภาพข้อมูล สช. (Pre-Flight Audit)" ตรวจสอบ Modulo 11 ของเลข 13 หลัก และแปลงวันเกิดเป็นตัวเลข 8 หลัก "ปปปปดดวว" (พ.ศ.) ให้อัตโนมัติ 100%
- ระบบจัดแยกชีตให้อัตโนมัติเป็น 2 ชีต:
  1) "ข้อมูลนักเรียนไทย" (สำหรับนำเข้าเมนู 2.2.3.1 นักเรียนที่มีเลข 13 หลัก)
  2) "ข้อมูลนักเรียนต่างชาติ (G-CODE)" (สำหรับนำเข้าเมนู 2.2.3.2 นักเรียนต่างชาติ)
- หากครูถามเรื่องการส่งข้อมูล สช. ให้แนะนำขั้นตอนการใช้ปุ่มส่งออก สช. REGIS และวิธีนำไฟล์ไปอัปโหลดบน regis.opec.go.th อย่างเป็นมิตรและแม่นยำ`;
      defaultSuggestions = [
        'วิธีใช้ปุ่มส่งออก สช. REGIS',
        'ตรวจสุขภาพข้อมูลก่อนส่ง สช.',
        'ขั้นตอนนำเข้าไฟล์บน regis.opec.go.th'
      ];
    } else if (pathname.includes('/nutrition')) {
      moduleContextName = 'ศูนย์โภชนาการและเงินอุดหนุน สช. (Nutrition & PSIS Subsidy Hub)';
      moduleContextGuidance = `
ขณะนี้คุณครูกำลังเปิดหน้า: "${moduleContextName}" (เส้นทาง: ${pathname})
เป้าหมายหลักในหน้านี้:
- บันทึกส่วนสูง-น้ำหนักนักเรียนแบบยกห้อง พร้อมคำนวณ BMI และประเมินการเจริญเติบโตกราฟมาตรฐานกรมอนามัย (สมส่วน, ผอม, เตี้ย, อ้วน)
- ระบบคัดกรองเงินอาหารกลางวัน (เด็กอนุบาลได้รับทุกคน + เด็กประถมที่ผอม หรือครอบครัวรายได้ < 40,000 บาท/ปี) ยอดเงิน 5,400 บาท/คน/ปี (27 บ./วัน x 200 วัน)
- การจัดทำคำขอรับเงินอุดหนุนรายบุคคล (แบบ อน.1) ณ วันที่ 10 มิถุนายน
- บันทึกการแจกนมโรงเรียนประจำวัน และเฝ้าระวังเด็กแพ้นมวัว
- หากครูถามเรื่องเกณฑ์อาหารกลางวัน หรือวิธีคำนวณงบ อน.1 ให้สรุปตัวเลขและขั้นตอนการนำส่ง สช. PSIS ได้ทันที`;
      defaultSuggestions = [
        'เด็กคนไหนมีสิทธิ์รับเงินอาหารกลางวันบ้าง',
        'สรุปยอดงบประมาณแบบ อน.1 ของโรงเรียน',
        'เกณฑ์มาตรฐานน้ำหนัก-ส่วนสูงกรมอนามัย'
      ];
    } else if (pathname.includes('/attendance')) {
      moduleContextName = 'ระบบเช็กชื่อเวลาเรียน & ภาวะโภชนาการ (Attendance & Health)';
      moduleContextGuidance = `
ขณะนี้คุณครูกำลังเปิดหน้า: "${moduleContextName}" (เส้นทาง: ${pathname})
เป้าหมายหลักในหน้านี้:
- การบันทึกเวลาเรียนเข้า-ออกโรงเรียน และสรุปยอดนักเรียนมาเรียนประจำวัน
- การคัดกรองภาวะทุพโภชนาการ (น้ำหนัก ส่วนสูง BMI เทียบเกณฑ์กรมอนามัย)
- เกณฑ์การขอรับเงินอุดหนุนอาหารกลางวันจาก สช. / ท้องถิ่น (เกณฑ์ยากจน รายได้ < 40,000 บาท/ปี หรือทุพโภชนาการ)`;
      defaultSuggestions = [
        'เกณฑ์การคัดกรองเด็กรับเงินอาหารกลางวัน',
        'วิธีคำนวณ BMI ตามเกณฑ์กรมอนามัย',
        'สรุปสถิตินักเรียนขาดเรียนสัปดาห์นี้'
      ];
    } else if (pathname.includes('/fees') || pathname.includes('/pos') || pathname.includes('/wallet')) {
      moduleContextName = 'ระบบการเงิน ค่าธรรมเนียม และเรียนฟรี 15 ปี (Finance & Fees)';
      moduleContextGuidance = `
ขณะนี้คุณครูกำลังเปิดหน้า: "${moduleContextName}" (เส้นทาง: ${pathname})
เป้าหมายหลักในหน้านี้:
- การออกใบเสร็จรับเงินค่าธรรมเนียมการศึกษาดิจิทัล
- โครงการเรียนฟรี 15 ปี (หนังสือ อุปกรณ์ เครื่องแบบ กิจกรรมพัฒนาผู้เรียน)
- การจัดทำแบบ อร.1 และ อร.1/1 พร้อมลายเซ็นผู้ปกครองรับเงินอุดหนุน`;
      defaultSuggestions = [
        'ระเบียบการเบิกจ่ายเงินเรียนฟรี 15 ปี',
        'เอกสารแบบ อร.1/1 ต้องเตรียมอะไรบ้าง',
        'ตรวจสอบยอดเงินคงเหลือกระเป๋าเงินนักเรียน'
      ];
    } else if (pathname.includes('/calendar')) {
      moduleContextName = 'ปฏิทินปฏิบัติงานโรงเรียน & บันทึกเวร (School Calendar & Duty)';
      moduleContextGuidance = `
ขณะนี้คุณครูกำลังเปิดหน้า: "${moduleContextName}" (เส้นทาง: ${pathname})
เป้าหมายหลักในหน้านี้:
- สรุปกิจกรรมโรงเรียน วันหยุด และกำหนดการส่งงานสำคัญ
- ตรวจสอบเวรปฏิบัติหน้าที่ประจำวันของคณะครู`;
      defaultSuggestions = [
        'กำหนดการส่งคะแนน ปพ.5 สิ้นภาคเรียน',
        'ตรวจสอบรายชื่อครูเวรวันนี้',
        'วันหยุดและกิจกรรมสำคัญประจำเดือนนี้'
      ];
    }

    // 2. PDPA Redaction
    const { cleanText: sanitizedMessage } = sanitizeTextForAI(message);

    // 3. Construct System Prompt with Knowledge & Rules
    const systemPrompt = `คุณคือ "น้องฟ้า" (Nong Fah) ปัญญาประดิษฐ์อัจฉริยะประจำโรงเรียนสมคิดวิทยา (Somkidvittaya School SV-Portal รหัสสถานศึกษา: 1121100013)
บุคลิกและลักษณะนิสัย:
- เป็นผู้ช่วยอัจฉริยะที่ฉลาดมาก รู้รอบ สุภาพ เรียบร้อย อ่อนน้อม กระตือรือร้น และมีความรับผิดชอบสูง
- สวมแว่นตากลม ถักเปียคู่ผูกโบสีแดง ใส่ชุดยูนิฟอร์มนักเรียนสมคิดวิทยาเสื้อกั๊กสีแดงเข้มและเนกไท
- เรียกแทนตนเองว่า "หนูฟ้า" หรือ "น้องฟ้า" เสมอ และลงท้ายประโยคด้วย "ค่ะ" หรือ "นะคะ" อย่างอ่อนหวาน
- เรียกผู้ใช้งานว่า "คุณครู" หรือ "ท่านผู้บริหาร" ตามความเหมาะสม

กฎเหล็กสำคัญสูงสุด:
1. ห้ามใช้ Emoji หรือ Emoticon ทุกชนิดเด็ดขาด (Strictly ZERO EMOJIS) ไม่ว่าจะเป็นรูปภาพหรือสัญลักษณ์อีโมจิ
2. คุณต้อง "ฉลาดและรู้บริบทหน้าที่คุณครูกำลังเปิดอยู่จริง" (Context-Aware):
${moduleContextGuidance}
3. ทันโลก ทันเหตุการณ์: คุณมีความรอบรู้ข้อมูลข่าวสารการศึกษา นโยบายกระทรวงศึกษาธิการ กฎหมาย PDPA และระเบียบ สช. ล่าสุดของปี 2568-2569
4. ให้คำตอบที่ชัดเจน กระชับ มีขั้นตอนนำไปปฏิบัติได้จริง หากคุณครูถามหรือสั่งงานที่ตรงกับหน้าที่เปิดอยู่ ให้ช่วยแนะนำหรือร่างเนื้อหาให้ทันที
5. ภาษาในการตอบ: ภาษาไทยเป็นหลัก หากมีศัพท์วิชาการภาษาอังกฤษหรือจีนสามารถระบุประกอบได้อย่างถูกต้อง (ชื่อโรงเรียนภาษาจีนคือ Somkidvittaya学校)
6. Action-Oriented Assistance (ช่วยงานจริง ไม่ใช่แค่บอกให้ผู้ใช้ไปทำเอง):
- เมื่อผู้ใช้ถามถึงงานหรือต้องการทำอะไร (เช่น "จะพิมพ์ ปพ.1", "ตัดเกรดยังไง", "ขอดูตารางสอน", "จะทำฟอร์ม", "ขอเบิกเงินเรียนฟรี", "ตรวจรถตู้", "เช็กชื่อเด็ก", "รายงาน สช."):
  นอกจากอธิบายขั้นตอนที่กระชับและชัดเจนแล้ว ให้ใส่ "actionButton" ด้วย URL และข้อความปุ่มที่ตรงกับงาน เพื่อให้ผู้ใช้สามารถกดคลิกเดียวแล้วระบบจะพาไปเปิดหน้านั้นได้ทันที!
  หากเป็นการพูดคุยทักทายทั่วไป ให้ใส่ actionButton เป็น null
  ตัวอย่าง URL ภายในระบบ:
  - ระเบียน ปพ.1/ปพ.2/ปพ.3/ปพ.6: "/academic/documents"
  - ตัดเกรด ปพ.5 / วิชาการ: "/academic/gradebook"
  - ตารางสอน / ครูสอนแทน: "/academic/timetable"
  - คลังข้อสอบ AI / วัดผล: "/academic/exams"
  - สร้างและจัดการแบบฟอร์ม: "/admin/forms"
  - ข้อมูลนักเรียน / สถิติ / สช. REGIS: "/admin/students"
  - โภชนาการ / นมโรงเรียน: "/admin/students/nutrition"
  - เงินอุดหนุนเรียนฟรี 15 ปี (แบบ อร.1/1): "/admin/subsidy/free15y"
  - รถตู้โรงเรียน / ตรวจความปลอดภัย: "/admin/safety/van"
  - ห้องพยาบาล / บันทึกการจ่ายยา: "/admin/health/infirmary"
  - บันทึกเวลาเรียน / เช็กชื่อ: "/attendance"
  - ค่าธรรมเนียม / การเงิน: "/pos/fees"

รูปแบบผลลัพธ์ (Output Format):
ให้ตอบเป็น JSON object ที่ถูกต้องตามโครงสร้างนี้เท่านั้น (ห้ามครอบด้วย markdown backticks หรือคำเกริ่นอื่น):
{
  "reply": "string (ข้อความตอบกลับภาษาไทยอย่างสุภาพ มีเนื้อหาสาระครบถ้วน ห้ามมีอีโมจิเด็ดขาด)",
  "actionType": "chat" | "navigate" | "action_card",
  "actionButton": {
    "label": "string (ข้อความบนปุ่ม 1-คลิก เช่น 'เปิดระบบระเบียน ปพ.1 ทันที', 'ไปที่หน้าตัดเกรด ปพ.5')",
    "url": "string (URL ภายในระบบ เช่น '/academic/documents')",
    "description": "string (คำอธิบายสั้นๆ)"
  } | null,
  "suggestions": [
    "string (ข้อความสั้น 2-4 ข้อความ ให้คุณครูกดถามต่อได้สะดวก)"
  ]
}`;

    // 4. Construct User Prompt including Context and History
    let fullUserPrompt = `[ข้อมูลบริบทผู้ใช้งาน]\n`;
    fullUserPrompt += `- ชื่อผู้ใช้: ${userName} (${userRole})\n`;
    fullUserPrompt += `- หน้าเว็บปัจจุบัน: ${pathname} (${pageTitle || moduleContextName})\n`;
    if (extraInfo && Object.keys(extraInfo).length > 0) {
      fullUserPrompt += `- ข้อมูลประกอบเพิ่มเติม: ${JSON.stringify(extraInfo).slice(0, 500)}\n`;
    }

    if (history.length > 0) {
      fullUserPrompt += `\n[ประวัติการสนทนาก่อนหน้า (ล่าสุด ${Math.min(history.length, 6)} ข้อความ)]:\n`;
      history.slice(-6).forEach((h) => {
        fullUserPrompt += `${h.role === 'user' ? 'คุณครู' : 'น้องฟ้า'}: ${h.content.slice(0, 300)}\n`;
      });
    }

    fullUserPrompt += `\n[ข้อความคำถาม/คำสั่งล่าสุดของคุณครู]:\n"${sanitizedMessage}"\n\nกรุณาตอบเป็น JSON ตามโครงสร้างที่กำหนด`;

    // 5. Call Gemma / Gemini with optimized model chain and JSON response
    const rawAiResponse = await callGemma({
      systemPrompt,
      userPrompt: fullUserPrompt,
      temperature: 0.2,
      maxTokens: 2048,
      responseMimeType: 'application/json',
      enableSearchGrounding: false,
    });

    // 6. Safe Parse JSON
    let parsed: any = null;
    try {
      const cleanJsonStr = rawAiResponse.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      parsed = JSON.parse(cleanJsonStr);
    } catch (parseErr) {
      // Fallback if model returned plain text despite json constraint
      parsed = {
        reply: rawAiResponse.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim(),
        actionType: 'chat',
        actionButton: null,
        suggestions: defaultSuggestions,
      };
    }

    // Clean any accidental emojis
    if (parsed.reply) {
      parsed.reply = parsed.reply.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
    }
    if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
      parsed.suggestions = defaultSuggestions;
    }

    return NextResponse.json({
      success: true,
      data: {
        reply: parsed.reply,
        actionType: parsed.actionType || 'chat',
        actionButton: parsed.actionButton || null,
        suggestions: parsed.suggestions,
        moduleContext: moduleContextName,
        pathname,
      },
    });
  } catch (err: any) {
    console.error('[NongFah Universal API Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'ขออภัยค่ะ ระบบประมวลผลน้องฟ้าขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งนะคะ',
      },
      { status: 500 }
    );
  }
}
