'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  // ฟังก์ชันตรวจสอบการล็อกอิน
  useEffect(() => {
    async function checkUser() {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        router.push('/login');
        return;
      }
      // ดึงชื่ออีเมลมาแสดง
      setUserName(session.user.email?.split('@')[0] || 'ผู้ใช้งาน');
      setLoading(false);
    }
    checkUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // หน้าจอ Loading
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FCFBF7]">
        <div className="w-16 h-16 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4"></div>
        <p className="text-stone-500 font-medium">กำลังโหลดข้อมูลระบบ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCFBF7] pb-12 font-sans">
      
      {/* Header Bar - เปลี่ยนเป็น max-w-[1600px] และเพิ่ม px อัตโนมัติตามจอ */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 md:px-12 lg:px-20 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-stone-200 flex-shrink-0 bg-white">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain p-0.5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg lg:text-xl font-bold text-stone-800 leading-tight">ไร่อ้อยจรุงพัฒนานนท์</h1>
              <p className="text-[10px] sm:text-xs text-stone-500 font-medium mt-0.5">ระบบ ERP บริหารจัดการภายใน</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 sm:space-x-5">
            <div className="hidden md:block text-right">
              <p className="text-xs text-stone-400">เข้าสู่ระบบโดย</p>
              <p className="text-sm font-semibold text-stone-700 truncate max-w-[150px]">{userName}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2"
              title="ออกจากระบบ"
            >
              <span className="hidden sm:block text-sm font-medium pr-1">ออกจากระบบ</span>
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* เนื้อหาหลัก - ขยายความกว้างเต็มที่สำหรับ PC */}
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 md:px-12 lg:px-20 mt-6 sm:mt-8 md:mt-12">
        
        {/* ข้อความต้อนรับ */}
        <div className="mb-8 md:mb-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-stone-800 mb-2 lg:mb-3 tracking-tight">สวัสดี, {userName} 👋</h2>
          <p className="text-sm sm:text-base text-stone-500">ภาพรวมการทำงานประจำวันที่ <span className="font-semibold">{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
        </div>

        {/* Section 1: Dashboard ภาพรวม */}
        {/* ขยาย Grid Gap ให้สมส่วนกับจอใหญ่ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mb-12 md:mb-16">
          
          {/* Card 1 */}
          <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-stone-500 font-bold tracking-wider mb-2 uppercase">พนักงานมาทำงาน</p>
              <div className="flex items-baseline space-x-2">
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-stone-800">45</h3>
                <span className="text-sm sm:text-base font-medium text-stone-500">/ 50 คน</span>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-stone-500 font-bold tracking-wider mb-2 uppercase">รายการขอเบิกเงิน</p>
              <div className="flex items-baseline space-x-2">
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-amber-600">3</h3>
                <span className="text-sm sm:text-base font-medium text-stone-500">รายการ</span>
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-stone-500 font-bold tracking-wider mb-2 uppercase">แปลงที่กำลังตัด</p>
              <div className="flex items-baseline space-x-2">
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-stone-800">B-02</h3>
              </div>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-stone-500 font-bold tracking-wider mb-2 uppercase">ค่าแรงประเมินวันนี้</p>
              <div className="flex items-baseline space-x-2">
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-rose-600">15.4K</h3>
                <span className="text-sm sm:text-base font-medium text-stone-500">บาท</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: เมนูหลัก (Menu Grid) */}
        <div className="mb-10 lg:mb-16">
          <h3 className="text-xl sm:text-2xl font-bold text-stone-800 mb-6 sm:mb-8 flex items-center">
            <span className="w-2 h-8 lg:h-9 bg-amber-500 rounded-full mr-3"></span>
            เมนูการจัดการหลัก
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 lg:gap-8">
            
            {/* เมนู 1: เช็คชื่อเข้างาน */}
            <button onClick={() => router.push('/attendance')} className="group flex items-center p-5 sm:p-6 lg:p-8 bg-white border border-stone-200 rounded-3xl shadow-sm hover:border-emerald-400 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 text-left w-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 sm:w-40 sm:h-40 bg-emerald-50 rounded-full -mr-10 -mt-10 sm:-mr-12 sm:-mt-12 transition-transform group-hover:scale-110"></div>
              <div className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mr-5 lg:mr-8 flex-shrink-0">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div className="relative z-10 flex-grow">
                <h4 className="text-lg sm:text-xl lg:text-2xl font-bold text-stone-800 group-hover:text-emerald-700 transition-colors">เช็คชื่อเข้างาน & OT</h4>
                <p className="text-sm sm:text-base text-stone-500 mt-1.5 lg:mt-2">บันทึกเวลาทำงานและล่วงเวลา</p>
              </div>
              <div className="relative z-10 text-stone-300 group-hover:text-emerald-500 transition-colors hidden sm:block">
                <svg className="w-7 h-7 lg:w-8 lg:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>

            {/* เมนู 2: เบิกเงินล่วงหน้า */}
            <button className="group flex items-center p-5 sm:p-6 lg:p-8 bg-white border border-stone-200 rounded-3xl shadow-sm hover:border-amber-400 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 text-left w-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 sm:w-40 sm:h-40 bg-amber-50 rounded-full -mr-10 -mt-10 sm:-mr-12 sm:-mt-12 transition-transform group-hover:scale-110"></div>
              <div className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mr-5 lg:mr-8 flex-shrink-0">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <div className="relative z-10 flex-grow">
                <h4 className="text-lg sm:text-xl lg:text-2xl font-bold text-stone-800 group-hover:text-amber-700 transition-colors">ระบบเบิกเงินล่วงหน้า</h4>
                <p className="text-sm sm:text-base text-stone-500 mt-1.5 lg:mt-2">จัดการคำขอเบิกเงินของพนักงาน</p>
              </div>
              <div className="relative z-10 text-stone-300 group-hover:text-amber-500 transition-colors hidden sm:block">
                <svg className="w-7 h-7 lg:w-8 lg:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>

            {/* เมนู 3: ฐานข้อมูลพนักงาน */}
            <button className="group flex items-center p-5 sm:p-6 lg:p-8 bg-white border border-stone-200 rounded-3xl shadow-sm hover:border-blue-400 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 text-left w-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 sm:w-40 sm:h-40 bg-blue-50 rounded-full -mr-10 -mt-10 sm:-mr-12 sm:-mt-12 transition-transform group-hover:scale-110"></div>
              <div className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mr-5 lg:mr-8 flex-shrink-0">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="relative z-10 flex-grow">
                <h4 className="text-lg sm:text-xl lg:text-2xl font-bold text-stone-800 group-hover:text-blue-700 transition-colors">ฐานข้อมูลพนักงาน</h4>
                <p className="text-sm sm:text-base text-stone-500 mt-1.5 lg:mt-2">เพิ่ม/แก้ไข ข้อมูลและเรทค่าจ้าง</p>
              </div>
              <div className="relative z-10 text-stone-300 group-hover:text-blue-500 transition-colors hidden sm:block">
                <svg className="w-7 h-7 lg:w-8 lg:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>

            {/* เมนู 4: สรุปรายงาน */}
            <button className="group flex items-center p-5 sm:p-6 lg:p-8 bg-white border border-stone-200 rounded-3xl shadow-sm hover:border-purple-400 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 text-left w-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 sm:w-40 sm:h-40 bg-purple-50 rounded-full -mr-10 -mt-10 sm:-mr-12 sm:-mt-12 transition-transform group-hover:scale-110"></div>
              <div className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mr-5 lg:mr-8 flex-shrink-0">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="relative z-10 flex-grow">
                <h4 className="text-lg sm:text-xl lg:text-2xl font-bold text-stone-800 group-hover:text-purple-700 transition-colors">สรุปรายงานบัญชี</h4>
                <p className="text-sm sm:text-base text-stone-500 mt-1.5 lg:mt-2">ดูยอดรวมค่าใช้จ่ายและส่งออก Excel</p>
              </div>
              <div className="relative z-10 text-stone-300 group-hover:text-purple-500 transition-colors hidden sm:block">
                <svg className="w-7 h-7 lg:w-8 lg:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}