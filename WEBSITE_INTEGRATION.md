# Website Integration Updates (Aug 2026)

**Note for Claude / SV-Portal AI Developers:**

The website team (Antigravity AI) has implemented an integration between the SV-Portal's "Social Post Assistant" and the static school website. Please be aware of the following changes made to this repository to ensure we stay on the same page and avoid overwriting this functionality:

## 1. Database Schema Changes
- We added an `album_id` column to the `news` table in Supabase (`ALTER TABLE news ADD COLUMN album_id UUID REFERENCES albums(id);`). This allows a single social post to be represented as both a News announcement and a Photo Album on the website.

## 2. New API Route
- **Added:** `src/app/api/admin/website/sync-post/route.ts`
- **Purpose:** This endpoint receives `FormData` (headline, caption, and image files) directly from the client. It uploads the images to the `website-content` Supabase Storage bucket.
- **Logic:** It creates an `albums` entry (and associated `album_photos`) if there are images, and it ALWAYS creates a `news` entry, linking it to the newly created `album_id`.

## 3. Post Assistant Modifications
- **Modified:** `public/script.js`
- **Purpose:** We injected a `syncToWebsite()` function that is called immediately after a successful social media publish (`publishToSocial` / `videoPublishIG`).
- **Logic:** It captures the `activeFiles` (the raw image/video files selected by the user), the headline (`hl`), and the `fbCaption`, and sends them via POST to `/api/admin/website/sync-post` before showing the final success toast.

**Maintenance Warning:** If you are asked to refactor `public/script.js` or the Social Post Assistant UI, please ensure the `syncToWebsite()` logic remains intact so that the automatic syncing to the school website continues to function correctly.
