'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // State สำหรับข้อมูลบน Dashboard
  const [stats, setStats] = useState({
    presentToday: 0,
    totalEmployees: 5, 
    advanceRequests: 0,
    estimatedWageToday: 0,
    harvestingPlots: '-' 
  });

  const fetchDashboardData = async () => {
    const today = new Date().toISOString().split('T')[0];

    const { data: attendanceData } = await supabase
      .from('daily_attendance')
      .select('wage')
      .eq('date', today)
      .neq('work_type', 'ขาด')
      .neq('work_type', 'LA');

    const presentCount = attendanceData ? attendanceData.length : 0;
    const wageSum = attendanceData ? attendanceData.reduce((sum, record) => sum + Number(record.wage || 0), 0) : 0;

    const { count: advanceCount } = await supabase
      .from('advance_payments')
      .select('*', { count: 'exact', head: true });

    const { data: plotsData } = await supabase
      .from('plots')
      .select('code')
      .eq('status', 'harvesting');

    const harvestingCodes = plotsData && plotsData.length > 0 
      ? plotsData.map((p: any) => p.code).join(', ') 
      : '-';

    setStats({
      presentToday: presentCount,
      totalEmployees: 5, 
      advanceRequests: advanceCount || 0,
      estimatedWageToday: wageSum,
      harvestingPlots: harvestingCodes 
    });
  };

  useEffect(() => {
    async function initDashboard() {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        router.push('/login');
        return;
      }
      setUserName(session.user.email?.split('@')[0] || 'ผู้ใช้งาน');

      await fetchDashboardData();
      loading && setLoading(false);
    }
    
    initDashboard();

    const channel = supabase
      .channel('dashboard_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_attendance' }, () => {
        fetchDashboardData(); 
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advance_payments' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plots' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // 🌟 จัดกลุ่มเมนูสำหรับ Sidebar
  const menuGroups = [
    {
      title: 'ผู้บริหาร & สรุปผล',
      items: [
        { name: 'แดชบอร์ดผู้บริหาร', path: '/executive-dashboard', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 8v8m-4-5v5m-4-2v2M4 21h16a2 2 0 002-2V5a2 2 0 00-2-2H4a2 2 0 00-2 2v14a2 2 0 002 2z" />, bgColor: 'bg-amber-100', textColor: 'text-amber-600', hoverBg: 'hover:bg-amber-50', hoverText: 'group-hover:text-amber-700' },
        { name: 'คำนวณเงินค่าอ้อย', path: '/sugarcane', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />, bgColor: 'bg-orange-100', textColor: 'text-orange-600', hoverBg: 'hover:bg-orange-50', hoverText: 'group-hover:text-orange-700' }
      ]
    },
    {
      title: 'บุคคล & ค่าแรง',
      items: [
        { name: 'เช็คชื่อเข้างาน', path: '/attendance', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />, bgColor: 'bg-emerald-100', textColor: 'text-emerald-600', hoverBg: 'hover:bg-emerald-50', hoverText: 'group-hover:text-emerald-700' },
        { name: 'คิดเงินสดรายคน', path: '/payroll', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />, bgColor: 'bg-purple-100', textColor: 'text-purple-600', hoverBg: 'hover:bg-purple-50', hoverText: 'group-hover:text-purple-700' },
        { name: 'เบิกเงินล่วงหน้า', path: '/advance', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />, bgColor: 'bg-yellow-100', textColor: 'text-yellow-600', hoverBg: 'hover:bg-yellow-50', hoverText: 'group-hover:text-yellow-700' },
        { name: 'ฐานข้อมูลพนักงาน', path: '/employees', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />, bgColor: 'bg-blue-100', textColor: 'text-blue-600', hoverBg: 'hover:bg-blue-50', hoverText: 'group-hover:text-blue-700' }
      ]
    },
    {
      title: 'ปฏิบัติการไร่ & คลัง',
      items: [
        { name: 'จัดการแปลงอ้อย', path: '/plots', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />, bgColor: 'bg-teal-100', textColor: 'text-teal-600', hoverBg: 'hover:bg-teal-50', hoverText: 'group-hover:text-teal-700' },
        { name: 'คลังสินค้า & สต็อก', path: '/inventory', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />, bgColor: 'bg-indigo-100', textColor: 'text-indigo-600', hoverBg: 'hover:bg-indigo-50', hoverText: 'group-hover:text-indigo-700' }
      ]
    },
    {
      title: 'ตั้งค่าระบบ',
      items: [
        { name: 'จัดการบัญชีแอดมิน', path: '/admin/users', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />, bgColor: 'bg-rose-100', textColor: 'text-rose-600', hoverBg: 'hover:bg-rose-50', hoverText: 'group-hover:text-rose-700' },
        { name: 'ประวัติการใช้งาน', path: '/history', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />, bgColor: 'bg-slate-100', textColor: 'text-slate-600', hoverBg: 'hover:bg-slate-50', hoverText: 'group-hover:text-slate-700' },
        { name: 'สำรองข้อมูล (Backup)', path: '/backup', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />, bgColor: 'bg-gray-100', textColor: 'text-gray-600', hoverBg: 'hover:bg-gray-50', hoverText: 'group-hover:text-gray-700' }
      ]
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
        <div className="w-12 h-12 border-4 border-stone-200 border-t-orange-500 rounded-full animate-spin mb-4"></div>
        <p className="text-stone-500 font-bold text-sm tracking-wide">กำลังโหลดระบบ...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">
      
      {/* ========================================== */}
      {/* 🌟 1. Premium Sidebar */}
      {/* ========================================== */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-stone-200 shadow-sm transform transition-transform duration-300 ease-in-out flex flex-col md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        
        {/* 🌟 โลโก้ (ขยายขนาด & จับแยก 2 บรรทัด) */}
        <div className="py-6 px-5 flex items-center gap-3.5 shrink-0 bg-white border-b border-stone-50">
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="w-12 h-12 object-contain border border-stone-100 rounded-full p-0.5 shadow-sm shrink-0" 
            onError={(e) => e.currentTarget.style.display = 'none'} 
          />
          <div className="flex flex-col justify-center gap-0.5">
            <span className="text-[16px] font-black text-stone-800 leading-none tracking-tight">ไร่อ้อย</span>
            <span className="text-[15px] font-black text-orange-600 leading-none tracking-tight">จรุงพัฒนานนท์</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden ml-auto text-stone-400 p-1.5 bg-stone-50 rounded-lg hover:text-stone-600">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* เมนู */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-hide">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 px-3">{group.title}</h3>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <button 
                    key={item.name}
                    onClick={() => router.push(item.path)} 
                    className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-xl text-stone-500 font-semibold text-[13px] transition-all duration-200 group outline-none ${item.hoverBg}`}
                  >
                    {/* กล่อง Icon */}
                    <div className={`relative z-10 w-8 h-8 rounded-[10px] ${item.bgColor} ${item.textColor} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-sm`}>
                      <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {item.icon}
                      </svg>
                    </div>
                    
                    <span className={`relative z-10 truncate tracking-wide transition-colors ${item.hoverText}`}>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ผู้ใช้งาน */}
        <div className="p-4 border-t border-stone-100 bg-white shrink-0">
          <div className="flex items-center justify-between p-2 rounded-xl border border-transparent hover:border-stone-200 hover:shadow-sm hover:bg-stone-50 transition-all cursor-default group">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-black border border-stone-200 shadow-inner shrink-0 group-hover:text-orange-500 group-hover:border-orange-200 transition-colors">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 pr-2">
                <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-1">แอดมิน</p>
                <p className="text-xs font-black text-stone-800 truncate leading-none">{userName}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="ออกจากระบบ">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay สำหรับมือถือ */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-stone-900/40 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* ========================================== */}
      {/* 🌟 2. Main Content */}
      {/* ========================================== */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto w-full relative scroll-smooth">
        
        {/* Header มือถือ (ขยายโลโก้และจับแยกบรรทัด) */}
        <div className="md:hidden bg-white/90 backdrop-blur-md border-b border-stone-200 p-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="w-10 h-10 object-contain rounded-full border border-stone-100 p-0.5 shadow-sm" onError={(e) => e.currentTarget.style.display = 'none'} />
            <div className="flex flex-col gap-0.5">
              <span className="font-black text-stone-800 text-[14px] leading-none">ไร่อ้อย</span>
              <span className="font-black text-orange-600 text-[14px] leading-none">จรุงพัฒนานนท์</span>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-1.5 bg-white rounded-md text-stone-600 border border-stone-200 shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>

        {/* เนื้อหา Dashboard */}
        <div className="p-6 md:p-8 lg:p-10 w-full max-w-[1400px] mx-auto space-y-6">
          
          {/* ส่วนหัวทักทาย */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
            <div>
              <h2 className="text-2xl lg:text-3xl font-black text-stone-900 tracking-tight mb-2">
                สวัสดี, <span className="text-orange-600">{userName}</span> 👋
              </h2>
              <p className="text-sm text-stone-500 font-medium flex items-center gap-1.5">
                <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                ภาพรวมการทำงานประจำวันที่ <span className="font-bold text-stone-800">{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </p>
            </div>
            <div className="hidden lg:flex px-4 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 text-[11px] font-bold text-emerald-700 items-center gap-2 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              ระบบซิงค์ข้อมูลล่าสุดแล้ว
            </div>
          </div>

          {/* แบนเนอร์ */}
          <div className="w-full max-w-[900px] mx-auto mb-2 flex justify-center">
            <img 
              src="/farm-banner.jpg" 
              alt="แบนเนอร์ไร่อ้อยจรุงพัฒนานนท์" 
              className="w-full h-auto object-contain drop-shadow-xl" 
            />
          </div>

          {/* 4 กล่องสรุปตัวเลข */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-6 rounded-[1.5rem] border border-stone-200 shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/50">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <p className="text-[12px] font-bold text-stone-500 tracking-wide">พนักงานมาทำงาน</p>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-stone-900">{stats.presentToday}</h3>
                <span className="text-xs font-bold text-stone-400">/ {stats.totalEmployees} คน</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[1.5rem] border border-stone-200 shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100/50">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-[12px] font-bold text-stone-500 tracking-wide">รายการค้างเบิกเงิน</p>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-amber-500">{stats.advanceRequests}</h3>
                <span className="text-xs font-bold text-stone-400">รายการ</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[1.5rem] border border-stone-200 shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1 overflow-hidden">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100/50">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-[12px] font-bold text-stone-500 tracking-wide">แปลงที่กำลังตัด</p>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-stone-900 truncate leading-tight" title={stats.harvestingPlots}>{stats.harvestingPlots}</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[1.5rem] border border-stone-200 shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100/50">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-[12px] font-bold text-stone-500 tracking-wide">ค่าแรงประเมินวันนี้</p>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-rose-600">฿ {stats.estimatedWageToday.toLocaleString()}</h3>
              </div>
            </div>
          </div>

          {/* เมนูด่วน */}
          <div className="pt-4">
            <h3 className="text-lg font-black text-stone-800 mb-4 flex items-center gap-3">
              🚀 เมนูจัดการด่วน
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              
              <button onClick={() => router.push('/sugarcane')} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all flex items-center gap-4 text-left group">
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100/50 group-hover:scale-105 transition-transform shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
                </div>
                <div>
                  <h4 className="font-bold text-stone-800 text-[14px] group-hover:text-orange-600 transition-colors">ระบบคำนวณเงินค่าอ้อย</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">ลงบิล ตัดยอด สรุปเงิน</p>
                </div>
              </button>

              <button onClick={() => router.push('/attendance')} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all flex items-center gap-4 text-left group">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/50 group-hover:scale-105 transition-transform shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                </div>
                <div>
                  <h4 className="font-bold text-stone-800 text-[14px] group-hover:text-emerald-600 transition-colors">เช็คชื่อเข้างาน</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">บันทึกเวลาทำงานรายวัน</p>
                </div>
              </button>

              <button onClick={() => router.push('/executive-dashboard')} className="bg-stone-900 p-5 rounded-2xl border border-stone-800 shadow-md hover:shadow-lg hover:shadow-stone-900/20 transition-all flex items-center gap-4 text-left group">
                <div className="w-12 h-12 rounded-xl bg-white/10 text-white flex items-center justify-center group-hover:bg-orange-500 group-hover:scale-105 transition-all shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2M4 21h16a2 2 0 002-2V5a2 2 0 00-2-2H4a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <h4 className="font-bold text-white text-[14px]">แดชบอร์ดผู้บริหาร</h4>
                  <p className="text-[11px] text-stone-400 mt-0.5">ดูสรุปรายได้และคลังสินค้า</p>
                </div>
              </button>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}