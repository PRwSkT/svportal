import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Social Post Assistant | SV Portal',
  description: 'ระบบผู้ช่วยสร้างโพสต์โซเชียลมีเดีย 3 ภาษา โรงเรียนสมคิดวิทยา',
};

export default function PostAssistantPage() {
  return (
    <div className="w-full h-[calc(100vh-4rem)] bg-background">
      <iframe 
        src="/post-assistant.html" 
        className="w-full h-full border-none"
        title="Social Post Assistant"
      />
    </div>
  );
}
