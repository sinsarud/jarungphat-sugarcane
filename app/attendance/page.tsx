'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface Employee {
  id: string;
  full_name: string;
  position: string;
}

interface AttendanceRecord {
  work_type: string;
  wage: string;
  note: string;
}

export default function AttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState({ show: false, type: '', message: '' });

  const getTodayString = () => {
    const d = new Date();
    d.setHours(d.getHours() + 7); 
    return d.toISOString().split('T')[0];
  };

  const formatDateThai = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendances, setAttendances] = useState<Record<string, AttendanceRecord>>({});
  
  const [jobOptions, setJobOptions] = useState<string[]>([]);
  const [promptDialog, setPromptDialog] = useState({ show: false, value: '', targetEmpId: '' });

  const fetchData = async (date: string) => {
    setLoading(true);
    try {
      const { data: empData } = await supabase.from('employees').select('id, full_name, position').eq('status', 'active').order('emp_code');
      if (empData) setEmployees(empData);

      const { data: optData } = await supabase.from('employee_options').select('label').eq('category', 'position');
      if (optData) setJobOptions(optData.map(o => o.label));

      const { data: attData } = await supabase.from('daily_attendance').select('*').eq('date', date);
      
      const attMap: Record<string, AttendanceRecord> = {};
      if (attData) {
        attData.forEach(r => {
          attMap[r.employee_id] = {
            work_type: r.work_type || '',
            wage: r.wage ? String(r.wage) : '',
            note: r.note || ''
          };
        });
      }
      setAttendances(attMap);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push('/login');
      else fetchData(selectedDate);
    }
    checkAuth();
  }, [router, selectedDate]);

  const handleToggleWorkType = (empId: string, type: string) => {
    setAttendances(prev => {
      const currentType = prev[empId]?.work_type || '';
      const nextType = currentType === type ? '' : type;

      return {
        ...prev,
        [empId]: {
          ...(prev[empId] || { work_type: '', wage: '', note: '' }),
          work_type: nextType,
          wage: (['ขาด', 'ลา', ''].includes(nextType)) ? '' : (prev[empId]?.wage || '')
        }
      };
    });
  };

  const updateAttendance = (empId: string, field: keyof AttendanceRecord, value: string) => {
    setAttendances(prev => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || { work_type: '', wage: '', note: '' }),
        [field]: value
      }
    }));
  };

  const handleAddNewJob = async () => {
    const cleanLabel = promptDialog.value.trim();
    if (!cleanLabel) return setPromptDialog({ show: false, value: '', targetEmpId: '' });

    if (!jobOptions.includes(cleanLabel)) {
      await supabase.from('employee_options').insert([{ category: 'position', label: cleanLabel }]);
      setJobOptions([...jobOptions, cleanLabel]);
    }
    
    if (promptDialog.targetEmpId) {
      updateAttendance(promptDialog.targetEmpId, 'work_type', cleanLabel);
    }
    setPromptDialog({ show: false, value: '', targetEmpId: '' });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const recordsToSave = employees.map(emp => {
        const att = attendances[emp.id] || { work_type: '', wage: '', note: '' };
        const finalWorkType = att.work_type || 'ขาด';
        const finalWage = ['ขาด', 'ลา'].includes(finalWorkType) ? 0 : Number(att.wage || 0);

        return {
          date: selectedDate,
          employee_id: emp.id,
          emp_name: emp.full_name,
          work_type: finalWorkType,
          wage: finalWage,
          note: att.note || ''
        };
      });

      await supabase.from('daily_attendance').delete().eq('date', selectedDate);
      const { error } = await supabase.from('daily_attendance').insert(recordsToSave);

      if (error) throw error;

      setPopup({ show: true, type: 'success', message: `บันทึกข้อมูลการทำงานของวันที่ ${formatDateThai(selectedDate)} เรียบร้อยแล้ว` });
      fetchData(selectedDate); 
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const standardTypes = ['เต็มวัน', 'ครึ่งวัน', 'ขาด', 'ลา'];
  let presentCount = 0;
  let absentCount = 0;
  let emptyCount = 0;
  let totalWage = 0;

  employees.forEach(emp => {
    const type = attendances[emp.id]?.work_type || '';
    if (!type) emptyCount++;
    else if (['ขาด', 'ลา'].includes(type)) absentCount++;
    else {
      presentCount++;
      totalWage += Number(attendances[emp.id]?.wage || 0);
    }
  });

  if (loading) return <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-32 font-sans relative selection:bg-emerald-500 selection:text-white">
      
      {/* 🌟 Header Bar (อัปเกรด UI) */}
      <div className="bg-white/90 backdrop-blur-md border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* ปุ่มย้อนกลับทรงเดียวกับแอป */}
            <button onClick={() => router.push('/')} className="group w-10 h-10 bg-white border border-stone-200 hover:border-emerald-400 hover:bg-emerald-50 rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm">
              <svg className="w-5 h-5 text-stone-400 group-hover:text-emerald-600 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div className="h-8 w-px bg-stone-200 hidden sm:block mx-1"></div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-black text-stone-900 tracking-tight leading-none mb-1">เช็คชื่อเข้างาน</h1>
                <p className="text-[11px] font-bold text-stone-500 leading-none flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  ระบบบันทึกค่าแรงรายวัน
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="flex w-full sm:w-auto items-center gap-2">
              <label className="text-xs font-bold text-stone-500 shrink-0 hidden sm:block">ประจำวันที่:</label>
              <div className="relative w-full sm:w-auto">
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full sm:w-auto pl-4 pr-3 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-800 font-black outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm text-sm cursor-pointer"
                />
              </div>
            </div>
            
            {/* ปุ่มประวัติ */}
            <button 
              onClick={() => router.push('/attendance/history')} 
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 font-bold rounded-xl transition-colors shadow-sm text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>ประวัติ / โหลด Excel</span>
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 mt-6 sm:mt-8">
        
        {/* 📊 การ์ดสรุปยอด (High Contrast) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-8">
          <div className="bg-white border border-emerald-200 p-4 sm:p-6 rounded-[20px] shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg></div>
              <p className="text-xs font-bold text-emerald-700">คนมาทำงาน</p>
            </div>
            <h3 className="text-3xl font-black text-stone-900">{presentCount} <span className="text-sm text-stone-400 font-bold">คน</span></h3>
          </div>
          
          <div className="bg-white border border-rose-200 p-4 sm:p-6 rounded-[20px] shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></div>
              <p className="text-xs font-bold text-rose-700">ขาด/ลาที่ระบุ</p>
            </div>
            <h3 className="text-3xl font-black text-stone-900">{absentCount} <span className="text-sm text-stone-400 font-bold">คน</span></h3>
          </div>
          
          <div className="bg-white border border-stone-200 p-4 sm:p-6 rounded-[20px] shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg></div>
              <p className="text-xs font-bold text-stone-500">ไม่ระบุ <span className="font-medium text-[10px]">(ระบบนับว่าขาด)</span></p>
            </div>
            <h3 className="text-3xl font-black text-stone-900">{emptyCount} <span className="text-sm text-stone-400 font-bold">คน</span></h3>
          </div>
          
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 border border-amber-600 p-4 sm:p-6 rounded-[20px] shadow-md flex flex-col justify-center text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-black text-amber-100 uppercase tracking-widest">รวมค่าแรง (บาท)</p>
              </div>
              <h3 className="text-3xl font-black">{totalWage.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* 📱 MOBILE VIEW: แสดงแบบการ์ด */}
        {/* ======================================================= */}
        <div className="block md:hidden space-y-4 mb-10">
          <div className="flex justify-between items-center mb-2 px-1">
            <h2 className="text-sm font-black text-stone-800">รายชื่อพนักงานทั้งหมด</h2>
            <span className="text-xs font-bold text-stone-400">{employees.length} คน</span>
          </div>

          {employees.map((emp) => {
            const att = attendances[emp.id] || { work_type: '', wage: '', note: '' };
            const isPresent = att.work_type && !['ขาด', 'ลา'].includes(att.work_type);
            const isCustomWork = att.work_type && !standardTypes.includes(att.work_type);

            return (
              <div key={`mob-${emp.id}`} className={`p-4 rounded-[20px] border transition-all ${isPresent ? 'bg-white border-emerald-300 shadow-md shadow-emerald-500/10' : 'bg-white border-stone-200 shadow-sm'}`}>
                
                {/* ชื่อและตำแหน่ง */}
                <div className="flex justify-between items-start mb-4 border-b border-stone-100 pb-3">
                  <div>
                    <div className="font-black text-stone-900 text-base">{emp.full_name}</div>
                    <div className="text-[11px] text-stone-500 font-bold mt-1 bg-stone-100 px-2 py-0.5 rounded inline-block">{emp.position || 'พนักงาน'}</div>
                  </div>
                  {/* Badge สถานะ */}
                  {att.work_type && (
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black shadow-sm ${att.work_type === 'เต็มวัน' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : att.work_type === 'ครึ่งวัน' ? 'bg-sky-100 text-sky-700 border border-sky-200' : att.work_type === 'ขาด' ? 'bg-rose-100 text-rose-700 border border-rose-200' : att.work_type === 'ลา' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'}`}>
                      {att.work_type}
                    </span>
                  )}
                </div>

                {/* ปุ่มกดสถานะ */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <button onClick={() => handleToggleWorkType(emp.id, 'เต็มวัน')} className={`col-span-2 py-3 rounded-xl text-xs font-black transition-all border ${att.work_type === 'เต็มวัน' ? 'bg-emerald-500 text-white border-emerald-600 shadow-md' : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'}`}>เต็มวัน</button>
                  <button onClick={() => handleToggleWorkType(emp.id, 'ครึ่งวัน')} className={`col-span-2 py-3 rounded-xl text-xs font-black transition-all border ${att.work_type === 'ครึ่งวัน' ? 'bg-sky-500 text-white border-sky-600 shadow-md' : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'}`}>ครึ่งวัน</button>
                  
                  <select 
                    value={isCustomWork ? att.work_type : ''} 
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW') setPromptDialog({ show: true, value: '', targetEmpId: emp.id });
                      else updateAttendance(emp.id, 'work_type', e.target.value);
                    }}
                    className={`col-span-2 px-2 py-3 rounded-xl text-xs font-black outline-none cursor-pointer transition-all border text-center ${isCustomWork ? 'bg-indigo-500 text-white border-indigo-600 shadow-md' : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50 appearance-none text-center'}`}
                  >
                    <option value="" disabled>งานอื่นๆ ▾</option>
                    {jobOptions.map(job => <option key={job} value={job} className="text-stone-800 bg-white text-left">{job}</option>)}
                    <option value="ADD_NEW" className="text-indigo-600 bg-indigo-50 font-bold text-left">➕ เพิ่มใหม่...</option>
                  </select>

                  <button onClick={() => handleToggleWorkType(emp.id, 'ขาด')} className={`col-span-1 py-3 rounded-xl text-xs font-black transition-all border ${att.work_type === 'ขาด' ? 'bg-rose-500 text-white border-rose-600 shadow-md' : 'bg-white text-rose-500 border-rose-200 hover:bg-rose-50'}`}>ขาด</button>
                  <button onClick={() => handleToggleWorkType(emp.id, 'ลา')} className={`col-span-1 py-3 rounded-xl text-xs font-black transition-all border ${att.work_type === 'ลา' ? 'bg-amber-500 text-white border-amber-600 shadow-md' : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'}`}>ลา</button>
                </div>

                {/* ช่องกรอกตัวเลขและหมายเหตุ */}
                <div className="space-y-3 bg-stone-50/50 p-3 rounded-xl border border-stone-100">
                  {isPresent && (
                    <div className="flex items-center relative animate-in fade-in duration-300">
                      <div className="absolute left-3 text-[11px] font-black text-emerald-700">ค่าแรงวันนี้:</div>
                      <input 
                        type="number" 
                        placeholder="0" 
                        value={att.wage}
                        onChange={(e) => updateAttendance(emp.id, 'wage', e.target.value)}
                        className="w-full pl-20 pr-8 py-2.5 bg-white border border-stone-300 text-emerald-800 font-black rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-right shadow-inner text-sm"
                      />
                      <span className="absolute right-3 text-[10px] font-bold text-stone-400">฿</span>
                    </div>
                  )}
                  
                  <input 
                    type="text" 
                    placeholder={att.work_type === '' ? "หมายเหตุ (เว้นว่าง = ขาด)" : "ระบุหมายเหตุ (ถ้ามี)..."}
                    value={att.note}
                    onChange={(e) => updateAttendance(emp.id, 'note', e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-stone-800 font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs transition-colors"
                  />
                </div>

              </div>
            );
          })}
        </div>


        {/* ======================================================= */}
        {/* 💻 DESKTOP VIEW: แสดงแบบตาราง (High Contrast) */}
        {/* ======================================================= */}
        <div className="hidden md:block bg-white rounded-[24px] border border-stone-200 shadow-sm overflow-hidden mb-10">
          <div className="p-5 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
            <h2 className="text-sm font-black text-stone-900 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div> รายชื่อพนักงานทั้งหมด
            </h2>
            <span className="text-xs font-bold text-stone-500 bg-white border border-stone-200 px-2 py-1 rounded-md">{employees.length} คน</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-white border-b-2 border-stone-200 text-[11px] font-black text-stone-500 uppercase tracking-wider">
                  <th className="py-4 px-6 w-1/4 border-r border-stone-100">รายชื่อพนักงาน</th>
                  <th className="py-4 px-6 w-[55%] border-r border-stone-100">ระบุสถานะการทำงาน & ค่าแรงวันนี้</th>
                  <th className="py-4 px-6 w-1/4">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-sm">
                {employees.map((emp) => {
                  const att = attendances[emp.id] || { work_type: '', wage: '', note: '' };
                  const isPresent = att.work_type && !['ขาด', 'ลา'].includes(att.work_type);
                  const isCustomWork = att.work_type && !standardTypes.includes(att.work_type);

                  return (
                    <tr key={emp.id} className={`hover:bg-stone-50/50 transition-colors ${isPresent ? 'bg-emerald-50/30' : ''}`}>
                      <td className="py-4 px-6 border-r border-stone-100">
                        <div className="font-black text-stone-900 text-[15px]">{emp.full_name}</div>
                        <div className="text-[10px] text-stone-500 font-bold mt-1 bg-stone-100 inline-block px-1.5 py-0.5 rounded">{emp.position || 'พนักงาน'}</div>
                      </td>
                      
                      <td className="py-4 px-6 border-r border-stone-100">
                        <div className="flex flex-wrap items-center gap-2">
                          <button onClick={() => handleToggleWorkType(emp.id, 'เต็มวัน')} className={`px-4 py-2.5 rounded-lg text-[11px] font-black transition-all border ${att.work_type === 'เต็มวัน' ? 'bg-emerald-500 text-white border-emerald-600 shadow-md' : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'}`}>เต็มวัน</button>
                          <button onClick={() => handleToggleWorkType(emp.id, 'ครึ่งวัน')} className={`px-4 py-2.5 rounded-lg text-[11px] font-black transition-all border ${att.work_type === 'ครึ่งวัน' ? 'bg-sky-500 text-white border-sky-600 shadow-md' : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'}`}>ครึ่งวัน</button>

                          <select value={isCustomWork ? att.work_type : ''} onChange={(e) => { if (e.target.value === 'ADD_NEW') setPromptDialog({ show: true, value: '', targetEmpId: emp.id }); else updateAttendance(emp.id, 'work_type', e.target.value); }} className={`px-3 py-2.5 rounded-lg text-[11px] font-black outline-none cursor-pointer transition-all border ${isCustomWork ? 'bg-indigo-500 text-white border-indigo-600 shadow-md' : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'}`}>
                            <option value="" disabled>งานอื่นๆ ▾</option>
                            {jobOptions.map(job => <option key={job} value={job} className="text-stone-800 bg-white">{job}</option>)}
                            <option value="ADD_NEW" className="text-indigo-600 bg-indigo-50 font-bold">➕ เพิ่มใหม่...</option>
                          </select>

                          <div className="w-px h-8 bg-stone-300 mx-2"></div>

                          <button onClick={() => handleToggleWorkType(emp.id, 'ขาด')} className={`px-4 py-2.5 rounded-lg text-[11px] font-black transition-all border ${att.work_type === 'ขาด' ? 'bg-rose-500 text-white border-rose-600 shadow-md' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'}`}>ขาด</button>
                          <button onClick={() => handleToggleWorkType(emp.id, 'ลา')} className={`px-4 py-2.5 rounded-lg text-[11px] font-black transition-all border ${att.work_type === 'ลา' ? 'bg-amber-500 text-white border-amber-600 shadow-md' : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'}`}>ลา</button>

                          {isPresent && (
                            <div className="ml-2 flex items-center relative animate-in fade-in duration-300">
                              <input type="number" placeholder="ค่าแรง..." value={att.wage} onChange={(e) => updateAttendance(emp.id, 'wage', e.target.value)} className="w-28 pl-3 pr-8 py-2.5 bg-white border border-stone-300 text-stone-900 font-black rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs shadow-inner tabular-nums" />
                              <span className="absolute right-3 text-[10px] font-bold text-stone-400 pointer-events-none">฿</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <input type="text" placeholder={att.work_type === '' ? "ระบบบันทึก 'ขาด' ให้อัตโนมัติ" : "ระบุหมายเหตุ (ถ้ามี)..."} value={att.note} onChange={(e) => updateAttendance(emp.id, 'note', e.target.value)} className={`w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-stone-800 font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-[11px] transition-colors ${att.work_type === '' ? 'placeholder-stone-400 bg-stone-50' : 'placeholder-stone-400'}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* แถบกดยืนยันด้านล่าง */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-stone-200 p-4 z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <div className="w-full max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 px-2 sm:px-6">
          <p className="text-[11px] sm:text-sm font-bold text-stone-500 text-center sm:text-left">
            ระบบจะบันทึกข้อมูลรวม <span className="text-stone-900 font-black">{employees.length} คน</span> <span className="hidden sm:inline">(คนที่ไม่ระบุสถานะ ระบบจะบันทึกเป็น "ขาด")</span>
          </p>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className={`w-full sm:w-auto px-6 sm:px-10 py-3.5 sm:py-3.5 rounded-xl font-black text-white text-sm sm:text-[15px] shadow-lg transition-all flex items-center justify-center gap-2 border ${saving ? 'bg-stone-400 border-stone-400 shadow-none' : 'bg-emerald-600 border-emerald-700 hover:bg-emerald-500 active:scale-95 shadow-emerald-600/30'}`}
          >
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> บันทึกข้อมูล...</> : `💾 ยืนยันการบันทึกข้อมูล`}
          </button>
        </div>
      </div>

      {/* CUSTOM PROMPT MODAL */}
      {promptDialog.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPromptDialog({ show: false, value: '', targetEmpId: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-[24px] p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 border border-stone-200">
            <h3 className="text-lg font-black text-stone-900 mb-1">➕ เพิ่มชื่องานใหม่</h3>
            <p className="text-[11px] text-stone-500 font-bold mb-5">พิมพ์ชื่องานหรือหน้าที่ใหม่ เช่น ฉีดยา, ใส่ปุ๋ย</p>
            <input 
              type="text" 
              autoFocus
              value={promptDialog.value} 
              onChange={(e) => setPromptDialog({ ...promptDialog, value: e.target.value })} 
              className="w-full px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-900 font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none mb-6 text-sm"
              placeholder="ระบุชื่องาน..."
            />
            <div className="flex gap-3">
              <button onClick={() => setPromptDialog({ show: false, value: '', targetEmpId: '' })} className="flex-1 py-2.5 bg-stone-100 border border-stone-300 hover:bg-stone-200 text-stone-600 font-bold rounded-lg transition-colors text-xs">ยกเลิก</button>
              <button onClick={handleAddNewJob} className="flex-1 py-2.5 bg-indigo-600 border border-indigo-700 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors shadow-md text-xs">บันทึกงาน</button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP แจ้งเตือน */}
      {popup.show && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-[24px] p-8 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95 duration-200 border border-stone-200">
            {popup.type === 'success' ? (
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-5"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg></div>
            ) : (
              <div className="w-16 h-16 bg-rose-50 text-rose-600 border border-rose-200 rounded-full flex items-center justify-center mx-auto mb-5"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></div>
            )}
            <h3 className="text-lg font-black text-stone-900 mb-2">{popup.type === 'success' ? 'บันทึกสำเร็จ!' : 'เกิดข้อผิดพลาด'}</h3>
            <p className="text-[13px] text-stone-500 font-bold mb-6 leading-relaxed">{popup.message}</p>
            <button onClick={() => setPopup({ show: false, type: '', message: '' })} className={`w-full py-3 font-black rounded-xl text-white shadow-md text-[13px] border transition-colors ${popup.type === 'success' ? 'bg-emerald-600 border-emerald-700 hover:bg-emerald-500' : 'bg-rose-600 border-rose-700 hover:bg-rose-500'}`}>
              ตกลงรับทราบ
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.5;
          transition: 0.2s;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover {
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}