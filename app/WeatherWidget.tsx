'use client';

import React, { useState, useEffect } from 'react';

const getThaiDay = (dateString: string) => {
  const date = new Date(dateString);
  const days = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  return days[date.getDay()];
};

const getWeatherInfo = (code: number) => {
  if (code === 0) return { text: 'ฟ้าโปร่ง', icon: '☀️' };
  if (code === 1 || code === 2 || code === 3) return { text: 'มีเมฆบางส่วน', icon: '⛅' };
  if (code >= 51 && code <= 55) return { text: 'ฝนปรอยๆ', icon: '🌦️' };
  if (code >= 61 && code <= 65) return { text: 'ฝนตก', icon: '🌧️' };
  if (code >= 80 && code <= 82) return { text: 'ฝนตกหนัก', icon: '⛈️' };
  if (code >= 95 && code <= 99) return { text: 'พายุฟ้าคะนอง', icon: '🌩️' };
  return { text: 'มีเมฆ', icon: '⛅' };
};

const getPM25Status = (val: number) => {
  if (val <= 25) return { label: 'ดีมาก', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  if (val <= 37) return { label: 'ปานกลาง', color: 'bg-amber-100 text-amber-700 border-amber-200' };
  if (val <= 50) return { label: 'เริ่มมีผลกระทบ', color: 'bg-orange-100 text-orange-700 border-orange-200' };
  return { label: 'อันตราย', color: 'bg-rose-100 text-rose-700 border-rose-200' };
};

export default function WeatherWidget() {
  const [weather, setWeather] = useState<any>(null);
  const [pm25, setPm25] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState('กำลังค้นหาพิกัด...');

  useEffect(() => {
    const fetchAllData = async (lat: number, lon: number, locName: string) => {
      try {
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=Asia%2FBangkok`);
        const weatherData = await weatherRes.json();
        setWeather(weatherData.daily);

        const aqRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5`);
        const aqData = await aqRes.json();
        const currentPm = aqData?.current?.pm2_5;
        if (currentPm !== undefined) {
          setPm25(currentPm);
        }

        setLocationName(locName);
      } catch (err) {
        console.error("Error fetching weather/AQI:", err);
      } finally {
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          let city = 'พิกัด GPS';
          try {
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=th`);
            const data = await res.json();
            city = data.locality || data.city || 'พิกัด GPS';
          } catch {}
          fetchAllData(lat, lon, city);
        },
        () => {
          fetchAllData(13.7563, 100.5018, 'กรุงเทพมหานคร');
        }
      );
    } else {
      fetchAllData(13.7563, 100.5018, 'กรุงเทพมหานคร');
    }
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-[24px] border border-stone-200 shadow-sm p-6 flex flex-col items-center justify-center h-[280px] animate-pulse">
        <div className="w-12 h-12 border-4 border-sky-100 border-t-sky-500 rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">กำลังดึงพิกัด GPS และเช็กปริมาณฝน...</p>
      </div>
    );
  }

  if (!weather) return null;

  const pmStatus = pm25 !== null ? getPM25Status(pm25) : null;

  return (
    <div className="bg-white rounded-[24px] border border-stone-200 shadow-sm overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-sky-100/60 to-transparent pointer-events-none"></div>
      
      <div className="p-5 sm:p-6 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6">
          <div>
            <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
              <span className="w-8 h-8 bg-sky-100 text-sky-600 flex items-center justify-center rounded-xl text-base shadow-inner border border-sky-200">🛰️</span>
              สภาพอากาศ & ฝุ่น PM 2.5 (GPS)
            </h2>
            <p className="text-[12px] font-bold text-stone-500 mt-1">📍 ตำแหน่งปัจจุบัน: {locationName}</p>
          </div>

          {pm25 !== null && pmStatus && (
            <div className={`px-4 py-2 rounded-2xl border flex items-center gap-3 shadow-sm ${pmStatus.color}`}>
              <span className="text-xl">😷</span>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider opacity-80">ฝุ่น PM 2.5</div>
                <div className="text-sm font-black">{pm25} <span className="text-[10px] font-normal">µg/m³ ({pmStatus.label})</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
          {weather.time.map((date: string, index: number) => {
            const isToday = index === 0;
            const info = getWeatherInfo(weather.weathercode[index]);
            const rainProb = weather.precipitation_probability_max[index];
            const rainSum = weather.precipitation_sum[index];
            
            const isDanger = rainProb >= 40 || rainSum > 1.0;

            return (
              <div 
                key={date} 
                className={`flex flex-col items-center p-3 sm:p-4 rounded-[20px] border transition-all hover:-translate-y-1 hover:shadow-md ${
                  isToday 
                    ? 'bg-gradient-to-b from-sky-50 to-white border-sky-300 shadow-[0_4px_15px_rgba(14,165,233,0.15)] ring-2 ring-sky-100' 
                    : isDanger 
                      ? 'bg-rose-50/30 border-rose-200' 
                      : 'bg-stone-50/50 border-stone-200'
                }`}
              >
                <div className="text-[11px] font-black uppercase tracking-wider mb-3">
                  {isToday ? (
                    <span className="bg-sky-500 text-white px-2.5 py-1 rounded-md shadow-sm">วันนี้</span>
                  ) : (
                    <span className="text-stone-500 bg-white border border-stone-200 px-2 py-1 rounded-md shadow-sm">{getThaiDay(date)} {date.split('-')[2]}</span>
                  )}
                </div>
                
                <div className="text-3xl sm:text-4xl mb-3 drop-shadow-sm" title={info.text}>
                  {info.icon}
                </div>
                
                <div className="flex gap-1 text-[12px] font-black text-stone-700 mb-3">
                  <span>{Math.round(weather.temperature_2m_max[index])}°</span>
                  <span className="text-stone-300">/</span>
                  <span className="text-stone-400">{Math.round(weather.temperature_2m_min[index])}°</span>
                </div>

                {/* 🌟 ปรับปรุงกล่องแสดงผลให้มีข้อความภาษาไทยบอกชัดเจน */}
                <div className={`w-full py-1.5 px-1 rounded-lg mb-2 shadow-sm flex flex-col items-center justify-center gap-0.5 border ${
                  isDanger ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  <div className="text-[10px] font-black flex items-center gap-1">
                    <span>☔</span> โอกาสฝน: <span className="font-bold">{rainProb}%</span>
                  </div>
                  <div className="text-[9px] font-extrabold opacity-90 flex items-center gap-1">
                    <span>💧</span> ปริมาณ: {rainSum} มม.
                  </div>
                </div>

                {isDanger ? (
                  <div className="mt-auto text-[10px] font-bold text-rose-600 bg-white border border-rose-100 px-2 py-1 rounded-md w-full text-center shadow-sm">
                    ❌ งดฉีดยา/ปุ๋ย
                  </div>
                ) : (
                  <div className="mt-auto text-[10px] font-bold text-emerald-600 bg-white border border-emerald-100 px-2 py-1 rounded-md w-full text-center shadow-sm">
                    ✅ ลงงานได้
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}