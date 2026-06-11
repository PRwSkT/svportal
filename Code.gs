// ==========================================
// Code.gs — Somkidvittaya School
// Social Post Assistant (ฉบับสมบูรณ์ - อัปเดต API Key และระบบจัดการ Error)
// ==========================================

function doPost(e) {
  try {
    var imagesDataJson = e.parameter.images;
    var mimeType       = e.parameter.mimeType || "image/jpeg";
    var activityInfo   = e.parameter.activityInfo || "";

    var base64ImagesArray = JSON.parse(imagesDataJson);

    var prompt = `
คุณคือผู้เชี่ยวชาญโซเชียลมีเดียและการตลาดของ "โรงเรียนสมคิดวิทยา" (Somkidvittaya School)

ข้อมูลกิจกรรมที่แอดมินกรอกมา:
---
${activityInfo}
---

หน้าที่ของคุณ: วิเคราะห์รูปภาพทั้งหมด คัดเลือกภาพที่ดี และสร้างเนื้อหาโพสต์ตามโครงสร้างที่กำหนด

══════════════════════════════════════════
กฎข้อที่ 1: การคัดกรองรูปภาพ (kept_image_indices)
══════════════════════════════════════════
หลักเกณฑ์การ "เลือกภาพปก" (ตัวแรกของ Array):
  • ภาพคมชัด ไม่เบลอ ไม่สั่น — นี่คือเกณฑ์หลักที่สำคัญที่สุด
  • องค์ประกอบดี มีคนหรือบรรยากาศกิจกรรมชัดเจน
  • แสงสวย ไม่มืดเกิน ไม่สว่างเกิน

หลักเกณฑ์การ "เก็บภาพประกอบ" (ตัวที่ 2 เป็นต้นไป):
  • เก็บภาพที่คมชัดพอใช้ได้ แม้ไม่ดีเท่าปก
  • ตัดทิ้งเฉพาะภาพที่: เบลอมากจนดูไม่ออก / หลับตา / มืดสนิท / ซ้ำกันเกือบ 100% กับภาพอื่น
  • หากไม่แน่ใจให้ "เก็บไว้ก่อน" ดีกว่าตัดทิ้ง
  • ควรเก็บอย่างน้อย 60% ของภาพทั้งหมดที่ส่งมา
  
ตัวอย่าง: ส่งมา 8 รูป → ควรเก็บอย่างน้อย 5 รูป
ตอบกลับเป็น Array index เช่น [2, 0, 4, 1, 5]

══════════════════════════════════════════
กฎข้อที่ 2: cover_headline (ภาษาอังกฤษทั้งหมด)
══════════════════════════════════════════
  • headline: ตัวพิมพ์ใหญ่ทั้งหมด สั้นกระชับ 3-5 คำ อ้างอิงชื่อกิจกรรม
  • subhead: Title Case ขยายความ ไม่เกิน 6 คำ
  • detail: วันที่ภาษาอังกฤษ · สถานที่ เช่น "June 2, 2026 · Somkidvittaya School"

══════════════════════════════════════════
กฎข้อที่ 3: post_caption — เรียงลำดับ อังกฤษ → จีน → ไทย
══════════════════════════════════════════
โครงสร้างแต่ละภาษา:
  1. ชื่อกิจกรรม
  2. บรรทัดเสริม catchy 1 บรรทัด (ใส่ emoji ได้เล็กน้อย)
  3. เนื้อหาหลัก 4-8 บรรทัด (วันที่ จุดเด่น วัตถุประสงค์)
  4. บรรทัดว่าง 1 บรรทัด
  5. ช่องทางติดต่อ (คัดลอกแบบนี้ทุกตัวอักษร):

  -ภาษาอังกฤษ:
  Contact us
  Call (+66) 38 611 251
  Email: mail@somkidvittaya.ac.th
  Website: somkidvittaya.ac.th
  School visit: https://calendar.app.google/HhhN11dAj8r3HehM7

  -ภาษาจีน:
  联系我们
  电话: (+66) 38 611 251
  电子邮箱: mail@somkidvittaya.ac.th
  官方网站: somkidvittaya.ac.th
  预约参观学校: https://calendar.app.google/HhhN11dAj8r3HehM7

  -ภาษาไทย:
  ติดต่อเรา
  โทรศัพท์: (+66) 38 611 251
  อีเมล: mail@somkidvittaya.ac.th
  เว็บไซต์: somkidvittaya.ac.th
  นัดหมายเยี่ยมชมโรงเรียน: https://calendar.app.google/HhhN11dAj8r3HehM7

══════════════════════════════════════════
กฎข้อที่ 4: เส้นคั่นและ Hashtag
══════════════════════════════════════════
  • คั่นระหว่างแต่ละภาษาด้วย: _______________ (15 ขีด) ในบรรทัดต่อจากบรรทัดสุดท้ายทันทีโดยไม่มีบรรทัดว่าง + บรรทัดว่าง 1 บรรทัด
  • หลังจบภาษาไทย: _______________ (15 ขีด)ในบรรทัดต่อจากบรรทัดสุดท้ายทันทีโดยไม่มีบรรทัดว่าง + บรรทัดว่าง + Hashtag
  • Hashtag ที่ต้องมีเสมอ: #Somkidvittaya #SomkidvittayaSchool #โรงเรียนสมคิดวิทยา
  • เพิ่ม hashtag เกี่ยวกับกิจกรรมอีก 3-5 อัน

ข้อกำหนดอื่น:
  • ชื่อโรงเรียน: "โรงเรียนสมคิดวิทยา" / "Somkidvittaya School" / "somkidvittaya学校" เท่านั้น
  • โทนเหมือนโรงเรียนนานาชาติ มืออาชีพ ภาคภูมิใจ
  • ใส่ emoji ได้บ้างเล็กน้อยในส่วน catchy line
`;

    var rawResponse = callGeminiAPI(base64ImagesArray, mimeType, prompt);

    // ดักจับ Error จาก API
    if (rawResponse.error) {
      throw new Error("Google API Error [" + (rawResponse.error.code || "Unknown") + "]: " + rawResponse.error.message);
    }

    if (!rawResponse.candidates || rawResponse.candidates.length === 0) {
      throw new Error("โครงสร้าง API ตอบกลับผิดปกติ: " + JSON.stringify(rawResponse));
    }

    var textResult = rawResponse.candidates[0].content.parts[0].text.trim();
    
    // ลบ markdown fences ออกเพื่อความชัวร์ แม้จะบังคับ responseMimeType แล้วก็ตาม
    textResult = textResult.replace(/```json/gi, "").replace(/```/g, "").trim();

    return ContentService
      .createTextOutput(textResult)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ "error": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// เรียก Gemini API (รองรับหลายรูปภาพ + JSON Schema)
// ==========================================
function callGeminiAPI(base64ImagesArray, mimeType, prompt) {
   var apiKey = "YOUR_API_KEY_HERE"; // ใส่คีย์ของคุณระหว่างเครื่องหมาย " "
   var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" + apiKey;

  var jsonSchema = {
    "type": "OBJECT",
    "properties": {
      "kept_image_indices": {
        "type": "ARRAY",
        "description": "Index ของรูปที่เก็บไว้ รูปแรกต้องเป็นภาพปกที่คมชัดที่สุด",
        "items": { "type": "INTEGER" }
      },
      "cover_headline": {
        "type": "OBJECT",
        "properties": {
          "headline": { "type": "STRING" },
          "subhead":  { "type": "STRING" },
          "detail":   { "type": "STRING" }
        },
        "required": ["headline", "subhead", "detail"]
      },
      "post_caption": { "type": "STRING" }
    },
    "required": ["kept_image_indices", "cover_headline", "post_caption"]
  };

  var partsArray = [{ "text": prompt }];
  for (var i = 0; i < base64ImagesArray.length; i++) {
    partsArray.push({
      "inline_data": { "mime_type": mimeType, "data": base64ImagesArray[i] }
    });
  }

  var payload = {
    "contents": [{ "parts": partsArray }],
    "generationConfig": {
      "responseMimeType": "application/json",
      "responseSchema": jsonSchema
    }
  };

  var options = { 
    "method": "post", 
    "contentType": "application/json",
    "payload": JSON.stringify(payload), 
    "muteHttpExceptions": true // ดัก Error จาก Google
  };

  var response = UrlFetchApp.fetch(url, options);
  var responseText = response.getContentText();
  
  try {
    return JSON.parse(responseText);
  } catch (e) {
    return { "error": { "message": "JSON Parse Error จากฝั่งเซิร์ฟเวอร์ Google: " + responseText } };
  }
}
