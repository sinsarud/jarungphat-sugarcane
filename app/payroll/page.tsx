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
    <div className="min-h-screen bg-[#FCFBF7] pb-16 font-sans relative">
      
      {/* Header Bar */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button onClick={() => router.push('/')} className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors shrink-0">
              <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-stone-800 leading-tight">ระบบคิดเงินสดรายคน</h1>
              <p className="text-[10px] sm:text-xs text-stone-500 mt-0.5">ดึงข้อมูลอัตโนมัติ คำนวณหักลบ และยกยอดหนี้</p>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive Grid Split Container */}
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mt-4 sm:mt-6 lg:mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
          
          {/* ========================================= */}
          {/* ฝั่งซ้าย: แบบฟอร์มแสดงและกรอกข้อมูลบัญชี */}
          {/* ========================================= */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-6">
            
            {/* กล่องเลือกคนงาน (ปรับปรุงการเว้นระยะบนจอเล็ก) */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-stone-200 shadow-sm">
              <label className="block text-[10px] sm:text-xs font-bold text-stone-500 uppercase mb-2 sm:mb-3 tracking-wider">
                👤 เลือกคนงานที่มาขอคิดเงิน
              </label>
              <div className="relative">
                <select 
                  value={selectedEmpId}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  className="w-full px-4 py-3.5 bg-[#FCFBF7] border-2 border-stone-100 rounded-xl sm:rounded-2xl text-stone-800 font-bold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm sm:text-lg appearance-none cursor-pointer"
                >
                  <option value="">-- กรุณาเลือกคนงาน --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.position || 'พนักงาน'})</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-stone-400">
                  <svg className="w-5 h-5 sm:w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {selectedEmpId && (
              <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-stone-200 shadow-sm p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-in fade-in duration-300">
                
                {/* 1. ส่วนรายได้วันทำงาน (ดึงอัตโนมัติ) */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-stone-800 text-sm sm:text-base flex items-center">
                      <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 mr-2 sm:mr-3 shrink-0"></span> วันทำงานสะสม (ดึงจากระบบ)
                    </h3>
                  </div>
                  
                  {loading ? (
                    <div className="text-center py-6 bg-stone-50 rounded-xl border border-stone-100 text-stone-400 text-xs font-bold">
                      กำลังโหลดข้อมูลงานสะสม...
                    </div>
                  ) : (
                    <div className="space-y-2 sm:space-y-3 mb-4">
                      {attendanceRecords.length > 0 ? attendanceRecords.map((record) => (
                        <div key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-emerald-50/40 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-emerald-100 relative gap-2 sm:gap-3">
                          <button onClick={() => handleRemoveAttendance(record.id)} className="absolute -left-1.5 -top-1.5 bg-red-500 text-white w-5 h-5 rounded-full text-xs shadow-md flex items-center justify-center font-bold">×</button>
                          <div className="flex flex-col ml-1 sm:ml-2">
                            <span className="text-xs sm:text-sm font-bold text-stone-800">{formatThaiDate(record.date)}</span>
                            <span className="text-[10px] sm:text-xs font-bold text-emerald-600 mt-0.5">{record.work_type || record.type}</span>
                          </div>
                          <div className="flex items-center bg-white px-3 py-1.5 rounded-lg sm:rounded-xl border border-emerald-100 self-end sm:self-auto shrink-0">
                            <span className="text-sm sm:text-lg font-black text-emerald-700">{Number(record.wage || record.amount).toLocaleString()}</span>
                            <span className="ml-1 text-stone-400 text-xs font-bold">฿</span>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-6 bg-stone-50 rounded-xl border border-2 border-stone-100 border-dashed text-xs font-bold text-stone-400">
                          ไม่มียอดทำงานสะสมที่ยังไม่ได้จ่าย
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center px-4 py-3 sm:px-5 sm:py-4 bg-emerald-50 text-emerald-900 rounded-xl font-bold border border-emerald-100">
                        <span className="text-xs sm:text-sm">รวมค่าแรงทำงาน:</span>
                        <span className="text-base sm:text-xl font-black text-emerald-700">{totalEarned.toLocaleString()} ฿</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. ส่วนเงินพิเศษ (บวกเพิ่ม) */}
                <div className="border-t border-stone-100 pt-5 sm:pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <h3 className="font-bold text-stone-800 text-sm sm:text-base flex items-center">
                      <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-400 mr-2 sm:mr-3 shrink-0"></span> เงินพิเศษ (บวกเพิ่ม)
                    </h3>
                    <button type="button" onClick={handleAddBonus} className="w-full sm:w-auto text-[11px] sm:text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-lg transition-colors border border-amber-200 text-center">+ เพิ่มเงินพิเศษ</button>
                  </div>
                  
                  <div className="space-y-3">
                    {bonuses.map((record) => (
                      <div key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-amber-50/40 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-100 gap-2 sm:gap-3 relative">
                        <button type="button" onClick={() => handleRemoveBonus(record.id)} className="absolute -left-1.5 -top-1.5 bg-red-500 text-white w-5 h-5 rounded-full text-xs shadow-md flex items-center justify-center font-bold">×</button>
                        <input type="text" value={record.type} onChange={(e) => handleBonusChange(record.id, 'type', e.target.value)} placeholder="ระบุประเภท (เช่น ค่าน้ำมัน)..." className="w-full sm:w-1/2 text-xs sm:text-sm font-bold bg-white border border-amber-200 rounded-lg sm:rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 text-amber-900" />
                        <div className="flex items-center w-full sm:w-1/2 relative">
                          <input type="number" min="0" value={record.amount || ''} onChange={(e) => handleBonusChange(record.id, 'amount', e.target.value)} className="w-full px-3 py-2.5 text-right font-black text-amber-600 bg-white border border-amber-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm sm:text-lg" placeholder="0" />
                          <span className="absolute right-4 text-stone-400 text-xs font-bold">฿</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. รายการหักอัตโนมัติ (ดึงจากระบบ) */}
                <div className="flex flex-col border-t border-stone-100 pt-5 sm:pt-6">
                  <h3 className="font-bold text-stone-800 text-sm sm:text-base mb-4 flex items-center">
                    <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-500 mr-2 sm:mr-3 shrink-0"></span> รายการเบิกเงินล่วงหน้า (ดึงจากระบบ)
                  </h3>
                  
                  {loading ? (
                    <div className="text-center py-6 bg-stone-50 rounded-xl border border-stone-100 text-stone-400 text-xs font-bold">กำลังสแกนประวัติหนี้สะสม...</div>
                  ) : (
                    <div className="space-y-2 sm:space-y-3 mb-4">
                      {autoDeductions.length > 0 ? autoDeductions.map((record) => (
                        <div key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-rose-50/40 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-rose-100 relative group gap-2 sm:gap-3">
                          <button type="button" onClick={() => handleRemoveAutoDeduction(record.id)} className="absolute -left-1.5 -top-1.5 bg-stone-400 hover:bg-red-500 text-white w-6 h-6 rounded-full text-sm flex items-center justify-center transition-colors" title="ไม่หักบิลนี้ในรอบนี้">×</button>
                          <div className="flex flex-col ml-2">
                            <span className="text-sm font-bold text-stone-800">{formatThaiDate(record.date)}</span>
                            <span className="text-xs font-bold text-rose-600 mt-0.5">เบิก: {record.note || 'เบิกเงินล่วงหน้า'}</span>
                          </div>
                          <div className="flex items-center bg-white px-4 py-2 rounded-xl border border-rose-100 self-end sm:self-auto">
                            <span className="text-lg font-black text-rose-600">- {Number(record.amount).toLocaleString()}</span>
                            <span className="ml-2 text-stone-400 text-sm font-bold">฿</span>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-6 bg-stone-50 rounded-2xl border-2 border-stone-100 border-dashed">
                          <p className="text-sm text-stone-400 font-bold">ไม่มีหนี้ค้างเบิกล่วงหน้า</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. รายจ่าย (หักทำมือหน้างาน) */}
                <div className="flex flex-col mb-4 mt-10 border-t border-stone-100 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-stone-800 text-sm sm:text-base flex items-center">
                      <span className="w-3 h-3 rounded-full bg-red-500 mr-2 sm:mr-3"></span> หักรายการอื่นๆ / ขอเบิกเพิ่มสด (ทำมือ)
                    </h3>
                    <button onClick={handleAddDeduction} className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl transition-colors border border-red-200">+ เพิ่มรายการหัก</button>
                  </div>
                  
                  <div className="space-y-3">
                    {deductions.map((record) => (
                      <div key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-red-50/40 p-4 rounded-2xl border border-red-100 gap-3 relative">
                        <button onClick={() => handleRemoveDeduction(record.id)} className="absolute -left-2 -top-2 bg-red-500 text-white w-6 h-6 rounded-full text-sm shadow-md flex items-center justify-center">×</button>
                        <select value={record.type} onChange={(e) => handleDeductionChange(record.id, 'type', e.target.value)} className="w-full sm:w-1/2 ml-0 sm:ml-2 text-xs sm:text-sm font-bold bg-white border border-red-200 rounded-xl px-3 py-2.5 sm:py-3 focus:outline-none focus:ring-2 focus:ring-red-400 text-red-900 cursor-pointer">
                          <option value="ขอเบิกเพิ่มสด (หน้างาน)">ขอเบิกเพิ่มสด (หน้างาน)</option>
                          <option value="ลงบัญชี (เซ็นของ)">ลงบัญชี (เซ็นของ)</option>
                          <option value="หักค่าอุปกรณ์">หักค่าอุปกรณ์</option>
                          <option value="อื่นๆ">อื่นๆ</option>
                        </select>
                        <div className="flex items-center w-full sm:w-1/2 relative">
                          <input type="number" min="0" value={record.amount || ''} onChange={(e) => handleDeductionChange(record.id, 'amount', e.target.value)} className="w-full px-4 py-2.5 sm:py-3 text-right font-black text-red-600 bg-white border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 text-base sm:text-lg" placeholder="0" />
                          <span className="absolute right-4 text-stone-400 text-sm font-bold">฿</span>
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex justify-between items-center px-4 py-3.5 sm:px-5 sm:py-4 bg-red-50 text-red-900 rounded-xl font-bold border border-red-100 mt-4">
                      <span className="text-xs sm:text-sm">รวมยอดหักลบ (ทุกประเภท):</span>
                      <span className="text-lg sm:text-xl font-black text-red-600">- {(totalAutoDeduct + totalManualDeduct).toLocaleString()} ฿</span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* ฝั่งขวา: สรุปบิลยอดเงินสุทธิ (Sticky ยึดจอเมื่อเลื่อน) */}
          <div className="lg:col-span-4 relative mt-4 lg:mt-0">
            <div className="lg:sticky lg:top-28 space-y-6">
              
              <div className="bg-purple-900 text-white rounded-2xl sm:rounded-[2rem] shadow-xl overflow-hidden border-2 border-purple-800">
                <div className="p-4 sm:p-6 text-center bg-purple-950/30 border-b border-purple-800/50">
                  <p className="text-[10px] text-purple-300 font-bold uppercase tracking-widest mb-1">สมุดคิดเงินสดประจำตัว</p>
                  <h2 className="text-xl sm:text-2xl font-black truncate">{employees.find(e => e.id === selectedEmpId)?.full_name || '-- ยังไม่ได้เลือก --'}</h2>
                </div>
                
                <div className="p-6 sm:p-8 text-center">
                  <p className="text-xs sm:text-sm text-purple-200 font-bold uppercase tracking-wider mb-3">💸 เงินสดสุทธิที่ต้องจ่าย</p>
                  <h1 className={`text-5xl sm:text-6xl lg:text-7xl font-black my-2 tracking-tight drop-shadow-md ${netPay < 0 ? 'text-rose-400' : 'text-white'}`}>
                    {selectedEmpId && !loading ? netPay.toLocaleString() : '0'}
                  </h1>
                  <p className="text-sm sm:text-base font-bold text-purple-300 mt-3">บาท</p>
                  
                  {netPay < 0 && selectedEmpId && !loading && (
                    <p className="text-xs sm:text-sm font-bold text-rose-200 mt-3 bg-rose-900/60 py-2 rounded-xl border border-rose-500/50 animate-pulse">
                      ⚠️ หนี้ค้างสะสม (รอยกยอดไปรอบถัดไป)
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={triggerConfirm}
                disabled={isSaved || !selectedEmpId || loading}
                className={`w-full py-4 sm:py-5 rounded-xl sm:rounded-[1.5rem] font-black text-white text-base sm:text-xl shadow-lg transition-all flex items-center justify-center ${
                  isSaved || !selectedEmpId || loading
                    ? 'bg-stone-300 cursor-not-allowed shadow-none' 
                    : netPay < 0
                      ? 'bg-rose-600 hover:bg-rose-700 active:scale-95 shadow-rose-500/30' 
                      : 'bg-purple-600 hover:bg-purple-700 active:scale-95 shadow-purple-500/30'
                }`}
              >
                {netPay < 0 ? '📝 ยืนยันยกยอดหนี้สะสม' : '💵 ยืนยันจ่ายเงิน & ล้างบัญชี'}
              </button>

            </div>
          </div>

        </div>
      </div>

      {/* POPUP ยืนยัน/สำเร็จ/เออเร่อ */}
      {popup.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => popup.type !== 'confirm' && setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 text-center border border-stone-100">
            {popup.type === 'confirm' && (
              <div className={`w-14 h-14 sm:w-16 sm:h-16 ${netPay < 0 ? 'bg-rose-100 text-rose-600' : 'bg-purple-100 text-purple-600'} rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5`}>
                <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            )}
            {popup.type === 'success' && <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5"><svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div>}
            {popup.type === 'error' && <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5"><svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></div>}

            <h3 className="text-base sm:text-xl font-bold text-stone-800 mb-2 whitespace-pre-line">
              {popup.type === 'confirm' ? (netPay < 0 ? 'ยืนยันการยกยอดหนี้' : 'ยืนยันการจ่ายเงิน') : popup.type === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}
            </h3>
            <p className="text-xs sm:text-sm text-stone-500 mb-6 sm:mb-8 leading-relaxed whitespace-pre-line">{popup.message}</p>

            {popup.type === 'confirm' ? (
              <div className="flex gap-2 sm:gap-3">
                <button type="button" onClick={() => setPopup({ show: false, type: '', message: '' })} className="flex-1 py-2.5 sm:py-3.5 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold rounded-xl sm:rounded-2xl text-xs sm:text-sm transition-all">ยกเลิก</button>
                <button type="button" onClick={confirmAndSave} className={`flex-1 py-2.5 sm:py-3.5 text-white font-bold rounded-xl sm:rounded-2xl text-xs sm:text-sm transition-all shadow-md ${netPay < 0 ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/30' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30'}`}>ตกลง</button>
              </div>
            ) : (
              <button type="button" onClick={() => setPopup({ show: false, type: '', message: '' })} className={`w-full py-3 sm:py-4 font-bold rounded-xl sm:rounded-2xl transition-all text-white shadow-md text-xs sm:text-sm ${popup.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' : 'bg-red-500 hover:bg-red-600 shadow-red-500/30'}`}>ปิดหน้าต่าง</button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}