'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function BackupRestorePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cloudFiles, setCloudFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // 🌟 Full Backup: ตารางหลักทั้งหมด 10 ระบบ
  const targetTables = [
    'plots', 
    'daily_attendance', 
    'advance_payments', 
    'employees', 
    'inventory',
    'payroll',
    'users',
    'history',
    'sugarcane_deliveries',
    'truck_quota_configs'
  ];

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

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setNotify({ isOpen: true, type: 'confirm', title, message, onConfirm });
  };

  const closeNotify = () => setNotify(prev => ({ ...prev, isOpen: false }));

  // 🌟 ฟังก์ชัน: เช็คและรัน Auto Backup
  const checkAndRunAutoBackup = async () => {
    setSyncing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const fileName = `backup-full-${today}.json`;

      const { data: files, error: listError } = await supabase.storage.from('backups').list();
      if (listError) throw listError;

      const alreadyBackedUpToday = files?.some(f => f.name === fileName);

      if (!alreadyBackedUpToday) {
        console.log("Triggering Auto-Backup for today...");
        const fullData: any = {
          version: '3.0_Full_ERP_System',
          backup_date: new Date().toISOString()
        };
        
        for (const table of targetTables) {
          const { data, error } = await supabase.from(table).select('*');
          if (!error && data) {
            fullData[table] = data;
          }
        }

        const jsonString = JSON.stringify(fullData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });

        await supabase.storage.from('backups').upload(fileName, blob, { upsert: true });
        
        // 💡 แก้ไข TypeScript Error ตรงนี้: จัดการค่า null
        if (files && files.length >= 15) {
          const sortedFiles = files.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateA - dateB;
          });
          const filesToDelete = sortedFiles.slice(0, sortedFiles.length - 14).map(f => f.name);
          if (filesToDelete.length > 0) {
            await supabase.storage.from('backups').remove(filesToDelete);
          }
        }
      }

      await fetchCloudBackups();

    } catch (error) {
      console.error("Auto Backup Failed:", error);
    } finally {
      setSyncing(false);
      setLoadingFiles(false);
    }
  };

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
    checkAndRunAutoBackup();
  }, []);

  const handleBackup = async () => {
    setLoading(true);
    try {
      const fullData: any = {
        version: '3.0_Full_ERP_System',
        backup_date: new Date().toISOString()
      };

      for (const table of targetTables) {
        const { data, error } = await supabase.from(table).select('*');
        if (!error && data) {
          fullData[table] = data;
        }
      }

      const jsonString = JSON.stringify(fullData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `ไร่อ้อย_Full_ERP_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);

      showAlert('success', 'สำรองข้อมูลสำเร็จ!', 'ดาวน์โหลดข้อมูลลงเครื่องเรียบร้อยแล้วครับ');
    } catch (error: any) {
      showAlert('error', 'เกิดข้อผิดพลาดในการสำรองข้อมูล', error.message);
    } finally {
      setLoading(false);
    }
  };

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

        showConfirm(
          '⚠️ คำเตือนอันตราย!',
          'คุณกำลังกู้คืนข้อมูลแบบ Full ERP (เขียนทับทั้งระบบ)\nแน่ใจหรือไม่ว่าต้องการดำเนินการต่อ?',
          async () => {
            setLoading(true);
            try {
              for (const table of targetTables) {
                if (json[table] && json[table].length > 0) {
                  await supabase.from(table).upsert(json[table]);
                }
              }
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
    showConfirm(
      'ยืนยันการลบไฟล์',
      `คุณต้องการลบไฟล์สำรอง ${fileName} ใช่หรือไม่?\n(ลบแล้วไม่สามารถกู้คืนได้)`,
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
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-16 selection:bg-orange-500 selection:text-white">
      
      {/* 🌟 Premium Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1200px] mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => router.push('/')} className="w-10 h-10 bg-stone-50 border border-stone-200 hover:bg-stone-100 hover:border-stone-300 rounded-xl flex items-center justify-center text-stone-600 transition-all shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-stone-900 tracking-tight">ระบบสำรองและกู้คืนข้อมูล (Backup)</h1>
            <p className="text-xs md:text-sm font-medium text-stone-500 mt-0.5">จัดการฐานข้อมูลทั้งหมดเพื่อป้องกันข้อมูลสูญหาย</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-6 mt-8 space-y-8">
        
        {/* 🌟 2 Cards (สำรอง / กู้คืน) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div className="bg-white rounded-[2rem] border border-stone-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all p-8 md:p-10 flex flex-col items-center text-center group">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4V4" /></svg>
            </div>
            <h2 className="text-2xl font-black text-stone-800 mb-2">สำรองข้อมูลทั้งหมด</h2>
            <p className="text-sm text-stone-500 font-medium px-4 mb-8">ดึงข้อมูลครบทุกระบบที่เชื่อมต่อไว้ (Full ERP) ออกมาเป็นไฟล์ JSON เข้าคอมพิวเตอร์ของคุณ</p>
            
            <div className="mt-auto w-full max-w-sm">
              <button 
                onClick={handleBackup} 
                disabled={loading}
                className="w-full py-4 bg-blue-600 text-white text-[15px] font-black rounded-xl hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    กำลังดึงข้อมูล...
                  </span>
                ) : 'ดาวน์โหลดไฟล์ Backup'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-stone-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all p-8 md:p-10 flex flex-col items-center text-center group">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-red-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </div>
            <h2 className="text-2xl font-black text-stone-800 mb-2">กู้คืนระบบจากไฟล์</h2>
            <p className="text-sm text-stone-500 font-medium px-4 mb-8">นำเข้าไฟล์ JSON เพื่อกู้คืนข้อมูลทับของเดิมทั้งหมด <span className="font-bold text-rose-500">(ทำเฉพาะตอนระบบมีปัญหาเท่านั้น)</span></p>
            
            <div className="mt-auto w-full max-w-sm">
              <label className={`w-full py-4 bg-white border-2 border-dashed border-orange-400 text-orange-600 text-[15px] font-black rounded-xl hover:bg-orange-50 cursor-pointer flex justify-center items-center transition-all shadow-sm hover:-translate-y-0.5 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                {loading ? 'กำลังนำเข้าข้อมูล...' : 'อัปโหลดไฟล์เพื่อกู้คืนระบบ'}
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
        <div className="mt-10 bg-white rounded-[2rem] border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-6 md:px-8 md:py-6 border-b border-stone-100 bg-stone-50 flex justify-between items-center">
            <div>
              <h2 className="text-lg md:text-xl font-black text-stone-800 flex items-center gap-2">
                ☁️ ข้อมูลสำรองบนคลาวด์อัตโนมัติ
              </h2>
              <p className="text-xs md:text-sm text-stone-500 font-medium mt-1">ไฟล์ที่ระบบบันทึกอัตโนมัติ (เก็บย้อนหลังสูงสุด 15 วัน)</p>
            </div>
            <button onClick={checkAndRunAutoBackup} disabled={syncing} className="p-2.5 text-stone-500 bg-white border border-stone-200 hover:text-orange-600 hover:border-orange-300 rounded-xl transition-all shadow-sm" title="เช็คสถานะและสำรองข้อมูลล่าสุด">
              <svg className={`w-5 h-5 ${syncing ? 'animate-spin text-orange-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-white">
                <tr className="text-[12px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100">
                  <th className="py-4 px-8">ชื่อไฟล์</th>
                  <th className="py-4 px-6">วัน-เวลาที่บันทึก</th>
                  <th className="py-4 px-6">ขนาด</th>
                  <th className="py-4 px-8 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-stone-700 divide-y divide-stone-50">
                {loadingFiles || syncing ? (
                  <tr><td colSpan={4} className="py-12 text-center text-stone-400 font-bold">กำลังอัปเดตและดึงข้อมูลคลาวด์...</td></tr>
                ) : cloudFiles.length > 0 ? (
                  cloudFiles.map((file) => (
                    <tr key={file.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-4 px-8 font-black text-stone-800 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        {file.name}
                      </td>
                      {/* 💡 แก้ไข TypeScript Error ตรงนี้: จัดการค่า null */}
                      <td className="py-4 px-6 text-stone-500 font-bold">
                        {file.created_at ? new Date(file.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                      </td>
                      <td className="py-4 px-6 text-stone-500 font-bold">{formatBytes(file.metadata?.size || 0)}</td>
                      <td className="py-4 px-8 text-right space-x-2">
                        <button 
                          onClick={() => downloadCloudFile(file.name)}
                          className="px-4 py-2 bg-stone-100 text-stone-700 font-bold text-xs rounded-xl hover:bg-stone-200 transition-colors"
                        >
                          โหลดเก็บไว้
                        </button>
                        <button 
                          onClick={() => deleteCloudFile(file.name)}
                          className="px-4 py-2 bg-rose-50 text-rose-600 font-bold text-xs rounded-xl hover:bg-rose-100 transition-colors"
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="py-12 text-center text-stone-400 font-bold">ยังไม่มีไฟล์สำรองข้อมูลอัตโนมัติบนระบบ</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* 🌟 Notifications Modal 🌟 */}
      {notify.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in transition-opacity" onClick={notify.type !== 'confirm' ? closeNotify : undefined}></div>
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl relative z-10 p-8 animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            
            <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center mb-5 ${
              notify.type === 'success' ? 'bg-emerald-50 text-emerald-500 border border-emerald-100' :
              notify.type === 'error' ? 'bg-rose-50 text-rose-500 border border-rose-100' : 
              notify.type === 'confirm' ? 'bg-orange-50 text-orange-500 border border-orange-100' : 'bg-amber-50 text-amber-500 border border-amber-100'
            }`}>
              {notify.type === 'success' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>}
              {notify.type === 'error' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>}
              {(notify.type === 'warning' || notify.type === 'confirm') && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
            </div>

            <h3 className="text-xl font-black text-stone-900 mb-2">{notify.title}</h3>
            <p className="text-[13px] text-stone-500 font-medium mb-8 whitespace-pre-line leading-relaxed">{notify.message}</p>

            {notify.type === 'confirm' ? (
              <div className="flex w-full gap-3">
                <button 
                  onClick={closeNotify} 
                  className="w-1/2 py-3.5 rounded-xl font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => { 
                    closeNotify(); 
                    if (notify.onConfirm) notify.onConfirm(); 
                  }} 
                  className="w-1/2 py-3.5 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-500/30"
                >
                  ยืนยันดำเนินการ
                </button>
              </div>
            ) : (
              <button 
                onClick={closeNotify} 
                className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-colors ${
                  notify.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/30' :
                  notify.type === 'error' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/30' : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/30'
                }`}
              >
                รับทราบ
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}