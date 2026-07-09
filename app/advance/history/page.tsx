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
    <div className="min-h-screen bg-[#FCFBF7] pb-16 font-sans relative">
      
      {/* Header */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.push('/advance')} className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors">
              <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h1 className="text-xl font-black text-stone-800">ประวัติเบิกเงินย้อนหลัง</h1>
              <p className="text-xs text-stone-500 mt-0.5">ค้นหาและดาวน์โหลดรายงานการเบิกเงิน</p>
            </div>
          </div>
          
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span className="hidden sm:inline">โหลด Excel</span>
          </button>
        </div>
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 mt-8">
        
        {/* การ์ดสรุปยอดรวม (เพิ่มเข้ามาให้ดูง่ายๆ) */}
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between shadow-sm">
          <div>
            <h3 className="text-amber-800 font-bold">ยอดเบิกเงินล่วงหน้ารวม</h3>
            <p className="text-sm text-amber-600 mt-1">ตั้งแต่วันที่ {formatDateThai(startDate)} - {formatDateThai(endDate)}</p>
          </div>
          <div className="mt-4 sm:mt-0 text-3xl sm:text-4xl font-black text-amber-600">
            ฿ {totalAdvanceAmount.toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6">
          
          {/* ตัวกรองวันที่ */}
          <div className="flex flex-col sm:flex-row items-end gap-4 mb-8 bg-stone-50 p-4 rounded-2xl border border-stone-100">
            <div className="w-full sm:w-auto flex-1">
              <label className="block text-xs font-bold text-stone-500 mb-1.5">ตั้งแต่วันที่</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5244e1]"
              />
            </div>
            <div className="w-full sm:w-auto flex-1">
              <label className="block text-xs font-bold text-stone-500 mb-1.5">ถึงวันที่</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5244e1]"
              />
            </div>
            <button 
              onClick={fetchAdvanceHistory}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#5244e1] text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              ค้นหาข้อมูล
            </button>
          </div>

          {/* ตารางแสดงข้อมูล */}
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#5244e1] border-t-transparent rounded-full animate-spin"></div></div>
          ) : records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-stone-50 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="py-3 px-4 rounded-tl-xl w-32">วันที่เบิก</th>
                    <th className="py-3 px-4 w-1/4">ชื่อพนักงาน</th>
                    <th className="py-3 px-4 w-1/3">หมายเหตุ</th>
                    <th className="py-3 px-4 text-right rounded-tr-xl">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium text-stone-700 divide-y divide-stone-100">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-stone-50">
                      <td className="py-4 px-4 text-xs font-bold text-stone-500">{formatDateThai(record.date)}</td>
                      <td className="py-4 px-4 font-bold text-stone-800">{record.emp_name}</td>
                      <td className="py-4 px-4 text-stone-500 text-xs">{record.note || '-'}</td>
                      <td className="py-4 px-4 text-right text-amber-600 font-black text-base">
                        {record.amount?.toLocaleString() || '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 text-stone-400 font-bold">ไม่พบข้อมูลการเบิกเงินในช่วงวันที่เลือกครับ</div>
          )}

        </div>
      </div>
    </div>
  );
}