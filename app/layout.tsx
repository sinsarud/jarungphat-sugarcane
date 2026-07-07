import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// อัปเกรด Metadata ให้ดูเป็นระบบจัดการไร่อ้อย
export const metadata: Metadata = {
  title: "ไร่อ้อยจรุงพัฒนานนท์ | Internal ERP",
  description: "ระบบบริหารจัดการไร่อ้อยแบบครบวงจร - จรุงพัฒนานนท์",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th" // ปรับเป็นภาษาไทย
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FCFBF7] text-stone-900">
        <main className="flex-grow">
          {children}
        </main>
        
        {/* ใส่ Analytics ตรงนี้ ระบบจะทำงานอัตโนมัติ */}
        <Analytics />
      </body>
    </html>
  );
}