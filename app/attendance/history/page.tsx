'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

// 🌟 แก้ไขชื่อตัวแปรให้ตรงกับฐานข้อมูล (emp_name และ note)
interface AttendanceRecord {
  id: number;
  date: string;
  emp_name: string; 
  work_type: string;
  wage: number;
  advance_deduction: number;
  net_wage: number;
  note: string; 
}

export default function AttendanceHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // 🌟 ฟังก์ชันแปลงวันที่ให้อ่านง่าย เช่น "8 ก.ค. 2569"
  const formatDateThai = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const fetchAttendanceHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_attendance')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      alert('ดึงข้อมูลไม่สำเร็จ: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceHistory();
  }, []);

  const exportToExcel = () => {
    if (records.length === 0) {
      alert('ไม่มีข้อมูลในช่วงวันที่เลือกครับ');
      return;
    }

    const excelData = records.map((record, index) => ({
      'ลำดับ': index + 1,
      'วันที่': formatDateThai(record.date), 
      'ชื่อพนักงาน': record.emp_name, 
      'สถานะการมาทำงาน': record.work_type,
      'ค่าแรงรายวัน': record.wage || 0,
      'หักเบิก (บาท)': record.advance_deduction || 0,
      'หมายเหตุ': record.note || '-' 
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ประวัติเช็คชื่อ");

    const fileName = `รายงานเช็คชื่อ_${startDate}_ถึง_${endDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-20 font-sans relative selection:bg-indigo-500 selection:text-white">
      
      {/* 🌟 Header Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1200px] mx-auto px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {/* ปุ่มย้อนกลับ */}
            <button onClick={() => router.push('/attendance')} className="w-11 h-11 bg-white border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl flex items-center justify-center text-slate-500 transition-all shadow-sm shrink-0 group">
              <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            
            <div className="h-8 w-px bg-slate-300 hidden sm:block mx-1"></div>
            
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">ประวัติเช็คชื่อย้อนหลัง</h1>
                <p className="text-[11px] font-bold text-slate-500 leading-none hidden sm:block uppercase tracking-wider">
                  ค้นหาและดาวน์โหลดรายงาน
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-5 sm:px-8 mt-8">
        
        {/* 🌟 กล่องค้นหา (Filter Section) ให้สีเข้มขึ้น มีมิติ */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 mb-8 relative overflow-hidden">
          {/* ขีดเส้นตกแต่งด้านบน */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600"></div>

          <div className="flex flex-col md:flex-row items-end justify-between gap-5 mt-2">
            
            {/* โซนเลือกวันที่ */}
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <div className="flex-1 sm:flex-none">
                <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wide">ตั้งแต่วันที่</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-48 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-900 text-sm shadow-sm cursor-pointer"
                />
              </div>
              <div className="flex-1 sm:flex-none">
                <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wide">ถึงวันที่</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full sm:w-48 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-900 text-sm shadow-sm cursor-pointer"
                />
              </div>
            </div>

            {/* โซนปุ่มกด */}
            <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
              <button 
                onClick={fetchAttendanceHistory}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-all shadow-lg shadow-indigo-600/30 text-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                ค้นหาข้อมูล
              </button>
              <button 
                onClick={exportToExcel}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-white border-2 border-emerald-500 text-emerald-600 font-black rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition-colors shadow-sm text-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4V4" /></svg>
                โหลด Excel
              </button>
            </div>
          </div>
        </div>

        {/* 🌟 ตารางแสดงข้อมูล (เปลี่ยนหัวเป็นสีเข้มให้ตัดชัดเจน ไม่จืด) */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 bg-white flex items-center gap-3 border-b border-slate-200">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
              รายการประวัติการมาทำงาน
            </h2>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">
              {records.length} รายการ
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-24 bg-slate-50"><div className="w-10 h-10 border-4 border-slate-300 border-t-indigo-600 rounded-full animate-spin"></div></div>
          ) : records.length > 0 ? (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[900px]">
                {/* หัวตารางสีเข้ม (Slate-800) */}
                <thead>
                  <tr className="bg-slate-800 text-white text-[12px] font-bold uppercase tracking-widest border-b border-slate-800">
                    <th className="py-4 px-6 w-32 border-r border-slate-700">วันที่</th>
                    <th className="py-4 px-6 border-r border-slate-700">ชื่อพนักงาน</th>
                    <th className="py-4 px-6 border-r border-slate-700 text-center">สถานะ</th>
                    <th className="py-4 px-6 text-right border-r border-slate-700">ค่าแรง (บาท)</th>
                    <th className="py-4 px-6 text-right border-r border-slate-700">หักเบิก (บาท)</th>
                    <th className="py-4 px-6">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-800 divide-y divide-slate-200">
                  {records.map((record) => (
                    // สีสลับแถวให้มองง่ายขึ้น
                    <tr key={record.id} className="bg-white hover:bg-indigo-50/60 transition-colors even:bg-slate-50/50">
                      
                      {/* วันที่ */}
                      <td className="py-4 px-6 text-[13px] font-bold text-slate-600 border-r border-slate-200 whitespace-nowrap">
                        {formatDateThai(record.date)}
                      </td>
                      
                      {/* ชื่อพนักงาน */}
                      <td className="py-4 px-6 font-black text-slate-900 border-r border-slate-200 text-[15px]">
                        {record.emp_name}
                      </td>
                      
                      {/* ป้ายสถานะ (สีจัดจ้าน มีเส้นขอบชัด) */}
                      <td className="py-4 px-6 border-r border-slate-200 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[11px] font-black shadow-sm border ${
                          record.work_type === 'เต็มวัน' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 
                          record.work_type === 'ครึ่งวัน' ? 'bg-sky-100 text-sky-800 border-sky-300' :
                          ['ขาด', 'ลา'].includes(record.work_type) ? 'bg-rose-100 text-rose-800 border-rose-300' : 
                          'bg-indigo-100 text-indigo-800 border-indigo-300'
                        }`}>
                          {record.work_type}
                        </span>
                      </td>
                      
                      {/* ค่าแรง (สีเขียวเข้ม ฟอนต์หนา) */}
                      <td className="py-4 px-6 text-right text-emerald-600 font-black tabular-nums border-r border-slate-200 text-[15px]">
                        {record.wage > 0 ? record.wage.toLocaleString() : <span className="text-slate-300 font-medium">-</span>}
                      </td>
                      
                      {/* หักเบิก (สีแดงเข้ม ฟอนต์หนา) */}
                      <td className="py-4 px-6 text-right text-rose-600 font-black tabular-nums border-r border-slate-200 text-[15px]">
                        {record.advance_deduction > 0 ? record.advance_deduction.toLocaleString() : <span className="text-slate-300 font-medium">-</span>}
                      </td>
                      
                      {/* หมายเหตุ */}
                      <td className="py-4 px-6 text-slate-600 text-xs font-bold">
                        {record.note || <span className="text-slate-300 font-medium">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-28 bg-slate-50">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-1">ไม่พบข้อมูล</h3>
              <p className="text-slate-500 font-bold text-sm">ยังไม่มีประวัติการเช็คชื่อในช่วงวันที่ท่านเลือก</p>
            </div>
          )}

        </div>
      </div>
      
      <style jsx global>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.6;
          transition: 0.2s;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}