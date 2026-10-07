import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'สร้าง QR Code | SV Portal',
  description: 'ระบบสร้าง QR Code มาตรฐานโรงเรียนสมคิดวิทยา',
};

export default function QRCodeGeneratorPage() {
  return (
    <div className="w-full h-[calc(100vh-4rem)] bg-background">
      <iframe 
        src="/qr-generator/index.html" 
        className="w-full h-full border-none"
        title="QR Code Generator"
      />
    </div>
  );
}

