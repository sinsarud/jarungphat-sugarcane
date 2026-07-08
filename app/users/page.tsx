'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function UsersManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  // State สำหรับฟอร์มสร้างใหม่
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formEmail, setFormEmail] = useState('');

  // States สำหรับ Modals
  const [popup, setPopup] = useState({ show: false, type: '', message: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState({ show: false, auth_id: '', username: '' });
  
  // State สำหรับแก้ไขข้อมูล
  const [editUser, setEditUser] = useState<any>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/manage-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch' }),
      });
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push('/login');
      else fetchUsers();
    }
    checkAuth();
  }, [router]);

  // --- ฟังก์ชัน 1: สร้างไอดีใหม่ ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim() || !formPassword.trim()) return setPopup({ show: true, type: 'error', message: 'กรุณาระบุชื่อผู้ใช้งานและรหัสผ่าน' });
    if (formPassword.length < 6) return setPopup({ show: true, type: 'error', message: 'รหัสผ่านต้อง 6 ตัวขึ้นไป' });

    setSaving(true);
    try {
      const res = await fetch('/api/manage-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', username: formUsername, password: formPassword, email: formEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setPopup({ show: true, type: 'success', message: `สร้างบัญชี "${formUsername}" สำเร็จแล้ว!` });
      setFormUsername(''); setFormPassword(''); setFormEmail('');
      fetchUsers();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  // --- ฟังก์ชัน 2: ระงับ/ปลดระงับ ไอดี (Disable/Enable) ---
  const handleToggleStatus = async (auth_id: string, is_banned: boolean, username: string) => {
    if (!window.confirm(is_banned ? `ต้องการ ปลดระงับ ให้ ${username} เข้าสู่ระบบได้ใช่ไหม?` : `ต้องการ ระงับ ไม่ให้ ${username} เข้าสู่ระบบใช่ไหม?`)) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/manage-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_status', auth_id, is_banned }),
      });
      if (!res.ok) throw new Error('เกิดข้อผิดพลาด');
      setPopup({ show: true, type: 'success', message: `เปลี่ยนสถานะการใช้งานของ ${username} เรียบร้อยแล้ว` });
      fetchUsers();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
      setLoading(false);
    }
  };

  // --- ฟังก์ชัน 3: เปิดหน้าต่างแก้ไข (เปลี่ยนรหัส / อีเมล) ---
  const openEdit = (user: any) => {
    setEditUser(user);
    setEditEmail(user.email);
    setEditPassword(''); // ว่างไว้ = ไม่เปลี่ยนรหัส
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/manage-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', auth_id: editUser.auth_id, username: editUser.username, email: editEmail, password: editPassword || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowEditModal(false);
      setPopup({ show: true, type: 'success', message: 'อัปเดตข้อมูลสำเร็จ' });
      fetchUsers();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  // --- ฟังก์ชัน 4: ลบไอดีถาวร ---
  const confirmDelete = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/manage-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', auth_id: showDeleteModal.auth_id, username: showDeleteModal.username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowDeleteModal({ show: false, auth_id: '', username: '' });
      setPopup({ show: true, type: 'success', message: 'ลบไอดีออกจากระบบถาวรแล้ว' });
      fetchUsers();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#FCFBF7] flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#FCFBF7] pb-12 font-sans relative">
      
      {/* Header Bar */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-4 flex items-center">
          <button onClick={() => router.push('/')} className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors mr-4">
            <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-stone-800">จัดการบัญชีผู้ใช้งานระบบ</h1>
            <p className="text-xs text-stone-500">System Users & Authentication</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ฟอร์มสร้างผู้ใช้งานใหม่ */}
        <div className="lg:col-span-4">
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-stone-200 shadow-sm sticky top-28">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            </div>
            <h2 className="text-2xl font-black text-stone-800 mb-2">สร้างบัญชีผู้ใช้ใหม่</h2>
            <p className="text-sm text-stone-500 mb-8">กำหนดรหัสให้พนักงานเข้าใช้งานระบบ ERP</p>

            <form onSubmit={handleCreateUser} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block">ชื่อล็อกอิน (Username)</label>
                <input type="text" required value={formUsername} onChange={(e) => setFormUsername(e.target.value.replace(/\s+/g, '').toLowerCase())} placeholder="เช่น sommai, nidnoi" className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block">รหัสผ่าน (ขั้นต่ำ 6 ตัว)</label>
                <input type="text" required value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="ตั้งรหัสผ่านให้พนักงาน..." className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div className="pt-4 border-t border-stone-100">
                <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block">อีเมลจริง (ถ้าไม่มีให้เว้นว่างไว้)</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="เว้นว่างไว้ ระบบจะสร้างอีเมลจำลองให้" className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-600 outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>

              <button type="submit" disabled={saving} className={`w-full mt-6 py-4 rounded-xl font-black text-white text-lg shadow-lg transition-all ${saving ? 'bg-stone-300' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-indigo-600/20'}`}>
                {saving ? 'กำลังสร้างบัญชี...' : '➕ สร้างบัญชีใหม่'}
              </button>
            </form>
          </div>
        </div>

        {/* ตารางรายชื่อผู้ใช้งานและระบบจัดการ */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-[2rem] border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-stone-100 bg-stone-50/50">
              <h3 className="text-lg font-black text-stone-800">รายชื่อผู้ใช้งานในระบบ ({users.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-stone-100 text-xs font-bold text-stone-400 uppercase tracking-wider">
                    <th className="py-4 px-6">ชื่อล็อกอิน</th>
                    <th className="py-4 px-6">อีเมล</th>
                    <th className="py-4 px-6 text-center">สถานะ</th>
                    <th className="py-4 px-6 text-center">จัดการหลังบ้าน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm font-medium">
                  {users.map((user) => (
                    <tr key={user.username} className={`hover:bg-stone-50 transition-colors ${user.is_banned ? 'bg-red-50/30' : ''}`}>
                      <td className={`py-4 px-6 font-black text-base ${user.is_banned ? 'text-stone-400 line-through' : 'text-indigo-700'}`}>@{user.username}</td>
                      <td className={`py-4 px-6 ${user.is_banned ? 'text-stone-400' : 'text-stone-500'}`}>{user.email}</td>
                      
                      <td className="py-4 px-6 text-center">
                        {user.is_banned 
                          ? <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-bold">🔴 ระงับการใช้งาน</span>
                          : <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">🟢 ใช้งานปกติ</span>
                        }
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          {/* ปุ่มแก้ไข */}
                          <button onClick={() => openEdit(user)} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors" title="แก้ไขรหัสผ่าน/อีเมล">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          
                          {/* ปุ่มแบน / ปลดแบน */}
                          <button onClick={() => handleToggleStatus(user.auth_id, user.is_banned, user.username)} className={`p-2 rounded-lg transition-colors ${user.is_banned ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-orange-500 bg-orange-50 hover:bg-orange-100'}`} title={user.is_banned ? "ปลดระงับการใช้งาน" : "ระงับการใช้งาน (Disable)"}>
                            {user.is_banned ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            )}
                          </button>

                          {/* ปุ่มลบ */}
                          <button onClick={() => setShowDeleteModal({ show: true, auth_id: user.auth_id, username: user.username })} className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors" title="ลบบัญชีถาวร">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================= */}
      {/* 🌟 MODAL: แก้ไขข้อมูลผู้ใช้ (เปลี่ยนรหัสผ่าน) 🌟 */}
      {/* ========================================= */}
      {showEditModal && editUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-3xl p-6 relative z-10 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-black text-stone-800 mb-6">⚙️ ตั้งค่าบัญชี: @{editUser.username}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block">เปลี่ยนอีเมลใหม่</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block text-rose-500">ตั้งรหัสผ่านใหม่ (Reset Password)</label>
                <input type="text" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัส..." className="w-full px-4 py-3 bg-rose-50/50 border border-rose-200 rounded-xl font-bold text-rose-700 outline-none focus:ring-2 focus:ring-rose-500" />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-stone-100 text-stone-600 font-bold rounded-xl hover:bg-stone-200 transition-colors">ยกเลิก</button>
              <button onClick={handleEditSave} disabled={saving} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md">{saving ? 'บันทึก...' : 'บันทึกการตั้งค่า'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* 🌟 MODAL: ยืนยันการลบถาวร 🌟 */}
      {/* ========================================= */}
      {showDeleteModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setShowDeleteModal({ show: false, auth_id: '', username: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative z-10 shadow-2xl text-center animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-xl font-black text-stone-800 mb-2">ยืนยันการลบผู้ใช้</h3>
            <p className="text-sm text-stone-500 mb-6">ต้องการลบบัญชี <strong>@{showDeleteModal.username}</strong> ถาวรใช่หรือไม่?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal({ show: false, auth_id: '', username: '' })} className="flex-1 py-3 bg-stone-100 text-stone-600 font-bold rounded-xl hover:bg-stone-200">ยกเลิก</button>
              <button onClick={confirmDelete} disabled={saving} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-md">ลบถาวร</button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP แจ้งเตือน */}
      {popup.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-xs" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95">
            {popup.type === 'success' ? (
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div>
            ) : (
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></div>
            )}
            <h3 className="text-lg font-black text-stone-800 mb-2">{popup.type === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}</h3>
            <p className="text-sm text-stone-500 mb-6">{popup.message}</p>
            <button onClick={() => setPopup({ show: false, type: '', message: '' })} className={`w-full py-3 font-bold rounded-xl text-white shadow-md ${popup.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>ตกลง</button>
          </div>
        </div>
      )}

    </div>
  );
}