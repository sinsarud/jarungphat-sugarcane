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
          username: formUsername, 
          password: formPassword, 
          email: formEmail 
        }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      setPopup({ show: true, type: 'success', message: 'สร้างบัญชีผู้ใช้งานใหม่เรียบร้อยแล้ว' });
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
    if (!window.confirm(`ต้องการ ${actionText} บัญชี @${user.username} ใช่หรือไม่?`)) return;

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
      
      setPopup({ show: true, type: 'success', message: `ดำเนินการ${actionText}บัญชีเรียบร้อยแล้ว` });
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
      setPopup({ show: true, type: 'success', message: 'อัปเดตข้อมูลบัญชีสำเร็จ' });
      fetchUsers();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading && users.length === 0) return <div className="min-h-screen bg-[#FCFBF7] flex items-center justify-center"><div className="w-10 h-10 border-4 border-[#5244e1] border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#FCFBF7] pb-16 font-sans relative">
      
      {/* 🌟 Header Bar */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button onClick={() => router.push('/')} className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors shrink-0">
              <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-stone-800 leading-tight">จัดการบัญชีผู้ใช้งานระบบ</h1>
              <p className="text-[10px] sm:text-xs text-stone-500 mt-0.5 uppercase tracking-wide">System Users & Authentication</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 mt-6 sm:mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* ========================================= */}
          {/* ฝั่งซ้าย: ฟอร์มสร้างบัญชีใหม่ */}
          {/* ========================================= */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-8 lg:sticky lg:top-28">
              
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-5">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              </div>

              <h2 className="text-xl font-black text-stone-800 mb-1">สร้างบัญชีผู้ใช้ใหม่</h2>
              <p className="text-xs text-stone-500 mb-6">กำหนดรหัสให้พนักงานเข้าใช้งานระบบ ERP</p>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5 block">ชื่อล็อกอิน (USERNAME) *</label>
                  <input 
                    type="text" 
                    required
                    value={formUsername} 
                    onChange={(e) => setFormUsername(e.target.value)} 
                    placeholder="เช่น sommai, nidnoi" 
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-[#5244e1] text-sm transition-all" 
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5 block">รหัสผ่าน (ขั้นต่ำ 6 ตัว) *</label>
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    value={formPassword} 
                    onChange={(e) => setFormPassword(e.target.value)} 
                    placeholder="ตั้งรหัสผ่านให้พนักงาน..." 
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-[#5244e1] text-sm transition-all" 
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5 block">อีเมลจริง (ถ้าไม่มีให้เว้นว่างไว้)</label>
                  <input 
                    type="email" 
                    value={formEmail} 
                    onChange={(e) => setFormEmail(e.target.value)} 
                    placeholder="เว้นว่างไว้ ระบบจะสร้างอีเมลจำลองให้" 
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-[#5244e1] text-sm transition-all placeholder:text-stone-400" 
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={saving} 
                  className={`w-full mt-4 py-3.5 rounded-xl font-black text-white text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${saving ? 'bg-stone-300' : 'bg-[#5244e1] hover:bg-[#4336c9] active:scale-95 shadow-[#5244e1]/30'}`}
                >
                  {saving ? 'กำลังสร้าง...' : '＋ สร้างบัญชีใหม่'}
                </button>
              </form>
            </div>
          </div>

          {/* ========================================= */}
          {/* ฝั่งขวา: รายชื่อผู้ใช้งานในระบบ */}
          {/* ========================================= */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-[2rem] border border-stone-200 shadow-sm p-4 sm:p-6 lg:p-8">
              
              <h2 className="text-lg font-black text-stone-800 mb-6 px-2">รายชื่อผู้ใช้งานในระบบ ({users.length})</h2>

              {/* 📱 MOBILE VIEW: แบบการ์ด */}
              <div className="block md:hidden space-y-4">
                {users.map((user) => (
                  <div key={user.username} className={`p-4 rounded-2xl border ${user.is_banned ? 'bg-stone-50 border-stone-200 opacity-70' : 'bg-white border-stone-200'} shadow-sm`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-black text-[#372cd1] text-base leading-tight">@{user.username}</h3>
                        <p className="text-[10px] font-bold text-stone-400 mt-1 truncate max-w-[200px]">{user.email}</p>
                      </div>
                      <div>
                        {user.is_banned ? (
                          <span className="px-2.5 py-1 bg-stone-200 text-stone-600 rounded-full text-[10px] font-black">ระงับใช้งาน</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ใช้งานปกติ
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-stone-100 mt-2">
                      <button onClick={() => { setEditUser(user); setEditEmail(user.email); setEditPassword(''); setShowEditModal(true); }} className="flex-1 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs hover:bg-blue-100 transition-colors">
                        ✎ แก้ไข
                      </button>
                      <button onClick={() => handleToggleBan(user)} className={`flex-1 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-colors ${user.is_banned ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>
                        {user.is_banned ? '✅ ปลดระงับ' : '🚫 ระงับ'}
                      </button>
                      <button onClick={() => setShowDeleteModal({ show: true, auth_id: user.auth_id || '', username: user.username })} className="flex-1 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs hover:bg-rose-100 transition-colors">
                        🗑️ ลบ
                      </button>
                    </div>
                  </div>
                ))}
                {users.length === 0 && <div className="text-center py-8 text-stone-400 font-bold text-sm">ยังไม่มีผู้ใช้งานในระบบ</div>}
              </div>

              {/* 💻 DESKTOP VIEW: แบบตาราง */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                      <th className="py-3 px-4">ชื่อล็อกอิน</th>
                      <th className="py-3 px-4">อีเมล</th>
                      <th className="py-3 px-4 text-center">สถานะ</th>
                      <th className="py-3 px-4 text-center">จัดการหลังบ้าน</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-medium text-stone-700 divide-y divide-stone-100">
                    {users.map((user) => (
                      <tr key={user.username} className={`hover:bg-stone-50 transition-colors ${user.is_banned ? 'opacity-60 bg-stone-50/50' : ''}`}>
                        <td className="py-4 px-4 font-black text-[#372cd1]">@{user.username}</td>
                        <td className="py-4 px-4 text-stone-500 text-xs font-bold">{user.email}</td>
                        <td className="py-4 px-4 text-center">
                          {user.is_banned ? (
                            <span className="px-3 py-1 bg-stone-200 text-stone-600 rounded-full text-[10px] font-black inline-block">ระงับใช้งาน</span>
                          ) : (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ใช้งานปกติ
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => { setEditUser(user); setEditEmail(user.email); setEditPassword(''); setShowEditModal(true); }} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors" title="แก้ไขข้อมูล">
                              ✎
                            </button>
                            <button onClick={() => handleToggleBan(user)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${user.is_banned ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`} title={user.is_banned ? "ปลดระงับ" : "ระงับใช้งาน"}>
                              {user.is_banned ? '✅' : '🚫'}
                            </button>
                            <button onClick={() => setShowDeleteModal({ show: true, auth_id: user.auth_id || '', username: user.username })} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 transition-colors" title="ลบบัญชี">
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && <div className="text-center py-12 text-stone-400 font-bold">ยังไม่มีผู้ใช้งานในระบบ</div>}
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* ======================================================= */}
      {/* 🌟 MODAL 1: ป๊อปอัปแก้ไขข้อมูลบัญชี (Edit User) 🌟 */}
      {/* ======================================================= */}
      {showEditModal && editUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowEditModal(false)}></div>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 sm:p-8 relative z-10 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-stone-800">✎ แก้ไขบัญชี</h3>
              <button onClick={() => setShowEditModal(false)} className="text-stone-400 hover:bg-stone-100 w-8 h-8 rounded-full flex items-center justify-center font-bold">✕</button>
            </div>

            <div className="mb-5 bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">ชื่อล็อกอิน (แก้ไขไม่ได้)</p>
              <h4 className="text-lg font-black text-blue-700">@{editUser.username}</h4>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5 block">เปลี่ยนอีเมลใหม่</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-[#5244e1] text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5 block">เปลี่ยนรหัสผ่านใหม่ (ทิ้งว่างถ้าไม่เปลี่ยน)</label>
                <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-[#5244e1] text-sm" />
              </div>
            </div>

            <button onClick={handleUpdateUser} disabled={saving} className={`w-full mt-8 py-3.5 rounded-xl font-black text-white text-sm shadow-md transition-all ${saving ? 'bg-stone-300' : 'bg-[#5244e1] hover:bg-[#4336c9] active:scale-95'}`}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 MODAL 2: ป๊อปอัปยืนยันการลบบัญชี 🌟 */}
      {/* ======================================================= */}
      {showDeleteModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowDeleteModal({ show: false, auth_id: '', username: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 sm:p-8 relative z-10 shadow-2xl animate-in fade-in zoom-in-95 text-center">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-xl font-black text-stone-800 mb-2">ยืนยันการลบบัญชี</h3>
            <p className="text-sm text-stone-500 mb-6 leading-relaxed">ต้องการลบบัญชี <strong>@{showDeleteModal.username}</strong> ใช่หรือไม่?<br/>(ลบแล้วจะไม่สามารถล็อกอินได้อีก)</p>
            
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal({ show: false, auth_id: '', username: '' })} className="flex-1 py-3 bg-stone-100 text-stone-600 font-bold rounded-xl hover:bg-stone-200 transition-colors text-sm">ยกเลิก</button>
              <button onClick={executeDelete} disabled={saving} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 shadow-md transition-colors text-sm">ลบถาวร</button>
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
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95 border border-stone-100">
            {popup.type === 'success' ? (
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
            )}
            <h3 className="text-lg font-black text-stone-800 mb-2">{popup.type === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}</h3>
            <p className="text-sm text-stone-500 mb-6 leading-relaxed whitespace-pre-line">{popup.message}</p>
            <button onClick={() => setPopup({ show: false, type: '', message: '' })} className={`w-full py-3 font-bold rounded-xl text-white shadow-md text-sm ${popup.type === 'success' ? 'bg-[#5244e1] hover:bg-[#4336c9]' : 'bg-red-500 hover:bg-red-600'}`}>
              ตกลง
            </button>
          </div>
        </div>
      )}

    </div>
  );
}