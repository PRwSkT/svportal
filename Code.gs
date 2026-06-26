// ==========================================
// Code.gs — Somkidvittaya School
// Social Post Assistant (ฉบับสมบูรณ์ - อัปเดต API Key และระบบจัดการ Error)
// ==========================================

function doPost(e) {
  try {
    var params = e.parameter || {};
    if (e.postData && e.postData.contents) {
      try {
        var parsed = JSON.parse(e.postData.contents);
        params = Object.assign({}, params, parsed);
      } catch(err) {}
    }
    var action = params.action;
    if (action === 'publishToSocial') {
      return handlePublishToSocial(params);
    }
    if (action === 'translateCaption') {
      return handleTranslateCaption(params);
    }
    // === Video Multi-Step Endpoints ===
    if (action === 'videoStepFB')    return handleVideoStepFB(params);
    if (action === 'videoStepIG')    return handleVideoStepIG(params);
    if (action === 'videoCheckIG')   return handleVideoCheckIG(params);
    if (action === 'videoPublishIG') return handleVideoPublishIG(params);

    var imagesDataJson = params.images;
    var mimeType       = params.mimeType || "image/jpeg";
    var activityInfo   = params.activityInfo || "";

    var base64ImagesArray = JSON.parse(imagesDataJson || "[]");
    var mediaMode = params.mediaMode || 'photo';

    var prompt = `
คุณคือผู้เชี่ยวชาญโซเชียลมีเดียและการตลาดของ "โรงเรียนสมคิดวิทยา" (Somkidvittaya School)

ข้อมูลกิจกรรมที่แอดมินกรอกมา:
---
${activityInfo}
---
`;

    if (mediaMode === 'photo') {
        prompt += `
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
`;
    } else {
        prompt += `
หน้าที่ของคุณ: สร้างเนื้อหาแคปชั่นสำหรับ "วิดีโอ (Reels/TikTok)" ตามโครงสร้างที่กำหนด โดยไม่ต้องวิเคราะห์รูปภาพ
`;
    }

    prompt += `
══════════════════════════════════════════
กฎข้อที่ ${mediaMode === 'photo' ? '3' : '1'}: post_caption — เรียงลำดับ อังกฤษ → จีน → ไทย
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
  • ห้ามเว้นบรรทัดว่างก่อนเส้นคั่นเด็ดขาด (พิมพ์เส้นคั่น _______________ 15 ขีด ติดกับบรรทัดก่อนหน้าเลย)
  • คั่นระหว่างแต่ละภาษาด้วย: _______________ (15 ขีด) ติดบรรทัดบนสุด แล้วค่อยตามด้วยบรรทัดว่าง 1 บรรทัดด้านล่างเส้นคั่น
  • หลังจบภาษาไทย: _______________ (15 ขีด) ติดบรรทัดบนสุด แล้วค่อยตามด้วยบรรทัดว่าง 1 บรรทัดด้านล่าง + Hashtag
  • Hashtag ที่ต้องมีเสมอ: #Somkidvittaya #SomkidvittayaSchool #โรงเรียนสมคิดวิทยา
  • เพิ่ม hashtag เกี่ยวกับกิจกรรมอีก 3-5 อัน

ข้อกำหนดอื่น:
  • ชื่อโรงเรียน: "โรงเรียนสมคิดวิทยา" / "Somkidvittaya School" / "somkidvittaya学校" เท่านั้น
  • โทนเหมือนโรงเรียนนานาชาติ มืออาชีพ ภาคภูมิใจ
  • ใส่ emoji ได้บ้างเล็กน้อยในส่วน catchy line

══════════════════════════════════════════
รูปแบบผลลัพธ์ (JSON เท่านั้น):
══════════════════════════════════════════
ตอบกลับมาเป็น JSON ตาม format ด้านล่างนี้ โดยไม่ต้องมีคำอธิบายอื่น:
{`;
    if (mediaMode === 'photo') {
        prompt += `
  "kept_image_indices": [0, 1, 2],
  "cover_headline": {
    "headline": "EXAMPLE HEADLINE",
    "subhead": "Example Subhead Text",
    "detail": "June 2, 2026 · Somkidvittaya School"
  },`;
    }
    prompt += `
  "post_caption": {
    "english": "English caption...",
    "chinese": "Chinese caption...",
    "thai": "Thai caption..."
  }
}
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
// Publish to Social Media (Meta Graph API Framework)
// ==========================================
function handlePublishToSocial(params) {
  var mediaMode = params.mediaMode || "photo";
  var fbCaption = params.fbCaption || "";
  var igCaption = params.igCaption || "";
  
  // ข้อมูล Meta Graph API ของคุณ
  var PAGE_ACCESS_TOKEN = "EAAYA0g05EhoBRkw8us77ykfLJI1V5p0c6RCS1BUKvDv5Uzj0uHysQALJm9iATqlNjFNSCzakf3EfCM5ktVahwnheASgGjNNm2RSg3DeQJZCic0rK43W8fdmbzxPJZBfdk8HZCa5serZBMk2OUosKJj2EZBvwPmFzDbs4uJoffPMHRZAzTT8dJTtss3Qm3KenEpidsZD";
  var PAGE_ID = "192831060756593";
  var IG_ACCOUNT_ID = "17841446069053774";
  
  try {
    if (mediaMode === "video") {
      // Video mode ใช้ multi-step endpoints แทน (videoStepFB, videoStepIG, etc.)
      throw new Error("Video mode ให้ใช้ multi-step endpoints แทน");

    } else {
      // ==========================================
      // PHOTO POSTING LOGIC
      // ==========================================
      var fbImages = JSON.parse(params.fbImages || "[]");
      var igImages = JSON.parse(params.igImages || "[]");

      // 1. FACEBOOK POSTING
      var fbMediaIds = [];
      if (fbImages.length > 0) {
        for (var i = 0; i < fbImages.length; i++) {
          var b64Data = fbImages[i].indexOf(",") !== -1 ? fbImages[i].split(",")[1] : fbImages[i];
          var blob = Utilities.newBlob(Utilities.base64Decode(b64Data), 'image/jpeg', 'fb_img_' + i + '.jpg');
          
          var fbUploadUrl = "https://graph.facebook.com/v20.0/" + PAGE_ID + "/photos";
          var fbUploadPayload = {
            "access_token": PAGE_ACCESS_TOKEN,
            "published": "false",
            "source": blob
          };
          var fbUploadRes = UrlFetchApp.fetch(fbUploadUrl, {
            "method": "post",
            "payload": fbUploadPayload,
            "muteHttpExceptions": true
          });
          var fbUploadData = JSON.parse(fbUploadRes.getContentText());
          
          if (fbUploadData.error) {
            throw new Error("Facebook Upload Error: " + fbUploadData.error.message);
          }
          fbMediaIds.push(fbUploadData.id);
        }
        
        // สร้างโพสต์รวม Facebook
        var fbPostUrl = "https://graph.facebook.com/v20.0/" + PAGE_ID + "/feed";
        var fbPostPayload = {
          "access_token": PAGE_ACCESS_TOKEN,
          "message": fbCaption
        };
      
        // แนบรูปภาพทั้งหมดที่อัปโหลดไว้โดยมัดรวมเป็น Array (บังคับ Facebook เรียงภาพเป๊ะๆ)
        var attachedMediaArr = [];
        for (var j = 0; j < fbMediaIds.length; j++) {
          attachedMediaArr.push({"media_fbid": fbMediaIds[j]});
        }
        fbPostPayload["attached_media"] = JSON.stringify(attachedMediaArr);
        
        var fbPostRes = UrlFetchApp.fetch(fbPostUrl, {
          "method": "post",
          "payload": fbPostPayload,
          "muteHttpExceptions": true
        });
        var fbPostData = JSON.parse(fbPostRes.getContentText());
        if (fbPostData.error) {
          throw new Error("Facebook Publish Error: " + fbPostData.error.message);
        }
      }

      // 2. INSTAGRAM POSTING
      var driveFiles = [];
      var igContainerIds = [];
      
      if (igImages.length > 0) {
        try {
          for (var k = 0; k < igImages.length; k++) {
            var igB64Data = igImages[k].indexOf(",") !== -1 ? igImages[k].split(",")[1] : igImages[k];
            var igBlob = Utilities.newBlob(Utilities.base64Decode(igB64Data), 'image/jpeg', 'ig_temp_' + k + '.jpg');
            
            var file = DriveApp.createFile(igBlob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            driveFiles.push(file);
            
            var imageUrl = "https://drive.google.com/uc?export=download&id=" + file.getId();
            
            var igItemUrl = "https://graph.facebook.com/v20.0/" + IG_ACCOUNT_ID + "/media";
            var igItemPayload = {
              "access_token": PAGE_ACCESS_TOKEN,
              "image_url": imageUrl,
              "is_carousel_item": "true"
            };
            var igItemRes = UrlFetchApp.fetch(igItemUrl, {
              "method": "post",
              "payload": igItemPayload,
              "muteHttpExceptions": true
            });
            var igItemData = JSON.parse(igItemRes.getContentText());
            
            if (igItemData.error) {
              throw new Error("IG Upload Error: " + igItemData.error.message);
            }
            igContainerIds.push(igItemData.id);
          }
          
          var igCarouselUrl = "https://graph.facebook.com/v20.0/" + IG_ACCOUNT_ID + "/media";
          var igCarouselPayload = {
            "access_token": PAGE_ACCESS_TOKEN,
            "media_type": "CAROUSEL",
            "children": igContainerIds.join(","),
            "caption": igCaption
          };
          var igCarouselRes = UrlFetchApp.fetch(igCarouselUrl, {
            "method": "post",
            "payload": igCarouselPayload,
            "muteHttpExceptions": true
          });
          var igCarouselData = JSON.parse(igCarouselRes.getContentText());
          
          if (igCarouselData.error) {
            throw new Error("IG Carousel Container Error: " + igCarouselData.error.message);
          }
          
          Utilities.sleep(2000);
          
          var igPublishUrl = "https://graph.facebook.com/v20.0/" + IG_ACCOUNT_ID + "/media_publish";
          var igPublishPayload = {
            "access_token": PAGE_ACCESS_TOKEN,
            "creation_id": igCarouselData.id
          };
          var igPublishRes = UrlFetchApp.fetch(igPublishUrl, {
            "method": "post",
            "payload": igPublishPayload,
            "muteHttpExceptions": true
          });
          var igPublishData = JSON.parse(igPublishRes.getContentText());
          
          if (igPublishData.error) {
            throw new Error("IG Publish Error: " + igPublishData.error.message);
          }

        } finally {
          for (var f = 0; f < driveFiles.length; f++) {
            try { driveFiles[f].setTrashed(true); } catch(e) {}
          }
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "โพสต์สำเร็จเรียบร้อยแล้ว!"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// เรียก Gemini API (รองรับหลายรูปภาพ + JSON Schema)
// ==========================================
function callGeminiAPI(base64ImagesArray, mimeType, prompt) {
   var apiKey = "YOUR_GEMINI_API_KEY"; // ใส่คีย์ของคุณระหว่างเครื่องหมาย " "
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

// ==========================================
// แปลภาษาแคปชั่นอัตโนมัติจากภาษาไทย
// ==========================================
function handleTranslateCaption(params) {
  var thaiCaption = params.thaiCaption || "";
  if (!thaiCaption) {
    return ContentService.createTextOutput(JSON.stringify({error: "No Thai caption provided"})).setMimeType(ContentService.MimeType.JSON);
  }

  var apiKey = "YOUR_GEMINI_API_KEY"; // ใส่คีย์ของคุณระหว่างเครื่องหมาย " "
  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" + apiKey;

  var jsonSchema = {
    "type": "OBJECT",
    "properties": {
      "english": { "type": "STRING", "description": "แปลเป็นภาษาอังกฤษล้วน สไตล์มืออาชีพ กระตือรือร้น แบบอินเตอร์ และคงการจัดตำแหน่งทุกอย่างให้เหมือนเดิม" },
      "chinese": { "type": "STRING", "description": "แปลเป็นภาษาจีนล้วน สไตล์มืออาชีพ กระตือรือร้น แบบอินเตอร์ และคงการจัดตำแหน่งทุกอย่างให้เหมือนเดิม" }
    },
    "required": ["english", "chinese"]
  };

  var prompt = "Translate the following Thai social media caption into English and Chinese. Maintain the friendly, professional, and enthusiastic tone of an international school. Do not include hashtags or contact information, just translate the text provided.\n\nThai Caption:\n" + thaiCaption;

  var payload = {
    "contents": [
      {
        "role": "user",
        "parts": [{ "text": prompt }]
      }
    ],
    "generationConfig": {
      "responseMimeType": "application/json",
      "responseSchema": jsonSchema
    }
  };

  var options = { 
    "method": "post", 
    "contentType": "application/json",
    "payload": JSON.stringify(payload), 
    "muteHttpExceptions": true
  };

  var response = UrlFetchApp.fetch(url, options);
  var responseText = response.getContentText();
  
  try {
    var data = JSON.parse(responseText);
    // Return the successfully generated content directly
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      return ContentService.createTextOutput(data.candidates[0].content.parts[0].text).setMimeType(ContentService.MimeType.JSON);
    } else if (data.error && data.error.message) {
      return ContentService.createTextOutput(JSON.stringify({error: {message: "Gemini API Error: " + data.error.message, raw: data}})).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({error: {message: "Unexpected response format from Gemini", raw: data}})).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({error: {message: "JSON Parse error from Gemini", raw: responseText}})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// Helper: Meta API Config
// ==========================================
function getMetaConfig_() {
  return {
    token: "EAAYA0g05EhoBRkw8us77ykfLJI1V5p0c6RCS1BUKvDv5Uzj0uHysQALJm9iATqlNjFNSCzakf3EfCM5ktVahwnheASgGjNNm2RSg3DeQJZCic0rK43W8fdmbzxPJZBfdk8HZCa5serZBMk2OUosKJj2EZBvwPmFzDbs4uJoffPMHRZAzTT8dJTtss3Qm3KenEpidsZD",
    pageId: "192831060756593",
    igId: "17841446069053774"
  };
}

// ==========================================
// VIDEO STEP: Facebook Upload
// step=start: เริ่ม session (รับ session_id)
// step=transfer: รับ chunkBase64 แล้วส่งไป FB
// step=finish: จบ session
// ==========================================
function handleVideoStepFB(params) {
  var c = getMetaConfig_();
  var step = params.step || "start";
  try {
    if (step === "start") {
      var res = UrlFetchApp.fetch("https://graph-video.facebook.com/v20.0/" + c.pageId + "/videos", {
        method: "post",
        payload: { "access_token": c.token, "upload_phase": "start", "file_size": params.fileSize },
        muteHttpExceptions: true
      });
      var d = JSON.parse(res.getContentText());
      if (d.error) throw new Error(d.error.message);
      return ContentService.createTextOutput(JSON.stringify({
        sessionId: d.upload_session_id, startOffset: d.start_offset, endOffset: d.end_offset
      })).setMimeType(ContentService.MimeType.JSON);
    }
    if (step === "transfer") {
      var off = params.startOffset;
      var base64Data = params.chunkBase64;
      var bytes = Utilities.base64Decode(base64Data);
      var chunkBlob = Utilities.newBlob(bytes, "video/mp4", "chunk.mp4");

      var res = UrlFetchApp.fetch("https://graph-video.facebook.com/v20.0/" + c.pageId + "/videos", {
        method: "post",
        payload: {
          "access_token": c.token, "upload_phase": "transfer",
          "upload_session_id": params.sessionId,
          "start_offset": off, "video_file_chunk": chunkBlob
        },
        muteHttpExceptions: true
      });
      var d = JSON.parse(res.getContentText());
      if (d.error) throw new Error(d.error.message);
      return ContentService.createTextOutput(JSON.stringify({
        startOffset: d.start_offset, endOffset: d.end_offset
      })).setMimeType(ContentService.MimeType.JSON);
    }
    if (step === "finish") {
      var res = UrlFetchApp.fetch("https://graph-video.facebook.com/v20.0/" + c.pageId + "/videos", {
        method: "post",
        payload: {
          "access_token": c.token, "upload_phase": "finish",
          "upload_session_id": params.sessionId, "description": params.fbCaption || ""
        },
        muteHttpExceptions: true
      });
      var d = JSON.parse(res.getContentText());
      if (d.error) throw new Error(d.error.message);
      return ContentService.createTextOutput(JSON.stringify({success:true})).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// VIDEO STEP: Instagram Reel Upload (Resumable)
// step=create: สร้าง container รับ uploadUri
// step=transfer: รับ chunkBase64 แล้วส่งไป uploadUri
// ==========================================
function handleVideoStepIG(params) {
  var c = getMetaConfig_();
  var step = params.step || "create";
  try {
    if (step === "create") {
      var res = UrlFetchApp.fetch("https://graph.facebook.com/v20.0/" + c.igId + "/media", {
        method: "post",
        payload: { "access_token": c.token, "media_type": "REELS", "upload_type": "resumable", "caption": params.igCaption || "" },
        muteHttpExceptions: true
      });
      var d = JSON.parse(res.getContentText());
      if (d.error) throw new Error(d.error.message);
      return ContentService.createTextOutput(JSON.stringify({containerId: d.id, uploadUri: d.uri})).setMimeType(ContentService.MimeType.JSON);
    }
    if (step === "transfer") {
      var offset = params.offset;
      var fileSize = params.fileSize;
      
      var base64Data = params.chunkBase64;
      var bytes = Utilities.base64Decode(base64Data);
      var chunkBlob = Utilities.newBlob(bytes, "application/octet-stream", "chunk.mp4");

      UrlFetchApp.fetch(params.uploadUri, {
        method: "post",
        headers: { "Authorization": "OAuth " + c.token, "offset": offset, "file_size": fileSize },
        contentType: "application/octet-stream", payload: chunkBlob, muteHttpExceptions: true
      });
      var nextOff = parseInt(offset) + bytes.length;
      return ContentService.createTextOutput(JSON.stringify({nextOffset: nextOff, done: nextOff >= parseInt(fileSize)})).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// VIDEO STEP: Check IG Reel Status
// ==========================================
function handleVideoCheckIG(params) {
  var c = getMetaConfig_();
  try {
    var res = UrlFetchApp.fetch("https://graph.facebook.com/v20.0/" + params.containerId + "?fields=status_code&access_token=" + c.token, {muteHttpExceptions:true});
    var d = JSON.parse(res.getContentText());
    return ContentService.createTextOutput(JSON.stringify({status: d.status_code || "IN_PROGRESS"})).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// VIDEO STEP: Publish IG Reel
// ==========================================
function handleVideoPublishIG(params) {
  var c = getMetaConfig_();
  try {
    var res = UrlFetchApp.fetch("https://graph.facebook.com/v20.0/" + c.igId + "/media_publish", {
      method: "post",
      payload: { "access_token": c.token, "creation_id": params.containerId },
      muteHttpExceptions: true
    });
    var d = JSON.parse(res.getContentText());
    if (d.error) throw new Error(d.error.message);
    return ContentService.createTextOutput(JSON.stringify({success:true})).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}
