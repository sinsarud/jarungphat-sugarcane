'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UserData {
  username: string;
  email: string;
  auth_id: string | null;
  is_banned: boolean;
}

export default function UserManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);

  // 📝 Form States
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formEmail, setFormEmail] = useState('');

  // 🪟 Modals & Popups
  const [popup, setPopup] = useState({ show: false, type: '', message: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState({ show: false, auth_id: '', username: '' });
  
  // States สำหรับ Edit
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // 🔄 โหลดข้อมูลพนักงาน
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch' }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      } else {
        console.error('Error fetching users:', data.error);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 🟢 สร้างบัญชีใหม่
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername || !formPassword || formPassword.length < 6) {
      setPopup({ show: true, type: 'error', message: 'กรุณากรอกชื่อผู้ใช้ และรหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'create', 
          username: formUsername.trim(), 
          password: formPassword, 
          email: formEmail.trim() 
        }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      setPopup({ show: true, type: 'success', message: `สร้างบัญชี @${formUsername} เข้าสู่ระบบเรียบร้อยแล้ว!` });
      setFormUsername('');
      setFormPassword('');
      setFormEmail('');
      fetchUsers();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  // 🟡 ระงับ / เปิดใช้งานบัญชี
  const handleToggleBan = async (user: UserData) => {
    const actionText = user.is_banned ? 'ปลดระงับ' : 'ระงับ';
    if (!window.confirm(`ต้องการ${actionText}บัญชี @${user.username} ใช่หรือไม่?`)) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'toggle_status', 
          auth_id: user.auth_id, 
          is_banned: !user.is_banned 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setPopup({ show: true, type: 'success', message: `ดำเนินการ${actionText}บัญชี @${user.username} เรียบร้อยแล้ว` });
      fetchUsers();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
      setLoading(false);
    }
  };

  // 🔴 ลบบัญชีถาวร
  const executeDelete = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'delete', 
          auth_id: showDeleteModal.auth_id, 
          username: showDeleteModal.username 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowDeleteModal({ show: false, auth_id: '', username: '' });
      setPopup({ show: true, type: 'success', message: 'ลบบัญชีผู้ใช้ออกจากระบบถาวรแล้ว' });
      fetchUsers();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  // 🔵 อัปเดตข้อมูลบัญชี
  const handleUpdateUser = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'update', 
          auth_id: editUser?.auth_id, 
          username: editUser?.username,
          password: editPassword || undefined,
          email: editEmail || undefined
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowEditModal(false);
      setPopup({ show: true, type: 'success', message: `อัปเดตข้อมูลบัญชี @${editUser?.username} สำเร็จ!` });
      fetchUsers();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  // คำนวณสถิติบัญชีผู้ใช้
  const activeCount = users.filter(u => !u.is_banned).length;
  const bannedCount = users.filter(u => u.is_banned).length;

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin shadow-lg shadow-indigo-600/20"></div>
        <p className="mt-4 text-xs font-bold text-slate-400 tracking-wider uppercase animate-pulse">Loading User Directory...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans text-slate-800 antialiased selection:bg-indigo-500 selection:text-white relative">
      
      {/* 🌟 Premium Glassmorphism Header 🌟 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 transition-all">
        <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button 
              onClick={() => router.push('/')} 
              className="p-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-xl transition-all shrink-0 active:scale-95"
              title="กลับหน้าหลัก"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">จัดการบัญชีผู้ใช้งานระบบ</h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-full uppercase tracking-wider">Admin Control</span>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 mt-1">กำหนดสิทธิ์ ลงทะเบียน และดูแลบัญชีผู้ใช้งานในระบบ ERP</p>
            </div>
          </div>

          {/* Mini Status Indicator บน Header */}
          <div className="flex items-center gap-2 text-xs font-bold bg-slate-100/80 px-3.5 py-1.5 rounded-xl border border-slate-200/60 w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-600">สถานะระบบ:</span>
            <span className="text-slate-900 font-black">พร้อมใช้งาน (Active)</span>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1500px] mx-auto px-4 sm:px-8 mt-6 sm:mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* ========================================= */}
          {/* 🌟 ฝั่งซ้าย: ฟอร์มสร้างบัญชีใหม่ (Pro Control Panel) */}
          {/* ========================================= */}
          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.04)] p-6 sm:p-8 relative overflow-hidden group">
              
              {/* Decorative Background Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50 via-purple-50 to-transparent rounded-bl-full -mr-8 -mt-8 pointer-events-none transition-transform group-hover:scale-110"></div>

              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-2xl flex items-center justify-center mb-5 shadow-md shadow-indigo-500/20 shrink-0 relative z-10">
                <svg className="w-6 h-6 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight relative z-10">สร้างบัญชีผู้ใช้ใหม่</h2>
              <p className="text-xs text-slate-500 mt-1 mb-6 relative z-10">กำหนดรหัสล็อกอินและสิทธิ์ให้พนักงานเข้าใช้ระบบ</p>

              <form onSubmit={handleCreateUser} className="space-y-4 relative z-10">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center justify-between">
                    <span>1. ชื่อล็อกอิน (USERNAME) <span className="text-red-500">*</span></span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none font-bold text-slate-400 text-sm">@</span>
                    <input 
                      type="text" 
                      required
                      value={formUsername} 
                      onChange={(e) => setFormUsername(e.target.value)} 
                      placeholder="เช่น sommai, nidnoi" 
                      className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all" 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center justify-between">
                    <span>2. รหัสผ่านชั่วคราว <span className="text-red-500">*</span></span>
                    <span className="text-[10px] text-slate-400 font-normal">ขั้นต่ำ 6 ตัวอักษร</span>
                  </label>
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    value={formPassword} 
                    onChange={(e) => setFormPassword(e.target.value)} 
                    placeholder="ตั้งรหัสผ่านให้พนักงาน..." 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all" 
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center justify-between">
                    <span>3. อีเมล (ถ้าไม่มีให้เว้นว่างไว้)</span>
                  </label>
                  <input 
                    type="email" 
                    value={formEmail} 
                    onChange={(e) => setFormEmail(e.target.value)} 
                    placeholder="เว้นว่างไว้ ระบบจะสร้างอีเมลจำลองให้" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all placeholder:text-slate-400" 
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={saving} 
                    className={`w-full py-3.5 rounded-xl font-black text-white text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                      saving 
                        ? 'bg-slate-300 shadow-none cursor-not-allowed' 
                        : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 shadow-indigo-500/25'
                    }`}
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>กำลังลงทะเบียนบัญชี...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        <span>สร้างบัญชีผู้ใช้ใหม่</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

            </div>
          </div>

          {/* ========================================= */}
          {/* 🌟 ฝั่งขวา: รายชื่อผู้ใช้งาน (Sleek User Directory) */}
          {/* ========================================= */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* สรุปตัวเลขสถิติ (Directory Mini Stats) */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">บัญชีทั้งหมด</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{users.length} <span className="text-xs font-bold text-slate-500">บัญชี</span></p>
                </div>
                <span className="text-2xl p-2 bg-slate-50 rounded-xl border border-slate-100 hidden sm:block">👥</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">ใช้งานปกติ</p>
                  <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">{activeCount} <span className="text-xs font-bold text-slate-500">บัญชี</span></p>
                </div>
                <span className="text-2xl p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 hidden sm:block">✅</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">ถูกระงับสิทธิ์</p>
                  <p className="text-xl sm:text-2xl font-black text-rose-600 mt-0.5">{bannedCount} <span className="text-xs font-bold text-slate-500">บัญชี</span></p>
                </div>
                <span className="text-2xl p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 hidden sm:block">🚫</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">ทำเนียบบัญชีผู้ใช้งาน</h2>
                  <p className="text-xs text-slate-500 mt-0.5">คลิกที่ปุ่มเพื่อแก้ไขรหัสผ่าน หรือระงับสิทธิ์การใช้งานชั่วคราว</p>
                </div>
              </div>

              {/* 📱 MOBILE VIEW: แบบการ์ดพรีเมี่ยม */}
              <div className="block md:hidden p-4 space-y-3.5">
                {users.map((user) => {
                  const initial = user.username ? user.username.charAt(0).toUpperCase() : '?';
                  return (
                    <div 
                      key={`mob-${user.username}`} 
                      className={`p-4 rounded-2xl border transition-all ${
                        user.is_banned 
                          ? 'bg-slate-50/80 border-slate-200/80 opacity-75' 
                          : 'bg-white border-slate-200/80 shadow-sm hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3 gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0 shadow-sm ${
                            user.is_banned 
                              ? 'bg-slate-200 text-slate-600' 
                              : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/20'
                          }`}>
                            {initial}
                          </div>
                          <div>
                            <h3 className="font-black text-slate-900 text-base leading-tight">@{user.username}</h3>
                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5 truncate max-w-[180px]">{user.email}</p>
                          </div>
                        </div>

                        <div>
                          {user.is_banned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-black">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> ระงับสิทธิ์
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[10px] font-black">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ใช้งานปกติ
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button 
                          onClick={() => { setEditUser(user); setEditEmail(user.email); setEditPassword(''); setShowEditModal(true); }} 
                          className="py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          <span>แก้ไข</span>
                        </button>
                        <button 
                          onClick={() => handleToggleBan(user)} 
                          className={`py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95 ${
                            user.is_banned 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          <span>{user.is_banned ? '✅ ปลดระงับ' : '⚠️ ระงับ'}</span>
                        </button>
                        <button 
                          onClick={() => setShowDeleteModal({ show: true, auth_id: user.auth_id || '', username: user.username })} 
                          className="py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          <span>ลบ</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
                {users.length === 0 && (
                  <div className="text-center py-12 text-slate-400 font-bold text-sm">ยังไม่มีผู้ใช้งานในระบบ</div>
                )}
              </div>

              {/* 💻 DESKTOP VIEW: แบบตาราง Enterprise */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-6">ผู้ใช้งาน (Username)</th>
                      <th className="py-4 px-6">อีเมล / ไอดีติดต่อ</th>
                      <th className="py-4 px-6 text-center">สถานะสิทธิ์</th>
                      <th className="py-4 px-6 text-right">จัดการหลังบ้าน</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                    {users.map((user) => {
                      const initial = user.username ? user.username.charAt(0).toUpperCase() : '?';
                      return (
                        <tr key={user.username} className={`hover:bg-slate-50/60 transition-colors group ${user.is_banned ? 'opacity-70 bg-slate-50/30' : ''}`}>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm transition-transform group-hover:scale-105 ${
                                user.is_banned 
                                  ? 'bg-slate-200 text-slate-600' 
                                  : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/15'
                              }`}>
                                {initial}
                              </div>
                              <span className="font-black text-slate-900 text-base">@{user.username}</span>
                            </div>
                          </td>

                          <td className="py-4 px-6 text-slate-500 text-xs font-semibold">{user.email || '-'}</td>
                          
                          <td className="py-4 px-6 text-center">
                            {user.is_banned ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-full text-xs font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> ระงับสิทธิ์
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ใช้งานปกติ
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-6">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => { setEditUser(user); setEditEmail(user.email); setEditPassword(''); setShowEditModal(true); }} 
                                className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200/80 hover:border-indigo-200 transition-all text-xs font-bold inline-flex items-center gap-1.5 active:scale-95" 
                                title="แก้ไขรหัสผ่าน/อีเมล"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                <span>แก้ไข</span>
                              </button>

                              <button 
                                onClick={() => handleToggleBan(user)} 
                                className={`px-3 py-1.5 rounded-xl border transition-all text-xs font-bold inline-flex items-center gap-1 active:scale-95 ${
                                  user.is_banned 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                }`} 
                                title={user.is_banned ? "ปลดระงับใช้งาน" : "ระงับใช้งานชั่วคราว"}
                              >
                                <span>{user.is_banned ? '✅ ปลดระงับ' : '⚠️ ระงับ'}</span>
                              </button>

                              <button 
                                onClick={() => setShowDeleteModal({ show: true, auth_id: user.auth_id || '', username: user.username })} 
                                className="p-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200/80 hover:border-rose-200 transition-all flex items-center justify-center active:scale-95" 
                                title="ลบบัญชีออกจากระบบ"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div className="text-center py-16 text-slate-400 font-bold text-base">
                    <span className="text-3xl block mb-2">👤</span>
                    ยังไม่มีรายชื่อผู้ใช้งานในระบบ
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* ======================================================= */}
      {/* 🌟 MODAL 1: ป๊อปอัปแก้ไขข้อมูลบัญชี (Secure Edit Modal) 🌟 */}
      {/* ======================================================= */}
      {showEditModal && editUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowEditModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 relative z-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base">⚙️</span>
                <span>แก้ไขบัญชีผู้ใช้งาน</span>
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all">✕</button>
            </div>

            {/* Simulated ID Badge สำหรับชื่อล็อกอินที่แก้ไขไม่ได้ */}
            <div className="mb-6 bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-2xl border border-slate-700 text-white shadow-md flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-0.5">USERNAME (รหัสประจำตัว)</p>
                <h4 className="text-lg font-black tracking-wide">@{editUser.username}</h4>
              </div>
              <span className="text-xs bg-white/10 px-2.5 py-1 rounded-lg font-bold text-slate-300 border border-white/10">🔒 ไม่สามารถเปลี่ยนชื่อได้</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">เปลี่ยนอีเมลใหม่</label>
                <input 
                  type="email" 
                  value={editEmail} 
                  onChange={(e) => setEditEmail(e.target.value)} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">เปลี่ยนรหัสผ่านใหม่ <span className="text-stone-400 font-normal text-[11px]">(เว้นว่างหากใช้รหัสเดิม)</span></label>
                <input 
                  type="password" 
                  value={editPassword} 
                  onChange={(e) => setEditPassword(e.target.value)} 
                  placeholder="••••••••" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all" 
                />
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <button 
                type="button"
                onClick={() => setShowEditModal(false)} 
                className="w-1/3 py-3.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 bg-slate-50 border border-slate-200/80 text-sm transition-all"
              >
                ยกเลิก
              </button>
              <button 
                type="button"
                onClick={handleUpdateUser} 
                disabled={saving} 
                className={`w-2/3 py-3.5 rounded-xl font-black text-white text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                  saving 
                    ? 'bg-slate-300 shadow-none cursor-not-allowed' 
                    : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 shadow-indigo-500/25'
                }`}
              >
                {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 MODAL 2: ป๊อปอัปยืนยันการลบบัญชี (High-Alert Delete) 🌟 */}
      {/* ======================================================= */}
      {showDeleteModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowDeleteModal({ show: false, auth_id: '', username: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 sm:p-8 relative z-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-center border border-slate-100">
            <div className="w-16 h-16 bg-gradient-to-br from-rose-500 to-red-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-rose-500/25 animate-bounce">
              <svg className="w-8 h-8 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            
            <h3 className="text-xl font-black text-slate-900 mb-2">ยืนยันการลบบัญชี?</h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
              คุณกำลังจะลบบัญชี <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">@{showDeleteModal.username}</span><br />
              <span className="text-rose-600 font-bold mt-1 block">⚠️ ลบแล้วจะไม่สามารถกู้คืนหรือล็อกอินได้อีก</span>
            </p>
            
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setShowDeleteModal({ show: false, auth_id: '', username: '' })} 
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all text-sm"
              >
                ยกเลิก
              </button>
              <button 
                type="button"
                onClick={executeDelete} 
                disabled={saving} 
                className="flex-1 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black rounded-xl shadow-lg shadow-rose-500/25 transition-all text-sm active:scale-95"
              >
                {saving ? '⏳ กำลังลบ...' : 'ลบถาวร'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 POPUP แจ้งเตือนสถานะความสำเร็จ / ขัดข้อง (Pro Glass Alert) 🌟 */}
      {/* ======================================================= */}
      {popup.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 sm:p-7 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            {popup.type === 'success' ? (
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                <svg className="w-8 h-8 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                <svg className="w-8 h-8 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
            )}
            
            <h3 className="text-lg font-black text-slate-900 mb-1.5">{popup.type === 'success' ? 'ดำเนินการสำเร็จ!' : 'แจ้งเตือนระบบ'}</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed whitespace-pre-line font-medium">{popup.message}</p>
            
            <button 
              type="button"
              onClick={() => setPopup({ show: false, type: '', message: '' })} 
              className={`w-full py-3 font-bold rounded-xl text-white shadow-md text-sm transition-all active:scale-95 ${
                popup.type === 'success' 
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 shadow-indigo-500/20' 
                  : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 shadow-red-500/20'
              }`}
            >
              ตกลงเข้าใจแล้ว
            </button>
          </div>
        </div>
      )}

    </div>
  );
}