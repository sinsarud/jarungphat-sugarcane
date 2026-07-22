'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface Expense {
  id: string;
  expense_date: string;
  category: 'FUEL' | 'FERTILIZER' | 'MAINTENANCE' | 'OPERATION';
  amount: number;
  reference_tag: string;
  description: string;
}

export default function ExpensesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 🎛️ Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH'>('THIS_MONTH');
  
  // 🪟 Notification Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const showToast = useCallback((message: string, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3500);
  }, []);

  // ➕ State สำหรับ Modal เพิ่ม/แก้ไข
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '', expense_date: new Date().toISOString().split('T')[0], category: 'FUEL' as 'FUEL' | 'FERTILIZER' | 'MAINTENANCE' | 'OPERATION', amount: '', reference_tag: '', description: ''
  });

  // 🔄 ดึงข้อมูลจากฐานข้อมูล
  const fetchExpenses = useCallback(async (isRefresh = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('farm_expenses')
        .select('*')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (data && !error) {
        setExpenses(data as Expense[]);
      }
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
      if (isRefresh) showToast('⚡ อัปเดตข้อมูลรายจ่ายล่าสุดแล้ว', 'success');
    }
  }, [showToast]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // 🔘 เปิดหน้าต่างเพิ่มรายการใหม่
  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({ id: '', expense_date: new Date().toISOString().split('T')[0], category: 'FUEL', amount: '', reference_tag: '', description: '' });
    setShowModal(true);
  };

  // 🔘 เปิดหน้าต่างแก้ไข
  const handleOpenEdit = (expense: Expense) => {
    setIsEditing(true);
    setFormData({
      id: expense.id,
      expense_date: expense.expense_date,
      category: expense.category,
      amount: expense.amount.toString(),
      reference_tag: expense.reference_tag || '',
      description: expense.description || ''
    });
    setShowModal(true);
  };

  // 💾 บันทึกข้อมูล
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      showToast('❌ กรุณากรอกจำนวนเงินให้ถูกต้อง', 'error');
      return;
    }

    try {
      if (isEditing) {
        const { error } = await supabase.from('farm_expenses').update({
          expense_date: formData.expense_date,
          category: formData.category,
          amount: Number(formData.amount),
          reference_tag: formData.reference_tag,
          description: formData.description,
        }).eq('id', formData.id);

        if (error) throw error;
        showToast(`🔵 แก้ไขรายการใช้จ่ายเรียบร้อย!`, 'success');
      } else {
        const { error } = await supabase.from('farm_expenses').insert([{
          expense_date: formData.expense_date,
          category: formData.category,
          amount: Number(formData.amount),
          reference_tag: formData.reference_tag,
          description: formData.description,
        }]);

        if (error) throw error;
        showToast(`🟢 บันทึกรายจ่ายใหม่สำเร็จ!`, 'success');
      }

      setShowModal(false);
      fetchExpenses();
    } catch (err: any) {
      showToast(`❌ เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
  };

  // 🗑️ ลบรายการ
  const handleDeleteExpense = async (id: string) => {
    const isConfirmed = window.confirm(`⚠️ แน่ใจหรือไม่ที่จะลบรายการค่าใช้จ่ายนี้?`);
    if (!isConfirmed) return;

    try {
      const { error } = await supabase.from('farm_expenses').delete().eq('id', id);
      if (error) throw error;
      setExpenses(prev => prev.filter(e => e.id !== id));
      showToast(`🔴 ลบรายการออกจากระบบแล้ว`, 'error');
    } catch (err) {
      showToast('❌ ไม่สามารถลบข้อมูลได้', 'error');
    }
  };

  // 🎨 ไอคอนและสีตามหมวดหมู่
  const getCategoryMeta = (category: string) => {
    switch (category) {
      case 'FUEL': return { label: 'ค่าน้ำมัน', icon: '⛽', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'FERTILIZER': return { label: 'ค่าปุ๋ย / ยา', icon: '🌱', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'MAINTENANCE': return { label: 'ค่าซ่อมรถ / อะไหล่', icon: '🔧', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'OPERATION': return { label: 'เบ็ดเตล็ด / จิปาถะ', icon: '🧾', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      default: return { label: 'อื่นๆ', icon: '📌', bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  // 🔍 กรองข้อมูล
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return expenses.filter(e => {
      // 1. กรองคำค้นหา
      const searchMatch = 
        (e.description && e.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.reference_tag && e.reference_tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // 2. กรองหมวดหมู่
      const catMatch = selectedCategory === 'ALL' || e.category === selectedCategory;

      // 3. กรองเวลา
      let dateMatch = true;
      const expenseDate = new Date(e.expense_date);
      if (dateFilter === 'THIS_MONTH') {
        dateMatch = expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
      } else if (dateFilter === 'LAST_MONTH') {
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const yearOfLastMonth = currentMonth === 0 ? currentYear - 1 : currentYear;
        dateMatch = expenseDate.getMonth() === lastMonth && expenseDate.getFullYear() === yearOfLastMonth;
      }

      return searchMatch && catMatch && dateMatch;
    });
  }, [expenses, searchTerm, selectedCategory, dateFilter]);

  // 📊 สถิติ
  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const fuel = filteredExpenses.filter(e => e.category === 'FUEL').reduce((sum, e) => sum + e.amount, 0);
    const fertilizer = filteredExpenses.filter(e => e.category === 'FERTILIZER').reduce((sum, e) => sum + e.amount, 0);
    const maintenance = filteredExpenses.filter(e => e.category === 'MAINTENANCE').reduce((sum, e) => sum + e.amount, 0);
    return { total, fuel, fertilizer, maintenance };
  }, [filteredExpenses]);

  if (loading && expenses.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-rose-500/20"></div>
        <p className="mt-4 text-xs font-bold text-slate-400 tracking-wider uppercase animate-pulse">Loading Expenses...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans text-slate-800 antialiased selection:bg-rose-500 selection:text-white relative">
      
      {/* 🌟 Header Section 🌟 */}
      <header className="bg-white/90 backdrop-blur-md border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => router.push('/')} className="group w-10 h-10 bg-white border border-stone-200 hover:border-rose-400 hover:bg-rose-50 rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm">
              <svg className="w-5 h-5 text-stone-400 group-hover:text-rose-600 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div className="h-8 w-px bg-stone-200 hidden sm:block mx-1"></div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-red-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-rose-500/20 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-black text-stone-900 tracking-tight leading-none mb-1">บันทึกค่าใช้จ่าย & ต้นทุน</h1>
                <p className="text-[11px] font-bold text-stone-500 leading-none hidden sm:flex items-center gap-1.5">Expense Management Pro</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button onClick={handleOpenAdd} className="px-4 py-2 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-500/20 flex items-center gap-1.5 transition-all active:scale-95">
              <span>➕ ลงบิลรายจ่ายใหม่</span>
            </button>
            <button onClick={() => fetchExpenses(true)} className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center transition-all active:scale-95" title="รีเฟรช">
              <svg className={`w-4 h-4 text-rose-600 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 mt-6 sm:mt-8 space-y-6">
        
        {/* 🌟 Stats Banner 🌟 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-rose-500 text-white p-5 rounded-[20px] shadow-lg shadow-rose-500/20 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div>
            <p className="text-[11px] font-bold text-rose-100 uppercase tracking-wider relative z-10">ยอดใช้จ่ายรวม (ตามตัวกรอง)</p>
            <div className="flex items-baseline gap-1.5 mt-2 relative z-10">
              <span className="text-lg font-black text-rose-200">฿</span>
              <h3 className="text-3xl font-black">{stats.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[20px] border border-stone-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">ค่าน้ำมันรถ</p>
              <h3 className="text-xl font-black text-blue-600 mt-1">฿ {stats.fuel.toLocaleString()}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center text-lg">⛽</div>
          </div>

          <div className="bg-white p-5 rounded-[20px] border border-stone-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">ค่าปุ๋ย / ยา</p>
              <h3 className="text-xl font-black text-emerald-600 mt-1">฿ {stats.fertilizer.toLocaleString()}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-lg">🌱</div>
          </div>

          <div className="bg-white p-5 rounded-[20px] border border-stone-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">ค่าซ่อมบำรุง / อะไหล่</p>
              <h3 className="text-xl font-black text-amber-600 mt-1">฿ {stats.maintenance.toLocaleString()}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-lg">🔧</div>
          </div>
        </div>

        {/* 🌟 Smart Grid Filters 🌟 */}
        <div className="bg-white p-5 sm:p-6 rounded-[20px] border border-stone-100 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="relative flex-grow max-w-lg">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-stone-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                type="text"
                placeholder="ค้นหารายละเอียด หรือเลขบิลอ้างอิง..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm font-semibold"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs font-bold">
              {[
                { id: 'ALL', label: 'ทุกช่วงเวลา' },
                { id: 'THIS_MONTH', label: 'เดือนนี้' },
                { id: 'LAST_MONTH', label: 'เดือนที่แล้ว' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDateFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap border ${
                    dateFilter === tab.id 
                      ? 'bg-rose-500 text-white border-rose-500 shadow-sm font-black' 
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider shrink-0 mr-1">หมวดหมู่:</span>
              {[
                { id: 'ALL', label: '⚡ ทั้งหมด' },
                { id: 'FUEL', label: '⛽ ค่าน้ำมัน' },
                { id: 'FERTILIZER', label: '🌱 ค่าปุ๋ย/ยา' },
                { id: 'MAINTENANCE', label: '🔧 ซ่อมรถ/อะไหล่' },
                { id: 'OPERATION', label: '🧾 จิปาถะ' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                    selectedCategory === cat.id 
                      ? 'bg-stone-800 text-white border-stone-800 font-black' 
                      : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* 📱 MOBILE VIEW: Sleek Cards 📱 */}
        {/* ======================================================= */}
        <div className="block md:hidden space-y-3">
          {filteredExpenses.length > 0 ? filteredExpenses.map((exp) => {
            const meta = getCategoryMeta(exp.category);
            return (
              <div key={exp.id} className="p-4 rounded-2xl border bg-white border-stone-200 shadow-sm">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border whitespace-nowrap ${meta.bg}`}>
                    <span>{meta.icon}</span> <span>{meta.label}</span>
                  </span>
                  <span className="text-[10px] font-bold text-stone-400">{new Date(exp.expense_date).toLocaleDateString('th-TH')}</span>
                </div>
                
                <h4 className="font-bold text-stone-800 text-sm mb-1">{exp.description || '-'}</h4>
                {exp.reference_tag && <p className="text-[10px] font-bold text-stone-400 mb-3">อ้างอิง: {exp.reference_tag}</p>}

                <div className="flex justify-between items-end pt-2 border-t border-stone-100">
                  <span className="text-lg font-black text-rose-600">฿ {exp.amount.toLocaleString()}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleOpenEdit(exp)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold border border-blue-200">✎ แก้ไข</button>
                    <button onClick={() => handleDeleteExpense(exp.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold border border-rose-200">🗑️ ลบ</button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 border-dashed">
              <p className="text-stone-400 font-bold text-sm">ไม่พบรายการค่าใช้จ่าย</p>
            </div>
          )}
        </div>

        {/* ======================================================= */}
        {/* 💻 DESKTOP VIEW: Clean Table 💻 */}
        {/* ======================================================= */}
        <div className="hidden md:block bg-white rounded-[20px] border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  <th className="py-4 px-6 whitespace-nowrap">วันที่จ่าย</th>
                  <th className="py-4 px-6 whitespace-nowrap">หมวดหมู่</th>
                  <th className="py-4 px-6 whitespace-nowrap">รายละเอียด</th>
                  <th className="py-4 px-6 whitespace-nowrap">อ้างอิง (รถ/แปลง/บิล)</th>
                  <th className="py-4 px-6 text-right whitespace-nowrap">จำนวนเงิน</th>
                  <th className="py-4 px-6 text-center whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm font-medium text-stone-700">
                {filteredExpenses.length > 0 ? filteredExpenses.map((exp) => {
                  const meta = getCategoryMeta(exp.category);
                  return (
                    <tr key={exp.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-4 px-6 whitespace-nowrap font-bold text-stone-500 text-xs">
                        {new Date(exp.expense_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black border ${meta.bg}`}>
                          <span>{meta.icon}</span> <span>{meta.label}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-stone-800 max-w-xs truncate">
                        {exp.description || '-'}
                      </td>
                      <td className="py-4 px-6 font-bold text-stone-400 text-xs whitespace-nowrap">
                        {exp.reference_tag || '-'}
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap font-black text-rose-600 text-base">
                        ฿ {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button onClick={() => handleOpenEdit(exp)} className="p-1.5 px-3 bg-white hover:bg-stone-100 text-stone-600 rounded-xl text-xs font-bold border border-stone-200 transition-all shadow-sm">✎ แก้ไข</button>
                          <button onClick={() => handleDeleteExpense(exp.id)} className="p-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold border border-rose-200 transition-all shadow-sm">🗑️ ลบ</button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-stone-400 font-bold">ไม่พบรายการค่าใช้จ่ายที่ค้นหา</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* ======================================================= */}
      {/* ➕ MODAL: เพิ่ม/แก้ไขรายจ่าย */}
      {/* ======================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-5">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <h3 className="text-lg font-black text-stone-900 flex items-center gap-2">
                <span>{isEditing ? '✎' : '💸'}</span> {isEditing ? `แก้ไขบิลรายจ่าย` : 'ลงบิลค่าใช้จ่ายใหม่'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">วันที่จ่าย <span className="text-rose-500">*</span></label>
                  <input type="date" value={formData.expense_date} onChange={e => setFormData({...formData, expense_date: e.target.value})} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500" required />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">หมวดหมู่ <span className="text-rose-500">*</span></label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500">
                    <option value="FUEL">⛽ ค่าน้ำมัน</option>
                    <option value="FERTILIZER">🌱 ค่าปุ๋ย/ยา</option>
                    <option value="MAINTENANCE">🔧 ซ่อมรถ/อะไหล่</option>
                    <option value="OPERATION">🧾 จิปาถะ (เบ็ดเตล็ด)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">จำนวนเงิน (บาท) <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-stone-400 font-black">฿</span>
                  <input type="number" step="0.01" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full pl-8 pr-4 py-3 bg-rose-50/50 border border-rose-200 rounded-xl text-lg font-black text-rose-600 outline-none focus:ring-2 focus:ring-rose-500" required />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">รายละเอียดบิล <span className="text-rose-500">*</span></label>
                <input type="text" placeholder="เช่น เติมดีเซล 200 ลิตร, ซื้อปุ๋ยยูเรีย 10 กระสอบ" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500" required />
              </div>

              <div>
                <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">อ้างอิงถึง (เลขบิล / รถ / แปลงอ้อย)</label>
                <input type="text" placeholder="เช่น TR-01, แปลง A, บิลเลขที่ 1234" value={formData.reference_tag} onChange={e => setFormData({...formData, reference_tag: e.target.value})} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-black hover:bg-stone-200 transition-all">ยกเลิก</button>
                <button type="submit" className="px-6 py-2 bg-rose-500 text-white rounded-xl text-xs font-black hover:bg-rose-600 shadow-md shadow-rose-500/20 transition-all">
                  {isEditing ? '💾 บันทึกการแก้ไข' : '💾 บันทึกรายจ่าย'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 NOTIFICATION TOAST 🌟 */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-[150] animate-in fade-in slide-in-from-bottom-5 duration-200 max-w-sm">
          <div className={`text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            toast.type === 'error' ? 'bg-rose-600 border-rose-500 animate-bounce' : 'bg-stone-900 border-stone-800'
          }`}>
            <span className="text-lg">{toast.type === 'error' ? '🚨' : '✅'}</span>
            <p className="text-xs font-bold leading-snug">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}