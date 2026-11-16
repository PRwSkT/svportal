import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AppNav } from "@/components/AppNav";
import { GlobalNongFahBot } from "@/components/nongfah/GlobalNongFahBot";
import { GlobalWatermark, GlobalMainContainer } from "@/components/GlobalWatermark";
import { Toaster } from "sonner";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#7B1C3E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "SV-Portal | โรงเรียนสมคิดวิทยา",
  description: "ระบบบริหารจัดการโรงเรียนสมคิดวิทยา",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SV-Portal",
  },
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
        {/* Global Watermark Logos (hidden on standalone public pages like /verify) */}
        <GlobalWatermark />

        <Toaster position="top-right" richColors />
        <LanguageProvider>
          <AuthProvider>
            <div className="sticky top-0 z-40">
              <AppNav />
            </div>
            <GlobalMainContainer>
              {children}
            </GlobalMainContainer>
            <GlobalNongFahBot />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
