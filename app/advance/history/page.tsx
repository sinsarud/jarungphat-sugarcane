'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

// กำหนดตัวแปรให้ตรงกับฐานข้อมูลเบิกเงิน
interface AdvanceRecord {
  id: number;
  date: string;
  emp_name: string; 
  amount: number;
  note: string;
}

export default function AdvanceHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AdvanceRecord[]>([]);
  
  // ตั้งค่าวันที่เริ่มต้นเป็น วันที่ 1 ของเดือนนี้
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // ฟังก์ชันแปลงวันที่
  const formatDateThai = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // ดึงข้อมูลจากตาราง advance_payments
  const fetchAdvanceHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('advance_payments')
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
    fetchAdvanceHistory();
  }, []);

  // คำนวณยอดรวมเงินเบิกทั้งหมดในช่วงเวลาที่เลือก
  const totalAdvanceAmount = records.reduce((sum, record) => sum + Number(record.amount || 0), 0);

  // ฟังก์ชันดาวน์โหลด Excel
  const exportToExcel = () => {
    if (records.length === 0) {
      alert('ไม่มีข้อมูลในช่วงวันที่เลือกครับ');
      return;
    }

    const excelData = records.map((record, index) => ({
      'ลำดับ': index + 1,
      'วันที่เบิก': formatDateThai(record.date),
      'ชื่อพนักงาน': record.emp_name,
      'จำนวนเงิน (บาท)': record.amount || 0,
      'หมายเหตุ': record.note || '-'
    }));

    // เพิ่มบรรทัดสรุปยอดรวมไว้ท้ายสุดของ Excel
    excelData.push({
      'ลำดับ': '' as any,
      'วันที่เบิก': '' as any,
      'ชื่อพนักงาน': 'รวมยอดเบิกทั้งหมด' as any,
      'จำนวนเงิน (บาท)': totalAdvanceAmount as any,
      'หมายเหตุ': '' as any
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ประวัติเบิกเงินล่วงหน้า");

    const fileName = `รายงานเบิกเงิน_${startDate}_ถึง_${endDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-16 font-sans relative selection:bg-amber-500 selection:text-white">
      
      {/* 🌟 Premium Header */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1200px] mx-auto px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {/* ⬅️ ปุ่มย้อนกลับดีไซน์ใหม่ */}
            <button onClick={() => router.push('/advance')} className="group w-11 h-11 bg-white border border-slate-300 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600 rounded-xl flex items-center justify-center text-slate-500 transition-all shadow-sm shrink-0">
              <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            
            <div className="h-8 w-px bg-slate-300 hidden sm:block mx-1"></div>
            
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">ประวัติเบิกเงินย้อนหลัง</h1>
                <p className="text-[11px] font-bold text-slate-500 leading-none hidden sm:block uppercase tracking-wider">
                  ค้นหาและดาวน์โหลดรายงานการเบิกเงิน
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-5 sm:px-8 mt-8">
        
        {/* 🌟 การ์ดสรุปยอดรวมเบิกเงิน */}
        <div className="mb-6 bg-white border border-slate-200 rounded-[24px] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 w-full sm:w-auto text-center sm:text-left">
            <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-1.5 flex items-center justify-center sm:justify-start gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              ยอดเบิกเงินล่วงหน้ารวม
            </h3>
            <p className="text-sm font-bold text-slate-500 mt-1 bg-slate-50 inline-block px-3 py-1 rounded-lg border border-slate-100">
              ตั้งแต่วันที่ {formatDateThai(startDate)} - {formatDateThai(endDate)}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 relative z-10">
            <h3 className="text-4xl sm:text-5xl font-black text-slate-900 tabular-nums tracking-tight">
              <span className="text-amber-500 mr-2 text-2xl sm:text-3xl">฿</span>{totalAdvanceAmount.toLocaleString()}
            </h3>
          </div>
        </div>

        {/* 🌟 กล่องค้นหา (Filter Section) ให้มีมิติ */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 mb-8 relative overflow-hidden">
          {/* ขีดเส้นตกแต่งด้านบน */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500"></div>

          <div className="flex flex-col md:flex-row items-end justify-between gap-5 mt-2">
            
            {/* โซนเลือกวันที่ */}
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <div className="flex-1 sm:flex-none">
                <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wide">ตั้งแต่วันที่</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-48 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all font-bold text-slate-900 text-sm shadow-sm cursor-pointer"
                />
              </div>
              <div className="flex-1 sm:flex-none">
                <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wide">ถึงวันที่</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full sm:w-48 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all font-bold text-slate-900 text-sm shadow-sm cursor-pointer"
                />
              </div>
            </div>

            {/* โซนปุ่มกด */}
            <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
              <button 
                onClick={fetchAdvanceHistory}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-md text-sm"
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

        {/* 🌟 ตารางแสดงข้อมูล (ล้างสีดำออกทั้งหมด สว่างสดใส) */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 bg-white flex items-center gap-3 border-b border-slate-200">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              รายการประวัติการเบิกเงิน
            </h2>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">
              {records.length} รายการ
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-24 bg-slate-50"><div className="w-10 h-10 border-4 border-slate-300 border-t-amber-500 rounded-full animate-spin"></div></div>
          ) : records.length > 0 ? (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[800px]">
                {/* หัวตารางสีสว่าง คลีนๆ */}
                <thead className="bg-slate-50">
                  <tr className="text-slate-500 text-[12px] font-black uppercase tracking-widest border-b-2 border-slate-200">
                    <th className="py-4 px-6 w-32 border-r border-slate-200">วันที่เบิก</th>
                    <th className="py-4 px-6 border-r border-slate-200 w-1/4">ชื่อพนักงาน</th>
                    <th className="py-4 px-6 border-r border-slate-200 w-1/3">หมายเหตุ</th>
                    <th className="py-4 px-6 text-right text-amber-600">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-800 divide-y divide-slate-100">
                  {records.map((record) => (
                    // สีสลับแถว
                    <tr key={record.id} className="bg-white hover:bg-amber-50/40 transition-colors even:bg-slate-50/50">
                      <td className="py-4 px-6 text-[13px] font-bold text-slate-500 border-r border-slate-100 whitespace-nowrap">
                        {formatDateThai(record.date)}
                      </td>
                      <td className="py-4 px-6 font-black text-slate-900 border-r border-slate-100 text-[15px]">
                        {record.emp_name}
                      </td>
                      <td className="py-4 px-6 text-slate-500 text-xs font-semibold border-r border-slate-100">
                        {record.note || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-4 px-6 text-right text-amber-600 font-black tabular-nums text-[16px]">
                        {record.amount?.toLocaleString() || '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-28 bg-slate-50">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-1">ไม่พบข้อมูล</h3>
              <p className="text-slate-500 font-bold text-sm">ยังไม่มีประวัติการเบิกเงินในช่วงวันที่ท่านเลือก</p>
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