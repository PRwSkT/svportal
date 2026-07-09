import React from 'react';

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
