import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppNav } from "@/components/AppNav";
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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <AppNav />
          <main className="flex-1">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
