import type { Metadata, Viewport } from "next";
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

// 🌟 สเต็ปที่ 2.1: เพิ่มตัวตั้งค่า Viewport ล็อกการซูมหน้าจอ ให้ฟีลลิ่งแอปมือถือจริง
export const viewport: Viewport = {
  themeColor: "#FCFBF7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // ห้ามผู้ใช้งานกางนิ้วซูมจอเข้าออก หน้าต่างจะนิ่งเหมือนแอปแท้
};

// 🌟 สเต็ปที่ 2.2: อัปเกรด Metadata เชื่อมต่อไฟล์ Manifest และเปิดสิทธิ์แอปบน iPhone
export const metadata: Metadata = {
  title: "ไร่อ้อยจรุงพัฒนานนท์ | Internal ERP",
  description: "ระบบบริหารจัดการไร่อ้อยแบบครบวงจร - จรุงพัฒนานนท์",
  manifest: "/manifest.json", // ผูกบัตรประชาชนแอป
  appleWebApp: {
    capable: true, // เปิดสิทธิ์ให้ซ่อนแถบ URL คอนโทรลของ Safari
    statusBarStyle: "default",
    title: "ไร่อ้อย ERP",
  },
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