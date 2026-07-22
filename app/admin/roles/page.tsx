'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase'; // เช็ค Path ให้ตรงกับของคุณ

// 🌟 รายการเมนูทั้งหมดในระบบ (เพื่อเอาไปสร้าง Checkbox ให้ติ๊กเลือก)
const MENU_LIST = [
  { id: 'executive', name: 'แดชบอร์ดผู้บริหาร', group: 'ผู้บริหาร & สรุปผล' },
  { id: 'sugarcane', name: 'คำนวณเงินค่าอ้อย', group: 'ผู้บริหาร & สรุปผล' },
  { id: 'expenses', name: 'บันทึกค่าใช้จ่าย', group: 'ผู้บริหาร & สรุปผล' },
  { id: 'attendance', name: 'เช็คชื่อเข้างาน', group: 'บุคคล & ค่าแรง' },
  { id: 'payroll', name: 'คิดเงินสดรายคน', group: 'บุคคล & ค่าแรง' },
  { id: 'advance', name: 'เบิกเงินล่วงหน้า', group: 'บุคคล & ค่าแรง' },
  { id: 'employees', name: 'ฐานข้อมูลพนักงาน', group: 'บุคคล & ค่าแรง' },
  { id: 'plots', name: 'จัดการแปลงอ้อย', group: 'ปฏิบัติการไร่ & คลัง' },
  { id: 'plot-activities', name: 'กิจกรรมรายแปลง', group: 'ปฏิบัติการไร่ & คลัง' },
  { id: 'inventory', name: 'คลังสินค้า & สต็อก', group: 'ปฏิบัติการไร่ & คลัง' },
  { id: 'machinery', name: 'เครื่องจักร & ยานพาหนะ', group: 'ปฏิบัติการไร่ & คลัง' },
  { id: 'maintenance', name: 'ประวัติซ่อมบำรุงรถ', group: 'ปฏิบัติการไร่ & คลัง' },
  { id: 'admin-users', name: 'จัดการบัญชีผู้ใช้งาน', group: 'ตั้งค่าระบบ' },
  { id: 'admin-roles', name: 'จัดการสิทธิ์ (Roles)', group: 'ตั้งค่าระบบ' },
  { id: 'history', name: 'ประวัติการใช้งาน', group: 'ตั้งค่าระบบ' },
  { id: 'backup', name: 'สำรองข้อมูล', group: 'ตั้งค่าระบบ' },
];

interface AppRole {
  id: string;
  role_slug: string;
  role_name: string;
  permissions: string[];
}

export default function RoleManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [popup, setPopup] = useState({ show: false, type: '', message: '' });

  // Form States
  const [formId, setFormId] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formName, setFormName] = useState('');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('app_roles').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormId('');
    setFormSlug('');
    setFormName('');
    setFormPermissions([]);
    setShowModal(true);
  };

  const handleOpenEdit = (role: AppRole) => {
    setIsEditing(true);
    setFormId(role.id);
    setFormSlug(role.role_slug);
    setFormName(role.role_name);
    setFormPermissions(role.permissions || []);
    setShowModal(true);
  };

  const handleTogglePermission = (menuId: string) => {
    setFormPermissions(prev => 
      prev.includes(menuId) ? prev.filter(id => id !== menuId) : [...prev, menuId]
    );
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSlug || !formName) {
      setPopup({ show: true, type: 'error', message: 'กรุณากรอกรหัสสิทธิ์และชื่อสิทธิ์ให้ครบถ้วน' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        role_slug: formSlug.toLowerCase().trim(),
        role_name: formName.trim(),
        permissions: formPermissions
      };

      if (isEditing) {
        const { error } = await supabase.from('app_roles').update(payload).eq('id', formId);
        if (error) throw error;
        setPopup({ show: true, type: 'success', message: 'อัปเดตสิทธิ์สำเร็จ!' });
      } else {
        const { error } = await supabase.from('app_roles').insert([payload]);
        if (error) throw error;
        setPopup({ show: true, type: 'success', message: 'สร้างสิทธิ์ใหม่สำเร็จ!' });
      }

      setShowModal(false);
      fetchRoles();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message.includes('unique constraint') ? 'รหัสสิทธิ์ (Slug) นี้มีในระบบแล้ว กรุณาใช้ชื่ออื่น' : error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (id: string, slug: string) => {
    // 🌟 อัปเกรด: ล็อกเฉพาะ programmer และ admin ห้ามลบ ตัวอื่นลบได้ปกติ
    if (['programmer', 'admin'].includes(slug)) {
      setPopup({ show: true, type: 'error', message: 'ไม่อนุญาตให้ลบสิทธิ์พื้นฐานระดับสูงของระบบได้' });
      return;
    }
    if (!window.confirm(`แน่ใจหรือไม่ที่จะลบสิทธิ์ "${slug}" ออกจากระบบถาวร?\n(ผู้ใช้ที่มีสิทธิ์นี้อาจจะใช้งานระบบไม่ได้)`)) return;

    try {
      const { error } = await supabase.from('app_roles').delete().eq('id', id);
      if (error) throw error;
      setPopup({ show: true, type: 'success', message: 'ลบสิทธิ์ออกจากระบบแล้ว' });
      fetchRoles();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    }
  };

  const groupedMenus = MENU_LIST.reduce((acc: any, menu) => {
    if (!acc[menu.group]) acc[menu.group] = [];
    acc[menu.group].push(menu);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans text-slate-800 antialiased selection:bg-violet-500 selection:text-white">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 transition-all">
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button onClick={() => router.push('/admin/users')} className="p-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-xl transition-all shrink-0 active:scale-95" title="กลับไปหน้า User">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">จัดการสิทธิ์การเข้าถึง (Roles & Permissions)</h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 bg-violet-100 text-violet-800 text-[10px] font-bold rounded-full uppercase tracking-wider">Security</span>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 mt-1">สร้างกลุ่มสิทธิ์ และกำหนดเมนูที่แต่ละตำแหน่งสามารถมองเห็นได้</p>
            </div>
          </div>
          <button onClick={handleOpenAdd} className="px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-xl text-xs font-black shadow-lg shadow-violet-500/25 flex items-center gap-2 transition-all active:scale-95">
            <span>➕ สร้างสิทธิ์ใหม่</span>
          </button>
        </div>
      </header>

      <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 mt-6 sm:mt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin shadow-lg shadow-violet-600/20"></div>
            <p className="mt-4 text-xs font-bold text-slate-400 uppercase animate-pulse">Loading Roles...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {roles.map((role) => (
              <div key={role.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 relative group hover:shadow-md hover:border-violet-300 transition-all flex flex-col h-full">
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center shadow-inner font-black text-xl">
                      {role.role_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-lg">{role.role_name}</h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">ID: {role.role_slug}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-500 mb-2">สิทธิ์เข้าถึงเมนู ({role.permissions?.length || 0}):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissions?.slice(0, 8).map(menuId => {
                      const menuName = MENU_LIST.find(m => m.id === menuId)?.name || menuId;
                      return <span key={menuId} className="text-[10px] px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg font-semibold">{menuName}</span>;
                    })}
                    {(role.permissions?.length || 0) > 8 && (
                      <span className="text-[10px] px-2 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg font-black">+{role.permissions.length - 8} เมนู</span>
                    )}
                    {(!role.permissions || role.permissions.length === 0) && (
                      <span className="text-[10px] px-2 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg font-bold">ไม่มีสิทธิ์เข้าถึงเมนูใดเลย</span>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-2">
                  <button onClick={() => handleOpenEdit(role)} className="px-3 py-1.5 bg-slate-50 hover:bg-violet-50 text-slate-600 hover:text-violet-600 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-1">
                    <span>✏️ จัดการสิทธิ์</span>
                  </button>
                  
                  {/* 🌟 แสดงปุ่มลบให้กับ Role ทั่วไป (ยกเว้น programmer และ admin) */}
                  {!['programmer', 'admin'].includes(role.role_slug) && (
                    <button onClick={() => handleDeleteRole(role.id, role.role_slug)} className="px-3 py-1.5 bg-slate-50 hover:bg-rose-500 text-slate-400 hover:text-white font-bold text-xs rounded-xl border border-slate-200 hover:border-rose-500 transition-colors flex items-center justify-center" title="ลบสิทธิ์นี้">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ======================================================= */}
      {/* 🌟 MODAL: เพิ่ม/แก้ไขสิทธิ์ */}
      {/* ======================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowModal(false)}></div>
          <div className="bg-white w-full max-w-3xl rounded-[24px] shadow-2xl relative z-10 flex flex-col max-h-[90vh] animate-in zoom-in-95">
            
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center text-base">🛡️</span>
                <span>{isEditing ? 'แก้ไขการตั้งค่าสิทธิ์' : 'สร้างกลุ่มสิทธิ์ใหม่'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold hover:bg-slate-200">✕</button>
            </div>

            <form onSubmit={handleSaveRole} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">รหัสอ้างอิงสิทธิ์ (Role Slug) <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" required value={formSlug} onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} 
                    placeholder="เช่น security, manager" 
                    disabled={isEditing && ['programmer', 'admin'].includes(formSlug)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-violet-500 disabled:opacity-50 text-sm" 
                  />
                  <p className="text-[9px] text-slate-400 mt-1">ใช้ตัวอักษรภาษาอังกฤษ พิมพ์เล็ก และขีดกลางเท่านั้น</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">ชื่อสิทธิ์ (Display Name) <span className="text-rose-500">*</span></label>
                  <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="เช่น ผู้จัดการฟาร์ม" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-violet-500 text-sm" />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-violet-500"></span> กำหนดการมองเห็นเมนู
                  </label>
                  <div className="space-x-2 text-[10px] font-bold">
                    <button type="button" onClick={() => setFormPermissions(MENU_LIST.map(m => m.id))} className="px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors">เลือกทั้งหมด</button>
                    <button type="button" onClick={() => setFormPermissions([])} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">ล้างทั้งหมด</button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                  {Object.entries(groupedMenus).map(([groupName, menus]: any) => (
                    <div key={groupName} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 pb-2">{groupName}</h4>
                      <div className="space-y-2">
                        {menus.map((menu: any) => (
                          <label key={menu.id} className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${formPermissions.includes(menu.id) ? 'bg-violet-500 border-violet-500 text-white' : 'bg-white border-slate-300 text-transparent group-hover:border-violet-400'}`}>
                              <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <input type="checkbox" className="hidden" checked={formPermissions.includes(menu.id)} onChange={() => handleTogglePermission(menu.id)} />
                            <span className={`text-sm font-bold transition-colors ${formPermissions.includes(menu.id) ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-700'}`}>{menu.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-[24px] flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 text-sm transition-colors">ยกเลิก</button>
              <button onClick={handleSaveRole} disabled={saving} className={`px-8 py-3 rounded-xl font-black text-white text-sm shadow-lg transition-all ${saving ? 'bg-slate-300' : 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/25 active:scale-95'}`}>
                {saving ? 'กำลังบันทึก...' : '💾 บันทึกสิทธิ์'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* POPUP ALERT */}
      {popup.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs animate-in fade-in" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl relative z-10 text-center animate-in zoom-in-95 border border-slate-100">
            {popup.type === 'success' ? (
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div>
            ) : (
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></div>
            )}
            <h3 className="text-lg font-black text-slate-900 mb-1.5">{popup.type === 'success' ? 'สำเร็จ!' : 'ข้อผิดพลาด'}</h3>
            <p className="text-xs text-slate-500 mb-6 font-medium whitespace-pre-line">{popup.message}</p>
            <button type="button" onClick={() => setPopup({ show: false, type: '', message: '' })} className="w-full py-3 font-bold rounded-xl text-white shadow-md text-sm transition-all active:scale-95 bg-slate-900 hover:bg-slate-800">ตกลง</button>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}