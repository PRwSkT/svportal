'use client';

import { useState, useEffect } from 'react';
import { 
  Tv, 
  ExternalLink, 
  RefreshCw, 
  Download, 
  Layers, 
  Volume2, 
  VolumeX, 
  CheckCircle2, 
  AlertCircle, 
  Wifi, 
  WifiOff, 
  Smartphone, 
  Settings, 
  Copy, 
  Check, 
  Compass, 
  ShieldCheck, 
  Play
} from 'lucide-react';
import { toast } from 'sonner';

interface DeviceItem {
  id: string;
  name: string;
  group_name?: string | null;
  orientation?: string;
  computed_status: string;
  current_fps?: number;
  dropped_frames?: number;
  is_muted?: number;
  last_heartbeat?: string;
}

export default function AdminSignagePage() {
  const [activeTab, setActiveTab] = useState<'console' | 'tv-guide' | 'screens'>('console');
  const [serverUrl, setServerUrl] = useState<string>('http://localhost:3000');
  const [isServerOnline, setIsServerOnline] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('tv-canteen-01');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Check signage server health
  const checkServer = async (targetUrl = serverUrl) => {
    setIsChecking(true);
    try {
      const res = await fetch(`${targetUrl}/api/health`, { cache: 'no-store' });
      const data = await res.json();
      if (data.status === 'ok') {
        setIsServerOnline(true);
        fetchDevices(targetUrl);
      } else {
        setIsServerOnline(false);
      }
    } catch {
      setIsServerOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  const fetchDevices = async (targetUrl = serverUrl) => {
    try {
      const res = await fetch(`${targetUrl}/api/signage/devices`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setDevices(json.data);
      }
    } catch (e) {
      console.warn('Could not load devices:', e);
    }
  };

  useEffect(() => {
    // If running in browser and hostname is not localhost, try local network IP or current origin
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        setServerUrl('http://localhost:3000');
        checkServer('http://localhost:3000');
      } else {
        // School LAN fallback
        const defaultLan = 'http://192.168.0.174:3000';
        setServerUrl(defaultLan);
        checkServer(defaultLan);
      }
    }
  }, []);

  const handleCopyTvUrl = () => {
    const fullUrl = `${serverUrl}/tv/?deviceId=${encodeURIComponent(selectedDeviceId)}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(true);
    toast.success('คัดลอก URL สำหรับลงทีวีเรียบร้อยแล้ว');
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Banner */}
      <div className="bg-[#091b30] text-white border-b border-[#b39a4b]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#b39a4b]/20 text-[#dfce91] rounded-xl border border-[#b39a4b]/40">
                <Tv className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight">ระบบจอประชาสัมพันธ์ทีวี (Digital Signage)</h1>
                  <span className="bg-[#8b1d32] text-white text-xs px-2.5 py-0.5 rounded-full font-medium tracking-wide">
                    SV Suite
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-0.5">
                  โรงเรียนสมคิดวิทยา • จัดการสื่อ กระจายภาพ และควบคุมจอ Android TV ทั่วโรงเรียน
                </p>
              </div>
            </div>

            {/* Server Status & Controls */}
            <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700/60 self-start md:self-auto">
              <div className="flex items-center gap-2 text-xs">
                {isChecking ? (
                  <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                ) : isServerOnline ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Signage Server Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                    <AlertCircle className="w-4 h-4" />
                    Server Offline / Unreachable
                  </span>
                )}
              </div>
              <button 
                onClick={() => checkServer()}
                title="ทดสอบการเชื่อมต่อเซิร์ฟเวอร์"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-6 border-b border-slate-700/60">
            <button
              onClick={() => setActiveTab('console')}
              className={`pb-3 px-4 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
                activeTab === 'console'
                  ? 'border-[#b39a4b] text-[#dfce91]'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              คอนโซลบริหารจัดการ (Admin Console)
            </button>
            <button
              onClick={() => setActiveTab('tv-guide')}
              className={`pb-3 px-4 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
                activeTab === 'tv-guide'
                  ? 'border-[#b39a4b] text-[#dfce91]'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              โปรแกรมและคู่มือติดตั้งลงทีวี (TV Client Apps)
            </button>
            <button
              onClick={() => setActiveTab('screens')}
              className={`pb-3 px-4 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
                activeTab === 'screens'
                  ? 'border-[#b39a4b] text-[#dfce91]'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Tv className="w-4 h-4" />
              รายการจอทีวี ({devices.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* TAB 1: Console (Embedded Signage Portal) */}
        {activeTab === 'console' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium text-slate-700">ที่อยู่เซิร์ฟเวอร์ Signage:</span>
                <input 
                  type="text" 
                  value={serverUrl} 
                  onChange={(e) => setServerUrl(e.target.value)}
                  onBlur={() => checkServer(serverUrl)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono w-64 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#12395f]"
                  placeholder="http://192.168.0.174:3000"
                />
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={`${serverUrl}/portal`}
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#12395f] bg-[#12395f]/10 rounded-lg hover:bg-[#12395f]/20 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  เปิดคอนโซลเต็มจอ (New Tab)
                </a>
                <a 
                  href={`${serverUrl}/tv/?deviceId=tv-lobby-01`}
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition border border-emerald-200"
                >
                  <Play className="w-3.5 h-3.5" />
                  ทดสอบเปิดจอทีวีจำลอง
                </a>
              </div>
            </div>

            {/* Embedded Iframe Container */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden" style={{ minHeight: '820px' }}>
              <iframe
                src={`${serverUrl}/portal`}
                title="Somkidvittaya Signage Console"
                className="w-full border-none"
                style={{ height: '860px', width: '100%' }}
              />
            </div>
          </div>
        )}

        {/* TAB 2: TV Setup & Apps Guide */}
        {activeTab === 'tv-guide' && (
          <div className="space-y-6">
            {/* Quick Generator Box */}
            <div className="bg-gradient-to-r from-[#091b30] to-[#12395f] text-white p-6 rounded-2xl shadow-lg border border-[#b39a4b]/30">
              <h2 className="text-lg font-bold text-[#dfce91] flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#b39a4b]" />
                ตัวสร้าง URL สำหรับนำไปใส่บนหน้าจอ Android TV แต่ละเครื่อง
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                กำหนดรหัสหน้าจอที่ต้องการติดตั้ง จากนั้นคัดลอก URL ไปใส่ในแอปบนทีวี ระบบจะลงทะเบียนให้อัตโนมัติทันที
              </p>

              <div className="mt-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="flex-1 flex items-center bg-white/10 rounded-xl px-3 py-2 border border-white/20">
                  <span className="text-xs text-slate-300 mr-2 font-mono">รหัสหน้าจอ:</span>
                  <input
                    type="text"
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value.toLowerCase().trim())}
                    placeholder="เช่น tv-canteen-01, tv-library-01"
                    className="bg-transparent border-none text-white text-sm font-semibold focus:outline-none flex-1 font-mono"
                  />
                </div>
                <div className="flex-1 bg-black/30 rounded-xl px-3.5 py-2 font-mono text-xs text-emerald-300 overflow-x-auto whitespace-nowrap border border-emerald-500/30 flex items-center">
                  {serverUrl}/tv/?deviceId={selectedDeviceId}
                </div>
                <button
                  onClick={handleCopyTvUrl}
                  className="px-5 py-2.5 bg-[#b39a4b] hover:bg-[#c4a956] text-[#091b30] font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow"
                >
                  {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedUrl ? 'คัดลอกแล้ว!' : 'คัดลอก URL'}</span>
                </button>
              </div>
            </div>

            {/* Methods Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Method 1: Kiosk App (Recommended) */}
              <div className="bg-white p-6 rounded-2xl border-2 border-emerald-500/40 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[11px] font-bold px-3 py-1 rounded-bl-xl tracking-wider">
                  แนะนำที่สุด ★
                </div>
                <div>
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 border border-emerald-200">
                    <Tv className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">วิธีที่ 1: Fully Kiosk Browser</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    โซลูชันเกรดองค์กรสำหรับ Android TV รองรับเปิดเครื่องอัตโนมัติ 24/7 ไม่หลุดจอ
                  </p>
                  <ol className="text-xs text-slate-700 space-y-2.5 list-decimal list-inside bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <li>เปิด <strong>Google Play Store</strong> บน Android TV</li>
                    <li>ค้นหาและติดตั้ง <strong>&quot;Fully Kiosk Browser for Android TV&quot;</strong></li>
                    <li>เปิดแอปแล้วใส่ <strong>Start URL</strong> ที่ได้จากระบบด้านบน</li>
                    <li>ตั้งค่า <strong>&quot;Run on Boot&quot;</strong> เป็น Enabled เพื่อให้เปิดจอเองเมื่อเสียบปลั๊กทีวี</li>
                  </ol>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>สถานะ: รองรับทีวีทุกยี่ห้อ</span>
                  <span className="font-semibold text-emerald-600">เสถียรภาพสูงสุด</span>
                </div>
              </div>

              {/* Method 2: Web App PWA */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 border border-blue-200">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">วิธีที่ 2: Progressive Web App (PWA)</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    ไม่ต้องลงแอปเพิ่ม แค่เปิดผ่าน Chrome หรือ Puffin TV Browser บนทีวี
                  </p>
                  <ol className="text-xs text-slate-700 space-y-2.5 list-decimal list-inside bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <li>เปิด Web Browser บน Android TV</li>
                    <li>พิมพ์ URL จอทีวีด้านบน</li>
                    <li>ระบบมาพร้อม <strong>Service Worker</strong> สำหรับแคชสื่อออฟไลน์อัตโนมัติ</li>
                    <li>กด Bookmark หรือ &quot;Add to Home Screen&quot; เพื่อสร้างไอคอนบนหน้าจอหลักทีวี</li>
                  </ol>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>สถานะ: เล่นออฟไลน์ได้</span>
                  <span className="font-semibold text-blue-600">ไม่ต้องดาวน์โหลด APK</span>
                </div>
              </div>

              {/* Method 3: Native Android TV App */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4 border border-purple-200">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">วิธีที่ 3: Native Kotlin App (ExoPlayer)</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    ซอร์สโค้ด Kotlin สำหรับติดตั้งแบบ Native ลงทีวีโดยตรง
                  </p>
                  <div className="text-xs text-slate-700 space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-mono">
                    <div className="font-sans font-semibold text-slate-900">ตำแหน่งซอร์สโค้ด:</div>
                    <div className="text-[11px] text-slate-600 break-all">tv-player/android-native/</div>
                    <div className="font-sans font-semibold text-slate-900 mt-2">คำสั่งติดตั้งผ่าน ADB:</div>
                    <code className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">adb install -r app-release.apk</code>
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>สำหรับแผนกไอที</span>
                  <span className="font-semibold text-purple-600">Media3 ExoPlayer</span>
                </div>
              </div>
            </div>

            {/* TV Best Practices & Checklist */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ข้อแนะนำการติดตั้งจอทีวีของโรงเรียนให้เสถียร 24/7
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-slate-600">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="font-semibold text-slate-800 mb-1">1. การเชื่อมต่อสายสัญญาณ</div>
                  แนะนำใช้สาย LAN เพื่อความเสถียรสูงสุด หรือ Wi-Fi 5GHz เพื่อรองรับการสตรีมวิดีโอ 1080p
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="font-semibold text-slate-800 mb-1">2. โหมดพักหน้าจอ (Daydream)</div>
                  เข้า Settings บน Android TV &gt; Device Preferences &gt; Screen Saver &gt; ตั้งเป็น &quot;Never / ปิดการใช้งาน&quot;
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="font-semibold text-slate-800 mb-1">3. ระบบเสียงประจำจุด</div>
                  หากเป็นจอในห้องสมุด/อาคารเรียน ให้เข้า SV Portal ไปเลือกการตั้งค่าจอเป็น &quot;🔇 ปิดเสียง&quot;
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="font-semibold text-slate-800 mb-1">4. ป้ายข้อความตัววิ่ง</div>
                  สามารถแก้ข้อความวิ่งด่วนผ่านเมนู &quot;จัดสื่อ &amp; เลือกเป้าหมาย&quot; ได้ทันทีโดยไม่ต้องไปแตะต้องทีวี
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TV Screens List */}
        {activeTab === 'screens' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">สถานะการเชื่อมต่อหน้าจอทีวีสด (Live TV Fleet)</h3>
                <p className="text-xs text-slate-500 mt-0.5">ดึงข้อมูลสถานะและ Heartbeat จากเซิร์ฟเวอร์แบบ Real-time</p>
              </div>
              <button 
                onClick={() => fetchDevices()} 
                className="px-3 py-1.5 text-xs font-semibold text-[#12395f] bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                รีเฟรชสถานะ
              </button>
            </div>

            {devices.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Tv className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <div className="text-sm font-semibold text-slate-700">ยังไม่มีหน้าจอทีวีที่เชื่อมต่อในขณะนี้</div>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  เมื่อเปิดทีวีและใส่ URL หน้านี้ หน้าจอจะปรากฏในระบบโดยอัตโนมัติพร้อมรายงานสถานะทันที
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {devices.map((device) => {
                  const isOnline = device.computed_status === 'ONLINE';
                  const isPortrait = (device.orientation || '').startsWith('PORTRAIT');
                  return (
                    <div 
                      key={device.id} 
                      className={`p-4 rounded-xl border transition ${
                        isOnline ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-600' : 'bg-slate-400'}`}></span>
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {device.orientation === 'PORTRAIT_90' ? 'แนวตั้ง 9:16' : 'แนวนอน 16:9'}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="font-bold text-sm text-slate-900">{device.name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{device.id}</div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          {device.is_muted === 1 ? (
                            <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          <span>{device.is_muted === 1 ? 'ปิดเสียง' : 'เปิดเสียง'}</span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">
                          {device.current_fps || 60} FPS
                        </span>
                        <a 
                          href={`${serverUrl}/tv/?deviceId=${device.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#12395f] hover:underline font-semibold flex items-center gap-0.5"
                        >
                          ดูสด <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}