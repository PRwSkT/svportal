import type { Metadata, Viewport } from 'next';
import React from 'react';

export const viewport: Viewport = {
  themeColor: '#7B1C3E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'SV Parents Portal | โรงเรียนสมคิดวิทยา (parents.portal.somkidvittaya.ac.th)',
  description:
    'ระบบพอร์ทัลผู้ปกครองออนไลน์ โรงเรียนสมคิดวิทยา เชื่อมต่อข้อมูลการมาเรียน สมุดพกอนุบาล การบ้าน ห้องพยาบาล การรับ-ส่ง และการเงินแบบเรียลไทม์',
  manifest: '/parents-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SV Parents',
  },
};

export default function ParentsPortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="sv-viewport-shell min-h-[100dvh] bg-[#F5F4F2] text-[#1A1A1A]">
      <div className="sv-container-context flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
