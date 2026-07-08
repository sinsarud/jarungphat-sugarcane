'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

// โครงสร้างข้อมูลพนักงาน
interface Employee {
  id: string;
  full_name: string;
  position: string;
}

// โครงสร้างข้อมูลประวัติการเบิกเงิน
interface AdvanceRecord {
  id: string;
  date: string;
  employee_id: string;
  emp_name: string;
  amount: number;
  note: string;
}

export default function AdvancePaymentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState({ show: false, type: '', message: '' });

  const getTodayString = () => {
    const d = new Date();
    d.setHours(d.getHours() + 7);
    const todayStr = d.toISOString().split('T')[0];
    return todayStr;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  
  // States สำหรับป๊อปอัป "ลงบัญชีเบิกเงิน"
  const [showModal, setShowModal] = useState(false);
  const [formEmpId, setFormEmpId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formDate, setFormDate] = useState(getTodayString());

  // ฟังก์ชันดึงข้อมูลพนักงานจากฐานข้อมูลจริง
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. ดึงชื่อพนักงานเฉพาะคนที่สถานะ Active
      const { data: empData } = await supabase
        .from('employees')
        .select('id, full_name, position')
        .eq('status', 'active')
        .order('full_name');
      
      if (empData) setEmployees(empData);

      // 2. ดึงประวัติการเบิกเงินของเดือนนี้มาแสดง
      const currentMonth = selectedDate.substring(0, 7); // เอาแค่ YYYY-MM
      const { data: advData } = await supabase
        .from('advance_payments')
        .select('*')
        .like('date', `${currentMonth}%`)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (advData) setAdvances(advData);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      fetchData();
    }
    checkAuth();
  }, [router, selectedDate]);

  // ฟังก์ชันคำนวณยอดเบิกรวม (ปรับเพื่อความปลอดภัยของตัวแปร)
  const totalAdvanceThisMonth = advances.reduce((sum, record) => {
    const resSum = sum + Number(record.amount);
    return resSum;
  }, 0);
  
  const totalAdvanceToday = advances.filter(r => {
    const isToday = r.date === selectedDate;
    return isToday;
  }).reduce((sum, record) => {
    const resSum = sum + Number(record.amount);
    return resSum;
  }, 0);

  // เปิดหน้าต่างเบิกเงิน
  const openModal = () => {
    setFormEmpId('');
    setFormAmount('');
    setFormNote('');
    setFormDate(selectedDate);
    setShowModal(true);
  };

  // ฟังก์ชันบันทึกการเบิกเงินลงฐานข้อมูล
  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmpId || !formAmount) {
      setPopup({ show: true, type: 'error', message: 'กรุณาเลือกพนักงาน และระบุจำนวนเงินที่เบิกให้ครบถ้วน' });
      return;
    }

    setSaving(true);
    try {
      const selectedEmp = employees.find(emp => {
        const isMatch = emp.id === formEmpId;
        return isMatch;
      });
      if (!selectedEmp) throw new Error('ไม่พบข้อมูลพนักงานที่เลือก');

      const { error } = await supabase.from('advance_payments').insert([{
        date: formDate,
        employee_id: formEmpId,
        emp_name: selectedEmp.full_name,
        amount: Number(formAmount),
        note: formNote.trim()
      }]);

      if (error) throw error;

      setShowModal(false);
      setPopup({ show: true, type: 'success', message: `บันทึกรายการเบิกเงิน ${Number(formAmount).toLocaleString()} บาท สำเร็จแล้ว!` });
      fetchData(); 
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  // ฟังก์ชันลบรายการเบิก
  const handleDelete = async (id: string, empName: string) => {
    if (!window.confirm(`ต้องการลบรายการเบิกเงินของ ${empName} ใช่หรือไม่?`)) {
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.from('advance_payments').delete().eq('id', id);
      if (error) throw error;
      setPopup({ show: true, type: 'success', message: 'ลบรายการเบิกเงินเรียบร้อยแล้ว' });
      fetchData();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
      setLoading(false);
    }
  };

  if (loading && employees.length === 0) {
    const loadingJsx = <div className="min-h-screen bg-[#FCFBF7] flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>;
    return loadingJsx;
  }

  const mainPageLayout = (
    <div className="min-h-screen bg-[#FCFBF7] pb-24 font-sans relative">
      
      {/* 🌟 อัปเกรด Header Bar รองรับมือถือ 🌟 */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button onClick={() => router.push('/')} className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors shrink-0">
              <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-stone-800 leading-tight">สมุดบันทึกการเบิกเงินล่วงหน้า</h1>
              <p className="text-[10px] sm:text-xs text-stone-500 mt-0.5">จัดการรายการเบิกเงินระหว่างงวดของคนงาน</p>
            </div>
          </div>
          
          <button 
            onClick={openModal} 
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 sm:py-2.5 rounded-xl text-sm font-bold shadow-md shadow-amber-500/20 flex items-center justify-center transition-all active:scale-95"
          >
            <span className="mr-1.5 text-base sm:text-lg">💰</span>
            <span>ลงบัญชีเบิกเงิน</span>
          </button>
        </div>
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 mt-4 sm:mt-8">
        
        {/* การ์ดสรุปยอดปรับขนาดให้พอดีบนมือถือ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white border border-stone-200 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold text-stone-500 mb-1">ยอดเบิกรวมวันนี้ ({selectedDate})</p>
              <h3 className="text-2xl sm:text-4xl font-black text-amber-500">฿ {totalAdvanceToday.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-50 rounded-full flex items-center justify-center text-2xl sm:text-3xl shrink-0">💸</div>
          </div>
          
          <div className="bg-white border border-stone-200 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold text-stone-500 mb-1">ยอดเบิกรวมเดือนนี้</p>
              <h3 className="text-2xl sm:text-4xl font-black text-stone-800">฿ {totalAdvanceThisMonth.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-stone-50 rounded-full flex items-center justify-center text-2xl sm:text-3xl shrink-0">📅</div>
          </div>
        </div>

        {/* ส่วนประวัติการเบิกเงิน */}
        <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-stone-100 bg-stone-50/50 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <h3 className="text-base sm:text-lg font-black text-stone-800">ประวัติการเบิกเงิน</h3>
            <input 
              type="month" 
              value={selectedDate.substring(0, 7)}
              onChange={(e) => setSelectedDate(`${e.target.value}-01`)}
              className="w-full sm:w-auto px-4 py-2 bg-white border border-stone-200 rounded-lg sm:rounded-xl text-stone-800 font-bold outline-none focus:ring-2 focus:ring-amber-500 text-sm"
            />
          </div>

          {/* 🌟 1. MOBILE VIEW: แสดงแบบการ์ดสวยงาม ไม่ต้องเลื่อนจอซ้ายขวา 🌟 */}
          <div className="block md:hidden divide-y divide-stone-100">
            {advances.length > 0 ? advances.map((adv) => {
              const mobileCard = (
                <div key={`mob-${adv.id}`} className="p-4 bg-white relative hover:bg-stone-50/50 transition-colors">
                  <button 
                    onClick={() => handleDelete(adv.id, adv.emp_name)} 
                    className="absolute top-4 right-4 p-2 text-stone-300 hover:text-rose-500 bg-stone-50 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                  
                  <div className="pr-12">
                    <div className="text-xs font-bold text-stone-400 mb-1">📅 วันที่เบิก: {adv.date}</div>
                    <div className="font-black text-stone-800 text-base">{adv.emp_name}</div>
                    <div className="text-xs font-semibold text-stone-500 mt-1">📝 {adv.note || 'ไม่มีหมายเหตุ'}</div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-stone-50 flex justify-between items-center">
                    <span className="text-xs text-stone-400 font-bold">จำนวนเงินที่เบิก</span>
                    <span className="font-black text-amber-600 text-xl">฿ {Number(adv.amount).toLocaleString()}</span>
                  </div>
                </div>
              );
              return mobileCard;
            }) : (
              <div className="text-center py-12 text-stone-400 font-bold text-xs">ยังไม่มีประวัติการเบิกเงินในเดือนนี้</div>
            )}
          </div>

          {/* 💻 2. DESKTOP VIEW: แสดงตารางตัวเต็มเมื่ออยู่บนจอคอม 💻 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-stone-100 text-xs font-bold text-stone-400 uppercase tracking-wider">
                  <th className="py-4 px-6 w-1/6">วันที่เบิก</th>
                  <th className="py-4 px-6 w-2/6">ชื่อพนักงาน</th>
                  <th className="py-4 px-6 w-2/6">หมายเหตุ</th>
                  <th className="py-4 px-6 w-1/6 text-right">จำนวนเงิน</th>
                  <th className="py-4 px-6 text-center w-16">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm font-medium text-stone-700">
                {advances.length > 0 ? advances.map((adv) => {
                  const rowJsx = (
                    <tr key={adv.id} className="hover:bg-stone-50 transition-colors">
                      <td className="py-4 px-6 text-stone-500 font-bold">{adv.date}</td>
                      <td className="py-4 px-6 font-black text-stone-800 text-base">{adv.emp_name}</td>
                      <td className="py-4 px-6 text-stone-500">{adv.note || '-'}</td>
                      <td className="py-4 px-6 text-right font-black text-amber-600 text-lg">฿ {Number(adv.amount).toLocaleString()}</td>
                      <td className="py-4 px-6 text-center">
                        <button onClick={() => handleDelete(adv.id, adv.emp_name)} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="ลบรายการ">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                  return rowJsx;
                }) : (
                  <tr><td colSpan={5} className="py-12 text-center text-stone-400 font-bold">ยังไม่มีประวัติการเบิกเงินในเดือนนี้</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ======================================================= */}
      {/* 🌟 MODAL: ลงบัญชีเบิกเงิน (ปรับขนาด input ให้กว้างเต็มแถวบนมือถือ) 🌟 */}
      {/* ======================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowModal(false)}></div>
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 sm:p-6 relative z-10 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-black text-stone-800 flex items-center gap-2">
                💰 ลงบัญชีเบิกเงิน
              </h3>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600 bg-stone-100 w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors">✕</button>
            </div>

            <form onSubmit={handleSaveAdvance} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-500 mb-1.5 block">วันที่เบิก</label>
                <input type="date" required value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-4 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-amber-500 text-sm" />
              </div>

              <div>
                <label className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md mb-1.5 inline-block">พนักงานที่เบิก</label>
                <select 
                  required 
                  value={formEmpId} 
                  onChange={(e) => setFormEmpId(e.target.value)}
                  className="w-full px-4 py-2.5 sm:py-3 bg-white border border-amber-400 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm text-sm cursor-pointer"
                >
                  <option value="" disabled className="text-stone-400">-- กรุณาเลือกคนงาน --</option>
                  {employees.map(emp => {
                    const empOpt = <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.position || 'พนักงาน'})</option>;
                    return empOpt;
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-500 mb-1.5 block">จำนวนเงิน (บาท)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    required 
                    min="1"
                    value={formAmount} 
                    onChange={(e) => setFormAmount(e.target.value)} 
                    placeholder="ระบุตัวเลข..." 
                    className="w-full pl-4 pr-12 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl font-black text-xl text-stone-800 outline-none focus:ring-2 focus:ring-amber-500" 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-stone-400 text-sm">฿</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-500 mb-1.5 block">หมายเหตุ / เบิกไปทำอะไร (ไม่บังคับ)</label>
                <input type="text" value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="เช่น เบิกค่าข้าว, ซื้อของ..." className="w-full px-4 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-600 outline-none focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm" />
              </div>

              <button type="submit" disabled={saving} className={`w-full mt-6 py-3.5 sm:py-4 rounded-xl font-black text-white text-sm sm:text-base shadow-lg transition-all ${saving ? 'bg-stone-300' : 'bg-amber-500 hover:bg-amber-600 active:scale-95 shadow-amber-500/30'}`}>
                {saving ? 'กำลังบันทึก...' : 'บันทึกรายการเบิก'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 POPUP แจ้งเตือนสิทธิ์ 🌟 */}
      {/* ======================================================= */}
      {popup.show && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-xs animate-in fade-in" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95 duration-200 border border-stone-100">
            {popup.type === 'success' ? (
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div>
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></div>
            )}
            <h3 className="text-base sm:text-lg font-black text-stone-800 mb-2">{popup.type === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}</h3>
            <p className="text-xs sm:text-sm text-stone-500 mb-6 leading-relaxed">{popup.message}</p>
            <button onClick={() => setPopup({ show: false, type: '', message: '' })} className={`w-full py-2.5 sm:py-3 font-bold rounded-xl text-white shadow-md text-sm ${popup.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}>ตกลง</button>
          </div>
        </div>
      )}

    </div>
  );
  return mainPageLayout;
}