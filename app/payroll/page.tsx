'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase'; 

interface Employee {
  id: string;
  full_name: string;
  position: string;
}

const formatThaiDate = (dateString: string) => {
  if (!dateString) return '';
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const cleanDate = dateString.split('T')[0];
  const [year, month, day] = cleanDate.split('-');
  return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${parseInt(year, 10) + 543}`;
};

export default function PayrollPage() {
  const router = useRouter();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState(''); 
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState({ show: false, type: '', message: '' });

  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]); 
  const [autoDeductions, setAutoDeductions] = useState<any[]>([]); 
  const [bonuses, setBonuses] = useState<any[]>([]);                    
  const [deductions, setDeductions] = useState<any[]>([]);               

  // 1. โหลดรายชื่อพนักงานที่ Active ทั้งหมดเมื่อเปิดหน้าเว็บ
  useEffect(() => {
    async function loadInitialData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, position')
        .eq('status', 'active')
        .order('full_name', { ascending: true });
        
      if (data && !error) {
        setEmployees(data);
      }
    }
    loadInitialData();
  }, [router]);

  // 2. ดึงประวัติเงินค้างจ่ายทันทีเมื่อเลือกชื่อพนักงาน
  const handleEmployeeChange = async (empId: string) => {
    setSelectedEmpId(empId);
    
    setAttendanceRecords([]);
    setAutoDeductions([]);
    setBonuses([]);
    setDeductions([]);
    
    if (!empId) return;
    
    setLoading(true);
    try {
      // ดึงค่าแรง (ที่ยังไม่ได้จ่าย)
      const { data: attData } = await supabase
        .from('daily_attendance')
        .select('*')
        .eq('employee_id', empId)
        .gt('wage', 0);
      if (attData) setAttendanceRecords(attData);

      // ดึงรายการเบิกเงินล่วงหน้า (ที่ยังไม่ได้หักคืน)
      const { data: advData } = await supabase
        .from('advance_payments')
        .select('*')
        .eq('employee_id', empId);
      if (advData) setAutoDeductions(advData);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- ระบบเพิ่มลดรายการเงินพิเศษ/หักมือ ---
  const handleAddBonus = () => setBonuses([...bonuses, { id: Date.now(), type: 'เงินพิเศษ', amount: '' }]);
  const handleRemoveBonus = (id: number) => setBonuses(bonuses.filter(b => b.id !== id));
  const handleBonusChange = (id: number, field: string, value: any) => {
    setBonuses(bonuses.map(b => b.id === id ? { ...b, [field]: field === 'amount' ? (parseInt(value) || 0) : value } : b));
  };

  const handleAddDeduction = () => setDeductions([...deductions, { id: Date.now(), type: 'ขอเบิกเพิ่มสด (หน้างาน)', amount: '' }]);
  const handleRemoveDeduction = (id: number) => setDeductions(deductions.filter(d => d.id !== id));
  const handleDeductionChange = (id: number, field: string, value: any) => {
    setDeductions(deductions.map(d => d.id === id ? { ...d, [field]: value, ...(field === 'amount' ? { amount: (parseInt(value) || 0) } : {}) } : d));
  };

  const handleRemoveAttendance = (id: any) => setAttendanceRecords(prev => prev.filter(r => r.id !== id));
  const handleRemoveAutoDeduction = (id: any) => setAutoDeductions(prev => prev.filter(r => r.id !== id)); 

  // --- ส่วนคำนวณเงินสดสุทธิหลังหัก ---
  const totalEarned = attendanceRecords.reduce((sum, r) => sum + Number(r.wage || 0), 0);
  const totalAutoDeduct = autoDeductions.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalBonus = bonuses.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalManualDeduct = deductions.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const netPay = (totalEarned + totalBonus) - (totalAutoDeduct + totalManualDeduct);

  const triggerConfirm = () => {
    if (!selectedEmpId) return setPopup({ show: true, type: 'error', message: 'กรุณาเลือกคนงานก่อนทำรายการ' });
    
    if (attendanceRecords.length === 0 && bonuses.length === 0 && autoDeductions.length === 0 && deductions.length === 0) {
      return setPopup({ show: true, type: 'error', message: 'ไม่พบรายการเงินค้างจ่ายใดๆ ให้บันทึกบัญชี' });
    }
    
    if (netPay < 0) {
      setPopup({ 
        show: true, 
        type: 'confirm', 
        message: `พนักงานมียอดติดลบ ${Math.abs(netPay).toLocaleString()} บาท\nระบบจะล้างบิลงานเก่า และ "สร้างบิลยกยอดหนี้สะสม" จำนวนนี้ไปหักลบในรอบหน้า ยืนยันใช่หรือไม่?` 
      });
    } else {
      setPopup({ 
        show: true, 
        type: 'confirm', 
        message: `ยืนยันการจ่ายเงินสุทธิ ${netPay.toLocaleString()} บาท และล้างบัญชีเคลียร์งวดนี้ใช่หรือไม่?` 
      });
    }
  };

  const confirmAndSave = async () => {
    setPopup({ show: false, type: '', message: '' }); 
    setIsSaved(true);

    try {
      const targetEmp = employees.find(e => e.id === selectedEmpId);
      const empName = targetEmp ? targetEmp.full_name : 'ไม่ระบุชื่อ';
      
      // 1. บันทึกประวัติลงตารางบัญชีรวม (payroll_history)
      const { error: insertError } = await supabase
        .from('payroll_history')
        .insert([{
          employee_id: selectedEmpId,
          employee_name: empName,
          total_earned: totalEarned + totalBonus,
          total_deducted: totalAutoDeduct + totalManualDeduct,
          net_pay: netPay,
          attendance_details: attendanceRecords, 
          deduction_details: [...autoDeductions, ...deductions], 
          payment_date: new Date().toISOString()
        }]);

      if (insertError) throw insertError;

      // 2. ล้างวันทำงานเดิมที่จ่ายตังค์เคลียร์จบแล้ว
      const paidAttendanceIds = attendanceRecords.map(r => r.id);
      if (paidAttendanceIds.length > 0) {
        await supabase.from('daily_attendance').delete().in('id', paidAttendanceIds);
      }

      // 3. ล้างบิลเบิกล่วงหน้าที่เคลียร์ยอดหักหนี้ไปแล้ว
      const paidAdvanceIds = autoDeductions.map(r => r.id);
      if (paidAdvanceIds.length > 0) {
        await supabase.from('advance_payments').delete().in('id', paidAdvanceIds);
      }

      // 4. ถ้ายอดจ่ายติดลบ ให้สร้างบิลยกหนี้ก้อนนี้ไปค้างรอบถัดไปอัตโนมัติ
      if (netPay < 0) {
        await supabase.from('advance_payments').insert([{
          employee_id: selectedEmpId,
          emp_name: empName,
          date: new Date().toISOString().split('T')[0],
          amount: Math.abs(netPay),
          note: 'หนี้ค้างชำระ (ยกมาจากงวดที่แล้ว)'
        }]);
      }

      setPopup({ 
        show: true, 
        type: 'success', 
        message: netPay < 0 
          ? `✅ บันทึกสำเร็จ!\nยกยอดหนี้ติดลบ ${Math.abs(netPay).toLocaleString()} บาท ไปไว้หักในรอบถัดไปแล้ว` 
          : '✅ ดำเนินการจ่ายเงินสดและล้างหนี้สินงวดนี้สำเร็จเรียบร้อยแล้ว!' 
      });
      
      setAttendanceRecords([]); 
      setAutoDeductions([]);
      setBonuses([]);
      setDeductions([]); 
      setSelectedEmpId('');

    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: `❌ เกิดข้อผิดพลาด: ${error.message}` });
    } finally {
      setIsSaved(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7F9] pb-16 font-sans relative selection:bg-indigo-500 selection:text-white">
      
      {/* 🌟 Header Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => router.push('/')} className="w-9 h-9 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl flex items-center justify-center transition-colors shrink-0 shadow-sm">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            
            <div className="h-6 w-px bg-slate-200 hidden sm:block mx-1"></div>
            
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-500 text-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none mb-0.5">ระบบคิดเงินสดรายคน</h1>
                <p className="text-[10px] font-bold text-slate-400 leading-none hidden sm:block">
                  ดึงข้อมูลอัตโนมัติ คำนวณหักลบ และยกยอดหนี้
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center w-full sm:w-auto">
            <button 
              type="button"
              onClick={() => router.push('/payroll/history')} 
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold rounded-xl transition-colors shadow-sm text-xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>ดูประวัติ / โหลด Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 mt-6 sm:mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* ⬅️ ฝั่งซ้าย: จัดการข้อมูลรายคน */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-5">
            
            {/* 👤 เลือกคนงาน */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>
              <label className="block text-[11px] font-bold text-slate-500 mb-2 ml-2">
                เลือกคนงานที่มาขอรับเงิน
              </label>
              <div className="relative ml-2">
                <select 
                  value={selectedEmpId}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:border-indigo-400 text-sm appearance-none cursor-pointer"
                >
                  <option value="">-- กรุณาเลือก --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.position || 'พนักงานทั่วไป'})</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {selectedEmpId && (
              <div className="space-y-5 animate-in fade-in duration-300">
                
                {/* 🟢 1. วันทำงานสะสม (รายรับ) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 
                    <h3 className="font-black text-slate-800 text-sm">วันทำงานสะสม</h3>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full ml-1">ดึงจากระบบ</span>
                  </div>
                  
                  {loading ? (
                    <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200 border-dashed flex flex-col items-center justify-center">
                      <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">กำลังโหลดข้อมูล...</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {attendanceRecords.length > 0 ? (
                        <div className="space-y-2">
                          {attendanceRecords.map((record) => (
                            <div key={record.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-emerald-200 relative group">
                              <button onClick={() => handleRemoveAttendance(record.id)} className="absolute -left-2 -top-2 bg-white text-slate-400 border border-slate-200 hover:text-white hover:bg-rose-500 hover:border-rose-600 w-5 h-5 rounded-full text-[10px] shadow-sm flex items-center justify-center font-bold transition-colors">✕</button>
                              
                              <div className="flex flex-col ml-1">
                                <span className="text-xs font-bold text-slate-800">{formatThaiDate(record.date)}</span>
                                <span className="text-[10px] font-bold text-emerald-600 mt-0.5">{record.work_type || record.type}</span>
                              </div>
                              <div className="flex items-center">
                                <span className="text-base font-black text-emerald-600 tabular-nums">{Number(record.wage || record.amount).toLocaleString()}</span>
                                <span className="ml-1 bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded">฿</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200 border-dashed text-xs font-bold text-slate-400">
                          ไม่มียอดทำงานสะสมที่ยังไม่ได้จ่าย
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-sm">
                        <span className="text-xs font-bold">รวมค่าแรงทำงาน:</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black tabular-nums">{totalEarned.toLocaleString()}</span>
                          <span className="text-[10px] font-bold text-emerald-200">฿</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 🔵 2. เงินพิเศษ (บวกเพิ่ม) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> 
                      <h3 className="font-black text-slate-800 text-sm">เงินพิเศษ</h3>
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full ml-1">บวกเพิ่ม</span>
                    </div>
                    <button type="button" onClick={handleAddBonus} className="text-[10px] font-bold text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                      + เพิ่มเงินพิเศษ
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {bonuses.length > 0 ? bonuses.map((record) => (
                      <div key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded-xl border border-blue-200 gap-2 relative">
                        <button type="button" onClick={() => handleRemoveBonus(record.id)} className="absolute -left-2 -top-2 bg-white text-slate-400 border border-slate-200 hover:text-white hover:bg-rose-500 hover:border-rose-600 w-5 h-5 rounded-full text-[10px] shadow-sm flex items-center justify-center font-bold transition-colors">✕</button>
                        
                        <input type="text" value={record.type} onChange={(e) => handleBonusChange(record.id, 'type', e.target.value)} placeholder="ระบุประเภท (เช่น ค่าน้ำมัน)..." className="w-full sm:w-[55%] text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 text-slate-800" />
                        
                        <div className="flex items-center w-full sm:w-[40%] relative">
                          <input type="number" min="0" value={record.amount || ''} onChange={(e) => handleBonusChange(record.id, 'amount', e.target.value)} className="w-full pl-2 pr-6 py-2 text-right font-black text-blue-600 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 text-sm tabular-nums" placeholder="0" />
                          <span className="absolute right-2 text-slate-400 text-[9px] font-bold">฿</span>
                        </div>
                      </div>
                    )) : (
                       <div className="text-center py-5 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-400">
                          ไม่มีรายการเงินพิเศษเพิ่มเติม
                       </div>
                    )}
                  </div>
                </div>

                {/* 🔴 3. รายการหักอัตโนมัติ (ดึงจากระบบ) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> 
                    <h3 className="font-black text-slate-800 text-sm">รายการเบิกล่วงหน้า</h3>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full ml-1">หักอัตโนมัติ</span>
                  </div>
                  
                  {loading ? (
                    <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200 border-dashed flex flex-col items-center justify-center">
                      <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">สแกนหนี้สะสม...</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {autoDeductions.length > 0 ? autoDeductions.map((record) => (
                        <div key={record.id} className="flex items-center justify-between bg-rose-50/20 p-3 rounded-xl border border-rose-200 relative group">
                          <button type="button" onClick={() => handleRemoveAutoDeduction(record.id)} className="absolute -left-2 -top-2 bg-white text-slate-400 border border-slate-200 hover:text-white hover:bg-rose-500 hover:border-rose-600 w-5 h-5 rounded-full text-[10px] shadow-sm flex items-center justify-center font-bold transition-colors" title="ยกเว้นการหักบิลนี้">✕</button>
                          
                          <div className="flex flex-col ml-1">
                            <span className="text-xs font-bold text-slate-800">{formatThaiDate(record.date)}</span>
                            <span className="text-[10px] font-bold text-rose-600 mt-0.5">รายการ: {record.note || 'เบิกเงินล่วงหน้า'}</span>
                          </div>
                          
                          <div className="flex items-center bg-white px-4 py-2 rounded-lg border border-rose-200 shadow-sm self-end sm:self-auto shrink-0">
                            <span className="text-base font-black text-rose-600 tabular-nums">- {Number(record.amount).toLocaleString()}</span>
                            <span className="ml-1.5 text-rose-400 text-[10px] font-bold">฿</span>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                          <p className="text-xs text-slate-400 font-bold">ไม่มีหนี้ค้างเบิกล่วงหน้า</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 🟠 4. หักรายการอื่นๆ / เบิกสดหน้างาน */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> 
                      <h3 className="font-black text-slate-800 text-sm">หักรายการอื่นๆ</h3>
                      <span className="text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full ml-1">ทำมือ</span>
                    </div>
                    <button type="button" onClick={handleAddDeduction} className="text-[10px] font-bold text-orange-600 bg-white border border-orange-200 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                      + เพิ่มรายการหัก
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {deductions.length > 0 ? deductions.map((record) => (
                      <div key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded-xl border border-orange-200 gap-2 relative">
                        <button onClick={() => handleRemoveDeduction(record.id)} className="absolute -left-2 -top-2 bg-white text-slate-400 border border-slate-200 hover:text-white hover:bg-rose-500 hover:border-rose-600 w-5 h-5 rounded-full text-[10px] shadow-sm flex items-center justify-center font-bold transition-colors">✕</button>
                        
                        <select value={record.type} onChange={(e) => handleDeductionChange(record.id, 'type', e.target.value)} className="w-full sm:w-[55%] text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-orange-400 text-slate-800 cursor-pointer">
                          <option value="ขอเบิกเพิ่มสด (หน้างาน)">ขอเบิกเพิ่มสด (หน้างาน)</option>
                          <option value="ลงบัญชี (เซ็นของ)">ลงบัญชี (เซ็นของ)</option>
                          <option value="หักค่าอุปกรณ์">หักค่าอุปกรณ์</option>
                          <option value="อื่นๆ">อื่นๆ</option>
                        </select>
                        
                        <div className="flex items-center w-full sm:w-[40%] relative">
                          <input type="number" min="0" value={record.amount || ''} onChange={(e) => handleDeductionChange(record.id, 'amount', e.target.value)} className="w-full pl-2 pr-6 py-2 text-right font-black text-rose-500 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-400 text-sm tabular-nums" placeholder="0" />
                          <span className="absolute right-2 text-slate-400 text-[9px] font-bold">฿</span>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-5 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-400">
                        ไม่มีรายการหักเพิ่มเติม
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center px-4 py-3 bg-rose-50 text-rose-900 rounded-xl font-bold border border-rose-100 mt-3">
                      <span className="text-xs">รวมยอดหักลบ (ทุกประเภท):</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-black text-rose-600 tabular-nums">- {(totalAutoDeduct + totalManualDeduct).toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-rose-400">฿</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* ➡️ ฝั่งขวา: สมุดคิดเงิน (Sticky Summary) - สีขาวสะอาดตา */}
          <div className="lg:col-span-4 relative mt-2 lg:mt-0">
            <div className="lg:sticky lg:top-28 space-y-4">
              
              {/* บอร์ดสรุปยอดสีขาวพรีเมียม */}
              <div className="bg-white rounded-[24px] shadow-xl shadow-slate-200/50 border border-slate-200 text-center relative overflow-hidden">
                {/* แถบสีตกแต่งด้านบนให้ดูมีมิติ */}
                <div className="h-2 w-full bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                
                <div className="p-6">
                  <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 border border-indigo-100">
                    สรุปยอดบัญชี
                  </span>
                  
                  <h3 className="text-xl text-slate-900 font-black mb-4 truncate">
                    {employees.find(e => e.id === selectedEmpId)?.full_name || '-- ยังไม่ได้เลือกพนักงาน --'}
                  </h3>
                  
                  <div className="border-t border-slate-100 pt-6 mb-2 relative">
                    <p className="text-[11px] text-slate-500 font-bold mb-3 uppercase tracking-wider">
                      เงินสดสุทธิที่ต้องจ่าย
                    </p>
                    <div className="flex justify-center items-baseline gap-1">
                      <span className={`text-2xl font-black mt-1 ${netPay < 0 ? 'text-rose-500' : 'text-indigo-500'}`}>฿</span>
                      <span className={`text-6xl font-black tabular-nums tracking-tighter ${netPay < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                        {selectedEmpId && !loading ? netPay.toLocaleString() : '0'}
                      </span>
                    </div>
                    
                    {netPay < 0 && selectedEmpId && !loading && (
                      <div className="mt-5 bg-rose-50 border border-rose-200 py-2 px-4 rounded-xl inline-flex items-center justify-center gap-2 animate-pulse">
                        <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span className="text-[11px] font-black text-rose-700 uppercase tracking-wider">
                          ยอดติดลบ (รอตั้งบิลหนี้สะสม)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ปุ่มยืนยัน */}
              <button
                type="button"
                onClick={triggerConfirm}
                disabled={isSaved || !selectedEmpId || loading}
                className={`w-full py-4 rounded-[16px] font-black text-white text-sm transition-all flex items-center justify-center gap-2 shadow-md ${
                  isSaved || !selectedEmpId || loading
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border border-slate-300' 
                    : netPay < 0
                      ? 'bg-rose-600 hover:bg-rose-700 active:scale-[0.98] shadow-rose-600/30' 
                      : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-indigo-600/30'
                }`}
              >
                {netPay < 0 ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                    ยืนยันยกยอดหนี้สะสม
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ยืนยันจ่ายเงิน & ล้างบัญชี
                  </>
                )}
              </button>

            </div>
          </div>

        </div>
      </div>

      {/* POPUP แจ้งเตือน (High Contrast SaaS) */}
      {popup.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => popup.type !== 'confirm' && setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-[24px] p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 text-center border border-slate-200">
            
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 border ${
              popup.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
              popup.type === 'error' ? 'bg-rose-50 text-rose-600 border-rose-200' :
              'bg-indigo-50 text-indigo-600 border-indigo-200'
            }`}>
              {popup.type === 'success' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>}
              {popup.type === 'error' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>}
              {popup.type === 'confirm' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            </div>

            <h3 className="text-xl font-black text-slate-900 mb-2 whitespace-pre-line">
              {popup.type === 'confirm' ? (netPay < 0 ? 'ตั้งหนี้ค้างสะสม?' : 'ยืนยันการจ่ายเงิน?') : popup.type === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}
            </h3>
            <p className="text-[13px] font-bold text-slate-500 mb-8 leading-relaxed whitespace-pre-line px-2">
              {popup.message}
            </p>

            {popup.type === 'confirm' ? (
              <div className="flex gap-3">
                <button type="button" onClick={() => setPopup({ show: false, type: '', message: '' })} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-[13px] transition-colors border border-slate-200">ยกเลิก</button>
                <button type="button" onClick={confirmAndSave} className={`flex-1 py-3 text-white font-black rounded-xl text-[13px] transition-all shadow-md ${netPay < 0 ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'}`}>ตกลง</button>
              </div>
            ) : (
              <button type="button" onClick={() => setPopup({ show: false, type: '', message: '' })} className={`w-full py-3.5 font-black rounded-xl transition-all text-white shadow-md text-[13px] ${popup.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/30'}`}>
                ปิดหน้าต่าง
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}