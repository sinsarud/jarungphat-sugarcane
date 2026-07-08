'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface Plot {
  id: string;
  code: string; 
  area_rai: number; 
  variety: string; 
  cycle: string; 
  status: 'growing' | 'ready' | 'harvesting' | 'resting'; 
  last_updated: string;
}

export default function PlotsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plots, setPlots] = useState<Plot[]>([]);

  const [varieties, setVarieties] = useState<string[]>([]);
  const [cycles, setCycles] = useState<string[]>([]);

  // States สำหรับฟอร์มหลัก
  const [showModal, setShowModal] = useState(false);
  const [editingPlot, setEditingPlot] = useState<Plot | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formAreaRai, setFormAreaRai] = useState<number | ''>('');
  const [formVariety, setFormVariety] = useState('');
  const [formCycle, setFormCycle] = useState('');
  const [formStatus, setFormStatus] = useState<'growing' | 'ready' | 'harvesting' | 'resting'>('growing');

  // States สำหรับ Custom Popups แบบต่างๆ
  const [popup, setPopup] = useState({ show: false, type: '', message: '' });
  const [deleteDialog, setDeleteDialog] = useState({ show: false, id: '', code: '' });
  const [promptDialog, setPromptDialog] = useState<{ show: boolean, category: 'variety' | 'cycle', value: string }>({ show: false, category: 'variety', value: '' });

  const fetchData = async () => {
    const { data: plotsData } = await supabase.from('plots').select('*').order('code', { ascending: true });
    if (plotsData) {
      setPlots(plotsData.map((d: any) => ({
        id: d.id, code: d.code, area_rai: Number(d.area_rai),
        variety: d.variety, cycle: d.cycle, status: d.status, last_updated: d.last_updated
      })));
    }

    const { data: optionsData } = await supabase.from('plot_options').select('*');
    if (optionsData) {
      const v = optionsData.filter(d => d.category === 'variety').map(d => d.label);
      const c = optionsData.filter(d => d.category === 'cycle').map(d => d.label);
      setVarieties(v);
      setCycles(c);
      
      if (!editingPlot && v.length > 0) setFormVariety(v[0]);
      if (!editingPlot && c.length > 0) setFormCycle(c[0]);
    }
    setLoading(false);
  };

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push('/login');
      else fetchData();
    }
    checkAuth();
  }, [router]);

  const openPromptDialog = (category: 'variety' | 'cycle') => {
    setPromptDialog({ show: true, category, value: '' });
  };

  const executeAddOption = async () => {
    const { category, value } = promptDialog;
    const cleanLabel = value.trim();

    if (!cleanLabel) {
      setPromptDialog({ ...promptDialog, show: false });
      return;
    }

    if (category === 'variety' && varieties.includes(cleanLabel)) {
      setPopup({ show: true, type: 'error', message: 'มีสายพันธุ์อ้อยนี้ในระบบอยู่แล้วครับ' });
      return;
    }
    if (category === 'cycle' && cycles.includes(cleanLabel)) {
      setPopup({ show: true, type: 'error', message: 'มีรอบการปลูกนี้ในระบบอยู่แล้วครับ' });
      return;
    }

    const { error } = await supabase.from('plot_options').insert([{ category, label: cleanLabel }]);
    
    if (error) {
      setPopup({ show: true, type: 'error', message: 'เกิดข้อผิดพลาดในการบันทึก: ' + error.message });
    } else {
      if (category === 'variety') {
        setVarieties([...varieties, cleanLabel]);
        setFormVariety(cleanLabel);
      } else {
        setCycles([...cycles, cleanLabel]);
        setFormCycle(cleanLabel);
      }
      setPromptDialog({ show: false, category: 'variety', value: '' });
    }
  };

  const openAddModal = () => {
    setEditingPlot(null);
    setFormCode('');
    setFormAreaRai('');
    setFormVariety(varieties.length > 0 ? varieties[0] : '');
    setFormCycle(cycles.length > 0 ? cycles[0] : '');
    setFormStatus('growing');
    setShowModal(true);
  };

  const openEditModal = (plot: Plot) => {
    setEditingPlot(plot);
    setFormCode(plot.code);
    setFormAreaRai(plot.area_rai);
    setFormVariety(plot.variety);
    setFormCycle(plot.cycle);
    setFormStatus(plot.status);
    setShowModal(true);
  };

  const handleSavePlot = async () => {
    if (!formCode.trim() || !formAreaRai || formAreaRai <= 0) {
      setPopup({ show: true, type: 'error', message: 'กรุณาระบุรหัสแปลงและขนาดพื้นที่ให้ถูกต้อง' }); return;
    }

    setSaving(true);
    const plotData = {
      code: formCode.toUpperCase().trim(),
      area_rai: Number(formAreaRai),
      variety: formVariety,
      cycle: formCycle,
      status: formStatus,
      last_updated: new Date().toISOString()
    };

    try {
      if (editingPlot) {
        const { error } = await supabase.from('plots').update(plotData).eq('id', editingPlot.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('plots').insert([plotData]);
        if (error) throw error;
      }
      setShowModal(false);
      setPopup({ show: true, type: 'success', message: 'บันทึกข้อมูลแปลงอ้อยเรียบร้อยแล้ว!' });
      fetchData(); 
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: `เกิดข้อผิดพลาด: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  const requestDeletePlot = (id: string, code: string) => {
    setDeleteDialog({ show: true, id, code });
  };

  const executeDeletePlot = async () => {
    const { id, code } = deleteDialog;
    const { error } = await supabase.from('plots').delete().eq('id', id);
    
    setDeleteDialog({ show: false, id: '', code: '' }); 
    
    if (!error) {
      setPopup({ show: true, type: 'success', message: `ลบแปลง ${code} ออกจากระบบแล้ว` });
      fetchData();
    } else {
      setPopup({ show: true, type: 'error', message: 'ไม่สามารถลบได้: ' + error.message });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'growing': return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold whitespace-nowrap">🌱 กำลังเติบโต</span>;
      case 'ready': return <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold whitespace-nowrap">🌾 รอเก็บเกี่ยว</span>;
      case 'harvesting': return <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold whitespace-nowrap">🚜 กำลังตัด</span>;
      case 'resting': return <span className="px-3 py-1 bg-stone-200 text-stone-600 rounded-full text-xs font-bold whitespace-nowrap">💤 พักดิน</span>;
      default: return null;
    }
  };

  if (loading) return <div className="min-h-screen bg-[#FCFBF7] flex items-center justify-center"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#FCFBF7] pb-24 font-sans relative">
      
      {/* 🌟 อัปเกรด Header รองรับมือถือ (จัดเรียงแนวตั้งเมื่อจอแคบ) 🌟 */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button onClick={() => router.push('/')} className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors shrink-0">
              <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-stone-800 leading-tight">จัดการข้อมูลแปลงพื้นที่</h1>
              <p className="text-[11px] sm:text-xs text-stone-500 mt-0.5">บันทึกข้อมูลแปลง ขนาดไร่ และสายพันธุ์จริง</p>
            </div>
          </div>
          <button 
            onClick={openAddModal} 
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 sm:py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center transition-all active:scale-95 shrink-0"
          >
            <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            <span>เพิ่มแปลงใหม่</span>
          </button>
        </div>
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 mt-4 sm:mt-8">
        
        {/* สรุปข้อมูลภาพรวม (ปรับ Padding ให้เหมาะกับจอเล็ก) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white p-3 sm:p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mr-2.5 sm:mr-4 shrink-0">
               <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </div>
            <div className="truncate">
              <p className="text-[10px] sm:text-xs text-stone-500 font-bold uppercase truncate">จำนวนแปลง</p>
              <h3 className="text-base sm:text-2xl font-black text-stone-800 truncate">{plots.length} แปลง</h3>
            </div>
          </div>
          <div className="bg-white p-3 sm:p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 mr-2.5 sm:mr-4 shrink-0">
               <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
            </div>
            <div className="truncate">
              <p className="text-[10px] sm:text-xs text-stone-500 font-bold uppercase truncate">พื้นที่รวม (ไร่)</p>
              <h3 className="text-base sm:text-2xl font-black text-amber-600 truncate">{plots.reduce((sum, plot) => sum + plot.area_rai, 0).toLocaleString()} ไร่</h3>
            </div>
          </div>
        </div>

        <h2 className="text-base sm:text-lg font-bold text-stone-800 mb-4 flex items-center">
          <span className="w-1.5 h-5 sm:h-6 bg-emerald-500 rounded-full mr-2"></span>
          ข้อมูลแปลงอ้อยรายแปลง
        </h2>

        {/* รายการแปลงอ้อย (ยืดหยุ่นตามขนาดหน้าจอ) */}
        {plots.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {plots.map((plot) => (
              <div key={plot.id} className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="bg-stone-50 px-4 py-3.5 sm:px-5 sm:py-4 border-b border-stone-100 flex justify-between items-center gap-2">
                  <div className="flex items-center min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-100 text-emerald-700 font-black rounded-xl flex items-center justify-center mr-2.5 sm:mr-3 shrink-0">
                      {plot.code.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-stone-800 truncate">แปลง {plot.code}</h3>
                      <p className="text-[10px] sm:text-[11px] text-stone-400 truncate">อัปเดต: {new Date(plot.last_updated).toLocaleDateString('th-TH', {day: 'numeric', month: 'short', year: '2-digit'})}</p>
                    </div>
                  </div>
                  <div className="shrink-0">{getStatusBadge(plot.status)}</div>
                </div>
                
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-stone-50">
                    <span className="text-xs sm:text-sm text-stone-500">ขนาดพื้นที่</span>
                    <span className="text-sm sm:text-base font-bold text-stone-800">{plot.area_rai.toLocaleString()} ไร่</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-stone-50 gap-2">
                    <span className="text-xs sm:text-sm text-stone-500 shrink-0">สายพันธุ์อ้อย</span>
                    <span className="text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded truncate">{plot.variety}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-xs sm:text-sm text-stone-500 shrink-0">รอบการปลูก</span>
                    <span className="text-xs sm:text-sm font-medium text-stone-800 truncate">{plot.cycle}</span>
                  </div>
                </div>

                <div className="px-4 py-3 sm:px-5 bg-stone-50/50 border-t border-stone-100 flex justify-between">
                   <button onClick={() => openEditModal(plot)} className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                     ⚙️ แก้ไข
                   </button>
                   <button onClick={() => requestDeletePlot(plot.id, plot.code)} className="text-xs sm:text-sm font-bold text-stone-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                     🗑️ ลบแปลง
                   </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 sm:py-16 bg-white rounded-2xl sm:rounded-3xl border-2 border-stone-200 border-dashed px-4">
            <p className="text-stone-400 text-sm sm:text-base font-bold">ยังไม่มีข้อมูลแปลงพื้นที่ในระบบ กรุณากดปุ่มเพิ่มแปลงด้านบนครับ</p>
          </div>
        )}

      </div>

      {/* ======================================================= */}
      {/* 🌟 POPUP หลัก: ลงทะเบียน / แก้ไขข้อมูลแปลงอ้อย (Responsive Form) 🌟 */}
      {/* ======================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowModal(false)}></div>
          
          <div className="bg-white w-full max-w-md rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-black text-stone-800 flex items-center gap-2">
                <span>🚜</span> {editingPlot ? `แก้ไขข้อมูล แปลง ${editingPlot.code}` : 'ลงทะเบียนแปลงอ้อยใหม่'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600 bg-stone-100 w-8 h-8 rounded-full flex items-center justify-center font-bold">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block">รหัสแปลงอ้อย (เช่น A-01, B-05)</label>
                <input type="text" value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="กรอกรหัสแปลง..." className="w-full px-4 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none uppercase focus:ring-2 focus:ring-emerald-500 text-sm" />
              </div>

              {/* 🌟 ปรับปรุง: เปลี่ยนจากแนวนอนตายตัวเป็นคอลัมน์แนวดิ่งบนจอเล็ก 🌟 */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-1/2">
                  <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block">ขนาดพื้นที่ (ไร่)</label>
                  <input type="number" min="0" value={formAreaRai} onChange={(e) => setFormAreaRai(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className="w-full px-4 py-2.5 sm:py-3 bg-white border border-stone-300 rounded-xl text-emerald-700 font-black focus:ring-2 focus:ring-emerald-500 outline-none text-base sm:text-lg text-left sm:text-right" />
                </div>
                
                <div className="w-full sm:w-1/2">
                  <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block">สายพันธุ์อ้อย</label>
                  <div className="flex gap-2">
                    <select value={formVariety} onChange={(e) => setFormVariety(e.target.value)} className="flex-1 px-3 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm truncate">
                      {varieties.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <button type="button" onClick={() => openPromptDialog('variety')} title="เพิ่มสายพันธุ์ใหม่" className="bg-emerald-100 text-emerald-700 px-3.5 rounded-xl font-black text-xl hover:bg-emerald-200 transition-colors shrink-0">+</button>
                  </div>
                </div>
              </div>

              {/* 🌟 ปรับปรุง: รอบการปลูก & สถานะ ให้กางแถวเรียงแนวดิ่งบนมือถือเหมือนกัน 🌟 */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-1/2">
                  <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block">รอบการปลูก</label>
                  <div className="flex gap-2">
                    <select value={formCycle} onChange={(e) => setFormCycle(e.target.value)} className="flex-1 px-3 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm truncate">
                      {cycles.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" onClick={() => openPromptDialog('cycle')} title="เพิ่มรอบการปลูกใหม่" className="bg-emerald-100 text-emerald-700 px-3.5 rounded-xl font-black text-xl hover:bg-emerald-200 transition-colors shrink-0">+</button>
                  </div>
                </div>
                
                <div className="w-full sm:w-1/2">
                  <label className="text-xs font-bold text-stone-500 uppercase mb-1.5 block">สถานะแปลง</label>
                  <select value={formStatus} onChange={(e: any) => setFormStatus(e.target.value)} className="w-full px-3 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm">
                    <option value="growing">🌱 กำลังเติบโต</option>
                    <option value="ready">🌾 รอเก็บเกี่ยว</option>
                    <option value="harvesting">🚜 กำลังตัด</option>
                    <option value="resting">💤 พักดิน</option>
                  </select>
                </div>
              </div>
            </div>

            <button onClick={handleSavePlot} disabled={saving} className={`w-full mt-6 sm:mt-8 py-3.5 sm:py-4 rounded-xl font-black text-white text-base sm:text-lg shadow-lg transition-all ${saving ? 'bg-stone-300' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-emerald-500/20'}`}>
              {saving ? 'กำลังบันทึกข้อมูล...' : '💾 บันทึกข้อมูลแปลงพื้นที่'}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 CUSTOM PROMPT (เพิ่มสายพันธุ์/รอบการปลูกใหม่) 🌟 */}
      {/* ======================================================= */}
      {promptDialog.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPromptDialog({ ...promptDialog, show: false })}></div>
          <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base sm:text-xl font-black text-stone-800 mb-2">
              ➕ เพิ่ม{promptDialog.category === 'variety' ? 'สายพันธุ์อ้อย' : 'รอบการปลูก'}
            </h3>
            <p className="text-xs sm:text-sm text-stone-500 mb-4 leading-relaxed">กรุณาพิมพ์ชื่อใหม่ที่ต้องการเพิ่มลงในระบบ</p>
            <input 
              type="text" 
              autoFocus
              value={promptDialog.value} 
              onChange={(e) => setPromptDialog({ ...promptDialog, value: e.target.value })} 
              className="w-full px-4 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-bold focus:ring-2 focus:ring-emerald-500 outline-none mb-5 text-sm"
              placeholder={`พิมพ์${promptDialog.category === 'variety' ? 'สายพันธุ์อ้อย' : 'รอบการปลูก'}...`}
            />
            <div className="flex gap-3">
              <button onClick={() => setPromptDialog({ ...promptDialog, show: false })} className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold rounded-xl transition-colors text-sm">ยกเลิก</button>
              <button onClick={executeAddOption} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-md shadow-emerald-500/20 text-sm">บันทึกชื่อใหม่</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 CUSTOM CONFIRM DELETE (ยืนยันการลบถาวร) 🌟 */}
      {/* ======================================================= */}
      {deleteDialog.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDeleteDialog({ show: false, id: '', code: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 shrink-0">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-stone-800 mb-2">ยืนยันการลบข้อมูล</h3>
            <p className="text-xs sm:text-sm text-stone-500 mb-5 leading-relaxed">ต้องการลบข้อมูล <strong>แปลง {deleteDialog.code}</strong> ใช่หรือไม่?<br/>(ข้อมูลที่ลบแล้วจะไม่สามารถกู้คืนได้)</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteDialog({ show: false, id: '', code: '' })} className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold rounded-xl transition-colors text-sm">ยกเลิก</button>
              <button onClick={executeDeletePlot} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-md shadow-red-500/20 text-sm">ลบถาวร</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 CUSTOM POPUP (แจ้งเตือนสถานะความสำเร็จ / ขัดข้อง) 🌟 */}
      {/* ======================================================= */}
      {popup.show && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-xs animate-in fade-in" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 text-center border border-stone-100">
            {popup.type === 'success' ? (
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              </div>
            ) : (
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
            )}
            <h3 className="text-base sm:text-lg font-black text-stone-800 mb-2">{popup.type === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}</h3>
            <p className="text-xs sm:text-sm text-stone-500 mb-5 leading-relaxed">{popup.message}</p>
            <button onClick={() => setPopup({ show: false, type: '', message: '' })} className={`w-full py-2.5 font-bold rounded-xl text-white shadow-md text-sm ${popup.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}>
              ตกลง
            </button>
          </div>
        </div>
      )}

    </div>
  );
}