'use client';

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error.message);
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="flex min-h-screen font-sans bg-[#FCFBF7]">
      {/* ส่วนด้านซ้าย: ไร่อ้อยและโลโก้ */}
      <div
        className="hidden lg:flex w-1/2 items-center justify-center relative bg-gray-900"
        style={{
          backgroundImage: "url('/sugarcane-bg.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* ปรับฟิลเตอร์ใหม่: สว่างขึ้น ได้ฟีลแสงเย็น ลดความเขียวด้านล่าง */}
        <div className="absolute inset-0 bg-gradient-to-b from-orange-400/30 via-amber-500/20 to-emerald-700/20"></div>
        
        {/* เงาไล่ระดับจากขอบล่าง (บางๆ) เพื่อดันให้โลโก้และข้อความอ่านง่าย โดยไม่ทำให้ภาพมืด */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/30 to-transparent"></div>

        <div className="text-center relative z-10 flex flex-col items-center">
          {/* โลโก้ทรงกลม - ปรับสมส่วน ไม่ขาด ไม่แหว่ง */}
          <div className="mb-6 w-36 h-36 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl bg-white flex items-center justify-center p-1.5">
            <img
              src="/logo.png" 
              alt="โลโก้ไร่อ้อยจรุงพัฒนานนท์"
              className="w-full h-full object-contain"
            />
          </div>
          {/* ข้อความชื่อบริษัทและคำอธิบาย */}
          <h1 className="text-4xl font-black text-white mb-4 tracking-tight drop-shadow-md">ไร่อ้อยจรุงพัฒนานนท์</h1>
          <p className="text-lg text-emerald-50 font-light leading-relaxed drop-shadow-sm">
            ระบบ ERP บริหารจัดการค่าจ้าง<br/>และทรัพยากรบุคคลแบบครบวงจร
          </p>
        </div>
      </div>

      {/* ส่วนด้านขวา: ฟอร์มล็อกอิน */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-[#FCFBF7] p-8 sm:p-12 lg:p-24">
        <div className="w-full max-w-md">
          {/* หัวข้อฟอร์ม */}
          <div className="mb-8 text-center lg:text-left">
            <div className="inline-flex items-center text-amber-700 text-xs font-bold tracking-wider mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2"></span>
              ฤดูหีบอ้อย 2569
            </div>
            <h2 className="text-3xl font-bold text-stone-800 mb-2">ยินดีต้อนรับกลับมา 👋</h2>
            <p className="text-stone-500">กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ</p>
          </div>

          {/* แสดงข้อความแจ้งเตือนเมื่อล็อกอินไม่สำเร็จ */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-sm text-red-700 font-medium shadow-sm">
              {errorMsg}
            </div>
          )}

          {/* ฟอร์มล็อกอิน */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2" htmlFor="email">
                อีเมลผู้ใช้งาน (Email)
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-stone-400 group-focus-within:text-amber-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@jarungphat.com"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-white border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2" htmlFor="password">
                รหัสผ่าน (Password)
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-stone-400 group-focus-within:text-amber-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-white border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm pt-1">
              <label className="flex items-center text-stone-600 cursor-pointer hover:text-stone-800 transition-colors">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span className="ml-2">จดจำการเข้าสู่ระบบ</span>
              </label>
              <a href="#" className="text-amber-700 font-medium hover:text-amber-800 transition-colors">
                ลืมรหัสผ่าน?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-lg text-lg font-bold text-white transition-all transform active:scale-[0.98] mt-4 bg-gradient-to-b from-[#C49A45] to-[#997328] hover:from-[#d1a854] hover:to-[#a67c2d] shadow-[#997328]/30 ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          {/* ข้อความติดต่อและลิขสิทธิ์ */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-[#FCFBF7] text-stone-400 text-xs">หรือ</span>
              </div>
            </div>
            
            <p className="text-center text-stone-500 text-sm mt-6">
              ติดต่อฝ่ายบุคคลหากยังไม่มีบัญชีผู้ใช้งาน
            </p>
            
            <div className="mt-8 text-center flex items-center justify-center text-xs text-stone-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-300 mr-2"></span>
              © 2026 ไร่อ้อยจรุงพัฒนานนท์ - Internal ERP System
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;