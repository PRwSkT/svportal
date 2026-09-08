/**
 * Netlify Build Hook Trigger for Somkidvittaya Website
 * Automatically requests a rebuild and redeployment of the static website
 * when content is changed in Supabase via SV-Portal CMS or Social Post Assistant.
 */

export async function triggerWebsiteRebuild(reason?: string): Promise<boolean> {
  const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL || process.env.NEXT_PUBLIC_NETLIFY_BUILD_HOOK_URL;
  
  if (!buildHookUrl) {
    console.log(`[Website Sync] NETLIFY_BUILD_HOOK_URL is not set. Skipping build trigger (${reason || 'content updated'}).`);
    return false;
  }

  try {
    console.log(`[Website Sync] Triggering Netlify build hook: ${reason || 'content updated'}...`);
    const res = await fetch(buildHookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trigger_title: `SVPortal Auto-sync: ${reason || 'Content updated'} (${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })})`
      })
    });

    if (res.ok) {
      console.log('[Website Sync] Netlify rebuild successfully queued! 🚀');
      return true;
    } else {
      console.warn(`[Website Sync] Netlify build hook returned HTTP ${res.status}`);
      return false;
    }
  } catch (err: any) {
    console.error('[Website Sync] Error triggering Netlify build hook:', err?.message || err);
    return false;
  }
}
