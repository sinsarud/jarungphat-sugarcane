'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface Vehicle {
  id: string;
  code: string;
  name: string;
  type: 'TRACTOR' | 'HARVESTER' | 'TRUCK' | 'OTHER';
  license_plate: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';
  current_hour_meter: number;
  tax_expiry: string;
}

export default function MachineryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 🎛️ Filters
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  
  // 🪟 Notification Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const showToast = useCallback((message: string, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3500);
  }, []);

  // ➕ State สำหรับ Modal เพิ่ม/แก้ไขรถ
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '', code: '', name: '', type: 'TRACTOR' as 'TRACTOR' | 'HARVESTER' | 'TRUCK' | 'OTHER', license_plate: '', current_hour_meter: 0, tax_expiry: ''
  });

  // 🔄 ระบบดึงข้อมูลรถ
  const fetchVehicles = useCallback(async (isRefresh = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('code', { ascending: true });

      if (data && !error) {
        setVehicles(data as Vehicle[]);
      }
    } catch (err) {
      console.error('Error fetching vehicles:', err);
    } finally {
      setLoading(false);
      if (isRefresh) showToast('⚡ อัปเดตข้อมูลเครื่องจักรล่าสุดแล้ว', 'success');
    }
  }, [showToast]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // ⚙️ ฟังก์ชันสร้างรหัสรถอัตโนมัติตามประเภท (Auto-generate Code)
  const generateAutoCode = useCallback((type: string, currentVehicles: Vehicle[]) => {
    let prefix = 'OT-';
    if (type === 'TRACTOR') prefix = 'TR-';
    else if (type === 'HARVESTER') prefix = 'HV-';
    else if (type === 'TRUCK') prefix = 'TK-';

    // ค้นหารถที่มีรหัสขึ้นต้นด้วย prefix นี้
    const matchingVehicles = currentVehicles.filter(v => v.code && v.code.toUpperCase().startsWith(prefix));
    
    if (matchingVehicles.length === 0) {
      return `${prefix}01`;
    }

    // หาตัวเลขที่มากที่สุดจากรหัสที่มีอยู่
    let maxNum = 0;
    matchingVehicles.forEach(v => {
      const numPart = parseInt(v.code.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    });

    // บวก 1 และจัดรูปแบบให้มี 0 นำหน้า 2 หลัก (เช่น 01, 02, 10)
    const nextNum = (maxNum + 1).toString().padStart(2, '0');
    return `${prefix}${nextNum}`;
  }, []);

  // 🔘 เปิดหน้าต่างเพิ่มรถใหม่ (พร้อมรันรหัสออโต้ทันที)
  const handleOpenAdd = () => {
    setIsEditing(false);
    const defaultType = 'TRACTOR';
    const autoCode = generateAutoCode(defaultType, vehicles);
    
    setFormData({ id: '', code: autoCode, name: '', type: defaultType, license_plate: '', current_hour_meter: 0, tax_expiry: '' });
    setShowModal(true);
  };

  // 🔘 เมื่อเปลี่ยนประเภทรถตอน "เพิ่มใหม่" ให้เปลี่ยนรหัสออโต้ตามประเภทใหม่ทันที
  const handleTypeChange = (newType: 'TRACTOR' | 'HARVESTER' | 'TRUCK' | 'OTHER') => {
    if (!isEditing) {
      const autoCode = generateAutoCode(newType, vehicles);
      setFormData(prev => ({ ...prev, type: newType, code: autoCode }));
    } else {
      setFormData(prev => ({ ...prev, type: newType }));
    }
  };

  // 🔘 เปิดหน้าต่างแก้ไขรถ (ดึงข้อมูลเดิมมาโชว์)
  const handleOpenEdit = (vehicle: Vehicle) => {
    setIsEditing(true);
    setFormData({
      id: vehicle.id,
      code: vehicle.code,
      name: vehicle.name,
      type: vehicle.type,
      license_plate: vehicle.license_plate || '',
      current_hour_meter: vehicle.current_hour_meter || 0,
      tax_expiry: vehicle.tax_expiry || ''
    });
    setShowModal(true);
  };

  // 💾 บันทึกข้อมูล (ทั้งกรณีเพิ่มใหม่ และ แก้ไขของเดิม)
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      showToast('❌ กรุณากรอกรหัสรถและชื่อเครื่องจักร', 'error');
      return;
    }

    try {
      if (isEditing) {
        // 🛠️ กรณีแก้ไข
        const { error } = await supabase
          .from('vehicles')
          .update({
            code: formData.code.toUpperCase(),
            name: formData.name,
            type: formData.type,
            license_plate: formData.license_plate,
            current_hour_meter: Number(formData.current_hour_meter),
            tax_expiry: formData.tax_expiry || null,
          })
          .eq('id', formData.id);

        if (error) throw error;
        showToast(`🔵 แก้ไขข้อมูลรถ ${formData.code} เรียบร้อย!`, 'success');
      } else {
        // ➕ กรณีเพิ่มใหม่
        const { error } = await supabase.from('vehicles').insert([{
          code: formData.code.toUpperCase(),
          name: formData.name,
          type: formData.type,
          license_plate: formData.license_plate,
          current_hour_meter: Number(formData.current_hour_meter),
          tax_expiry: formData.tax_expiry || null,
          status: 'AVAILABLE'
        }]);

        if (error) throw error;
        showToast(`🟢 เพิ่มเครื่องจักร ${formData.code} สำเร็จ!`, 'success');
      }

      setShowModal(false);
      fetchVehicles();
    } catch (err: any) {
      showToast(`❌ เกิดข้อผิดพลาด: ${err.message || 'รหัสรถอาจซ้ำ หรือข้อมูลไม่ถูกต้อง'}`, 'error');
    }
  };

  // 🗑️ ลบรถออกจากระบบ
  const handleDeleteVehicle = async (id: string, code: string) => {
    const isConfirmed = window.confirm(`⚠️ คุณแน่ใจหรือไม่ที่จะลบเครื่องจักร [${code}] ออกจากระบบ?\n\n*การลบนี้จะไม่สามารถกู้คืนกลับมาได้`);
    if (!isConfirmed) return;

    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (error) throw error;

      setVehicles(prev => prev.filter(v => v.id !== id));
      showToast(`🔴 ลบเครื่องจักร ${code} ออกจากระบบแล้ว`, 'error');
    } catch (err: any) {
      showToast('❌ ไม่สามารถลบข้อมูลได้ อาจติดเงื่อนไขประวัติการใช้งาน', 'error');
    }
  };

  // 🔄 เปลี่ยนสถานะรถแบบรวดเร็ว
  const toggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'AVAILABLE' ? 'IN_USE' : currentStatus === 'IN_USE' ? 'MAINTENANCE' : 'AVAILABLE';
    try {
      await supabase.from('vehicles').update({ status: nextStatus }).eq('id', id);
      setVehicles(prev => prev.map(v => v.id === id ? { ...v, status: nextStatus as any } : v));
      showToast('🔄 อัปเดตสถานะรถเรียบร้อย', 'info');
    } catch (err) {
      showToast('❌ ไม่สามารถอัปเดตสถานะได้', 'error');
    }
  };

  // 🎨 ไอคอนและสีตามประเภทเครื่องจักร
  const getTypeMeta = (type: string) => {
    switch (type) {
      case 'TRACTOR': return { label: 'แทรกเตอร์', icon: '🚜', bg: 'bg-amber-50 text-amber-800 border-amber-200 font-black' };
      case 'HARVESTER': return { label: 'รถตัดอ้อย', icon: '🌾', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-black' };
      case 'TRUCK': return { label: 'รถบรรทุก/10ล้อ', icon: '🚚', bg: 'bg-blue-50 text-blue-800 border-blue-200 font-black' };
      default: return { label: 'เครื่องจักรอื่นๆ', icon: '⚙️', bg: 'bg-slate-100 text-slate-700 border-slate-200 font-bold' };
    }
  };

  // 🎨 สีตามสถานะการใช้งาน
  const getStatusMeta = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return { label: '🟢 พร้อมใช้งาน', bg: 'bg-emerald-100/80 text-emerald-900 border-emerald-300 font-black' };
      case 'IN_USE': return { label: '🔵 กำลังทำงาน', bg: 'bg-sky-100/80 text-sky-900 border-sky-300 font-black' };
      case 'MAINTENANCE': return { label: '🔴 ส่งซ่อม/เช็กระยะ', bg: 'bg-rose-100/80 text-rose-900 border-rose-300 font-black animate-pulse' };
      default: return { label: status, bg: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
  };

  // 🔍 ระบบกรองข้อมูล
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const matchesSearch = 
        v.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.license_plate && v.license_plate.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = selectedType === 'ALL' || v.type === selectedType;
      const matchesStatus = selectedStatus === 'ALL' || v.status === selectedStatus;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [vehicles, searchTerm, selectedType, selectedStatus]);

  // สถิติสำหรับ Banner
  const stats = useMemo(() => ({
    total: vehicles.length,
    available: vehicles.filter(v => v.status === 'AVAILABLE').length,
    inUse: vehicles.filter(v => v.status === 'IN_USE').length,
    maintenance: vehicles.filter(v => v.status === 'MAINTENANCE').length,
  }), [vehicles]);

  if (loading && vehicles.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-amber-500/20"></div>
        <p className="mt-4 text-xs font-bold text-slate-400 tracking-wider uppercase animate-pulse">Loading Machinery Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans text-slate-800 antialiased selection:bg-amber-500 selection:text-white relative">
      
      {/* 🌟 Header Section 🌟 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 transition-all">
        <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button 
              onClick={() => router.push('/')} 
              className="p-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-xl transition-all shrink-0 active:scale-95"
              title="กลับหน้าหลัก"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">จัดการเครื่องจักร & ยานพาหนะ</h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-black rounded-full uppercase tracking-wider">Fleet Pro</span>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 mt-1">คุมสต็อกแทรกเตอร์ รถตัดอ้อย รถบรรทุก และติดตามระยะเวลาซ่อมบำรุง</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button 
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <span>➕ เพิ่มเครื่องจักรใหม่</span>
            </button>

            <button 
              onClick={() => fetchVehicles(true)}
              className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center transition-all active:scale-95"
              title="รีเฟรชข้อมูลล่าสุด"
            >
              <svg className={`w-4 h-4 text-amber-600 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1500px] mx-auto px-4 sm:px-8 mt-6 sm:mt-8 space-y-6">
        
        {/* 🌟 Stats Banner 🌟 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">เครื่องจักรทั้งหมด</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{stats.total} <span className="text-xs font-bold text-slate-500">คัน</span></h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center text-lg shrink-0">🚜</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">พร้อมใช้งาน</p>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">{stats.available} <span className="text-xs font-bold text-slate-500">คัน</span></h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shrink-0">🟢</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">กำลังออกงานไร่</p>
              <h3 className="text-xl sm:text-2xl font-black text-sky-600 mt-0.5">{stats.inUse} <span className="text-xs font-bold text-slate-500">คัน</span></h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center text-lg shrink-0">⚡</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-rose-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex items-center justify-between bg-gradient-to-br from-rose-50/30 to-white">
            <div>
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1"><span>ส่งซ่อม / บำรุงรักษา</span></p>
              <h3 className="text-xl sm:text-2xl font-black text-rose-600 mt-0.5">{stats.maintenance} <span className="text-xs font-bold text-slate-500">คัน</span></h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-lg shrink-0 animate-pulse">🔧</div>
          </div>
        </div>

        {/* 🌟 Smart Grid Filters 🌟 */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.03)] space-y-4">
          
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="relative flex-grow max-w-lg">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                type="text"
                placeholder="ค้นหารหัสรถ, ชื่อเครื่องจักร, ทะเบียนรถ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl sm:rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-xs sm:text-sm font-semibold"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs font-bold">
              {[
                { id: 'ALL', label: '⏳ ทุกสถานะ' },
                { id: 'AVAILABLE', label: '🟢 พร้อมใช้งาน' },
                { id: 'IN_USE', label: '🔵 กำลังทำงาน' },
                { id: 'MAINTENANCE', label: '🔴 ส่งซ่อม/เช็กระยะ' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedStatus(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap border ${
                    selectedStatus === tab.id 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm font-black' 
                      : 'bg-slate-50/80 text-slate-600 border-slate-200/60 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">ประเภท:</span>
              {[
                { id: 'ALL', label: '🚜 ทั้งหมด' },
                { id: 'TRACTOR', label: '🚜 แทรกเตอร์' },
                { id: 'HARVESTER', label: '🌾 รถตัดอ้อย' },
                { id: 'TRUCK', label: '🚚 รถบรรทุก/10ล้อ' },
                { id: 'OTHER', label: '⚙️ อื่นๆ' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                    selectedType === type.id 
                      ? 'bg-amber-50 text-amber-900 border-amber-300 font-black' 
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* ======================================================= */}
        {/* 📱 MOBILE VIEW: Sleek Cards พร้อมปุ่มแก้ไข / ลบ 📱 */}
        {/* ======================================================= */}
        <div className="block md:hidden space-y-3">
          {filteredVehicles.length > 0 ? filteredVehicles.map((v) => {
            const typeMeta = getTypeMeta(v.type);
            const statusMeta = getStatusMeta(v.status);

            return (
              <div key={v.id} className="p-4 rounded-2xl border bg-white border-slate-200/80 shadow-sm space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-white bg-slate-900 px-2 py-0.5 rounded-md whitespace-nowrap">{v.code}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border whitespace-nowrap ${typeMeta.bg}`}>
                      <span>{typeMeta.icon}</span>
                      <span>{typeMeta.label}</span>
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded border">
                    {v.license_plate || 'ไม่มีทะเบียน'}
                  </span>
                </div>

                <h4 className="font-black text-slate-900 text-sm">{v.name}</h4>

                {/* กดที่ Hour meter เพื่อเปิดแก้ชั่วโมงได้ด้วย */}
                <div 
                  onClick={() => handleOpenEdit(v)}
                  className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 cursor-pointer active:bg-amber-50/60 transition-colors"
                >
                  <span className="font-bold text-slate-500">ชั่วโมงทำงาน (Hour Meter):</span>
                  <span className="font-black text-amber-600 text-sm flex items-center gap-1">
                    {v.current_hour_meter.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">ชม.</span>
                    <span className="text-xs text-blue-500 ml-1 font-bold">✎ แก้ไข</span>
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <button 
                    onClick={() => toggleStatus(v.id, v.status)}
                    className={`px-3 py-1 rounded-xl text-xs border transition-all active:scale-95 whitespace-nowrap ${statusMeta.bg}`}
                  >
                    {statusMeta.label}
                  </button>
                  
                  {/* ปุ่มจัดการ มือถือ */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(v)}
                      className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold border border-blue-200/60 transition-all active:scale-95"
                      title="แก้ไขข้อมูล"
                    >
                      ✎ แก้ไข
                    </button>
                    <button
                      onClick={() => handleDeleteVehicle(v.id, v.code)}
                      className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold border border-rose-200/60 transition-all active:scale-95"
                      title="ลบรถคันนี้"
                    >
                      🗑️ ลบ
                    </button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 border-dashed">
              <div className="w-14 h-14 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🚜</div>
              <p className="text-slate-500 font-bold text-sm">ไม่พบข้อมูลเครื่องจักรที่ค้นหา</p>
            </div>
          )}
        </div>

        {/* ======================================================= */}
        {/* 💻 DESKTOP VIEW: Enterprise Table พร้อมปุ่มแก้ไข / ลบ 💻 */}
        {/* ======================================================= */}
        <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6 whitespace-nowrap">รหัสรถ</th>
                  <th className="py-4 px-6 whitespace-nowrap">ชื่อเครื่องจักร / รุ่น</th>
                  <th className="py-4 px-6 whitespace-nowrap">ประเภท</th>
                  <th className="py-4 px-6 whitespace-nowrap">ทะเบียน / เลขคัสซี</th>
                  <th className="py-4 px-6 text-right whitespace-nowrap">ชั่วโมงทำงาน (Hour Meter)</th>
                  <th className="py-4 px-6 text-center whitespace-nowrap">สถานะ (คลิกเพื่อสลับ)</th>
                  <th className="py-4 px-6 text-center whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                {filteredVehicles.length > 0 ? filteredVehicles.map((v) => {
                  const typeMeta = getTypeMeta(v.type);
                  const statusMeta = getStatusMeta(v.status);

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80 text-xs">
                          {v.code}
                        </span>
                      </td>

                      <td className="py-4 px-6 font-black text-slate-900 whitespace-nowrap">
                        {v.name}
                      </td>

                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border whitespace-nowrap ${typeMeta.bg}`}>
                          <span>{typeMeta.icon}</span>
                          <span>{typeMeta.label}</span>
                        </span>
                      </td>

                      <td className="py-4 px-6 font-bold text-slate-500 text-xs whitespace-nowrap">
                        {v.license_plate || '-'}
                      </td>

                      {/* กดที่ชั่วโมง เพื่อเปิดแก้ Hour meter ทันที */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <span 
                          onClick={() => handleOpenEdit(v)}
                          className="font-black text-amber-600 hover:text-amber-700 cursor-pointer bg-amber-50 hover:bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200/60 transition-all inline-flex items-center gap-1"
                          title="คลิกเพื่ออัปเดตชั่วโมงทำงาน"
                        >
                          {v.current_hour_meter.toLocaleString()} <span className="text-[11px] font-normal text-slate-400">ชม.</span>
                          <span className="text-xs ml-0.5 text-amber-700 font-bold">✎</span>
                        </span>
                      </td>

                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        <button 
                          onClick={() => toggleStatus(v.id, v.status)}
                          className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs border transition-all active:scale-95 whitespace-nowrap cursor-pointer hover:opacity-80 ${statusMeta.bg}`}
                          title="คลิกเพื่อสลับสถานะ (พร้อมใช้ -> ทำงาน -> ซ่อม)"
                        >
                          {statusMeta.label}
                        </button>
                      </td>

                      {/* 🛠️ คอลัมน์จัดการ: ปุ่ม แก้ไข & ลบ */}
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(v)}
                            className="p-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold border border-blue-200/60 transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                            title="แก้ไขข้อมูลเครื่องจักร"
                          >
                            <span>✎</span> แก้ไข
                          </button>
                          <button
                            onClick={() => handleDeleteVehicle(v.id, v.code)}
                            className="p-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold border border-rose-200/60 transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                            title="ลบข้อมูลรถคันนี้"
                          >
                            <span>🗑️</span> ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🚜</div>
                      <p className="text-slate-500 font-bold text-base">ไม่พบรายชื่อเครื่องจักรที่ค้นหา</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* ======================================================= */}
      {/* ➕ MODAL: เพิ่ม และ แก้ไขเครื่องจักร */}
      {/* ======================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>{isEditing ? '✎' : '🚜'}</span> {isEditing ? `แก้ไขข้อมูล: [${formData.code}]` : 'เพิ่มเครื่องจักร/ยานพาหนะใหม่'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1">ประเภทเครื่องจักร <span className="text-rose-500">*</span></label>
                  <select 
                    value={formData.type} 
                    onChange={e => handleTypeChange(e.target.value as any)} 
                    className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="TRACTOR">🚜 แทรกเตอร์</option>
                    <option value="HARVESTER">🌾 รถตัดอ้อย</option>
                    <option value="TRUCK">🚚 รถบรรทุก/10ล้อ</option>
                    <option value="OTHER">⚙️ เครื่องจักรอื่นๆ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1">รหัสรถ <span className="text-amber-600 font-normal">*(ออโต้ตามประเภท)*</span></label>
                  <input 
                    type="text" 
                    placeholder="เช่น TR-01" 
                    value={formData.code} 
                    onChange={e => setFormData({...formData, code: e.target.value})} 
                    className="w-full p-2.5 bg-amber-50/40 border border-amber-300/80 rounded-xl text-sm font-black text-amber-900 outline-none focus:ring-2 focus:ring-amber-500" 
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 mb-1">ชื่อเครื่องจักร / รุ่น <span className="text-rose-500">*</span></label>
                <input type="text" placeholder="เช่น แทรกเตอร์ Kubota M9860" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1">ทะเบียน / เลขคัสซี</label>
                  <input type="text" placeholder="เช่น ตค 1234 กจ" value={formData.license_plate} onChange={e => setFormData({...formData, license_plate: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1">ชั่วโมงทำงาน (Hour Meter) <span className="text-amber-600 font-normal">*(อัปเดตตรงนี้)*</span></label>
                  <input type="number" step="0.1" value={formData.current_hour_meter} onChange={e => setFormData({...formData, current_hour_meter: Number(e.target.value)})} className="w-full p-2.5 bg-amber-50/50 border border-amber-300 rounded-xl text-sm font-black text-amber-900 outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 mb-1">วันหมดอายุภาษี / พ.ร.บ.</label>
                <input type="date" value={formData.tax_expiry} onChange={e => setFormData({...formData, tax_expiry: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-200 transition-all">ยกเลิก</button>
                <button type="submit" className={`px-5 py-2 text-white rounded-xl text-xs font-black shadow-md transition-all ${isEditing ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'}`}>
                  {isEditing ? '💾 บันทึกการแก้ไข' : '💾 เพิ่มเข้าสต็อก'}
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
            toast.type === 'error' ? 'bg-rose-600 border-rose-500 animate-bounce' : 'bg-slate-900 border-slate-800'
          }`}>
            <span className="text-lg">{toast.type === 'error' ? '🚨' : '⚡'}</span>
            <p className="text-xs font-bold leading-snug">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}