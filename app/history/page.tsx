'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface ActivityLog {
  id: string | number;
  created_at: string;
  username: string;
  module: string;
  action: string;
  details: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 🎛️ Filter & Limit States
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | '7DAYS' | '30DAYS'>('ALL');
  const [rowLimit, setRowLimit] = useState<number>(100);
  
  // 🪟 Notification Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  const showToast = useCallback((message: string, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3500);
  }, []);

  // 🔄 ระบบดึงข้อมูลจริง (Smart Fetch with Fallback & Normalization)
  const fetchLogs = useCallback(async (isRefresh = false) => {
    setLoading(true);
    let fetchedData: any[] = [];

    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch', limit: rowLimit }),
      });

      if (res.ok) {
        const data = await res.json();
        fetchedData = data.logs || data.data || (Array.isArray(data) ? data : []);
      }
    } catch (apiError) {
      console.warn('API Endpoint ขัดข้อง กำลังสลับไปดึงข้อมูลตรงจาก Supabase...', apiError);
    }

    if (fetchedData.length === 0 && supabase) {
      try {
        const { data: supaLogs, error: supaErr } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(rowLimit);

        if (supaLogs && !supaErr) {
          fetchedData = supaLogs;
        } else {
          const { data: altLogs } = await supabase
            .from('logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(rowLimit);
          if (altLogs) fetchedData = altLogs;
        }
      } catch (supaError) {
        console.error('Supabase fallback failed:', supaError);
      }
    }

    const normalizedLogs: ActivityLog[] = fetchedData.map((item: any, idx: number) => ({
      id: item.id || item.log_id || `log-${idx}-${Date.now()}`,
      created_at: item.created_at || item.timestamp || item.date || new Date().toISOString(),
      username: item.username || item.user_name || item.user || item.created_by || 'System Admin',
      module: item.module || item.category || item.section || 'ระบบทั่วไป',
      action: (item.action || item.action_type || item.event || 'INFO').toUpperCase(),
      details: item.details || item.description || item.message || item.note || 'ไม่มีรายละเอียดระบุไว้',
    }));

    normalizedLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setLogs(normalizedLogs);
    setLoading(false);

    if (isRefresh) {
      showToast('⚡ อัปเดตข้อมูลประวัติล่าสุดเรียบร้อยแล้ว', 'success');
    }
  }, [rowLimit, showToast]);

  // ⚡ Real-time Subscription: ดักจับข้อมูลจริงทันทีที่เกิดขึ้นในระบบ
  useEffect(() => {
    fetchLogs();

    if (!supabase) return;
    const channel = supabase
      .channel('realtime:activity_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        const newLog = payload.new as ActivityLog;
        setLogs((prev) => [newLog, ...prev]);
        
        // ถ้าเป็นแจ้งเตือนความปลอดภัย ให้เด้ง Toast เตือนสีพิเศษ
        if (newLog.action === 'SECURITY') {
          showToast(`🚨 เตือนความปลอดภัย: จาก @${newLog.username}`, 'error');
        } else {
          showToast(`🔔 มีรายการใหม่จาก @${newLog.username}`, 'info');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs, showToast]);

  // 📥 Export CSV รองรับภาษาไทย 100%
  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      showToast('❌ ไม่มีข้อมูลที่ตรงกับเงื่อนไขสำหรับส่งออก', 'error');
      return;
    }

    const headers = ['วัน-เวลาที่บันทึก', 'ผู้ใช้งาน (User)', 'หมวดหมู่ระบบ', 'ประเภทรายการ', 'รายละเอียดการทำรายการ'];
    const rows = filteredLogs.map(l => {
      const dt = formatDateTime(l.created_at);
      return [
        `"${dt.date} ${dt.time}"`,
        `"${l.username}"`,
        `"${l.module}"`,
        `"${l.action}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Audit_Logs_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('📥 ดาวน์โหลดไฟล์รายงาน Audit CSV เรียบร้อยแล้ว!', 'success');
  };

  // 🗓️ แปลงวันที่
  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return { date: '-', time: '-' };
      
      const datePart = date.toLocaleDateString('th-TH', { 
        year: '2-digit', month: 'short', day: 'numeric' 
      });
      const timePart = date.toLocaleTimeString('th-TH', { 
        hour: '2-digit', minute: '2-digit' 
      });
      return { date: datePart, time: `${timePart} น.` };
    } catch {
      return { date: dateString, time: '' };
    }
  };

  // 🎨 จัดการสี ไอคอน และเส้นขอบ รองรับครบ 10 Action แบบ Enterprise
  const getActionMeta = (action: string) => {
    const act = action.toUpperCase();
    
    // 1. กลุ่มสร้าง / เพิ่ม / อนุมัติ (เขียว/ทีล)
    if (act.includes('CREATE') || act.includes('ADD') || act.includes('เพิ่ม') || act.includes('สร้าง') || act.includes('รับเข้า')) {
      return { label: '🟢 เพิ่ม/สร้าง', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', icon: '➕', border: 'border-l-emerald-500', isCritical: false };
    }
    if (act.includes('APPROVE') || act.includes('อนุมัติ')) {
      return { label: '✅ อนุมัติ', bg: 'bg-teal-50 text-teal-700 border-teal-200/80 font-black', icon: '✔', border: 'border-l-teal-500', isCritical: false };
    }

    // 2. กลุ่มแก้ไข / ปรับปรุง (น้ำเงิน/ฟ้า)
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('แก้') || act.includes('ปรับ')) {
      return { label: '🔵 แก้ไข', bg: 'bg-blue-50 text-blue-700 border-blue-200/80', icon: '✎', border: 'border-l-blue-500', isCritical: false };
    }

    // 3. กลุ่มลบ / เบิกออก / ปฏิเสธ (แดง/กุหลาบ)
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('ลบ') || act.includes('เบิกออก')) {
      return { label: '🔴 ลบ/เบิก', bg: 'bg-rose-50 text-rose-700 border-rose-200/80', icon: '🗑️', border: 'border-l-rose-500', isCritical: true };
    }
    if (act.includes('REJECT') || act.includes('ปฏิเสธ')) {
      return { label: '❌ ปฏิเสธ', bg: 'bg-red-50 text-red-700 border-red-200/80 font-black', icon: '✖', border: 'border-l-red-600', isCritical: true };
    }

    // 4. กลุ่มเข้า-ออกระบบ / ความปลอดภัย (ม่วง/ส้มแดง)
    if (act.includes('LOGIN') || act.includes('เข้าสู่ระบบ')) {
      return { label: '🟣 เข้าสู่ระบบ', bg: 'bg-purple-50 text-purple-700 border-purple-200/80', icon: '🔑', border: 'border-l-purple-500', isCritical: false };
    }
    if (act.includes('LOGOUT') || act.includes('ออกจากระบบ')) {
      return { label: '⚪ ออกจากระบบ', bg: 'bg-slate-100 text-slate-600 border-slate-300/80', icon: '🔒', border: 'border-l-slate-400', isCritical: false };
    }
    if (act.includes('SECURITY') || act.includes('FAIL') || act.includes('เตือน') || act.includes('ผิดพลาด')) {
      return { label: '🚨 เตือนภัย', bg: 'bg-amber-100 text-amber-900 border-amber-300 font-black animate-pulse', icon: '⚠️', border: 'border-l-amber-500', isCritical: true };
    }

    // 5. กลุ่มดูข้อมูล / ส่งออกรายงาน (คราม/ฟ้าใส)
    if (act.includes('EXPORT') || act.includes('ดาวน์โหลด') || act.includes('ส่งออก')) {
      return { label: '📥 ส่งออกไฟล์', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 font-bold', icon: '📊', border: 'border-l-indigo-500', isCritical: false };
    }
    if (act.includes('VIEW') || act.includes('ดูข้อมูล')) {
      return { label: '👁️ เปิดดู', bg: 'bg-sky-50 text-sky-700 border-sky-200/80', icon: '🔍', border: 'border-l-sky-400', isCritical: false };
    }

    return { label: act, bg: 'bg-slate-100 text-slate-700 border-slate-200', icon: '📌', border: 'border-l-slate-400', isCritical: false };
  };

  // 🧩 ดึงรายชื่อ Module อัตโนมัติ
  const availableModules = useMemo(() => {
    const mods = new Set(logs.map(l => l.module || 'ทั่วไป'));
    return ['ALL', ...Array.from(mods)];
  }, [logs]);

  // 🔍 ระบบกรองข้อมูลขั้นสูง (Search + Module + Grouped Actions + Date Range)
  const filteredLogs = useMemo(() => {
    const now = new Date().getTime();
    
    return logs.filter(log => {
      // 1. Search
      const matchesSearch = 
        log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase());
      
      // 2. Module
      const matchesModule = selectedModule === 'ALL' || log.module === selectedModule;
      
      // 3. Grouped Action
      let matchesAction = true;
      const act = log.action.toUpperCase();
      if (selectedAction === 'CREATE') matchesAction = act.includes('CREATE') || act.includes('ADD') || act.includes('เพิ่ม') || act.includes('APPROVE');
      else if (selectedAction === 'UPDATE') matchesAction = act.includes('UPDATE') || act.includes('EDIT') || act.includes('แก้');
      else if (selectedAction === 'DELETE') matchesAction = act.includes('DELETE') || act.includes('REMOVE') || act.includes('ลบ') || act.includes('REJECT');
      else if (selectedAction === 'AUTH') matchesAction = act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('เข้าสู่ระบบ');
      else if (selectedAction === 'SECURITY') matchesAction = act.includes('SECURITY') || act.includes('FAIL') || act.includes('เตือน');
      
      // 4. Date Range
      let matchesDate = true;
      const logTime = new Date(log.created_at).getTime();
      if (dateFilter === 'TODAY') {
        matchesDate = new Date(log.created_at).toDateString() === new Date().toDateString();
      } else if (dateFilter === '7DAYS') {
        matchesDate = (now - logTime) <= (7 * 24 * 60 * 60 * 1000);
      } else if (dateFilter === '30DAYS') {
        matchesDate = (now - logTime) <= (30 * 24 * 60 * 60 * 1000);
      }

      return matchesSearch && matchesModule && matchesAction && matchesDate;
    });
  }, [logs, searchTerm, selectedModule, selectedAction, dateFilter]);

  // สถิติสำหรับ Banner
  const todayCount = useMemo(() => {
    const todayStr = new Date().toDateString();
    return logs.filter(l => new Date(l.created_at).toDateString() === todayStr).length;
  }, [logs]);

  // เช็กว่ามีการเปิดใช้ฟิลเตอร์อยู่หรือไม่
  const isFilterActive = searchTerm !== '' || selectedModule !== 'ALL' || selectedAction !== 'ALL' || dateFilter !== 'ALL';

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedModule('ALL');
    setSelectedAction('ALL');
    setDateFilter('ALL');
  };

  if (loading && logs.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin shadow-lg shadow-indigo-600/20"></div>
        <p className="mt-4 text-xs font-bold text-slate-400 tracking-wider uppercase animate-pulse">Loading Audit Trail Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans text-slate-800 antialiased selection:bg-indigo-500 selection:text-white relative">
      
      {/* 🌟 Premium Glassmorphism Header 🌟 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 transition-all">
        <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button 
              onClick={() => router.push('/')} 
              className="p-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-xl transition-all shrink-0 active:scale-95"
              title="กลับหน้าหลัก"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">ประวัติการใช้งานระบบ</h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-full uppercase tracking-wider">Total Audit Pro</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Live Stream
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 mt-1">บันทึกทุกความเคลื่อนไหว 10 มิติการทำงาน ในระบบ ERP เพื่อการตรวจสอบย้อนหลัง</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200/60 text-xs font-bold text-slate-600">
              <span>แสดง:</span>
              <select 
                value={rowLimit} 
                onChange={(e) => setRowLimit(Number(e.target.value))}
                className="bg-transparent font-black text-indigo-600 outline-none cursor-pointer"
              >
                <option value={50}>50 รายการ</option>
                <option value={100}>100 รายการ</option>
                <option value={300}>300 รายการ</option>
                <option value={500}>500 รายการ</option>
              </select>
            </div>

            <button 
              onClick={exportToCSV}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md shadow-slate-900/10 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span>ส่งออก Excel</span>
            </button>

            <button 
              onClick={() => fetchLogs(true)}
              className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center transition-all active:scale-95"
              title="รีเฟรชข้อมูลล่าสุด"
            >
              <svg className={`w-4 h-4 text-indigo-600 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1500px] mx-auto px-4 sm:px-8 mt-6 sm:mt-8 space-y-6">
        
        {/* 🌟 Executive Stats Banner 🌟 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">บันทึกทั้งหมด (ดึงมา)</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{logs.length} <span className="text-xs font-bold text-slate-500">รายการ</span></h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center text-lg shrink-0">📋</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">ความเคลื่อนไหววันนี้</p>
              <h3 className="text-xl sm:text-2xl font-black text-indigo-600 mt-0.5">{todayCount} <span className="text-xs font-bold text-slate-500">ครั้ง</span></h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg shrink-0">⚡</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">รายการเพิ่ม / อนุมัติ</p>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">
                {logs.filter(l => l.action.includes('CREATE') || l.action.includes('ADD') || l.action.includes('APPROVE') || l.action.includes('เพิ่ม')).length} <span className="text-xs font-bold text-slate-500">ครั้ง</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shrink-0">➕</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-rose-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex items-center justify-between bg-gradient-to-br from-rose-50/30 to-white">
            <div>
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                <span>รายการลบ / เตือนภัย</span>
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-rose-600 mt-0.5">
                {logs.filter(l => l.action.includes('DELETE') || l.action.includes('REMOVE') || l.action.includes('SECURITY') || l.action.includes('ลบ')).length} <span className="text-xs font-bold text-slate-500">ครั้ง</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-lg shrink-0 animate-pulse">🚨</div>
          </div>
        </div>

        {/* 🌟 Advanced Search & Smart Grid Filters (อัปเกรดไม่ให้ต้องลากนิ้วเลื่อนในมือถือ) 🌟 */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.03)] space-y-4">
          
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="relative flex-grow max-w-lg">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                type="text"
                placeholder="ค้นหาชื่อผู้ใช้, รายละเอียด, หมวดหมู่..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl sm:rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs sm:text-sm font-semibold"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            {/* ปุ่มกรองเวลา: จัดแบบ Grid 2x2 ในมือถือ กดง่ายๆ ไม่ต้องเลื่อนแนวนอน */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-bold bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60 shrink-0">
              {[
                { id: 'ALL', label: '⏳ ทุกช่วงเวลา' },
                { id: 'TODAY', label: '☀️ วันนี้' },
                { id: '7DAYS', label: '📆 7 วันล่าสุด' },
                { id: '30DAYS', label: '🗓️ 30 วัน' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDateFilter(tab.id as any)}
                  className={`px-3 py-2 sm:py-1.5 rounded-lg transition-all text-center whitespace-nowrap ${
                    dateFilter === tab.id 
                      ? 'bg-indigo-600 text-white shadow-sm font-black' 
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {/* กรองประเภท Action: ปรับเป็น Flex Wrap ปุ่มเรียงต่อกันอัตโนมัติบนมือถือ */}
            <div className="flex flex-wrap gap-1.5 text-xs font-bold">
              {[
                { id: 'ALL', label: '⚡ ทั้งหมด' },
                { id: 'CREATE', label: '🟢 เพิ่ม/สร้าง' },
                { id: 'UPDATE', label: '🔵 แก้ไข' },
                { id: 'DELETE', label: '🔴 ลบ/เบิก' },
                { id: 'AUTH', label: '🟣 เข้า-ออกระบบ' },
                { id: 'SECURITY', label: '🚨 เตือนภัย' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedAction(tab.id)}
                  className={`px-3 py-1.5 sm:py-1 rounded-lg transition-all whitespace-nowrap border ${
                    selectedAction === tab.id 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm font-black' 
                      : 'bg-slate-50/80 text-slate-600 border-slate-200/60 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* กรอง หมวดหมู่: ปรับเป็น Flex Wrap เรียงต่อกัน ไม่ตกขอบ */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">หมวดหมู่:</span>
              {availableModules.map((mod) => (
                <button
                  key={mod}
                  onClick={() => setSelectedModule(mod)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                    selectedModule === mod 
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-black' 
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {mod === 'ALL' ? '📦 ทั้งหมด' : mod}
                </button>
              ))}

              {/* ปุ่มล้างค่าการค้นหา */}
              {isFilterActive && (
                <button
                  onClick={resetFilters}
                  className="px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition-all whitespace-nowrap ml-1"
                  title="ล้างตัวกรองทั้งหมด"
                >
                  ✕ ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>

        </div>

        {/* ======================================================= */}
        {/* 📱 MOBILE VIEW: Sleek Timeline Cards (ล็อกบรรทัดเดียวไม่ให้แตก) 📱 */}
        {/* ======================================================= */}
        <div className="block md:hidden space-y-3">
          {filteredLogs.length > 0 ? filteredLogs.map((log) => {
            const dt = formatDateTime(log.created_at);
            const meta = getActionMeta(log.action);

            return (
              <div 
                key={log.id} 
                className={`p-4 rounded-2xl border shadow-sm relative overflow-hidden border-l-[5px] ${meta.border} transition-all ${
                  meta.isCritical ? 'bg-gradient-to-br from-amber-50/40 via-white to-white border-amber-300' : 'bg-white border-slate-200/80'
                }`}
              >
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 whitespace-nowrap">{log.module}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border whitespace-nowrap ${meta.bg}`}>
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </span>
                  </div>
                  
                  <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap shrink-0 bg-slate-50 px-1.5 py-0.5 rounded">{dt.time}</span>
                </div>

                <p className={`text-xs font-bold leading-relaxed mt-1.5 break-words ${meta.isCritical ? 'text-amber-950 font-black' : 'text-slate-800'}`}>{log.details}</p>
                
                <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-100/80 text-[11px]">
                  <div className="flex items-center gap-1.5 font-black text-indigo-600">
                    <div className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center text-[10px]">👤</div>
                    <span>@{log.username}</span>
                  </div>
                  <span className="font-bold text-slate-400">{dt.date}</span>
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 border-dashed">
              <div className="w-14 h-14 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">📋</div>
              <p className="text-slate-500 font-bold text-sm">ไม่พบข้อมูลประวัติที่ตรงกับเงื่อนไข</p>
              <p className="text-slate-400 text-xs mt-1">ลองเปลี่ยนคำค้นหา หรือกดปุ่ม "ล้างตัวกรอง" เพื่อดูทั้งหมด</p>
            </div>
          )}
        </div>

        {/* ======================================================= */}
        {/* 💻 DESKTOP VIEW: Clean Enterprise Table (ล็อกข้อความบรรทัดเดียว) 💻 */}
        {/* ======================================================= */}
        <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6 whitespace-nowrap">วัน-เวลาที่บันทึก</th>
                  <th className="py-4 px-6 whitespace-nowrap">ผู้ใช้งาน (User)</th>
                  <th className="py-4 px-6 whitespace-nowrap">หมวดหมู่ระบบ</th>
                  <th className="py-4 px-6 text-center whitespace-nowrap">ประเภทรายการ</th>
                  <th className="py-4 px-6">รายละเอียดการทำรายการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                {filteredLogs.length > 0 ? filteredLogs.map((log) => {
                  const dt = formatDateTime(log.created_at);
                  const meta = getActionMeta(log.action);
                  const initial = log.username ? log.username.charAt(0).toUpperCase() : '?';

                  return (
                    <tr key={log.id} className={`transition-colors group ${meta.isCritical ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-slate-50/60'}`}>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="font-bold text-slate-800 text-xs">{dt.date}</div>
                        <div className="text-[11px] font-semibold text-slate-400 mt-0.5">{dt.time}</div>
                      </td>

                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm ${
                            meta.isCritical ? 'bg-gradient-to-br from-amber-500 to-rose-600 shadow-rose-500/20' : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/10'
                          }`}>
                            {initial}
                          </div>
                          <span className="font-black text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                            @{log.username}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/80 whitespace-nowrap">
                          {log.module}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border whitespace-nowrap ${meta.bg}`}>
                          <span>{meta.icon}</span>
                          <span>{meta.label}</span>
                        </span>
                      </td>

                      <td className={`py-4 px-6 font-bold text-xs leading-relaxed break-words max-w-xl ${meta.isCritical ? 'text-amber-950 font-black' : 'text-slate-800'}`}>
                        {log.details}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">📋</div>
                      <p className="text-slate-500 font-bold text-base">ไม่พบประวัติการใช้งานที่ค้นหา</p>
                      <p className="text-slate-400 text-xs mt-1">ลองตรวจสอบคำค้นหา หรือเลือกตัวกรองใหม่อีกครั้ง</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* ======================================================= */}
      {/* 🌟 NOTIFICATION TOAST (แจ้งเตือนมุมล่างขวา) 🌟 */}
      {/* ======================================================= */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-[150] animate-in fade-in slide-in-from-bottom-5 duration-200 max-w-sm">
          <div className={`text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            toast.type === 'error' ? 'bg-rose-600 border-rose-500 animate-bounce' : 'bg-slate-900 border-slate-800'
          }`}>
            <span className="text-lg">{toast.type === 'error' ? '🚨' : '⚡'}</span>
            <p className="text-xs font-bold leading-snug">{toast.message}</p>
          </div>
        </div>
      )}

      {/* ซ่อน Scrollbar แนวนอน */}
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}