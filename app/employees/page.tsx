'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface Employee {
  id: string;
  emp_code: string;
  full_name: string;
  position: string;
  phone: string;
  status: 'active' | 'inactive';
}

export default function EmployeesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 🌟 State สำหรับเก็บตัวเลือกตำแหน่ง
  const [positions, setPositions] = useState<string[]>([]);

  // States สำหรับ Popup Modals
  const [showModal, setShowModal] = useState(false); 
  const [showDeleteModal, setShowDeleteModal] = useState({ show: false, id: '', name: '' });
  const [promptDialog, setPromptDialog] = useState({ show: false, value: '' }); 
  const [popup, setPopup] = useState({ show: false, type: '', message: '' }); 

  // States สำหรับข้อมูลในฟอร์ม
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');

  const fetchEmployees = async () => {
    const { data: empData, error: empError } = await supabase
      .from('employees')
      .select('*')
      .order('emp_code', { ascending: true });

    if (empData && !empError) {
      setEmployees(empData);
    }

    const { data: optData } = await supabase
      .from('employee_options')
      .select('label')
      .eq('category', 'position');
    
    if (optData && optData.length > 0) {
      const loadedPositions = optData.map((d: any) => d.label);
      setPositions(loadedPositions);
      if (!editingEmp) setFormPosition(loadedPositions[0]);
    } else {
      setPositions(['คนตัดอ้อย', 'คนขับรถคีบ', 'คนขับรถไถ', 'คนงานทั่วไป']);
      if (!editingEmp) setFormPosition('คนตัดอ้อย');
    }

    setLoading(false);
  };

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push('/login');
      else fetchEmployees();
    }
    checkAuth();
  }, [router]);

  const openAddModal = () => {
    setEditingEmp(null);
    const nextCodeNum = employees.length > 0 
      ? Math.max(...employees.map(e => parseInt(e.emp_code.replace('EMP-', '') || '0'))) + 1 
      : 1;
    setFormCode(`EMP-${String(nextCodeNum).padStart(3, '0')}`);
    setFormName('');
    setFormPosition(positions.length > 0 ? positions[0] : 'คนตัดอ้อย');
    setFormPhone('');
    setFormStatus('active');
    setShowModal(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmp(emp);
    setFormCode(emp.emp_code);
    setFormName(emp.full_name);
    
    if (emp.position && !positions.includes(emp.position)) {
      setPositions([...positions, emp.position]);
    }
    
    setFormPosition(emp.position || (positions.length > 0 ? positions[0] : ''));
    setFormPhone(emp.phone || '');
    setFormStatus(emp.status);
    setShowModal(true);
  };

  const executeAddPosition = async () => {
    const cleanLabel = promptDialog.value.trim();
    if (!cleanLabel) {
      setPromptDialog({ show: false, value: '' });
      return;
    }
    if (positions.includes(cleanLabel)) {
      setPopup({ show: true, type: 'error', message: 'มีตำแหน่งหน้าที่นี้ในระบบอยู่แล้วครับ' });
      return;
    }

    const { error } = await supabase.from('employee_options').insert([{ category: 'position', label: cleanLabel }]);
    
    if (error) {
      setPopup({ show: true, type: 'error', message: 'เกิดข้อผิดพลาดในการบันทึก: ' + error.message });
    } else {
      setPositions([...positions, cleanLabel]);
      setFormPosition(cleanLabel); 
      setPromptDialog({ show: false, value: '' });
    }
  };

  const handleSave = async () => {
    if (!formCode.trim() || !formName.trim()) {
      setPopup({ show: true, type: 'error', message: 'กรุณากรอก รหัสพนักงาน และ ชื่อ-นามสกุล ให้ครบถ้วน' });
      return;
    }

    setSaving(true);
    const empData = {
      emp_code: formCode.trim().toUpperCase(),
      full_name: formName.trim(),
      position: formPosition.trim(),
      phone: formPhone.trim(),
      status: formStatus
    };

    try {
      if (editingEmp) {
        const { error } = await supabase.from('employees').update(empData).eq('id', editingEmp.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('employees').insert([empData]);
        if (error) throw error;
      }

      setShowModal(false);
      setPopup({ show: true, type: 'success', message: 'บันทึกข้อมูลพนักงานเรียบร้อยแล้ว!' });
      fetchEmployees();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('employees').delete().eq('id', showDeleteModal.id);
      if (error) throw error;

      setShowDeleteModal({ show: false, id: '', name: '' });
      setPopup({ show: true, type: 'success', message: `ลบข้อมูล "${showDeleteModal.name}" ออกจากระบบแล้ว` });
      fetchEmployees();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    emp.emp_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.position && emp.position.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) return <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24 font-sans relative selection:bg-blue-500 selection:text-white">
      
      {/* 🌟 Premium Header Bar */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* ⬅️ ปุ่มย้อนกลับดีไซน์ใหม่ */}
            <button onClick={() => router.push('/')} className="group w-10 h-10 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm">
              <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            
            <div className="h-8 w-px bg-slate-200 hidden sm:block mx-1"></div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">ฐานข้อมูลพนักงาน</h1>
                <p className="text-[11px] font-bold text-slate-500 leading-none hidden sm:block uppercase tracking-wider">
                  จัดการรายชื่อและข้อมูลติดต่อ
                </p>
              </div>
            </div>
          </div>
          
          <button 
            onClick={openAddModal} 
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white px-6 py-3 sm:py-2.5 rounded-xl text-sm font-black shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
            <span>เพิ่มพนักงานใหม่</span>
          </button>
        </div>
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 mt-8">
        
        {/* 🌟 ช่องค้นหา (Search Box High Contrast) */}
        <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm mb-6 flex items-center">
          <div className="relative w-full max-w-lg">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input
              type="text"
              placeholder="ค้นหาชื่อ, รหัส, หรือตำแหน่งพนักงาน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm font-bold shadow-sm"
            />
          </div>
        </div>

        {/* ======================================================= */}
        {/* 📱 MOBILE VIEW: แสดงแบบการ์ดพนักงาน (ซ่อนบนจอใหญ่) */}
        {/* ======================================================= */}
        <div className="block md:hidden space-y-4">
          {filteredEmployees.length > 0 ? filteredEmployees.map((emp) => (
            <div key={`mob-${emp.id}`} className={`bg-white p-5 rounded-[20px] border border-slate-200 shadow-sm relative transition-all ${emp.status === 'inactive' ? 'opacity-60 bg-slate-50/50' : ''}`}>
              
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                <div className="pr-2">
                  <div className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block mb-1.5 border border-blue-100">{emp.emp_code}</div>
                  <div className="font-black text-slate-900 text-lg leading-tight">{emp.full_name}</div>
                </div>
                <div>
                  {emp.status === 'active' 
                    ? <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-[10px] font-black whitespace-nowrap shadow-sm">ทำงานอยู่</span>
                    : <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-md text-[10px] font-black whitespace-nowrap shadow-sm">ออก/พักงาน</span>
                  }
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">ตำแหน่ง</p>
                  <p className="text-[13px] font-bold text-slate-800 truncate">{emp.position || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">เบอร์ติดต่อ</p>
                  {emp.phone ? (
                    <a href={`tel:${emp.phone}`} className="text-[13px] font-bold text-blue-600 flex items-center gap-1.5">
                      📞 {emp.phone}
                    </a>
                  ) : (
                    <p className="text-[13px] font-bold text-slate-400">-</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => openEditModal(emp)} className="flex-1 py-3 bg-white border border-blue-200 text-blue-600 font-black rounded-xl text-xs hover:bg-blue-50 transition-colors shadow-sm">
                  แก้ไขข้อมูล
                </button>
                <button onClick={() => setShowDeleteModal({ show: true, id: emp.id, name: emp.full_name })} className="flex-1 py-3 bg-white border border-rose-200 text-rose-600 font-black rounded-xl text-xs hover:bg-rose-50 transition-colors shadow-sm">
                  ลบรายชื่อ
                </button>
              </div>
            </div>
          )) : (
            <div className="text-center py-16 bg-white rounded-[24px] border border-slate-200 shadow-sm">
              <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
              </div>
              <p className="text-slate-400 font-bold text-xs">ไม่พบรายชื่อพนักงาน</p>
            </div>
          )}
        </div>

        {/* ======================================================= */}
        {/* 💻 DESKTOP VIEW: แสดงแบบตาราง (หัวตารางสีสว่าง คลีน) */}
        {/* ======================================================= */}
        <div className="hidden md:block bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50">
                <tr className="border-b-2 border-slate-200 text-[12px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="py-4 px-6 border-r border-slate-200">รหัส</th>
                  <th className="py-4 px-6 border-r border-slate-200">ชื่อ-นามสกุล</th>
                  <th className="py-4 px-6 border-r border-slate-200">ตำแหน่ง / หน้าที่</th>
                  <th className="py-4 px-6 border-r border-slate-200">เบอร์ติดต่อ</th>
                  <th className="py-4 px-6 text-center border-r border-slate-200">สถานะ</th>
                  <th className="py-4 px-6 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredEmployees.length > 0 ? filteredEmployees.map((emp) => (
                  <tr key={emp.id} className={`hover:bg-blue-50/40 transition-colors even:bg-slate-50/50 ${emp.status === 'inactive' ? 'opacity-60' : ''}`}>
                    <td className="py-4 px-6 font-black text-blue-600 border-r border-slate-100">{emp.emp_code}</td>
                    <td className="py-4 px-6 font-black text-slate-900 border-r border-slate-100 text-[15px]">{emp.full_name}</td>
                    <td className="py-4 px-6 text-slate-700 border-r border-slate-100">
                      <span className="px-3 py-1 bg-white border border-slate-200 text-slate-700 rounded-md font-bold text-[11px] shadow-sm">{emp.position || '-'}</span>
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-bold border-r border-slate-100">{emp.phone || '-'}</td>
                    <td className="py-4 px-6 text-center border-r border-slate-100">
                      {emp.status === 'active' 
                        ? <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[11px] font-black shadow-sm">ทำงานอยู่</span>
                        : <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-full text-[11px] font-black shadow-sm">ออก/พักงาน</span>
                      }
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEditModal(emp)} className="text-xs font-bold text-blue-600 hover:text-white bg-white hover:bg-blue-500 px-3 py-2 rounded-lg border border-blue-200 transition-colors shadow-sm">
                          แก้ไข
                        </button>
                        <button onClick={() => setShowDeleteModal({ show: true, id: emp.id, name: emp.full_name })} className="text-xs font-bold text-rose-600 hover:text-white bg-white hover:bg-rose-500 px-3 py-2 rounded-lg border border-rose-200 transition-colors shadow-sm">
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="py-20 text-center bg-slate-50">
                      <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                      </div>
                      <p className="text-slate-400 font-bold text-sm">ไม่พบรายชื่อพนักงาน</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ======================================================= */}
      {/* 🌟 MODAL 1: เพิ่ม/แก้ไข ข้อมูลพนักงาน (Premium UI) 🌟 */}
      {/* ======================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowModal(false)}></div>
          
          <div className="bg-white w-full max-w-lg rounded-[24px] shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[95vh] border border-slate-200">
            {/* แถบสีตกแต่งด้านบน */}
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-600 shrink-0"></div>
            
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                {editingEmp ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors">✕</button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar bg-white space-y-5">
              
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="w-full sm:w-1/2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 block ml-1">รหัสพนักงาน</label>
                  <input type="text" value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="EMP-001" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-blue-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm shadow-sm transition-all uppercase" />
                </div>
                <div className="w-full sm:w-1/2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 block ml-1">สถานะ</label>
                  <select value={formStatus} onChange={(e: any) => setFormStatus(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm shadow-sm transition-all appearance-none cursor-pointer">
                    <option value="active">🟢 กำลังทำงานอยู่</option>
                    <option value="inactive">⚪ ออก / พักงาน</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 block ml-1">ชื่อ-นามสกุล</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="เช่น สมหมาย ใจดี" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm shadow-sm transition-all" />
              </div>

              <div className="flex flex-col sm:flex-row gap-5">
                <div className="w-full sm:w-1/2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 block ml-1">ตำแหน่ง / หน้าที่</label>
                  <div className="flex gap-2">
                    <select 
                      value={formPosition} 
                      onChange={(e) => setFormPosition(e.target.value)} 
                      className="flex-1 px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm shadow-sm transition-all appearance-none cursor-pointer truncate"
                    >
                      {positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button 
                      type="button" 
                      onClick={() => setPromptDialog({ show: true, value: '' })} 
                      title="เพิ่มตำแหน่งใหม่" 
                      className="bg-white border border-blue-200 text-blue-600 px-4 rounded-xl font-black text-lg hover:bg-blue-50 hover:border-blue-300 transition-colors shrink-0 shadow-sm"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="w-full sm:w-1/2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 block ml-1">เบอร์ติดต่อ (ไม่บังคับ)</label>
                  <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="08x-xxx-xxxx" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm shadow-sm transition-all" />
                </div>
              </div>

            </div>

            <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex gap-3 sm:gap-4 shrink-0 rounded-b-[24px]">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-bold rounded-xl text-sm sm:text-[15px] transition-colors shadow-sm">
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving} className={`flex-[2] py-3.5 rounded-xl font-black text-white text-sm sm:text-[15px] shadow-lg transition-all border flex items-center justify-center gap-2 ${saving ? 'bg-slate-400 border-slate-400 shadow-none cursor-not-allowed' : 'bg-blue-600 border-blue-700 hover:bg-blue-700 active:scale-[0.98] shadow-blue-600/30'}`}>
                {saving ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> กำลังบันทึก...</>
                ) : '💾 ยืนยันบันทึกข้อมูล'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 MODAL 2: CUSTOM PROMPT เพิ่มตำแหน่งใหม่ (z-[120]) 🌟 */}
      {/* ======================================================= */}
      {promptDialog.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPromptDialog({ show: false, value: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 sm:p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
              เพิ่มตำแหน่ง / หน้าที่
            </h3>
            <p className="text-[12px] font-bold text-slate-500 mb-6">พิมพ์ชื่อตำแหน่งงานใหม่ที่ต้องการเพิ่มลงในระบบ</p>
            <input 
              type="text" 
              autoFocus
              value={promptDialog.value} 
              onChange={(e) => setPromptDialog({ ...promptDialog, value: e.target.value })} 
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none mb-6 text-sm shadow-sm transition-all"
              placeholder="เช่น เสมียน, หัวหน้างาน..."
            />
            <div className="flex gap-3">
              <button onClick={() => setPromptDialog({ show: false, value: '' })} className="flex-1 py-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition-colors text-[13px] shadow-sm">ยกเลิก</button>
              <button onClick={executeAddPosition} className="flex-[1.5] py-3 bg-blue-600 border border-blue-700 hover:bg-blue-700 text-white font-black rounded-xl transition-all shadow-md shadow-blue-500/30 active:scale-[0.98] text-[13px]">บันทึกตำแหน่ง</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 MODAL 3: ป๊อปอัปยืนยันการลบข้อมูล (z-[140]) 🌟 */}
      {/* ======================================================= */}
      {showDeleteModal.show && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowDeleteModal({ show: false, id: '', name: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 sm:p-8 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">ยืนยันการลบข้อมูล</h3>
            <p className="text-[13px] font-bold text-slate-500 mb-8 px-2 leading-relaxed">
              ต้องการลบรายชื่อ <strong className="text-slate-900">{showDeleteModal.name}</strong> ออกจากระบบฐานข้อมูลใช่หรือไม่?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal({ show: false, id: '', name: '' })} className="flex-1 py-3 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors text-[13px] shadow-sm">ยกเลิก</button>
              <button onClick={executeDelete} disabled={saving} className="flex-1 py-3 bg-rose-600 border border-rose-700 text-white font-black rounded-xl hover:bg-rose-700 shadow-md shadow-rose-500/30 active:scale-[0.98] transition-all text-[13px]">
                {saving ? 'กำลังลบ...' : 'ลบถาวร'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 POPUP แจ้งเตือนสถานะความสำเร็จ / ขัดข้อง (z-[150]) 🌟 */}
      {/* ======================================================= */}
      {popup.show && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-[24px] p-8 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 border ${
              popup.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'
            }`}>
              {popup.type === 'success' ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              )}
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">{popup.type === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}</h3>
            <p className="text-[13px] font-bold text-slate-500 mb-8 leading-relaxed px-2">{popup.message}</p>
            <button onClick={() => setPopup({ show: false, type: '', message: '' })} className={`w-full py-3.5 font-black rounded-xl text-white shadow-md text-[13px] border transition-colors active:scale-[0.98] ${
              popup.type === 'success' ? 'bg-emerald-600 border-emerald-700 hover:bg-emerald-700 shadow-emerald-600/30' : 'bg-rose-600 border-rose-700 hover:bg-rose-700 shadow-rose-600/30'
            }`}>
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
      `}</style>
    </div>
  );
}