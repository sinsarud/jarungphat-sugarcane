'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase'; 
import dynamic from 'next/dynamic';

interface Plot {
  id: string;
  code: string;
  name?: string;
  plot_name?: string;
  title?: string;
  description?: string;
  area_rai?: number; 
  area?: number;
  lat?: number | null;
  lon?: number | null;
}

const getPlotName = (p: Plot) => p.name || p.plot_name || p.title || p.description || 'ไม่ระบุชื่อแปลง';

// ==========================================
// 🗺️ ระบบแผนที่ดาวเทียมซ้อนทับ (Leaflet + Google Maps + AgroMonitoring Tiles)
// ==========================================
const MapOverlayComponent = ({ lat, lon, tileUrl, polygonCoords, viewMode }: any) => {
  const L = require('leaflet');
  const { MapContainer, TileLayer, Polygon, useMap } = require('react-leaflet');

  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });

  const googleSatelliteUrl = "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";

  // ฟังก์ชันเลื่อนแผนที่ไปตรงกลางแปลงอัตโนมัติ
  const RecenterAutomatically = ({ lat, lon }: { lat: number, lon: number }) => {
    const map = useMap();
    useEffect(() => {
      map.setView([lat, lon], 16, { animate: true, duration: 1.5 });
    }, [lat, lon, map]);
    return null;
  }

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <MapContainer center={[lat, lon]} zoom={16} style={{ height: '100%', width: '100%', zIndex: 10, background: '#0f172a' }}>
        <RecenterAutomatically lat={lat} lon={lon} />

        {/* 🌍 1. เลเยอร์พื้นหลัง: ภาพถ่ายดาวเทียม Google Maps (เพื่อให้เห็นถนน/สภาพแวดล้อมรอบแปลง) */}
        <TileLayer
          url={googleSatelliteUrl}
          maxZoom={20}
          attribution="&copy; Google Maps"
        />

        {/* 🔥 2. เลเยอร์ซ้อนทับ: ภาพ NDVI จาก AgroMonitoring (แบบแผ่นกระเบื้องโปร่งแสง) */}
        {tileUrl && viewMode === 'NDVI' && (
          <TileLayer
            url={tileUrl}
            maxZoom={20}
            opacity={0.8} // ปรับความโปร่งใส ให้เห็นถนนหรือต้นไม้ของ Google Map ทะลุขึ้นมาได้
          />
        )}

        {/* 📍 3. วาดเส้นขอบเขตแปลง (Polygon) สีเขียว เพื่อให้รู้ว่าแปลงเราอยู่ตรงไหน */}
        {polygonCoords && (
          <Polygon
            positions={polygonCoords}
            pathOptions={{
              color: viewMode === 'NDVI' ? '#ffffff' : '#10b981', // ตัดขอบขาวถ้าเปิดโหมด NDVI
              weight: 2,
              fillColor: '#10b981',
              fillOpacity: viewMode === 'TRUE_COLOR' ? 0.2 : 0 // ปิดสีพื้นถ้าอยู่ในโหมด NDVI
            }}
          />
        )}
      </MapContainer>
    </>
  );
};

const DynamicMapOverlay = dynamic(() => Promise.resolve(MapOverlayComponent), { ssr: false });

// ==========================================
// 🚀 Main Page Component
// ==========================================
export default function NDVIMonitor() {
  const [loading, setLoading] = useState(false);
  const [dbPlots, setDbPlots] = useState<Plot[]>([]);
  const [scanTarget, setScanTarget] = useState<Plot | null>(null);
  const [viewMode, setViewMode] = useState<'NDVI' | 'TRUE_COLOR'>('NDVI');
  
  // 🔐 ดึง API KEY จากไฟล์ .env.local
  const API_KEY = process.env.NEXT_PUBLIC_AGROMONITORING_API_KEY;

  const [realSatData, setRealSatData] = useState<{
    ndviTileUrl: string;       // 🌟 ใช้แบบ Tile สำหรับซ้อนทับแผนที่
    trueColorTileUrl: string;
    meanNdvi: number;
    dateTaken: string;
    cloudCoverage: number;
    leafletCoords: number[][]; // 🌟 พิกัดสำหรับวาดเส้นขอบเขตใน Leaflet
  } | null>(null);

  const fetchPlots = useCallback(async () => {
    const { data } = await supabase.from('plots').select('*').order('code');
    if (data) setDbPlots(data as Plot[]);
  }, []);

  useEffect(() => { fetchPlots(); }, [fetchPlots]);

  const fetchRealSatelliteData = async (plot: Plot) => {
    if (!plot.lat || !plot.lon) {
      alert('❌ แปลงนี้ยังไม่มีพิกัด GPS! ไม่สามารถสแกนดาวเทียมได้');
      return;
    }

    if (!API_KEY) {
      alert('🚨 ไม่พบ API Key! กรุณาตรวจสอบไฟล์ .env.local');
      return;
    }

    setLoading(true);
    setRealSatData(null);
    try {
      const areaRai = plot.area_rai || plot.area || 10;
      const sideLengthMeters = Math.sqrt(areaRai * 1600); 
      const halfSide = sideLengthMeters / 2;
      const latOffset = halfSide / 111111;
      const lonOffset = halfSide / (111111 * Math.cos(plot.lat * (Math.PI / 180)));

      // พิกัด GeoJSON วาดแบบทวนเข็มนาฬิกา
      const coords = [
        [plot.lon - lonOffset, plot.lat + latOffset], // บน-ซ้าย
        [plot.lon - lonOffset, plot.lat - latOffset], // ล่าง-ซ้าย
        [plot.lon + lonOffset, plot.lat - latOffset], // ล่าง-ขวา
        [plot.lon + lonOffset, plot.lat + latOffset], // บน-ขวา
        [plot.lon - lonOffset, plot.lat + latOffset]  // กลับมาจุดเดิม
      ];

      // แปลงพิกัดสำหรับใช้ใน Leaflet Map (Leaflet ใช้สลับจาก [lon, lat] เป็น [lat, lon])
      const leafletCoords = coords.map(c => [c[1], c[0]]);

      let polyId = localStorage.getItem(`POLY_${plot.id}`);

      if (!polyId) {
        const polyRes = await fetch(`https://api.agromonitoring.com/agro/1.0/polygons?appid=${API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Plot_${plot.code}`,
            geo_json: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } }
          })
        });
        const polyData = await polyRes.json();
        
        if (polyData.id) {
          polyId = polyData.id;
          localStorage.setItem(`POLY_${plot.id}`, polyId as string);
        } else {
          throw new Error('ไม่สามารถบันทึกขอบเขตแปลงบนดาวเทียมได้');
        }
      }

      const endUnix = Math.floor(Date.now() / 1000);
      const startUnix = endUnix - (365 * 24 * 60 * 60); 
      
      const imgRes = await fetch(`https://api.agromonitoring.com/agro/1.0/image/search?start=${startUnix}&end=${endUnix}&polyid=${polyId}&appid=${API_KEY}`);
      const imgList = await imgRes.json();

      if (imgList && imgList.message) {
         throw new Error(`API: ${imgList.message}`);
      }

      if (!Array.isArray(imgList) || imgList.length === 0) {
        throw new Error('เมฆหนาแน่นเกินไปตลอดช่วงที่ค้นหา หรือดาวเทียมกำลังประมวลผลแปลงใหม่ กรุณารอสักครู่แล้วลองใหม่ครับ');
      }

      const sortedImages = imgList.sort((a: any, b: any) => b.dt - a.dt);
      const latestImage = sortedImages[0];
      
      const statsRes = await fetch(latestImage.stats.ndvi);
      const statsData = await statsRes.json();

      // 🌟 ใช้ Tile URL แทน Image เดี่ยวๆ เพื่อให้แปะทับลง Google Maps ได้พอดีเป๊ะ!
      setRealSatData({
        ndviTileUrl: latestImage.tile.ndvi,       
        trueColorTileUrl: latestImage.tile.truecolor,  
        meanNdvi: Number(statsData.mean.toFixed(2)), 
        dateTaken: new Date(latestImage.dt * 1000).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        cloudCoverage: Number(latestImage.cl.toFixed(1)),
        leafletCoords: leafletCoords 
      });

    } catch (error: any) {
      alert(`❌ ข้อผิดพลาดดาวเทียม: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlot = (plot: Plot) => {
    setScanTarget(plot);
    fetchRealSatelliteData(plot);
  };

  return (
    <div className="bg-[#0f172a] text-stone-100 rounded-[24px] border border-stone-800 shadow-2xl overflow-hidden p-6 relative min-h-[500px]">
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* 🌟 Header */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black rounded uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> REAL SATELLITE DATA
            </span>
            <span className="text-[10px] text-stone-400 bg-stone-900 border border-stone-700 px-2 py-0.5 rounded font-mono">
              API KEY: {API_KEY ? '🟢 SECURED' : '🔴 MISSING'}
            </span>
          </div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            🛰️ สแกนภาพดาวเทียมของจริง (AgroMonitoring)
          </h2>
        </div>

        {/* 🌟 ปุ่มสลับโหมดกล้อง */}
        {realSatData && (
          <div className="flex bg-stone-900/80 p-1 rounded-xl border border-stone-800 self-start shadow-lg z-20">
            <button
              onClick={() => setViewMode('NDVI')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                viewMode === 'NDVI' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md' : 'text-stone-400 hover:text-white'
              }`}
            >
              <span>🔥</span> แผ่นกรองอินฟราเรด (NDVI Overlay)
            </button>
            <button
              onClick={() => setViewMode('TRUE_COLOR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                viewMode === 'TRUE_COLOR' ? 'bg-stone-700 text-white shadow-md' : 'text-stone-400 hover:text-white'
              }`}
            >
              <span>🌍</span> ซ่อนแผ่นกรอง (Google Maps)
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* 🌟 รายชื่อแปลง */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">แปลงอ้อยในระบบ:</div>
          <div className="flex flex-col gap-2 max-h-[450px] overflow-y-auto custom-scrollbar pr-1">
            {dbPlots.map((p) => {
              const isSelected = scanTarget?.id === p.id;
              const hasCoords = p.lat != null && p.lon != null;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPlot(p)}
                  disabled={!hasCoords || loading}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                    !hasCoords ? 'opacity-50 cursor-not-allowed bg-stone-900/40 border-stone-800' :
                    isSelected ? 'bg-stone-800 border-emerald-500/80 ring-1 ring-emerald-500/50 shadow-lg' : 'bg-stone-900/40 border-stone-800 hover:bg-stone-800/50 hover:border-stone-600'
                  }`}
                >
                  <div>
                    <div className="text-sm font-black text-white flex items-center gap-1.5">
                      <span className="text-emerald-400 font-mono">[{p.code}]</span> {getPlotName(p)}
                    </div>
                    <div className="text-[10px] mt-1">
                      {hasCoords ? (
                        <span className="text-teal-500 font-mono">📍 {p.lat!.toFixed(4)}, {p.lon!.toFixed(4)}</span>
                      ) : (
                        <span className="text-rose-400 font-bold">⚠️ ไม่มีพิกัด</span>
                      )}
                    </div>
                  </div>
                  {p.area_rai && (
                    <div className="text-xs font-black bg-stone-950 px-2 py-1 rounded-lg border border-stone-800 text-stone-400">
                      {p.area_rai} ไร่
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 🌟 จอแสดงแผนที่ดาวเทียมซ้อนทับ (NASA STYLE) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="relative w-full h-[400px] bg-stone-950 rounded-2xl border border-stone-800 overflow-hidden shadow-inner group z-0">
            
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-900/80 z-50">
                <div className="w-10 h-10 border-4 border-emerald-500 border-b-transparent rounded-full animate-spin"></div>
                <div className="text-emerald-400 font-bold text-xs uppercase tracking-widest animate-pulse">กำลังซ้อนทับข้อมูลดาวเทียมบนแผนที่...</div>
              </div>
            ) : realSatData ? (
              <>
                {/* 🌟 LEAFLET MAP + GOOGLE SATELLITE + AGROMONITORING OVERLAY */}
                <DynamicMapOverlay 
                  lat={scanTarget?.lat} 
                  lon={scanTarget?.lon} 
                  tileUrl={realSatData.ndviTileUrl} 
                  polygonCoords={realSatData.leafletCoords}
                  viewMode={viewMode}
                />

                {/* Overlays ข้อมูล */}
                <div className="absolute top-4 left-4 z-20 bg-stone-900/90 backdrop-blur-md px-3.5 py-2 rounded-lg border border-stone-700 text-[11px] font-black text-white shadow-lg pointer-events-none">
                  📅 ถ่ายจริงเมื่อ: <span className="text-emerald-400">{realSatData.dateTaken}</span>
                </div>

                <div className="absolute top-4 right-4 z-20 bg-stone-900/90 backdrop-blur-md px-3.5 py-2 rounded-lg border border-stone-700 text-[11px] font-black text-white shadow-lg flex items-center gap-2 pointer-events-none">
                  <span>☁️ เมฆบัง:</span>
                  <span className={`${realSatData.cloudCoverage > 20 ? 'text-rose-400' : 'text-sky-400'}`}>{realSatData.cloudCoverage}%</span>
                </div>

                <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20 pointer-events-none">
                   <div className="bg-stone-900/95 backdrop-blur-md border border-stone-700 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-5 text-white transform transition-transform hover:scale-105">
                      <div className="text-[11px] font-bold text-stone-400 uppercase tracking-widest text-right">
                         ดัชนีพืชพรรณจริง<br/>(Real NDVI)
                      </div>
                      <div className="w-px h-8 bg-stone-700"></div>
                      <div className={`text-4xl font-black ${realSatData.meanNdvi >= 0.7 ? 'text-emerald-400' : realSatData.meanNdvi >= 0.5 ? 'text-yellow-400' : 'text-rose-500'}`}>
                         {realSatData.meanNdvi}
                      </div>
                   </div>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-stone-600 font-bold text-sm z-10 bg-[#0f172a]">
                <span className="text-xl mr-2">👈</span> กรุณาเลือกแปลงอ้อยที่มีพิกัดเพื่อดึงภาพดาวเทียม
              </div>
            )}
          </div>

          {/* AI Diagnosis */}
          {realSatData && (
             <div className="p-5 rounded-2xl bg-gradient-to-r from-stone-900 to-stone-900/80 border border-stone-800 flex items-start gap-4 shadow-lg">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-inner ${
                  realSatData.meanNdvi >= 0.7 ? 'bg-emerald-500/20 border border-emerald-500/30' : 
                  realSatData.meanNdvi >= 0.5 ? 'bg-amber-500/20 border border-amber-500/30' : 
                  'bg-rose-500/20 border border-rose-500/30'
                }`}>
                  🤖
                </div>
                <div>
                   <div className="text-[11px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2 mb-1.5">
                     Real Satellite Diagnosis
                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                   </div>
                   <p className="text-sm font-bold text-stone-200 leading-relaxed">
                      {realSatData.cloudCoverage > 30 
                      ? `⚠️ ภาพนี้มีเมฆบังถึง ${realSatData.cloudCoverage}% ทำให้ค่าสี NDVI อาจคลาดเคลื่อนจากความเป็นจริงเล็กน้อยครับ`
                      : realSatData.meanNdvi >= 0.7 
                      ? '✅ ภาพถ่ายทางอากาศยืนยัน: พืชพรรณเจริญเติบโตหนาแน่นและมีสุขภาพดีเยี่ยม ใบเขียวสมบูรณ์กระจายเต็มพื้นที่แปลง' 
                      : realSatData.meanNdvi >= 0.5 
                      ? '⚠️ ภาพถ่ายทางอากาศแจ้งเตือน: ความสมบูรณ์อยู่ในระดับปานกลาง อาจมีต้นอ้อยแกร็น ดินแห้ง หรือมีวัชพืชปะปนอยู่ในบางจุดของแปลง' 
                      : '🚨 เตือนภัยจากภาพถ่ายจริง!: ดินแห้งแล้งอย่างหนัก หรืออาจเป็นช่วงเพิ่งตัดอ้อย/ไถเตรียมดิน ไม่พบความสมบูรณ์ของใบอ้อยในพื้นที่นี้'}
                   </p>
                </div>
             </div>
          )}
        </div>
      </div>

      <style jsx global>{`.custom-scrollbar::-webkit-scrollbar{width:4px;}.custom-scrollbar::-webkit-scrollbar-thumb{background:#334155;border-radius:4px;}`}</style>
    </div>
  );
}