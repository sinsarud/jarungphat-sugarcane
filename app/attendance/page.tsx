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

  if (loading) return <div className="min-h-screen bg-[#FCFBF7] flex items-center justify-center"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#FCFBF7] pb-32 font-sans relative">
      
      {/* Header Bar */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
            <button onClick={() => router.push('/')} className="p-2 mt-1 sm:mt-0 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors shrink-0">
              <svg className="w-6 h-6 sm:w-6 sm:h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-stone-800 leading-tight">
                เช็คชื่อเข้างาน <span className="block sm:inline sm:ml-1 text-sm sm:text-xl text-stone-500 sm:text-stone-800">(ระบุเฉพาะคนที่มา)</span>
              </h1>
              <p className="text-[10px] sm:text-xs text-stone-500 mt-1 sm:mt-0">ใครไม่มา ไม่ต้องกด ระบบจะบันทึกเป็น "ขาด" ให้อัตโนมัติ</p>
            </div>
          </div>
          
          {/* 🌟 ปรับปรุงส่วนปุ่มด้านขวา: เพิ่มปุ่มดูประวัติย้อนหลัง 🌟 */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex w-full sm:w-auto items-center gap-2 bg-stone-50 sm:bg-transparent p-2 sm:p-0 rounded-xl border sm:border-none border-stone-200">
              <label className="text-xs sm:text-sm font-bold text-stone-600 shrink-0 ml-2 sm:ml-0">ประจำวันที่:</label>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-white border border-stone-200 rounded-lg sm:rounded-xl text-stone-800 font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm text-sm"
              />
            </div>
            
            {/* ปุ่มทางลัดไปหน้าดูประวัติ / โหลด Excel */}
            <button 
              onClick={() => router.push('/attendance/history')} 
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-xl transition-colors shadow-sm text-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ดูประวัติ / โหลด Excel
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 mt-4 sm:mt-6">
        
        {/* การ์ดสรุปยอด */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-emerald-50/50 border border-emerald-100 p-3 sm:p-5 rounded-xl sm:rounded-2xl text-center shadow-sm">
            <p className="text-[10px] sm:text-xs font-black text-emerald-600 mb-1">👥 คนมาทำงาน</p>
            <h3 className="text-xl sm:text-3xl font-black text-emerald-700">{presentCount}</h3>
          </div>
          <div className="bg-rose-50/50 border border-rose-100 p-3 sm:p-5 rounded-xl sm:rounded-2xl text-center shadow-sm">
            <p className="text-[10px] sm:text-xs font-black text-rose-600 mb-1">❌ ขาด/ลาที่ระบุ</p>
            <h3 className="text-xl sm:text-3xl font-black text-rose-700">{absentCount}</h3>
          </div>
          <div className="bg-stone-50 border border-stone-200 p-3 sm:p-5 rounded-xl sm:rounded-2xl text-center shadow-sm">
            <p className="text-[10px] sm:text-xs font-black text-stone-500 mb-1">⚠️ ไม่ระบุ (นับว่าขาด)</p>
            <h3 className="text-xl sm:text-3xl font-black text-stone-800">{emptyCount}</h3>
          </div>
          <div className="bg-white border border-amber-200 p-3 sm:p-5 rounded-xl sm:rounded-2xl text-center shadow-sm">
            <p className="text-[10px] sm:text-xs font-black text-amber-600 mb-1">💰 รวมค่าแรง (บาท)</p>
            <h3 className="text-xl sm:text-3xl font-black text-amber-600">{totalWage.toLocaleString()}</h3>
          </div>
        </div>


        {/* ======================================================= */}
        {/* 📱 MOBILE VIEW: แสดงแบบการ์ด (ซ่อนตอนจอใหญ่) 📱 */}
        {/* ======================================================= */}
        <div className="block md:hidden space-y-4 mb-10">
          {employees.map((emp) => {
            const att = attendances[emp.id] || { work_type: '', wage: '', note: '' };
            const isPresent = att.work_type && !['ขาด', 'ลา'].includes(att.work_type);
            const isCustomWork = att.work_type && !standardTypes.includes(att.work_type);

            return (
              <div key={`mob-${emp.id}`} className={`p-4 rounded-2xl border transition-all ${isPresent ? 'bg-emerald-50/50 border-emerald-300 shadow-md' : 'bg-white border-stone-200 shadow-sm'}`}>
                
                {/* ชื่อและตำแหน่ง */}
                <div className="flex justify-between items-start mb-3 border-b border-stone-100 pb-3">
                  <div>
                    <div className="font-black text-stone-800 text-lg">{emp.full_name}</div>
                    <div className="text-xs text-stone-500 font-bold mt-0.5">{emp.position || 'พนักงาน'}</div>
                  </div>
                  {/* แสดง Badge สีๆ ถ้ามีข้อมูลแล้ว */}
                  {att.work_type && (
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black text-white shadow-sm ${att.work_type === 'เต็มวัน' ? 'bg-emerald-500' : att.work_type === 'ครึ่งวัน' ? 'bg-sky-500' : ['ขาด', 'ลา'].includes(att.work_type) ? 'bg-rose-500' : 'bg-indigo-500'}`}>
                      {att.work_type}
                    </span>
                  )}
                </div>

                {/* ปุ่มกดสถานะ (กางเต็มจอ) */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <button onClick={() => handleToggleWorkType(emp.id, 'เต็มวัน')} className={`col-span-2 py-2.5 rounded-xl text-xs font-black transition-all ${att.work_type === 'เต็มวัน' ? 'bg-emerald-500 text-white shadow-md' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>เต็มวัน</button>
                  <button onClick={() => handleToggleWorkType(emp.id, 'ครึ่งวัน')} className={`col-span-2 py-2.5 rounded-xl text-xs font-black transition-all ${att.work_type === 'ครึ่งวัน' ? 'bg-sky-500 text-white shadow-md' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>ครึ่งวัน</button>
                  
                  <select 
                    value={isCustomWork ? att.work_type : ''} 
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW') setPromptDialog({ show: true, value: '', targetEmpId: emp.id });
                      else updateAttendance(emp.id, 'work_type', e.target.value);
                    }}
                    className={`col-span-2 px-2 py-2.5 rounded-xl text-xs font-black outline-none cursor-pointer transition-all ${isCustomWork ? 'bg-indigo-500 text-white shadow-md' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                  >
                    <option value="" disabled>งานอื่นๆ ▾</option>
                    {jobOptions.map(job => <option key={job} value={job} className="text-stone-800 bg-white">{job}</option>)}
                    <option value="ADD_NEW" className="text-indigo-600 bg-indigo-50 font-bold">➕ เพิ่มใหม่...</option>
                  </select>

                  <button onClick={() => handleToggleWorkType(emp.id, 'ขาด')} className={`col-span-1 py-2.5 rounded-xl text-xs font-black transition-all ${att.work_type === 'ขาด' ? 'bg-red-500 text-white shadow-md' : 'bg-stone-100 text-stone-500 hover:bg-red-100 hover:text-red-600'}`}>ขาด</button>
                  <button onClick={() => handleToggleWorkType(emp.id, 'ลา')} className={`col-span-1 py-2.5 rounded-xl text-xs font-black transition-all ${att.work_type === 'ลา' ? 'bg-amber-500 text-white shadow-md' : 'bg-stone-100 text-stone-500 hover:bg-amber-100 hover:text-amber-600'}`}>ลา</button>
                </div>

                {/* ช่องกรอกตัวเลขและหมายเหตุ (เรียงแนวตั้ง) */}
                <div className="space-y-2 mt-2">
                  {isPresent && (
                    <div className="flex items-center relative animate-in fade-in duration-300">
                      <div className="absolute left-3 text-xs font-bold text-emerald-700">ค่าแรงวันนี้:</div>
                      <input 
                        type="number" 
                        placeholder="0" 
                        value={att.wage}
                        onChange={(e) => updateAttendance(emp.id, 'wage', e.target.value)}
                        className="w-full pl-24 pr-8 py-3 bg-white border-2 border-emerald-200 text-emerald-800 font-black rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-right shadow-inner"
                      />
                      <span className="absolute right-3 text-[10px] font-bold text-emerald-500">฿</span>
                    </div>
                  )}
                  
                  <input 
                    type="text" 
                    placeholder={att.work_type === '' ? "หมายเหตุ (เว้นว่าง = ระบบจัดว่าขาด)" : "ระบุหมายเหตุ (ถ้ามี)..."}
                    value={att.note}
                    onChange={(e) => updateAttendance(emp.id, 'note', e.target.value)}
                    className={`w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 outline-none focus:ring-2 focus:ring-emerald-500 text-xs transition-colors`}
                  />
                </div>

              </div>
            );
          })}
        </div>


        {/* ======================================================= */}
        {/* 💻 DESKTOP VIEW: แสดงแบบตาราง (ซ่อนตอนจอมือถือ) 💻 */}
        {/* ======================================================= */}
        <div className="hidden md:block bg-white rounded-[2rem] border border-stone-200 shadow-sm overflow-hidden mb-10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-4 px-6 w-1/4">รายชื่อคนงาน</th>
                  <th className="py-4 px-6 w-[55%]">สถานะการทำงาน & ค่าแรงวันนี้</th>
                  <th className="py-4 px-6 w-1/4">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm font-medium">
                {employees.map((emp) => {
                  const att = attendances[emp.id] || { work_type: '', wage: '', note: '' };
                  const isPresent = att.work_type && !['ขาด', 'ลา'].includes(att.work_type);
                  const isCustomWork = att.work_type && !standardTypes.includes(att.work_type);

                  return (
                    <tr key={emp.id} className={`hover:bg-stone-50 transition-colors ${isPresent ? 'bg-emerald-50/10' : ''}`}>
                      <td className="py-4 px-6">
                        <div className="font-black text-stone-800 text-base">{emp.full_name}</div>
                        <div className="text-xs text-stone-400 font-bold mt-0.5">{emp.position || 'พนักงาน'}</div>
                      </td>
                      
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <button onClick={() => handleToggleWorkType(emp.id, 'เต็มวัน')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${att.work_type === 'เต็มวัน' ? 'bg-emerald-500 text-white shadow-md' : 'bg-stone-50 text-stone-500 border border-stone-200 hover:bg-stone-100'}`}>เต็มวัน</button>
                          <button onClick={() => handleToggleWorkType(emp.id, 'ครึ่งวัน')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${att.work_type === 'ครึ่งวัน' ? 'bg-sky-500 text-white shadow-md' : 'bg-stone-50 text-stone-500 border border-stone-200 hover:bg-stone-100'}`}>ครึ่งวัน</button>

                          <select value={isCustomWork ? att.work_type : ''} onChange={(e) => { if (e.target.value === 'ADD_NEW') setPromptDialog({ show: true, value: '', targetEmpId: emp.id }); else updateAttendance(emp.id, 'work_type', e.target.value); }} className={`px-3 py-2 rounded-xl text-xs font-black outline-none cursor-pointer transition-all ${isCustomWork ? 'bg-indigo-500 text-white shadow-md border-transparent' : 'bg-stone-50 text-stone-500 border border-stone-200 hover:bg-stone-100'}`}>
                            <option value="" disabled>งานอื่นๆ ▾</option>
                            {jobOptions.map(job => <option key={job} value={job} className="text-stone-800 bg-white">{job}</option>)}
                            <option value="ADD_NEW" className="text-indigo-600 bg-indigo-50 font-bold">➕ เพิ่มใหม่...</option>
                          </select>

                          <div className="w-px h-6 bg-stone-200 mx-1"></div>

                          <button onClick={() => handleToggleWorkType(emp.id, 'ขาด')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${att.work_type === 'ขาด' ? 'bg-red-500 text-white shadow-md' : 'bg-stone-50 text-stone-500 border border-stone-200 hover:bg-red-50 hover:text-red-500'}`}>ขาด</button>
                          <button onClick={() => handleToggleWorkType(emp.id, 'ลา')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${att.work_type === 'ลา' ? 'bg-amber-500 text-white shadow-md' : 'bg-stone-50 text-stone-500 border border-stone-200 hover:bg-amber-50 hover:text-amber-600'}`}>ลา</button>

                          {isPresent && (
                            <div className="ml-4 flex items-center relative animate-in fade-in duration-300">
                              <input type="number" placeholder="ค่าแรง..." value={att.wage} onChange={(e) => updateAttendance(emp.id, 'wage', e.target.value)} className="w-28 pl-4 pr-8 py-2 bg-emerald-50/50 border border-emerald-200 text-emerald-800 font-black rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                              <span className="absolute right-3 text-[10px] font-bold text-emerald-600 pointer-events-none">฿</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-6">
                        <input type="text" placeholder={att.work_type === '' ? "ระบบจะบันทึกเป็น 'ขาด' ให้อัตโนมัติ" : "หมายเหตุ (ถ้ามี)..."} value={att.note} onChange={(e) => updateAttendance(emp.id, 'note', e.target.value)} className={`w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-600 outline-none focus:ring-2 focus:ring-emerald-500 text-xs transition-colors ${att.work_type === '' ? 'placeholder-stone-300' : 'placeholder-stone-400'}`} />
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
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-3 sm:p-6 z-40 shadow-[0_-15px_40px_rgba(0,0,0,0.08)]">
        <div className="w-full max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <p className="text-[10px] sm:text-sm font-bold text-stone-500 text-center sm:text-left">
            ระบบจะบันทึกข้อมูลคนงานครบทั้ง <span className="text-stone-800">{employees.length} คน</span> (คนที่ไม่ระบุ = ขาด)
          </p>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className={`w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-white text-sm sm:text-base shadow-lg transition-all flex items-center justify-center gap-2 ${saving ? 'bg-stone-400' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-emerald-600/20'}`}
          >
            {saving ? '⏳ กำลังบันทึก...' : `💾 ยืนยันบันทึกข้อมูล (${employees.length} คน)`}
          </button>
        </div>
      </div>

      {/* CUSTOM PROMPT MODAL */}
      {promptDialog.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPromptDialog({ show: false, value: '', targetEmpId: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-3xl p-6 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg sm:text-xl font-black text-stone-800 mb-2">➕ เพิ่มชื่องานใหม่</h3>
            <p className="text-xs sm:text-sm text-stone-500 mb-5">พิมพ์ชื่องานหรือหน้าที่ใหม่ เช่น ฉีดยา, ใส่ปุ๋ย</p>
            <input 
              type="text" 
              autoFocus
              value={promptDialog.value} 
              onChange={(e) => setPromptDialog({ ...promptDialog, value: e.target.value })} 
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-bold focus:ring-2 focus:ring-indigo-500 outline-none mb-6 text-sm"
              placeholder="ระบุชื่องาน..."
            />
            <div className="flex gap-3">
              <button onClick={() => setPromptDialog({ show: false, value: '', targetEmpId: '' })} className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold rounded-xl transition-colors text-sm">ยกเลิก</button>
              <button onClick={handleAddNewJob} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-md shadow-indigo-500/20 text-sm">บันทึกงาน</button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP แจ้งเตือน */}
      {popup.show && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-xs animate-in fade-in" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-3xl p-6 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95 duration-200 border border-stone-100">
            {popup.type === 'success' ? (
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div>
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></div>
            )}
            <h3 className="text-base sm:text-lg font-black text-stone-800 mb-2">{popup.type === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}</h3>
            <p className="text-xs sm:text-sm text-stone-500 mb-6 leading-relaxed">{popup.message}</p>
            <button onClick={() => setPopup({ show: false, type: '', message: '' })} className={`w-full py-3 sm:py-3.5 font-bold rounded-xl text-white shadow-md text-sm sm:text-base ${popup.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}>
              ตกลง
            </button>
          </div>
        </div>
      )}

    </div>
  );
}