import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppNav } from "@/components/AppNav";
import { Toaster } from "sonner";
import Image from "next/image";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SV-Portal",
  description: "ระบบบริหารจัดการโรงเรียนสมคิดวิทยา",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') || undefined;

  return (
    <html
      lang="th"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-background text-foreground relative overflow-x-hidden print:overflow-x-visible">
        {/* Global Watermark Logos */}
        <div className="fixed bottom-4 md:bottom-8 right-4 md:right-8 opacity-25 pointer-events-none flex flex-col md:flex-row items-end md:items-center gap-4 md:gap-6 z-0 transition-all duration-500 print:opacity-[0.10] print:z-[-1]">
          <Image src="/logo2.png" alt="School Logo" width={640} height={360} className="h-20 md:h-32 w-auto drop-shadow-lg print:drop-shadow-none" />
          <Image src="/SV-Portal.png" alt="SVPortal" width={240} height={60} className="w-40 md:w-56 h-auto drop-shadow-lg print:drop-shadow-none" />
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
