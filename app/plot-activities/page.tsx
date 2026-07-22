'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import WeatherWidget from '../WeatherWidget';
// 🌟 นำเข้าศูนย์บัญชาการดาวเทียม NDVI ที่เราสร้างกันไว้ (ถ้าพาร์ทไฟล์ของบอสต่างจากนี้ ปรับแก้จุดนี้ได้เลยนะครับ)
import NDVIMonitor from '../NDVIMonitor';

interface Plot { id: string; code: string; name: string; }
interface Vehicle { id: string; code: string; name: string; }

interface PlotActivity {
  id: string;
  plot_id: string;
  activity_date: string;
  activity_type: 'PREPARE' | 'PLANT' | 'FERTILIZE' | 'HARVEST';
  vehicle_id: string | null;
  labor_count: number;
  total_cost: number;
  details: string;
  plots?: Plot;
  vehicles?: Vehicle;
}

export default function PlotActivitiesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<PlotActivity[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 🛰️ แท็บสลับหน้าจอ: กิจกรรมแปลง vs ดาวเทียม NDVI
  const [activeTab, setActiveTab] = useState<'ACTIVITIES' | 'SATELLITE'>('ACTIVITIES');

  // 🎛️ Filters
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedPlot, setSelectedPlot] = useState<string>('ALL');
  
  // 🪟 Notification Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const showToast = useCallback((message: string, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3500);
  }, []);

  // ➕ State สำหรับ Modal
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '', plot_id: '', activity_date: new Date().toISOString().split('T')[0], 
    activity_type: 'FERTILIZE' as 'PREPARE' | 'PLANT' | 'FERTILIZE' | 'HARVEST', 
    vehicle_id: '', labor_count: '', total_cost: '', details: ''
  });

  // 🔄 ดึงข้อมูลจากฐานข้อมูล
  const fetchData = useCallback(async (isRefresh = false) => {
    setLoading(true);
    try {
      const { data: pData } = await supabase.from('plots').select('id, code, name').order('code');
      if (pData) setPlots(pData);

      const { data: vData } = await supabase.from('vehicles').select('id, code, name').order('code');
      if (vData) setVehicles(vData);

      const { data: aData, error } = await supabase
        .from('plot_activities')
        .select(`*, plots(id, code, name), vehicles(id, code, name)`)
        .order('activity_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (aData && !error) {
        setActivities(aData as PlotActivity[]);
      }
    } catch (err) {
      console.error('Error fetching plot activities:', err);
    } finally {
      setLoading(false);
      if (isRefresh) showToast('⚡ อัปเดตข้อมูลล่าสุดจากเซิร์ฟเวอร์แล้ว', 'success');
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 🔘 เปิดหน้าต่างเพิ่มรายการใหม่
  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({ 
      id: '', plot_id: plots.length > 0 ? plots[0].id : '', 
      activity_date: new Date().toISOString().split('T')[0], 
      activity_type: 'FERTILIZE', vehicle_id: '', labor_count: '', total_cost: '', details: '' 
    });
    setShowModal(true);
  };

  // 🔘 เปิดหน้าต่างแก้ไข
  const handleOpenEdit = (act: PlotActivity) => {
    setIsEditing(true);
    setFormData({
      id: act.id,
      plot_id: act.plot_id,
      activity_date: act.activity_date,
      activity_type: act.activity_type,
      vehicle_id: act.vehicle_id || '',
      labor_count: act.labor_count?.toString() || '',
      total_cost: act.total_cost?.toString() || '',
      details: act.details || ''
    });
    setShowModal(true);
  };

  // 💾 บันทึกข้อมูล
  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plot_id || !formData.details) {
      showToast('❌ กรุณาเลือกแปลงอ้อยและกรอกรายละเอียด', 'error');
      return;
    }

    try {
      const payload = {
        plot_id: formData.plot_id,
        activity_date: formData.activity_date,
        activity_type: formData.activity_type,
        vehicle_id: formData.vehicle_id || null,
        labor_count: formData.labor_count ? Number(formData.labor_count) : 0,
        total_cost: formData.total_cost ? Number(formData.total_cost) : 0,
        details: formData.details
      };

      if (isEditing) {
        const { error } = await supabase.from('plot_activities').update(payload).eq('id', formData.id);
        if (error) throw error;
        showToast(`🔵 แก้ไขกิจกรรมแปลงเรียบร้อย!`, 'success');
      } else {
        const { error } = await supabase.from('plot_activities').insert([payload]);
        if (error) throw error;
        showToast(`🟢 บันทึกกิจกรรมแปลงสำเร็จ!`, 'success');
      }

      setShowModal(false);
      fetchData();
    } catch (err: any) {
      showToast(`❌ เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
  };

  // 🗑️ ลบรายการ
  const handleDeleteActivity = async (id: string) => {
    const isConfirmed = window.confirm(`⚠️ แน่ใจหรือไม่ที่จะลบข้อมูลกิจกรรมนี้?`);
    if (!isConfirmed) return;

    try {
      const { error } = await supabase.from('plot_activities').delete().eq('id', id);
      if (error) throw error;
      setActivities(prev => prev.filter(a => a.id !== id));
      showToast(`🔴 ลบรายการออกจากระบบแล้ว`, 'error');
    } catch (err) {
      showToast('❌ ไม่สามารถลบข้อมูลได้', 'error');
    }
  };

  // 🎨 ไอคอนและสีตามประเภทกิจกรรม
  const getTypeMeta = (type: string) => {
    switch (type) {
      case 'PREPARE': return { label: 'เตรียมดิน / ไถ', icon: '🚜', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'PLANT': return { label: 'ปลูกอ้อยใหม่', icon: '🌱', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'FERTILIZE': return { label: 'ใส่ปุ๋ย / ฉีดยา', icon: '🧪', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'HARVEST': return { label: 'เก็บเกี่ยว / ตัด', icon: '🌾', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      default: return { label: 'อื่นๆ', icon: '📌', bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  // 🔍 กรองข้อมูล
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      const searchMatch = 
        (act.details && act.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (act.plots?.name && act.plots.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (act.plots?.code && act.plots.code.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const typeMatch = selectedType === 'ALL' || act.activity_type === selectedType;
      const plotMatch = selectedPlot === 'ALL' || act.plot_id === selectedPlot;

      return searchMatch && typeMatch && plotMatch;
    });
  }, [activities, searchTerm, selectedType, selectedPlot]);

  // 📊 สถิติ
  const stats = useMemo(() => {
    const totalCost = filteredActivities.reduce((sum, a) => sum + Number(a.total_cost || 0), 0);
    const prepareCost = filteredActivities.filter(a => a.activity_type === 'PREPARE').reduce((sum, a) => sum + Number(a.total_cost || 0), 0);
    const fertilizeCost = filteredActivities.filter(a => a.activity_type === 'FERTILIZE').reduce((sum, a) => sum + Number(a.total_cost || 0), 0);
    const harvestCost = filteredActivities.filter(a => a.activity_type === 'HARVEST').reduce((sum, a) => sum + Number(a.total_cost || 0), 0);
    return { totalCost, prepareCost, fertilizeCost, harvestCost, totalLogs: filteredActivities.length };
  }, [filteredActivities]);

  if (loading && activities.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-teal-500/20"></div>
        <p className="mt-4 text-xs font-bold text-slate-400 tracking-wider uppercase animate-pulse">กำลังโหลดระบบ AgriTech...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans text-slate-800 antialiased selection:bg-teal-500 selection:text-white relative">
      
      {/* 🌟 Header Section 🌟 */}
      <header className="bg-white/90 backdrop-blur-md border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => router.push('/plots')} className="group w-10 h-10 bg-white border border-stone-200 hover:border-teal-400 hover:bg-teal-50 rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm" title="กลับหน้าจัดการแปลง">
              <svg className="w-5 h-5 text-stone-400 group-hover:text-teal-600 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div className="h-8 w-px bg-stone-200 hidden sm:block mx-1"></div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0">
                <span className="text-xl">🚜</span>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-black text-stone-900 tracking-tight leading-none mb-1">ศูนย์ควบคุมกิจกรรม & ต้นทุน</h1>
                <p className="text-[11px] font-bold text-stone-500 leading-none flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Precision AgriTech v2.0
                </p>
              </div>
            </div>
          </div>

          {/* 🌟 ปุ่มควบคุมด้านขวา (เพิ่มปุ่มสลับแท็บดาวเทียม NDVI) */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto justify-end">
            <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 mr-1">
              <button
                onClick={() => setActiveTab('ACTIVITIES')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                  activeTab === 'ACTIVITIES'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                <span>📋</span> บันทึกแปลง
              </button>
              <button
                onClick={() => setActiveTab('SATELLITE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                  activeTab === 'SATELLITE'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md animate-pulse'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                <span>🛰️</span> สแกน NDVI
              </button>
            </div>

            <button onClick={handleOpenAdd} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-teal-500/20 flex items-center gap-1.5 transition-all active:scale-95">
              <span>➕ บันทึกงานใหม่</span>
            </button>
            <button onClick={() => fetchData(true)} className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center transition-all active:scale-95" title="รีเฟรช">
              <svg className={`w-4 h-4 text-teal-600 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 mt-6 sm:mt-8 space-y-6">
        
        {/* ======================================================= */}
        {/* ⛅ Smart Weather Widget (พยากรณ์อากาศก่อนแพลนงาน) ⛅ */}
        {/* ======================================================= */}
        <div className="w-full">
          <WeatherWidget />
        </div>

        {/* 🌟 ถ้ากดเลือกแท็บ "สแกนดาวเทียม NDVI" ให้โชว์หน้าจอตัวใหม่ทันที! 🌟 */}
        {activeTab === 'SATELLITE' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <NDVIMonitor />
          </div>
        ) : (
          /* 🌟 ถ้าอยู่ในโหมดปกติ (ACTIVITIES) ให้โชว์สถิติ ตาราง และฟิลเตอร์เดิม 🌟 */
          <>
            {/* 🌟 Stats Banner 🌟 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-teal-600 to-emerald-700 text-white p-5 rounded-[20px] shadow-lg shadow-teal-600/20 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute -bottom-4 -right-4 p-4 opacity-10 group-hover:scale-110 transition-transform"><svg className="w-28 h-28" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div>
                <p className="text-[11px] font-bold text-teal-100 uppercase tracking-wider relative z-10">ต้นทุนรวม (ตามตัวกรอง)</p>
                <div className="flex items-baseline gap-1.5 mt-2 relative z-10">
                  <span className="text-lg font-black text-teal-200">฿</span>
                  <h3 className="text-3xl font-black text-white">{stats.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                </div>
              </div>

              <div className="bg-white p-5 rounded-[20px] border border-stone-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">ต้นทุนเตรียมดิน / ปลูก</p>
                  <h3 className="text-xl font-black text-amber-600 mt-1">฿ {stats.prepareCost.toLocaleString()}</h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-xl shadow-inner border border-amber-100/50">🚜</div>
              </div>

              <div className="bg-white p-5 rounded-[20px] border border-stone-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">ต้นทุนบำรุง (ปุ๋ย/ยา)</p>
                  <h3 className="text-xl font-black text-blue-600 mt-1">฿ {stats.fertilizeCost.toLocaleString()}</h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center text-xl shadow-inner border border-blue-100/50">🧪</div>
              </div>

              <div className="bg-white p-5 rounded-[20px] border border-stone-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">ต้นทุนตัด / เก็บเกี่ยว</p>
                  <h3 className="text-xl font-black text-purple-600 mt-1">฿ {stats.harvestCost.toLocaleString()}</h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center text-xl shadow-inner border border-purple-100/50">🌾</div>
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
                    placeholder="ค้นหารายละเอียดกิจกรรม..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-10 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm font-semibold"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 text-xs font-bold overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'ALL', label: '⚡ ทุกกิจกรรม' },
                    { id: 'PREPARE', label: '🚜 เตรียมดิน' },
                    { id: 'PLANT', label: '🌱 ปลูก' },
                    { id: 'FERTILIZE', label: '🧪 ใส่ปุ๋ย/ยา' },
                    { id: 'HARVEST', label: '🌾 ตัดอ้อย' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedType(tab.id)}
                      className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap border ${
                        selectedType === tab.id 
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm font-black' 
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
                  <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider shrink-0 mr-1">กรองตามแปลง:</span>
                  <button
                    onClick={() => setSelectedPlot('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                      selectedPlot === 'ALL' 
                        ? 'bg-stone-800 text-white border-stone-800 font-black' 
                        : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    🗺️ ทุกแปลง
                  </button>
                  {plots.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlot(p.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                        selectedPlot === p.id 
                          ? 'bg-teal-50 text-teal-900 border-teal-300 font-black' 
                          : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {p.code}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ======================================================= */}
            {/* 💻 DESKTOP VIEW: Clean Table 💻 */}
            {/* ======================================================= */}
            <div className="hidden md:block bg-white rounded-[20px] border border-stone-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                      <th className="py-4 px-6 whitespace-nowrap">วันที่</th>
                      <th className="py-4 px-6 whitespace-nowrap">แปลงอ้อย</th>
                      <th className="py-4 px-6 whitespace-nowrap">ประเภทกิจกรรม</th>
                      <th className="py-4 px-6 whitespace-nowrap">รายละเอียด</th>
                      <th className="py-4 px-6 whitespace-nowrap">รถที่ใช้ / คนงาน</th>
                      <th className="py-4 px-6 text-right whitespace-nowrap">ต้นทุนรวม</th>
                      <th className="py-4 px-6 text-center whitespace-nowrap">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-sm font-medium text-stone-700">
                    {filteredActivities.length > 0 ? filteredActivities.map((act) => {
                      const meta = getTypeMeta(act.activity_type);
                      return (
                        <tr key={act.id} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-4 px-6 whitespace-nowrap font-bold text-stone-500 text-xs">
                            {new Date(act.activity_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="py-4 px-6 whitespace-nowrap">
                            <span className="font-black text-stone-800 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200 text-xs">
                              {act.plots?.code || '-'}
                            </span>
                            {act.plots?.name && <p className="text-[10px] text-stone-400 mt-1">{act.plots.name}</p>}
                          </td>
                          <td className="py-4 px-6 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black border ${meta.bg}`}>
                              <span>{meta.icon}</span> <span>{meta.label}</span>
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <p className="font-bold text-stone-800">{act.details}</p>
                          </td>
                          <td className="py-4 px-6 whitespace-nowrap">
                            {act.vehicles && <span className="block text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 mb-1 w-max">🚜 {act.vehicles.code}</span>}
                            {act.labor_count > 0 && <span className="block text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 w-max">👨‍🌾 คนงาน {act.labor_count} คน</span>}
                          </td>
                          <td className="py-4 px-6 text-right whitespace-nowrap font-black text-rose-600 text-base">
                            ฿ {act.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-6 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button onClick={() => handleOpenEdit(act)} className="p-1.5 px-2.5 bg-white hover:bg-teal-50 text-teal-600 rounded-xl text-xs font-bold border border-stone-200 hover:border-teal-200 transition-all shadow-sm">✎</button>
                              <button onClick={() => handleDeleteActivity(act.id)} className="p-1.5 px-2 bg-white hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold border border-stone-200 hover:border-rose-200 transition-all shadow-sm">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-stone-400 font-bold">ไม่พบกิจกรรมที่ค้นหา</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ======================================================= */}
            {/* 📱 MOBILE VIEW: Cards (แก้ไขจุดบอดตารางหายบนมือถือ!) 📱 */}
            {/* ======================================================= */}
            <div className="md:hidden space-y-3">
              {filteredActivities.length > 0 ? filteredActivities.map((act) => {
                const meta = getTypeMeta(act.activity_type);
                return (
                  <div key={act.id} className="bg-white p-4 rounded-[20px] border border-stone-200 shadow-sm space-y-3 transition-all">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-stone-800 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200 text-xs">
                          {act.plots?.code || '-'}
                        </span>
                        <span className="text-xs font-bold text-stone-500">
                          {new Date(act.activity_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${meta.bg}`}>
                        <span>{meta.icon}</span> <span>{meta.label}</span>
                      </span>
                    </div>

                    <p className="font-bold text-stone-800 text-sm leading-snug">{act.details}</p>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-wrap gap-1">
                        {act.vehicles && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">🚜 {act.vehicles.code}</span>}
                        {act.labor_count > 0 && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">👨‍🌾 {act.labor_count} คน</span>}
                      </div>
                      <div className="text-right font-black text-rose-600 text-base">
                        ฿ {act.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                      <button onClick={() => handleOpenEdit(act)} className="px-3 py-1 bg-stone-50 hover:bg-teal-50 text-teal-600 rounded-lg text-xs font-black border border-stone-200">✎ แก้ไข</button>
                      <button onClick={() => handleDeleteActivity(act.id)} className="px-3 py-1 bg-stone-50 hover:bg-rose-50 text-rose-600 rounded-lg text-xs font-black border border-stone-200">🗑️ ลบ</button>
                    </div>
                  </div>
                );
              }) : (
                <div className="bg-white p-12 text-center rounded-[20px] border border-stone-200 text-stone-400 font-bold">
                  ไม่พบกิจกรรมที่ค้นหา
                </div>
              )}
            </div>
          </>
        )}

      </main>

      {/* ======================================================= */}
      {/* ➕ MODAL: เพิ่ม/แก้ไขกิจกรรม */}
      {/* ======================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-5">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <h3 className="text-lg font-black text-stone-900 flex items-center gap-2">
                <span>{isEditing ? '✎' : '📋'}</span> {isEditing ? `แก้ไขกิจกรรมแปลง` : 'บันทึกกิจกรรมใหม่'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleSaveActivity} className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">เลือกแปลงอ้อย <span className="text-rose-500">*</span></label>
                  <select value={formData.plot_id} onChange={e => setFormData({...formData, plot_id: e.target.value})} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-black outline-none focus:ring-2 focus:ring-teal-500" required>
                    <option value="" disabled>-- เลือกแปลง --</option>
                    {plots.map(p => (
                      <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">วันที่ทำกิจกรรม <span className="text-rose-500">*</span></label>
                  <input type="date" value={formData.activity_date} onChange={e => setFormData({...formData, activity_date: e.target.value})} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500" required />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">ประเภทกิจกรรม <span className="text-rose-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFormData({...formData, activity_type: 'PREPARE'})} className={`py-2 rounded-xl text-xs font-black border transition-all ${formData.activity_type === 'PREPARE' ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-stone-50 border-stone-200 text-stone-500'}`}>🚜 เตรียมดิน</button>
                  <button type="button" onClick={() => setFormData({...formData, activity_type: 'PLANT'})} className={`py-2 rounded-xl text-xs font-black border transition-all ${formData.activity_type === 'PLANT' ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-stone-50 border-stone-200 text-stone-500'}`}>🌱 ปลูกใหม่</button>
                  <button type="button" onClick={() => setFormData({...formData, activity_type: 'FERTILIZE'})} className={`py-2 rounded-xl text-xs font-black border transition-all ${formData.activity_type === 'FERTILIZE' ? 'bg-blue-100 border-blue-400 text-blue-800' : 'bg-stone-50 border-stone-200 text-stone-500'}`}>🧪 ใส่ปุ๋ย/ฉีดยา</button>
                  <button type="button" onClick={() => setFormData({...formData, activity_type: 'HARVEST'})} className={`py-2 rounded-xl text-xs font-black border transition-all ${formData.activity_type === 'HARVEST' ? 'bg-purple-100 border-purple-400 text-purple-800' : 'bg-stone-50 border-stone-200 text-stone-500'}`}>🌾 ตัดอ้อย</button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">รายละเอียด (เช่น ชื่อปุ๋ย สูตรยา) <span className="text-rose-500">*</span></label>
                <textarea rows={2} placeholder="เช่น ใส่ปุ๋ยยูเรีย 15 กระสอบ..." value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500 resize-none custom-scrollbar" required></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 border border-stone-100 rounded-xl">
                <div>
                  <label className="block text-[10px] font-black text-stone-500 mb-1 uppercase">รถที่ใช้งาน (ถ้ามี)</label>
                  <select value={formData.vehicle_id} onChange={e => setFormData({...formData, vehicle_id: e.target.value})} className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm font-bold text-stone-700 outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="">-- ไม่ใช้รถ --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>[{v.code}]</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-stone-500 mb-1 uppercase">จำนวนคนงาน (คน)</label>
                  <input type="number" placeholder="0" value={formData.labor_count} onChange={e => setFormData({...formData, labor_count: e.target.value})} className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm font-bold text-stone-700 outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-rose-600 mb-1 uppercase tracking-wider">ต้นทุนรวมรอบนี้ (บาท) <span className="text-stone-400 font-medium text-[9px]">(ปุ๋ย+แรง+น้ำมัน)</span></label>
                <input type="number" step="0.01" placeholder="0.00" value={formData.total_cost} onChange={e => setFormData({...formData, total_cost: e.target.value})} className="w-full p-2.5 bg-rose-50/50 border border-rose-200 rounded-xl text-lg font-black text-rose-600 outline-none focus:ring-2 focus:ring-rose-500" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-black hover:bg-stone-200 transition-all">ยกเลิก</button>
                <button type="submit" className="px-6 py-2 bg-teal-600 text-white rounded-xl text-xs font-black hover:bg-teal-700 shadow-md shadow-teal-500/20 transition-all">
                  {isEditing ? '💾 บันทึกการแก้ไข' : '💾 บันทึกกิจกรรม'}
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

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>
    </div>
  );
}