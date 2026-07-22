'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// ==========================================
// 🗺️ ระบบแผนที่ Leaflet (Luxury Icons & Popup)
// ==========================================
const MapFleetComponent = ({ trucks, selectedId, onOpenModal }: { trucks: any[], selectedId: string | null, onOpenModal: (type: 'POI' | 'JOB' | 'HISTORY' | 'FUEL', truck: any) => void }) => {
  const L = require('leaflet');
  const { MapContainer, TileLayer, Marker, Popup, useMap } = require('react-leaflet');

  const MapController = ({ selectedId, trucks }: { selectedId: string | null, trucks: any[] }) => {
    const map = useMap();
    useEffect(() => {
      if (selectedId) {
        const target = trucks.find((t: any) => t.id === selectedId);
        if (target && target.lat && target.lon) {
          map.flyTo([target.lat, target.lon], 19, { animate: true, duration: 1.5 });
        }
      }
    }, [selectedId, trucks, map]);
    return null;
  };

  const createTruckIcon = (statusCategory: string, isSelected: boolean, rfidAlert: boolean, fuelTheft: boolean) => {
    let color = '#94a3b8'; // ออฟไลน์
    if (statusCategory === 'driving') color = '#10b981'; // เขียววิ่ง
    else if (statusCategory === 'idling') color = '#f59e0b'; // ส้มติดเครื่อง
    else if (statusCategory === 'parked') color = '#3b82f6'; // ฟ้าจอด

    let borderColor = (rfidAlert || fuelTheft) ? '#ef4444' : '#ffffff';
    let pulse = (statusCategory === 'driving' || rfidAlert || fuelTheft) ? `<div class="absolute -inset-1 ${(rfidAlert || fuelTheft) ? 'bg-red-500' : 'bg-emerald-500'} rounded-full opacity-60 animate-ping"></div>` : '';
    let scale = isSelected ? 'scale-125 border-4 shadow-[0_0_20px_rgba(79,70,229,0.5)]' : 'border-2 shadow-md';
    
    return L.divIcon({
      className: 'custom-truck-icon',
      html: `
        <div class="relative w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 ${scale}" style="background-color: ${color}; border-color: ${borderColor}; z-index: ${isSelected ? 100 : 10};">
          ${pulse}
          <span class="relative z-10 text-xs">🚚</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  const centerLat = trucks.length > 0 ? trucks[0].lat : 13.7850;
  const centerLon = trucks.length > 0 ? trucks[0].lon : 100.4150;

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <MapContainer center={[centerLat, centerLon]} zoom={13} maxZoom={22} style={{ height: '100%', width: '100%', zIndex: 0 }}>
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          maxNativeZoom={20}
          maxZoom={22}
          attribution='&copy; Google Maps'
        />
        <MapController selectedId={selectedId} trucks={trucks} />
        {trucks.map((truck: any) => (
          <Marker key={truck.id} position={[truck.lat, truck.lon]} icon={createTruckIcon(truck.statusCategory, selectedId === truck.id, truck.rfidAlert, truck.fuelTheft)}>
            
            {/* 🌟 LUXURY MAP POPUP */}
            <Popup className="custom-popup min-w-[340px] sm:min-w-[400px]">
              <div className="p-4 font-sans text-slate-700 bg-white rounded-2xl shadow-2xl border border-slate-100">
                
                <div className="flex justify-between items-start gap-3 mb-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-800 tracking-tight">{truck.plate}</span>
                      {truck.rfidAlert && <span className="bg-rose-50 border border-rose-200 text-rose-600 text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">ไม่รูดบัตร</span>}
                      {truck.fuelTheft && <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-bounce shadow">🚨 น้ำมันฮวบ!</span>}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 mt-0.5">เวลา GPS: {truck.time}</div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black text-white shadow-sm shrink-0 ${truck.statusColor}`}>
                    {truck.statusText}
                  </div>
                </div>

                <div className="flex justify-between items-start gap-4 text-xs">
                  <div className="flex-1 space-y-1.5 font-medium">
                    <div className="flex justify-between"><span className="text-slate-400">ชื่อสินทรัพย์:</span> <span className="font-bold text-rose-500">ไม่ระบุ</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">สัญญาณ:</span> <span className="font-bold text-slate-700">GSM {truck.gsm}% | Sat {truck.sat}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">เลขไมล์:</span> <span className="font-bold text-slate-700">{truck.mileage.toLocaleString()} กม.</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">ความเร็ว:</span> <span className="font-bold text-slate-700">{truck.speed} กม./ชม.</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">อุณหภูมิ:</span> <span className="font-bold text-slate-700">{truck.temp !== 'ไม่ระบุ' ? `${truck.temp}°C` : 'ไม่ระบุ'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">น้ำมัน / แก๊ส:</span> <span className="font-bold text-slate-700">{truck.oil > 0 ? `${truck.oil}%` : '0%'} / {truck.gas}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">ยาง / เข็มขัด:</span> <span className="font-bold text-slate-700">{truck.tyreStatus} / {truck.beltStatus}</span></div>
                    
                    <div className="pt-2 mt-2 border-t border-slate-100 text-[11px] leading-snug">
                      <span className="text-slate-400 block mb-0.5">ตำแหน่งปัจจุบัน:</span>
                      <span className="font-bold text-slate-800 line-clamp-2">{truck.address}</span>
                    </div>
                  </div>

                  <div className="w-[84px] shrink-0 flex flex-col items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center border border-slate-200/60 shadow-sm mb-2 text-slate-400">
                      🚚
                    </div>
                    <button className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold w-full py-1.5 rounded-lg shadow-sm transition-all cursor-pointer">เปลี่ยนรูป</button>
                    <span className="text-[8px] text-slate-400 text-center mt-1">Max 100kb</span>
                  </div>
                </div>

                {/* 🌟 LUXURY BUTTON GROUP */}
                <div className="grid grid-cols-3 gap-1.5 mt-4 pt-3 border-t border-slate-100">
                  <button onClick={() => onOpenModal('POI', truck)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-[10px] transition-all cursor-pointer">📍 จุดจอด</button>
                  <button onClick={() => onOpenModal('HISTORY', truck)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-[10px] shadow-sm shadow-indigo-500/20 transition-all cursor-pointer">🕒 ย้อนหลัง</button>
                  <button onClick={() => onOpenModal('JOB', truck)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl text-[10px] transition-all cursor-pointer">📋 ใบสั่งงาน</button>
                  <button onClick={() => onOpenModal('FUEL', truck)} className="col-span-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-95 text-white font-black py-2 rounded-xl text-[11px] shadow-md shadow-orange-500/20 transition-all cursor-pointer flex items-center justify-center gap-1"><span>⛽</span> วิเคราะห์น้ำมัน (Theft & Cost)</button>
                  <button onClick={() => window.open(`https://www.google.com/maps?q&layer=c&cbll=${truck.lat},${truck.lon}`, '_blank')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-[10px] shadow-sm shadow-emerald-500/20 transition-all cursor-pointer">🌐 Street View</button>
                </div>

              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </>
  );
};

const DynamicMapFleet = dynamic(() => Promise.resolve(MapFleetComponent), { ssr: false });

// ==========================================
// 🚀 Main Page Component (Pure Real Data 100%)
// ==========================================
export default function FleetRadarPage() {
  const router = useRouter();
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  const [activeModal, setActiveModal] = useState<'POI' | 'JOB' | 'HISTORY' | 'FUEL' | null>(null);
  const [modalTruck, setModalTruck] = useState<any>(null);
  const [modalStep, setModalStep] = useState<'form' | 'loading' | 'success' | 'result' | 'nodata'>('form');

  const [poiName, setPoiName] = useState('');
  const [poiRadius, setPoiRadius] = useState('0.5');

  const [truckJobs, setTruckJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historySummary, setHistorySummary] = useState({ totalDistance: '0.00', totalDuration: '-', totalStops: 0 });

  const [fuelData, setFuelData] = useState<any>(null);
  const [loadingFuel, setLoadingFuel] = useState(false);

  const [isMuted, setIsMuted] = useState(true); 
  const [showNotifications, setShowNotifications] = useState(false);
  const isMutedRef = useRef(true);

  // =========================================================================
  // 📁 ระบบเสียงจริง (.mp3/.wav) + ระบบสำรองอัตโนมัติ (Hybrid Audio System)
  // =========================================================================
  const playFallbackSynth = (type: 'ALERT' | 'TEST' | 'SUCCESS') => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();

      const playNote = (freq: number, startTime: number, duration: number, vol = 0.15) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(vol, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      if (type === 'TEST') {
        playNote(523.25, now, 0.4, 0.15);
        playNote(659.25, now + 0.1, 0.4, 0.15);
        playNote(783.99, now + 0.2, 0.6, 0.2);
      } else if (type === 'ALERT') {
        playNote(659.25, now, 0.35, 0.2);
        playNote(523.25, now + 0.15, 0.5, 0.2);
      } else if (type === 'SUCCESS') {
        playNote(587.33, now, 0.3, 0.15);
        playNote(880.00, now + 0.12, 0.6, 0.2);
      }
    } catch (e) {
      console.error('Audio error:', e);
    }
  };

  const playSound = (type: 'ALERT' | 'TEST' | 'SUCCESS' = 'ALERT', forcePlay = false) => {
    if (isMutedRef.current && !forcePlay) return;

    let fileName = 'alert.mp3';
    if (type === 'SUCCESS') fileName = 'success.mp3';
    if (type === 'TEST') fileName = 'test.mp3';

    const audio = new Audio(`/sounds/${fileName}`);
    audio.play().catch((err) => {
      console.warn(`[Audio System]: ไม่พบไฟล์ /sounds/${fileName} -> สลับใช้เสียงสังเคราะห์สำรอง`, err);
      playFallbackSynth(type);
    });
  };

  const handleToggleMute = () => {
    const nextMuteState = !isMuted;
    setIsMuted(nextMuteState);
    isMutedRef.current = nextMuteState;

    if (!nextMuteState) {
      playSound('TEST', true); 
    }
  };

  const fetchRealData = async () => {
    try {
      const res = await fetch('/api/fleet');
      const rawData = await res.json();

      let rawArray = [];
      if (rawData.data && Array.isArray(rawData.data)) {
        rawArray = rawData.data;
      } else if (Array.isArray(rawData)) {
        rawArray = rawData;
      } else {
        rawArray = Object.values(rawData);
      }

      const seenCoords = new Set();

      const formattedTrucks = rawArray.map((t: any, index: number) => {
        const speed = parseFloat(t.speed || 0);
        const statusStr = String(t.status || '').toUpperCase();
        
        let isOnline = true;
        if (statusStr === "OFFLINE" || statusStr.includes("OFFLINE") || statusStr.includes("ออฟไลน์")) {
          isOnline = false;
        } else if (t.statusonline === 0 || t.statusonline === "0" || t.statusonline === false) {
          if (!statusStr.includes("จอด") && !statusStr.includes("วิ่ง") && !statusStr.includes("ติดเครื่อง") && !statusStr.includes("ดับเครื่อง")) {
            isOnline = false;
          }
        }
        
        let statusCategory = 'offline';
        let statusText = t.status || 'ออฟไลน์ (OFFLINE)';
        let statusColor = 'bg-slate-400';

        if (!isOnline) {
          statusCategory = 'offline';
          statusText = t.status || 'ออฟไลน์ (OFFLINE)';
          statusColor = 'bg-slate-400';
        } else if (speed > 0 || statusStr.includes("วิ่ง")) {
          statusCategory = 'driving';
          statusText = t.status || `กำลังวิ่ง (${speed} กม./ชม.)`;
          statusColor = 'bg-emerald-500';
        } else if (t.isEngineOn || t.magentic_data?.isEngine || statusStr.includes("ติดเครื่อง")) {
          statusCategory = 'idling';
          statusText = t.status || 'จอดรถ - ติดเครื่องยนต์';
          statusColor = 'bg-amber-500';
        } else {
          statusCategory = 'parked';
          statusText = t.status || 'จอดรถ - ดับเครื่องยนต์';
          statusColor = 'bg-blue-500';
        }

        const isEngineRunning = statusCategory === 'driving' || statusCategory === 'idling' || t.isEngineOn || t.magentic_data?.isEngine;
        const hasRfid = t.magentic_data?.isRfid === true || t.isRfid === true || (t.driver_detail?.driver_rfid && t.driver_detail.driver_rfid !== "");
        const rfidAlert = isEngineRunning && !hasRfid;
        const speedAlert = speed > 90;

        const oilVal = t.oil !== null && t.oil !== undefined ? t.oil : 0;
        const gasVal = t.gas !== null && t.gas !== undefined ? `${t.gas}%` : 'ไม่ระบุ';

        // ✅ ข้อมูลจริง 100%: รับค่าการแจ้งเตือนน้ำมันร่วงจากสัญญาณเซิร์ฟเวอร์จริงเท่านั้น (ไม่มี Mockup)
        const fuelTheft = t.isFuelTheft === true || t.fuel_drop_alert === true || false;

        let lat = parseFloat(t.lat || 13.785);
        let lon = parseFloat(t.lng || 100.415);
        let coordKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
        
        // UI เทคนิค: ขยับพิกัดเล็กน้อยกรณีรถหลายคันจอดทับจุดเดียวกันเป๊ะ เพื่อไม่ให้มาร์กเกอร์ซ้อนทับกันบนแผนที่
        if (seenCoords.has(coordKey)) {
          lat += (Math.random() - 0.5) * 0.00015;
          lon += (Math.random() - 0.5) * 0.00015;
        }
        seenCoords.add(`${lat.toFixed(5)},${lon.toFixed(5)}`);

        return {
          id: t.id ? t.id.toString() : index.toString(),
          plate: t.number || 'ไม่ระบุ',
          lat: lat,
          lon: lon,
          speed: speed,
          statusCategory: statusCategory,
          statusText: statusText,
          statusColor: statusColor,
          
          rfidAlert: rfidAlert,
          speedAlert: speedAlert,
          fuelTheft: fuelTheft,
          driverName: t.magentic_data?.driver_full_name || t.driver_detail?.driver_name || (rfidAlert ? 'ไม่ได้รูดบัตร!' : 'ไม่พบข้อมูล'),
          driverId: t.driver_id || t.driver || '-',
          
          assetName: t.name || t.asset || 'ไม่ระบุ',
          imei: t.imei || 'ไม่ระบุ',
          time: t.time || '-',
          serverTime: t.datetime || '-',
          gsm: t.gsm ?? '-',
          sat: t.sat ?? '-',
          mileage: t.mileage ?? 0,
          overspeed: t.overspeed || 'ไม่จำกัด',
          battery: t.battery ? `${t.battery}v.` : 'ไม่มีข้อมูล',
          angle: t.cardirection ?? t.car_rotation ?? 0,
          temp: t.temperature !== null && t.temperature !== undefined ? `${t.temperature}` : 'ไม่ระบุ',
          oil: oilVal,
          gas: gasVal,
          address: t.address || 'ไม่สามารถค้นหาตำแหน่งได้',
          near: t.nearest_poi?.name || t.near || '',
          poiDistance: t.nearest_poi?.distance !== undefined ? `${t.nearest_poi.distance} กม.` : '-',
          
          tyreStatus: t.tyreGradeText || (t.isOverTyre ? 'ผิดปกติ' : 'ปกติ'),
          beltStatus: t.beltGradeText || (t.isOverBelt ? 'ไม่ได้คาด' : 'ปกติ'),
          
          engineOffDuration: t.longTimePark || 'ไม่มีข้อมูล',
          lastUpdate: t.lastUpdate || t.time || '-',
        };
      });

      setTrucks(formattedTrucks);
      setLastUpdate(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      const activeAlertsCount = formattedTrucks.filter((t: any) => t.rfidAlert || t.speedAlert || t.fuelTheft).length;
      if (activeAlertsCount > 0 && !isMutedRef.current) {
        playSound('ALERT');
      }

    } catch (err) {
      console.error("ดึงข้อมูลไม่สำเร็จ:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealData();
    const interval = setInterval(fetchRealData, 10000); 
    return () => clearInterval(interval);
  }, []);

  const noRfidCount = trucks.filter((t: any) => t.rfidAlert).length;
  const drivingCount = trucks.filter((t: any) => t.statusCategory === 'driving').length;
  const idlingCount = trucks.filter((t: any) => t.statusCategory === 'idling').length;
  const parkedCount = trucks.filter((t: any) => t.statusCategory === 'parked').length;
  const offlineCount = trucks.filter((t: any) => t.statusCategory === 'offline').length;

  // ✅ สร้างรายการแจ้งเตือนจากข้อมูลจริงของดาวเทียมเท่านั้น! (ไม่มีข้อความม็อคอัป)
  const alertsList = trucks.reduce((acc: any[], truck: any) => {
    if (truck.fuelTheft) {
      acc.push({ type: 'FUEL', title: '🚨 น้ำมันร่วงผิดปกติ (สัญญาณดาวเทียม)', truck, time: truck.time, desc: `ตรวจพบระดับน้ำมันลดลงผิดปกติขณะรถจอดที่ ${truck.near || truck.address}` });
    }
    if (truck.rfidAlert) {
      acc.push({ type: 'RFID', title: 'ไม่รูดบัตรยืนยันตัวตน', truck, time: truck.time, desc: 'สตาร์ทเครื่องยนต์โดยไม่มีข้อมูลคนขับ' });
    }
    if (truck.speedAlert) {
      acc.push({ type: 'SPEED', title: 'ขับเร็วเกินกำหนด', truck, time: truck.time, desc: `ความเร็วปัจจุบัน ${truck.speed} กม./ชม. (เกินกำหนด 90)` });
    }
    return acc;
  }, []);

  const filteredTrucks = trucks.filter((truck: any) => {
    if (activeFilter === 'DRIVING' && truck.statusCategory !== 'driving') return false;
    if (activeFilter === 'IDLING' && truck.statusCategory !== 'idling') return false;
    if (activeFilter === 'PARKED' && truck.statusCategory !== 'parked') return false;
    if (activeFilter === 'OFFLINE' && truck.statusCategory !== 'offline') return false;
    if (activeFilter === 'RFID' && !truck.rfidAlert) return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchPlate = String(truck.plate || '').toLowerCase().includes(q);
      const matchDriver = String(truck.driverName || '').toLowerCase().includes(q);
      const matchAddress = String(truck.address || '').toLowerCase().includes(q);
      return matchPlate || matchDriver || matchAddress;
    }
    return true;
  });

  const handleOpenModal = async (type: 'POI' | 'JOB' | 'HISTORY' | 'FUEL', truck: any) => {
    setModalTruck(truck);
    setActiveModal(type);
    setModalStep('form');
    setPoiName(`จุดจอด - ${truck.plate}`);
    setPoiRadius('0.5');

    if (type === 'JOB') {
      setLoadingJobs(true);
      try {
        const res = await fetch(`/api/jobs?plate=${encodeURIComponent(truck.plate)}&imei=${truck.imei || ''}`);
        const raw = await res.json();
        if (raw.success && raw.data) {
          setTruckJobs(raw.data);
        } else {
          setTruckJobs([]);
        }
      } catch (err) {
        console.error('Failed to fetch ThaiGPSTracker jobs:', err);
        setTruckJobs([]);
      } finally {
        setLoadingJobs(false);
      }
    } else if (type === 'FUEL') {
      setLoadingFuel(true);
      try {
        const res = await fetch(`/api/fuel?plate=${encodeURIComponent(truck.plate)}&imei=${truck.imei || ''}`);
        const raw = await res.json();
        if (raw.success) {
          setFuelData(raw);
        } else {
          setFuelData(null);
        }
      } catch (err) {
        console.error('Failed to fetch Fuel Analytics:', err);
        setFuelData(null);
      } finally {
        setLoadingFuel(false);
      }
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalTruck(null);
    setModalStep('form');
  };

  const handleSavePOI = async () => {
    if (!modalTruck || !poiName) return alert('กรุณาระบุชื่อจุดจอด');
    
    setModalStep('loading');
    try {
      const res = await fetch('/api/poi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: poiName,
          lat: modalTruck.lat,
          lon: modalTruck.lon,
          radius: poiRadius,
          address: modalTruck.address,
        })
      });
      const data = await res.json();
      if (data.success) {
        setModalStep('success');
        playSound('SUCCESS', true); 
      } else {
        alert('เกิดข้อผิดพลาด: ' + (data.message || 'บันทึกไม่สำเร็จ'));
        setModalStep('form');
      }
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์บันทึก POI ได้');
      setModalStep('form');
    }
  };

  const simulateAction = (targetStep: 'success' | 'result') => {
    setModalStep('loading');
    setTimeout(() => {
      if (targetStep === 'result' && modalTruck) {
        const str = String(modalTruck.statusText || '').toUpperCase();
        if (modalTruck.statusCategory === 'offline' || str.includes('OFFLINE') || str.includes('ออฟไลน์')) {
          setModalStep('nodata');
          return;
        }
      }
      setModalStep(targetStep);
    }, 600); 
  };

  const handleSelectNotification = (truck: any) => {
    setShowNotifications(false);
    setSelectedTruckId(truck.id);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* 🌟 1. LUXURY SWEETALERT (สำหรับรถ OFFLINE) */}
      {modalStep === 'nodata' && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl flex flex-col items-center pt-8 pb-6 px-8 w-[340px] shadow-2xl border border-slate-100">
            <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-500/20 flex items-center justify-center mb-5 text-blue-500 font-serif text-3xl font-bold italic">
              i
            </div>
            <div className="text-slate-800 text-lg font-black tracking-tight mb-1">ไม่พบข้อมูล</div>
            <p className="text-xs text-slate-400 font-medium text-center mb-6">รถคันนี้ออฟไลน์และไม่มีสัญญาณของวันนี้</p>
            <button 
              onClick={() => setModalStep('form')} 
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-xs cursor-pointer"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* 🌟 2. NOTIFICATION CENTER DRAWER (แผงแจ้งเตือนมุมขวาบนสุดหรู) */}
      {showNotifications && (
        <div className="fixed inset-0 z-[1500] flex justify-end bg-slate-900/20 backdrop-blur-xs animate-fade-in" onClick={() => setShowNotifications(false)}>
          <div 
            className="bg-white w-full max-w-sm h-full shadow-2xl flex flex-col border-l border-slate-100 transition-transform"
            onClick={(e) => e.stopPropagation()} 
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-base">🔔</span>
                <h3 className="font-black text-slate-800 text-sm tracking-tight">ศูนย์รวมการแจ้งเตือน (Alerts)</h3>
                <span className="bg-rose-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full">{alertsList.length}</span>
              </div>
              <button onClick={() => setShowNotifications(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer font-bold">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
              {alertsList.length === 0 ? (
                <div className="text-center py-20 text-slate-400 text-xs font-bold space-y-2">
                  <div className="text-3xl">🎉</div>
                  <div>ไม่มีเหตุผิดปกติในระบบขณะนี้</div>
                  <div className="text-[10px] text-slate-300 font-normal">รถทุกคันทำงานตามเงื่อนไขปกติ</div>
                </div>
              ) : (
                alertsList.map((alert: any, idx: number) => {
                  let badgeColor = 'bg-amber-50 text-amber-600 border-amber-200';
                  let icon = '⏳';
                  if (alert.type === 'RFID') { badgeColor = 'bg-rose-50 text-rose-600 border-rose-200'; icon = '🚨'; }
                  else if (alert.type === 'SPEED') { badgeColor = 'bg-purple-50 text-purple-600 border-purple-200'; icon = '⚡'; }
                  else if (alert.type === 'FUEL') { badgeColor = 'bg-red-600 text-white border-red-700 animate-pulse font-black'; icon = '⛽'; }

                  return (
                    <div 
                      key={idx} 
                      onClick={() => handleSelectNotification(alert.truck)}
                      className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer space-y-1.5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1 ${badgeColor}`}>
                          <span>{icon}</span> {alert.title}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 font-mono">{alert.time.split(' ')[1] || alert.time}</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="font-black text-slate-800 text-xs">{alert.truck.plate}</span>
                        <span className="text-[10px] font-bold text-indigo-600 underline">ดูพิกัด →</span>
                      </div>
                      <p className="text-[10px] font-medium text-slate-500 leading-snug line-clamp-2">{alert.desc}</p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-medium">อัปเดตแบบ Real-time</span>
              {alertsList.length > 0 && (
                <button onClick={() => setShowNotifications(false)} className="font-bold text-indigo-600 hover:underline cursor-pointer">ปิดหน้าต่าง</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🌟 LUXURY MODAL SYSTEM (Glassmorphism Backdrop) */}
      {activeModal && modalTruck && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-4 transition-all">
          
          {/* 📍 MODAL: กำหนดจุดจอด (POI) */}
          {activeModal === 'POI' && (
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-100">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <h3 className="font-black text-slate-800 text-sm tracking-tight">กำหนดจุดจอด (POI)</h3>
                </div>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer font-bold">✕</button>
              </div>
              
              {modalStep === 'form' ? (
                <>
                  <div className="p-6 overflow-y-auto text-xs space-y-4 font-medium text-slate-700">
                    <div>
                      <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">พิกัด GPS</label>
                      <input type="text" readOnly value={`${modalTruck.lat}, ${modalTruck.lon}`} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 text-slate-500 focus:outline-none font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">ชื่อจุดจอด <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        value={poiName}
                        onChange={(e) => setPoiName(e.target.value)}
                        placeholder="ระบุชื่อสถานที่..." 
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 focus:border-indigo-500 focus:outline-none transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">ที่อยู่</label>
                      <input type="text" defaultValue={modalTruck.address} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:border-indigo-500 focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">รัศมีการแจ้งเตือน (กม.)</label>
                      <input 
                        type="number" 
                        value={poiRadius}
                        onChange={(e) => setPoiRadius(e.target.value)}
                        step="0.1" 
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:border-indigo-500 focus:outline-none transition-colors font-bold" 
                      />
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2.5">
                    <button onClick={closeModal} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-5 rounded-xl text-xs transition-all cursor-pointer">ยกเลิก</button>
                    <button onClick={handleSavePOI} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl text-xs shadow-md shadow-indigo-500/20 transition-all cursor-pointer">บันทึกพิกัด</button>
                  </div>
                </>
              ) : modalStep === 'loading' ? (
                <div className="p-20 flex flex-col items-center justify-center text-slate-500">
                  <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                  <p className="font-black text-slate-700 text-sm">กำลังบันทึกพิกัดเข้าฐานข้อมูล API...</p>
                </div>
              ) : (
                <div className="p-16 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-2xl mb-4 border border-emerald-200/50 shadow-sm">✓</div>
                  <h3 className="font-black text-slate-800 text-lg mb-1">บันทึกจุดจอดเรียบร้อย</h3>
                  <p className="text-slate-400 text-xs mb-6">บันทึกสถานที่ [{poiName}] เข้าสู่ระบบเรียบร้อยแล้ว</p>
                  <button onClick={closeModal} className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-8 rounded-xl text-xs transition-all cursor-pointer shadow-md">ตกลง</button>
                </div>
              )}
            </div>
          )}

          {/* 📋 MODAL: ดูใบสั่งงาน (JOB) */}
          {activeModal === 'JOB' && (
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col border border-slate-100">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm tracking-tight">ใบสั่งงานขนส่ง (ThaiGPSTracker Live)</h3>
                    <p className="text-[10px] font-bold text-slate-400">รถทะเบียน: {modalTruck.plate} {modalTruck.imei !== 'ไม่ระบุ' && `(IMEI: ${modalTruck.imei})`}</p>
                  </div>
                </div>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer font-bold">✕</button>
              </div>

              <div className="p-6 overflow-x-auto min-h-[250px] flex flex-col justify-center">
                {loadingJobs ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <div className="w-8 h-8 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-xs font-black text-slate-500">กำลังซิงค์ใบสั่งงานจากเซิร์ฟเวอร์ gps.thaigpstracker...</p>
                  </div>
                ) : truckJobs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-bold text-xs space-y-2">
                    <div className="text-3xl">📭</div>
                    <div>ไม่พบรายการสั่งงานที่เปิดอยู่ของรถคันนี้ในระบบ GPS</div>
                    <p className="text-[10px] font-normal text-slate-400">ใบสั่งงานจะปรากฏอัตโนมัติเมื่อมีการปล่อยงาน (Dispatch) จากระบบต้นทาง</p>
                  </div>
                ) : (
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-3">Shipment No.</th>
                        <th className="py-3 px-3">เวลาปล่อยงาน</th>
                        <th className="py-3 px-3">ต้นทาง (Origin)</th>
                        <th className="py-3 px-3">ปลายทาง (Destination)</th>
                        <th className="py-3 px-3 text-right">น้ำหนัก (ตัน)</th>
                        <th className="py-3 px-3">ประเภท</th>
                        <th className="py-3 px-3 text-center">สถานะ GPS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {truckJobs.map((job: any, idx: number) => {
                        let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
                        const statusUpper = String(job.status || '').toUpperCase();
                        const textUpper = String(job.status_text || '').toUpperCase();
                        
                        if (statusUpper === 'COMPLETED' || textUpper.includes('เสร็จ')) {
                          badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-black';
                        } else if (statusUpper === 'CANCELLED' || textUpper.includes('ยกเลิก')) {
                          badgeColor = 'bg-rose-50 text-rose-600 border-rose-200';
                        }

                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3 font-black text-slate-800 font-mono">{job.shipment_no || job.job_id}</td>
                            <td className="py-3 px-3 text-slate-500 text-[11px]">{new Date(job.created_at || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</td>
                            <td className="py-3 px-3 font-bold text-slate-700 max-w-[140px] truncate" title={job.origin}>{job.origin || '-'}</td>
                            <td className="py-3 px-3 font-bold text-indigo-600 max-w-[140px] truncate" title={job.destination}>{job.destination || '-'}</td>
                            <td className="py-3 px-3 text-right font-black font-mono">{job.weight ? Number(job.weight).toFixed(2) : '0.00'}</td>
                            <td className="py-3 px-3 text-slate-600">{job.job_type || 'ขนส่งอ้อย'}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2.5 py-1 rounded-md text-[10px] border inline-block ${badgeColor}`}>
                                {job.status_text || job.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-[11px]">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  เชื่อมต่อระบบใบสั่งงาน gps.thaigpstracker เรียลไทม์
                </span>
                <button onClick={closeModal} className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-6 rounded-xl text-xs transition-all shadow-md cursor-pointer">ปิดหน้าต่าง</button>
              </div>
            </div>
          )}

          {/* =========================================================================
              ⛽ MODAL: วิเคราะห์น้ำมัน (FUEL THEFT & COST ANALYTICS) — ข้อมูลจริง!
              ========================================================================= */}
          {activeModal === 'FUEL' && (
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col border border-slate-100 max-h-[90vh]">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-500 to-orange-600 text-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">⛽</span>
                  <div>
                    <h3 className="font-black text-sm tracking-tight">รายงานวิเคราะห์ค่าน้ำมัน & ตรวจจับการดูดน้ำมัน (AI Fuel Radar)</h3>
                    <p className="text-[10px] font-bold text-orange-100">รถทะเบียน: {modalTruck.plate} {modalTruck.imei !== 'ไม่ระบุ' && `(IMEI: ${modalTruck.imei})`}</p>
                  </div>
                </div>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 text-white flex items-center justify-center transition-colors cursor-pointer font-bold">✕</button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-5 bg-slate-50/50">
                {loadingFuel ? (
                  <div className="flex flex-col items-center justify-center py-16 space-y-3">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-orange-600 rounded-full animate-spin"></div>
                    <p className="text-xs font-black text-slate-500">กำลังประมวลผลการใช้น้ำมันและตรวจจับสิ่งผิดปกติจากดาวเทียม...</p>
                  </div>
                ) : !fuelData ? (
                  <div className="text-center py-12 text-slate-400 font-bold text-xs space-y-2">
                    <div className="text-3xl">📭</div>
                    <div>ไม่พบข้อมูลระดับน้ำมันของรถคันนี้</div>
                    <p className="text-[10px] font-normal text-slate-400">รถอาจไม่ติดตั้งเซนเซอร์วัดระดับน้ำมัน หรือสัญญาณขาดหาย</p>
                  </div>
                ) : (
                  <>
                    {/* 🚨 กล่องแจ้งเตือนการดูดน้ำมัน (ถ้าตรวจพบจริงจาก API) */}
                    {fuelData.theftAlert?.isDetected ? (
                      <div className="bg-red-600 text-white p-4 rounded-2xl shadow-lg border-2 border-red-400 animate-pulse space-y-2">
                        <div className="flex items-center justify-between font-black text-sm">
                          <span className="flex items-center gap-2"><span>🚨</span> ตรวจพบสิ่งผิดปกติ: สงสัยมีการลักลอบดูด/รั่วไหลของน้ำมัน!</span>
                          <span className="bg-white text-red-600 text-[10px] px-2.5 py-0.5 rounded-full font-mono">{fuelData.theftAlert.details.timeDetected}</span>
                        </div>
                        <div className="text-xs font-bold text-red-100 space-y-1">
                          <div>📍 สถานที่: <span className="text-white underline">{fuelData.theftAlert.details.location}</span></div>
                          <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-center">
                            <div className="bg-red-800/80 p-2 rounded-xl border border-red-500">ระดับน้ำมันลด: <span className="text-white font-black text-sm block">{fuelData.theftAlert.details.fuelDropPercent}</span></div>
                            <div className="bg-red-800/80 p-2 rounded-xl border border-red-500">ปริมาณที่หาย: <span className="text-white font-black text-sm block">{fuelData.theftAlert.details.litersLost}</span></div>
                            <div className="bg-red-800/80 p-2 rounded-xl border border-red-500">มูลค่าสูญเสีย: <span className="text-yellow-300 font-black text-sm block">{fuelData.theftAlert.details.estimatedLossBaht}</span></div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
                        <span className="text-xs font-black flex items-center gap-2"><span>🟢</span> สถานะระดับน้ำมันปกติ ไม่พบข้อสงสัยการลักลอบดูดน้ำมัน</span>
                        <span className="text-[10px] font-bold bg-emerald-200/60 px-2 py-0.5 rounded text-emerald-700">ปลอดภัย 100%</span>
                      </div>
                    )}

                    {/* 📊 การ์ดสรุปความคุ้มค่า (Cost per Ton-Km) */}
                    <div className="space-y-2">
                      <div className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                        <span>📊</span> วิเคราะห์ความคุ้มค่าการขนส่งอ้อย (ราคาน้ำมันอ้างอิง: {fuelData.fuelPriceBaht} บาท/ลิตร)
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs text-center">
                          <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">อัตราสิ้นเปลือง</span>
                          <span className="text-2xl font-black text-indigo-600">{fuelData.analytics?.efficiencyKmPerLiter || '-'}</span>
                        </div>
                        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs text-center">
                          <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">ต้นทุนต่อระยะทาง</span>
                          <span className="text-2xl font-black text-slate-800">{fuelData.analytics?.costPerKmBaht || '-'}</span>
                        </div>
                        <div className="bg-white border border-orange-200 bg-orange-50/30 p-4 rounded-2xl shadow-2xs text-center">
                          <span className="text-[10px] font-black uppercase text-orange-600 block mb-1">ต้นทุนต่ออ้อย 1 ตัน ⭐</span>
                          <span className="text-2xl font-black text-orange-600">{fuelData.analytics?.costPerTonBaht || '-'}</span>
                        </div>
                      </div>
                      <div className="text-[11px] font-bold text-slate-500 bg-white p-3 rounded-xl border border-slate-200/60 flex justify-between items-center">
                        <span>💡 สรุปการประเมิน: <span className="font-black text-slate-800">{fuelData.analytics?.summaryText || 'กำลังเก็บข้อมูลสถิติ'}</span></span>
                        <span className="text-[10px] text-slate-400 font-mono">ส่งอ้อยแล้ว {fuelData.analytics?.rawStats?.deliveredTons || 0} ตัน</span>
                      </div>
                    </div>

                    {/* 📜 ตารางประวัติระดับน้ำมันย้อนหลัง */}
                    <div className="space-y-2">
                      <div className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                        <span>📈</span> บันทึกระดับถังน้ำมันย้อนหลัง (Fuel Level History)
                      </div>
                      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                            <tr>
                              <th className="py-2.5 px-4">เวลา</th>
                              <th className="py-2.5 px-4">สถานะรถ</th>
                              <th className="py-2.5 px-4 text-center">ความเร็ว</th>
                              <th className="py-2.5 px-4 text-right">ระดับน้ำมัน (%)</th>
                              <th className="py-2.5 px-4 text-right">ปริมาณ (ลิตร)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                            {fuelData.history && fuelData.history.length > 0 ? (
                              fuelData.history.map((h: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50/80">
                                  <td className="py-2.5 px-4 font-mono text-slate-500">{h.time}</td>
                                  <td className="py-2.5 px-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] ${h.status.includes('วิ่ง') ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{h.status}</span>
                                  </td>
                                  <td className="py-2.5 px-4 text-center font-mono">{h.speed} กม./ชม.</td>
                                  <td className="py-2.5 px-4 text-right font-mono font-black text-indigo-600">{h.fuelPercent}%</td>
                                  <td className="py-2.5 px-4 text-right font-mono">{h.fuelLiters} ลิตร</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="text-center py-6 text-slate-400 font-medium">ไม่พบประวัติการลดลงของน้ำมันในรอบวัน</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-[11px] shrink-0">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  ระบบ AI ตรวจจับน้ำมันรั่วไหล & วิเคราะห์ต้นทุนเรียลไทม์
                </span>
                <button onClick={closeModal} className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-6 rounded-xl text-xs transition-all shadow-md cursor-pointer">ปิดหน้าต่าง</button>
              </div>
            </div>
          )}

          {/* 🕒 MODAL: ดูข้อมูลย้อนหลัง (HISTORY RADAR LIVE) */}
          {activeModal === 'HISTORY' && (
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-slate-100 max-h-[90vh]">
              
              {/* Header */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm tracking-tight">ดูข้อมูลย้อนหลัง (History Radar Live)</h3>
                    <p className="text-[10px] font-bold text-slate-400">ทะเบียน: <span className="text-indigo-600 font-black">{modalTruck.plate}</span> (IMEI: {modalTruck.imei})</p>
                  </div>
                </div>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer font-bold">✕</button>
              </div>
              
              {/* ตัวเลือกเวลาและปุ่มค้นหา */}
              <div className="p-5 border-b border-slate-100 bg-white shrink-0 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">วันเริ่มต้น</label>
                    <input id="hist-start-date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">เวลาเริ่มต้น</label>
                    <input id="hist-start-time" type="time" defaultValue="00:00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">วันสิ้นสุด</label>
                    <input id="hist-end-date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">เวลาสิ้นสุด</label>
                    <input id="hist-end-time" type="time" defaultValue="23:59" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50/50 focus:outline-none" />
                  </div>
                </div>

                {/* 🌟 ปุ่มสลับ 2 โหมด */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button 
                    onClick={async () => {
                      setModalStep('loading');
                      const sDate = (document.getElementById('hist-start-date') as HTMLInputElement)?.value || '';
                      const eDate = (document.getElementById('hist-end-date') as HTMLInputElement)?.value || '';
                      const sTime = (document.getElementById('hist-start-time') as HTMLInputElement)?.value || '00:00';
                      const eTime = (document.getElementById('hist-end-time') as HTMLInputElement)?.value || '23:59';

                      try {
                        const res = await fetch(`/api/history?imei=${modalTruck.imei}&mode=history&startDate=${sDate}&endDate=${eDate}&startTime=${sTime}&endTime=${eTime}`);
                        const raw = await res.json();
                        if (raw.success) {
                          setHistoryList(raw.data || []);
                          setHistorySummary(raw.summary || { totalDistance: '0.00', totalDuration: '-', totalStops: raw.data?.length || 0 });
                          setModalStep('result');
                        } else {
                          alert('ไม่พบข้อมูลเส้นทางในระบบ');
                          setModalStep('form');
                        }
                      } catch (e) {
                        alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
                        setModalStep('form');
                      }
                    }}
                    className="py-2.5 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20"
                  >
                    <span>🛣️</span> <span>แสดงข้อมูลเส้นทาง (Route)</span>
                  </button>
                  <button 
                    onClick={async () => {
                      setModalStep('loading');
                      const sDate = (document.getElementById('hist-start-date') as HTMLInputElement)?.value || '';
                      const eDate = (document.getElementById('hist-end-date') as HTMLInputElement)?.value || '';
                      const sTime = (document.getElementById('hist-start-time') as HTMLInputElement)?.value || '00:00';
                      const eTime = (document.getElementById('hist-end-time') as HTMLInputElement)?.value || '23:59';

                      try {
                        const res = await fetch(`/api/history?imei=${modalTruck.imei}&mode=parking&startDate=${sDate}&endDate=${eDate}&startTime=${sTime}&endTime=${eTime}`);
                        const raw = await res.json();
                        if (raw.success) {
                          setHistoryList(raw.data || []); 
                          setHistorySummary(raw.summary || { totalDistance: '0.00', totalDuration: '-', totalStops: raw.data?.length || 0 });
                          setModalStep('result');
                        } else {
                          alert('ไม่พบข้อมูลจุดจอดในระบบ');
                          setModalStep('form');
                        }
                      } catch (e) {
                        alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
                        setModalStep('form');
                      }
                    }}
                    className="py-2.5 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
                  >
                    <span>🛑</span> <span>สรุปจุดจอดรถ (Stops)</span>
                  </button>
                </div>
              </div>

              {/* ส่วนแสดงผลข้อมูล */}
              {modalStep === 'loading' && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-3 bg-slate-50/50">
                  <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="font-black text-xs text-slate-600">กำลังซิงค์พิกัดและคำนวณระยะทางจากดาวเทียม...</p>
                </div>
              )}

              {/* 🌟 LUXURY RESULT DISPLAY */}
              {modalStep === 'result' && (
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
                  
                  <div className="p-5 pb-2 grid grid-cols-3 gap-2.5 shrink-0">
                    <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs">
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">ระยะทางรวมวันนี้</span>
                      <span className="text-xl font-black text-slate-800">{historySummary.totalDistance} <span className="text-[10px] font-bold text-slate-400">กม.</span></span>
                    </div>
                    <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs">
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">จุดจอดทั้งหมด</span>
                      <span className="text-xl font-black text-indigo-600">{historyList.length} <span className="text-[10px] font-bold text-slate-400">จุด</span></span>
                    </div>
                    <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs">
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">ระยะเวลารวม</span>
                      <span className="text-sm font-black text-amber-600 truncate block mt-1" title={historySummary.totalDuration}>{historySummary.totalDuration}</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 pt-3 space-y-2.5 custom-scrollbar max-h-[350px]">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                      รายละเอียดรายการ ({historyList.length} รายการ)
                    </div>

                    {historyList.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 font-bold text-xs">ไม่พบข้อมูลในเงื่อนไขที่เลือก</div>
                    ) : (
                      historyList.map((item: any, idx: number) => {
                        const timeStr = item.time || item.timeStart || item.timeEnd || item.sort || item.recorded_at || item.datetime || `รายการ #${idx+1}`;
                        const addrStr = item.address || item.nearest || item.location || item.poi_name || modalTruck.address;
                        const speedVal = item.speed || item.spd || '0';
                        const fuelVal = item.oil ? `${item.oil}%` : (item.fuel || '0%');
                        const tempVal = item.temperature !== undefined && item.temperature !== null ? `${item.temperature}°C` : (item.temp || '0°C');
                        const durationVal = item.timeDuration || item.duration || item.stop_time || item.park_time || null;

                        let badgeBg = 'bg-blue-50 text-blue-700 border-blue-200';
                        let icon = '🔵';
                        if (Number(speedVal) > 0 || String(item.status).includes('วิ่ง') || item.class === 'CLASS_ONLINE') { 
                          badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200'; icon = '🟢'; 
                        } else if (String(item.status).includes('ติดเครื่อง')) { 
                          badgeBg = 'bg-amber-50 text-amber-700 border-amber-200'; icon = '🟠'; 
                        } else if (String(item.status).includes('ดับเครื่อง') || String(item.status).includes('จอด') || item.class === 'CLASS_ENGINE_OFF') { 
                          badgeBg = 'bg-rose-50 text-rose-700 border-rose-200'; icon = '🔴'; 
                        }

                        return (
                          <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:shadow-md transition-all space-y-1.5">
                            <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-1.5 font-mono text-xs font-black text-slate-800">
                                <span>{icon}</span>
                                <span>[{timeStr}]</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${badgeBg}`}>
                                {item.status || (Number(speedVal) > 0 ? 'กำลังวิ่ง' : `Stop #${historyList.length - idx}`)}
                              </span>
                            </div>

                            <div className="text-xs font-bold text-slate-700 leading-snug">
                              <span className="text-slate-400 font-normal">สถานที่: </span>{addrStr}
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1 text-[10px] font-bold text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100/80">
                              <div><span className="text-slate-400">Fuel: </span><span className="text-indigo-600 font-mono font-black">{fuelVal}</span></div>
                              <div><span className="text-slate-400">Temp: </span><span className="text-slate-800 font-mono font-black">{tempVal}</span></div>
                              <div><span className="text-slate-400">Spd: </span><span className="text-emerald-600 font-mono font-black">{speedVal} กม./ชม.</span></div>
                              {durationVal && (
                                <div className="col-span-3 sm:col-span-1 border-t sm:border-t-0 pt-1 sm:pt-0 border-slate-200 text-right sm:text-left">
                                  <span className="text-slate-400">จอดนาน: </span><span className="text-rose-600 font-black">{durationVal}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="px-6 py-3.5 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
                    <button onClick={() => setModalStep('form')} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs transition-all cursor-pointer">← เลือกเวลาใหม่</button>
                    <button onClick={closeModal} className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-6 rounded-xl text-xs transition-all shadow-md cursor-pointer">เสร็จสิ้น</button>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* 🌟 Header Toolbar (รวมปุ่มเชื่อมแดชบอร์ดผู้บริหาร + Action Bar มัลติมีเดีย) */}
      <div className="bg-white border-b border-slate-200 shrink-0 z-20 h-[60px] sm:h-[70px] flex items-center px-4 justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="w-9 h-9 sm:w-10 sm:h-10 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg flex items-center justify-center transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-md text-lg">🚚</div>
          <div className="flex flex-col">
            <h1 className="text-base sm:text-lg font-black text-slate-800 leading-none">ศูนย์ควบคุมคิวรถ (Live Radar)</h1>
            <p className="text-[10px] sm:text-[11px] font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> เชื่อมต่อระบบ GPS สำเร็จ
            </p>
          </div>
        </div>

        {/* 🌟 ACTION BAR มุมขวาบน */}
        <div className="flex items-center gap-2">
          
          <button 
            onClick={() => router.push('/executive-dashboard')}
            className="px-3 py-1.5 rounded-xl border border-orange-400/30 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-orange-500/20 hover:opacity-95 transition-all"
            title="กลับสู่หน้าแดชบอร์ดผู้บริหาร"
          >
            <span>📊</span> <span className="hidden sm:inline">แดชบอร์ดผู้บริหาร</span>
          </button>

          <button 
            onClick={() => playSound('TEST', true)}
            className="px-2.5 py-1.5 rounded-xl border bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-xs"
            title="คลิกเพื่อทดสอบเสียงลำโพง"
          >
            <span>🎵</span> <span className="hidden sm:inline">ทดสอบเสียง</span>
          </button>

          <button 
            onClick={handleToggleMute} 
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-xs ${isMuted ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-indigo-500/10'}`}
            title={isMuted ? "คลิกเพื่อเปิดเสียงเตือนภัย (Unmute)" : "ปิดเสียงเตือน (Mute)"}
          >
            <span className="text-base">{isMuted ? '🔇' : '🔊'}</span>
          </button>

          <button 
            onClick={() => setShowNotifications(true)} 
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${alertsList.length > 0 ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 animate-pulse font-black' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 font-bold'}`}
          >
            <span className="text-sm">🔔</span>
            <span className="text-xs">แจ้งเตือน ({alertsList.length})</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
        
        {/* 🗺️ MAP CONTAINER */}
        <div className="order-1 lg:order-2 w-full lg:flex-1 h-[40vh] lg:h-full relative z-0 border-b lg:border-b-0 lg:border-l border-slate-300 shadow-inner bg-slate-900">
          {!loading && <DynamicMapFleet trucks={filteredTrucks} selectedId={selectedTruckId} onOpenModal={handleOpenModal} />}
          
          <div className="absolute top-4 left-4 z-[400] bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] sm:text-xs font-black text-slate-700 shadow-lg flex items-center gap-2">
             <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> 
             ดาวเทียม: แสดงบนแผนที่ {filteredTrucks.length} จาก {trucks.length} คัน
          </div>
        </div>

        {/* 📋 LIST CONTAINER */}
        <div className="order-2 lg:order-1 w-full lg:w-[440px] xl:w-[480px] h-[60vh] lg:h-full bg-slate-50 z-10 flex flex-col shadow-[10px_0_20px_-5px_rgba(0,0,0,0.1)]">
          
          <div className="p-4 shrink-0 bg-white border-b border-slate-200 z-10 shadow-sm space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">สถานะรถทั้งหมด</div>
                <div className="text-2xl font-black text-slate-800 leading-none">
                  {filteredTrucks.length} <span className="text-xs text-slate-400 font-bold">/ {trucks.length} คัน</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-slate-400 mb-1">อัปเดต: {lastUpdate}</div>
              </div>
            </div>

            {/* 🔍 ช่องค้นหาอัจฉริยะ */}
            <div className="relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 ค้นหาทะเบียน, ชื่อคนขับ, หรือสถานที่..." 
                className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all shadow-inner"
              />
              <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">✕</button>
              )}
            </div>

            {/* 👉 ปุ่มกดคัดกรองสถานะ (Grid Layout 3x2) */}
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-black pt-1">
              <button 
                onClick={() => setActiveFilter('ALL')} 
                className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 border cursor-pointer ${activeFilter === 'ALL' ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-slate-100 text-slate-600 border-slate-200/60 hover:bg-slate-200'}`}
              >
                <span>📊 ทั้งหมด ({trucks.length})</span>
              </button>
              <button 
                onClick={() => setActiveFilter('DRIVING')} 
                className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 border cursor-pointer ${activeFilter === 'DRIVING' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="truncate">วิ่งอยู่ ({drivingCount})</span>
              </button>
              <button 
                onClick={() => setActiveFilter('IDLING')} 
                className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 border cursor-pointer ${activeFilter === 'IDLING' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-amber-50 text-amber-700 border-amber-200/60 hover:bg-amber-100'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                <span className="truncate">ติดเครื่อง ({idlingCount})</span>
              </button>
              <button 
                onClick={() => setActiveFilter('PARKED')} 
                className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 border cursor-pointer ${activeFilter === 'PARKED' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-blue-50 text-blue-700 border-blue-200/60 hover:bg-blue-100'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                <span className="truncate">ดับเครื่อง ({parkedCount})</span>
              </button>
              <button 
                onClick={() => setActiveFilter('OFFLINE')} 
                className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 border cursor-pointer ${activeFilter === 'OFFLINE' ? 'bg-slate-500 text-white border-slate-500 shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200/60 hover:bg-slate-200'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
                <span className="truncate">ออฟไลน์ ({offlineCount})</span>
              </button>
              <button 
                onClick={() => setActiveFilter('RFID')} 
                className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 border cursor-pointer ${activeFilter === 'RFID' ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-rose-50 text-rose-600 border-rose-200/60 hover:bg-rose-100'} ${noRfidCount > 0 ? 'animate-pulse font-black' : 'opacity-80'}`}
              >
                <span className="shrink-0">🚨</span>
                <span className="truncate">ไม่รูดบัตร ({noRfidCount})</span>
              </button>
            </div>

          </div>

          {/* รายการรถที่ถูกคัดกรองแล้ว */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-3 pb-24 lg:pb-4">
            
            {loading ? (
              <div className="text-center p-10 text-slate-400 font-bold animate-pulse text-sm">กำลังซิงค์ข้อมูลกับดาวเทียม...</div>
            ) : filteredTrucks.length === 0 ? (
              <div className="text-center p-12 bg-white rounded-2xl border border-slate-200 text-slate-400 font-bold text-xs space-y-2">
                <div className="text-2xl">🔍</div>
                <div>ไม่พบรถที่ตรงกับเงื่อนไขการค้นหา</div>
                <button onClick={() => { setSearchQuery(''); setActiveFilter('ALL'); }} className="text-indigo-600 underline text-[11px] cursor-pointer">ล้างค่าการค้นหา</button>
              </div>
            ) : (
              filteredTrucks.map((truck: any) => { 
                const isExpanded = selectedTruckId === truck.id;
                const isOnline = truck.statusCategory !== 'offline';
                
                return (
                  <div key={truck.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                    
                    <div 
                      onClick={() => setSelectedTruckId(isExpanded ? null : truck.id)} 
                      className={`flex flex-col relative p-3 sm:p-4 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${truck.statusColor}`}></div>
                      
                      <div className="pl-2 w-full flex justify-between items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-[15px] font-black text-slate-800 leading-none">{truck.plate}</h3>
                            {truck.rfidAlert && (
                              <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span> ไม่รูดบัตร
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-slate-500 truncate mt-1">
                            📍 {truck.near || truck.address}
                          </div>
                        </div>
                        
                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                          <div className={`px-2 py-0.5 rounded text-[10px] font-black text-white shadow-sm ${truck.statusColor}`}>
                            {truck.statusText}
                          </div>
                          {isOnline && <div className="text-[10px] font-bold text-slate-400">{truck.time.split(' ')[0]}</div>}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                        
                        {truck.rfidAlert && (
                          <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
                            <div className="text-rose-500 mt-0.5">🚨</div>
                            <div>
                              <div className="text-[11px] font-black text-rose-700">แจ้งเตือน: ไม่ได้รูดบัตร (RFID)</div>
                              <div className="text-[10px] font-medium text-rose-600 mt-0.5">สตาร์ทเครื่องยนต์หรือรถเคลื่อนที่โดยไม่ยืนยันตัวตนคนขับ</div>
                            </div>
                          </div>
                        )}

                        <div className="mb-3 bg-white border border-slate-100 rounded-lg p-2.5 shadow-sm">
                          <div className="grid grid-cols-2 gap-y-1.5 text-[10px]">
                            <div><span className="text-slate-400 font-bold">ชื่อสินทรัพย์:</span> <span className="font-black text-rose-500">ไม่ระบุ</span></div>
                            <div><span className="text-slate-400 font-bold">IMEI:</span> <span className="font-black text-slate-700">{truck.imei}</span></div>
                            <div><span className="text-slate-400 font-bold">เวลาอุปกรณ์:</span> <span className="font-black text-slate-700">{truck.time}</span></div>
                            <div><span className="text-slate-400 font-bold">เวลาเซิร์ฟเวอร์:</span> <span className="font-black text-slate-700">{truck.serverTime}</span></div>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-100 rounded-lg p-3 mb-3 shadow-sm flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 shrink-0 border border-indigo-100">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-slate-400 font-bold mb-0.5">คนขับปัจจุบัน {truck.driverId !== '-' && `(รหัส: ${truck.driverId})`}</div>
                            <div className={`text-xs font-black truncate ${truck.rfidAlert ? 'text-rose-500' : 'text-slate-700'}`}>
                              {truck.driverName}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div className="bg-white border border-slate-100 p-2 rounded-lg shadow-sm">
                            <div className="text-slate-400 font-bold mb-1">⏱️ เลขไมล์</div>
                            <div className="font-black text-slate-700 truncate">{truck.mileage.toLocaleString()} กม.</div>
                          </div>
                          <div className="bg-white border border-slate-100 p-2 rounded-lg shadow-sm">
                            <div className="text-slate-400 font-bold mb-1">💨 ความเร็ว</div>
                            <div className={`font-black ${truck.speed > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>{truck.speed} <span className="text-[9px] font-medium text-slate-500">/{truck.overspeed}</span></div>
                          </div>
                          <div className="bg-white border border-slate-100 p-2 rounded-lg shadow-sm">
                            <div className="text-slate-400 font-bold mb-1">⚡ แบตเตอรี่</div>
                            <div className="font-black text-slate-700">{truck.battery}</div>
                          </div>
                          <div className="bg-white border border-slate-100 p-2 rounded-lg shadow-sm">
                            <div className="text-slate-400 font-bold mb-1">⛽ น้ำมัน</div>
                            <div className="font-black text-slate-700">{truck.oil > 0 ? `${truck.oil}%` : <span className="text-slate-400 font-medium">ไม่พบ</span>}</div>
                          </div>
                          <div className="bg-white border border-slate-100 p-2 rounded-lg shadow-sm">
                            <div className="text-slate-400 font-bold mb-1">🔥 อุณหภูมิ</div>
                            <div className="font-black text-slate-700">{truck.temp !== 'ไม่ระบุ' ? `${truck.temp}°C` : <span className="text-slate-400 font-medium">ไม่พบ</span>}</div>
                          </div>
                          <div className="bg-white border border-slate-100 p-2 rounded-lg shadow-sm">
                            <div className="text-slate-400 font-bold mb-1">☁️ แก๊ส</div>
                            <div className="font-black text-slate-700">{truck.gas !== 'ไม่ระบุ' ? truck.gas : <span className="text-slate-400 font-medium">ไม่พบ</span>}</div>
                          </div>
                        </div>

                        <div className="mt-3 bg-white border border-slate-100 rounded-lg p-2.5 shadow-sm">
                          <div className="grid grid-cols-2 gap-y-1.5 text-[10px]">
                            <div><span className="text-slate-400 font-bold">เซนเซอร์ยาง:</span> <span className={`font-black ${truck.tyreStatus === 'ปกติ' ? 'text-emerald-600' : 'text-slate-700'}`}>{truck.tyreStatus}</span></div>
                            <div><span className="text-slate-400 font-bold">เข็มขัดนิรภัย:</span> <span className={`font-black ${truck.beltStatus === 'ปกติ' ? 'text-emerald-600' : 'text-slate-700'}`}>{truck.beltStatus}</span></div>
                            <div><span className="text-slate-400 font-bold">ทิศทางหน้ารถ:</span> <span className="font-black text-slate-700">{truck.angle}°</span></div>
                            <div><span className="text-slate-400 font-bold">ระยะห่าง POI:</span> <span className="font-black text-slate-700">{truck.poiDistance}</span></div>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <div className="text-[10px] font-bold text-slate-400 mb-1 flex justify-between">
                            <span>พิกัด GPS</span>
                            <span>GSM: {truck.gsm}% | Sat: {truck.sat}</span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-600 leading-snug">
                            {truck.address} <br/>
                            <span className="text-[10px] text-slate-400 block mt-0.5">({truck.lat}, {truck.lon})</span>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .custom-popup .leaflet-popup-content-wrapper { padding: 0; border-radius: 1rem; overflow: hidden; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.25); border: 1px solid rgba(241, 245, 249, 1); }
        .custom-popup .leaflet-popup-content { margin: 0; width: auto !important; }
        .custom-popup .leaflet-popup-tip { box-shadow: none; }
      `}</style>
    </div>
  );
}