import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ระบบกระจายเสียง (Audio Remote) | SV Portal',
  description: 'ระบบควบคุมการกระจายเสียงตามสายและแจ้งเตือนฉุกเฉิน โรงเรียนสมคิดวิทยา',
};

export default function AudioRemotePage() {
  return (
    <div className="w-full h-[calc(100vh-4rem)] bg-background">
      <iframe 
        src="/audio-remote.html" 
        className="w-full h-full border-none"
        title="ระบบควบคุมกระจายเสียง (Audio Remote)"
      />
    </div>
  );
}
