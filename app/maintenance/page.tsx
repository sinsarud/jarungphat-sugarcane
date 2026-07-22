'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface Vehicle {
  id: string;
  code: string;
  name: string;
}

interface MaintenanceLog {
  id: string;
  vehicle_id: string;
  maintenance_date: string;
  service_type: 'REPAIR' | 'PM';
  hour_meter: number;
  cost: number;
  details: string;
  mechanic_name: string;
  next_service_hour: number | null;
  vehicles: Vehicle; // ข้อมูลรถที่ Join มา
}

export default function MaintenancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 🎛️ Filters
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('ALL');
  
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
    id: '', vehicle_id: '', maintenance_date: new Date().toISOString().split('T')[0], 
    service_type: 'REPAIR' as 'REPAIR' | 'PM', hour_meter: '', cost: '', 
    details: '', mechanic_name: '', next_service_hour: ''
  });

  // 🔄 ดึงข้อมูลจากฐานข้อมูล
  const fetchData = useCallback(async (isRefresh = false) => {
    setLoading(true);
    try {
      // 1. ดึงข้อมูลรถมาทำ Dropdown
      const { data: vData } = await supabase.from('vehicles').select('id, code, name').order('code');
      if (vData) setVehicles(vData);

      // 2. ดึงประวัติการซ่อมบำรุง
      const { data: mData, error } = await supabase
        .from('vehicle_maintenance')
        .select(`*, vehicles(id, code, name)`)
        .order('maintenance_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (mData && !error) {
        setLogs(mData as MaintenanceLog[]);
      }
    } catch (err) {
      console.error('Error fetching maintenance logs:', err);
    } finally {
      setLoading(false);
      if (isRefresh) showToast('⚡ อัปเดตประวัติซ่อมบำรุงล่าสุดแล้ว', 'success');
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 🔘 เปิดหน้าต่างเพิ่มรายการใหม่
  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({ 
      id: '', vehicle_id: vehicles.length > 0 ? vehicles[0].id : '', 
      maintenance_date: new Date().toISOString().split('T')[0], 
      service_type: 'REPAIR', hour_meter: '', cost: '', 
      details: '', mechanic_name: '', next_service_hour: '' 
    });
    setShowModal(true);
  };

  // 🔘 เปิดหน้าต่างแก้ไข
  const handleOpenEdit = (log: MaintenanceLog) => {
    setIsEditing(true);
    setFormData({
      id: log.id,
      vehicle_id: log.vehicle_id,
      maintenance_date: log.maintenance_date,
      service_type: log.service_type,
      hour_meter: log.hour_meter?.toString() || '',
      cost: log.cost?.toString() || '',
      details: log.details || '',
      mechanic_name: log.mechanic_name || '',
      next_service_hour: log.next_service_hour?.toString() || ''
    });
    setShowModal(true);
  };

  // 💾 บันทึกข้อมูล
  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicle_id || !formData.details) {
      showToast('❌ กรุณาเลือกรถและกรอกรายละเอียดการซ่อม', 'error');
      return;
    }

    try {
      const payload = {
        vehicle_id: formData.vehicle_id,
        maintenance_date: formData.maintenance_date,
        service_type: formData.service_type,
        hour_meter: formData.hour_meter ? Number(formData.hour_meter) : null,
        cost: formData.cost ? Number(formData.cost) : 0,
        details: formData.details,
        mechanic_name: formData.mechanic_name,
        next_service_hour: formData.next_service_hour ? Number(formData.next_service_hour) : null,
      };

      if (isEditing) {
        const { error } = await supabase.from('vehicle_maintenance').update(payload).eq('id', formData.id);
        if (error) throw error;
        showToast(`🔵 แก้ไขประวัติการซ่อมเรียบร้อย!`, 'success');
      } else {
        const { error } = await supabase.from('vehicle_maintenance').insert([payload]);
        if (error) throw error;
        showToast(`🟢 บันทึกประวัติซ่อมใหม่สำเร็จ!`, 'success');
      }

      setShowModal(false);
      fetchData();
    } catch (err: any) {
      showToast(`❌ เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
  };

  // 🗑️ ลบรายการ
  const handleDeleteLog = async (id: string) => {
    const isConfirmed = window.confirm(`⚠️ แน่ใจหรือไม่ที่จะลบประวัติการซ่อมนี้?`);
    if (!isConfirmed) return;

    try {
      const { error } = await supabase.from('vehicle_maintenance').delete().eq('id', id);
      if (error) throw error;
      setLogs(prev => prev.filter(l => l.id !== id));
      showToast(`🔴 ลบรายการออกจากระบบแล้ว`, 'error');
    } catch (err) {
      showToast('❌ ไม่สามารถลบข้อมูลได้', 'error');
    }
  };

  // 🎨 ไอคอนและสีตามประเภทงานซ่อม
  const getTypeMeta = (type: string) => {
    if (type === 'PM') return { label: 'เช็กระยะ / ถ่ายน้ำมัน', icon: '🛢️', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    return { label: 'ซ่อมแซมทั่วไป', icon: '🔧', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
  };

  // 🔍 กรองข้อมูล
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const searchMatch = 
        (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.mechanic_name && log.mechanic_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.vehicles?.code.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const typeMatch = selectedType === 'ALL' || log.service_type === selectedType;
      const vehicleMatch = selectedVehicle === 'ALL' || log.vehicle_id === selectedVehicle;

      return searchMatch && typeMatch && vehicleMatch;
    });
  }, [logs, searchTerm, selectedType, selectedVehicle]);

  // 📊 สถิติ
  const stats = useMemo(() => {
    const totalCost = filteredLogs.reduce((sum, l) => sum + Number(l.cost || 0), 0);
    const pmCount = filteredLogs.filter(l => l.service_type === 'PM').length;
    const repairCount = filteredLogs.filter(l => l.service_type === 'REPAIR').length;
    return { totalCost, pmCount, repairCount, totalLogs: filteredLogs.length };
  }, [filteredLogs]);

  if (loading && logs.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-amber-500/20"></div>
        <p className="mt-4 text-xs font-bold text-slate-400 tracking-wider uppercase animate-pulse">Loading Maintenance Logs...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans text-slate-800 antialiased selection:bg-amber-500 selection:text-white relative">
      
      {/* 🌟 Header Section 🌟 */}
      <header className="bg-white/90 backdrop-blur-md border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => router.push('/machinery')} className="group w-10 h-10 bg-white border border-stone-200 hover:border-amber-400 hover:bg-amber-50 rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm" title="กลับหน้าระบบเครื่องจักร">
              <svg className="w-5 h-5 text-stone-400 group-hover:text-amber-600 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div className="h-8 w-px bg-stone-200 hidden sm:block mx-1"></div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-black text-stone-900 tracking-tight leading-none mb-1">ประวัติซ่อมบำรุงรถ</h1>
                <p className="text-[11px] font-bold text-stone-500 leading-none hidden sm:flex items-center gap-1.5">Maintenance Log Book</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button onClick={handleOpenAdd} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all active:scale-95">
              <span>➕ บันทึกซ่อม/บำรุงรักษา</span>
            </button>
            <button onClick={() => fetchData(true)} className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center transition-all active:scale-95" title="รีเฟรช">
              <svg className={`w-4 h-4 text-amber-600 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 mt-6 sm:mt-8 space-y-6">
        
        {/* 🌟 Stats Banner 🌟 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-stone-900 text-white p-5 rounded-[20px] shadow-lg shadow-stone-900/20 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div>
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider relative z-10">ค่าซ่อมบำรุงรวม (ตามตัวกรอง)</p>
            <div className="flex items-baseline gap-1.5 mt-2 relative z-10">
              <span className="text-lg font-black text-amber-500">฿</span>
              <h3 className="text-3xl font-black text-white">{stats.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[20px] border border-stone-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">บันทึกทั้งหมด</p>
              <h3 className="text-xl font-black text-stone-800 mt-1">{stats.totalLogs} <span className="text-xs text-stone-500 font-bold">รายการ</span></h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-stone-50 text-stone-500 flex items-center justify-center text-lg">📋</div>
          </div>

          <div className="bg-white p-5 rounded-[20px] border border-stone-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">ซ่อมแซมทั่วไป</p>
              <h3 className="text-xl font-black text-amber-600 mt-1">{stats.repairCount} <span className="text-xs text-stone-500 font-bold">ครั้ง</span></h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-lg">🔧</div>
          </div>

          <div className="bg-white p-5 rounded-[20px] border border-stone-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">เช็กระยะ / ถ่ายน้ำมัน</p>
              <h3 className="text-xl font-black text-emerald-600 mt-1">{stats.pmCount} <span className="text-xs text-stone-500 font-bold">ครั้ง</span></h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-lg">🛢️</div>
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
                placeholder="ค้นหารายละเอียด หรือชื่อช่าง/อู่..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-semibold"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs font-bold">
              {[
                { id: 'ALL', label: '⚡ ทุกประเภท' },
                { id: 'REPAIR', label: '🔧 ซ่อมทั่วไป' },
                { id: 'PM', label: '🛢️ เช็กระยะ' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedType(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap border ${
                    selectedType === tab.id 
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm font-black' 
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
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider shrink-0 mr-1">กรองตามรถ:</span>
              <button
                onClick={() => setSelectedVehicle('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                  selectedVehicle === 'ALL' 
                    ? 'bg-stone-800 text-white border-stone-800 font-black' 
                    : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                }`}
              >
                🚜 รถทุกคัน
              </button>
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVehicle(v.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                    selectedVehicle === v.id 
                      ? 'bg-amber-50 text-amber-900 border-amber-300 font-black' 
                      : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {v.code}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* 📱 MOBILE VIEW: Sleek Cards 📱 */}
        {/* ======================================================= */}
        <div className="block md:hidden space-y-3">
          {filteredLogs.length > 0 ? filteredLogs.map((log) => {
            const meta = getTypeMeta(log.service_type);
            return (
              <div key={log.id} className="p-4 rounded-2xl border bg-white border-stone-200 shadow-sm">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black text-white bg-stone-800 px-2 py-0.5 rounded-md whitespace-nowrap">{log.vehicles?.code || 'ไม่ระบุ'}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border whitespace-nowrap ${meta.bg}`}>
                      <span>{meta.icon}</span> <span>{meta.label}</span>
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-stone-400 whitespace-nowrap">{new Date(log.maintenance_date).toLocaleDateString('th-TH')}</span>
                </div>
                
                <h4 className="font-bold text-stone-800 text-sm mb-1">{log.details}</h4>
                <div className="flex flex-col gap-0.5 mb-3">
                  <p className="text-[10px] font-bold text-stone-500">ซ่อมที่: {log.mechanic_name || '-'}</p>
                  {log.hour_meter && <p className="text-[10px] font-bold text-amber-600">ที่ชั่วโมง: {log.hour_meter.toLocaleString()} ชม.</p>}
                  {log.next_service_hour && <p className="text-[10px] font-bold text-rose-500">รอบถัดไป: {log.next_service_hour.toLocaleString()} ชม.</p>}
                </div>

                <div className="flex justify-between items-end pt-2 border-t border-stone-100">
                  <span className="text-lg font-black text-stone-800">฿ {log.cost.toLocaleString()}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleOpenEdit(log)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold border border-blue-200">✎</button>
                    <button onClick={() => handleDeleteLog(log.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold border border-rose-200">🗑️</button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 border-dashed">
              <p className="text-stone-400 font-bold text-sm">ไม่พบประวัติซ่อมรถ</p>
            </div>
          )}
        </div>

        {/* ======================================================= */}
        {/* 💻 DESKTOP VIEW: Clean Table 💻 */}
        {/* ======================================================= */}
        <div className="hidden md:block bg-white rounded-[20px] border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  <th className="py-4 px-6 whitespace-nowrap">วันที่ซ่อม</th>
                  <th className="py-4 px-6 whitespace-nowrap">รหัสรถ</th>
                  <th className="py-4 px-6 whitespace-nowrap">ประเภทงานซ่อม</th>
                  <th className="py-4 px-6 whitespace-nowrap">รายละเอียด & อู่ซ่อม</th>
                  <th className="py-4 px-6 text-right whitespace-nowrap">ชั่วโมงหน้าปัด</th>
                  <th className="py-4 px-6 text-right whitespace-nowrap">ค่าใช้จ่ายรวม</th>
                  <th className="py-4 px-6 text-center whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm font-medium text-stone-700">
                {filteredLogs.length > 0 ? filteredLogs.map((log) => {
                  const meta = getTypeMeta(log.service_type);
                  return (
                    <tr key={log.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-4 px-6 whitespace-nowrap font-bold text-stone-500 text-xs">
                        {new Date(log.maintenance_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="font-black text-stone-800 bg-stone-100 px-2 py-1 rounded-md border border-stone-200 text-xs">
                          {log.vehicles?.code || '-'}
                        </span>
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black border ${meta.bg}`}>
                          <span>{meta.icon}</span> <span>{meta.label}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-bold text-stone-800">{log.details}</p>
                        <p className="text-[10px] font-bold text-stone-400 mt-0.5">ช่าง/อู่: {log.mechanic_name || '-'}</p>
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        {log.hour_meter && (
                          <span className="font-black text-amber-600 block">{log.hour_meter.toLocaleString()} <span className="text-[10px] text-stone-400 font-normal">ชม.</span></span>
                        )}
                        {log.next_service_hour && (
                          <span className="text-[9px] font-bold text-rose-500 block mt-0.5 bg-rose-50 px-1.5 py-0.5 rounded">รอบหน้า: {log.next_service_hour.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap font-black text-stone-800 text-base">
                        ฿ {log.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button onClick={() => handleOpenEdit(log)} className="p-1.5 px-2.5 bg-white hover:bg-blue-50 text-blue-600 rounded-xl text-xs font-bold border border-stone-200 hover:border-blue-200 transition-all shadow-sm">✎</button>
                          <button onClick={() => handleDeleteLog(log.id)} className="p-1.5 px-2 bg-white hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold border border-stone-200 hover:border-rose-200 transition-all shadow-sm">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-stone-400 font-bold">ไม่พบประวัติซ่อมรถที่ค้นหา</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* ======================================================= */}
      {/* ➕ MODAL: เพิ่ม/แก้ไขประวัติซ่อม */}
      {/* ======================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-5">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <h3 className="text-lg font-black text-stone-900 flex items-center gap-2">
                <span>{isEditing ? '✎' : '🔧'}</span> {isEditing ? `แก้ไขประวัติซ่อม` : 'บันทึกซ่อม/บำรุงรักษาใหม่'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleSaveLog} className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">เลือกเครื่องจักร <span className="text-rose-500">*</span></label>
                  <select value={formData.vehicle_id} onChange={e => setFormData({...formData, vehicle_id: e.target.value})} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-black outline-none focus:ring-2 focus:ring-amber-500" required>
                    <option value="" disabled>-- เลือกรถ --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>[{v.code}] {v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">วันที่ซ่อม <span className="text-rose-500">*</span></label>
                  <input type="date" value={formData.maintenance_date} onChange={e => setFormData({...formData, maintenance_date: e.target.value})} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500" required />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">ประเภทงาน <span className="text-rose-500">*</span></label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setFormData({...formData, service_type: 'REPAIR'})} className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${formData.service_type === 'REPAIR' ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-stone-50 border-stone-200 text-stone-500'}`}>🔧 ซ่อมแซมทั่วไป</button>
                  <button type="button" onClick={() => setFormData({...formData, service_type: 'PM'})} className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${formData.service_type === 'PM' ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-stone-50 border-stone-200 text-stone-500'}`}>🛢️ เช็กระยะ / ถ่ายน้ำมัน</button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">รายละเอียดการซ่อม (ซ่อมอะไรบ้าง) <span className="text-rose-500">*</span></label>
                <textarea rows={2} placeholder="เช่น ถ่ายน้ำมันเครื่อง, เปลี่ยนไส้กรอง, ปะยาง..." value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500 resize-none custom-scrollbar" required></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">ชื่ออู่ / ช่างซ่อม</label>
                  <input type="text" placeholder="เช่น อู่ช่างดำ" value={formData.mechanic_name} onChange={e => setFormData({...formData, mechanic_name: e.target.value})} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-stone-500 mb-1 uppercase tracking-wider">ค่าใช้จ่ายรวม (บาท)</label>
                  <input type="number" step="0.01" placeholder="0.00" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold text-stone-900 outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                <div>
                  <label className="block text-[10px] font-black text-amber-700 mb-1 uppercase">ชั่วโมงหน้าปัดปัจจุบัน</label>
                  <input type="number" step="0.1" placeholder="เช่น 1250" value={formData.hour_meter} onChange={e => setFormData({...formData, hour_meter: e.target.value})} className="w-full p-2 bg-white border border-amber-200 rounded-lg text-sm font-bold text-amber-900 outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-rose-600 mb-1 uppercase">รอบซ่อมถัดไป (ชั่วโมง)</label>
                  <input type="number" step="0.1" placeholder="เช่น 1500" value={formData.next_service_hour} onChange={e => setFormData({...formData, next_service_hour: e.target.value})} className="w-full p-2 bg-white border border-rose-200 rounded-lg text-sm font-bold text-rose-700 outline-none focus:ring-2 focus:ring-rose-400" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-black hover:bg-stone-200 transition-all">ยกเลิก</button>
                <button type="submit" className="px-6 py-2 bg-amber-500 text-white rounded-xl text-xs font-black hover:bg-amber-600 shadow-md shadow-amber-500/20 transition-all">
                  {isEditing ? '💾 บันทึกการแก้ไข' : '💾 บันทึกประวัติ'}
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