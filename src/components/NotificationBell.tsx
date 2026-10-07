'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Bell, 
  Check, 
  ExternalLink, 
  Smartphone, 
  Sparkles, 
  CheckCheck, 
  Clock,
  Loader2,
  ChevronRight 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToPushNotifications, getExistingPushSubscription } from '@/lib/notifications/client';
import { toast } from 'sonner';

export function NotificationBell() {
  const { user, role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasPushSubscription, setHasPushSubscription] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const loadNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=15');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  // Check push subscription status
  const checkSubscription = async () => {
    const existing = await getExistingPushSubscription();
    setHasPushSubscription(!!existing);
  };

  useEffect(() => {
    loadNotifications();
    checkSubscription();

    // Auto-refresh notifications every 60 seconds
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Subscribe to Web Push
  const handleEnablePush = async () => {
    setIsSubscribing(true);
    const toastId = toast.loading('กำลังลงทะเบียนรับการแจ้งเตือนบนอุปกรณ์นี้...');

    const res = await subscribeToPushNotifications({
      userRole: role || 'staff',
    });

    setIsSubscribing(false);

    if (res.success) {
      setHasPushSubscription(true);
      toast.success('เปิดรับการแจ้งเตือนบนอุปกรณ์นี้เรียบร้อยแล้วค่ะ!', {
        id: toastId,
        description: 'ระบบจะส่งข้อความแจ้งเตือนเตือนความจำให้ท่านแม้ปิดหน้าเว็บ',
      });
    } else {
      toast.error('ไม่สามารถเปิดการแจ้งเตือนได้', {
        id: toastId,
        description: res.error,
      });
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('ทำเครื่องหมายอ่านแล้วทั้งหมด');
    } catch (err) {
      console.error(err);
    }
  };

  // Mark single as read
  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationId: notif.id }),
        });
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev =>
          prev.map(n => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      } catch (err) {
        console.error(err);
      }
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        className="relative p-2 sm:p-2.5 rounded-2xl bg-foreground/5 hover:bg-foreground/10 text-foreground transition-all flex items-center justify-center hover:scale-105 active:scale-95"
        title="การแจ้งเตือน"
      >
        <Bell className="w-5 h-5 text-foreground/80" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-3xl bg-surface/95 backdrop-blur-2xl border border-foreground/10 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="p-4 border-b border-foreground/10 flex items-center justify-between bg-primary/5">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <h3 className="font-extrabold text-sm text-foreground">การแจ้งเตือน</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                  {unreadCount} ใหม่
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-primary hover:underline font-bold flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> อ่านทั้งหมด
              </button>
            )}
          </div>

          {/* Web Push Prompt Pill if not enabled */}
          {!hasPushSubscription && (
            <div className="p-3 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/15 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-foreground/80">
                <Smartphone className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-[11px] leading-tight">เปิดรับแจ้งเตือนเด้งบนจอมือถือ</span>
              </div>
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={isSubscribing}
                className="px-3 py-1 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1 flex-shrink-0 disabled:opacity-50"
              >
                {isSubscribing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                <span>เปิดแจ้งเตือน</span>
              </button>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-foreground/5 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-foreground/40 text-xs">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                ไม่มีการแจ้งเตือนใหม่ในขณะนี้
              </div>
            ) : (
              notifications.map((notif) => (
                <Link
                  key={notif.id}
                  href={notif.action_url || '/home'}
                  onClick={() => handleNotificationClick(notif)}
                  className={`block p-3.5 hover:bg-foreground/5 transition-colors relative ${
                    !notif.is_read ? 'bg-primary/5 font-medium' : 'opacity-85'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-foreground leading-snug">
                      {notif.title}
                    </h4>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-[11px] text-foreground/70 line-clamp-2 mt-1 leading-relaxed">
                    {notif.body}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-foreground/40 mt-1.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(notif.created_at).toLocaleDateString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {notif.category && (
                      <span className="px-1.5 py-0.5 rounded bg-foreground/5 text-foreground/60 text-[9px] uppercase font-bold">
                        {notif.category}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Footer for Admin */}
          {(role === 'admin' || user?.email?.endsWith('@somkidvittaya.ac.th')) && (
            <div className="p-2.5 bg-foreground/5 border-t border-foreground/10 text-center">
              <Link
                href="/admin/notifications"
                onClick={() => setIsOpen(false)}
                className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-1.5 py-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>จัดการและส่งการแจ้งเตือน (Admin Center)</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
