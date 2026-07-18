'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

interface PayrollRecord {
  id: string;
  payment_date: string;
  employee_name: string;
  total_earned: number;      
  total_deducted: number;    
  net_pay: number;        
}

export default function PayrollHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const formatDateThai = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const fetchPayrollHistory = async () => {
    setLoading(true);
    try {
      // 🌟 ดึงข้อมูลโดยใช้ช่วงของช่วงวันที่เทียบกับ payment_date
      const { data, error } = await supabase
        .from('payroll_history') 
        .select('id, payment_date, employee_name, total_earned, total_deducted, net_pay')
        .gte('payment_date', `${startDate}T00:00:00`)
        .lte('payment_date', `${endDate}T23:59:59`)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error: any) {
      console.error(error);
      alert('ดึงข้อมูลผิดพลาด: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrollHistory();
  }, []);

  const sumNetPaid = records.reduce((sum, r) => sum + Number(r.net_pay || 0), 0);
  const sumWage = records.reduce((sum, r) => sum + Number(r.total_earned || 0), 0);
  const sumAdvance = records.reduce((sum, r) => sum + Number(r.total_deducted || 0), 0);

  const exportToExcel = () => {
    if (records.length === 0) {
      alert('ไม่มีข้อมูลสำหรับดาวน์โหลด');
      return;
    }

    const excelData = records.map((record, index) => ({
      'ลำดับ': index + 1,
      'วันที่คิดเงิน': formatDateThai(record.payment_date),
      'ชื่อพนักงาน': record.employee_name,
      'รวมรายได้/เงินพิเศษ (บาท)': record.total_earned || 0,
      'รวมยอดหัก/หนี้คืน (บาท)': record.total_deducted || 0,
      'จ่ายเงินสดสุทธิ (บาท)': record.net_pay || 0,
    }));

    excelData.push({
      'ลำดับ': '' as any,
      'วันที่คิดเงิน': '' as any,
      'ชื่อพนักงาน': 'รวมยอดทั้งหมด' as any,
      'รวมรายได้/เงินพิเศษ (บาท)': sumWage as any,
      'รวมยอดหัก/หนี้คืน (บาท)': sumAdvance as any,
      'จ่ายเงินสดสุทธิ (บาท)': sumNetPaid as any,
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ประวัติการจ่ายเงินสด");

    const fileName = `รายงานจ่ายเงินสด_${startDate}_ถึง_${endDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-16 font-sans relative selection:bg-indigo-500 selection:text-white">
      
      {/* 🌟 Premium Header (อัปเกรดใหม่ให้เข้าเซ็ต) */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1200px] mx-auto px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {/* ⬅️ ปุ่มย้อนกลับดีไซน์ใหม่ */}
            <button onClick={() => router.push('/payroll')} className="group w-11 h-11 bg-white border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl flex items-center justify-center text-slate-500 transition-all shadow-sm shrink-0">
              <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            
            <div className="h-8 w-px bg-slate-300 hidden sm:block mx-1"></div>
            
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">ประวัติคิดเงินสดรายคน</h1>
                <p className="text-[11px] font-bold text-slate-500 leading-none hidden sm:block uppercase tracking-wider">
                  ตรวจสอบบิลและดาวน์โหลดรายงานการเงิน
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-5 sm:px-8 mt-8">
        
        {/* 🌟 การ์ดสรุปยอด 3 กล่อง (High Contrast) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="bg-white border border-emerald-200 p-6 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-center">
            <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
            <p className="text-[11px] font-black text-emerald-600 mb-1.5 uppercase tracking-widest relative z-10">ยอดรวมรายได้สะสม</p>
            <h3 className="text-3xl font-black text-slate-900 relative z-10 tabular-nums">
              <span className="text-emerald-500 mr-1.5 text-xl">฿</span>{sumWage.toLocaleString()}
            </h3>
          </div>
          
          <div className="bg-white border border-rose-200 p-6 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-center">
            <div className="absolute right-0 top-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl"></div>
            <p className="text-[11px] font-black text-rose-600 mb-1.5 uppercase tracking-widest relative z-10">ยอดหักเงินคืนสะสม</p>
            <h3 className="text-3xl font-black text-slate-900 relative z-10 tabular-nums">
              <span className="text-rose-500 mr-1.5 text-xl">฿</span>{sumAdvance.toLocaleString()}
            </h3>
          </div>
          
          <div className="bg-indigo-600 border border-indigo-700 p-6 rounded-2xl shadow-lg shadow-indigo-600/20 relative overflow-hidden flex flex-col justify-center text-white">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <p className="text-[11px] font-black text-indigo-200 mb-1.5 uppercase tracking-widest relative z-10">รวมจ่ายเงินสดสุทธิ</p>
            <h3 className="text-3xl font-black relative z-10 tabular-nums">
              <span className="text-indigo-300 mr-1.5 text-xl">฿</span>{sumNetPaid.toLocaleString()}
            </h3>
          </div>
        </div>

        {/* 🌟 กล่องค้นหา (Filter Section) ให้สีเข้มขึ้น มีมิติ */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 mb-8 relative overflow-hidden">
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
                onClick={fetchPayrollHistory}
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

        {/* 🌟 ตารางแสดงข้อมูล (High Contrast Table แบบหน้าประวัติเช็คชื่อ) */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 bg-white flex items-center gap-3 border-b border-slate-200">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
              รายการประวัติการจ่ายเงินสด
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
                {/* หัวตารางสีเข้ม (Slate-800) แบบเดียวกับประวัติเช็คชื่อ */}
                <thead>
                  <tr className="bg-slate-800 text-white text-[12px] font-bold uppercase tracking-widest border-b border-slate-800">
                    <th className="py-4 px-6 w-36 border-r border-slate-700">วันที่คิดเงิน</th>
                    <th className="py-4 px-6 border-r border-slate-700">ชื่อพนักงาน</th>
                    <th className="py-4 px-6 text-right border-r border-slate-700 text-emerald-400">รายได้รวม (฿)</th>
                    <th className="py-4 px-6 text-right border-r border-slate-700 text-rose-400">หักเงิน/หนี้ (฿)</th>
                    <th className="py-4 px-6 text-right text-indigo-300">ยอดจ่ายสุทธิ (฿)</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-800 divide-y divide-slate-200">
                  {records.map((record) => (
                    // สีสลับแถวให้มองง่ายขึ้น
                    <tr key={record.id} className="bg-white hover:bg-indigo-50/60 transition-colors even:bg-slate-50/50">
                      
                      {/* วันที่ */}
                      <td className="py-4 px-6 text-[13px] font-bold text-slate-600 border-r border-slate-200 whitespace-nowrap">
                        {formatDateThai(record.payment_date)}
                      </td>
                      
                      {/* ชื่อพนักงาน */}
                      <td className="py-4 px-6 font-black text-slate-900 border-r border-slate-200 text-[15px]">
                        {record.employee_name}
                      </td>
                      
                      {/* รายได้รวม */}
                      <td className="py-4 px-6 text-right text-emerald-600 font-bold tabular-nums border-r border-slate-200 text-[14px]">
                        {record.total_earned?.toLocaleString() || '0'}
                      </td>
                      
                      {/* หักคืนระบบ */}
                      <td className="py-4 px-6 text-right text-rose-600 font-bold tabular-nums border-r border-slate-200 text-[14px]">
                        {record.total_deducted?.toLocaleString() || '0'}
                      </td>
                      
                      {/* ยอดจ่ายสุทธิ */}
                      <td className="py-4 px-6 text-right tabular-nums text-[16px]">
                        {record.net_pay < 0 ? (
                          <span className="bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg font-black border border-rose-200 shadow-sm">
                            {record.net_pay.toLocaleString()}
                          </span>
                        ) : (
                          <span className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-black border border-indigo-200 shadow-sm">
                            {record.net_pay.toLocaleString()}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-28 bg-slate-50">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-1">ไม่พบข้อมูล</h3>
              <p className="text-slate-500 font-bold text-sm">ยังไม่มีประวัติการจ่ายเงินในช่วงวันที่ท่านเลือก</p>
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