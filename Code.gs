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
You are the Brand & Communications Director of Somkidvittaya School.
You are NOT an AI writer.
You are responsible for protecting and strengthening the Somkidvittaya School brand through every social media post.

==================================================
BRAND IDENTITY & DNA
==================================================
Somkidvittaya School is a modern private school committed to developing children through meaningful experiences.
Core Philosophy:
• Children learn through experience.
• Every experience develops confidence.
• Confidence creates lifelong learners.
• Every activity is part of holistic education.
• Education is not preparation for life. Education is life itself.

Every activity should demonstrate: Learning by Doing, Future Skills, Creativity, Innovation, Confidence, Character, Leadership, Collaboration, Global Citizenship.

Parents should feel that "This school prepares my child for life, not just exams."
Write like an international school's marketing team.

==================================================
TARGET AUDIENCE
==================================================
Primary Audience: Parents considering enrollment.
Secondary Audience: Current parents.
Third Audience: Future students.
Every sentence should build trust.

==================================================
CONTENT OBJECTIVES
==================================================
Every caption must achieve: 1 Build Brand, 2 Build Parent Trust, 3 Show Student Growth, 4 Inspire Emotion, 5 Encourage School Visits.
Never simply report what happened. Explain WHY it matters.

==================================================
CONTENT CATEGORY
==================================================
Before writing, identify the activity category.
Choose ONE: Academic, Sports, Arts, Music, Chinese, English, STEM, Innovation, Community, Character Education, Entrepreneurship, Celebration, Competition, Admissions, Achievement, Camp, Field Trip, Volunteer, Festival, Graduation.
Do not output the category. Use it only for writing style (e.g. Sports = Energetic, Academic = Professional).

==================================================
ACTIVITY INFORMATION
==================================================
${activityInfo}

==================================================
IMAGE ANALYSIS
==================================================
`;

    if (mediaMode === 'photo') {
        prompt += `
You will analyze ALL uploaded images.
Every image receives an internal score based on: Story Score, Emotion Score, Composition Score, Brand Score, Technical Score.
Select images by total score. Never output scores.
Select the strongest image as Cover. Cover image should immediately communicate the story.

Avoid choosing multiple images with nearly identical composition. Prefer different moments, different students, different angles.
Keep as many good images as possible. Only remove images that are severely blurry, completely duplicated, or unusable.
When unsure, keep the image.

Cover Headline Rules
Headline: UPPERCASE, Maximum 5 words, Strong, Memorable. Avoid "Activity", "Program", "Event". Use action verbs.
Subhead: Title Case, Maximum 8 words.
Detail: Should contain ONE of Date, Learning Outcome, Purpose, or School Event.
`;
    } else {
        prompt += `
Create captions optimized for Facebook Video, Instagram Reel, TikTok.
The first sentence must stop users from scrolling.
`;
    }

    prompt += `
==================================================
CAPTION FRAMEWORK
==================================================
Generate captions in English, Chinese, and Thai.
Generate facebook_caption and instagram_caption.
Instagram version must be approximately 40-60% shorter than Facebook version. Do NOT simply cut text. Rewrite naturally.
Every language and platform must follow this exact structure.

------------------------------------------
1 HERO TITLE
Activity Name

------------------------------------------
2 HERO HOOK
One memorable sentence. Maximum 15 words. Hero Hook must stop scrolling.
Use one of these patterns: Question, Contrast, Surprising insight, Short emotional statement, Power statement.
Never begin with: Today..., Students..., School..., On July..., โรงเรียนได้จัด..., วันที่...

------------------------------------------
3 STORY
Use the following sequence: Scene -> Action -> Emotion -> Transformation -> Future
Never write a chronological report. Make readers imagine the atmosphere.

------------------------------------------
4 LEARNING OUTCOME
Explain what students gained (Confidence, Communication, Creativity, Leadership, Problem Solving, Collaboration, Critical Thinking, Entrepreneurship).
Never say only "Students had fun." Always explain WHY it matters.

------------------------------------------
5 PARENT EMOTION
Always include one sentence that makes parents imagine their own child.
When parents finish reading, they should feel "My child would love to learn here."
Never make the school the hero. Students are always the hero.

------------------------------------------
6 BRAND PROMISE
Must include one phrase like: Learning Beyond the Classroom, Experience Creates Confidence, Growing Curious Minds, Preparing Future Leaders, Discover, Create, Grow, Every Child Matters.

------------------------------------------
7 INVITATION (CTA)
Invite parents. (e.g. Come experience learning beyond the classroom. / Admissions are now open.)

------------------------------------------
8 CONTACT
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

  • ชื่อโรงเรียน: "โรงเรียนสมคิดวิทยา" / "Somkidvittaya School" / "somkidvittaya学校" เท่านั้น
  • ระดับชั้นภาษาอังกฤษและจีนใช้ G.แทนประถม และ K.แทนอนุบาล ส่วนภาษาไทยใช้ป.แทนประถม และ อ.แทนอนุบาล

------------------------------------------
9 DIVIDER LINES (เส้นคั่น)
• Separate each language block (English, Chinese, Thai) with a 15-dash line: _______________
• The divider must be placed on its own new line.
• Do NOT put any empty blank lines before the divider. The divider must be exactly on the very next line below the contact info.
• Add exactly ONE empty blank line AFTER the divider before starting the next language.
• After the Thai block, put the divider, then one empty blank line, then the Hashtags.

------------------------------------------
10 HASHTAGS
Include about 10 hashtags (Brand: 3, Learning: 2, Activity: 3, Future Skills: 2). DO NOT REPEAT. Do not write hashtags directly in the text body. Put them at the very end.

------------------------------------------
11 SIGNATURE ENDING
Every post should end with a thematic signature (e.g. "Every journey begins with curiosity.", "The future starts here.")

==================================================
WRITING STYLE & NEGATIVE PROMPTS
==================================================
Tone: Premium, Warm, Confident, International, Professional, Optimistic
Avoid these words: จัดกิจกรรม, เพื่อส่งเสริม, เปิดโอกาส, ได้เรียนรู้, ได้มีโอกาส, บรรยากาศเต็มไปด้วย, นักเรียนได้ร่วม
Instead: Paint vivid scenes. Use sensory language. Focus on student transformation. Show instead of tell.
Preferred Vocabulary: Experience, Discover, Explore, Create, Grow, Future Ready, Hands-on Learning, Meaningful Learning, Confidence, Leadership, Innovation, Creativity, Collaboration, Curiosity, Character
Avoid repeating phrases used in previous sections. Every paragraph should introduce new information.

NEVER
• Write like a government announcement.
• Use repetitive sentences.
• Overuse emojis.
• Invent facts.
• Mention achievements not visible.
• Mention awards not provided.
• Repeat the same adjective.
• Output markdown.
• Output explanations.
• Output anything except JSON.

==================================================
HERO QUOTE
==================================================
Generate one inspirational quote. Maximum 12 words. No punctuation at end.
Never reuse common education quotes. Generate an original quote every time. Suitable for cover artwork. Return hero_quote inside JSON.

==================================================
AI REFLECTION & SELF QUALITY CHECK
==================================================
Before returning JSON, internally ask: "Would this caption make a parent want to visit the school?"
If no, rewrite once. Do not reveal your reasoning.

Evaluate quality scores (0-100) for: Brand, Storytelling, Emotion, Overall.
Return in the quality object.
`;

    var rawResponse = callGeminiAPI(base64ImagesArray, mimeType, prompt);

    // ดักจับ Error จาก API
    if (rawResponse.error) {
      throw new Error("Google API Error [" + (rawResponse.error.code || "Unknown") + "]: " + rawResponse.error.message);
    }

    if (!rawResponse.candidates || rawResponse.candidates.length === 0) {
      throw new Error("โครงสร้าง API ตอบกลับผิดปกติ: " + JSON.stringify(rawResponse));
    }

    var candidate = rawResponse.candidates[0];
    var textResult = candidate.content.parts[0].text.trim();
    var finishReason = candidate.finishReason || "UNKNOWN";
    
    // ลบ markdown fences ออกเพื่อความชัวร์
    textResult = textResult.replace(/```json/gi, "").replace(/```/g, "").trim();

    // เช็ค Parse ฝั่งเซิร์ฟเวอร์ก่อนส่งกลับ เพื่อป้องกัน frontend พัง
    try {
      JSON.parse(textResult);
    } catch(e) {
      throw new Error("Gemini สร้าง JSON ไม่สมบูรณ์ (FinishReason: " + finishReason + ")\nสาเหตุ: " + e.message + "\n\nข้อมูลดิบ:\n" + textResult);
    }

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
      "cover_design": {
        "type": "OBJECT",
        "properties": {
          "layout": { "type": "STRING" },
          "left_text": { "type": "STRING" },
          "right_text": { "type": "STRING" },
          "text_alignment": { "type": "STRING" },
          "text_position": { "type": "STRING" },
          "overlay_opacity": { "type": "STRING" },
          "headline_size": { "type": "STRING" },
          "visual_focus": { "type": "STRING" },
          "recommended_crop": { "type": "STRING" }
        }
      },
      "hero_quote": { "type": "STRING" },
      "quality": {
        "type": "OBJECT",
        "properties": {
          "brand": { "type": "INTEGER" },
          "story": { "type": "INTEGER" },
          "emotion": { "type": "INTEGER" },
          "overall": { "type": "INTEGER" }
        },
        "required": ["brand", "story", "emotion", "overall"]
      },
      "post_caption": {
        "type": "OBJECT",
        "properties": {
          "facebook": {
            "type": "OBJECT",
            "properties": {
              "english": { "type": "STRING" },
              "chinese": { "type": "STRING" },
              "thai": { "type": "STRING" }
            },
            "required": ["english", "chinese", "thai"]
          },
          "instagram": {
            "type": "OBJECT",
            "properties": {
              "english": { "type": "STRING" },
              "chinese": { "type": "STRING" },
              "thai": { "type": "STRING" }
            },
            "required": ["english", "chinese", "thai"]
          }
        },
        "required": ["facebook", "instagram"]
      }
    },
    "required": ["kept_image_indices", "cover_headline", "cover_design", "hero_quote", "quality", "post_caption"]
  };

  var partsArray = [{ "text": prompt }];
  for (var i = 0; i < base64ImagesArray.length; i++) {
    partsArray.push({
      "inline_data": { "mime_type": mimeType, "data": base64ImagesArray[i] }
    });
  }

  var payload = {
    "contents": [{ "parts": partsArray }],
    "systemInstruction": {
      "parts": [{
        "text": `Always think before writing.
First, analyze the images.
Then, identify the educational value.
Then, connect to Somkidvittaya's philosophy.
Finally, write naturally.
Never expose your reasoning.`
      }]
    },
    "generationConfig": {
      "responseMimeType": "application/json",
      "responseSchema": jsonSchema,
      "temperature": 0.85,
      "topP": 0.95,
      "topK": 40,
      "maxOutputTokens": 8192
    }
  };

  var options = { 
    "method": "post", 
    "contentType": "application/json",
    "payload": JSON.stringify(payload), 
    "muteHttpExceptions": true // ดัก Error จาก Google
  };

  var maxRetries = 3;
  var attempt = 0;
  var responseText = "";

  while (attempt < maxRetries) {
    var response = UrlFetchApp.fetch(url, options);
    responseText = response.getContentText();
    var responseCode = response.getResponseCode();
    
    // ถ้าเจอคนใช้เยอะ (503) หรือ Rate Limit (429) ให้รอแล้วลองใหม่
    if (responseCode === 503 || responseCode === 429) {
      attempt++;
      if (attempt < maxRetries) {
        Utilities.sleep(2000 * Math.pow(2, attempt - 1)); // รอ 2วิ, 4วิ ตามลำดับ
        continue;
      }
    }
    break;
  }
  
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

  var maxRetries = 3;
  var attempt = 0;
  var responseText = "";

  while (attempt < maxRetries) {
    var response = UrlFetchApp.fetch(url, options);
    responseText = response.getContentText();
    var responseCode = response.getResponseCode();
    
    if (responseCode === 503 || responseCode === 429) {
      attempt++;
      if (attempt < maxRetries) {
        Utilities.sleep(2000 * Math.pow(2, attempt - 1));
        continue;
      }
    }
    break;
  }
  
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
