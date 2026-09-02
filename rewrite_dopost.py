import re
with open("Code.gs", "r") as f:
    content = f.read()

# I want to inject targetPage parsing
patch1 = """    var base64ImagesArray = JSON.parse(imagesDataJson || "[]");
    var mediaMode = params.mediaMode || 'photo';"""

patch1_new = """    var base64ImagesArray = JSON.parse(imagesDataJson || "[]");
    var mediaMode = params.mediaMode || 'photo';
    var targetPage = params.targetPage || 'main';"""

content = content.replace(patch1, patch1_new)

# Now, find `var prompt = ` and replace the whole thing down to `rawResponse = callGeminiAPI`
start = content.find("var prompt = `\nYou are the Brand & Communications Director of Somkidvittaya School.")
end = content.find("var rawResponse = callGeminiAPI(base64ImagesArray, mimeType, prompt, activityInfo);")

if start != -1 and end != -1:
    old_prompt_code = content[start:end]
    
    new_prompt_code = """var prompt = "";

    if (targetPage === 'main') {
      prompt = `
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

==================================================
MULTI-LANGUAGE REQUIREMENTS
==================================================
1. Thai: Warm, natural, concise, premium.
2. English: Professional, international school standard, native flow. DO NOT TRANSLATE WORD-FOR-WORD.
3. Chinese (Simplified): Professional, confident, elegant.

==================================================
POST CAPTION FORMAT
==================================================
1 FACEBOOK
[Catchy Headline TH]
[Catchy Headline EN]
[Catchy Headline CN]

[Body TH]
(Translate to EN)
(Translate to CN)

[Ending Call to Action TH/EN/CN]

2 INSTAGRAM
(Similar to Facebook but shorter, more punchy)

==================================================
USER INPUT
==================================================
Activity Details:
` + activityInfo;
    } else if (targetPage === 'football') {
      prompt = `
You are the Brand Manager for Somkidvittaya Football Academy.
Write a Facebook post caption in THAI ONLY.
Tone: Energetic, Professional, Sporty, Encouraging, Teamwork-focused.
Focus on: Skills development, physical health, sportsmanship, and having fun.
Do not write in English or Chinese.

Activity Details:
` + activityInfo;
    } else if (targetPage === 'swimming') {
      prompt = `
You are the Brand Manager for Somkidvittaya Swimming Club.
Write a Facebook post caption in THAI ONLY.
Tone: Fresh, Active, Safe, Professional, Encouraging.
Focus on: Water safety, physical health, overcoming fear, technique, and having fun.
Do not write in English or Chinese.

Activity Details:
` + activityInfo;
    } else if (targetPage === 'tutoring') {
      prompt = `
You are the Brand Manager for Somkidvittaya Tutoring Center (ศูนย์เรียนพิเศษสมคิดวิทยา).
Write a Facebook post caption in THAI ONLY.
Tone: Academic, Encouraging, Focus, Supportive, Goal-oriented.
Focus on: Academic excellence, understanding concepts, preparing for exams, dedicated teachers.
Do not write in English or Chinese.

Activity Details:
` + activityInfo;
    }

    var rawResponse = callGeminiAPI(base64ImagesArray, mimeType, prompt, activityInfo, targetPage);
"""
    # Wait, the original code had a HUGE prompt for main. I shouldn't just truncate it!
    # I should preserve the old prompt completely.
    pass

with open("Code.gs", "w") as f:
    f.write(content)
