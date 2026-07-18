'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateAdvancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    employee_name: '',
    role: 'คนตัดอ้อย',
    amount: '',
    date_disbursed: new Date().toISOString().split('T')[0], // ตั้งค่าเป็นวันปัจจุบันให้อัตโนมัติ
    reason: '',
  });

  // ฟังก์ชันบันทึกข้อมูลลงบัญชีโดยตรง (ไม่มีการรออนุมัติ)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // จำลองการโหลดบันทึกเข้าฐานข้อมูล 0.8 วินาที
    setTimeout(() => {
      setLoading(false);
      // เมื่อเสร็จแล้วให้เด้งกลับไปที่หน้าสมุดบันทึกหลักทันที
      router.push('/advance');
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-16 font-sans selection:bg-amber-500 selection:text-white">
      
      {/* 🌟 Premium Header Bar */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* ⬅️ ปุ่มย้อนกลับดีไซน์ใหม่ */}
            <button onClick={() => router.push('/advance')} className="group w-10 h-10 bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600 rounded-xl flex items-center justify-center text-slate-500 transition-all shrink-0 shadow-sm">
              <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            
            <div className="h-8 w-px bg-slate-200 hidden sm:block mx-1"></div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-xl flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">บันทึกการจ่ายเงินล่วงหน้า</h1>
                <p className="text-[11px] font-bold text-slate-500 leading-none hidden sm:block uppercase tracking-wider">
                  เพิ่มรายการลงสมุดบัญชีเงินเบิกพนักงาน
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 mt-8">
        {/* 🌟 ฟอร์มลงบัญชี (High Contrast UI) */}
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-xl shadow-slate-200/40 p-6 sm:p-10">
          <h2 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-3">
            <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
            รายละเอียดการจ่ายเงินสด
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* วันที่จ่ายเงิน */}
            <div>
              <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">วันที่จ่ายเงิน</label>
              <input 
                type="date" 
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-sm sm:text-base cursor-pointer shadow-sm"
                value={formData.date_disbursed}
                onChange={(e) => setFormData({...formData, date_disbursed: e.target.value})}
              />
            </div>

            {/* ชื่อพนักงาน */}
            <div>
              <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">ชื่อ-นามสกุล พนักงาน</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-sm sm:text-base shadow-sm"
                placeholder="พิมพ์ชื่อพนักงาน เช่น สมหมาย ใจดี"
                value={formData.employee_name}
                onChange={(e) => setFormData({...formData, employee_name: e.target.value})}
              />
            </div>

            {/* ตำแหน่ง */}
            <div>
              <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">ตำแหน่ง / หน้าที่</label>
              <select 
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-sm sm:text-base cursor-pointer shadow-sm"
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
              >
                <option value="คนตัดอ้อย">คนตัดอ้อย</option>
                <option value="คนขับรถบรรทุก">คนขับรถบรรทุก</option>
                <option value="คนขับรถคีบ">คนขับรถคีบ</option>
                <option value="คนงานทั่วไป">คนงานทั่วไป</option>
                <option value="อื่นๆ">อื่นๆ</option>
              </select>
            </div>

            {/* จำนวนเงิน */}
            <div>
              <label className="block text-[11px] font-black text-amber-600 mb-2 uppercase tracking-wider ml-1">จำนวนเงินที่จ่าย (บาท)</label>
              <div className="relative">
                <input 
                  type="number" 
                  required 
                  min="1"
                  className="w-full pl-4 pr-12 py-4 bg-white border-2 border-slate-300 rounded-xl font-black text-2xl text-rose-600 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all text-right tabular-nums shadow-inner"
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-base">฿</span>
              </div>
            </div>

            {/* หมายเหตุ */}
            <div>
              <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">หมายเหตุ / เหตุผลการเบิก</label>
              <textarea 
                rows={3} 
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-sm sm:text-base resize-none shadow-sm"
                placeholder="ระบุข้อความสั้นๆ เช่น ค่ากับข้าววิกนี้, ค่าซ่อมรถ, หรือค่าเทอมลูก..."
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
              ></textarea>
            </div>

            {/* ปุ่มกด */}
            <div className="pt-6 mt-6 border-t border-slate-100 flex gap-4">
              <button 
                type="button" 
                onClick={() => router.push('/advance')}
                className="w-1/3 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors text-sm"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className={`w-2/3 py-4 rounded-xl font-black text-white text-[15px] shadow-lg transition-all border flex items-center justify-center gap-2 ${
                  loading 
                    ? 'bg-slate-400 border-slate-400 cursor-not-allowed shadow-none' 
                    : 'bg-amber-500 border-amber-600 hover:bg-amber-400 active:scale-[0.98] shadow-amber-500/30'
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    กำลังบันทึกข้อมูล...
                  </>
                ) : (
                  '💾 บันทึกและลงบัญชีทันที'
                )}
              </button>
            </div>
          </form>

        </div>
      </div>

      <style jsx global>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.6;
          transition: 0.2s;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}