'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function BackupRestorePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cloudFiles, setCloudFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  // 🌟 อัปเกรด Notify State ให้รองรับปุ่ม ยืนยัน/ยกเลิก
  const [notify, setNotify] = useState<{
    isOpen: boolean;
    type: 'success' | 'warning' | 'error' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  const showAlert = (type: 'success' | 'warning' | 'error', title: string, message: string) => {
    setNotify({ isOpen: true, type, title, message });
  };

  // 🌟 ฟังก์ชันเรียก Modal แบบมีปุ่ม ยืนยัน/ยกเลิก
  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setNotify({ isOpen: true, type: 'confirm', title, message, onConfirm });
  };

  const closeNotify = () => setNotify(prev => ({ ...prev, isOpen: false }));

  const fetchCloudBackups = async () => {
    setLoadingFiles(true);
    try {
      const { data, error } = await supabase.storage.from('backups').list('', {
        sortBy: { column: 'created_at', order: 'desc' }
      });
      if (error) throw error;
      setCloudFiles(data?.filter(f => f.name.endsWith('.json')) || []);
    } catch (err: any) {
      console.error('ไม่สามารถดึงข้อมูลไฟล์สำรองได้:', err.message);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchCloudBackups();
  }, []);

  // 🗄️ ดึงข้อมูล Full ERP ลงเครื่อง
  const handleBackup = async () => {
    setLoading(true);
    try {
      const { data: plots } = await supabase.from('plots').select('*');
      const { data: attendance } = await supabase.from('daily_attendance').select('*');
      const { data: advances } = await supabase.from('advance_payments').select('*');
      const { data: employees } = await supabase.from('employees').select('*');
      const { data: inventory } = await supabase.from('inventory').select('*');
      const { data: payroll } = await supabase.from('payroll').select('*');
      const { data: users } = await supabase.from('users').select('*');
      const { data: history } = await supabase.from('history').select('*');
      const { data: deliveries } = await supabase.from('sugarcane_deliveries').select('*');
      const { data: configs } = await supabase.from('truck_quota_configs').select('*');

      const backupPayload = {
        version: '3.0_Full_ERP_System',
        backup_date: new Date().toISOString(),
        plots: plots || [],
        daily_attendance: attendance || [],
        advance_payments: advances || [],
        employees: employees || [],
        inventory: inventory || [],
        payroll: payroll || [],
        users: users || [],
        history: history || [],
        sugarcane_deliveries: deliveries || [],
        truck_quota_configs: configs || []
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `ไร่อ้อย_Full_ERP_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showAlert('success', 'สำรองข้อมูลสำเร็จ!', 'ดาวน์โหลดข้อมูลครบทั้ง 9 ระบบหลักเรียบร้อยแล้วครับ');
    } catch (error: any) {
      showAlert('error', 'เกิดข้อผิดพลาดในการสำรองข้อมูล', error.message);
    } finally {
      setLoading(false);
    }
  };

  // ♻️ กู้คืนข้อมูล (Restore) กลับเข้าทุกตาราง
  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        if (!json.backup_date) {
          throw new Error('ไฟล์ไม่ถูกต้อง หรือไม่ใช่ไฟล์สำรองข้อมูลของระบบนี้');
        }

        // 🌟 เปลี่ยนมาใช้ Pop-up สวยๆ ของเราแทน
        showConfirm(
          '⚠️ คำเตือนอันตราย!',
          'คุณกำลังกู้คืนข้อมูลแบบ Full ERP (เขียนทับทั้งระบบ)\nแน่ใจหรือไม่ว่าต้องการดำเนินการต่อ?',
          async () => {
            setLoading(true);
            try {
              // ไล่อัปเดตข้อมูลทีละตาราง ถ้ามีข้อมูลใน JSON
              if (json.plots?.length > 0) await supabase.from('plots').upsert(json.plots);
              if (json.employees?.length > 0) await supabase.from('employees').upsert(json.employees);
              if (json.users?.length > 0) await supabase.from('users').upsert(json.users);
              if (json.inventory?.length > 0) await supabase.from('inventory').upsert(json.inventory);
              if (json.truck_quota_configs?.length > 0) await supabase.from('truck_quota_configs').upsert(json.truck_quota_configs);
              
              if (json.daily_attendance?.length > 0) await supabase.from('daily_attendance').upsert(json.daily_attendance);
              if (json.advance_payments?.length > 0) await supabase.from('advance_payments').upsert(json.advance_payments);
              if (json.payroll?.length > 0) await supabase.from('payroll').upsert(json.payroll);
              if (json.sugarcane_deliveries?.length > 0) await supabase.from('sugarcane_deliveries').upsert(json.sugarcane_deliveries);
              if (json.history?.length > 0) await supabase.from('history').upsert(json.history);

              showAlert('success', 'กู้คืนข้อมูลทั้งระบบสำเร็จ!', 'ข้อมูลทุกระบบถูกอัปเดตกลับคืนเรียบร้อยแล้วครับ');
            } catch (error: any) {
              showAlert('error', 'กู้คืนข้อมูลล้มเหลว', 'ไม่สามารถบันทึกข้อมูลได้: ' + error.message);
            } finally {
              setLoading(false);
              target.value = ''; 
            }
          }
        );

      } catch (error: any) {
        showAlert('error', 'อ่านไฟล์ล้มเหลว', 'รูปแบบไฟล์ไม่ถูกต้อง: ' + error.message);
        target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const downloadCloudFile = async (fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from('backups').download(fileName);
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showAlert('error', 'ดาวน์โหลดไม่สำเร็จ', err.message);
    }
  };

  const deleteCloudFile = (fileName: string) => {
    // 🌟 เปลี่ยนมาใช้ Pop-up สวยๆ ของเราแทน ไอ้ window.confirm
    showConfirm(
      'ยืนยันการลบไฟล์',
      `คุณต้องการลบไฟล์สำรอง ${fileName} ใช่หรือไม่?\n(ลบแล้วกู้คืนไม่ได้นะครับ)`,
      async () => {
        try {
          const { error } = await supabase.storage.from('backups').remove([fileName]);
          if (error) throw error;
          showAlert('success', 'ลบสำเร็จ', `ลบไฟล์ ${fileName} ออกจากระบบคลาวด์แล้ว`);
          fetchCloudBackups();
        } catch (err: any) {
          showAlert('error', 'ลบไม่สำเร็จ', err.message);
        }
      }
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#FCFBF7] font-sans pb-16">
      
      {/* Header */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1000px] mx-auto px-4 sm:px-8 py-4 flex items-center gap-4">
          <button onClick={() => router.push('/')} className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors shrink-0">
            <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-black text-stone-800">ระบบสำรองและกู้คืนข้อมูล (Full ERP Backup)</h1>
            <p className="text-xs text-stone-500 mt-0.5">จัดการฐานข้อมูลทั้งหมดเพื่อป้องกันข้อมูลสูญหาย</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1000px] mx-auto px-4 sm:px-8 mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: สำรองข้อมูล */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-8 flex flex-col items-center text-center gap-4">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-2">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4V4" /></svg>
            </div>
            <h2 className="text-xl font-black text-stone-800">สำรองข้อมูลทั้งหมด</h2>
            <p className="text-sm text-stone-500 font-medium">ดึงข้อมูลครบทุกระบบ (บิลอ้อย, เช็คชื่อ, คลังสินค้า ฯลฯ) ออกมาเป็นไฟล์ .json</p>
            
            <div className="mt-auto pt-6 w-full">
              <button 
                onClick={handleBackup} 
                disabled={loading}
                className="w-full py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50"
              >
                {loading ? 'กำลังดึงข้อมูลทั้งระบบ...' : '⬇️ ดาวน์โหลดไฟล์ Backup'}
              </button>
            </div>
          </div>

          {/* Card 2: กู้คืนข้อมูล */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-8 flex flex-col items-center text-center gap-4">
            <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-2">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </div>
            <h2 className="text-xl font-black text-stone-800">กู้คืนระบบจากไฟล์</h2>
            <p className="text-sm text-stone-500 font-medium">นำเข้าไฟล์ .json ระบบจะอัปเดตข้อมูลทับของเดิม <b>(ทำเฉพาะตอนระบบมีปัญหาเท่านั้น)</b></p>
            
            <div className="mt-auto pt-6 w-full">
              <label className={`w-full py-4 bg-white border-2 border-orange-400 text-orange-600 font-black rounded-xl hover:bg-orange-50 cursor-pointer flex justify-center items-center transition-colors shadow-sm ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                {loading ? 'กำลังนำเข้าข้อมูล...' : '⬆️ เลือกไฟล์เพื่อกู้คืนระบบ'}
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  onClick={(e) => (e.currentTarget.value = '')} 
                  onChange={handleRestore} 
                  disabled={loading} 
                />
              </label>
            </div>
          </div>

        </div>

        {/* 🌟 Section 3: ประวัติการสำรองข้อมูลอัตโนมัติบน Cloud 🌟 */}
        <div className="mt-10 bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-stone-800 flex items-center gap-2">
                ☁️ ไฟล์สำรองข้อมูลทั้งระบบอัตโนมัติ (คลาวด์)
              </h2>
              <p className="text-xs text-stone-500 mt-1">ไฟล์ที่ระบบแอบสำรองข้อมูลให้ทุกๆ เที่ยงคืน (เก็บย้อนหลังสูงสุด 15 วัน)</p>
            </div>
            <button onClick={fetchCloudBackups} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded-lg transition-colors" title="รีเฟรชข้อมูล">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white">
                <tr className="text-xs font-bold text-stone-400 border-b border-stone-100">
                  <th className="py-4 px-6">ชื่อไฟล์ (File Name)</th>
                  <th className="py-4 px-6">วันที่และเวลาที่สร้าง</th>
                  <th className="py-4 px-6">ขนาดไฟล์</th>
                  <th className="py-4 px-6 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-stone-700 divide-y divide-stone-50">
                {loadingFiles ? (
                  <tr><td colSpan={4} className="py-8 text-center text-stone-400 font-bold">กำลังโหลดข้อมูลคลาวด์...</td></tr>
                ) : cloudFiles.length > 0 ? (
                  cloudFiles.map((file) => (
                    <tr key={file.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-4 px-6 font-black text-stone-700 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        {file.name}
                      </td>
                      <td className="py-4 px-6 text-stone-500 font-bold">
                        {new Date(file.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="py-4 px-6 text-stone-500">{formatBytes(file.metadata?.size || 0)}</td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button 
                          onClick={() => downloadCloudFile(file.name)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 font-bold text-xs rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          ดาวน์โหลด
                        </button>
                        <button 
                          onClick={() => deleteCloudFile(file.name)}
                          className="px-3 py-1.5 bg-rose-50 text-rose-600 font-bold text-xs rounded-lg hover:bg-rose-100 transition-colors"
                        >
                          ลบทิ้ง
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="py-8 text-center text-stone-400 font-bold">ยังไม่มีไฟล์สำรองข้อมูลอัตโนมัติบนระบบ</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* 🌟 Notifications Modal 🌟 */}
      {notify.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in" onClick={notify.type !== 'confirm' ? closeNotify : undefined}></div>
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative z-10 p-6 animate-in fade-in zoom-in-95 flex flex-col items-center text-center">
            
            {/* Icon เปลี่ยนตามสถานะ */}
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              notify.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
              notify.type === 'error' ? 'bg-rose-100 text-rose-600' : 
              notify.type === 'confirm' ? 'bg-orange-100 text-orange-600' : 'bg-amber-100 text-amber-600'
            }`}>
              {notify.type === 'success' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
              {notify.type === 'error' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>}
              {(notify.type === 'warning' || notify.type === 'confirm') && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
            </div>

            <h3 className="text-xl font-black text-stone-800 mb-2">{notify.title}</h3>
            <p className="text-sm text-stone-500 font-medium mb-6 whitespace-pre-line">{notify.message}</p>

            {/* 🌟 ถ้าเป็น Modal แบบ Confirm จะมี 2 ปุ่ม (ยกเลิก / ยืนยัน) 🌟 */}
            {notify.type === 'confirm' ? (
              <div className="flex w-full gap-3">
                <button 
                  onClick={closeNotify} 
                  className="w-1/2 py-3 rounded-xl font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => { 
                    closeNotify(); 
                    if (notify.onConfirm) notify.onConfirm(); 
                  }} 
                  className="w-1/2 py-3 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-md shadow-rose-500/30"
                >
                  ยืนยัน
                </button>
              </div>
            ) : (
              /* ถ้าไม่ใช่ Confirm ก็มีปุ่มเดียว */
              <button 
                onClick={closeNotify} 
                className={`w-full py-3 rounded-xl font-bold text-white shadow-md transition-colors ${
                  notify.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30' :
                  notify.type === 'error' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/30' : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                ตกลง
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}