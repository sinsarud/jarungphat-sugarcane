'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

interface UserData {
  username: string;
  email: string;
  auth_id: string | null;
  is_banned: boolean;
  role?: string;
  first_name?: string;
  last_name?: string;
}

interface AppRole {
  role_slug: string;
  role_name: string;
}

export default function UserManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);
  const [availableRoles, setAvailableRoles] = useState<AppRole[]>([]);
  
  const [currentUserRole, setCurrentUserRole] = useState('clerk');

  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('clerk'); 
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');

  const [popup, setPopup] = useState({ show: false, type: '', message: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState({ show: false, auth_id: '', username: '' });
  
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('clerk');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase.from('app_roles').select('role_slug, role_name');
      if (!error && data) {
        setAvailableRoles(data);
      } else {
        setAvailableRoles([
          { role_slug: 'clerk', role_name: 'เสมียน (Clerk)' },
          { role_slug: 'foreman', role_name: 'หัวหน้างาน (Foreman)' },
          { role_slug: 'admin', role_name: 'ผู้บริหาร (Admin)' },
          { role_slug: 'programmer', role_name: 'ผู้พัฒนาระบบ (Programmer)' }
        ]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (profile) setCurrentUserRole(profile.role);
      }

      await fetchRoles();

      const apiUrl = `${window.location.origin}/api/admin/users`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch' }),
      });
      const data = await res.json();
      
      if (res.ok) {
        let baseUsers = data.users || [];
        const { data: profilesData } = await supabase.from('profiles').select('id, role, first_name, last_name');
        
        if (profilesData && profilesData.length > 0) {
           baseUsers = baseUsers.map((u: any) => {
             const profile = profilesData.find(p => p.id === u.auth_id);
             return { 
                 ...u, 
                 role: profile?.role || 'clerk',
                 first_name: profile?.first_name || '',
                 last_name: profile?.last_name || ''
             };
           });
        }
        setUsers(baseUsers);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername || !formPassword || formPassword.length < 6 || !formFirstName) {
      setPopup({ show: true, type: 'error', message: 'กรุณากรอกชื่อจริง, Username และรหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
      return;
    }
    setSaving(true);
    try {
      const apiUrl = `${window.location.origin}/api/admin/users`;
      const res = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', username: formUsername.trim(), password: formPassword, email: formEmail.trim(), role: formRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.user && data.user.auth_id) {
          await supabase.from('profiles').insert([{ 
              id: data.user.auth_id, 
              role: formRole,
              first_name: formFirstName.trim(),
              last_name: formLastName.trim()
          }]);
      }

      setPopup({ show: true, type: 'success', message: `สร้างบัญชี @${formUsername} เรียบร้อยแล้ว!` });
      setFormUsername(''); setFormPassword(''); setFormEmail(''); setFormRole('clerk'); setFormFirstName(''); setFormLastName('');
      fetchUsers();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally { setSaving(false); }
  };

  const handleToggleBan = async (user: UserData) => {
    const actionText = user.is_banned ? 'ปลดระงับ' : 'ระงับ';
    if (!window.confirm(`ต้องการ${actionText}บัญชี @${user.username} ใช่หรือไม่?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_status', auth_id: user.auth_id, is_banned: !user.is_banned }),
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

  const executeDelete = async () => {
    setSaving(true);
    try {
      if (showDeleteModal.auth_id) await supabase.from('profiles').delete().eq('id', showDeleteModal.auth_id);
      const res = await fetch(`${window.location.origin}/api/admin/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', auth_id: showDeleteModal.auth_id, username: showDeleteModal.username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowDeleteModal({ show: false, auth_id: '', username: '' });
      setPopup({ show: true, type: 'success', message: 'ลบบัญชีผู้ใช้ออกจากระบบถาวรแล้ว' });
      fetchUsers();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally { setSaving(false); }
  };

  const handleUpdateUser = async () => {
    setSaving(true);
    try {
      if (editUser?.auth_id) {
         const { error: roleError } = await supabase.from('profiles').upsert([{ 
             id: editUser.auth_id, 
             role: editRole,
             first_name: editFirstName.trim(),
             last_name: editLastName.trim()
         }]);
         if (roleError) throw new Error('อัปเดตข้อมูลไม่สำเร็จ: ' + roleError.message);
      }
      const isPasswordChanged = editPassword.trim().length > 0;
      const isEmailChanged = editEmail.trim() !== (editUser?.email || '');

      if (isPasswordChanged || isEmailChanged) {
        const res = await fetch(`${window.location.origin}/api/admin/users`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', auth_id: editUser?.auth_id, username: editUser?.username, password: editPassword || undefined, email: editEmail || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Action not found');
      }

      setShowEditModal(false);
      setPopup({ show: true, type: 'success', message: `อัปเดตข้อมูลของ @${editUser?.username} สำเร็จ!` });
      fetchUsers();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally { setSaving(false); }
  };

  const getRoleDisplayName = (roleSlug?: string) => {
    const role = availableRoles.find(r => r.role_slug === roleSlug);
    return role ? role.role_name : (roleSlug || 'ไม่ระบุสิทธิ์');
  };
  
  const getRoleBadgeColor = (role?: string) => {
    switch(role) {
      case 'programmer': return 'bg-slate-800 text-slate-100 border-slate-700'; 
      case 'admin': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'foreman': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'clerk': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-purple-100 text-purple-700 border-purple-200';
    }
  };

  const activeCount = users.filter(u => !u.is_banned).length;
  const bannedCount = users.filter(u => u.is_banned).length;

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin shadow-lg shadow-violet-600/20"></div>
        <p className="mt-4 text-xs font-bold text-slate-400 tracking-wider uppercase animate-pulse">Loading User Directory...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans text-slate-800 antialiased selection:bg-violet-500 selection:text-white relative">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 transition-all">
        <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button onClick={() => router.push('/')} className="p-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-xl transition-all shrink-0 active:scale-95" title="กลับหน้าหลัก">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">จัดการบัญชีผู้ใช้งานและสิทธิ์</h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full uppercase tracking-wider">User Control</span>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 mt-1">กำหนดสิทธิ์และข้อมูลบัญชีผู้ใช้งานในระบบ ERP</p>
            </div>
          </div>
          <div className="flex gap-2">
             {currentUserRole === 'programmer' && (
               <button onClick={() => router.push('/admin/roles')} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md shadow-slate-900/20 flex items-center gap-2 transition-all">
                 <span>🛡️ จัดการกลุ่มสิทธิ์ (Roles)</span>
               </button>
             )}
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1500px] mx-auto px-4 sm:px-8 mt-6 sm:mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* ========================================= */}
          {/* 🌟 ฝั่งซ้าย: ฟอร์มสร้างบัญชีใหม่ */}
          {/* ========================================= */}
          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.04)] p-6 sm:p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-transparent rounded-bl-full -mr-8 -mt-8 pointer-events-none transition-transform group-hover:scale-110"></div>
              <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white rounded-2xl flex items-center justify-center mb-5 shadow-md shadow-violet-500/20 shrink-0 relative z-10">
                <svg className="w-6 h-6 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight relative z-10">สร้างบัญชีผู้ใช้ใหม่</h2>
              <p className="text-xs text-slate-500 mt-1 mb-6 relative z-10">กรอกข้อมูลพนักงานเพื่อเข้าใช้งานระบบ</p>

              <form onSubmit={handleCreateUser} className="space-y-4 relative z-10">
                
                {/* 🌟 เพิ่มช่องกรอกชื่อ-นามสกุล */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">ชื่อจริง <span className="text-rose-500">*</span></label>
                    <input type="text" required value={formFirstName} onChange={(e) => setFormFirstName(e.target.value)} placeholder="เช่น สมหมาย" className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">นามสกุล</label>
                    <input type="text" value={formLastName} onChange={(e) => setFormLastName(e.target.value)} placeholder="(เว้นว่างได้)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm transition-all" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">ชื่อล็อกอิน (USERNAME) <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none font-bold text-slate-400 text-sm">@</span>
                    <input type="text" required value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="เช่น sommai" className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm transition-all" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">รหัสผ่านชั่วคราว <span className="text-rose-500">*</span></label>
                  <input type="password" required minLength={6} value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="ขั้นต่ำ 6 ตัวอักษร" className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm transition-all" />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span> สิทธิ์การใช้งาน (Role)
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                    {availableRoles.map(role => (
                      <label key={role.role_slug} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${formRole === role.role_slug ? 'bg-violet-50 border-violet-300 text-violet-800' : 'bg-white border-slate-200 hover:bg-slate-100'}`}>
                        <input type="radio" name="role" value={role.role_slug} checked={formRole === role.role_slug} onChange={() => setFormRole(role.role_slug)} className="w-4 h-4 text-violet-600 focus:ring-violet-500" />
                        <span className="text-xs font-bold">{role.role_name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">อีเมล (เว้นว่างได้)</label>
                  <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="เว้นว่างไว้ ระบบจะสร้างอีเมลจำลองให้" className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm transition-all placeholder:text-slate-400" />
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={saving} className={`w-full py-3.5 rounded-xl font-black text-white text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${saving ? 'bg-slate-300 shadow-none cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 active:scale-95 shadow-violet-500/25'}`}>
                    {saving ? 'กำลังลงทะเบียน...' : 'สร้างบัญชีผู้ใช้ใหม่'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* ========================================= */}
          {/* 🌟 ฝั่งขวา: รายชื่อผู้ใช้งาน */}
          {/* ========================================= */}
          <div className="lg:col-span-8 space-y-4">
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

            <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">ทำเนียบบัญชีผู้ใช้งาน</h2>
                  <p className="text-xs text-slate-500 mt-0.5">รายชื่อพนักงานและระดับสิทธิ์ในระบบ</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-6">ชื่อ-นามสกุล / ล็อกอิน</th>
                      <th className="py-4 px-6">ตำแหน่ง (Role)</th>
                      <th className="py-4 px-6 text-center">สถานะใช้งาน</th>
                      <th className="py-4 px-6 text-right">จัดการหลังบ้าน</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                    {users.map((user) => {
                      const initial = user.first_name ? user.first_name.charAt(0).toUpperCase() : (user.username ? user.username.charAt(0).toUpperCase() : '?');
                      return (
                        <tr key={user.username} className={`hover:bg-slate-50/60 transition-colors group ${user.is_banned ? 'opacity-70 bg-slate-50/30' : ''}`}>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm transition-transform group-hover:scale-105 ${user.is_banned ? 'bg-slate-200 text-slate-600' : 'bg-violet-600 text-white shadow-violet-500/15'}`}>
                                {initial}
                              </div>
                              <div>
                                {/* 🌟 แสดงชื่อเต็ม ถ้าไม่มีให้แสดง Username */}
                                <span className="font-black text-slate-900 text-base block">
                                  {user.first_name ? `${user.first_name} ${user.last_name || ''}` : `@${user.username}`}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {user.first_name ? `@${user.username} | ` : ''}{user.email || 'ไม่มีอีเมล'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border ${getRoleBadgeColor(user.role)}`}>
                              {getRoleDisplayName(user.role)}
                            </span>
                          </td>
                          
                          <td className="py-4 px-6 text-center">
                            {user.is_banned ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-full text-xs font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> ระงับสิทธิ์
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ใช้งานปกติ
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-6">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { 
                                  setEditUser(user); 
                                  setEditRole(user.role || 'clerk'); 
                                  setEditEmail(user.email); 
                                  setEditPassword(''); 
                                  setEditFirstName(user.first_name || '');
                                  setEditLastName(user.last_name || '');
                                  setShowEditModal(true); 
                                }} className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-violet-50 text-slate-600 hover:text-violet-600 border border-slate-200/80 hover:border-violet-200 transition-all text-xs font-bold inline-flex items-center gap-1.5 active:scale-95" title="แก้ไข">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                <span>แก้ไข</span>
                              </button>
                              <button onClick={() => handleToggleBan(user)} className={`px-3 py-1.5 rounded-xl border transition-all text-xs font-bold inline-flex items-center gap-1 active:scale-95 ${user.is_banned ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`} title={user.is_banned ? "ปลดระงับใช้งาน" : "ระงับใช้งานชั่วคราว"}>
                                <span>{user.is_banned ? '✅ ปลดระงับ' : '⚠️ ระงับ'}</span>
                              </button>
                              <button onClick={() => setShowDeleteModal({ show: true, auth_id: user.auth_id || '', username: user.username })} className="p-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200/80 hover:border-rose-200 transition-all flex items-center justify-center active:scale-95" title="ลบบัญชีออกจากระบบ">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {users.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-16 text-slate-400 font-bold text-sm">ยังไม่มีผู้ใช้งานในระบบ</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ======================================================= */}
      {/* 🌟 MODAL: แก้ไขข้อมูลบัญชี & สิทธิ์ */}
      {/* ======================================================= */}
      {showEditModal && editUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowEditModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-[24px] p-6 sm:p-8 relative z-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center text-base">⚙️</span>
                <span>แก้ไขบัญชีและข้อมูลพนักงาน</span>
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all">✕</button>
            </div>

            <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">USERNAME</p>
                <h4 className="text-lg font-black text-slate-900 tracking-wide">@{editUser.username}</h4>
              </div>
              <span className="text-[10px] bg-slate-200 px-2 py-1 rounded-md font-bold text-slate-500">🔒 แก้ไข Username ไม่ได้</span>
            </div>

            <div className="space-y-4">
              
              {/* 🌟 ฟอร์มแก้ไขชื่อ-นามสกุล */}
              <div className="grid grid-cols-2 gap-3 pb-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">ชื่อจริง</label>
                  <input type="text" required value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} placeholder="ชื่อจริง" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm transition-all" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">นามสกุล</label>
                  <input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} placeholder="นามสกุล" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm transition-all" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2 block">ปรับระดับสิทธิ์ (Role)</label>
                <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                  {availableRoles.map(role => (
                    <label key={role.role_slug} className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors ${editRole === role.role_slug ? 'bg-violet-50 border-violet-300 text-violet-800 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="edit_role" value={role.role_slug} checked={editRole === role.role_slug} onChange={() => setEditRole(role.role_slug)} className="w-4 h-4 text-violet-600 focus:ring-violet-500" />
                      <span className="text-xs font-bold">{role.role_name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">เปลี่ยนอีเมลใหม่</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">เปลี่ยนรหัสผ่านใหม่ <span className="text-stone-400 font-normal text-[11px]">(เว้นว่างหากใช้รหัสเดิม)</span></label>
                <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm transition-all" />
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <button type="button" onClick={() => setShowEditModal(false)} className="w-1/3 py-3.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 bg-slate-50 border border-slate-200/80 text-sm transition-all">ยกเลิก</button>
              <button type="button" onClick={handleUpdateUser} disabled={saving} className={`w-2/3 py-3.5 rounded-xl font-black text-white text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${saving ? 'bg-slate-300 shadow-none cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 active:scale-95 shadow-violet-500/25'}`}>
                {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowDeleteModal({ show: false, auth_id: '', username: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 sm:p-8 relative z-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-center border border-slate-100">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">ยืนยันการลบบัญชี?</h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">คุณกำลังจะลบบัญชี <span className="font-black text-slate-900">@{showDeleteModal.username}</span><br /><span className="text-rose-600 font-bold mt-1 block">⚠️ ลบแล้วจะไม่สามารถกู้คืนได้อีก</span></p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDeleteModal({ show: false, auth_id: '', username: '' })} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all text-sm">ยกเลิก</button>
              <button type="button" onClick={executeDelete} disabled={saving} className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl transition-all text-sm active:scale-95">{saving ? '⏳ กำลังลบ...' : 'ลบถาวร'}</button>
            </div>
          </div>
        </div>
      )}

      {popup.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95 border border-slate-100">
            {popup.type === 'success' ? (
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div>
            ) : (
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></div>
            )}
            <h3 className="text-lg font-black text-slate-900 mb-1.5">{popup.type === 'success' ? 'ดำเนินการสำเร็จ!' : 'แจ้งเตือนระบบ'}</h3>
            <p className="text-xs text-slate-500 mb-6 font-medium whitespace-pre-line">{popup.message}</p>
            <button type="button" onClick={() => setPopup({ show: false, type: '', message: '' })} className="w-full py-3 font-bold rounded-xl text-white shadow-md text-sm transition-all active:scale-95 bg-slate-900 hover:bg-slate-800">ตกลง</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>
    </div>
  );
}