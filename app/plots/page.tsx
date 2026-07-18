'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import dynamic from 'next/dynamic';

// ==========================================
// 🗺️ ระบบแผนที่ Google Satellite + เปลี่ยนไอคอน GPS + ค้นหาด้วยพิกัด
// ==========================================
const MapComponent = ({ onAreaCalculated }: { onAreaCalculated: (rai: number) => void }) => {
  const L = require('leaflet');
  const { MapContainer, TileLayer, FeatureGroup, useMap } = require('react-leaflet');
  const { EditControl } = require('react-leaflet-draw');

  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });

  const onCreated = (e: any) => {
    const layer = e.layer;
    if (layer.getLatLngs) {
      const latlngs = layer.getLatLngs()[0];
      const areaSqm = L.GeometryUtil.geodesicArea(latlngs);
      const areaRai = (areaSqm / 1600).toFixed(2);
      onAreaCalculated(Number(areaRai));
    }
  };

  const SearchControl = () => {
    const map = useMap();
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;
      setIsSearching(true);

      // 🌟 ตรวจสอบว่าข้อความที่ค้นหาเป็นพิกัดละติจูด,ลองติจูด หรือไม่?
      const coordsMatch = query.trim().match(/^-?\d+(\.\d+)?[\s,]+-?\d+(\.\d+)?$/);

      if (coordsMatch) {
        // ถ้าเป็นตัวเลขพิกัด ให้จับแยกและบินไปจุดนั้นทันที
        const parts = query.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);

        map.flyTo([lat, lon], 16, { animate: true, duration: 1.5 });
        setIsSearching(false);
        return; 
      }

      // 🌟 ถ้าไม่ใช่ตัวเลขพิกัด ค่อยค้นหาด้วยชื่อผ่าน API
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Thailand')}`);
        const data = await res.json();
        
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          map.flyTo([lat, lon], 14, { animate: true, duration: 1.5 });
        } else {
          alert('ไม่พบสถานที่ กรุณาลองพิมพ์ชื่อ อำเภอ หรือ จังหวัด ใหม่อีกครั้งครับ');
        }
      } catch (error) {
        console.error(error);
        alert('ระบบค้นหามีปัญหา กรุณาลองใหม่');
      } finally {
        setIsSearching(false);
      }
    };

    const handleGetLocation = () => {
      map.locate().on("locationfound", (e: any) => {
        map.flyTo(e.latlng, 16, { animate: true, duration: 1.5 });
      }).on("locationerror", () => {
        alert("ไม่สามารถระบุตำแหน่งได้ กรุณาเปิดการอนุญาต GPS ในเบราว์เซอร์ครับ");
      });
    };

    return (
      <div className="leaflet-top leaflet-left" style={{ top: '15px', left: '50px', position: 'absolute', pointerEvents: 'auto' }}>
        <div className="flex flex-col sm:flex-row gap-2">
          <form onSubmit={handleSearch} className="bg-white rounded-xl shadow-lg border border-slate-200 flex items-center overflow-hidden w-[240px] sm:w-[320px] transition-all focus-within:ring-2 focus-within:ring-emerald-500">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="พิกัด (Lat, Lon) หรือ ชื่อสถานที่..." 
              className="w-full px-4 py-2.5 text-sm font-bold text-slate-800 outline-none bg-transparent placeholder-slate-400"
            />
            <button 
              type="submit" 
              disabled={isSearching}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 flex items-center justify-center transition-colors border-l border-emerald-600"
            >
              {isSearching ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              )}
            </button>
          </form>

          {/* 🌟 ไอคอนเป้าเล็ง GPS แบบ Google Maps */}
          <button 
            type="button" 
            onClick={handleGetLocation} 
            className="bg-white hover:bg-slate-50 text-blue-600 border border-slate-200 shadow-lg rounded-xl w-[44px] h-[44px] flex items-center justify-center transition-colors group"
            title="ไปที่ตำแหน่งปัจจุบันของฉัน"
          >
            <svg className="w-[22px] h-[22px] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" fill="currentColor" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v3m0 14v3m10-10h-3M5 12H2m18 0a8 8 0 11-16 0 8 8 0 0116 0z" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // 🌟 URL ของ Google Maps Satellite Hybrid (ภาพดาวเทียม + เส้นถนน/ป้ายชื่อสถานที่)
  const googleSatelliteUrl = "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css" />
      <MapContainer center={[13.736717, 100.523186]} zoom={6} style={{ height: '100%', width: '100%', zIndex: 10 }}>
        
        <SearchControl />

        {/* 🌟 แสดงแผนที่ดาวเทียมของ Google Maps */}
        <TileLayer
          url={googleSatelliteUrl}
          attribution="&copy; Google Maps"
          maxZoom={20} // Google อนุญาตให้ซูมได้ลึกกว่า GISTDA (จาก 19 เป็น 20)
        />
        
        <FeatureGroup>
          <EditControl
            position="topright"
            onCreated={onCreated}
            draw={{
              rectangle: false,
              circle: false,
              circlemarker: false,
              marker: false,
              polyline: false,
              polygon: {
                allowIntersection: false,
                drawError: { color: '#e1e100', message: 'เส้นตัดกันไม่ได้!' },
                shapeOptions: { color: '#10b981', fillColor: '#10b981', fillOpacity: 0.5, weight: 3 }
              }
            }}
          />
        </FeatureGroup>
      </MapContainer>
    </>
  );
};

const DynamicMap = dynamic(() => Promise.resolve(MapComponent), { ssr: false });

// ==========================================
// 🚀 คอมโพเนนต์หลัก (Main Page)
// ==========================================
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

  const [showModal, setShowModal] = useState(false);
  const [editingPlot, setEditingPlot] = useState<Plot | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formAreaRai, setFormAreaRai] = useState<number | ''>('');
  const [formVariety, setFormVariety] = useState('');
  const [formCycle, setFormCycle] = useState('');
  const [formStatus, setFormStatus] = useState<'growing' | 'ready' | 'harvesting' | 'resting'>('growing');

  const [popup, setPopup] = useState({ show: false, type: '', message: '' });
  const [deleteDialog, setDeleteDialog] = useState({ show: false, id: '', code: '' });
  const [promptDialog, setPromptDialog] = useState<{ show: boolean, category: 'variety' | 'cycle', value: string }>({ show: false, category: 'variety', value: '' });
  
  const [mapConfirmDialog, setMapConfirmDialog] = useState({ show: false, rai: 0 });

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

  const handleMapAreaCalculated = (rai: number) => {
    setMapConfirmDialog({ show: true, rai });
  };

  const confirmCreatePlotFromMap = () => {
    const rai = mapConfirmDialog.rai;
    setMapConfirmDialog({ show: false, rai: 0 }); 
    
    setEditingPlot(null);
    setFormCode('');
    setFormAreaRai(rai); 
    setFormVariety(varieties.length > 0 ? varieties[0] : '');
    setFormCycle(cycles.length > 0 ? cycles[0] : '');
    setFormStatus('growing');
    setShowModal(true); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      case 'growing': return <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black whitespace-nowrap shadow-sm">🌱 กำลังเติบโต</span>;
      case 'ready': return <span className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-black whitespace-nowrap shadow-sm">🌾 รอเก็บเกี่ยว</span>;
      case 'harvesting': return <span className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-black whitespace-nowrap shadow-sm">🚜 กำลังตัด</span>;
      case 'resting': return <span className="px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-black whitespace-nowrap shadow-sm">💤 พักดิน</span>;
      default: return null;
    }
  };

  if (loading) return <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24 font-sans relative selection:bg-emerald-500 selection:text-white">
      
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => router.push('/')} className="group w-10 h-10 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm">
              <svg className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div className="h-8 w-px bg-slate-200 hidden sm:block mx-1"></div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">จัดการข้อมูลแปลงพื้นที่</h1>
                <p className="text-[11px] font-bold text-slate-500 leading-none hidden sm:block uppercase tracking-wider">
                  บันทึกและติดตามข้อมูลแปลง สายพันธุ์ และรอบปลูก
                </p>
              </div>
            </div>
          </div>
          
          <button 
            onClick={openAddModal} 
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white px-6 py-3.5 sm:py-2.5 rounded-xl text-sm font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center transition-all shrink-0"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
            <span>เพิ่มแปลงใหม่</span>
          </button>
        </div>
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 mt-6 sm:mt-8">
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="bg-white p-5 rounded-[20px] border border-slate-200 shadow-sm flex items-center relative overflow-hidden">
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-600 mr-4 shrink-0 relative z-10">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" /></svg>
            </div>
            <div className="truncate relative z-10">
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest truncate mb-0.5">จำนวนแปลงทั้งหมด</p>
              <h3 className="text-2xl font-black text-slate-900 truncate tabular-nums">{plots.length} <span className="text-xs text-slate-400 font-bold">แปลง</span></h3>
            </div>
          </div>

          <div className="md:col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-500 to-green-600 p-5 rounded-[20px] shadow-lg shadow-emerald-500/20 flex items-center relative overflow-hidden text-white">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white mr-4 shrink-0 relative z-10 backdrop-blur-sm">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
            </div>
            <div className="truncate relative z-10">
              <p className="text-[11px] text-emerald-100 font-bold uppercase tracking-widest truncate mb-0.5">พื้นที่รวมทั้งหมด</p>
              <h3 className="text-2xl font-black truncate tabular-nums">{plots.reduce((sum, plot) => sum + plot.area_rai, 0).toLocaleString()} <span className="text-xs text-emerald-200 font-bold">ไร่</span></h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden mb-10 flex flex-col relative">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white z-20 relative">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                แผนที่ดาวเทียม <span className="hidden sm:inline">(Google Maps)</span>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">ค้นหาสถานที่ หรือกดไอคอนห้าเหลี่ยม ⬟ มุมขวาบนเพื่อวาดแปลง</p>
              </div>
            </h2>
            <div className="flex gap-2">
              <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 shadow-sm">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[11px] font-black">พร้อมใช้งาน</span>
              </div>
            </div>
          </div>
          
          <div className="w-full h-[450px] sm:h-[550px] bg-slate-100 relative">
            <DynamicMap onAreaCalculated={handleMapAreaCalculated} />
          </div>
        </div>

        <h2 className="text-base font-black text-slate-900 mb-5 flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
          ข้อมูลแปลงอ้อยรายแปลง
        </h2>

        {plots.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 mb-16">
            {plots.map((plot) => (
              <div key={plot.id} className="bg-white rounded-[20px] border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col group">
                
                <div className="bg-white px-5 py-4 border-b border-slate-100 flex justify-between items-center gap-2">
                  <div className="flex items-center min-w-0">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 border border-emerald-100 font-black text-lg rounded-xl flex items-center justify-center mr-3 shrink-0 shadow-sm">
                      {plot.code.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-slate-900 truncate">แปลง {plot.code}</h3>
                      <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                        อัปเดต: {new Date(plot.last_updated).toLocaleDateString('th-TH', {day: '2-digit', month: 'short', year: '2-digit'})}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-5 space-y-4 grow bg-slate-50/30">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100/80">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ขนาดพื้นที่</span>
                    <span className="text-[15px] font-black text-slate-800">{plot.area_rai.toLocaleString()} <span className="text-[11px] text-slate-500">ไร่</span></span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100/80 gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">สายพันธุ์</span>
                    <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md truncate">{plot.variety}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100/80 gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">รอบปลูก</span>
                    <span className="text-[12px] font-black text-slate-700 truncate">{plot.cycle}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">สถานะ</span>
                    <div className="shrink-0">{getStatusBadge(plot.status)}</div>
                  </div>
                </div>

                <div className="px-3 py-3 bg-white border-t border-slate-100 flex gap-2">
                   <button onClick={() => openEditModal(plot)} className="flex-1 py-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center justify-center gap-1.5">
                     <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                     แก้ไข
                   </button>
                   <button onClick={() => requestDeletePlot(plot.id, plot.code)} className="flex-1 py-2.5 bg-slate-50 hover:bg-rose-50 border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center justify-center gap-1.5">
                     <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                     ลบ
                   </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[24px] border border-slate-200 shadow-sm px-4">
            <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-1">ยังไม่มีข้อมูลแปลง</h3>
            <p className="text-slate-500 text-sm font-bold">กรุณากดปุ่มเพิ่มแปลงใหม่ด้านบนเพื่อเริ่มบันทึกข้อมูลครับ</p>
          </div>
        )}

      </div>

      {mapConfirmDialog.show && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setMapConfirmDialog({ show: false, rai: 0 })}></div>
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 sm:p-8 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">คำนวณพื้นที่สำเร็จ</h3>
            <p className="text-[13px] font-bold text-slate-500 mb-8 px-2 leading-relaxed">
              ระบบคำนวณพื้นที่ได้ประมาณ <strong className="text-emerald-600 text-base">{mapConfirmDialog.rai}</strong> ไร่<br/>ต้องการนำไปสร้างเป็นแปลงใหม่หรือไม่?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setMapConfirmDialog({ show: false, rai: 0 })} className="flex-1 py-3 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors text-[13px] shadow-sm">ยกเลิก</button>
              <button onClick={confirmCreatePlotFromMap} className="flex-[1.5] py-3 bg-emerald-600 border border-emerald-700 text-white font-black rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-500/30 active:scale-[0.98] transition-all text-[13px]">
                สร้างแปลงใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowModal(false)}></div>
          
          <div className="bg-white w-full max-w-lg rounded-[24px] shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[95vh] border border-slate-200">
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-green-600 shrink-0"></div>
            
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                </div>
                {editingPlot ? `แก้ไขแปลง ${editingPlot.code}` : 'ลงทะเบียนแปลงใหม่'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors">✕</button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar bg-white space-y-5">
              
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="w-full sm:w-1/2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 block ml-1">รหัสแปลงอ้อย</label>
                  <input type="text" value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="เช่น A-01, B-05" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-emerald-700 outline-none focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm shadow-sm transition-all uppercase" />
                </div>
                <div className="w-full sm:w-1/2">
                  <label className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-wider mb-2 inline-block ml-1">ขนาดพื้นที่ (ไร่)</label>
                  <div className="relative">
                    <input type="number" min="0" value={formAreaRai} onChange={(e) => setFormAreaRai(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className="w-full pl-4 pr-10 py-3.5 bg-white border-2 border-slate-300 rounded-xl font-black text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm shadow-inner transition-all tabular-nums text-right" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">ไร่</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-5">
                <div className="w-full sm:w-1/2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 block ml-1">สายพันธุ์อ้อย</label>
                  <div className="flex gap-2">
                    <select value={formVariety} onChange={(e) => setFormVariety(e.target.value)} className="flex-1 px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold outline-none focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm shadow-sm transition-all appearance-none cursor-pointer truncate">
                      {varieties.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <button type="button" onClick={() => openPromptDialog('variety')} title="เพิ่มสายพันธุ์ใหม่" className="bg-white border border-emerald-200 text-emerald-600 px-4 rounded-xl font-black text-lg hover:bg-emerald-50 hover:border-emerald-300 transition-colors shrink-0 shadow-sm">+</button>
                  </div>
                </div>
                
                <div className="w-full sm:w-1/2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 block ml-1">รอบการปลูก</label>
                  <div className="flex gap-2">
                    <select value={formCycle} onChange={(e) => setFormCycle(e.target.value)} className="flex-1 px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold outline-none focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm shadow-sm transition-all appearance-none cursor-pointer truncate">
                      {cycles.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" onClick={() => openPromptDialog('cycle')} title="เพิ่มรอบการปลูกใหม่" className="bg-white border border-emerald-200 text-emerald-600 px-4 rounded-xl font-black text-lg hover:bg-emerald-50 hover:border-emerald-300 transition-colors shrink-0 shadow-sm">+</button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 block ml-1">สถานะแปลงปัจจุบัน</label>
                <select value={formStatus} onChange={(e: any) => setFormStatus(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold outline-none focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm shadow-sm transition-all appearance-none cursor-pointer">
                  <option value="growing">🌱 กำลังเติบโต (กำลังบำรุง)</option>
                  <option value="ready">🌾 รอเก็บเกี่ยว (อ้อยสุก)</option>
                  <option value="harvesting">🚜 กำลังตัด (หน้างาน)</option>
                  <option value="resting">💤 พักดิน (ไถกลบ/เตรียมแปลง)</option>
                </select>
              </div>

            </div>

            <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 flex gap-3 sm:gap-4 shrink-0 rounded-b-[24px]">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-bold rounded-xl text-sm sm:text-[15px] transition-colors shadow-sm">
                ยกเลิก
              </button>
              <button onClick={handleSavePlot} disabled={saving} className={`flex-[2] py-3.5 rounded-xl font-black text-white text-sm sm:text-[15px] shadow-lg transition-all border flex items-center justify-center gap-2 ${saving ? 'bg-slate-400 border-slate-400 shadow-none cursor-not-allowed' : 'bg-emerald-600 border-emerald-700 hover:bg-emerald-500 active:scale-[0.98] shadow-emerald-600/30'}`}>
                {saving ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> บันทึก...</>
                ) : '💾 ยืนยันบันทึกข้อมูล'}
              </button>
            </div>
          </div>
        </div>
      )}

      {promptDialog.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPromptDialog({ ...promptDialog, show: false })}></div>
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 sm:p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              เพิ่ม{promptDialog.category === 'variety' ? 'สายพันธุ์อ้อย' : 'รอบการปลูก'}
            </h3>
            <p className="text-[12px] font-bold text-slate-500 mb-6">พิมพ์ชื่อ{promptDialog.category === 'variety' ? 'สายพันธุ์' : 'รอบการปลูก'}ใหม่ที่ต้องการเพิ่มลงในระบบ</p>
            <input 
              type="text" 
              autoFocus
              value={promptDialog.value} 
              onChange={(e) => setPromptDialog({ ...promptDialog, value: e.target.value })} 
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none mb-6 text-sm shadow-sm transition-all"
              placeholder={`เช่น ${promptDialog.category === 'variety' ? 'ขอนแก่น 3' : 'ตอ 2'}...`}
            />
            <div className="flex gap-3">
              <button onClick={() => setPromptDialog({ ...promptDialog, show: false })} className="flex-1 py-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition-colors text-[13px] shadow-sm">ยกเลิก</button>
              <button onClick={executeAddOption} className="flex-[1.5] py-3 bg-emerald-600 border border-emerald-700 hover:bg-emerald-500 text-white font-black rounded-xl transition-all shadow-md shadow-emerald-500/30 active:scale-[0.98] text-[13px]">บันทึกเพิ่ม</button>
            </div>
          </div>
        </div>
      )}

      {deleteDialog.show && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDeleteDialog({ show: false, id: '', code: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 sm:p-8 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">ยืนยันการลบข้อมูล</h3>
            <p className="text-[13px] font-bold text-slate-500 mb-8 px-2 leading-relaxed">
              ต้องการลบ <strong>แปลง {deleteDialog.code}</strong> ใช่หรือไม่?<br/>ข้อมูลที่ลบแล้วจะไม่สามารถกู้คืนได้
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteDialog({ show: false, id: '', code: '' })} className="flex-1 py-3 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors text-[13px] shadow-sm">ยกเลิก</button>
              <button onClick={executeDeletePlot} disabled={saving} className="flex-1 py-3 bg-rose-600 border border-rose-700 text-white font-black rounded-xl hover:bg-rose-700 shadow-md shadow-rose-500/30 active:scale-[0.98] transition-all text-[13px]">
                {saving ? 'กำลังลบ...' : 'ลบถาวร'}
              </button>
            </div>
          </div>
        </div>
      )}

      {popup.show && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-[24px] p-8 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 border ${
              popup.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'
            }`}>
              {popup.type === 'success' ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              )}
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">{popup.type === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}</h3>
            <p className="text-[13px] font-bold text-slate-500 mb-8 leading-relaxed px-2">{popup.message}</p>
            <button onClick={() => setPopup({ show: false, type: '', message: '' })} className={`w-full py-3.5 font-black rounded-xl text-white shadow-md text-[13px] border transition-colors active:scale-[0.98] ${
              popup.type === 'success' ? 'bg-emerald-600 border-emerald-700 hover:bg-emerald-700 shadow-emerald-600/30' : 'bg-rose-600 border-rose-700 hover:bg-rose-700 shadow-rose-600/30'
            }`}>
              ตกลงรับทราบ
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .leaflet-top.leaflet-left {
          z-index: 1000 !important;
        }
      `}</style>
    </div>
  );
}