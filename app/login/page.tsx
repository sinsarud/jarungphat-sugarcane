'use client';

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
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
      setErrorMsg(`เกิดข้อผิดพลาด: ${error.message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error.message}`);
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans">
      
      {/* ฝั่งซ้าย: กราฟิกและแบรนดิ้ง (ซ่อนในหน้าจอมือถือ, โชว์เฉพาะจอใหญ่) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 overflow-hidden items-center justify-center">
        {/* ลวดลายตกแต่งพื้นหลัง (วงกลมแบบเบลอ) */}
        <div className="absolute top-10 -left-20 w-96 h-96 bg-green-500 rounded-full mix-blend-overlay filter blur-[100px] opacity-60"></div>
        <div className="absolute bottom-10 -right-20 w-96 h-96 bg-yellow-500 rounded-full mix-blend-overlay filter blur-[100px] opacity-40"></div>
        
        {/* คอนเทนต์ฝั่งซ้าย */}
        <div className="relative z-10 text-center px-12">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-md mb-8 border border-white/20 shadow-2xl">
            <svg className="w-12 h-12 text-green-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h1 className="text-5xl font-black text-white mb-6 tracking-tight">ไร่อ้อยจรุงพัฒนานนท์</h1>
          <p className="text-xl text-green-100 font-light leading-relaxed">
            ระบบ ERP บริหารจัดการค่าจ้าง<br/>และทรัพยากรบุคคลแบบครบวงจร
          </p>
        </div>
      </div>

      {/* ฝั่งขวา: ฟอร์มเข้าสู่ระบบ */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 bg-gray-50">
        <div className="w-full max-w-md">
          
          {/* หัวข้อฟอร์ม */}
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">ยินดีต้อนรับกลับมา 👋</h2>
            <p className="text-gray-500">กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ</p>
          </div>

          {/* แจ้งเตือน Error */}
          {errorMsg && (
            <div className="mb-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start shadow-sm">
              <svg className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <p className="text-sm text-red-700 font-medium">{errorMsg}</p>
            </div>
          )}

          {/* ฟอร์ม Login */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">อีเมลผู้ใช้งาน (Email)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 group-focus-within:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all shadow-sm"
                  placeholder="admin@jarungphat.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">รหัสผ่าน (Password)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 group-focus-within:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all shadow-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-lg text-lg font-bold text-white transition-all transform active:scale-[0.98] ${
                loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-700 hover:bg-green-800 hover:shadow-green-700/30'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                'เข้าสู่ระบบ'
              )}
            </button>
          </form>
          
          <div className="mt-12 text-center lg:text-left">
            <p className="text-xs text-gray-400 font-medium">© 2026 ไร่อ้อยจรุงพัฒนานนท์ - Internal ERP System</p>
          </div>
          
        </div>
      </div>
    </div>
  );
}