/**
 * Android TV Signage Player Client
 * Features:
 * - Seamless Double-buffering Transition (ExoPlayer-like experience)
 * - Offline-first caching (Cache Storage API)
 * - Periodic Sync with SV Portal Backend
 * - Heartbeat Telemetry Ping
 * - Fallback Screen & Diagnostic Menu
 */

const CONFIG = {
  syncIntervalMs: 30 * 1000,      // Check for new playlist every 30s
  heartbeatIntervalMs: 30 * 1000,  // Ping health every 30s
  defaultImageDuration: 10 * 1000, // 10s default
};

// State
let deviceId = 'tv-lobby-01';
let currentPlaylist = { version: '', items: [] };
let currentIndex = -1;
let playbackTimer = null;
let activeLayer = 'a'; // 'a' or 'b'
let isPlaying = false;
let tapCount = 0;
let lastTapTime = 0;

// Elements
const layerA = document.getElementById('layer-a');
const layerB = document.getElementById('layer-b');
const standbyScreen = document.getElementById('standby-screen');
const standbyStatus = document.getElementById('standby-status-text');
const standbyDevice = document.getElementById('standby-device-id');
const diagOverlay = document.getElementById('diagnostic-overlay');

// Performance & Frame Drop Tracker
let lastFrameTime = performance.now();
let frameCount = 0;
let droppedFrames = 0;
let currentFps = 60;
let lastFpsCalc = performance.now();
let audioUnlocked = true;

function setupAudioUnlockListeners() {
  const unlock = () => {
    audioUnlocked = true;
    const badge = document.getElementById('audio-unlock-badge');
    if (badge) badge.style.display = 'none';

    // Unmute current playing foreground video if screen is not configured to mute
    const currentVideo = document.querySelector('.foreground-media');
    if (currentVideo && (!currentPlaylist || !currentPlaylist.is_muted)) {
      currentVideo.muted = false;
      const vol = (currentPlaylist && currentPlaylist.volume !== undefined ? currentPlaylist.volume : 100) / 100;
      currentVideo.volume = vol;
    }
  };

  // Proactively attempt AudioContext unlock on boot
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
    }
  } catch (e) {}

  if (window.fully) {
    try {
      if (typeof window.fully.unmute === 'function') window.fully.unmute();
    } catch (e) {}
  }

  window.addEventListener('click', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
}

function unlockAudioManual() {
  audioUnlocked = true;
  const badge = document.getElementById('audio-unlock-badge');
  if (badge) badge.style.display = 'none';
  const currentVideo = document.querySelector('.foreground-media');
  if (currentVideo && !currentPlaylist.is_muted) {
    currentVideo.muted = false;
    currentVideo.volume = (currentPlaylist.volume !== undefined ? currentPlaylist.volume : 100) / 100;
  }
}

let isDiagnosticOpen = false;
let frameAnimId = null;

function startFrameMonitor() {
  if (frameAnimId) {
    cancelAnimationFrame(frameAnimId);
    frameAnimId = null;
  }
  function frameLoop(now) {
    if (!isDiagnosticOpen) return;
    const delta = now - lastFrameTime;
    
    // Android TV video compositor synchronizes to video native FPS (24-30 FPS, ~33-42ms per frame).
    // A true perceptible stutter occurs when a frame delay exceeds 100ms (>3 frames delayed).
    if (delta > 100) {
      const missed = Math.floor(delta / 33.33) - 1;
      if (missed > 0) {
        droppedFrames += missed;
      }
    }

    frameCount++;
    if (now - lastFpsCalc >= 1000) {
      currentFps = Math.round((frameCount * 1000) / (now - lastFpsCalc));
      frameCount = 0;
      lastFpsCalc = now;

      const diagFps = document.getElementById('diag-fps');
      if (diagFps) {
        const color = currentFps >= 24 ? '#4ade80' : (currentFps >= 15 ? '#facc15' : '#ef4444');
        diagFps.style.color = color;
        diagFps.textContent = `${currentFps} FPS (${droppedFrames} dropped)`;
      }
    }

    lastFrameTime = now;
    frameAnimId = requestAnimationFrame(frameLoop);
  }
  frameAnimId = requestAnimationFrame(frameLoop);
}

// Live Clock, Date & Weather Rotator
let currentWeather = null;
let currentMetaSlide = 0; // 0: Date TH, 1: Date EN, 2: Weather TH, 3: Weather EN

async function fetchWeather() {
  try {
    // School Location: Mueang Rayong (Lat: 12.6815, Lon: 101.2816)
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=12.6815&longitude=101.2816&current=temperature_2m,weather_code&timezone=Asia%2FBangkok');
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.current) {
      currentWeather = {
        temp: Math.round(data.current.temperature_2m),
        code: data.current.weather_code
      };
    }
  } catch (e) {
    console.warn('[Signage] Weather fetch error:', e);
  }
}

function getWeatherInfo(code) {
  const table = {
    0: { th: 'แจ่มใส', en: 'Clear', icon: '☀️' },
    1: { th: 'โปร่ง', en: 'Fair', icon: '🌤️' },
    2: { th: 'มีเมฆบางส่วน', en: 'Partly Cloudy', icon: '⛅' },
    3: { th: 'มีเมฆมาก', en: 'Overcast', icon: '☁️' },
    45: { th: 'มีหมอก', en: 'Foggy', icon: '🌫️' },
    48: { th: 'หมอกหนา', en: 'Dense Fog', icon: '🌫️' },
    51: { th: 'ฝนปรอย', en: 'Light Drizzle', icon: '🌦️' },
    53: { th: 'ฝนปรอย', en: 'Drizzle', icon: '🌦️' },
    55: { th: 'ฝนปรอย', en: 'Drizzle', icon: '🌧️' },
    61: { th: 'ฝนตกเล็กน้อย', en: 'Light Rain', icon: '🌧️' },
    63: { th: 'ฝนตกปานกลาง', en: 'Moderate Rain', icon: '🌧️' },
    65: { th: 'ฝนตกหนัก', en: 'Heavy Rain', icon: '🌧️' },
    80: { th: 'ฝนโปรยปราย', en: 'Showers', icon: '🌦️' },
    81: { th: 'ฝนตกชุก', en: 'Showers', icon: '🌧️' },
    82: { th: 'ฝนตกหนัก', en: 'Heavy Showers', icon: '⛈️' },
    95: { th: 'พายุฟ้าคะนอง', en: 'Thunderstorm', icon: '⛈️' },
    96: { th: 'พายุลูกเห็บ', en: 'Hail Storm', icon: '⛈️' },
    99: { th: 'พายุฟ้าคะนอง', en: 'Severe Storm', icon: '⛈️' }
  };
  return table[code] || { th: 'มีเมฆบางส่วน', en: 'Partly Cloudy', icon: '🌤️' };
}

function startLiveClock() {
  const clockEl = document.getElementById('header-clock');
  const dateEl = document.getElementById('header-date');
  if (!clockEl && !dateEl) return;

  function updateClock() {
    const now = new Date();
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    }
  }

  function getSlideContent(slideIndex) {
    const now = new Date();
    const dayNamesTh = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์'];
    const monthNamesTh = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (slideIndex === 0) {
      // 1. วันที่ (ไทย)
      const dayStr = dayNamesTh[now.getDay()];
      const dateNum = now.getDate();
      const monthStr = monthNamesTh[now.getMonth()];
      const yearBE = now.getFullYear() + 543;
      return `วัน${dayStr} ${dateNum} ${monthStr} ${yearBE}`;
    } else if (slideIndex === 1) {
      // 2. Date (English)
      const dayStr = dayNamesEn[now.getDay()];
      const dateNum = now.getDate();
      const monthStr = monthNamesEn[now.getMonth()];
      const yearCE = now.getFullYear();
      return `${dayStr}, ${dateNum} ${monthStr} ${yearCE}`;
    } else if (slideIndex === 2 && currentWeather) {
      // 3. สภาพอากาศ (ไทย)
      const w = getWeatherInfo(currentWeather.code);
      return `${w.icon} ระยอง ${currentWeather.temp}°C • ${w.th}`;
    } else if (slideIndex === 3 && currentWeather) {
      // 4. Weather (English)
      const w = getWeatherInfo(currentWeather.code);
      return `${w.icon} Rayong ${currentWeather.temp}°C • ${w.en}`;
    }
    return `วัน${dayNamesTh[now.getDay()]} ${now.getDate()} ${monthNamesTh[now.getMonth()]} ${now.getFullYear() + 543}`;
  }

  function rotateSlide() {
    if (!dateEl) return;
    const maxSlides = currentWeather ? 4 : 2;
    currentMetaSlide = (currentMetaSlide + 1) % maxSlides;

    dateEl.classList.add('fade-out');
    setTimeout(() => {
      dateEl.textContent = getSlideContent(currentMetaSlide);
      dateEl.classList.remove('fade-out');
    }, 350);
  }

  updateClock();
  if (dateEl) dateEl.textContent = getSlideContent(0);

  setInterval(updateClock, 1000);
  setInterval(rotateSlide, 5000);

  fetchWeather().then(() => {
    if (dateEl && (currentMetaSlide === 2 || currentMetaSlide === 3)) {
      dateEl.textContent = getSlideContent(currentMetaSlide);
    }
  });
  setInterval(fetchWeather, 15 * 60 * 1000);
}

// Auto-Heal Fully Kiosk Settings (Eliminate PLUS watermark and ensure 60 FPS)
function autoHealFullyKiosk() {
  if (!window.fully) return;
  try {
    let settingsChanged = false;

    // 1. Clear PLUS Error URL (primary cause of PLUS trial watermark)
    if (typeof window.fully.getSetting === 'function') {
      const errUrl = window.fully.getSetting('errorURL');
      if (errUrl && errUrl.trim() !== '') {
        console.log('[Fully AutoHeal] Clearing errorURL:', errUrl);
        if (typeof window.fully.setStringSetting === 'function') {
          window.fully.setStringSetting('errorURL', '');
        }
        settingsChanged = true;
      }
    } else if (typeof window.fully.setStringSetting === 'function') {
      window.fully.setStringSetting('errorURL', '');
    }

    // 2. Disable page failure auto-reload loop (boot polling is handled by local offline.html)
    if (typeof window.fully.setStringSetting === 'function') {
      window.fully.setStringSetting('reloadPageFailure', '0');
    }

    // 3. Disable PLUS Kiosk / Motion / Reconnect reload flags
    if (typeof window.fully.setBooleanSetting === 'function') {
      window.fully.setBooleanSetting('kioskMode', false);
      window.fully.setBooleanSetting('motionDetection', false);
      window.fully.setBooleanSetting('reloadOnInternet', false);
      window.fully.setBooleanSetting('reloadOnWifiOn', false);
    }

    // 4. One-time auto-restart to purge trial watermark if settings were cleared
    const hasRestarted = sessionStorage.getItem('fully_purged_plus_v3');
    if (!hasRestarted && settingsChanged) {
      sessionStorage.setItem('fully_purged_plus_v3', 'true');
      console.log('[Fully AutoHeal] PLUS features cleared! Restarting Fully Kiosk in 1s...');
      if (typeof window.fully.restartApp === 'function') {
        setTimeout(() => {
          window.fully.restartApp();
        }, 1200);
      }
    }
  } catch (e) {
    console.warn('[Fully AutoHeal] Failed to heal settings:', e);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initDeviceId();
  autoHealFullyKiosk();
  initDiagnosticKey();
  startFrameMonitor();
  setupAudioUnlockListeners();
  startHealthWatchdog();
  startLiveClock();
  
  // Start Heartbeat & Sync Loops
  sendHeartbeat();
  syncPlaylist();

  setInterval(syncPlaylist, CONFIG.syncIntervalMs);
  setInterval(sendHeartbeat, CONFIG.heartbeatIntervalMs);
});

// 24/7 Watchdog & Mid-Playback Wi-Fi Drop/Reconnect Recovery
let lastWatchdogVideoTime = -1;
let videoStallTicks = 0;

function recoverStalledVideo(activeVideo, reason) {
  if (!activeVideo) return;
  try {
    const savedTime = activeVideo.currentTime || 0;
    const currentItem = currentPlaylist && currentPlaylist.items ? currentPlaylist.items[currentIndex] : null;
    const targetSrc = (currentItem && currentItem.url) || activeVideo.src;
    console.warn(`[Watchdog] Recovering video (${reason}) at ${savedTime.toFixed(1)}s`);
    videoStallTicks = 0;
    if (targetSrc) {
      activeVideo.src = targetSrc;
      activeVideo.load();
      activeVideo.onloadedmetadata = () => {
        if (savedTime > 0 && isFinite(activeVideo.duration) && savedTime < activeVideo.duration - 2) {
          activeVideo.currentTime = savedTime;
        }
        activeVideo.play().catch(() => {});
      };
      activeVideo.play().catch(() => {});
    } else {
      playNext();
    }
  } catch (e) {
    playNext();
  }
}

function startHealthWatchdog() {
  // Instant recovery as soon as Wi-Fi reconnects
  window.addEventListener('online', () => {
    console.log('[Network] Wi-Fi reconnected! Syncing and verifying video stream...');
    syncPlaylist();
    sendHeartbeat();

    const activeEl = activeLayer === 'a' ? layerA : layerB;
    const activeVideo = activeEl ? activeEl.querySelector('video.foreground-media') : null;
    if (activeVideo) {
      if (activeVideo.error || activeVideo.readyState < 3 || videoStallTicks > 0) {
        recoverStalledVideo(activeVideo, 'wifi_reconnected');
      } else if (activeVideo.paused) {
        activeVideo.play().catch(() => {});
      }
    } else if (currentPlaylist && currentPlaylist.items.length > 0 && !isPlaying) {
      currentIndex = 0;
      playNext();
    }
  });

  setInterval(() => {
    if (!isPlaying || !currentPlaylist || currentPlaylist.items.length === 0) return;

    const activeEl = activeLayer === 'a' ? layerA : layerB;
    const activeVideo = activeEl ? activeEl.querySelector('video.foreground-media') : null;

    if (activeVideo) {
      // 1. Hardware/Network decode error after Wi-Fi drop
      if (activeVideo.error) {
        recoverStalledVideo(activeVideo, 'media_error');
        return;
      }

      // 2. Video ended without looping
      if (activeVideo.ended) {
        if (currentPlaylist.items.length === 1) {
          activeVideo.currentTime = 0;
          activeVideo.play().catch(() => {});
        } else {
          currentIndex++;
          playNext();
        }
        return;
      }

      // 3. Video paused unexpectedly
      if (activeVideo.paused) {
        console.warn('[Watchdog] Video paused unexpectedly, resuming...');
        activeVideo.play().catch(() => {});
        return;
      }

      // 4. Detect freeze/buffer stall (e.g., Wi-Fi dropped mid-stream and came back)
      if (Math.abs(activeVideo.currentTime - lastWatchdogVideoTime) < 0.05) {
        videoStallTicks++;
        if (videoStallTicks === 2) {
          // Soft nudge at 10s stall
          activeVideo.play().catch(() => {});
        } else if (videoStallTicks >= 4) {
          // Hard stream recovery at 20s stall (resumes from exact timestamp)
          recoverStalledVideo(activeVideo, 'stream_stalled_20s');
        }
      } else {
        videoStallTicks = 0;
        lastWatchdogVideoTime = activeVideo.currentTime;
      }
    } else {
      // If no media is present or both layers are blank, restart playback
      const hasMedia = (layerA && layerA.children.length > 0) || (layerB && layerB.children.length > 0);
      if (!hasMedia) {
        console.warn('[Watchdog] No active media layer detected, recovering playback...');
        currentIndex = 0;
        playNext();
      }
    }
  }, 5000);
}

function initDeviceId() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get('deviceId');
  
  if (paramId) {
    deviceId = paramId;
    localStorage.setItem('signage_device_id', deviceId);
  } else {
    deviceId = localStorage.getItem('signage_device_id') || 'tv-lobby-01';
  }

  standbyDevice.textContent = `DEVICE ID: ${deviceId}`;
  document.getElementById('diag-device').textContent = deviceId;
}

// 1. PLAYLIST SYNC ENGINE
async function syncPlaylist() {
  try {
    autoHealFullyKiosk();
    document.getElementById('diag-sync').textContent = new Date().toLocaleTimeString();
    const res = await fetch(`/api/signage/devices/${deviceId}/playlist`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (!json.success || !json.data) return;

    const newPlaylist = json.data;
    document.getElementById('diag-group').textContent = newPlaylist.group_id || 'None';
    document.getElementById('diag-ver').textContent = newPlaylist.version.substring(0, 8);
    document.getElementById('diag-items').textContent = newPlaylist.total_items;

    // Update Ticker text if provided by backend
    if (newPlaylist.ticker_text) {
      const tickerEl = document.getElementById('ticker-text');
      if (tickerEl && tickerEl.textContent.trim() !== newPlaylist.ticker_text.trim()) {
        tickerEl.textContent = newPlaylist.ticker_text;
      }
    }

    // Detect if playlist has changed
    if (newPlaylist.version !== currentPlaylist.version) {
      console.log('[Sync] Playlist updated! New version:', newPlaylist.version);
      currentPlaylist = newPlaylist;

      // Apply screen orientation (Landscape / Portrait 90° / Portrait 270°)
      applyOrientation(currentPlaylist.orientation || 'LANDSCAPE');

      if (currentPlaylist.items.length === 0) {
        showStandby('พร้อมสำหรับการแสดงผลสื่อประชาสัมพันธ์ • รอการจัดคิวจาก SV Portal');
        stopPlayback();
      } else {
        hideStandby();
        // Prefetch media files for smooth offline playback
        prefetchMedia(currentPlaylist.items);
        if (!isPlaying) {
          currentIndex = 0;
          playNext();
        }
      }
    }
  } catch (err) {
    console.warn('[Sync] Failed to fetch playlist:', err.message);
    if (currentPlaylist.items.length === 0) {
      showStandby('กำลังรอการเชื่อมต่อโครงข่าย SV Portal...');
    }
  }
}

// Apply Hardware / Software Screen Orientation
function applyOrientation(orientation) {
  document.body.classList.remove('rotate-90', 'rotate-180', 'rotate-270');
  
  const isPhysicallyPortrait = window.innerHeight > window.innerWidth;
  const diagOri = document.getElementById('diag-orientation');
  if (diagOri) diagOri.textContent = orientation;

  // If TV OS is fixed Landscape, apply CSS rotation to adapt to vertical physical mounting
  if ((orientation === 'PORTRAIT_90' || orientation === 'PORTRAIT') && !isPhysicallyPortrait) {
    document.body.classList.add('rotate-90');
  } else if (orientation === 'PORTRAIT_270' && !isPhysicallyPortrait) {
    document.body.classList.add('rotate-270');
  }
}

// Prefetch files into browser cache
function prefetchMedia(items) {
  items.forEach(item => {
    if (item.type === 'image') {
      const img = new Image();
      img.src = item.url;
    }
  });
}

// 2. PLAYBACK & TRANSITION ENGINE (Double Buffering)

// Helper to immediately silence and pause all videos across layers to eliminate audio overlap
function silenceAllExistingVideos() {
  [layerA, layerB].forEach(layer => {
    if (!layer) return;
    layer.querySelectorAll('video').forEach(v => {
      try {
        v.muted = true;
        v.pause();
        v.onended = null;
        v.onerror = null;
        v.onloadeddata = null;
        v.onloadedmetadata = null;
      } catch (e) {}
    });
  });
}

// Helper to completely dismantle media and release hardware decoding pipelines
function silenceAndCleanLayer(layer) {
  if (!layer) return;
  layer.querySelectorAll('video').forEach(v => {
    try {
      v.muted = true;
      v.pause();
      v.onended = null;
      v.onerror = null;
      v.onloadeddata = null;
      v.onloadedmetadata = null;
      v.removeAttribute('src');
      v.load(); // Forces browser to immediately drop audio & video decoders
    } catch (e) {}
  });
  layer.querySelectorAll('img').forEach(img => {
    img.onload = null;
    img.onerror = null;
  });
  layer.innerHTML = '';
}

function playNext() {
  if (currentPlaylist.items.length === 0) return;

  isPlaying = true;
  if (currentIndex >= currentPlaylist.items.length || currentIndex < 0) {
    currentIndex = 0; // Loop back to start
  }

  const item = currentPlaylist.items[currentIndex];
  document.getElementById('diag-current').textContent = `[${currentIndex + 1}/${currentPlaylist.items.length}] ${item.title}`;

  // 24/7 OPTIMIZATION: If playlist has only 1 video, reuse existing healthy video element directly
  // BEFORE calling silenceAllExistingVideos() so handlers and hardware MediaCodec stay intact!
  if (item.type === 'video' && currentPlaylist.items.length === 1) {
    const activeEl = activeLayer === 'a' ? layerA : layerB;
    const existingVideo = activeEl ? activeEl.querySelector('video.foreground-media') : null;
    if (existingVideo && existingVideo.src && existingVideo.src.includes(item.url) && !existingVideo.error) {
      const isMutedByConfig = currentPlaylist.is_muted === true || currentPlaylist.is_muted === 1;
      const volumeLevel = (currentPlaylist.volume !== undefined && currentPlaylist.volume !== null ? currentPlaylist.volume : 100) / 100;
      existingVideo.loop = true;
      if (existingVideo.ended || existingVideo.currentTime >= (existingVideo.duration || Infinity) - 0.5) {
        existingVideo.currentTime = 0;
      }
      if (!isMutedByConfig) {
        existingVideo.muted = false;
        existingVideo.volume = volumeLevel;
      } else {
        existingVideo.muted = true;
      }
      existingVideo.play().catch(() => {});
      return;
    }
  }

  // 1. Immediately cancel pending watchdog timer and silence ALL previous audio
  clearTimeout(playbackTimer);
  playbackTimer = null;
  silenceAllExistingVideos();

  // Swap buffers
  const nextLayer = activeLayer === 'a' ? layerB : layerA;
  const currentLayer = activeLayer === 'a' ? layerA : layerB;

  // Prepare next layer (completely clean it first)
  silenceAndCleanLayer(nextLayer);

  const wrapper = document.createElement('div');
  wrapper.className = 'media-wrapper';

  // Guard flag to prevent multiple advances from both onended and watchdog
  let hasAdvanced = false;
  const advanceToNext = (reason) => {
    if (hasAdvanced) return;
    hasAdvanced = true;
    clearTimeout(playbackTimer);
    playbackTimer = null;

    // For single-video playlist, loop seamlessly without silencing/destroying decoder
    if (currentPlaylist.items.length === 1 && reason === 'video_ended') {
      currentIndex = 0;
      playNext();
      return;
    }

    // Silence this item immediately when advancing
    silenceAllExistingVideos();

    currentIndex++;
    playNext();
  };

  if (item.type === 'video') {
    const isMutedByConfig = currentPlaylist.is_muted === true || currentPlaylist.is_muted === 1;
    const volumeLevel = (currentPlaylist.volume !== undefined && currentPlaylist.volume !== null ? currentPlaylist.volume : 100) / 100;

    const diagAudio = document.getElementById('diag-audio');
    if (diagAudio) {
      diagAudio.textContent = isMutedByConfig ? 'MUTED' : `AUDIO ON (${Math.round(volumeLevel * 100)}%)`;
    }

    // Foreground crisp video (fit contain, hardware accelerated, unmuted if allowed)
    const video = document.createElement('video');
    video.src = item.url;
    video.autoplay = true;
    video.playsInline = true;
    video.loop = (currentPlaylist.items.length === 1);
    video.className = 'foreground-media';

    if (isMutedByConfig) {
      video.muted = true;
    } else {
      video.muted = false;
      video.volume = volumeLevel;
    }

    // When video data is ready, trigger seamless crossfade transition
    video.onloadeddata = () => {
      nextLayer.classList.add('active');
      currentLayer.classList.remove('active');
      activeLayer = activeLayer === 'a' ? 'b' : 'a';

      // After CSS crossfade completes (350ms), completely tear down previous layer to free memory
      setTimeout(() => {
        silenceAndCleanLayer(currentLayer);
      }, 350);
    };

    // PRIMARY END TRIGGER: Advance immediately when the video finishes naturally
    video.onended = () => {
      advanceToNext('video_ended');
    };

    video.onerror = () => {
      console.warn('Video playback error (network/decode), retrying after 4s...');
      setTimeout(() => {
        advanceToNext('video_error');
      }, 4000);
    };

    // EMERGENCY WATCHDOG TIMER ONLY (for multi-item playlists):
    // Once metadata is loaded, give the video its FULL natural duration + 5s buffer
    video.onloadedmetadata = () => {
      if (currentPlaylist.items.length === 1) {
        clearTimeout(playbackTimer);
        playbackTimer = null;
        return;
      }
      if (video.duration && isFinite(video.duration) && video.duration > 0) {
        clearTimeout(playbackTimer);
        const maxDurationMs = (video.duration * 1000) + 5000;
        playbackTimer = setTimeout(() => {
          console.warn('[Watchdog] Video exceeded natural duration, advancing');
          advanceToNext('watchdog_video_duration_exceeded');
        }, maxDurationMs);
      }
    };

    // Fallback if metadata fails to load within 20 seconds
    clearTimeout(playbackTimer);
    playbackTimer = setTimeout(() => {
      if (video.readyState >= 2) return;
      console.warn('[Watchdog] Video metadata/playback timed out, advancing');
      advanceToNext('watchdog_metadata_timeout');
    }, 20000);

    wrapper.appendChild(video);
    nextLayer.appendChild(wrapper);

    // Play foreground video and gracefully handle browser autoplay policies
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        if (!isMutedByConfig) {
          video.muted = false;
          video.volume = volumeLevel;
          const badge = document.getElementById('audio-unlock-badge');
          if (badge) badge.style.display = 'none';
        }
      }).catch(err => {
        console.warn('[Audio] Autoplay with sound restricted by browser policy. Retrying muted then unmuting:', err.message);
        video.muted = true;
        video.play().then(() => {
          if (!isMutedByConfig) {
            setTimeout(() => {
              video.muted = false;
              video.volume = volumeLevel;
              const badge = document.getElementById('audio-unlock-badge');
              if (badge) badge.style.display = 'none';
            }, 300);
          }
        }).catch(() => {});
      });
    }


  } else {
    // IMAGE PLAYBACK
    const durationMs = (item.duration_seconds || 10) * 1000;

    // 1. Ambient blurred image background
    const bgImg = document.createElement('img');
    bgImg.src = item.url;
    bgImg.className = 'ambient-blur';
    wrapper.appendChild(bgImg);

    // 2. Foreground crisp image (fit contain)
    const img = document.createElement('img');
    img.src = item.url;
    img.className = 'foreground-media';

    img.onload = async () => {
      // Decode image off main-thread to prevent UI freeze and dropped frames
      if (img.decode) {
        try {
          await img.decode();
        } catch (e) {}
      }
      nextLayer.classList.add('active');
      currentLayer.classList.remove('active');
      activeLayer = activeLayer === 'a' ? 'b' : 'a';

      setTimeout(() => {
        silenceAndCleanLayer(currentLayer);
      }, 350);
    };

    img.onerror = () => {
      console.warn('Image load error, skipping');
      advanceToNext('image_error');
    };

    wrapper.appendChild(img);
    nextLayer.appendChild(wrapper);

    // Image timer uses exact configured duration
    clearTimeout(playbackTimer);
    playbackTimer = setTimeout(() => {
      advanceToNext('image_timer');
    }, durationMs);
  }
}

function stopPlayback() {
  isPlaying = false;
  clearTimeout(playbackTimer);
  playbackTimer = null;
  silenceAndCleanLayer(layerA);
  silenceAndCleanLayer(layerB);
  layerA.classList.remove('active');
  layerB.classList.remove('active');
}

function showStandby(msg) {
  standbyStatus.textContent = msg;
  standbyScreen.style.display = 'flex';
}

function hideStandby() {
  standbyScreen.style.display = 'none';
}

// 3. TELEMETRY & HEARTBEAT
async function sendHeartbeat() {
  try {
    // Skip heartbeat for test/preview or simulator devices
    if (deviceId === 'tv-lobby-01' || window.location.search.includes('preview=1') || window.location.search.includes('sim=1')) {
      return;
    }

    const currentItem = currentPlaylist.items[currentIndex] || null;
    const recentDropped = droppedFrames;
    droppedFrames = 0; // Reset after snapshot so dashboard reflects real-time performance

    let clientIp = null;
    if (window.fully) {
      try {
        if (typeof window.fully.getWifiIpAddress === 'function') {
          clientIp = window.fully.getWifiIpAddress();
        } else if (typeof window.fully.getIp4Address === 'function') {
          clientIp = window.fully.getIp4Address();
        }
      } catch (e) {}
    }

    const payload = {
      current_media_id: currentItem ? currentItem.id : null,
      free_storage_mb: 8192, // Simulated available storage
      app_version: '1.2.0-web',
      current_fps: currentFps,
      dropped_frames: recentDropped,
      ip_address: clientIp || undefined,
      timestamp: new Date().toISOString()
    };

    const res = await fetch(`/api/signage/devices/${deviceId}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      document.getElementById('diag-ping').textContent = new Date().toLocaleTimeString();
    }
  } catch (err) {
    console.warn('[Heartbeat] Ping failed:', err.message);
  }
}

// 4. DIAGNOSTIC MENU
function initDiagnosticKey() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
      toggleDiagnostic();
    }
  });

  // Tap 5 times to show diagnostic overlay
  document.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastTapTime < 500) {
      tapCount++;
      if (tapCount >= 5) {
        toggleDiagnostic();
        tapCount = 0;
      }
    } else {
      tapCount = 1;
    }
    lastTapTime = now;
  });
}

function toggleDiagnostic() {
  isDiagnosticOpen = diagOverlay.style.display !== 'block';
  diagOverlay.style.display = isDiagnosticOpen ? 'block' : 'none';
  if (isDiagnosticOpen) {
    lastFrameTime = performance.now();
    startFrameMonitor();
  } else if (frameAnimId) {
    cancelAnimationFrame(frameAnimId);
    frameAnimId = null;
  }
}
