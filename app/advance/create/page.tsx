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
    <div className="min-h-screen bg-[#FCFBF7] pb-12 font-sans">
      
      {/* Header Bar */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* ปุ่มย้อนกลับ */}
            <button onClick={() => router.push('/advance')} className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors">
              <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-stone-800">บันทึกการจ่ายเงินล่วงหน้า</h1>
              <p className="text-xs text-stone-500">เพิ่มรายการลงสมุดบัญชีเงินเบิกพนักงาน</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 sm:px-8 mt-8">
        {/* ฟอร์มลงบัญชี */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-8">
          <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center">
            <span className="w-1.5 h-6 bg-amber-500 rounded-full mr-3"></span>
            รายละเอียดการจ่ายเงินสด
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* วันที่จ่ายเงิน (เผื่อเจ้าของมาจดย้อนหลังของเมื่อวานได้) */}
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2">วันที่จ่ายเงิน</label>
              <input 
                type="date" 
                required
                className="w-full px-4 py-3.5 bg-[#FCFBF7] border border-stone-200 rounded-2xl text-stone-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-colors text-sm sm:text-base"
                value={formData.date_disbursed}
                onChange={(e) => setFormData({...formData, date_disbursed: e.target.value})}
              />
            </div>

            {/* ชื่อพนักงาน */}
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2">ชื่อ-นามสกุล พนักงาน</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-3.5 bg-[#FCFBF7] border border-stone-200 rounded-2xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-colors text-sm sm:text-base"
                placeholder="พิมพ์ชื่อพนักงาน เช่น สมหมาย ใจดี"
                value={formData.employee_name}
                onChange={(e) => setFormData({...formData, employee_name: e.target.value})}
              />
            </div>

            {/* ตำแหน่ง */}
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2">ตำแหน่ง / หน้าที่</label>
              <select 
                required
                className="w-full px-4 py-3.5 bg-[#FCFBF7] border border-stone-200 rounded-2xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-colors text-sm sm:text-base"
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
              <label className="block text-sm font-bold text-stone-700 mb-2">จำนวนเงินที่จ่าย (บาท)</label>
              <input 
                type="number" 
                required 
                min="1"
                className="w-full px-4 py-3.5 bg-[#FCFBF7] border border-stone-200 rounded-2xl text-stone-800 font-black placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-colors text-sm sm:text-base"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
              />
            </div>

            {/* หมายเหตุ */}
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2">หมายเหตุ / เหตุผลการเบิก</label>
              <textarea 
                rows={3} 
                required
                className="w-full px-4 py-3.5 bg-[#FCFBF7] border border-stone-200 rounded-2xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-colors text-sm sm:text-base resize-none font-normal"
                placeholder="ระบุข้อความสั้นๆ เช่น ค่ากับข้าววิกนี้, ค่าซ่อมรถ, หรือค่าเทอมลูก..."
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
              ></textarea>
            </div>

            {/* ปุ่มกด */}
            <div className="pt-4 flex gap-4">
              <button 
                type="button" 
                onClick={() => router.push('/advance')}
                className="w-1/3 py-4 px-4 rounded-2xl font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className={`w-2/3 py-4 px-4 rounded-2xl font-bold text-white shadow-lg transition-all ${
                  loading 
                    ? 'bg-amber-400 cursor-not-allowed shadow-none' 
                    : 'bg-amber-600 hover:bg-amber-700 hover:-translate-y-0.5 shadow-amber-500/30'
                }`}
              >
                {loading ? 'กำลังบันทึกข้อมูล...' : '💾 บันทึกและลงบัญชีทันที'}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}