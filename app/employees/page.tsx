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

  if (loading) return <div className="min-h-screen bg-[#FCFBF7] flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#FCFBF7] pb-24 font-sans relative">
      
      {/* 🌟 อัปเกรด Header Bar (Responsive) 🌟 */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button onClick={() => router.push('/')} className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors shrink-0">
              <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-stone-800 leading-tight">ฐานข้อมูลพนักงาน</h1>
              <p className="text-[10px] sm:text-xs text-stone-500 mt-0.5">จัดการรายชื่อและข้อมูลติดต่อ</p>
            </div>
          </div>
          <button 
            onClick={openAddModal} 
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 sm:py-2.5 rounded-xl text-sm font-bold shadow-md shadow-blue-600/20 flex items-center justify-center transition-all active:scale-95"
          >
            <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            <span>เพิ่มคนงานใหม่</span>
          </button>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 mt-6 sm:mt-8">
        
        {/* ช่องค้นหา */}
        <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-stone-200 shadow-sm mb-6 flex items-center">
          <div className="relative w-full max-w-md">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือ ตำแหน่ง..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-semibold"
            />
          </div>
        </div>

        {/* ======================================================= */}
        {/* 📱 MOBILE VIEW: แสดงแบบการ์ดพนักงาน (ซ่อนบนจอใหญ่) 📱 */}
        {/* ======================================================= */}
        <div className="block md:hidden space-y-4">
          {filteredEmployees.length > 0 ? filteredEmployees.map((emp) => (
            <div key={`mob-${emp.id}`} className={`bg-white p-4 rounded-2xl border border-stone-200 shadow-sm relative transition-all ${emp.status === 'inactive' ? 'opacity-60 bg-stone-50/50' : ''}`}>
              
              <div className="flex justify-between items-start mb-3 border-b border-stone-100 pb-3">
                <div className="pr-2">
                  <div className="text-xs font-bold text-blue-500 mb-0.5">{emp.emp_code}</div>
                  <div className="font-black text-stone-800 text-lg leading-tight">{emp.full_name}</div>
                </div>
                <div>
                  {emp.status === 'active' 
                    ? <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-[10px] font-black whitespace-nowrap">ทำงานอยู่</span>
                    : <span className="px-2.5 py-1 bg-stone-100 border border-stone-200 text-stone-500 rounded-md text-[10px] font-black whitespace-nowrap">ออก/พักงาน</span>
                  }
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase">ตำแหน่ง</p>
                  <p className="text-sm font-bold text-stone-700 truncate">{emp.position || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase">เบอร์ติดต่อ</p>
                  {emp.phone ? (
                    <a href={`tel:${emp.phone}`} className="text-sm font-bold text-blue-600 flex items-center gap-1">
                      📞 {emp.phone}
                    </a>
                  ) : (
                    <p className="text-sm font-bold text-stone-400">-</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-stone-50">
                <button onClick={() => openEditModal(emp)} className="flex-1 py-2.5 bg-blue-50 text-blue-600 font-bold rounded-xl text-xs hover:bg-blue-100 transition-colors">
                  ⚙️ แก้ไข
                </button>
                <button onClick={() => setShowDeleteModal({ show: true, id: emp.id, name: emp.full_name })} className="flex-1 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl text-xs hover:bg-red-100 transition-colors">
                  🗑️ ลบ
                </button>
              </div>
            </div>
          )) : (
            <div className="text-center py-12 bg-white rounded-2xl border-2 border-stone-200 border-dashed">
              <p className="text-stone-400 font-bold text-sm">ไม่พบรายชื่อพนักงาน</p>
            </div>
          )}
        </div>

        {/* ======================================================= */}
        {/* 💻 DESKTOP VIEW: แสดงแบบตาราง (ซ่อนบนมือถือ) 💻 */}
        {/* ======================================================= */}
        <div className="hidden md:block bg-white rounded-[2rem] border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-4 px-6">รหัส</th>
                  <th className="py-4 px-6">ชื่อ-นามสกุล</th>
                  <th className="py-4 px-6">ตำแหน่ง / หน้าที่</th>
                  <th className="py-4 px-6">เบอร์ติดต่อ</th>
                  <th className="py-4 px-6 text-center">สถานะ</th>
                  <th className="py-4 px-6 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm font-medium text-stone-700">
                {filteredEmployees.length > 0 ? filteredEmployees.map((emp) => (
                  <tr key={emp.id} className={`hover:bg-stone-50/50 transition-colors ${emp.status === 'inactive' ? 'opacity-60' : ''}`}>
                    <td className="py-4 px-6 font-bold text-stone-500">{emp.emp_code}</td>
                    <td className="py-4 px-6 font-black text-stone-800">{emp.full_name}</td>
                    <td className="py-4 px-6 text-stone-600">
                      <span className="px-3 py-1 bg-stone-100 text-stone-700 rounded-md font-bold text-xs">{emp.position || '-'}</span>
                    </td>
                    <td className="py-4 px-6 text-stone-500">{emp.phone || '-'}</td>
                    <td className="py-4 px-6 text-center">
                      {emp.status === 'active' 
                        ? <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-bold">ทำงานอยู่</span>
                        : <span className="px-3 py-1 bg-stone-100 border border-stone-200 text-stone-500 rounded-full text-xs font-bold">ออก/พักงาน</span>
                      }
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEditModal(emp)} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors">
                          แก้ไข
                        </button>
                        <button onClick={() => setShowDeleteModal({ show: true, id: emp.id, name: emp.full_name })} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition-colors">
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="py-12 text-center text-stone-400 font-bold">ไม่พบรายชื่อพนักงาน</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ======================================================= */}
      {/* 🌟 MODAL 1: เพิ่ม/แก้ไข ข้อมูลพนักงาน (Responsive) 🌟 */}
      {/* ======================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowModal(false)}></div>
          
          <div className="bg-white w-full max-w-md rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-black text-stone-800 flex items-center gap-2">
                <span>👷‍♂️</span> {editingEmp ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600 bg-stone-100 w-8 h-8 rounded-full flex items-center justify-center font-bold">✕</button>
            </div>

            <div className="space-y-4">
              
              {/* เปลี่ยนจาก Grid-cols-2 เป็นแนวดิ่งบนมือถือ */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-1/2">
                  <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block">รหัสพนักงาน</label>
                  <input type="text" value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="EMP-001" className="w-full px-4 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div className="w-full sm:w-1/2">
                  <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block">สถานะ</label>
                  <select value={formStatus} onChange={(e: any) => setFormStatus(e.target.value)} className="w-full px-3 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-bold outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="active">🟢 ทำงานอยู่</option>
                    <option value="inactive">⚪ ออก/พักงาน</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block">ชื่อ-นามสกุล</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="เช่น สมหมาย ใจดี" className="w-full px-4 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-1/2">
                  <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block">ตำแหน่ง / หน้าที่</label>
                  <div className="flex gap-2">
                    <select 
                      value={formPosition} 
                      onChange={(e) => setFormPosition(e.target.value)} 
                      className="flex-1 px-3 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-bold outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm truncate"
                    >
                      {positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button 
                      type="button" 
                      onClick={() => setPromptDialog({ show: true, value: '' })} 
                      title="เพิ่มตำแหน่งใหม่" 
                      className="bg-blue-100 text-blue-700 px-3.5 rounded-xl font-black text-xl hover:bg-blue-200 transition-colors shrink-0"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="w-full sm:w-1/2">
                  <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block">เบอร์ติดต่อ</label>
                  <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="08x-xxx-xxxx" className="w-full px-4 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <button onClick={handleSave} disabled={saving} className={`w-full mt-6 sm:mt-8 py-3.5 sm:py-4 rounded-xl font-black text-white text-base sm:text-lg shadow-lg transition-all ${saving ? 'bg-stone-300' : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-600/20'}`}>
              {saving ? 'กำลังบันทึก...' : '💾 ยืนยันบันทึกข้อมูล'}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 CUSTOM PROMPT MODAL: เพิ่มตำแหน่ง/หน้าที่ใหม่ 🌟 */}
      {/* ======================================================= */}
      {promptDialog.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPromptDialog({ show: false, value: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg sm:text-xl font-black text-stone-800 mb-2">➕ เพิ่มตำแหน่ง / หน้าที่</h3>
            <p className="text-xs sm:text-sm text-stone-500 mb-5">พิมพ์ตำแหน่งงานใหม่ที่ต้องการเพิ่มลงในระบบ</p>
            <input 
              type="text" 
              autoFocus
              value={promptDialog.value} 
              onChange={(e) => setPromptDialog({ ...promptDialog, value: e.target.value })} 
              className="w-full px-4 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none mb-5 sm:mb-6 text-sm"
              placeholder="เช่น เสมียน, หัวหน้างาน..."
            />
            <div className="flex gap-3">
              <button onClick={() => setPromptDialog({ show: false, value: '' })} className="flex-1 py-2.5 sm:py-3 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold rounded-xl transition-colors text-sm">ยกเลิก</button>
              <button onClick={executeAddPosition} className="flex-1 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-md shadow-blue-500/20 text-sm">บันทึกตำแหน่ง</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 MODAL 2: ป๊อปอัปยืนยันการลบข้อมูลพนักงาน (ลบถาวร) 🌟 */}
      {/* ======================================================= */}
      {showDeleteModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowDeleteModal({ show: false, id: '', name: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-stone-800 mb-2">ยืนยันการลบข้อมูล</h3>
            <p className="text-xs sm:text-sm text-stone-500 mb-6">ต้องการลบรายชื่อ <strong className="text-stone-800">{showDeleteModal.name}</strong> ออกจากระบบฐานข้อมูลใช่หรือไม่?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal({ show: false, id: '', name: '' })} className="flex-1 py-2.5 sm:py-3 bg-stone-100 text-stone-600 font-bold rounded-xl hover:bg-stone-200 transition-colors text-sm">ยกเลิก</button>
              <button onClick={executeDelete} disabled={saving} className="flex-1 py-2.5 sm:py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-md transition-colors text-sm">ลบถาวร</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 POPUP แจ้งเตือนสถานะความสำเร็จ / ขัดข้อง 🌟 */}
      {/* ======================================================= */}
      {popup.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-xs animate-in fade-in" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95 duration-200 border border-stone-100">
            {popup.type === 'success' ? (
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div>
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></div>
            )}
            <h3 className="text-base sm:text-lg font-black text-stone-800 mb-2">{popup.type === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}</h3>
            <p className="text-xs sm:text-sm text-stone-500 mb-6 leading-relaxed">{popup.message}</p>
            <button onClick={() => setPopup({ show: false, type: '', message: '' })} className={`w-full py-2.5 sm:py-3 font-bold rounded-xl text-white shadow-md text-sm ${popup.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}>
              ตกลง
            </button>
          </div>
        </div>
      )}

    </div>
  );
}