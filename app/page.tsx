'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { useRouter } from 'next/navigation';
import WeatherWidget from './WeatherWidget'; // 🌟 Import Weather Widget เข้ามาใช้งาน

// 🌟 คลังรวมเมนูทั้งหมด (เพิ่มเมนู GPS รถสิบล้อแล้ว!)
const ALL_SHORTCUTS = [
  { id: 'sugarcane', name: 'คำนวณค่าอ้อย', desc: 'ลงบิล สรุปเงิน', path: '/sugarcane', color: 'orange', roles: ['programmer', 'admin', 'clerk'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /> },
  { id: 'attendance', name: 'เช็คชื่อเข้างาน', desc: 'บันทึกเวลาทำงาน', path: '/attendance', color: 'emerald', roles: ['programmer', 'admin', 'clerk', 'foreman'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /> },
  { id: 'plot-activities', name: 'กิจกรรมแปลง', desc: 'บันทึกไถ ปลูก ปุ๋ย', path: '/plot-activities', color: 'teal', roles: ['programmer', 'admin', 'foreman'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /> },
  { id: 'machinery', name: 'เครื่องจักร', desc: 'คุมสต็อกรถ เช็กชั่วโมง', path: '/machinery', color: 'amber', roles: ['programmer', 'admin', 'foreman'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /> },
  { id: 'maintenance', name: 'ประวัติซ่อม', desc: 'บันทึกซ่อม เช็กระยะ', path: '/maintenance', color: 'amber', roles: ['programmer', 'admin', 'foreman'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /> },
  { id: 'expenses', name: 'บันทึกรายจ่าย', desc: 'ลงบิลน้ำมัน ปุ๋ย', path: '/expenses', color: 'rose', roles: ['programmer', 'admin', 'clerk'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { id: 'executive', name: 'ผู้บริหาร', desc: 'ดูสรุปกำไรสุทธิ', path: '/executive-dashboard', color: 'slate', roles: ['programmer', 'admin'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2M4 21h16a2 2 0 002-2V5a2 2 0 00-2-2H4a2 2 0 00-2 2v14a2 2 0 002 2z" /> },
  { id: 'payroll', name: 'คิดเงินสด', desc: 'เบิกจ่ายคนงาน', path: '/payroll', color: 'purple', roles: ['programmer', 'admin', 'clerk'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
  { id: 'plots', name: 'จัดการแปลง', desc: 'สถานะแปลงอ้อย', path: '/plots', color: 'teal', roles: ['programmer', 'admin', 'foreman'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { id: 'inventory', name: 'สต็อกคลัง', desc: 'วัตถุดิบและอะไหล่', path: '/inventory', color: 'indigo', roles: ['programmer', 'admin', 'clerk', 'foreman'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> },
  { id: 'fleet', name: 'ระบบคิวรถ GPS', desc: 'ติดตามรถบรรทุก', path: '/fleet', color: 'indigo', roles: ['programmer', 'admin', 'foreman'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10c0 .55.45 1 1 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /> },
  { id: 'admin-roles', name: 'จัดการสิทธิ์', desc: 'ตั้งค่า Roles & Permissions', path: '/admin/roles', color: 'purple', roles: ['programmer'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /> },
];

const DEFAULT_SHORTCUT_IDS = ['sugarcane', 'attendance', 'plot-activities', 'machinery', 'fleet', 'maintenance', 'expenses', 'executive'];

const getStyleByColor = (color: string, isExecutive = false) => {
  if (isExecutive) {
    return { wrapper: 'bg-stone-900 border-stone-800 text-white hover:shadow-xl hover:shadow-stone-900/20 hover:border-orange-500', iconBox: 'bg-white/10 text-white border-white/5 group-hover:bg-gradient-to-br group-hover:from-orange-400 group-hover:to-orange-600 group-hover:border-orange-400', title: 'text-white', desc: 'text-stone-400' };
  }
  const styles: Record<string, any> = {
    orange: { wrapper: 'bg-white border-stone-200 hover:border-orange-300 hover:shadow-orange-500/10', iconBox: 'bg-orange-50 text-orange-600 border-orange-100/50 group-hover:bg-gradient-to-br group-hover:from-orange-400 group-hover:to-orange-600 group-hover:text-white group-hover:border-orange-400', title: 'text-stone-800 group-hover:text-orange-600', desc: 'text-stone-500' },
    emerald: { wrapper: 'bg-white border-stone-200 hover:border-emerald-300 hover:shadow-emerald-500/10', iconBox: 'bg-emerald-50 text-emerald-600 border-emerald-100/50 group-hover:bg-gradient-to-br group-hover:from-emerald-400 group-hover:to-emerald-600 group-hover:text-white group-hover:border-emerald-400', title: 'text-stone-800 group-hover:text-emerald-600', desc: 'text-stone-500' },
    teal: { wrapper: 'bg-white border-stone-200 hover:border-teal-300 hover:shadow-teal-500/10', iconBox: 'bg-teal-50 text-teal-600 border-teal-100/50 group-hover:bg-gradient-to-br group-hover:from-teal-400 group-hover:to-teal-600 group-hover:text-white group-hover:border-teal-400', title: 'text-stone-800 group-hover:text-teal-600', desc: 'text-stone-500' },
    amber: { wrapper: 'bg-white border-stone-200 hover:border-amber-300 hover:shadow-amber-500/10', iconBox: 'bg-amber-50 text-amber-600 border-amber-100/50 group-hover:bg-gradient-to-br group-hover:from-amber-400 group-hover:to-amber-600 group-hover:text-white group-hover:border-amber-400', title: 'text-stone-800 group-hover:text-amber-600', desc: 'text-stone-500' },
    rose: { wrapper: 'bg-white border-stone-200 hover:border-rose-300 hover:shadow-rose-500/10', iconBox: 'bg-rose-50 text-rose-600 border-rose-100/50 group-hover:bg-gradient-to-br group-hover:from-rose-400 group-hover:to-rose-600 group-hover:text-white group-hover:border-rose-400', title: 'text-stone-800 group-hover:text-rose-600', desc: 'text-stone-500' },
    purple: { wrapper: 'bg-white border-stone-200 hover:border-purple-300 hover:shadow-purple-500/10', iconBox: 'bg-purple-50 text-purple-600 border-purple-100/50 group-hover:bg-gradient-to-br group-hover:from-purple-400 group-hover:to-purple-600 group-hover:text-white group-hover:border-purple-400', title: 'text-stone-800 group-hover:text-purple-600', desc: 'text-stone-500' },
    indigo: { wrapper: 'bg-white border-stone-200 hover:border-indigo-300 hover:shadow-indigo-500/10', iconBox: 'bg-indigo-50 text-indigo-600 border-indigo-100/50 group-hover:bg-gradient-to-br group-hover:from-indigo-400 group-hover:to-indigo-600 group-hover:text-white group-hover:border-indigo-400', title: 'text-stone-800 group-hover:text-indigo-600', desc: 'text-stone-500' },
  };
  return styles[color] || styles.orange;
};

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('clerk');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [activeShortcuts, setActiveShortcuts] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const dragItemRef = useRef<number | null>(null);

  const [stats, setStats] = useState({
    presentToday: 0, totalEmployees: 5, advanceRequests: 0, estimatedWageToday: 0, harvestingPlots: '-' 
  });

  const fetchDashboardData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: attendanceData } = await supabase.from('daily_attendance').select('wage').eq('date', today).neq('work_type', 'ขาด').neq('work_type', 'LA');
    const presentCount = attendanceData ? attendanceData.length : 0;
    const wageSum = attendanceData ? attendanceData.reduce((sum, record) => sum + Number(record.wage || 0), 0) : 0;
    const { count: advanceCount } = await supabase.from('advance_payments').select('*', { count: 'exact', head: true });
    const { data: plotsData } = await supabase.from('plots').select('code').eq('status', 'harvesting');
    const harvestingCodes = plotsData && plotsData.length > 0 ? plotsData.map((p: any) => p.code).join(', ') : '-';

    setStats({ presentToday: presentCount, totalEmployees: 5, advanceRequests: advanceCount || 0, estimatedWageToday: wageSum, harvestingPlots: harvestingCodes });
  };

  useEffect(() => {
    async function initDashboard() {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) return router.push('/login');

      // 🌟 ดึงข้อมูล role พร้อมชื่อและนามสกุล มาแสดงผล
      const { data: profile } = await supabase.from('profiles').select('role, first_name, last_name').eq('id', session.user.id).single();
      const role = profile?.role || 'clerk';
      setCurrentUserRole(role);

      // กำหนดชื่อ Display Name
      const fullName = profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : (session.user.email?.split('@')[0] || 'ผู้ใช้งาน');
      setUserName(fullName);

      const savedShortcuts = localStorage.getItem(`erp_quick_shortcuts_${role}`);
      if (savedShortcuts) {
        const parsed = JSON.parse(savedShortcuts);
        setActiveShortcuts(parsed.filter((id: string) => ALL_SHORTCUTS.find(s => s.id === id)?.roles.includes(role)));
      } else {
        setActiveShortcuts(DEFAULT_SHORTCUT_IDS.filter((id: string) => ALL_SHORTCUTS.find(s => s.id === id)?.roles.includes(role)));
      }

      await fetchDashboardData();
      loading && setLoading(false);
    }
    initDashboard();

    const channel = supabase.channel('dashboard_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_attendance' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advance_payments' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plots' }, fetchDashboardData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [router]);

  useEffect(() => {
    if (activeShortcuts.length > 0) {
      localStorage.setItem(`erp_quick_shortcuts_${currentUserRole}`, JSON.stringify(activeShortcuts));
    }
  }, [activeShortcuts, currentUserRole]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleDragStart = (index: number) => { dragItemRef.current = index; };
  const handleDragEnter = (index: number) => {
    if (dragItemRef.current !== null && dragItemRef.current !== index) {
      const newShortcuts = [...activeShortcuts];
      const draggedItem = newShortcuts.splice(dragItemRef.current, 1)[0];
      newShortcuts.splice(index, 0, draggedItem);
      setActiveShortcuts(newShortcuts);
      dragItemRef.current = index;
    }
  };
  const handleDragEnd = () => { dragItemRef.current = null; };

  const handleTouchStart = (index: number) => { dragItemRef.current = index; };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isEditMode || dragItemRef.current === null) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetBox = element?.closest('[data-index]');
    
    if (targetBox) {
      const hoverIndex = parseInt(targetBox.getAttribute('data-index') || '-1', 10);
      if (hoverIndex !== -1 && hoverIndex !== dragItemRef.current) {
        const newShortcuts = [...activeShortcuts];
        const draggedItem = newShortcuts.splice(dragItemRef.current, 1)[0];
        newShortcuts.splice(hoverIndex, 0, draggedItem);
        setActiveShortcuts(newShortcuts);
        dragItemRef.current = hoverIndex;
      }
    }
  };
  const handleTouchEnd = () => { dragItemRef.current = null; };

  const handleRemoveShortcut = (idToRemove: string) => setActiveShortcuts(prev => prev.filter(id => id !== idToRemove));
  const handleAddShortcut = (idToAdd: string) => { setActiveShortcuts(prev => [...prev, idToAdd]); setShowAddModal(false); };

  // 🌟 เมนูต่างๆ (เพิ่มการติดตามรถเข้าหมวดปฏิบัติการ)
  const menuGroups = [
    { title: 'ผู้บริหาร & สรุปผล', items: [
      { name: 'แดชบอร์ดผู้บริหาร', path: '/executive-dashboard', roles: ['programmer', 'admin'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 8v8m-4-5v5m-4-2v2M4 21h16a2 2 0 002-2V5a2 2 0 00-2-2H4a2 2 0 00-2 2v14a2 2 0 002 2z" />, bgColor: 'bg-amber-100', textColor: 'text-amber-600', hoverBg: 'hover:bg-amber-50', hoverText: 'group-hover:text-amber-700' }, 
      { name: 'คำนวณเงินค่าอ้อย', path: '/sugarcane', roles: ['programmer', 'admin', 'clerk'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />, bgColor: 'bg-orange-100', textColor: 'text-orange-600', hoverBg: 'hover:bg-orange-50', hoverText: 'group-hover:text-orange-700' }, 
      { name: 'บันทึกค่าใช้จ่าย', path: '/expenses', roles: ['programmer', 'admin', 'clerk'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />, bgColor: 'bg-rose-100', textColor: 'text-rose-600', hoverBg: 'hover:bg-rose-50', hoverText: 'group-hover:text-rose-700' }
    ] },
    { title: 'บุคคล & ค่าแรง', items: [
      { name: 'เช็คชื่อเข้างาน', path: '/attendance', roles: ['programmer', 'admin', 'clerk', 'foreman'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />, bgColor: 'bg-emerald-100', textColor: 'text-emerald-600', hoverBg: 'hover:bg-emerald-50', hoverText: 'group-hover:text-emerald-700' }, 
      { name: 'คิดเงินสดรายคน', path: '/payroll', roles: ['programmer', 'admin', 'clerk'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />, bgColor: 'bg-purple-100', textColor: 'text-purple-600', hoverBg: 'hover:bg-purple-50', hoverText: 'group-hover:text-purple-700' }, 
      { name: 'เบิกเงินล่วงหน้า', path: '/advance', roles: ['programmer', 'admin', 'clerk'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />, bgColor: 'bg-yellow-100', textColor: 'text-yellow-600', hoverBg: 'hover:bg-yellow-50', hoverText: 'group-hover:text-yellow-700' }, 
      { name: 'ฐานข้อมูลพนักงาน', path: '/employees', roles: ['programmer', 'admin', 'clerk'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />, bgColor: 'bg-blue-100', textColor: 'text-blue-600', hoverBg: 'hover:bg-blue-50', hoverText: 'group-hover:text-blue-700' }
    ] },
    { title: 'ปฏิบัติการไร่ & คลัง', items: [
      { name: 'จัดการแปลงอ้อย', path: '/plots', roles: ['programmer', 'admin', 'foreman'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />, bgColor: 'bg-teal-100', textColor: 'text-teal-600', hoverBg: 'hover:bg-teal-50', hoverText: 'group-hover:text-teal-700' }, 
      { name: 'กิจกรรมรายแปลง', path: '/plot-activities', roles: ['programmer', 'admin', 'foreman'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />, bgColor: 'bg-teal-100', textColor: 'text-teal-600', hoverBg: 'hover:bg-teal-50', hoverText: 'group-hover:text-teal-700' }, 
      { name: 'คลังสินค้า & สต็อก', path: '/inventory', roles: ['programmer', 'admin', 'clerk', 'foreman'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />, bgColor: 'bg-indigo-100', textColor: 'text-indigo-600', hoverBg: 'hover:bg-indigo-50', hoverText: 'group-hover:text-indigo-700' }, 
      { name: 'เครื่องจักร & ยานพาหนะ', path: '/machinery', roles: ['programmer', 'admin', 'foreman'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />, bgColor: 'bg-amber-100', textColor: 'text-amber-600', hoverBg: 'hover:bg-amber-50', hoverText: 'group-hover:text-amber-700' }, 
      { name: 'ประวัติซ่อมบำรุงรถ', path: '/maintenance', roles: ['programmer', 'admin', 'foreman'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />, bgColor: 'bg-amber-100', textColor: 'text-amber-600', hoverBg: 'hover:bg-amber-50', hoverText: 'group-hover:text-amber-700' },
      { name: 'ติดตามรถสิบล้อ (GPS)', path: '/fleet', roles: ['programmer', 'admin', 'foreman'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10c0 .55.45 1 1 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />, bgColor: 'bg-indigo-100', textColor: 'text-indigo-600', hoverBg: 'hover:bg-indigo-50', hoverText: 'group-hover:text-indigo-700' }
    ] },
    { title: 'ตั้งค่าระบบ', items: [
      { name: 'จัดการบัญชีผู้ใช้งาน', path: '/admin/users', roles: ['programmer', 'admin'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />, bgColor: 'bg-rose-100', textColor: 'text-rose-600', hoverBg: 'hover:bg-rose-50', hoverText: 'group-hover:text-rose-700' }, 
      { name: 'ประวัติการใช้งาน', path: '/history', roles: ['programmer', 'admin'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />, bgColor: 'bg-slate-100', textColor: 'text-slate-600', hoverBg: 'hover:bg-slate-50', hoverText: 'group-hover:text-slate-700' }, 
      { name: 'จัดการสิทธิ์ (Roles)', path: '/admin/roles', roles: ['programmer'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />, bgColor: 'bg-violet-100', textColor: 'text-violet-600', hoverBg: 'hover:bg-violet-50', hoverText: 'group-hover:text-violet-700' },
      { name: 'สำรองข้อมูล (Backup)', path: '/backup', roles: ['programmer'], icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />, bgColor: 'bg-gray-100', textColor: 'text-gray-600', hoverBg: 'hover:bg-gray-50', hoverText: 'group-hover:text-gray-700' }
    ] }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
        <div className="w-12 h-12 border-4 border-stone-200 border-t-orange-500 rounded-full animate-spin mb-4"></div>
        <p className="text-stone-500 font-bold text-sm tracking-wide">กำลังโหลดระบบ...</p>
      </div>
    );
  }

  const roleNameDisplay = currentUserRole === 'programmer' ? 'PROGRAMMER' : currentUserRole === 'admin' ? 'ADMIN' : currentUserRole === 'foreman' ? 'FOREMAN' : 'CLERK';
  const roleColor = currentUserRole === 'programmer' ? 'text-slate-100 bg-slate-800 border-slate-700' : currentUserRole === 'admin' ? 'text-rose-500 bg-rose-50 border-rose-200' : currentUserRole === 'foreman' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-blue-500 bg-blue-50 border-blue-200';

  const availableToAdd = ALL_SHORTCUTS.filter(s => s.roles.includes(currentUserRole) && !activeShortcuts.includes(s.id));

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">
      
      <style jsx global>{`
        @keyframes jiggle {
          0% { transform: rotate(-1.5deg); }
          50% { transform: rotate(1.5deg) scale(1.02); }
          100% { transform: rotate(-1.5deg); }
        }
        .animate-jiggle { animation: jiggle 0.25s infinite; transform-origin: center; }
      `}</style>

      {/* ========================================== */}
      {/* 🌟 1. Premium Sidebar */}
      {/* ========================================== */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-stone-200 shadow-sm transform transition-transform duration-300 ease-in-out flex flex-col md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="py-6 px-5 flex items-center gap-3.5 shrink-0 bg-white border-b border-stone-50">
          <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain border border-stone-100 rounded-full p-0.5 shadow-sm shrink-0" onError={(e) => e.currentTarget.style.display = 'none'} />
          <div className="flex flex-col justify-center gap-0.5">
            <span className="text-[16px] font-black text-stone-800 leading-none tracking-tight">ไร่อ้อย</span>
            <span className="text-[15px] font-black text-orange-600 leading-none tracking-tight">จรุงพัฒนานนท์</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden ml-auto text-stone-400 p-1.5 bg-stone-50 rounded-lg hover:text-stone-600">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-hide">
          {menuGroups.map((group, idx) => {
            const filteredItems = group.items.filter(item => item.roles.includes(currentUserRole));
            if (filteredItems.length === 0) return null;

            return (
              <div key={idx}>
                <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 px-3">{group.title}</h3>
                <div className="space-y-0.5">
                  {filteredItems.map(item => (
                    <button key={item.name} onClick={() => router.push(item.path)} className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-xl text-stone-500 font-semibold text-[13px] transition-all duration-200 group outline-none ${item.hoverBg}`}>
                      <div className={`relative z-10 w-8 h-8 rounded-[10px] ${item.bgColor} ${item.textColor} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-sm`}>
                        <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">{item.icon}</svg>
                      </div>
                      <span className={`relative z-10 truncate tracking-wide transition-colors ${item.hoverText}`}>{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-stone-100 bg-white shrink-0">
          <div className="flex items-center justify-between p-2 rounded-xl border border-transparent hover:border-stone-200 hover:shadow-sm hover:bg-stone-50 transition-all cursor-default group">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-black border border-stone-200 shadow-inner shrink-0 group-hover:text-orange-500 group-hover:border-orange-200 transition-colors">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 pr-2">
                <span className={`inline-block text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border mb-1 whitespace-nowrap ${roleColor}`}>
                  {roleNameDisplay}
                </span>
                <p className="text-xs font-black text-stone-800 truncate leading-none" title={userName}>{userName}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="ออกจากระบบ">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-stone-900/40 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* ========================================== */}
      {/* 🌟 2. Main Content */}
      {/* ========================================== */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto w-full relative scroll-smooth">
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

        <div className="p-4 md:p-8 lg:p-10 w-full max-w-[1400px] mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2 px-2 sm:px-0">
            <div>
              <h2 className="text-2xl lg:text-3xl font-black text-stone-900 tracking-tight mb-2">
                สวัสดี, <span className="text-orange-600">{userName}</span> 👋
              </h2>
              <p className="text-sm text-stone-500 font-medium flex items-center gap-1.5">
                <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                ภาพรวมการทำงานประจำวันที่ <span className="font-bold text-stone-800">{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </p>
            </div>
          </div>

          <div className="w-full max-w-[900px] mx-auto mb-2 flex justify-center">
            <img src="/farm-banner.jpg" alt="แบนเนอร์ไร่อ้อยจรุงพัฒนานนท์" className="w-full h-auto object-contain drop-shadow-xl" />
          </div>

          {(currentUserRole === 'programmer' || currentUserRole === 'admin' || currentUserRole === 'clerk') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2 sm:px-0">
              <div className="bg-white p-6 rounded-[1.5rem] border border-stone-200 shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/50"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg></div>
                  <p className="text-[12px] font-bold text-stone-500 tracking-wide">พนักงานมาทำงาน</p>
                </div>
                <div className="flex items-baseline gap-2"><h3 className="text-3xl font-black text-stone-900">{stats.presentToday}</h3><span className="text-xs font-bold text-stone-400">/ {stats.totalEmployees} คน</span></div>
              </div>
              <div className="bg-white p-6 rounded-[1.5rem] border border-stone-200 shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100/50"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                  <p className="text-[12px] font-bold text-stone-500 tracking-wide">รายการค้างเบิกเงิน</p>
                </div>
                <div className="flex items-baseline gap-2"><h3 className="text-3xl font-black text-amber-500">{stats.advanceRequests}</h3><span className="text-xs font-bold text-stone-400">รายการ</span></div>
              </div>
              <div className="bg-white p-6 rounded-[1.5rem] border border-stone-200 shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1 overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100/50"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                  <p className="text-[12px] font-bold text-stone-500 tracking-wide">แปลงที่กำลังตัด</p>
                </div>
                <div className="flex items-baseline gap-2"><h3 className="text-2xl font-black text-stone-900 truncate leading-tight" title={stats.harvestingPlots}>{stats.harvestingPlots}</h3></div>
              </div>
              <div className="bg-white p-6 rounded-[1.5rem] border border-stone-200 shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100/50"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg></div>
                  <p className="text-[12px] font-bold text-stone-500 tracking-wide">ค่าแรงประเมินวันนี้</p>
                </div>
                <div className="flex items-baseline gap-2"><h3 className="text-3xl font-black text-rose-600">฿ {stats.estimatedWageToday.toLocaleString()}</h3></div>
              </div>
            </div>
          )}

          {/* ========================================= */}
          {/* ⛅ วิดเจ็ตพยากรณ์อากาศ (Weather Widget) */}
          {/* ========================================= */}
          <div className="w-full px-2 sm:px-0 mt-2 mb-4">
            <WeatherWidget />
          </div>

          <div className="pt-4 px-2 sm:px-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-stone-800 flex items-center gap-3">🚀 เมนูจัดการด่วน</h3>
              <button 
                onClick={() => setIsEditMode(!isEditMode)} 
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm flex items-center gap-1.5 ${isEditMode ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}
              >
                {isEditMode ? <><span>✅</span> เสร็จสิ้น</> : <><span>✏️</span> ปรับแต่งเมนู</>}
              </button>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-5">
              {activeShortcuts.map((shortcutId, index) => {
                const item = ALL_SHORTCUTS.find(s => s.id === shortcutId);
                if (!item) return null;
                
                const isExecutive = item.id === 'executive';
                const styleClass = getStyleByColor(item.color, isExecutive);

                return (
                  <div key={item.id} data-index={index} draggable={isEditMode} onDragStart={() => handleDragStart(index)} onDragEnter={() => handleDragEnter(index)} onDragEnd={handleDragEnd} onDragOver={(e) => e.preventDefault()} onTouchStart={() => { if(isEditMode) handleTouchStart(index); }} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onClick={() => { if (!isEditMode) router.push(item.path); }} className={`relative w-full p-4 sm:p-5 rounded-3xl border shadow-sm transition-all flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left group select-none ${styleClass.wrapper} ${isEditMode ? 'animate-jiggle cursor-grab touch-none ring-[3px] ring-stone-200/50' : 'cursor-pointer hover:-translate-y-1'}`}>
                    {isEditMode && (
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveShortcut(item.id); }} className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-rose-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md border-[3px] border-white hover:scale-110 z-20">✕</button>
                    )}
                    <div className={`w-14 h-14 sm:w-12 sm:h-12 rounded-[1rem] flex items-center justify-center border transition-all shrink-0 ${styleClass.iconBox} ${!isEditMode && 'group-hover:scale-110 group-hover:rotate-3'}`}>
                      <svg className="w-7 h-7 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">{item.icon}</svg>
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                      <h4 className={`font-black text-[13px] sm:text-[14px] transition-colors truncate ${styleClass.title}`}>{item.name}</h4>
                      <p className={`text-[10px] sm:text-[11px] mt-0.5 truncate ${styleClass.desc} hidden sm:block`}>{item.desc}</p>
                    </div>
                  </div>
                );
              })}

              {isEditMode && availableToAdd.length > 0 && (
                <button onClick={() => setShowAddModal(true)} className="bg-stone-50/80 p-4 sm:p-5 rounded-3xl border-2 border-dashed border-stone-300 hover:border-stone-400 hover:bg-stone-100 transition-all flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-stone-500 group animate-jiggle">
                  <div className="w-12 h-12 sm:w-12 sm:h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <span className="font-bold text-[13px] sm:text-[14px]">เพิ่มเมนู</span>
                </button>
              )}
            </div>
          </div>

        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-stone-100">
              <h3 className="font-black text-lg">➕ เพิ่มเมนูด่วน</h3>
              <button onClick={() => setShowAddModal(false)} className="text-stone-400 hover:text-stone-600 font-black text-xl">✕</button>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {availableToAdd.map(item => {
                const isExecutive = item.id === 'executive';
                const styleClass = getStyleByColor(item.color, isExecutive);

                return (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl border border-stone-100 hover:border-stone-300 hover:bg-stone-50 transition-colors shadow-sm">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center border ${styleClass.iconBox}`}>
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">{item.icon}</svg>
                      </div>
                      <div>
                        <h4 className="font-black text-[14px] text-stone-800">{item.name}</h4>
                        <p className="text-[11px] font-bold text-stone-400 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                    <button onClick={() => handleAddShortcut(item.id)} className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-black hover:bg-orange-500 hover:shadow-md transition-all">เพิ่ม</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>
    </div>
  );
}