import re

with open('Code.gs', 'r') as f:
    content = f.read()

# 1. Replace Prompt
prompt_regex = re.compile(r'var prompt = `.*?var rawResponse = callGeminiAPI\(base64ImagesArray, mimeType, prompt\);', re.DOTALL)
new_prompt = r'''var prompt = `
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
9 HASHTAGS
Include about 10 hashtags (Brand: 3, Learning: 2, Activity: 3, Future Skills: 2). DO NOT REPEAT. Do not write hashtags directly in the text body. Put them at the very end.

------------------------------------------
10 SIGNATURE ENDING
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

    var rawResponse = callGeminiAPI(base64ImagesArray, mimeType, prompt);'''

content = prompt_regex.sub(new_prompt, content)


# 2. Replace JSON Schema
schema_regex = re.compile(r'var jsonSchema = \{.*?\}\s*;\s*var partsArray', re.DOTALL)
new_schema = r'''var jsonSchema = {
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

  var partsArray'''

content = schema_regex.sub(new_schema, content)


with open('Code.gs', 'w') as f:
    f.write(content)

