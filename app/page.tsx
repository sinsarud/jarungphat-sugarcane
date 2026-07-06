'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useRouter } from 'next/navigation';

interface Worker {
  id: string;
  name: string;
}

interface AttendanceRecord {
  worker_id: string;
  name: string;
  status: number;
  ot_hours: number;
}

export default function AttendancePage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState(''); // เพิ่ม state สำหรับเก็บชื่อผู้ล็อกอิน

  useEffect(() => {
    async function checkUserAndFetchData() {
      setLoading(true);

      // 1. ตรวจสอบว่ามีการ Login อยู่หรือไม่
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // เก็บชื่ออีเมลไว้แสดงผล
      setUserName(session.user.email || '');

      // 2. ดึงข้อมูลคนงานจาก Supabase
      const { data, error } = await supabase
        .from('workers')
        .select('id, first_name, last_name')
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching workers:', error);
        alert('ไม่สามารถดึงข้อมูลพนักงานได้');
      } else if (data) {
        const initialAttendance = data.map((w: any) => ({
          worker_id: w.id,
          name: w.last_name ? `${w.first_name} ${w.last_name}` : w.first_name,
          status: 1.0,
          ot_hours: 0
        }));
        setAttendance(initialAttendance);
      }
      setLoading(false);
    }

    checkUserAndFetchData();
  }, [router]);

  const handleStatusChange = (id: string, newStatus: number) => {
    setAttendance(prev =>
      prev.map(item => item.worker_id === id ? { ...item, status: newStatus } : item)
    );
  };

  const handleOtChange = (id: string, ot: number) => {
    setAttendance(prev =>
      prev.map(item => item.worker_id === id ? { ...item, ot_hours: ot } : item)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    
    const insertData = attendance.map(record => ({
      date: date,
      worker_id: record.worker_id,
      work_status: record.status,
      ot_hours: record.ot_hours
    }));

    const { error } = await supabase
      .from('attendance')
      .upsert(insertData, { onConflict: 'date,worker_id' });

    setSaving(false);

    if (error) {
      console.error('Error saving attendance:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message);
    } else {
      alert('บันทึกข้อมูลการเข้างานเรียบร้อยแล้ว!');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <svg className="animate-spin h-10 w-10 text-green-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg font-medium text-gray-600">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-24 font-sans">
      
      {/* ส่วนหัวของแอป (Header) พร้อมภาพพื้นหลังไร่อ้อย */}
      <div className="relative sticky top-0 z-20 shadow-md">
        {/* รูปภาพพื้นหลัง */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1592982537447-6f2a6a0b4112?q=80&w=2070&auto=format&fit=crop')" }}
        ></div>
        {/* แผ่นฟิล์มสีเขียวทับภาพให้ตัวหนังสือเด่นชัด */}
        <div className="absolute inset-0 bg-green-900/80 backdrop-blur-[2px]"></div>
        
        {/* คอนเทนต์ใน Header */}
        <div className="relative z-10 px-4 py-5 max-w-md mx-auto">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-md tracking-tight">ไร่อ้อยจรุงพัฒนานนท์</h1>
              <p className="text-sm text-green-100 mt-1 inline-block bg-black/20 px-3 py-0.5 rounded-full backdrop-blur-md border border-white/10">ระบบเช็คชื่อขึ้นรถ</p>
            </div>
            {/* ปุ่มออกจากระบบ (Logout) */}
            <button 
              onClick={handleLogout}
              className="text-white bg-red-500/80 hover:bg-red-600 px-3 py-1.5 rounded-lg text-sm font-medium backdrop-blur-md transition-colors shadow-sm"
            >
              ออกระบบ
            </button>
          </div>
          <div className="text-xs text-green-200/80 mt-2">
            ผู้ใช้งาน: {userName}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto">
        {/* กล่องเลือกวันที่ */}
        <div className="mb-5 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <label className="block text-gray-700 font-bold mb-2 text-sm uppercase tracking-wide">วันที่ทำงาน</label>
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-lg font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-colors"
          />
        </div>

        {/* รายชื่อคนงาน */}
        {attendance.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm text-center border border-gray-100 mt-4">
            <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-gray-600 font-semibold mb-1">ยังไม่มีรายชื่อคนงานในระบบ</p>
            <p className="text-sm text-gray-400">โปรดเพิ่มข้อมูลพนักงานใน Supabase ก่อน</p>
          </div>
        ) : (
          <div className="space-y-4">
            {attendance.map((record) => (
              <div key={record.worker_id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                <div className="font-bold text-lg mb-4 text-gray-800 border-b border-gray-50 pb-3 flex items-center">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold mr-3 text-sm">
                    {record.name.charAt(0)}
                  </div>
                  {record.name}
                </div>
                
                {/* ปุ่มสถานะ 3 ปุ่ม */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <button 
                    onClick={() => handleStatusChange(record.worker_id, 1.0)}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-all ${record.status === 1.0 ? 'bg-green-600 text-white shadow-md shadow-green-200 transform scale-105' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    เต็มวัน
                  </button>
                  <button 
                    onClick={() => handleStatusChange(record.worker_id, 0.5)}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-all ${record.status === 0.5 ? 'bg-yellow-500 text-white shadow-md shadow-yellow-200 transform scale-105' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    ครึ่งวัน
                  </button>
                  <button 
                    onClick={() => handleStatusChange(record.worker_id, 0)}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-all ${record.status === 0 ? 'bg-red-500 text-white shadow-md shadow-red-200 transform scale-105' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    ขาด
                  </button>
                </div>

                {/* ตัวปรับ OT */}
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-600 font-semibold text-sm">ชั่วโมง OT (โอที)</span>
                  <div className="flex items-center bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <button 
                      onClick={() => handleOtChange(record.worker_id, Math.max(0, record.ot_hours - 1))}
                      className="w-10 h-10 bg-gray-50 hover:bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-lg transition-colors border-r border-gray-200"
                    >−</button>
                    <span className="w-12 text-center font-bold text-lg text-green-700">{record.ot_hours}</span>
                    <button 
                      onClick={() => handleOtChange(record.worker_id, record.ot_hours + 1)}
                      className="w-10 h-10 bg-gray-50 hover:bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-lg transition-colors border-l border-gray-200"
                    >+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ปุ่มบันทึกด้านล่าง (ลอยติดขอบจอตลอดเวลา) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-30">
        <div className="max-w-md mx-auto">
          <button 
            onClick={handleSave}
            disabled={saving || attendance.length === 0}
            className={`w-full text-white font-bold py-4 rounded-2xl text-lg shadow-lg transition-all active:scale-[0.98] flex items-center justify-center ${saving ? 'bg-gray-400' : 'bg-green-700 hover:bg-green-800 hover:shadow-green-700/40'}`}
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                กำลังบันทึกข้อมูล...
              </>
            ) : (
              'บันทึกข้อมูลเข้างาน'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}