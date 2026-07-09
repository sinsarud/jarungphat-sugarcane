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
    <div className="min-h-screen bg-[#FCFBF7] pb-16 font-sans relative">
      
      {/* Header */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.push('/payroll')} className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors">
              <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h1 className="text-xl font-black text-stone-800">ประวัติคิดเงินสดรายคน</h1>
              <p className="text-xs text-stone-500 mt-0.5">ตรวจสอบบิลและดาวน์โหลดรายงานความเคลื่อนไหวการเงิน</p>
            </div>
          </div>
          
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span>โหลด Excel</span>
          </button>
        </div>
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 mt-8">
        
        {/* สรุปการ์ดเงินสด */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl shadow-sm">
            <p className="text-xs font-bold text-emerald-600 mb-1">ยอดรวมรายได้สะสม</p>
            <h3 className="text-2xl font-black text-emerald-700">฿ {sumWage.toLocaleString()}</h3>
          </div>
          <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl shadow-sm">
            <p className="text-xs font-bold text-rose-600 mb-1">ยอดหักเงินคืนสะสม</p>
            <h3 className="text-2xl font-black text-rose-700">฿ {sumAdvance.toLocaleString()}</h3>
          </div>
          <div className="bg-purple-50 border border-purple-200 p-5 rounded-2xl shadow-sm">
            <p className="text-xs font-bold text-purple-600 mb-1">รวมจ่ายเงินสดสุทธิ</p>
            <h3 className="text-2xl font-black text-purple-700">฿ {sumNetPaid.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6">
          
          {/* ตัวกรองวันที่ */}
          <div className="flex flex-col sm:flex-row items-end gap-4 mb-8 bg-stone-50 p-4 rounded-2xl border border-stone-100">
            <div className="w-full sm:w-auto flex-1">
              <label className="block text-xs font-bold text-stone-500 mb-1.5">ตั้งแต่วันที่คิดเงิน</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2 border border-stone-200 rounded-xl outline-none" />
            </div>
            <div className="w-full sm:w-auto flex-1">
              <label className="block text-xs font-bold text-stone-500 mb-1.5">ถึงวันที่</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2 border border-stone-200 rounded-xl outline-none" />
            </div>
            <button onClick={fetchPayrollHistory} className="w-full sm:w-auto px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-md">
              ค้นหาข้อมูล
            </button>
          </div>

          {/* ตาราง */}
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>
          ) : records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="py-3 px-4 rounded-tl-xl w-36">วันที่คิดเงิน</th>
                    <th className="py-3 px-4">ชื่อพนักงาน</th>
                    <th className="py-3 px-4 text-right">รายได้+พิเศษ (บาท)</th>
                    <th className="py-3 px-4 text-right">หักคืนระบบ (บาท)</th>
                    <th className="py-3 px-4 text-right rounded-tr-xl text-purple-600">จ่ายเงินสดจริง (บาท)</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium text-stone-700 divide-y divide-stone-100">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-stone-50">
                      <td className="py-4 px-4 text-xs font-bold text-stone-500">{formatDateThai(record.payment_date)}</td>
                      <td className="py-4 px-4 font-black text-stone-800">{record.employee_name}</td>
                      <td className="py-4 px-4 text-right text-emerald-600 font-bold">{record.total_earned?.toLocaleString() || '0'}</td>
                      <td className="py-4 px-4 text-right text-rose-600">{record.total_deducted?.toLocaleString() || '0'}</td>
                      <td className={`py-4 px-4 text-right font-black text-base ${record.net_pay < 0 ? 'text-rose-500 bg-rose-50/20' : 'text-purple-700 bg-purple-50/20'}`}>
                        {record.net_pay?.toLocaleString() || '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 text-stone-400 font-bold">ไม่พบข้อมูลประวัติคิดเงินสดในช่วงวันที่เลือกครับ</div>
          )}

        </div>
      </div>
    </div>
  );
}