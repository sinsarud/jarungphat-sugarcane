'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

// โครงสร้างข้อมูลพนักงาน
interface Employee {
  id: string;
  full_name: string;
  position: string;
}

// โครงสร้างข้อมูลประวัติการเบิกเงิน
interface AdvanceRecord {
  id: string;
  date: string;
  employee_id: string;
  emp_name: string;
  amount: number;
  note: string;
}

export default function AdvancePaymentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState({ show: false, type: '', message: '' });

  const getTodayString = () => {
    const d = new Date();
    d.setHours(d.getHours() + 7);
    const todayStr = d.toISOString().split('T')[0];
    return todayStr;
  };

  // 🌟 เพิ่มฟังก์ชันแปลงวันที่ให้อ่านง่าย
  const formatDateThai = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  
  // States สำหรับป๊อปอัป "ลงบัญชีเบิกเงิน"
  const [showModal, setShowModal] = useState(false);
  const [formEmpId, setFormEmpId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formDate, setFormDate] = useState(getTodayString());

  // ฟังก์ชันดึงข้อมูลพนักงานจากฐานข้อมูลจริง
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: empData } = await supabase
        .from('employees')
        .select('id, full_name, position')
        .eq('status', 'active')
        .order('full_name');
      
      if (empData) setEmployees(empData);

      const currentMonth = selectedDate.substring(0, 7); 
      const { data: advData } = await supabase
        .from('advance_payments')
        .select('*')
        .like('date', `${currentMonth}%`)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (advData) setAdvances(advData);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      fetchData();
    }
    checkAuth();
  }, [router, selectedDate]);

  // ฟังก์ชันคำนวณยอดเบิกรวม
  const totalAdvanceThisMonth = advances.reduce((sum, record) => {
    const resSum = sum + Number(record.amount);
    return resSum;
  }, 0);
  
  const totalAdvanceToday = advances.filter(r => {
    const isToday = r.date === selectedDate;
    return isToday;
  }).reduce((sum, record) => {
    const resSum = sum + Number(record.amount);
    return resSum;
  }, 0);

  // เปิดหน้าต่างเบิกเงิน
  const openModal = () => {
    setFormEmpId('');
    setFormAmount('');
    setFormNote('');
    setFormDate(selectedDate);
    setShowModal(true);
  };

  // ฟังก์ชันบันทึกการเบิกเงินลงฐานข้อมูล
  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmpId || !formAmount) {
      setPopup({ show: true, type: 'error', message: 'กรุณาเลือกพนักงาน และระบุจำนวนเงินที่เบิกให้ครบถ้วน' });
      return;
    }

    setSaving(true);
    try {
      const selectedEmp = employees.find(emp => emp.id === formEmpId);
      if (!selectedEmp) throw new Error('ไม่พบข้อมูลพนักงานที่เลือก');

      const { error } = await supabase.from('advance_payments').insert([{
        date: formDate,
        employee_id: formEmpId,
        emp_name: selectedEmp.full_name,
        amount: Number(formAmount),
        note: formNote.trim()
      }]);

      if (error) throw error;

      setShowModal(false);
      setPopup({ show: true, type: 'success', message: `บันทึกรายการเบิกเงิน ${Number(formAmount).toLocaleString()} บาท สำเร็จแล้ว!` });
      fetchData(); 
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  // ฟังก์ชันลบรายการเบิก
  const handleDelete = async (id: string, empName: string) => {
    if (!window.confirm(`ต้องการลบรายการเบิกเงินของ ${empName} ใช่หรือไม่?`)) {
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.from('advance_payments').delete().eq('id', id);
      if (error) throw error;
      setPopup({ show: true, type: 'success', message: 'ลบรายการเบิกเงินเรียบร้อยแล้ว' });
      fetchData();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
      setLoading(false);
    }
  };

  if (loading && employees.length === 0) {
    const loadingJsx = <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>;
    return loadingJsx;
  }

  const mainPageLayout = (
    <div className="min-h-screen bg-[#F1F5F9] pb-24 font-sans relative selection:bg-amber-500 selection:text-white">
      
      {/* 🌟 Premium Header Bar */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {/* ⬅️ ปุ่มย้อนกลับดีไซน์ใหม่ */}
            <button onClick={() => router.push('/')} className="group w-10 h-10 bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600 rounded-xl flex items-center justify-center text-slate-500 transition-all shrink-0 shadow-sm">
              <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div className="h-8 w-px bg-slate-300 hidden sm:block mx-1"></div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-xl flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">สมุดบันทึกการเบิกเงิน</h1>
                <p className="text-[11px] font-bold text-slate-500 leading-none hidden sm:block uppercase tracking-wider">จัดการรายการเบิกล่วงหน้าระหว่างงวดของคนงาน</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={openModal} 
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white px-6 py-2.5 rounded-xl text-[13px] font-black shadow-md shadow-amber-500/20 flex items-center justify-center transition-all"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              <span>ลงบัญชีเบิกเงิน</span>
            </button>

            <button 
              onClick={() => router.push('/advance/history')} 
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-xl transition-colors shadow-sm text-xs"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span>ดูประวัติทั้งหมด</span>
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 mt-6 sm:mt-8">
        
        {/* 🌟 การ์ดสรุปยอด */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white border border-amber-200 p-6 rounded-2xl shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl"></div>
            <div className="relative z-10">
              <p className="text-[11px] font-black text-amber-600 mb-1.5 uppercase tracking-widest">ยอดเบิกรวมวันนี้ ({formatDateThai(selectedDate)})</p>
              <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tabular-nums">
                <span className="text-amber-500 mr-1.5 text-2xl">฿</span>{totalAdvanceToday.toLocaleString()}
              </h3>
            </div>
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 shrink-0 border border-amber-100 relative z-10">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-slate-500/10 rounded-full blur-2xl"></div>
            <div className="relative z-10">
              <p className="text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-widest">ยอดเบิกรวมเดือนนี้</p>
              <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tabular-nums">
                <span className="text-slate-400 mr-1.5 text-2xl">฿</span>{totalAdvanceThisMonth.toLocaleString()}
              </h3>
            </div>
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 shrink-0 border border-slate-100 relative z-10">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
          </div>
        </div>

        {/* 🌟 ส่วนประวัติการเบิกเงิน */}
        <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 bg-white flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
              ประวัติการเบิกเงินในเดือนนี้
            </h2>
            <div className="relative">
              <input 
                type="month" 
                value={selectedDate.substring(0, 7)}
                onChange={(e) => setSelectedDate(`${e.target.value}-01`)}
                className="w-full sm:w-auto px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-bold outline-none focus:ring-2 focus:ring-amber-500 text-sm cursor-pointer shadow-sm transition-all focus:bg-white"
              />
            </div>
          </div>

          {/* 📱 MOBILE VIEW: แสดงแบบการ์ดสวยงาม */}
          <div className="block md:hidden divide-y divide-slate-100 bg-slate-50/50">
            {advances.length > 0 ? advances.map((adv) => {
              const mobileCard = (
                <div key={`mob-${adv.id}`} className="p-5 bg-white relative hover:bg-amber-50/50 transition-colors">
                  <button 
                    onClick={() => handleDelete(adv.id, adv.emp_name)} 
                    className="absolute top-5 right-5 p-2 text-slate-300 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-xl transition-all border border-slate-100 hover:border-rose-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                  
                  <div className="pr-12">
                    <div className="text-[10px] font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {formatDateThai(adv.date)}
                    </div>
                    <div className="font-black text-slate-900 text-base">{adv.emp_name}</div>
                    <div className="text-[11px] font-bold text-slate-500 mt-1.5 flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      {adv.note || 'ไม่มีหมายเหตุ'}
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">จำนวนเงินที่เบิก</span>
                    <span className="font-black text-amber-600 text-xl tabular-nums">- ฿ {Number(adv.amount).toLocaleString()}</span>
                  </div>
                </div>
              );
              return mobileCard;
            }) : (
              <div className="text-center py-16">
                <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                </div>
                <p className="text-slate-400 font-bold text-xs">ยังไม่มีประวัติการเบิกเงินในเดือนนี้</p>
              </div>
            )}
          </div>

          {/* 💻 DESKTOP VIEW: แสดงตารางตัวเต็มเมื่ออยู่บนจอคอม (หัวตารางสีสว่าง) */}
          <div className="hidden md:block overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[12px] font-black uppercase tracking-widest border-b-2 border-slate-200">
                  <th className="py-4 px-6 w-1/6 border-r border-slate-200">วันที่เบิก</th>
                  <th className="py-4 px-6 w-2/6 border-r border-slate-200">ชื่อพนักงาน</th>
                  <th className="py-4 px-6 w-2/6 border-r border-slate-200">หมายเหตุ</th>
                  <th className="py-4 px-6 w-1/6 text-right border-r border-slate-200 text-amber-600">จำนวนเงิน (฿)</th>
                  <th className="py-4 px-6 text-center w-24">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-slate-800 divide-y divide-slate-100">
                {advances.length > 0 ? advances.map((adv) => {
                  const rowJsx = (
                    <tr key={adv.id} className="bg-white hover:bg-amber-50/40 transition-colors even:bg-slate-50/30">
                      <td className="py-4 px-6 text-slate-500 font-bold border-r border-slate-200 whitespace-nowrap text-[13px]">{formatDateThai(adv.date)}</td>
                      <td className="py-4 px-6 font-black text-slate-900 border-r border-slate-200 text-[15px]">{adv.emp_name}</td>
                      <td className="py-4 px-6 text-slate-500 border-r border-slate-200 text-xs font-semibold">{adv.note || <span className="text-slate-300">-</span>}</td>
                      <td className="py-4 px-6 text-right font-black text-rose-600 text-[15px] border-r border-slate-200 tabular-nums">
                        - {Number(adv.amount).toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button onClick={() => handleDelete(adv.id, adv.emp_name)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200" title="ลบรายการ">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                  return rowJsx;
                }) : (
                  <tr>
                    <td colSpan={5} className="py-20 text-center bg-slate-50">
                      <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                      </div>
                      <p className="text-slate-400 font-bold text-sm">ยังไม่มีประวัติการเบิกเงินในเดือนนี้</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* 🌟 MODAL: ลงบัญชีเบิกเงิน (อัปเกรด High Contrast SaaS) */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowModal(false)}></div>
          
          <div className="bg-white w-full max-w-lg rounded-[24px] shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[95vh] border border-slate-200">
            
            {/* แถบสีตกแต่งด้านบน */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-500 shrink-0"></div>
            
            {/* Header ของ Modal */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">ลงบัญชีเบิกเงินสด</h3>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">บันทึกยอดเงินเบิกล่วงหน้าเข้าสู่ระบบ</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors">✕</button>
            </div>

            {/* เนื้อหาฟอร์ม (เลื่อนได้ถ้าจอมือถือเล็ก) */}
            <div className="p-6 overflow-y-auto custom-scrollbar bg-white">
              <form id="advanceForm" onSubmit={handleSaveAdvance} className="space-y-6">
                
                {/* แบ่ง 2 คอลัมน์สำหรับ วันที่ กับ ชื่อพนักงาน */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[11px] font-black text-slate-500 mb-2 block uppercase tracking-wider ml-1">วันที่เบิก</label>
                    <input 
                      type="date" 
                      required 
                      value={formDate} 
                      onChange={(e) => setFormDate(e.target.value)} 
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm transition-all cursor-pointer shadow-sm" 
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-500 mb-2 block uppercase tracking-wider ml-1">พนักงานที่เบิก</label>
                    <select 
                      required 
                      value={formEmpId} 
                      onChange={(e) => setFormEmpId(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm text-sm cursor-pointer transition-all appearance-none"
                    >
                      <option value="" disabled className="text-slate-400">-- เลือกคนงาน --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.position || 'พนักงาน'})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* กล่องจำนวนเงิน (ไฮไลต์ชัดๆ กันกรอกผิด) */}
                <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-100 shadow-sm">
                  <label className="text-[11px] font-black text-amber-700 mb-3 flex items-center gap-1.5 uppercase tracking-wider ml-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    จำนวนเงินที่เบิก (บาท)
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      required 
                      min="1"
                      value={formAmount} 
                      onChange={(e) => setFormAmount(e.target.value)} 
                      placeholder="0" 
                      className="w-full pl-5 pr-14 py-4 bg-white border-2 border-slate-300 rounded-xl font-black text-3xl sm:text-4xl text-rose-600 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 shadow-inner text-right tabular-nums transition-all placeholder-slate-200" 
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-300 text-2xl">฿</span>
                  </div>
                </div>

                {/* หมายเหตุ */}
                <div>
                  <label className="text-[11px] font-black text-slate-500 mb-2 block uppercase tracking-wider ml-1">หมายเหตุ (ไม่บังคับ)</label>
                  <input 
                    type="text" 
                    value={formNote} 
                    onChange={(e) => setFormNote(e.target.value)} 
                    placeholder="เช่น ค่าข้าว, ซื้อของ, เบิกล่วงหน้า..." 
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm transition-all shadow-sm" 
                  />
                </div>

              </form>
            </div>
            
            {/* Footer ของ Modal (โซนปุ่มกด) */}
            <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex gap-3 sm:gap-4 shrink-0 rounded-b-[24px]">
              <button 
                type="button" 
                onClick={() => setShowModal(false)} 
                className="flex-1 py-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-bold rounded-xl text-sm sm:text-[15px] transition-colors shadow-sm"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                form="advanceForm" 
                disabled={saving} 
                className={`flex-[2] py-3.5 rounded-xl font-black text-white text-sm sm:text-[15px] shadow-lg transition-all border flex items-center justify-center gap-2 ${
                  saving 
                    ? 'bg-slate-400 border-slate-400 shadow-none cursor-not-allowed' 
                    : 'bg-amber-500 border-amber-600 hover:bg-amber-400 active:scale-[0.98] shadow-amber-500/30'
                }`}
              >
                {saving ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> กำลังบันทึก...</>
                ) : (
                  '💾 ยืนยันการลงบัญชี'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 POPUP แจ้งเตือน (ตั้งค่า z-[250] ให้อยู่บนสุดเหนือ Modal ลงบัญชี) */}
      {popup.show && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-[24px] p-8 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 border ${
              popup.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
              'bg-rose-50 text-rose-600 border-rose-200'
            }`}>
              {popup.type === 'success' ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              )}
            </div>
            
            <h3 className="text-xl font-black text-slate-900 mb-2">{popup.type === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}</h3>
            <p className="text-[13px] font-bold text-slate-500 mb-6 leading-relaxed px-2">{popup.message}</p>
            
            <button onClick={() => setPopup({ show: false, type: '', message: '' })} className={`w-full py-3.5 font-black rounded-xl text-white shadow-md text-[13px] border transition-colors ${popup.type === 'success' ? 'bg-emerald-600 border-emerald-700 hover:bg-emerald-500 shadow-emerald-500/30' : 'bg-rose-600 border-rose-700 hover:bg-rose-500 shadow-rose-500/30'}`}>
              ตกลงรับทราบ
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
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
  return mainPageLayout;
}