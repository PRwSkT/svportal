import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppNav } from "@/components/AppNav";
import { Toaster } from "sonner";
import Image from "next/image";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบการเงิน SVPortal",
  description: "ระบบบริหารจัดการการเงินและร้านค้าโรงเรียนสมคิดวิทยา",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-background text-foreground relative overflow-x-hidden">
        {/* Global Watermark Logos */}
        <div className="fixed bottom-4 md:bottom-8 right-4 md:right-8 opacity-10 pointer-events-none flex flex-col md:flex-row items-end md:items-center gap-4 md:gap-6 z-0 mix-blend-multiply transition-all duration-500 print:opacity-30">
          <Image src="/logo.png" alt="School Logo" width={80} height={80} className="w-16 h-16 md:w-24 md:h-24 grayscale drop-shadow-md" />
          <Image src="/SV-Portal.png" alt="SVPortal" width={200} height={50} className="w-32 md:w-48 h-auto grayscale drop-shadow-md" />
        </div>

        <Toaster position="top-right" richColors />
        <AuthProvider>
          <div className="relative z-50">
            <AppNav />
          </div>
          <main className="flex-1 relative z-10 pb-24 md:pb-10">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
