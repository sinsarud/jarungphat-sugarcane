'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  totalWeight: number;
  totalRevenue: number;
  totalWages: number;
  totalExpenses: number; 
  netProfit: number;
  freshWeight: number;
  burntWeight: number;
  factoryShare: { name: string; weight: number }[];
  dailyTrend: { date: string; weight: number }[];
  presentToday: number;
  totalEmployees: number;
  totalAdvanceAmount: number;
  advanceRequestsCount: number;
  lowStockItems: { name: string; stock: number; unit: string; min_stock: number }[]; 
  heavyMachinery: { available: number; inUse: number; maintenance: number };
  gpsFleet: { driving: number; idling: number; parked: number; offline: number; rfidAlerts: number; speedAlerts: number };
}

export default function ExecutiveDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false); 
  const [currentYear, setCurrentYear] = useState('2569'); 
  
  const [stats, setStats] = useState<DashboardStats>({
    totalWeight: 0,
    totalRevenue: 0,
    totalWages: 0,
    totalExpenses: 0,
    netProfit: 0,
    freshWeight: 0,
    burntWeight: 0,
    factoryShare: [],
    dailyTrend: [],
    presentToday: 0,
    totalEmployees: 0, 
    totalAdvanceAmount: 0,
    advanceRequestsCount: 0,
    lowStockItems: [],
    heavyMachinery: { available: 0, inUse: 0, maintenance: 0 },
    gpsFleet: { driving: 0, idling: 0, parked: 0, offline: 0, rfidAlerts: 0, speedAlerts: 0 }
  });

  const basePrice = 1000;
  const burntPenalty = 30;

  useEffect(() => {
    fetchAllRealData(true);
    
    // Silent Background Sync: ซิงค์เงียบๆ ทุก 1 นาที โดยไม่ทำให้หน้าจอกะพริบ
    const silentInterval = setInterval(() => {
      fetchAllRealData(false);
    }, 60000);

    return () => clearInterval(silentInterval);
  }, [currentYear]);

  const fetchAllRealData = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setIsSyncing(true); 
    }
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const gregorianYear = (Number(currentYear) - 543).toString();

      // 1. ดึงข้อมูลส่งอ้อย (รายรับ)
      const { data: sugarcaneData } = await supabase
        .from('sugarcane_deliveries')
        .select('date, net_weight, cane_type, factory_name')
        .gte('date', `${gregorianYear}-01-01`)
        .lte('date', `${gregorianYear}-12-31`);

      let totalW = 0;
      let totalRev = 0;
      let freshW = 0;
      let burntW = 0;
      const factoryMap: Record<string, number> = {};
      const dailyMap: Record<string, number> = {};

      if (sugarcaneData) {
        sugarcaneData.forEach(row => {
          const w = Number(row.net_weight || 0);
          totalW += w;
          
          if (row.cane_type === 'สด') {
            freshW += w;
            totalRev += (w * basePrice);
          } else {
            burntW += w;
            totalRev += (w * (basePrice - burntPenalty));
          }

          const fac = row.factory_name || 'ไม่ระบุ';
          factoryMap[fac] = (factoryMap[fac] || 0) + w;

          const d = row.date;
          dailyMap[d] = (dailyMap[d] || 0) + w;
        });
      }

      const factoryShare = Object.entries(factoryMap).map(([name, weight]) => ({ name, weight }));
      const sortedDates = Object.keys(dailyMap).sort().slice(-7); 
      const dailyTrend = sortedDates.map(date => ({ date, weight: dailyMap[date] }));

      // 2. ดึงข้อมูลค่าแรงทั้งปี
      const { data: yearlyWages } = await supabase
        .from('daily_attendance')
        .select('wage')
        .gte('date', `${gregorianYear}-01-01`)
        .lte('date', `${gregorianYear}-12-31`);
      
      const totalWages = yearlyWages ? yearlyWages.reduce((sum, item) => sum + Number(item.wage || 0), 0) : 0;

      // 3. ดึงข้อมูลบิลค่าใช้จ่ายอื่นๆ
      let totalExpenses = 0;
      try {
        const { data: expensesData } = await supabase
          .from('farm_expenses')
          .select('amount')
          .gte('expense_date', `${gregorianYear}-01-01`)
          .lte('expense_date', `${gregorianYear}-12-31`);
        
        totalExpenses = expensesData ? expensesData.reduce((sum, item) => sum + Number(item.amount || 0), 0) : 0;
      } catch (expErr) {
        console.warn('ยังไม่มีระบบค่าใช้จ่าย หรือดึงข้อมูลไม่ได้');
      }

      const netProfit = totalRev - totalWages - totalExpenses; 

      // 4. ดึงจำนวนพนักงานมาทำงานวันนี้
      const { data: attendanceData } = await supabase
        .from('daily_attendance')
        .select('id')
        .eq('date', today)
        .neq('work_type', 'ขาด')
        .neq('work_type', 'LA');
      const presentCount = attendanceData ? attendanceData.length : 0;

      // 5. ดึงยอดรวมเงินเบิก
      const { data: advanceData } = await supabase
        .from('advance_payments')
        .select('amount');
      
      const advanceCount = advanceData ? advanceData.length : 0;
      const advanceSum = advanceData ? advanceData.reduce((sum, item) => sum + Number(item.amount || 0), 0) : 0;

      // 6. ดึงข้อมูลสินค้าคงคลัง
      let lowStockItems: any[] = [];
      try {
        const { data: inventoryData } = await supabase
          .from('inventory') 
          .select('name, stock, min_stock, unit');
        
        if (inventoryData) {
          lowStockItems = inventoryData.filter((item: any) => Number(item.stock) <= Number(item.min_stock));
        }
      } catch (invErr) {
        console.warn('ระบบคลังสินค้ามีปัญหาการเชื่อมต่อ');
      }

      // 7.1 ดึงข้อมูล "เครื่องจักรไร่" จากฐานข้อมูลเดิม
      let machinery = { available: 0, inUse: 0, maintenance: 0 };
      try {
        const { data: vehiclesData } = await supabase.from('vehicles').select('status');
        if (vehiclesData) {
          vehiclesData.forEach(v => {
            if (v.status === 'AVAILABLE') machinery.available++;
            else if (v.status === 'IN_USE') machinery.inUse++;
            else if (v.status === 'MAINTENANCE') machinery.maintenance++;
          });
        }
      } catch (machineryErr) {
        console.warn('ดึงข้อมูลเครื่องจักรไร่ไม่สำเร็จ');
      }

      // 7.2 ดึงข้อมูล "รถขนส่งอ้อย GPS Radar" จาก API
      let fleet = { driving: 0, idling: 0, parked: 0, offline: 0, rfidAlerts: 0, speedAlerts: 0 };
      try {
        const fleetRes = await fetch('/api/fleet');
        const fleetRaw = await fleetRes.json();
        const fleetArray = fleetRaw.data && Array.isArray(fleetRaw.data) ? fleetRaw.data : (Array.isArray(fleetRaw) ? fleetRaw : Object.values(fleetRaw));
        
        if (fleetArray && fleetArray.length > 0) {
          fleetArray.forEach((t: any) => {
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

            if (!isOnline) fleet.offline++;
            else if (speed > 0 || statusStr.includes("วิ่ง")) fleet.driving++;
            else if (t.isEngineOn || t.magentic_data?.isEngine || statusStr.includes("ติดเครื่อง")) fleet.idling++;
            else fleet.parked++;

            const isEngineRunning = (speed > 0 || statusStr.includes("วิ่ง") || t.isEngineOn || t.magentic_data?.isEngine);
            const hasRfid = t.magentic_data?.isRfid === true || t.isRfid === true || (t.driver_detail?.driver_rfid && t.driver_detail.driver_rfid !== "");
            if (isEngineRunning && !hasRfid) fleet.rfidAlerts++;
            if (speed > 90) fleet.speedAlerts++;
          });
        }
      } catch (fleetErr) {
        console.warn('ดึงข้อมูลระบบ GPS Radar ไม่สำเร็จ');
      }

      // 8. ดึงยอดพนักงานทั้งหมด
      let totalEmpCount = 0;
      try {
        const { count, error: empErr } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true });
        if (!empErr && count !== null) {
          totalEmpCount = count;
        }
      } catch (e) {
        console.warn('ยังไม่มีตารางพนักงาน');
      }

      setStats({
        totalWeight: totalW,
        totalRevenue: totalRev,
        totalWages: totalWages,
        totalExpenses: totalExpenses,
        netProfit: netProfit,
        freshWeight: freshW,
        burntWeight: burntW,
        factoryShare,
        dailyTrend,
        presentToday: presentCount,
        totalEmployees: totalEmpCount || 5,
        totalAdvanceAmount: advanceSum,
        advanceRequestsCount: advanceCount,
        lowStockItems: lowStockItems,
        heavyMachinery: machinery,
        gpsFleet: fleet
      });

    } catch (err) {
      console.error('Error loading real dashboard data:', err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  const freshPercent = stats.totalWeight > 0 ? ((stats.freshWeight / stats.totalWeight) * 100).toFixed(1) : '0.0';
  const burntPercent = stats.totalWeight > 0 ? ((stats.burntWeight / stats.totalWeight) * 100).toFixed(1) : '0.0';

  const getConicGradient = () => {
    if (stats.factoryShare.length === 0) return 'conic-gradient(#f1f5f9 0% 100%)';
    const colors = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6'];
    let currentPercentage = 0;
    const gradients = stats.factoryShare.map((fac, index) => {
      const percentage = (fac.weight / stats.totalWeight) * 100;
      const start = currentPercentage;
      currentPercentage += percentage;
      return `${colors[index % colors.length]} ${start}% ${currentPercentage}%`;
    });
    return `conic-gradient(${gradients.join(', ')})`;
  };

  const rawMax = stats.dailyTrend.length > 0 ? Math.max(...stats.dailyTrend.map(d => d.weight)) : 10;
  const maxDailyWeight = rawMax > 0 ? Math.ceil(rawMax * 1.2) : 10;
  const yAxisSteps = [maxDailyWeight, maxDailyWeight * 0.75, maxDailyWeight * 0.5, maxDailyWeight * 0.25, 0];

  const totalViolations = stats.gpsFleet.rfidAlerts + stats.gpsFleet.speedAlerts;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans selection:bg-orange-500 selection:text-white">
      
      {/* 🌟 Header Toolbar */}
      <div className="bg-white/90 backdrop-blur-md border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => router.push('/')} className="group w-10 h-10 bg-white border border-stone-200 hover:border-orange-400 hover:bg-orange-50 rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm cursor-pointer" title="กลับหน้าหลัก">
              <svg className="w-5 h-5 text-stone-400 group-hover:text-orange-600 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div className="h-8 w-px bg-stone-200 hidden sm:block mx-1"></div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-stone-900 tracking-tight leading-none">แดชบอร์ดผู้บริหาร</h1>
                  {isSyncing && (
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-2 h-2 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span> ซิงค์...
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-bold text-stone-500 leading-none hidden sm:flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  เชื่อมต่อ Real-time Profitability & Fleet GPS
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            
            <button 
              onClick={() => fetchAllRealData(false)}
              disabled={isSyncing}
              className="px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="ดึงข้อมูลล่าสุดเบื้องหลัง"
            >
              <span className={isSyncing ? "animate-spin inline-block" : ""}>🔄</span>
              <span className="hidden md:inline">ซิงค์ข้อมูล</span>
            </button>

            <button 
              onClick={() => router.push('/fleet')}
              className="px-4 py-2 rounded-xl border border-indigo-400/30 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-black flex items-center gap-2 shadow-md shadow-indigo-500/20 transition-all cursor-pointer shrink-0"
            >
              <span>🛰️</span> <span>ดูเรดาร์ติดตามรถ</span>
            </button>

            <div className="relative w-full sm:w-auto">
              <select 
                value={currentYear} 
                onChange={(e) => setCurrentYear(e.target.value)}
                className="w-full sm:w-auto appearance-none pl-4 pr-10 py-2 border border-stone-200 rounded-[10px] font-bold text-stone-700 outline-none hover:border-stone-300 focus:border-orange-500 bg-white shadow-sm text-sm cursor-pointer transition-all"
              >
                <option value="2567">ฤดูหีบ ปี 2567</option>
                <option value="2568">ฤดูหีบ ปี 2568</option>
                <option value="2569">ฤดูหีบ ปี 2569</option>
                <option value="2570">ฤดูหีบ ปี 2570</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7-7-7-7" /></svg>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 mt-6 sm:mt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-10 h-10 border-4 border-stone-200 border-t-orange-500 rounded-full animate-spin"></div>
            <p className="text-stone-400 font-bold text-xs tracking-widest uppercase">Loading Data...</p>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            
            {/* 💰 โซนที่ 1: การเงิน & ผลกำไร */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              
              <div className="bg-white p-6 rounded-[20px] border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-lg transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <svg className="w-20 h-20 text-blue-500 transform translate-x-2 -translate-y-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 mb-3 relative z-10">
                  <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">💰</div>
                  <p className="text-xs font-bold text-stone-500">รายรับคาดการณ์ (ปีนี้)</p>
                </div>
                <div className="relative z-10">
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-lg font-black text-stone-400">฿</span>
                    <h3 className="text-3xl font-black text-stone-800 tracking-tight">{stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                  </div>
                  <p className="text-[10px] font-bold text-stone-400 bg-stone-50 px-2 py-1 rounded inline-block">จากผลผลิต: {stats.totalWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })} ตัน</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[20px] border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-lg transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <svg className="w-20 h-20 text-rose-500 transform translate-x-2 -translate-y-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 mb-3 relative z-10">
                  <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">💸</div>
                  <p className="text-xs font-bold text-stone-500">ต้นทุนรวม (ค่าแรง + รายจ่าย)</p>
                </div>
                <div className="relative z-10">
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-lg font-black text-rose-400">฿</span>
                    <h3 className="text-3xl font-black text-rose-600 tracking-tight">{(stats.totalWages + stats.totalExpenses).toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                  </div>
                  <p className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded inline-block">ค่าแรง ฿{stats.totalWages.toLocaleString()} | บิลจ่าย ฿{stats.totalExpenses.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-[20px] shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all relative overflow-hidden text-white">
                <div className="absolute top-0 right-0 p-4 opacity-20">
                  <svg className="w-24 h-24 text-white transform translate-x-4 -translate-y-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 mb-3 relative z-10">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">✨</div>
                  <p className="text-xs font-bold text-emerald-50">กำไรสุทธิ (Net Profit)</p>
                </div>
                <div className="relative z-10">
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-lg font-black text-emerald-200">฿</span>
                    <h3 className="text-4xl font-black text-white tracking-tight drop-shadow-md">{stats.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                  </div>
                  <p className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-1 rounded inline-block shadow-sm">หักค่าแรงและรายจ่ายแล้ว</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[20px] border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-lg transition-all">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                  </div>
                  <p className="text-xs font-bold text-stone-500">คุณภาพอ้อย (สด / เผา)</p>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <h3 className="text-3xl font-black text-emerald-600 tracking-tight">{freshPercent}%</h3>
                    <span className="text-[11px] font-bold text-stone-400">/ เผา {burntPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500" style={{ width: `${freshPercent}%` }}></div>
                    <div className="h-full bg-rose-400" style={{ width: `${burntPercent}%` }}></div>
                  </div>
                </div>
              </div>

            </div>

            {/* 📈 โซนที่ 2: กราฟผลผลิต (Charts) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
              
              <div className="lg:col-span-2 bg-white rounded-[20px] border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-5 sm:p-8 flex flex-col h-[350px] sm:h-[400px]">
                <h3 className="font-black text-stone-800 text-sm mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
                  ปริมาณการตัดส่งอ้อยจริง (7 วันทำการล่าสุด)
                </h3>
                
                <div className="flex-1 relative flex mt-2 sm:mt-4">
                  <div className="flex flex-col justify-between text-[9px] sm:text-[10px] font-bold text-stone-400 pb-7 pr-2 sm:pr-4 w-10 sm:w-12 text-right">
                    {yAxisSteps.map((step, i) => (
                      <span key={i} className="relative top-1.5">{step.toFixed(0)}</span>
                    ))}
                  </div>

                  <div className="flex-1 relative flex items-end justify-around pb-7 z-10">
                    <div className="absolute inset-0 flex flex-col justify-between pb-7 z-0 pointer-events-none">
                      {yAxisSteps.map((_, i) => (
                        <div key={i} className="w-full border-t border-stone-100 border-dashed"></div>
                      ))}
                    </div>

                    {stats.dailyTrend.length > 0 ? stats.dailyTrend.map((day, i) => {
                      const heightPercent = (day.weight / maxDailyWeight) * 100;
                      return (
                        <div key={i} className="relative flex flex-col items-center group z-10 h-full w-full max-w-[30px] sm:max-w-[40px] justify-end">
                          <span className="text-[9px] sm:text-[10px] font-black text-stone-500 mb-1.5 transition-colors group-hover:text-orange-600">
                            {day.weight > 0 ? day.weight.toFixed(1) : ''}
                          </span>
                          <div 
                            className="w-full bg-orange-400 rounded-t-sm group-hover:bg-orange-500 transition-colors relative"
                            style={{ height: `${heightPercent}%`, minHeight: day.weight > 0 ? '4px' : '0px' }}
                          ></div>
                          <span className="absolute -bottom-6 text-[9px] sm:text-[10px] font-bold text-stone-400 whitespace-nowrap">
                            {new Date(day.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      );
                    }) : (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <span className="font-bold text-xs sm:text-sm text-stone-400 bg-white px-4 py-2 rounded-full border border-stone-100 shadow-sm">
                          ไม่พบข้อมูลการส่งอ้อยในปีฤดูหีบนี้
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[20px] border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 flex flex-col h-[350px] sm:h-[400px]">
                <h3 className="font-black text-stone-800 text-sm mb-6 text-center">สัดส่วนน้ำหนักแยกโรงงาน</h3>
                
                <div className="flex justify-center mb-6 mt-2">
                  <div 
                    className="w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] rounded-full relative flex items-center justify-center shadow-sm"
                    style={{ background: getConicGradient() }}
                  >
                    <div className="w-[85px] h-[85px] sm:w-[100px] sm:h-[100px] bg-white rounded-full flex flex-col items-center justify-center z-10 shadow-inner">
                      <span className="text-[8px] sm:text-[9px] font-bold text-stone-400 mb-0.5">รวมสุทธิ (ตัน)</span>
                      <span className="text-xs sm:text-sm font-black text-stone-800 tracking-tight">
                        {stats.totalWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-auto overflow-y-auto custom-scrollbar pr-1">
                  {stats.factoryShare.map((fac, i) => {
                    const colors = ['bg-orange-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500'];
                    const percent = stats.totalWeight > 0 ? ((fac.weight / stats.totalWeight) * 100).toFixed(1) : 0;
                    return (
                      <div key={fac.name} className="flex justify-between items-center text-[11px] sm:text-xs font-bold border-b border-stone-50 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`}></span>
                          <span className="text-stone-600 truncate max-w-[100px] sm:max-w-[120px]">{fac.name}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-stone-900 block">{fac.weight.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          <span className="text-[9px] text-stone-400 font-medium">({percent}%)</span>
                        </div>
                      </div>
                    );
                  })}
                  {stats.factoryShare.length === 0 && (
                     <div className="text-center text-stone-400 text-xs font-bold py-4 bg-stone-50 rounded-xl">ยังไม่มีการส่งอ้อย</div>
                  )}
                </div>
              </div>

            </div>

            {/* 🛠️ โซนที่ 3: ปฏิบัติการ & แจ้งเตือน (Operations & Alerts) ฉบับอัปเกรด Hero Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              
              {/* 1. การ์ดเครื่องจักรแบบ "ไฮบริด (Heavy Machinery + GPS Fleet)" */}
              <div className={`p-5 rounded-[20px] border shadow-sm flex flex-col justify-between transition-all ${totalViolations > 0 ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-stone-100'}`}>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${totalViolations > 0 ? 'bg-rose-100 text-rose-600' : 'bg-amber-50 text-amber-500'}`}>🚜</div>
                      <p className="text-xs font-black text-stone-800">เครื่องจักร & รถขนส่ง</p>
                    </div>
                    {totalViolations > 0 && (
                      <span className="bg-rose-500 text-white font-black text-[9px] px-2 py-0.5 rounded-full animate-pulse shadow-sm">🚨 เตือนภัย!</span>
                    )}
                  </div>

                  {/* ส่วนที่ 1: เครื่องจักรไร่ */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">🚜 เครื่องจักรไร่ (ฟาร์ม)</span>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="bg-emerald-50/80 rounded-lg p-1.5 border border-emerald-100/50">
                        <p className="text-base font-black text-emerald-600">{stats.heavyMachinery.available}</p>
                        <p className="text-[9px] font-bold text-emerald-800">พร้อมใช้</p>
                      </div>
                      <div className="bg-sky-50/80 rounded-lg p-1.5 border border-sky-100/50">
                        <p className="text-base font-black text-sky-600">{stats.heavyMachinery.inUse}</p>
                        <p className="text-[9px] font-bold text-sky-800">ทำงาน</p>
                      </div>
                      <div className="bg-rose-50/80 rounded-lg p-1.5 border border-rose-100/50">
                        <p className="text-base font-black text-rose-600">{stats.heavyMachinery.maintenance}</p>
                        <p className="text-[9px] font-bold text-rose-800">ซ่อม</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-stone-100 my-2.5"></div>

                  {/* ส่วนที่ 2: รถขนส่งอ้อย */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">🚛 รถขนส่งอ้อย (GPS Live)</span>
                    <div className="grid grid-cols-4 gap-1 text-center">
                      <div className="bg-emerald-50/80 rounded-lg p-1 border border-emerald-100/50" title="กำลังวิ่งงาน">
                        <p className="text-sm font-black text-emerald-600">{stats.gpsFleet.driving}</p>
                        <p className="text-[8px] font-bold text-emerald-800">วิ่งอยู่</p>
                      </div>
                      <div className="bg-amber-50/80 rounded-lg p-1 border border-amber-100/50" title="จอดสตาร์ทเครื่อง">
                        <p className="text-sm font-black text-amber-600">{stats.gpsFleet.idling}</p>
                        <p className="text-[8px] font-bold text-amber-800">ติดเครื่อง</p>
                      </div>
                      <div className="bg-blue-50/80 rounded-lg p-1 border border-blue-100/50" title="จอดดับเครื่อง (ออนไลน์)">
                        <p className="text-sm font-black text-blue-600">{stats.gpsFleet.parked}</p>
                        <p className="text-[8px] font-bold text-blue-800">จอดนิ่ง</p>
                      </div>
                      <div className="bg-slate-100 rounded-lg p-1 border border-slate-200/50" title="ขาดการติดต่อ">
                        <p className="text-sm font-black text-slate-600">{stats.gpsFleet.offline}</p>
                        <p className="text-[8px] font-bold text-slate-700">ออฟไลน์</p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* แจ้งเตือนความปลอดภัยคนขับ */}
                <div className="mt-3 pt-2 border-t border-stone-200/60 flex flex-col gap-1 text-[11px]">
                  {totalViolations > 0 ? (
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap items-center gap-1">
                        {stats.gpsFleet.rfidAlerts > 0 && (
                          <span className="bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded text-[9px] flex items-center gap-1">
                            🚨 ไม่รูดบัตร {stats.gpsFleet.rfidAlerts}
                          </span>
                        )}
                        {stats.gpsFleet.speedAlerts > 0 && (
                          <span className="bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded text-[9px] flex items-center gap-1">
                            ⚡ ขับเร็ว {stats.gpsFleet.speedAlerts}
                          </span>
                        )}
                      </div>
                      <button onClick={() => router.push('/fleet')} className="font-black text-indigo-600 hover:underline shrink-0 text-[10px] cursor-pointer">ดูเรดาร์ 👉</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-600 font-bold text-[10px]">✓ คนขับรถขนส่งปฏิบัติตามกฎ</span>
                      <button onClick={() => router.push('/fleet')} className="font-black text-indigo-600 hover:underline shrink-0 text-[10px] cursor-pointer">ดูเรดาร์ 👉</button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. แจ้งเตือนคลังสินค้า (Hero Stats Style) */}
              <div className={`rounded-[20px] border shadow-sm p-5 flex flex-col justify-between ${stats.lowStockItems.length > 0 ? 'bg-white border-rose-100' : 'bg-white border-stone-100'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${stats.lowStockItems.length > 0 ? 'bg-rose-50 text-rose-500' : 'bg-stone-50 text-stone-600'}`}>📦</div>
                    <p className={`text-xs font-black ${stats.lowStockItems.length > 0 ? 'text-rose-600' : 'text-stone-800'}`}>สต็อกวัตถุดิบ</p>
                  </div>
                  <span className="text-[10px] font-bold text-stone-400">Inventory</span>
                </div>
                
                {/* เนื้อหาตรงกลาง */}
                <div className="my-auto py-4 flex flex-col items-center justify-center">
                  {stats.lowStockItems.length > 0 ? (
                    <div className="space-y-1.5 w-full max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                      {stats.lowStockItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-rose-50/60 px-2.5 py-2 rounded-xl border border-rose-100/60">
                          <span className="text-[11px] font-bold text-rose-900 truncate max-w-[110px]">{item.name}</span>
                          <span className="text-[11px] font-black text-rose-600 bg-white px-2 py-0.5 rounded-md shadow-2xs">เหลือ {item.stock}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center space-y-2 py-4">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-2xl mx-auto border border-emerald-100/60 shadow-2xs">
                        ✨
                      </div>
                      <div>
                        <p className="text-xs font-black text-stone-800">สต็อกเพียงพอทุกรายการ</p>
                        <p className="text-[10px] font-bold text-stone-400 mt-0.5">ไม่มีวัตถุดิบต่ำกว่าเกณฑ์ขั้นต่ำ</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[10px]">
                  <span className={stats.lowStockItems.length > 0 ? "font-bold text-rose-500 animate-pulse" : "font-bold text-emerald-600"}>
                    {stats.lowStockItems.length > 0 ? `⚠️ ต้องสั่งซื้อเพิ่ม ${stats.lowStockItems.length} รายการ` : "✓ สถานะคลังปกติ"}
                  </span>
                  <button onClick={() => router.push('/inventory')} className="font-black text-indigo-600 hover:underline cursor-pointer">จัดการคลัง 👉</button>
                </div>
              </div>

              {/* 3. พนักงานเข้างาน (Hero Stats + Progress Bar) */}
              <div className="bg-white p-5 rounded-[20px] border border-stone-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-base">👷</div>
                    <p className="text-xs font-black text-stone-800">พนักงานเข้างานวันนี้</p>
                  </div>
                  <span className="text-[10px] font-bold text-stone-400">Attendance</span>
                </div>

                {/* เนื้อหาตรงกลาง */}
                <div className="my-auto py-4 flex flex-col justify-center">
                  <div className="flex items-baseline justify-center gap-2 mb-3">
                    <h3 className="text-5xl font-black text-blue-600 tracking-tight">{stats.presentToday}</h3>
                    <span className="text-sm font-bold text-stone-400">/ {stats.totalEmployees} คน</span>
                  </div>
                  
                  <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden p-0.5">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${stats.totalEmployees > 0 ? (stats.presentToday / stats.totalEmployees) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] font-bold text-stone-400 text-center mt-2">
                    คิดเป็น {stats.totalEmployees > 0 ? ((stats.presentToday / stats.totalEmployees) * 100).toFixed(0) : 0}% ของพนักงานทั้งหมดในฟาร์ม
                  </p>
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[10px]">
                  <span className="font-bold text-stone-400">อัปเดตรายวัน</span>
                  <button onClick={() => router.push('/attendance')} className="font-black text-blue-600 hover:underline cursor-pointer">เช็คชื่อเข้างาน 👉</button>
                </div>
              </div>

              {/* 4. เงินเบิกล่วงหน้า (Hero Stats + Badge) */}
              <div className="bg-white p-5 rounded-[20px] border border-stone-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center text-base">📝</div>
                    <p className="text-xs font-black text-stone-800">เบิกเงินล่วงหน้า</p>
                  </div>
                  <span className="text-[10px] font-bold text-stone-400">Advance</span>
                </div>

                {/* เนื้อหาตรงกลาง */}
                <div className="my-auto py-4 flex flex-col items-center justify-center text-center">
                  <div className="flex items-baseline justify-center gap-1.5 mb-2">
                    <h3 className="text-5xl font-black text-orange-500 tracking-tight">{stats.advanceRequestsCount}</h3>
                    <span className="text-sm font-bold text-stone-400">รายการ</span>
                  </div>
                  
                  <div className="bg-orange-50 text-orange-700 px-3 py-1.5 rounded-xl text-xs font-black mt-1 border border-orange-100/80 shadow-2xs">
                    ยอดรวม ฿ {stats.totalAdvanceAmount.toLocaleString()}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[10px]">
                  <span className="font-bold text-stone-400">รอการตรวจสอบ</span>
                  <button onClick={() => router.push('/advance')} className="font-black text-orange-600 hover:underline cursor-pointer">ดูรายการเบิก 👉</button>
                </div>
              </div>

            </div>

          </div>
        )}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
      `}</style>
    </div>
  );
}