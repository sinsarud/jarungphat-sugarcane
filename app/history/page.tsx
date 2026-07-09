'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ActivityLog {
  id: number;
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

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch' }),
      });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // ฟังก์ชันแปลงวันที่ให้ดูง่ายๆ แบบไทย
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('th-TH', { 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit'
    });
  };

  // กรองข้อมูลตามที่ค้นหา
  const filteredLogs = logs.filter(log => 
    log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // กำหนดสีของป้ายกำกับ (Badge) ตามประเภทการกระทำ
  const getActionColor = (action: string) => {
    if (action.includes('เพิ่ม') || action === 'CREATE') return 'bg-emerald-100 text-emerald-700';
    if (action.includes('แก้') || action === 'UPDATE') return 'bg-blue-100 text-blue-700';
    if (action.includes('ลบ') || action === 'DELETE') return 'bg-rose-100 text-rose-700';
    return 'bg-stone-100 text-stone-700';
  };

  return (
    <div className="min-h-screen bg-[#FCFBF7] pb-16 font-sans relative">
      
      {/* 🌟 Header Bar */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button onClick={() => router.push('/')} className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors shrink-0">
              <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-stone-800 leading-tight">ประวัติการใช้งานระบบ</h1>
              <p className="text-[10px] sm:text-xs text-stone-500 mt-0.5 uppercase tracking-wide">System Activity Logs</p>
            </div>
          </div>
          <div className="w-full sm:w-72">
             <input 
                type="text" 
                placeholder="ค้นหาชื่อ, หมวดหมู่, หรือรายละเอียด..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#5244e1] transition-all"
              />
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 mt-6 sm:mt-8">
        <div className="bg-white rounded-[2rem] border border-stone-200 shadow-sm p-4 sm:p-6 lg:p-8">
          
          <div className="flex justify-between items-center mb-6 px-2">
            <h2 className="text-lg font-black text-stone-800">รายการย้อนหลังทั้งหมด</h2>
            <button onClick={fetchLogs} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
              🔄 รีเฟรช
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#5244e1] border-t-transparent rounded-full animate-spin"></div></div>
          ) : (
            <>
              {/* 📱 MOBILE VIEW: แบบการ์ด */}
              <div className="block md:hidden space-y-3">
                {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 rounded-2xl border bg-white border-stone-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-stone-400 bg-stone-50 px-2 py-0.5 rounded-md">{log.module}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${getActionColor(log.action)}`}>{log.action}</span>
                    </div>
                    <p className="text-sm font-bold text-stone-700 leading-snug">{log.details}</p>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-stone-100">
                      <span className="text-xs font-black text-[#5244e1]">@{log.username}</span>
                      <span className="text-[10px] font-bold text-stone-400">{formatDate(log.created_at)}</span>
                    </div>
                  </div>
                )) : <div className="text-center py-8 text-stone-400 font-bold text-sm">ไม่พบข้อมูลประวัติ</div>}
              </div>

              {/* 💻 DESKTOP VIEW: แบบตาราง */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                      <th className="py-3 px-4">วัน-เวลา</th>
                      <th className="py-3 px-4">ผู้ใช้งาน</th>
                      <th className="py-3 px-4">หมวดหมู่ระบบ</th>
                      <th className="py-3 px-4">การกระทำ</th>
                      <th className="py-3 px-4">รายละเอียด</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-medium text-stone-700 divide-y divide-stone-100">
                    {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                        <td className="py-4 px-4 text-xs font-bold text-stone-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                        <td className="py-4 px-4 font-black text-[#5244e1]">@{log.username}</td>
                        <td className="py-4 px-4"><span className="text-xs font-bold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg">{log.module}</span></td>
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black inline-block ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-stone-600 font-bold">{log.details}</td>
                      </tr>
                    )) : <tr><td colSpan={5} className="text-center py-12 text-stone-400 font-bold">ไม่พบข้อมูลประวัติ</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}