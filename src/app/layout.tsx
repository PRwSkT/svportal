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
        <div className="fixed bottom-4 md:bottom-8 right-4 md:right-8 opacity-25 pointer-events-none flex flex-col md:flex-row items-end md:items-center gap-4 md:gap-6 z-0 transition-all duration-500 print:opacity-100">
          <Image src="/logo.png" alt="School Logo" width={100} height={100} className="w-20 h-20 md:w-32 md:h-32 drop-shadow-lg" />
          <Image src="/SV-Portal.png" alt="SVPortal" width={240} height={60} className="w-40 md:w-56 h-auto drop-shadow-lg" />
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
