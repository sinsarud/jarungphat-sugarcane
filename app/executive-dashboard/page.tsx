'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  totalWeight: number;
  totalRevenue: number;
  freshWeight: number;
  burntWeight: number;
  factoryShare: { name: string; weight: number }[];
  dailyTrend: { date: string; weight: number }[];
  presentToday: number;
  totalEmployees: number;
  totalAdvanceAmount: number;
  advanceRequestsCount: number;
  lowStockItems: { name: string; stock: number; unit: string; min_stock: number }[]; 
}

export default function ExecutiveDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState('2569'); // ปีฤดูหีบปัจจุบัน
  const [stats, setStats] = useState<DashboardStats>({
    totalWeight: 0,
    totalRevenue: 0,
    freshWeight: 0,
    burntWeight: 0,
    factoryShare: [],
    dailyTrend: [],
    presentToday: 0,
    totalEmployees: 5, 
    totalAdvanceAmount: 0,
    advanceRequestsCount: 0,
    lowStockItems: []
  });

  const basePrice = 1000;
  const burntPenalty = 30;

  useEffect(() => {
    fetchAllRealData();
  }, [currentYear]);

  const fetchAllRealData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const gregorianYear = (Number(currentYear) - 543).toString();

      // 1. [ข้อมูลจริง] ดึงข้อมูลส่งอ้อย
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

      // 2. [ข้อมูลจริง] ดึงจำนวนพนักงานมาทำงานวันนี้
      const { data: attendanceData } = await supabase
        .from('daily_attendance')
        .select('id')
        .eq('date', today)
        .neq('work_type', 'ขาด')
        .neq('work_type', 'LA');
      const presentCount = attendanceData ? attendanceData.length : 0;

      // 3. [ข้อมูลจริง] ดึงยอดรวมเงินเบิก
      const { data: advanceData } = await supabase
        .from('advance_payments')
        .select('amount');
      
      const advanceCount = advanceData ? advanceData.length : 0;
      const advanceSum = advanceData ? advanceData.reduce((sum, item) => sum + Number(item.amount || 0), 0) : 0;

      // 4. [ข้อมูลจริง] ดึงข้อมูลสินค้าคงคลัง
      let lowStockItems: any[] = [];
      try {
        const { data: inventoryData, error: invError } = await supabase
          .from('inventory') 
          .select('name, stock, min_stock, unit');
        
        if (!invError && inventoryData) {
          lowStockItems = inventoryData.filter((item: any) => Number(item.stock) <= Number(item.min_stock));
        }
      } catch (invErr) {
        console.warn('ระบบคลังสินค้ามีปัญหาการเชื่อมต่อ');
      }

      setStats({
        totalWeight: totalW,
        totalRevenue: totalRev,
        freshWeight: freshW,
        burntWeight: burntW,
        factoryShare,
        dailyTrend,
        presentToday: presentCount,
        totalEmployees: 5, 
        totalAdvanceAmount: advanceSum,
        advanceRequestsCount: advanceCount,
        lowStockItems: lowStockItems 
      });

    } catch (err) {
      console.error('Error loading real dashboard data:', err);
    } finally {
      setLoading(false);
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

  // คำนวณแกน Y สำหรับกราฟ
  const rawMax = stats.dailyTrend.length > 0 ? Math.max(...stats.dailyTrend.map(d => d.weight)) : 10;
  const maxDailyWeight = rawMax > 0 ? Math.ceil(rawMax * 1.2) : 10; // เผื่อที่ว่างด้านบน 20%
  const yAxisSteps = [maxDailyWeight, maxDailyWeight * 0.75, maxDailyWeight * 0.5, maxDailyWeight * 0.25, 0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans selection:bg-orange-500 selection:text-white">
      
      {/* 🌟 Header (อัปเกรดปุ่มย้อนกลับตามที่สั่ง) */}
      <div className="bg-white/90 backdrop-blur-md border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* ⬅️ ปุ่มย้อนกลับดีไซน์ใหม่ */}
            <button onClick={() => router.push('/')} className="group w-10 h-10 bg-white border border-stone-200 hover:border-orange-400 hover:bg-orange-50 rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm">
              <svg className="w-5 h-5 text-stone-400 group-hover:text-orange-600 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            
            {/* เส้นคั่น */}
            <div className="h-8 w-px bg-stone-200 hidden sm:block mx-1"></div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-black text-stone-900 tracking-tight leading-none mb-1">แดชบอร์ดผู้บริหาร</h1>
                <p className="text-[11px] font-bold text-stone-500 leading-none hidden sm:flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  ข้อมูลเชื่อมต่อ Real-time
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <select 
                value={currentYear} 
                onChange={(e) => setCurrentYear(e.target.value)}
                className="w-full sm:w-auto appearance-none pl-4 pr-10 py-2.5 border border-stone-200 rounded-[10px] font-bold text-stone-700 outline-none hover:border-stone-300 focus:border-orange-500 bg-white shadow-sm text-sm cursor-pointer transition-all"
              >
                <option value="2567">ฤดูหีบ ปี 2567</option>
                <option value="2568">ฤดูหีบ ปี 2568</option>
                <option value="2569">ฤดูหีบ ปี 2569</option>
                <option value="2570">ฤดูหีบ ปี 2570</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            {/* เอาปุ่มกลับหน้าหลักอันเก่าออกให้แล้วครับ จะได้ไม่ซ้ำซ้อน */}
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-6 mt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-10 h-10 border-4 border-stone-200 border-t-orange-500 rounded-full animate-spin"></div>
            <p className="text-stone-400 font-bold text-xs tracking-widest uppercase">Loading Data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* 📈 1. กล่องการ์ดสรุปตัวเลขด้านบน (Clean Minimalist) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: รายได้ */}
              <div className="bg-white p-6 rounded-[20px] border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-xs font-bold text-stone-500">ยอดรวมรายรับ (ปีนี้)</p>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-lg font-black text-stone-400">฿</span>
                    <h3 className="text-3xl font-black text-stone-800 tracking-tight">
                      {stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                  </div>
                  <p className="text-[10px] font-bold text-stone-400 bg-stone-50 px-2 py-1 rounded inline-block">
                    รวมน้ำหนักสุทธิ: {stats.totalWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ตัน
                  </p>
                </div>
              </div>

              {/* Card 2: สัดส่วนสด/เผา */}
              <div className="bg-white p-6 rounded-[20px] border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                  </div>
                  <p className="text-xs font-bold text-stone-500">สัดส่วนอ้อยสด / อ้อยเผา</p>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <h3 className="text-3xl font-black text-emerald-600 tracking-tight">{freshPercent}%</h3>
                    <span className="text-[11px] font-bold text-stone-400">/ เผา {burntPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500" style={{ width: `${freshPercent}%` }}></div>
                    <div className="h-full bg-rose-400" style={{ width: `${burntPercent}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Card 3: เงินเบิก */}
              <div className="bg-white p-6 rounded-[20px] border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-xs font-bold text-stone-500">ยอดค้างเบิกล่วงหน้ารวม</p>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-lg font-black text-stone-400">฿</span>
                    <h3 className="text-3xl font-black text-rose-600 tracking-tight">
                      {stats.totalAdvanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                  </div>
                  <p className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded inline-block">
                    ค้างเบิกอยู่: {stats.advanceRequestsCount} รายการ
                  </p>
                </div>
              </div>

              {/* Card 4: พนักงาน */}
              <div className="bg-white p-6 rounded-[20px] border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  </div>
                  <p className="text-xs font-bold text-stone-500">พนักงานทำงานวันนี้</p>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <h3 className="text-3xl font-black text-blue-600 tracking-tight">{stats.presentToday}</h3>
                    <span className="text-[11px] font-bold text-stone-400">/ {stats.totalEmployees} คน</span>
                  </div>
                  <p className="text-[10px] font-bold text-stone-400 bg-stone-50 px-2 py-1 rounded inline-block">
                    ข้อมูลอัปเดตจากระบบเช็คชื่อ
                  </p>
                </div>
              </div>

            </div>

            {/* 📊 2. ส่วนแสดงกราฟและตารางสต็อกจริง */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* 📈 กราฟแท่ง (Premium Smart Bar Chart) */}
              <div className="lg:col-span-2 bg-white rounded-[20px] border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 md:p-8 flex flex-col h-[400px]">
                <h3 className="font-black text-stone-800 text-sm mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
                  ปริมาณการตัดส่งอ้อยจริง (7 วันทำการล่าสุด)
                </h3>
                
                <div className="flex-1 relative flex mt-4">
                  {/* แกน Y ด้านซ้าย (Y-Axis) */}
                  <div className="flex flex-col justify-between text-[10px] font-bold text-stone-400 pb-7 pr-4 w-12 text-right">
                    {yAxisSteps.map((step, i) => (
                      <span key={i} className="relative top-1.5">{step.toFixed(0)}</span>
                    ))}
                  </div>

                  {/* พื้นที่กราฟหลัก */}
                  <div className="flex-1 relative flex items-end justify-around pb-7 z-10">
                    
                    {/* เส้น Grid แนวนอน */}
                    <div className="absolute inset-0 flex flex-col justify-between pb-7 z-0 pointer-events-none">
                      {yAxisSteps.map((_, i) => (
                        <div key={i} className="w-full border-t border-stone-100 border-dashed"></div>
                      ))}
                    </div>

                    {/* แท่งกราฟ */}
                    {stats.dailyTrend.length > 0 ? stats.dailyTrend.map((day, i) => {
                      const heightPercent = (day.weight / maxDailyWeight) * 100;
                      return (
                        <div key={i} className="relative flex flex-col items-center group z-10 h-full w-full max-w-[40px] justify-end">
                          
                          <span className="text-[10px] font-black text-stone-500 mb-1.5 transition-colors group-hover:text-orange-600">
                            {day.weight > 0 ? day.weight.toFixed(1) : ''}
                          </span>
                          
                          <div 
                            className="w-full bg-orange-400 rounded-t-sm group-hover:bg-orange-500 transition-colors relative"
                            style={{ height: `${heightPercent}%`, minHeight: day.weight > 0 ? '4px' : '0px' }}
                          ></div>
                          
                          <span className="absolute -bottom-6 text-[10px] font-bold text-stone-400 whitespace-nowrap">
                            {new Date(day.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      );
                    }) : (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <span className="font-bold text-sm text-stone-400 bg-white px-4 py-2 rounded-full border border-stone-100 shadow-sm">
                          ไม่พบข้อมูลการส่งอ้อยในปีฤดูหีบนี้
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* กราฟโดนัท และ แจ้งเตือนสต็อก */}
              <div className="flex flex-col gap-6 h-full">
                
                {/* 🍩 กราฟโดนัท */}
                <div className="bg-white rounded-[20px] border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 flex flex-col flex-1">
                  <h3 className="font-black text-stone-800 text-sm mb-6 text-center">สัดส่วนน้ำหนักแยกโรงงาน</h3>
                  
                  <div className="flex justify-center mb-6">
                    <div 
                      className="w-[140px] h-[140px] rounded-full relative flex items-center justify-center shadow-sm"
                      style={{ background: getConicGradient() }}
                    >
                      <div className="w-[100px] h-[100px] bg-white rounded-full flex flex-col items-center justify-center z-10 shadow-inner">
                        <span className="text-[9px] font-bold text-stone-400 mb-0.5">รวมสุทธิ (ตัน)</span>
                        <span className="text-sm font-black text-stone-800 tracking-tight">
                          {stats.totalWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mt-auto">
                    {stats.factoryShare.map((fac, i) => {
                      const colors = ['bg-orange-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500'];
                      const percent = stats.totalWeight > 0 ? ((fac.weight / stats.totalWeight) * 100).toFixed(1) : 0;
                      return (
                        <div key={fac.name} className="flex justify-between items-center text-xs font-bold border-b border-stone-50 pb-2 last:border-0 last:pb-0">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`}></span>
                            <span className="text-stone-600">{fac.name}</span>
                          </div>
                          <div className="text-right">
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

                {/* 🚨 แจ้งเตือนสต็อก */}
                <div className={`rounded-[20px] border shadow-sm p-6 ${stats.lowStockItems.length > 0 ? 'bg-white border-rose-100' : 'bg-white border-stone-100'}`}>
                  <h3 className={`font-black text-sm mb-4 flex items-center gap-2 ${stats.lowStockItems.length > 0 ? 'text-rose-600' : 'text-stone-800'}`}>
                    <div className={`w-2 h-2 rounded-full ${stats.lowStockItems.length > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                    แจ้งเตือนสต็อกวัตถุดิบ
                  </h3>
                  
                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
                    {stats.lowStockItems.length > 0 ? stats.lowStockItems.map((item, idx) => (
                      <div key={idx} className="bg-rose-50 px-3 py-2.5 rounded-xl flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-rose-900">{item.name}</span>
                          <span className="text-[9px] font-bold text-rose-400/80">ขั้นต่ำที่ตั้งไว้: {item.min_stock}</span>
                        </div>
                        <span className="text-xs font-black text-rose-600 bg-white px-2 py-0.5 rounded-md shadow-sm">
                          เหลือ {item.stock} {item.unit}
                        </span>
                      </div>
                    )) : (
                      <div className="flex flex-col items-center justify-center py-6 text-center bg-stone-50 rounded-xl border border-stone-100 border-dashed">
                        <svg className="w-6 h-6 text-emerald-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                        <span className="text-xs font-bold text-stone-500">วัตถุดิบทุกรายการมีเพียงพอ</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}