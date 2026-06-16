const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// -------------------------------------------------------------
// ตั้งค่า Supabase URL และ Key (แก้ไขถ้าไม่ได้ใส่ใน .env.local)
// -------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
  console.error("❌ กรุณาตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env.local ก่อนครับ!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// -------------------------------------------------------------
// ฟังก์ชันแปลงวันที่ไทย (เช่น "17 ต.ค. 2565" -> "2022-10-17")
// -------------------------------------------------------------
const thaiMonths = {
  'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
  'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
  'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12'
};

function parseThaiDate(thaiDateStr) {
  if (!thaiDateStr) return null;
  const parts = thaiDateStr.trim().split(/\s+/);
  if (parts.length >= 3) {
    let day = parts[0];
    if (day.length === 1) day = '0' + day;
    const month = thaiMonths[parts[1]];
    const year = parseInt(parts[2], 10) - 543;
    if (month && !isNaN(year)) {
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

// แยกคำนำหน้าชื่อออกจากชื่อเต็ม
function extractPrefixAndName(fullName) {
    if (!fullName) return { prefix: null, first_name: null, last_name: null };
    let prefix = null;
    const knownPrefixes = ['เด็กชาย', 'เด็กหญิง', 'นาย', 'นางสาว', 'นาง'];
    
    for (const p of knownPrefixes) {
        if (fullName.startsWith(p)) {
            prefix = p;
            fullName = fullName.substring(p.length).trim();
            break;
        }
    }

    const parts = fullName.split(/\s+/);
    const first_name = parts[0] || null;
    const last_name = parts.slice(1).join(' ') || null;
    
    return { prefix, first_name, last_name };
}

function parseFloatSafe(val) {
    if (!val) return null;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
}

async function seed() {
  console.log("🚀 กำลังเตรียมข้อมูล...");
  const rawData = JSON.parse(fs.readFileSync('students_data.json', 'utf8'));

  const students = [];
  const addresses = [];
  const parents = [];

  for (const item of rawData) {
    const studentCode = item['เลขประจำตัวนักเรียน'];
    if (!studentCode) continue;

    // 1. จัดเตรียมข้อมูล Student
    const { prefix, first_name, last_name } = extractPrefixAndName(item['ชื่อ - นามสกุล']);
    students.push({
      id: studentCode, // ให้ id คือเลขประจำตัวเลย จะได้เชื่อมโยงง่าย
      name: item['ชื่อ - นามสกุล'] || '', // Legacy support
      grade: item['ชั้นเรียน'] || '', // Legacy support
      prefix,
      first_name,
      last_name,
      class_level: item['ชั้นเรียน'],
      birth_date: parseThaiDate(item['วันเกิด']),
      gender: item['เพศ'],
      nationality: item['สัญชาติ'],
      religion: item['ศาสนา'],
      height: parseFloatSafe(item['ความสูง (ซม.)']),
      weight: parseFloatSafe(item['น้ำหนัก (กก.)']),
      disability: item['ประเภทความพิการ'] || null,
      enrolled_date: parseThaiDate(item['วันที่เข้าเรียน']),
      status: item['สถานะนักเรียน'] || 'กำลังศึกษาอยู่',
    });

    // 2. จัดเตรียมข้อมูลที่อยู่
    addresses.push({
      student_id: studentCode,
      house_code: item['รหัสประจำบ้าน'] || null,
      house_number: item['บ้านเลขที่'] || null,
      moo: item['หมู่ที่'] || null,
      soi: item['ซอย'] || null,
      road: item['ถนน'] || null,
      sub_district: item['ตำบล'] || null,
      district: item['อำเภอ'] || null,
      province: item['จังหวัด'] || null,
      zip_code: item['รหัสไปรษณีย์'] || null,
    });

    // 3. จัดเตรียมข้อมูลครอบครัว (บิดา, มารดา, ผู้ปกครอง)
    const familyTypes = [
        { type: 'บิดา', rel: 'บิดา' },
        { type: 'มารดา', rel: 'มารดา' },
        { type: 'ผู้ปกครอง', rel: 'ผู้ปกครอง' }
    ];

    for (const f of familyTypes) {
        if (item[`[${f.type}] ชื่อ`] || item[`[${f.type}] นามสกุล`]) {
            let pPrefix = item[`[${f.type}] คำนำหน้าชื่อ`] || null;
            let pFirst = item[`[${f.type}] ชื่อ`] || null;
            let pLast = item[`[${f.type}] นามสกุล`] || null;
            let pCitizenId = item[`[${f.type}] เลขประจำตัวประชาชน`] || null;
            let pOccup = item[`[${f.type}] อาชีพของ${f.type}`] || item[`[${f.type}] อาชีพของผู้ปกครอง`] || null;
            let pSalary = item[`[${f.type}] เงินเดือน(ต่อเดือน)`] || null;
            let pPhone = item[`[${f.type}] เบอร์โทรศัพท์`] || null;
            let pStatus = item[`[${f.type}] สถานภาพของ${f.type}`] || null;
            
            // กรณีผู้ปกครอง ถ้าไม่ได้ระบุชื่อ-นามสกุลแยก แต่มีในฐานะผู้ติดต่อ
            if (!pFirst && f.type === 'ผู้ปกครอง' && item['ชื่อผู้ปกครอง']) {
                const parts = extractPrefixAndName(item['ชื่อผู้ปกครอง']);
                pPrefix = parts.prefix;
                pFirst = parts.first_name;
                pLast = parts.last_name;
            }

            parents.push({
                student_id: studentCode,
                relationship: item[`[${f.type}] ความสัมพันธ์`] || f.rel,
                citizen_id: pCitizenId,
                prefix: pPrefix,
                first_name: pFirst,
                last_name: pLast,
                occupation: pOccup,
                salary: pSalary,
                phone_number: pPhone,
                status: pStatus
            });
        }
    }
  }

  console.log(`เตรียมข้อมูลเสร็จสิ้น: นักเรียน ${students.length} คน, ที่อยู่ ${addresses.length} รายการ, ครอบครัว ${parents.length} คน`);

  // --- ยิงเข้าฐานข้อมูล ---
  console.log("กำลัง Insert ข้อมูลลง Supabase...");
  
  // ใช้ upsert เพื่อไม่ให้เกิด Error กรณีรันซ้ำ
  const { error: err1 } = await supabase.from('students').upsert(students, { onConflict: 'id' });
  if (err1) console.error("❌ Error students:", err1.message);
  else console.log("✅ Insert Students สำเร็จ");

  const { error: err2 } = await supabase.from('student_addresses').insert(addresses);
  if (err2) console.error("❌ Error student_addresses:", err2.message);
  else console.log("✅ Insert Addresses สำเร็จ");

  const { error: err3 } = await supabase.from('student_parents').insert(parents);
  if (err3) console.error("❌ Error student_parents:", err3.message);
  else console.log("✅ Insert Parents สำเร็จ");

  console.log("🎉 กระบวนการเสร็จสมบูรณ์!");
}

seed().catch(console.error);
