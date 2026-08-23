// ==========================================
// Code.gs — Somkidvittaya School
// Social Post Assistant
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
    var targetPage = params.targetPage || 'main';

    var prompt = "";

    if (targetPage === 'main') {
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
Note: You are connected to Google Search. Please use it to verify the correct English terminology, proper nouns, event names, and current facts before writing the captions to ensure high accuracy.
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

DO NOT discard images just because they look similar. KEEP ALMOST ALL IMAGES. Only remove if completely black or broken.
Keep as many good images as possible. Keep 80% of the images if possible. Do not filter out variations.
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
CAPTION FRAMEWORK & LENGTH POLICY
==================================================
Generate captions in English, Chinese, and Thai.
You MUST generate separate content for Facebook and Instagram inside post_caption.

[CAPTION LENGTH POLICY]
• Facebook (English & Thai): 80–120 words. Maximum 2 short paragraphs. Maximum 700 characters per language. Never exceed these limits.
• Facebook (Chinese): 120–180 Chinese characters. Maximum 2 short paragraphs.
• Instagram (English & Thai): 40–60 words. Maximum 1 short paragraph. Maximum 350 characters per language. Never exceed these limits.
• Instagram (Chinese): 60–100 Chinese characters. Maximum 1 short paragraph.
• Instagram version must be punchy and highly engaging. Do NOT simply cut text. Rewrite naturally for instant impact.

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
Instead: Write as a premium international school copywriter. Be concise. Every sentence must add new information. Avoid unnecessary storytelling. Use elegant but efficient language. Maximum impact with minimum words. Focus on student transformation.

Wording rules:
  • ชื่อโรงเรียน: "โรงเรียนสมคิดวิทยา" / "Somkidvittaya School" / "somkidvittaya学校" เท่านั้น
  • ระดับชั้นภาษาอังกฤษและจีนใช้ G.แทนคำนำหน้าเลขชั้นระดับประถม และ K.แทนคำนำหน้าเลขชั้นระดับอนุบาล ส่วนภาษาไทยใช้ป.แทนคำนำหน้าเลขชั้นระดับประถม และ อ.แทนคำนำหน้าเลขชั้นระดับอนุบาล
  • ชื่อบุคคลสำคัญ "นาย ณัฐวัฒน์ สงเคราะห์ธรรม" = "Mr. Nattawat Songkrotham" / "นางสาว อติภา สุขศิริ" = "Miss Atipa Sooksiri" / "นาย พีรวัส สงเคราะห์ธรรม" = "Mr. Peerawat Songkrohtham"

[ANTI-REPETITION RULES]
• Avoid repetition. Do not restate the same idea.
• Each sentence must contribute new information.
• Do not repeat CTA or contact details in the story.
• Do not repeat learning outcomes.
• Do not paraphrase previous sentences.

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
TOKEN BUDGET & GRACEFUL COMPRESSION POLICY
==================================================
You operate under a strict total output token budget (approx. 8,000 tokens total).
Output MUST be valid JSON. Never stop generating before closing every object. Never truncate strings. Never omit closing brackets.
If your generated content approaches the token limit, automatically compress and shorten captions instead of truncating JSON.

Priority Order:
1. Keep JSON valid
2. Keep all required fields (kept_image_indices, cover_headline, cover_design, hero_quote, quality, post_caption)
3. Shorten captions if necessary to fit within budget
4. Never remove languages (English, Chinese, and Thai must all exist)
5. Never truncate JSON string

==================================================
AI REFLECTION & SELF QUALITY CHECK
==================================================
Before returning JSON, internally ask: "Would this caption make a parent want to visit the school?"
If no, rewrite once. Do not reveal your reasoning.

Evaluate quality scores (0-100) for: Brand, Storytelling, Emotion, Overall.
Return in the quality object.
`;
    } else if (targetPage === 'football') {
      prompt = `You are the Brand Manager for SV Lion Football Academy (อคาเดมี่ฟุตบอลสมคิดวิทยา).
Write a highly engaging Facebook post caption in THAI ONLY.
Tone: Energetic, Professional, Sporty, Encouraging, Teamwork-focused.
Focus on: Skills development, physical health, sportsmanship, and having fun.
Do not write in English or Chinese. Be concise and impactful.

Activity Details:
` + activityInfo;
    } else if (targetPage === 'swimming') {
      prompt = `You are the Brand Manager for SV Aquatics Centre (สโมสรว่ายน้ำสมคิดวิทยา).
Write a highly engaging Facebook post caption in THAI ONLY.
Tone: Fresh, Active, Safe, Professional, Encouraging.
Focus on: Water safety, physical health, overcoming fear, technique, and having fun.
Do not write in English or Chinese. Be concise and impactful.

Activity Details:
` + activityInfo;
    } else if (targetPage === 'tutoring') {
      prompt = `You are the Brand Manager for Somkid+ (ศูนย์เรียนพิเศษสมคิดวิทยา).
Write a highly engaging Facebook post caption in THAI ONLY.
Tone: Academic, Encouraging, Focus, Supportive, Goal-oriented.
Focus on: Academic excellence, understanding concepts, preparing for exams, dedicated teachers.
Do not write in English or Chinese. Be concise and impactful.

Activity Details:
` + activityInfo;
    }

    var rawResponse = callGeminiAPI(base64ImagesArray, mimeType, prompt, activityInfo, targetPage);

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
  
  var metaConfig = getMetaConfig_(params.targetPage);
  var PAGE_ACCESS_TOKEN = metaConfig.token;
  var PAGE_ID = metaConfig.pageId;
  var IG_ACCOUNT_ID = metaConfig.igId;
  
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
      if (params.targetPage !== 'main') {
        // Skip Instagram for non-main pages
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          fbStatus: "Facebook post created"
        })).setMimeType(ContentService.MimeType.JSON);
      }
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
            "children": igContainerIds, // Pass as an actual array
            "caption": igCaption
          };
          var igCarouselRes = UrlFetchApp.fetch(igCarouselUrl, {
            "method": "post",
            "contentType": "application/json",
            "payload": JSON.stringify(igCarouselPayload),
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
function callGeminiAPI(base64ImagesArray, mimeType, prompt, activityInfo, targetPage) {
  var apiKey = "YOUR_GEMINI_API_KEY"; // ใส่คีย์ของคุณระหว่างเครื่องหมาย " "
  
  // --- Step 1: Researcher (gemini-2.5-flash) ---
  var verifiedFacts = "";
  if (activityInfo && activityInfo.trim().length > 5) {
    try {
      var searchPrompt = "You are a research assistant. Please use Google Search to find and verify the correct English terminology, proper nouns, location names, technical terms, and current facts related to this Thai context from a school:\n\n" + activityInfo + "\n\nReturn a concise list of verified English terms and facts to use in a social media post. Do not write a caption.";
      
      var searchPayload = {
        "contents": [{ "role": "user", "parts": [{ "text": searchPrompt }] }],
        "tools": [{ "google_search": {} }]
      };
      
      var searchRes = UrlFetchApp.fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey, {
        "method": "post",
        "contentType": "application/json",
        "payload": JSON.stringify(searchPayload),
        "muteHttpExceptions": true
      });
      
      var searchData = JSON.parse(searchRes.getContentText());
      if (searchData.candidates && searchData.candidates.length > 0) {
        verifiedFacts = searchData.candidates[0].content.parts[0].text;
      }
    } catch (e) {
      // Silently continue if search fails
    }
  }
  
  if (verifiedFacts) {
    prompt += "\n\n==================================================\nRESEARCH FACTS (FROM GEMINI 2.5 FLASH)\n==================================================\n" + verifiedFacts + "\n\nPlease use these verified facts and terminology when writing the caption.";
  }

  // --- Step 2: Writer (gemini-3.6-flash) ---
  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + apiKey;

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
          "facebook": { "type": "STRING" },
          "instagram": { "type": "STRING" }
        },
        "required": ["facebook"]
      }
    },
    "required": ["kept_image_indices", "cover_headline", "cover_design", "hero_quote", "quality", "post_caption"]
  };
  
  // If not main page, Instagram caption is not required.
  if (targetPage !== 'main') {
      // It is already not strictly required, but just to be safe.
      // We also don't even ask the AI for instagram in the prompt.
  }


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
  
  // --- Step 1: Researcher (gemini-2.5-flash) ---
  var verifiedFacts = "";
  if (thaiCaption.trim().length > 5) {
    try {
      var searchPrompt = `You are a research assistant. Please use Google Search to find and verify the correct English terminology, proper nouns, location names, technical terms, and current facts related to this Thai context from a school:

` + thaiCaption + `

Return a concise list of verified English terms and facts to use in a social media translation. Do not write a full caption.`;
      var searchPayload = {
        "contents": [{ "role": "user", "parts": [{ "text": searchPrompt }] }],
        "tools": [{ "google_search": {} }]
      };
      var searchRes = UrlFetchApp.fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey, {
        "method": "post",
        "contentType": "application/json",
        "payload": JSON.stringify(searchPayload),
        "muteHttpExceptions": true
      });
      var searchData = JSON.parse(searchRes.getContentText());
      if (searchData.candidates && searchData.candidates.length > 0) {
        verifiedFacts = searchData.candidates[0].content.parts[0].text;
      }
    } catch (e) {}
  }

  // --- Step 2: Translator (gemini-3.6-flash) ---
  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + apiKey;

  var jsonSchema = {
    "type": "OBJECT",
    "properties": {
      "english": { "type": "STRING", "description": "แปลเป็นภาษาอังกฤษล้วน สไตล์มืออาชีพ พรีเมียม อินเตอร์เนชั่นแนล และคงการจัดตำแหน่งทุกอย่างให้เหมือนเดิม" },
      "chinese": { "type": "STRING", "description": "แปลเป็นภาษาจีนล้วน สไตล์มืออาชีพ พรีเมียม อินเตอร์เนชั่นแนล และคงการจัดตำแหน่งทุกอย่างให้เหมือนเดิม" }
    },
    "required": ["english", "chinese"]
  };

  var prompt = `You are the Brand & Communications Director of Somkidvittaya School.
Your task is to translate the provided Thai social media caption into English and Chinese.

BRAND TONE: Premium, Warm, Confident, International, Professional, Optimistic.
Write like a premium international school copywriter, ensuring the language sounds natural to native speakers.

RULES:
1. STRICT ACCURACY: You must strictly preserve all original facts, names, numbers, and core meanings from the Thai text. Do not invent new information, exaggerate, or omit existing details. The translation must be highly faithful to the source.
2. EXACT FORMATTING: Keep the exact same paragraph spacing and line breaks as the original Thai text.
3. NO EXTRAS: Do not include hashtags or contact information. Translate only the text body.`;

  if (verifiedFacts) {
    prompt += `

==================================================
RESEARCH FACTS (FROM GEMINI 2.5 FLASH)
==================================================
` + verifiedFacts + `

Please use these verified English proper nouns and facts in your translation.`;
  }

  prompt += `

Thai Caption to Translate:
` + thaiCaption;

  var payload = {
    "contents": [
      {
        "role": "user",
        "parts": [{ "text": prompt }]
      }
    ],
    "generationConfig": {
      "responseMimeType": "application/json",
      "responseSchema": jsonSchema,
      "temperature": 0.7,
      "maxOutputTokens": 2048
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
    
    if (responseCode === 200) {
      break; 
    } else {
      return ContentService.createTextOutput(JSON.stringify({error: "Gemini API Error: " + responseText})).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(responseText).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// Helper: Meta API Config
// ==========================================
function getMetaConfig_(targetPage) {
  var config = {
    token: "EAAYA0g05EhoBSY0mxZARe3hje6CjMqnoez2SJl4N7R4FZBMZAU0TpXG3D7kxBCO8k826wGd84vkrHd809UZCyyj5J4LSo8mgoRMXvqYOR1joESZAX4aZCxrYVsPZAEjVxJsZCpnA6Ouq3fcX17ZALIoZBs8EbySfKwTqaQS17AOsT4kNOLF694QXdbF2BNzQdQOAB6EAZDZD",
    pageId: "192831060756593", // main
    igId: "17841446069053774"
  };
  
  if (targetPage === 'football') {
    config.pageId = "1204516039414311"; // To be updated by user
  } else if (targetPage === 'swimming') {
    config.pageId = "1188473751019404"; // To be updated by user
  } else if (targetPage === 'tutoring') {
    config.pageId = "1235898419607130"; // To be updated by user
  }
  
  return config;
}

// ==========================================
// VIDEO STEP: Facebook Upload
// step=start: เริ่ม session (รับ session_id)
// step=transfer: รับ chunkBase64 แล้วส่งไป FB
// step=finish: จบ session
// ==========================================
function handleVideoStepFB(params) {
  var c = getMetaConfig_(params.targetPage);
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
  var c = getMetaConfig_(params.targetPage);
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
  var c = getMetaConfig_(params.targetPage);
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
  var c = getMetaConfig_(params.targetPage);
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
