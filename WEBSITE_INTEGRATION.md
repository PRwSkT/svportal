# Website Integration Specification & Architecture

**Note for Claude / SV-Portal AI / Human Developers:**

The School Website (`somkidvittaya.ac.th`) and SV-Portal (`sv-portal.somkidvittaya.ac.th`) are seamlessly integrated using a **Hybrid Static + Real-time Client Hydration** architecture.

---

## 1. Core Architecture (Hybrid Real-Time + 7-Day Cycle)

### A. Real-Time Content Sync (Zero Netlify Build Quota Used)
- When content is posted via **Social Post Assistant** (`public/script.js` -> `/api/admin/website/sync-post`) or managed via **Website CMS** (`/admin/website/*`), it is saved directly into Supabase tables (`news`, `albums`, `album_photos`, `personnel`, `calendar_events`, `documents`) and Supabase Storage (`website-content`).
- **On the public website (`somkidvittaya.ac.th`):**
  - When visitors load any page, `src/main.js` automatically queries Supabase REST API in the background using the public Anon Key.
  - The latest News and Albums are injected/hydrated dynamically into the DOM in real-time.
  - **No Netlify rebuild is triggered on daily posts**, saving 100% of Netlify build minutes!

### B. Full Site Rebuild (Every 7 Days or on Manual Demand)
- **Netlify Build Hook:**
  - URL: `https://api.netlify.com/build_hooks/6a9f6146cf134165e6622bc2`
  - Saved in `.env.local` as `NETLIFY_BUILD_HOOK_URL`.
- **Manual Trigger Button:**
  - Located in SV-Portal Admin Sidebar at `/admin/website` (`[ 🚀 สั่ง Deploy เว็บไซต์จริง ]`).
  - Calls `manualTriggerDeploy()` in `src/app/admin/website/actions.ts`.
  - Rebuilds all static HTML, regenerates SEO snapshots, and updates hardcoded static content.
- **7-Day Scheduled Build:**
  - Set to trigger every 7 days via Netlify/External Cron to take a full static snapshot.

---

## 2. Key Files & Integration Points in SV-Portal

1. **`src/lib/website-sync.ts`**:
   - `triggerWebsiteRebuild(reason)`: Dispatches an HTTP POST request to `NETLIFY_BUILD_HOOK_URL`.
2. **`src/app/admin/website/actions.ts`**:
   - Contains CRUD Server Actions for CMS (`insertRecord`, `updateRecord`, `deleteRecord`, `manualTriggerDeploy`).
   - Note: Do NOT add auto-rebuild triggers to `insertRecord`/`updateRecord` because real-time client hydration already handles live updates on the website without burning build minutes.
3. **`src/app/api/admin/website/sync-post/route.ts`**:
   - Receives FormData from Post Assistant.
   - Uploads photos to `website-content` bucket.
   - Creates records in `albums` (if photos exist) and `news`.
4. **`public/script.js`**:
   - `syncToWebsite(hl, fbCaption, activeFiles)`: Captures published social posts for the main school page and syncs to `/api/admin/website/sync-post` with real-time UI toasts.

---

## 3. Maintenance Rules for SV-Portal AI
- **Do NOT delete or overwrite `syncToWebsite()`** in `public/script.js`.
- **Do NOT remove `NETLIFY_BUILD_HOOK_URL`** from `.env.local`.
- School Address in website layouts must always be **"โรงเรียนสมคิดวิทยา อ.เมือง จ.ระยอง"** (Phone: 038-611251).
