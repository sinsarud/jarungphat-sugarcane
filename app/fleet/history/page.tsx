'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

// =========================================================================
// 🗺️ ระบบแผนที่ Leaflet (รองรับ Polyline เส้นทาง, ปักหมุดจุดจอด & Fit Bounds)
// ==========================================
const MapHistoryComponent = ({ 
  historyData, 
  mode, 
  selectedPoint, 
  onSelectPoint 
}: { 
  historyData: any[], 
  mode: 'history' | 'parking', 
  selectedPoint: any | null, 
  onSelectPoint: (point: any) => void 
}) => {
  const L = require('leaflet');
  const { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } = require('react-leaflet');

  // ฟังก์ชันควบคุมกล้องแผนที่ (FitBounds & FlyTo)
  const MapController = ({ historyData, selectedPoint }: { historyData: any[], selectedPoint: any | null }) => {
    const map = useMap();
    const hasFittedRef = useRef(false);

    // 1. ถ้ามีการคลิกเลือกจุดจากรายการแถบซ้าย ให้ซูมไปที่จุดนั้น
    useEffect(() => {
      if (selectedPoint && selectedPoint.lat && selectedPoint.lon) {
        map.flyTo([selectedPoint.lat, selectedPoint.lon], 18, { animate: true, duration: 1.2 });
      }
    }, [selectedPoint, map]);

    // 2. ถ้าดึงข้อมูลมาใหม่ ให้ปรับหน้าจอแผนที่ให้เห็นครบทั้งเส้นทางอัตโนมัติ (Fit Bounds)
    useEffect(() => {
      if (historyData && historyData.length > 0) {
        const validPoints = historyData.filter((p: any) => p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon));
        if (validPoints.length > 0) {
          const bounds = L.latLngBounds(validPoints.map((p: any) => [p.lat, p.lon]));
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17, animate: true });
        }
      }
    }, [historyData, map, L]);

    return null;
  };

  // ไอคอนจุดจอดรถ (Stop Icon พร้อมตัวเลขลำดับ)
  const createStopIcon = (index: number, isSelected: boolean) => {
    const scale = isSelected ? 'scale-125 border-red-600 ring-4 ring-red-400/50' : 'border-amber-600';
    return L.divIcon({
      className: 'custom-stop-icon',
      html: `
        <div class="flex flex-col items-center transition-all duration-300">
          <div class="bg-amber-100 border-2 ${scale} text-red-700 font-black text-[10px] px-1.5 py-0.5 rounded-md shadow-md whitespace-nowrap">
            Stop #${index}
          </div>
          <div class="w-3.5 h-3.5 bg-red-600 border-2 border-white rounded-full -mt-1 shadow-md"></div>
        </div>
      `,
      iconSize: [50, 40],
      iconAnchor: [25, 35],
    });
  };

  // ไอคอนจุดเริ่มต้น และ จุดสิ้นสุด
  const createStartEndIcon = (type: 'START' | 'END') => {
    const bg = type === 'START' ? 'bg-emerald-500 border-emerald-700' : 'bg-rose-600 border-rose-800';
    const text = type === 'START' ? 'START' : 'END';
    return L.divIcon({
      className: 'custom-start-end-icon',
      html: `
        <div class="flex flex-col items-center">
          <div class="${bg} text-white font-black text-[9px] px-2 py-0.5 rounded shadow-lg border">
            ${text}
          </div>
          <div class="w-3 h-3 ${bg} border-2 border-white rounded-full -mt-0.5 shadow"></div>
        </div>
      `,
      iconSize: [50, 30],
      iconAnchor: [25, 25],
    });
  };

  // กรองเอาเฉพาะพิกัดที่ถูกต้อง (ไม่เอา 0,0 หรือ NaN)
  const validPoints = historyData.filter((p: any) => p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon));
  const polylineCoords = validPoints.map((p: any) => [p.lat, p.lon]);

  const centerLat = validPoints.length > 0 ? validPoints[0].lat : 13.7850;
  const centerLon = validPoints.length > 0 ? validPoints[0].lon : 100.4150;

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <MapContainer center={[centerLat, centerLon]} zoom={11} style={{ height: '100%', width: '100%', zIndex: 0 }}>
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          maxNativeZoom={20}
          maxZoom={22}
          attribution='&copy; Google Maps'
        />
        <MapController historyData={validPoints} selectedPoint={selectedPoint} />
        
        {/* 🛣️ 1. วาดเส้นทาง Polyline (ถ้าดูโหมด history และมีพิกัดมากกว่า 1 จุด) */}
        {mode === 'history' && polylineCoords.length > 1 && (
          <Polyline 
            positions={polylineCoords} 
            color="#2563eb" 
            weight={5} 
            opacity={0.8} 
            dashArray="1, 5" 
          />
        )}

        {/* 📍 2. ปักหมุดจุดจอด หรือรายการเหตุการณ์ */}
        {validPoints.map((point: any, idx: number) => {
          const isSelected = selectedPoint && (selectedPoint.id === point.id || selectedPoint.time === point.time);
          const stopNumber = validPoints.length - idx; // นับถอยหลังให้จุดล่าสุดเป็นเบอร์สูงสุด หรือจัดตามชอบ

          // กำหนดไอคอน: ถ้าเป็นจุดแรกสุด/ท้ายสุดของเส้นทาง ให้โชว์ Start/End
          let markerIcon = createStopIcon(stopNumber, isSelected);
          if (mode === 'history') {
            if (idx === 0) markerIcon = createStartEndIcon('END'); // ล่าสุดคือจุดสิ้นสุด
            else if (idx === validPoints.length - 1) markerIcon = createStartEndIcon('START'); // เก่าสุดคือจุดเริ่มต้น
            else if (String(point.status).includes('วิ่ง')) return null; // ไม่ต้องปักหมุดทุกพิกัดที่กำลังวิ่ง เพื่อไม่ให้แผนที่รก
          }

          return (
            <Marker 
              key={idx} 
              position={[point.lat, point.lon]} 
              icon={markerIcon}
              eventHandlers={{ click: () => onSelectPoint(point) }}
            >
              <Popup className="custom-popup min-w-[280px]">
                <div className="p-3 font-sans text-slate-700 bg-white rounded-xl shadow-lg border border-slate-100 text-xs space-y-1.5">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 font-black text-slate-800">
                    <span>📍 {mode === 'parking' ? `จุดจอด #Stop ${stopNumber}` : 'บันทึกพิกัด'}</span>
                    <span className="text-[10px] font-bold text-indigo-600 font-mono">{point.time || point.recorded_at}</span>
                  </div>
                  <div className="font-bold text-rose-600">• {point.status || 'จอดรถ'}</div>
                  <div className="text-slate-500 font-medium leading-snug">{point.address || point.location || 'ไม่ระบุที่อยู่'}</div>
                  <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-100 text-[10px] font-bold text-center">
                    <div className="bg-slate-50 p-1 rounded border border-slate-200/60">น้ำมัน: <span className="text-indigo-600">{point.fuel || '0%'}</span></div>
                    <div className="bg-slate-50 p-1 rounded border border-slate-200/60">ความเร็ว: <span className="text-emerald-600">{point.speed || '0'}</span></div>
                    <div className="bg-slate-50 p-1 rounded border border-slate-200/60">อุณหภูมิ: <span className="text-slate-700">{point.temp || '0°C'}</span></div>
                  </div>
                  {point.duration && (
                    <div className="bg-rose-50 text-rose-700 font-black text-[11px] p-1.5 rounded text-center border border-rose-200">
                      ⏱️ ระยะเวลาจอด: {point.duration}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

      </MapContainer>
    </>
  );
};

const DynamicMapHistory = dynamic(() => Promise.resolve(MapHistoryComponent), { ssr: false });

// =========================================================================
// ⚙️ Core Logic: คอมโพเนนต์ทำงานหลัก (ผสาน API ดูดจริง 100%)
// =========================================================================
function HistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlate = searchParams.get('plate'); 

  const [trucks, setTrucks] = useState<any[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<any>(null);
  
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [endTime, setEndTime] = useState('23:59');
  
  const [isLoading, setIsLoading] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalDistance: '0.00', totalDuration: '-', totalStops: 0 });
  const [activeMode, setActiveMode] = useState<'history' | 'parking'>('history');
  
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);

  // 1. ดึงรายชื่อรถทั้งหมดมาใส่ Dropdown
  useEffect(() => {
    const fetchList = async () => {
      try {
        const res = await fetch('/api/fleet');
        const rawData = await res.json();
        let rawArray = rawData.data && Array.isArray(rawData.data) ? rawData.data : (Array.isArray(rawData) ? rawData : Object.values(rawData));
        
        const formatted = rawArray.map((t: any) => ({
          id: t.id,
          plate: t.number || 'ไม่ระบุ',
          imei: t.imei || '867747070163595', // เตรียม IMEI ไว้สำหรับส่งเข้า API History
          lat: parseFloat(t.lat || 13.785),
          lon: parseFloat(t.lng || 100.415),
          address: t.address || 'ต.วัดสุวรรณ อ.บ่อทอง จ.ชลบุรี',
          speed: parseFloat(t.speed || 0),
          lastUpdate: t.lastUpdate || t.time || new Date().toLocaleString()
        }));

        setTrucks(formatted);

        if (initialPlate) {
          const found = formatted.find((t: any) => t.plate === initialPlate);
          if (found) setSelectedTruck(found);
        } else if (formatted.length > 0) {
          setSelectedTruck(formatted[0]);
        }
      } catch (err) {
        console.error('Failed to load truck list:', err);
      }
    };
    fetchList();
  }, [initialPlate]);

  // 🌟 2. ฟังก์ชันยิง API ดึงเส้นทางย้อนหลัง (หรือจุดจอด) จากเซิร์ฟเวอร์จริง!
  const fetchHistoryData = async (mode: 'history' | 'parking') => {
    if (!selectedTruck) return alert('กรุณาเลือกรถที่ต้องการดูประวัติ');
    
    setIsLoading(true);
    setActiveMode(mode);
    setSelectedPoint(null);
    
    try {
      // ยิงไปที่ /api/history ที่เราทำเชื่อม cURL thaigpstracker (หรือ Supabase) ไว้
      const queryParams = new URLSearchParams({
        imei: selectedTruck.imei,
        plate: selectedTruck.plate,
        mode: mode,
        startDate: startDate,
        endDate: endDate,
        startTime: startTime,
        endTime: endTime
      });

      const res = await fetch(`/api/history?${queryParams.toString()}`, { method: 'GET' });
      const result = await res.json();

      if (result.success && result.data && result.data.length > 0) {
        // จัดการแปลงชื่อพิกัดให้เป็น lat, lon พร้อมใช้งาน
        const mappedData = result.data.map((item: any, idx: number) => ({
          ...item,
          id: item.id || idx,
          lat: parseFloat(item.lat || item.latitude || selectedTruck.lat),
          lon: parseFloat(item.lon || item.lng || item.longitude || selectedTruck.lon),
          time: item.time || item.recorded_at || item.datetime || '-',
          status: item.status || (mode === 'parking' ? 'จอดรถ - ดับเครื่อง' : 'กำลังวิ่ง'),
          address: item.address || item.location || selectedTruck.address
        }));

        setHistoryList(mappedData);
        setSummary({
          totalDistance: result.summary?.totalDistance || '0.00',
          totalDuration: result.summary?.totalDuration || '-',
          totalStops: result.summary?.totalStops || mappedData.length
        });
        
        // เลือกรายการล่าสุดให้แสดงบนแผนที่ทันที
        setSelectedPoint(mappedData[0]);
      } else {
        setHistoryList([]);
        setSummary({ totalDistance: '0.00', totalDuration: '-', totalStops: 0 });
        alert(`ไม่พบข้อมูล${mode === 'history' ? 'เส้นทางการวิ่ง' : 'จุดจอด'}ในช่วงเวลาที่เลือก`);
      }
    } catch (err) {
      console.error('History fetch error:', err);
      alert('ไม่สามารถเชื่อมต่อระบบดูข้อมูลย้อนหลังได้');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans overflow-hidden">
      
      {/* 🌟 Header Toolbar (สีส้ม #f39c12 ตาม Original) */}
      <div className="bg-[#f39c12] text-white h-[50px] shrink-0 flex items-center justify-between px-4 z-20 shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/fleet')} className="hover:bg-white/20 p-1.5 rounded transition-colors cursor-pointer" title="กลับหน้าแผนที่หลัก">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <span className="font-bold text-[15px] flex items-center gap-2">
            <span>ดูข้อมูลย้อนหลัง (History Radar)</span>
            {selectedTruck && <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono">{selectedTruck.plate}</span>}
          </span>
        </div>
        <div className="hidden lg:flex items-center gap-6 text-[11px] font-bold">
          <span onClick={() => router.push('/fleet')} className="cursor-pointer hover:text-slate-200">แผนที่หลัก</span>
          <span onClick={() => router.push('/executive-dashboard')} className="cursor-pointer hover:text-slate-200">แดชบอร์ดผู้บริหาร</span>
          <span className="bg-white/20 px-2.5 py-1 rounded border border-white/40 cursor-pointer hover:bg-white/30 transition-all">Logout</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* 📋 แถบด้านซ้าย (Sidebar สีเข้ม #2c3e50 พร้อม Timeline List) */}
        <div className="w-full sm:w-[320px] lg:w-[360px] shrink-0 bg-[#2c3e50] h-full flex flex-col z-10 overflow-hidden text-slate-300 shadow-xl border-r border-slate-700">
          
          {/* Quick Action Bar ด้านบน */}
          <div className="flex justify-around items-center border-b border-slate-600/50 p-2 bg-[#243342] shrink-0">
            <button onClick={() => router.push('/fleet')} className="hover:text-white p-1 cursor-pointer" title="แผนที่หลัก"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg></button>
            <button onClick={() => fetchHistoryData('history')} className="text-amber-400 p-1 font-black cursor-pointer text-xs flex items-center gap-1"><span>🛣️</span> เส้นทาง</button>
            <button onClick={() => fetchHistoryData('parking')} className="text-blue-400 p-1 font-black cursor-pointer text-xs flex items-center gap-1"><span>🛑</span> จุดจอด</button>
            <button onClick={() => router.push('/executive-dashboard')} className="hover:text-white p-1 cursor-pointer" title="สถิติ"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></button>
          </div>

          {/* ฟอร์มเลือกเวลาและคันรถ */}
          <div className="p-3 space-y-2.5 text-[11px] font-medium border-b border-slate-600/50 shrink-0 bg-[#2c3e50]">
            
            <select 
              value={selectedTruck?.plate || ''}
              onChange={(e) => setSelectedTruck(trucks.find((t: any) => t.plate === e.target.value))}
              className="w-full bg-[#1a252f] border border-slate-600 rounded px-2.5 py-2 text-white font-bold focus:outline-none focus:border-[#f39c12] cursor-pointer shadow-inner"
            >
              <option value="">-- เลือกรถที่ต้องการดูประวัติ --</option>
              {trucks.map((t: any) => (
                <option key={t.plate} value={t.plate}>{t.plate} {t.imei !== '-' && `(IMEI: ${t.imei.slice(-4)})`}</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1 text-slate-400 font-bold">วันเริ่มต้น</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-white text-slate-800 font-bold rounded px-2 py-1 cursor-pointer focus:outline-none" />
              </div>
              <div>
                <label className="block mb-1 text-slate-400 font-bold">เวลาเริ่มต้น</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-white text-slate-800 font-bold rounded px-2 py-1 focus:outline-none cursor-pointer" />
              </div>
              <div>
                <label className="block mb-1 text-slate-400 font-bold">วันสิ้นสุด</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-white text-slate-800 font-bold rounded px-2 py-1 cursor-pointer focus:outline-none" />
              </div>
              <div>
                <label className="block mb-1 text-slate-400 font-bold">เวลาสิ้นสุด</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-white text-slate-800 font-bold rounded px-2 py-1 focus:outline-none cursor-pointer" />
              </div>
            </div>

            {/* ปุ่มกดค้นหา 2 โหมด */}
            <div className="pt-1.5 grid grid-cols-2 gap-2">
              <button 
                onClick={() => fetchHistoryData('history')} 
                disabled={isLoading}
                className="w-full bg-[#27ae60] hover:bg-[#2ecc71] disabled:opacity-50 text-white font-black py-2 rounded shadow transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                {isLoading && activeMode === 'history' ? <span className="animate-spin">⏳</span> : <span>🛣️</span>}
                <span>{isLoading && activeMode === 'history' ? 'กำลังโหลด...' : 'เส้นทางวิ่ง'}</span>
              </button>
              <button 
                onClick={() => fetchHistoryData('parking')}
                disabled={isLoading} 
                className="w-full bg-[#2980b9] hover:bg-[#3498db] disabled:opacity-50 text-white font-black py-2 rounded shadow transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                {isLoading && activeMode === 'parking' ? <span className="animate-spin">⏳</span> : <span>🛑</span>}
                <span>{isLoading && activeMode === 'parking' ? 'กำลังโหลด...' : 'จุดจอดรถ'}</span>
              </button>
            </div>

          </div>

          {/* 🌟 ส่วนกลาง: รายการเหตุการณ์ประวัติ (Timeline Event Feed) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-[#243342]/50">
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex justify-between items-center">
              <span>รายการ{activeMode === 'history' ? 'เส้นทาง' : 'จุดจอด'} ({historyList.length})</span>
              {historyList.length > 0 && <span className="text-emerald-400">คลิกเพื่อซูมดูพิกัด</span>}
            </div>

            {isLoading ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-8 h-8 border-4 border-slate-600 border-t-[#f39c12] rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-bold text-slate-400">กำลังดาวน์โหลดพิกัดจากดาวเทียม...</p>
              </div>
            ) : historyList.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs space-y-2">
                <div className="text-3xl">📡</div>
                <div className="font-bold text-slate-400">ยังไม่มีรายการแสดงผล</div>
                <p className="text-[10px]">กรุณาระบุช่วงเวลา แล้วกดปุ่มเขียวหรือน้ำเงินด้านบน</p>
              </div>
            ) : (
              historyList.map((item: any, idx: number) => {
                const isSelected = selectedPoint && (selectedPoint.id === item.id || selectedPoint.time === item.time);
                const isRunning = Number(item.speed) > 0 || String(item.status).includes('วิ่ง');

                return (
                  <div 
                    key={idx}
                    onClick={() => setSelectedPoint(item)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer text-xs space-y-1 ${
                      isSelected 
                        ? 'bg-[#34495e] border-[#f39c12] shadow-md ring-1 ring-[#f39c12]' 
                        : 'bg-[#1a252f]/80 border-slate-700/60 hover:bg-[#1a252f] hover:border-slate-500'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1 font-mono text-[11px]">
                      <span className="font-black text-amber-400">[{item.time}]</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                        isRunning ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      }`}>
                        {item.status || (isRunning ? 'กำลังวิ่ง' : 'จอดดับเครื่อง')}
                      </span>
                    </div>

                    <div className="text-[11px] font-medium text-slate-300 leading-snug line-clamp-2">
                      📍 {item.address || item.location || 'ไม่ระบุที่อยู่'}
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 pt-1 border-t border-slate-700/50">
                      <span>⛽ Fuel: <span className="text-white font-mono">{item.fuel || '0%'}</span></span>
                      <span>💨 Spd: <span className="text-white font-mono">{item.speed || '0'}</span> กม./ชม.</span>
                      <span>🔥 <span className="text-white font-mono">{item.temp || '0°C'}</span></span>
                    </div>

                    {item.duration && (
                      <div className="bg-rose-950/60 border border-rose-800/60 text-rose-300 font-bold text-[10px] p-1 rounded text-center">
                        ⏱️ ระยะเวลาจอด: {item.duration}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 🌟 สรุปสถิติด้านล่างสุด (Bottom Summary Bar) */}
          <div className="p-3 bg-[#1a252f] border-t border-slate-700 text-xs font-bold shrink-0 space-y-1">
            <div className="flex justify-between text-slate-300">
              <span>🛣️ ระยะทางรวม:</span>
              <span className="text-[#f39c12] font-mono font-black text-sm">{summary.totalDistance} กม.</span>
            </div>
            {summary.totalDuration !== '-' && (
              <div className="flex justify-between text-slate-300 text-[11px]">
                <span>⏱️ ระยะเวลารวม:</span>
                <span className="text-emerald-400 font-mono">{summary.totalDuration}</span>
              </div>
            )}
          </div>

        </div>

        {/* 🗺️ แผนที่ด้านขวา */}
        <div className="flex-1 relative z-0 bg-slate-900">
          <DynamicMapHistory 
            historyData={historyList} 
            mode={activeMode} 
            selectedPoint={selectedPoint} 
            onSelectPoint={setSelectedPoint} 
          />
          
          <div className="absolute top-4 right-4 z-[400] bg-[#2c3e50]/90 backdrop-blur text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-lg border border-slate-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            โหมด: {activeMode === 'history' ? 'เส้นทางการเดินทาง (Route)' : 'วิเคราะห์จุดจอดรถ (Stops)'}
          </div>
        </div>

      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475f77; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #617d98; }
        
        .custom-popup .leaflet-popup-content-wrapper { padding: 0; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
        .custom-popup .leaflet-popup-content { margin: 0; width: auto !important; }
        .custom-popup .leaflet-popup-tip { box-shadow: none; }
      `}</style>
    </div>
  );
}

// =========================================================================
// 🚀 Main Page: เอา Suspense มาครอบกัน Next.js Build Error
// =========================================================================
export default function HistoryPage() {
  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center h-screen bg-[#2c3e50] text-white font-sans">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-slate-600 border-t-[#f39c12] rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-300">กำลังเตรียมระบบดูข้อมูลย้อนหลัง...</p>
          </div>
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}