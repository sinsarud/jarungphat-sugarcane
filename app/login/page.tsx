'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

const LoginPage = () => {
  const [username, setUsername] = useState(''); 
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [masterPin, setMasterPin] = useState('');
  
  const [resetLoading, setResetLoading] = useState(false);
  const [popup, setPopup] = useState({ show: false, type: '', message: '' });

  const router = useRouter();

  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('กรุณากรอกชื่อผู้ใช้งานและรหัสผ่านให้ครบถ้วน');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const inputUser = username.trim().toLowerCase();
    let loginEmail = inputUser;

    try {
      if (!inputUser.includes('@')) {
        const { data: mappingData } = await supabase
          .from('user_mappings')
          .select('email')
          .eq('username', inputUser)
          .maybeSingle(); 

        if (mappingData && mappingData.email) {
          loginEmail = mappingData.email; 
        } else {
          loginEmail = `${inputUser}@gmail.com`; 
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('ชื่อผู้ใช้งาน หรือ รหัสผ่านไม่ถูกต้อง');
        }
        throw error;
      }

      if (rememberMe) {
        localStorage.setItem('rememberedUsername', inputUser);
      } else {
        localStorage.removeItem('rememberedUsername');
      }

      router.push('/');
    } catch (error: any) {
      setErrorMsg(error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ');
      setLoading(false);
    }
  };

  const handleResetPasswordWithMasterPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim() || !forgotNewPassword.trim() || !masterPin.trim()) {
      setPopup({ show: true, type: 'error', message: 'กรุณากรอกข้อมูลให้ครบทุกช่องครับ' });
      return;
    }
    if (forgotNewPassword.length < 6) {
      setPopup({ show: true, type: 'error', message: 'รหัสผ่านใหม่ต้องมี 6 ตัวขึ้นไปครับ' });
      return;
    }

    setResetLoading(true);

    try {
      const res = await fetch('/api/manage-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'master_reset',
          username: forgotUsername,
          new_password: forgotNewPassword,
          master_pin: masterPin
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ไม่สามารถแก้ไขรหัสผ่านได้');

      setShowForgotModal(false);
      setPopup({ 
        show: true, 
        type: 'success', 
        message: `เปลี่ยนรหัสผ่านใหม่ของพนักงาน @${forgotUsername} สำเร็จแล้ว!\nสามารถใช้รหัสผ่านใหม่ล็อกอินเข้าทำงานได้ทันที` 
      });
      
      setForgotUsername('');
      setForgotNewPassword('');
      setMasterPin('');
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen font-sans bg-[#FCFBF7] relative">
      
      {/* ส่วนรูปภาพและโลโก้ */}
      <div
        className="w-full lg:w-1/2 relative bg-gray-900 flex flex-col items-center justify-center min-h-[35vh] lg:min-h-screen pt-8 pb-12 lg:py-0"
        style={{
          backgroundImage: "url('/sugarcane-bg.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-orange-400/30 via-amber-500/20 to-emerald-700/40"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent"></div>

        <div className="text-center relative z-10 flex flex-col items-center px-4">
          <div className="mb-4 lg:mb-6 w-24 h-24 lg:w-40 lg:h-40 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl bg-white flex items-center justify-center p-1.5">
            <img src="/logo.png" alt="โลโก้ไร่อ้อยจรุงพัฒนานนท์" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl lg:text-4xl font-black text-white mb-2 lg:mb-4 tracking-tight drop-shadow-md">ไร่อ้อยจรุงพัฒนานนท์</h1>
          <p className="hidden sm:block text-sm lg:text-lg text-emerald-50 font-light leading-relaxed drop-shadow-sm">ระบบ ERP บริหารจัดการค่าจ้าง<br className="hidden lg:block"/>และทรัพยากรบุคคลแบบครบวงจร</p>
        </div>
      </div>

      {/* ส่วนฟอร์มล็อกอิน */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-[#FCFBF7] p-6 sm:p-12 lg:p-24 -mt-8 lg:mt-0 relative z-20 rounded-t-[2rem] lg:rounded-none shadow-[0_-15px_30px_-15px_rgba(0,0,0,0.15)] lg:shadow-none flex-grow">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left mt-4 lg:mt-0">
            <div className="inline-flex items-center text-amber-700 text-xs font-bold tracking-wider mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2"></span>
              ฤดูหีบอ้อย 2569
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold text-stone-800 mb-2">ยินดีต้อนรับกลับมา 👋</h2>
            <p className="text-stone-500 text-sm lg:text-base">กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ</p>
          </div>

          {errorMsg && <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-sm text-red-700 font-medium shadow-sm">{errorMsg}</div>}

          <form onSubmit={handleLogin} className="space-y-4 lg:space-y-5">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2" htmlFor="username">ชื่อผู้ใช้งาน (Username)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-stone-400 group-focus-within:text-amber-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                </div>
                <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="เช่น Username หรือ E-mail" required className="w-full pl-11 pr-4 py-3.5 bg-white border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-sm font-bold" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2" htmlFor="password">รหัสผ่าน (Password)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-stone-400 group-focus-within:text-amber-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="w-full pl-11 pr-4 py-3.5 bg-white border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-sm" />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm pt-1">
              <label className="flex items-center text-stone-600 cursor-pointer hover:text-stone-800 transition-colors">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span className="ml-2 font-semibold">จดจำผู้ใช้งาน</span>
              </label>
              
              <button type="button" onClick={() => setShowForgotModal(true)} className="text-amber-700 font-bold hover:text-amber-800 transition-colors">
                ลืมรหัสผ่าน?
              </button>
            </div>

            <button type="submit" disabled={loading} className={`w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-lg text-lg font-bold text-white transition-all transform active:scale-[0.98] mt-4 bg-gradient-to-b from-[#C49A45] to-[#997328] hover:from-[#d1a854] hover:to-[#a67c2d] shadow-[#997328]/30 ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}>
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <div className="mt-8 lg:mt-10">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-200"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-3 bg-[#FCFBF7] text-stone-400 text-xs">หรือ</span></div>
            </div>
            <p className="text-center text-stone-500 text-xs sm:text-sm mt-6">ติดต่อฝ่ายบุคคลหากยังไม่มีบัญชีผู้ใช้งาน</p>
            <div className="mt-6 text-center flex items-center justify-center text-[10px] sm:text-xs text-stone-400 font-medium pb-4 lg:pb-0">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-300 mr-2"></span> © 2026 ไร่อ้อยจรุงพัฒนานนท์ - Internal ERP
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================= */}
      {/* 🌟 CUSTOM MODAL: เปลี่ยนรหัสผ่านด่วน 🌟 */}
      {/* ======================================================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowForgotModal(false)}></div>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative z-10 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-stone-800">🔒 กู้คืนรหัสผ่านด่วน</h3>
              <button onClick={() => setShowForgotModal(false)} className="text-stone-400 hover:text-stone-600 bg-stone-100 w-8 h-8 rounded-full flex items-center justify-center font-bold">✕</button>
            </div>
            
            <p className="text-xs text-stone-500 mb-5 leading-relaxed">กรุณากรอกข้อมูลด้านล่างให้ครบถ้วน สงวนสิทธิ์อนุมัติโดยผู้ดูแลระบบเท่านั้น</p>
            
            <form onSubmit={handleResetPasswordWithMasterPin} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-stone-500 block mb-1">ชื่อผู้ใช้งานที่ลืมรหัส</label>
                <input type="text" required value={forgotUsername} onChange={(e) => setForgotUsername(e.target.value)} placeholder="เช่น Username" className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-amber-500 text-sm" />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-500 block mb-1">ระบุรหัสผ่านใหม่ (6 ตัวขึ้นไป)</label>
                <input type="text" required value={forgotNewPassword} onChange={(e) => setForgotNewPassword(e.target.value)} placeholder="กรอกรหัสผ่านใหม่..." className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-amber-500 text-sm" />
              </div>

              <div className="pt-2 border-t border-stone-100">
                {/* 🌟 เปลี่ยนช่องรหัสพินให้ดูเป็นส่วนของระบบความปลอดภัย 🌟 */}
                <label className="text-[11px] font-bold text-red-600 block mb-1">🔑 รหัสพินอนุมัติของเถ้าแก่ / ผู้จัดการ (Admin Only)</label>
                <input 
                  type="password" 
                  required 
                  value={masterPin} 
                  onChange={(e) => setMasterPin(e.target.value)} 
                  placeholder="••••••••" 
                  className="w-full px-4 py-2.5 bg-red-50/50 border border-red-200 rounded-xl font-black text-red-800 tracking-widest text-center outline-none focus:ring-2 focus:ring-red-600 text-base" 
                />
              </div>

              <button type="submit" disabled={resetLoading} className={`w-full py-3.5 rounded-xl font-black text-white shadow-md transition-all mt-4 ${resetLoading ? 'bg-stone-300' : 'bg-stone-800 hover:bg-stone-900 active:scale-95'}`}>
                {resetLoading ? '⏳ กำลังยืนยันสิทธิ์...' : 'อัปเดตรหัสผ่านใหม่'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM POPUP สรุปความสำเร็จ */}
      {popup.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95">
            {popup.type === 'success' ? (
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div>
            ) : (
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></div>
            )}
            <h3 className="text-lg font-black text-stone-800 mb-2">{popup.type === 'success' ? 'กู้รหัสผ่านสำเร็จ!' : 'ถูกปฏิเสธสิทธิ์'}</h3>
            <p className="text-sm text-stone-500 mb-6 whitespace-pre-line leading-relaxed">{popup.message}</p>
            <button onClick={() => setPopup({ show: false, type: '', message: '' })} className={`w-full py-3 font-bold rounded-xl text-white shadow-md ${popup.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}>ตกลง</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default LoginPage;