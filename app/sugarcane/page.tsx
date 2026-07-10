'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface CaneDelivery {
  id: string;
  date: string;
  period_no: string;
  emp_name: string;
  truck_plate: string;
  factory_name: string;
  cane_type: string;
  net_weight: number;
  ticket_no: string;
  group_leader: string; 
  quota_no: string;     
}

interface TicketRow {
  id: string;
  date: string;
  factory_name: string; 
  cane_type: string;
  net_weight: string;
  ticket_no: string;
  truck_part: 'head' | 'tail';
}

export default function SugarcaneBillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deliveries, setDeliveries] = useState<CaneDelivery[]>([]);
  
  const [factoryOptions, setFactoryOptions] = useState<string[]>(['น้ำตาลระยอง', 'สหการชลบุรี']);
  const [empOptions, setEmpOptions] = useState<string[]>(['รักษ์', 'อู๊ด', 'ดำ']);

  const [selectedPeriod, setSelectedDatePeriod] = useState('งวดที่ 1');
  const [selectedFactory, setSelectedFactory] = useState('ทั้งหมด');

  const [basePrice, setBasePrice] = useState<number>(1000); 
  const [burntPenalty, setBurntPenalty] = useState<number>(30); 

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // State สำหรับระบบค้นหาและแบ่งหน้า (Pagination)
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [formHeader, setFormHeader] = useState({
    period_no: 'งวดที่ 1',
    emp_name: 'รักษ์',
    truck_plate_head: '',
    truck_plate_tail: ''
  });

  const [factoryConfigs, setFactoryConfigs] = useState<Record<string, { quota_no: string, group_leader: string }>>({});

  const [ticketRows, setTicketRows] = useState<TicketRow[]>([
    { id: '1', date: new Date().toISOString().split('T')[0], factory_name: 'น้ำตาลระยอง', cane_type: 'สด', net_weight: '', ticket_no: '', truck_part: 'head' }
  ]);

  const [customPrompt, setCustomPrompt] = useState({ 
    isOpen: false, type: '', title: '', placeholder: '', inputValue: '' 
  });

  const [notify, setNotify] = useState({
    isOpen: false,
    type: 'success', 
    title: '',
    message: '',
    onConfirm: null as (() => void) | null
  });

  const showAlert = (type: 'success' | 'warning' | 'error', title: string, message: string) => {
    setNotify({ isOpen: true, type, title, message, onConfirm: null });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setNotify({ isOpen: true, type: 'confirm', title, message, onConfirm });
  };

  const closeNotify = () => {
    setNotify(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    const fetchInitialOptions = async () => {
      const { data } = await supabase.from('sugarcane_deliveries').select('factory_name, emp_name');
      if (data) {
        const facs = Array.from(new Set(data.map(d => d.factory_name).filter(Boolean)));
        const emps = Array.from(new Set(data.map(d => d.emp_name).filter(Boolean)));
        setFactoryOptions(prev => Array.from(new Set([...prev, ...facs])));
        setEmpOptions(prev => Array.from(new Set([...prev, ...emps])));
      }
    };
    fetchInitialOptions();
  }, []);

  useEffect(() => {
    const loadTruckConfigs = async () => {
      if (!formHeader.truck_plate_head) return;

      const plates = [formHeader.truck_plate_head.trim()];
      if (formHeader.truck_plate_tail.trim()) {
        plates.push(formHeader.truck_plate_tail.trim());
      }

      const { data } = await supabase
        .from('truck_quota_configs')
        .select('*')
        .eq('emp_name', formHeader.emp_name)
        .in('truck_plate', plates);

      setFactoryConfigs(prev => {
        const newConfigs: Record<string, { quota_no: string, group_leader: string }> = {};
        factoryOptions.forEach(fac => {
          const matchHead = data?.find(d => d.factory_name === fac && d.truck_plate === formHeader.truck_plate_head.trim());
          newConfigs[`${fac}_head`] = {
            quota_no: matchHead?.quota_no || '',
            group_leader: matchHead?.group_leader || ''
          };

          const matchTail = formHeader.truck_plate_tail.trim()
            ? data?.find(d => d.factory_name === fac && d.truck_plate === formHeader.truck_plate_tail.trim())
            : null;
          newConfigs[`${fac}_tail`] = {
            quota_no: matchTail?.quota_no || '',
            group_leader: matchTail?.group_leader || ''
          };
        });
        return newConfigs;
      });
    };

    if (showModal) {
      loadTruckConfigs();
    }
  }, [formHeader.emp_name, formHeader.truck_plate_head, formHeader.truck_plate_tail, factoryOptions, showModal]);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      let query = supabase.from('sugarcane_deliveries').select('*').eq('period_no', selectedPeriod);
      if (selectedFactory !== 'ทั้งหมด') {
        query = query.eq('factory_name', selectedFactory);
      }
      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw error;
      setDeliveries(data || []);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [selectedPeriod, selectedFactory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPeriod, selectedFactory, searchQuery, deliveries.length]);

  const addTicketRow = () => {
    const lastRow = ticketRows[ticketRows.length - 1];
    setTicketRows([
      ...ticketRows,
      { 
        id: Date.now().toString(), 
        date: lastRow ? lastRow.date : new Date().toISOString().split('T')[0], 
        factory_name: lastRow ? lastRow.factory_name : (factoryOptions[0] || 'น้ำตาลระยอง'), 
        cane_type: 'สด', 
        net_weight: '', 
        ticket_no: '',
        truck_part: lastRow ? lastRow.truck_part : 'head' 
      }
    ]);
  };

  const removeTicketRow = (id: string) => {
    if (ticketRows.length === 1) return; 
    setTicketRows(ticketRows.filter(row => row.id !== id));
  };

  const updateRowValue = (id: string, field: keyof TicketRow, value: string) => {
    setTicketRows(ticketRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const updateFactoryConfig = (factoryName: string, type: 'head' | 'tail', field: 'quota_no' | 'group_leader', value: string) => {
    const key = `${factoryName}_${type}`;
    setFactoryConfigs(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
  };

  const handleSaveBulkTickets = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formHeader.truck_plate_head.trim()) {
      showAlert('warning', 'ข้อมูลไม่ครบ', 'กรุณากรอกทะเบียนรถหัวก่อนบันทึกครับ');
      return;
    }

    const hasTailRow = ticketRows.some(row => row.truck_part === 'tail');
    if (hasTailRow && !formHeader.truck_plate_tail.trim()) {
      showAlert('warning', 'ข้อมูลไม่ถูกต้อง', 'มีการคีย์บิลส่วนหางพ่วง แต่ไม่ได้ระบุเลขทะเบียนหางพ่วงด้านบนครับ');
      return;
    }

    const hasEmptyWeight = ticketRows.some(row => !row.net_weight || Number(row.net_weight) <= 0);
    if (hasEmptyWeight) {
      showAlert('warning', 'ข้อมูลน้ำหนักไม่ถูกต้อง', 'กรุณากรอกน้ำหนักสุทธิให้ครบทุกแถว และต้องมากกว่า 0 ตันครับ');
      return;
    }

    setSaving(true);
    try {
      const configUpserts: any[] = [];
      factoryOptions.forEach(fac => {
        const hKey = `${fac}_head`;
        if (factoryConfigs[hKey]?.quota_no || factoryConfigs[hKey]?.group_leader) {
          configUpserts.push({
            emp_name: formHeader.emp_name,
            truck_plate: formHeader.truck_plate_head.trim(),
            factory_name: fac,
            quota_no: (factoryConfigs[hKey].quota_no || '').trim().toUpperCase(),
            group_leader: (factoryConfigs[hKey].group_leader || '').trim()
          });
        }
        const tKey = `${fac}_tail`;
        if (formHeader.truck_plate_tail.trim() && (factoryConfigs[tKey]?.quota_no || factoryConfigs[tKey]?.group_leader)) {
          configUpserts.push({
            emp_name: formHeader.emp_name,
            truck_plate: formHeader.truck_plate_tail.trim(),
            factory_name: fac,
            quota_no: (factoryConfigs[tKey].quota_no || '').trim().toUpperCase(),
            group_leader: (factoryConfigs[tKey].group_leader || '').trim()
          });
        }
      });

      if (configUpserts.length > 0) {
        await supabase.from('truck_quota_configs').upsert(configUpserts, { onConflict: 'emp_name,truck_plate,factory_name' });
      }

      const insertData = ticketRows.map(row => {
        const isHead = row.truck_part === 'head';
        const currentPlate = isHead ? formHeader.truck_plate_head.trim() : formHeader.truck_plate_tail.trim();
        const configKey = `${row.factory_name}_${row.truck_part}`;

        return {
          date: row.date,
          period_no: formHeader.period_no,
          emp_name: formHeader.emp_name,
          truck_plate: currentPlate,
          factory_name: row.factory_name, 
          cane_type: row.cane_type,
          net_weight: Number(row.net_weight),
          ticket_no: row.ticket_no.trim(),
          quota_no: (factoryConfigs[configKey]?.quota_no || '').trim().toUpperCase(),
          group_leader: (factoryConfigs[configKey]?.group_leader || '').trim()
        };
      });

      const { error } = await supabase.from('sugarcane_deliveries').insert(insertData);
      if (error) throw error;
      
      setShowModal(false);
      setTicketRows([{ id: '1', date: new Date().toISOString().split('T')[0], factory_name: factoryOptions[0] || 'น้ำตาลระยอง', cane_type: 'สด', net_weight: '', ticket_no: '', truck_part: 'head' }]);
      fetchDeliveries();
      
      showAlert('success', 'บันทึกสำเร็จ!', `บันทึกข้อมูลรถคุณ ${formHeader.emp_name} จำนวน ${insertData.length} เที่ยวเรียบร้อยครับ!`);

    } catch (error: any) {
      showAlert('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    showConfirm('ยืนยันการลบ', 'คุณต้องการลบบิลตั๋วชั่งใบนี้ใช่หรือไม่? (ลบแล้วกู้คืนไม่ได้)', async () => {
      try {
        await supabase.from('sugarcane_deliveries').delete().eq('id', id);
        fetchDeliveries();
        showAlert('success', 'ลบสำเร็จ', 'ลบบิลตั๋วชั่งออกจากระบบเรียบร้อยแล้ว');
      } catch (error: any) {
        showAlert('error', 'ลบไม่สำเร็จ', error.message);
      }
    });
  };

  const formatDateThai = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateShort = (dateString: string) => {
    const d = new Date(dateString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = (d.getFullYear() + 543).toString().slice(-2);
    return `${day}-${month}-${year}`;
  };

  const openCustomPrompt = (type: 'emp' | 'factory', title: string, placeholder: string) => {
    setCustomPrompt({ isOpen: true, type, title, placeholder, inputValue: '' });
  };

  const handleCustomPromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = customPrompt.inputValue.trim();
    if (!val) return;

    if (customPrompt.type === 'emp') {
      setEmpOptions(prev => Array.from(new Set([...prev, val])));
      setFormHeader({ ...formHeader, emp_name: val });
    } else if (customPrompt.type === 'factory') {
      setFactoryOptions(prev => Array.from(new Set([...prev, val])));
      setFactoryConfigs(prev => ({ ...prev, [val]: { quota_no: '', group_leader: '' } }));
      const updatedRows = [...ticketRows];
      if (updatedRows.length > 0) {
        updatedRows[updatedRows.length - 1].factory_name = val;
        setTicketRows(updatedRows);
      }
    }
    setCustomPrompt({ ...customPrompt, isOpen: false });
  };

  // Logic การค้นหาและแบ่งหน้า
  const filteredDeliveries = deliveries.filter((record) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (record.date || '').toLowerCase().includes(q) ||
      (record.emp_name || '').toLowerCase().includes(q) ||
      (record.truck_plate || '').toLowerCase().includes(q) ||
      (record.group_leader || '').toLowerCase().includes(q) ||
      (record.quota_no || '').toLowerCase().includes(q) ||
      (record.factory_name || '').toLowerCase().includes(q) ||
      (record.cane_type || '').toLowerCase().includes(q) ||
      (record.ticket_no || '').toLowerCase().includes(q)
    );
  });

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredDeliveries.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredDeliveries.length / rowsPerPage) || 1;

  const paginationControls = !loading && filteredDeliveries.length > 0 && (
    <div className="p-4 bg-stone-50/50 flex flex-col sm:flex-row items-center justify-between text-xs font-bold text-stone-500 gap-4">
      <span>
        แสดง {indexOfFirstRow + 1} ถึง {Math.min(indexOfLastRow, filteredDeliveries.length)} จากทั้งหมด {filteredDeliveries.length}
      </span>
      <div className="flex items-center gap-1">
        <button 
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
          disabled={currentPage === 1}
          className="px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-white disabled:opacity-30 transition-colors"
        >
          ก่อนหน้า
        </button>
        <span className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-orange-600">
          หน้า {currentPage} / {totalPages}
        </span>
        <button 
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-white disabled:opacity-30 transition-colors"
        >
          ถัดไป
        </button>
      </div>
    </div>
  );

  // การสรุปยอดรวม (สำหรับหน้าจอเว็บ)
  const summaryPerEmployee = deliveries.reduce((acc: Record<string, any>, current) => {
    const name = current.emp_name;
    if (!acc[name]) acc[name] = { name, totalWeight: 0, freshWeight: 0, burntWeight: 0, trips: 0, totalMoney: 0 };
    
    const weight = Number(current.net_weight || 0);
    acc[name].totalWeight += weight;
    acc[name].trips += 1;

    if (current.cane_type === 'สด') {
      acc[name].freshWeight = (acc[name].freshWeight || 0) + weight;
      acc[name].totalMoney += weight * basePrice;
    } else if (current.cane_type === 'เผา') {
      acc[name].burntWeight = (acc[name].burntWeight || 0) + weight;
      acc[name].totalMoney += weight * (basePrice - burntPenalty);
    }
    return acc;
  }, {});

  const employeeSummaryList = Object.values(summaryPerEmployee);
  const grandTotalWeight = employeeSummaryList.reduce((sum: number, e: any) => sum + e.totalWeight, 0);
  const grandTotalMoney = employeeSummaryList.reduce((sum: number, e: any) => sum + e.totalMoney, 0);

  const factoryTypeSummaryMap = deliveries.reduce((acc: Record<string, { fresh: number, burnt: number, total: number }>, cur) => {
    const fName = cur.factory_name;
    if (!acc[fName]) {
      acc[fName] = { fresh: 0, burnt: 0, total: 0 };
    }
    const w = Number(cur.net_weight || 0);
    if (cur.cane_type === 'สด') acc[fName].fresh += w;
    else if (cur.cane_type === 'เผา') acc[fName].burnt += w;
    acc[fName].total += w;
    return acc;
  }, {});

  const factorySummaryList = Object.entries(factoryTypeSummaryMap);

  const exportToExcel = () => {
    if (deliveries.length === 0) {
      showAlert('warning', 'ไม่พบข้อมูล', 'ไม่มีข้อมูลสำหรับส่งออก Excel ในงวดนี้ครับ');
      return;
    }

    const excelData = deliveries.map((record, index) => ({
      'ลำดับ': index + 1,
      'วันที่': formatDateThai(record.date),
      'งวด': record.period_no,
      'ชื่อโควตา/คนรถ': record.emp_name,
      'ทะเบียนรถ': record.truck_plate || '-',
      'หัวหน้ากลุ่ม': record.group_leader || '-',
      'เลขประจำรถ': record.quota_no || '-',
      'โรงงานปลายทาง': record.factory_name,
      'ประเภทอ้อย': `อ้อย${record.cane_type}`,
      'เลขที่ตั๋วชั่ง': record.ticket_no || '-',
      'น้ำหนักสุทธิ (ตัน)': Number(record.net_weight),
      'ราคา/ตัน (บาท)': record.cane_type === 'สด' ? basePrice : (basePrice - burntPenalty),
      'รวมเป็นเงิน (บาท)': record.cane_type === 'สด' ? (Number(record.net_weight) * basePrice) : (Number(record.net_weight) * (basePrice - burntPenalty))
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "รายละเอียดตั๋วชั่งอ้อย");
    XLSX.writeFile(workbook, `รายละเอียดบิลอ้อย_${selectedPeriod}.xlsx`);
  };

  // 🌟 ฟังก์ชันจัดการข้อมูลหน้าปริ้นท์ 🌟
  const printGroupedData = deliveries.reduce((acc: any, curr) => {
    if (!acc[curr.emp_name]) acc[curr.emp_name] = {};
    if (!acc[curr.emp_name][curr.truck_plate]) acc[curr.emp_name][curr.truck_plate] = [];
    acc[curr.emp_name][curr.truck_plate].push(curr);
    return acc;
  }, {});

  const empPrintLayout = Object.entries(printGroupedData).map(([empName, truckMap]: any) => {
    const truckPlates = Object.keys(truckMap).sort();
    const pairs = [];
    let i = 0;
    while (i < truckPlates.length) {
       const currentPlate = truckPlates[i];
       const nextPlate = truckPlates[i+1];
       
       if (nextPlate && (currentPlate.includes('(หัว)') || nextPlate.includes('(หาง)'))) {
           pairs.push([currentPlate, nextPlate]);
           i += 2;
       } else {
           pairs.push([currentPlate, null]); 
           i += 1;
       }
    }
    return { empName, truckMap, pairs };
  });

  // 💡 ฟังก์ชันนับเที่ยวแยก "หัว" และ "หาง" แบบอิสระ
  const calculateTrips = (deliv1: CaneDelivery[], deliv2: CaneDelivery[] | null, condition: (d: CaneDelivery) => boolean) => {
    const trips1 = deliv1.filter(condition).length;
    const trips2 = deliv2 ? deliv2.filter(condition).length : 0;
    return trips1 + trips2;
  };

  const getTruckStats = (truckDeliveries: CaneDelivery[], date: string) => {
    if (!truckDeliveries) return { fresh: null, burnt: null, group: null, chonburi: null };
    const dayDelivs = truckDeliveries.filter((d: any) => d.date === date);
    if (dayDelivs.length === 0) return { fresh: null, burnt: null, group: null, chonburi: null };

    const rayongDelivs = dayDelivs.filter((d: any) => d.factory_name.includes('ระยอง'));
    const chonburiDelivs = dayDelivs.filter((d: any) => d.factory_name.includes('ชลบุรี'));

    const fresh = rayongDelivs.filter((d: any) => d.cane_type === 'สด').reduce((s: number, d: any) => s + Number(d.net_weight), 0);
    const burnt = rayongDelivs.filter((d: any) => d.cane_type === 'เผา').reduce((s: number, d: any) => s + Number(d.net_weight), 0);
    const chonburi = chonburiDelivs.reduce((s: number, d: any) => s + Number(d.net_weight), 0);

    return {
      fresh: fresh > 0 ? fresh : null,
      burnt: burnt > 0 ? burnt : null,
      group: Array.from(new Set(rayongDelivs.map((d: any) => d.group_leader))).filter(Boolean).join(',') || null,
      chonburi: chonburi > 0 ? chonburi : null
    };
  };

  return (
    <>
      {/* ========================================== */}
      {/* 💻 หน้าจอแอปพลิเคชันหลัก (จะถูกซ่อนยามปริ้นท์งาน) */}
      {/* ========================================== */}
      <div className="min-h-screen bg-[#FCFBF7] pb-16 font-sans print:hidden">
        
        {/* Header */}
        <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
          <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4 w-full sm:w-auto">
              <button onClick={() => router.push('/')} className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors shrink-0">
                <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </button>
              <div>
                <h1 className="text-xl font-black text-stone-800 truncate">ระบบคิดเงินอ้อยเข้าโรงงาน</h1>
                <p className="text-xs text-stone-500 mt-0.5 hidden sm:block">บันทึกตั๋วชั่งแบบชุดแยกรายเที่ยว คำนวณยอดเงิน หักอ้อยเผาอัตโนมัติ</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={() => window.print()} 
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                <span>พิมพ์เอกสารสรุป</span>
              </button>
              <button onClick={() => setShowModal(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-all active:scale-95 shadow-sm shadow-orange-500/30">
                <span>บันทึกตั๋วชุดรายคัน</span>
              </button>
              <button onClick={exportToExcel} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-100 text-stone-700 font-bold rounded-xl hover:bg-stone-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span className="hidden lg:inline">ส่งออกรายละเอียด Excel</span>
              </button>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 mt-6 lg:mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-6 space-y-4">
                <h3 className="font-black text-stone-800 border-b border-stone-100 pb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                  ตัวกรอง & ตั้งราคา
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-stone-500 mb-1">เลือกงวดการตัด</label>
                    <select value={selectedPeriod} onChange={(e) => setSelectedDatePeriod(e.target.value)} className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-700 text-xs sm:text-sm focus:ring-2 focus:ring-orange-500 outline-none">
                      {['งวดที่ 1', 'งวดที่ 2', 'งวดที่ 3', 'งวดที่ 4', 'งวดที่ 5'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-stone-500 mb-1">โรงงานปลายทาง</label>
                    <select value={selectedFactory} onChange={(e) => setSelectedFactory(e.target.value)} className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-700 text-xs sm:text-sm focus:ring-2 focus:ring-orange-500 outline-none">
                      <option value="ทั้งหมด">ทั้งหมด</option>
                      {factoryOptions.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>

                <div className="border-t border-stone-100 pt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-emerald-600 mb-1">ราคาอ้อยสด (บาท/ตัน)</label>
                    <input type="number" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value) || 0)} className="w-full px-3 py-2 border border-emerald-200 bg-emerald-50/30 text-emerald-800 font-black rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-right" />
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-rose-600 mb-1">ยอดหักอ้อยเผา (บาท/ตัน)</label>
                    <input type="number" value={burntPenalty} onChange={(e) => setBurntPenalty(Number(e.target.value) || 0)} className="w-full px-3 py-2 border border-rose-200 bg-rose-50/30 text-rose-800 font-black rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none text-right" />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-3xl p-6 sm:p-8 shadow-lg shadow-orange-500/20">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest opacity-90 mb-1">ยอดรวมเงินค่าอ้อยสุทธิประจำงวด</p>
                <h2 className="text-4xl sm:text-5xl font-black mb-1 tracking-tight truncate">฿ {grandTotalMoney.toLocaleString()}</h2>
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/20 text-xs sm:text-sm font-medium">
                  <span>อ้อยส่งเข้าหีบแล้ว:</span>
                  <span className="font-black text-base">{grandTotalWeight.toLocaleString()} ตัน</span>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-6 space-y-3">
                <h4 className="font-black text-stone-800 text-sm flex items-center gap-2 border-b border-stone-100 pb-2">
                  📦 น้ำหนักรวมแยกโรงงาน (สด / เผา)
                </h4>
                <div className="space-y-3 text-xs">
                  {factorySummaryList.length > 0 ? factorySummaryList.map(([fName, values]: any) => (
                    <div key={fName} className="bg-stone-50 p-3 rounded-2xl border border-stone-200/50 space-y-1.5">
                      <span className="font-black text-orange-700 block text-xs">🏭 {fName}</span>
                      <div className="flex justify-between items-center text-stone-600">
                        <span>• รวมน้ำหนักอ้อยสด:</span>
                        <span className="font-bold text-emerald-600 text-sm">{Number(values.fresh).toFixed(2)} ตัน</span>
                      </div>
                      <div className="flex justify-between items-center text-stone-600">
                        <span>• รวมน้ำหนักอ้อยเผา:</span>
                        <span className="font-bold text-rose-500 text-sm">{Number(values.burnt).toFixed(2)} ตัน</span>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-stone-200/60 font-black text-stone-800">
                        <span>น้ำหนักรวมสุทธิ:</span>
                        <span className="text-base text-stone-900">{Number(values.total).toFixed(2)} ตัน</span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-center text-stone-400 font-bold py-2">ยังไม่มีข้อมูลน้ำหนักอ้อย</p>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              
              <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-stone-100 bg-stone-50/50">
                  <h2 className="text-base sm:text-lg font-black text-stone-800">📊 สรุปยอดรวมแยกตามโควตา/รถ</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-white text-[10px] sm:text-xs font-bold text-stone-400 border-b border-stone-100">
                        <th className="py-4 px-5">ชื่อคนรถ / โควตา</th>
                        <th className="py-4 px-3 text-center">จำนวนเที่ยว</th>
                        <th className="py-4 px-3 text-right">อ้อยสด (ตัน)</th>
                        <th className="py-4 px-3 text-right">อ้อยเผา (ตัน)</th>
                        <th className="py-4 px-5 text-right text-orange-600">รวมเป็นเงินสด</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium text-stone-700 divide-y divide-stone-50">
                      {employeeSummaryList.length > 0 ? employeeSummaryList.map((emp: any) => (
                        <tr key={emp.name} className="hover:bg-stone-50/80 transition-colors">
                          <td className="py-4 px-5 font-black text-stone-800">{emp.name}</td>
                          <td className="py-4 px-3 text-center text-stone-500 font-bold bg-stone-50/50">{emp.trips}</td>
                          <td className="py-4 px-3 text-right text-emerald-600 font-bold">{Number(emp.freshWeight || 0).toLocaleString()}</td>
                          <td className="py-4 px-3 text-right text-rose-500">{Number(emp.burntWeight || 0).toLocaleString()}</td>
                          <td className="py-4 px-5 text-right font-black text-orange-600 text-base">฿ {emp.totalMoney.toLocaleString()}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} className="py-12 text-center text-stone-400 font-bold text-sm">ยังไม่มีข้อมูลในงวดนี้</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-stone-200 shadow-sm flex flex-col">
                <div className="p-5 sm:p-6 border-b border-stone-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-base sm:text-lg font-black text-stone-800">📝 ประวัติบิลตั๋วชั่ง</h2>
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <input 
                        type="text" 
                        placeholder="ค้นหา (วันที่, ทะเบียน, โรงงาน...)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      />
                      <svg className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-stone-500">
                      <span>แสดง:</span>
                      <select 
                        value={rowsPerPage} 
                        onChange={(e) => setRowsPerPage(Number(e.target.value))} 
                        className="px-2 py-1.5 border border-stone-200 rounded-lg outline-none cursor-pointer focus:border-orange-500"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                </div>

                {paginationControls && <div className="border-b border-stone-100">{paginationControls}</div>}
                
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-stone-50">
                      <tr className="text-[10px] lg:text-xs font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200">
                        <th className="py-4 px-2 lg:px-4">วันที่</th>
                        <th className="py-4 px-2 lg:px-3">ทะเบียนรถ</th>
                        <th className="py-4 px-2 lg:px-3">กลุ่ม/รหัส</th>
                        <th className="py-4 px-2 lg:px-3">โรงงาน</th>
                        <th className="py-4 px-2 text-center">ประเภท</th>
                        <th className="py-4 px-2 lg:px-3 text-right">น้ำหนักสุทธิ</th>
                        <th className="py-4 px-2 lg:px-4 text-center">ลบ</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs lg:text-sm font-medium text-stone-700 divide-y divide-stone-100">
                      {loading ? (
                        <tr><td colSpan={7} className="py-12 text-center"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
                      ) : currentRows.length > 0 ? currentRows.map((record: any) => (
                        <tr key={record.id} className="hover:bg-orange-50/30 transition-colors">
                          <td className="py-3 px-2 lg:px-4 font-bold text-stone-500 whitespace-nowrap">{formatDateThai(record.date)}</td>
                          <td className="py-3 px-2 lg:px-3 font-black text-stone-800 whitespace-nowrap">
                            {record.emp_name} <span className="text-[10px] text-stone-400 block font-medium">{record.truck_plate || '-'}</span>
                          </td>
                          <td className="py-3 px-2 lg:px-3 whitespace-nowrap">
                            <span className="font-bold text-stone-600 block">{record.group_leader || '-'}</span>
                            <span className="font-black text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded text-[10px]">{record.quota_no || '-'}</span>
                          </td>
                          <td className="py-3 px-2 lg:px-3 text-stone-600 whitespace-nowrap">{record.factory_name}</td>
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${record.cane_type === 'สด' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              อ้อย{record.cane_type}
                            </span>
                          </td>
                          <td className="py-3 px-2 lg:px-3 text-right font-black text-stone-800 text-base whitespace-nowrap">{Number(record.net_weight).toLocaleString()}</td>
                          <td className="py-3 px-2 lg:px-4 text-center">
                            <button onClick={() => handleDelete(record.id)} className="text-stone-300 hover:text-red-500 transition-colors p-1" title="ลบบิลนี้">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={7} className="py-12 text-center text-stone-400 font-bold">ไม่พบข้อมูลบิลตั๋วชั่ง</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {paginationControls && <div className="border-t border-stone-100">{paginationControls}</div>}
              </div>
            </div>

          </div>
        </div>

        {/* MODAL แผงกรอกบิลชุดใหญ่ */}
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
            <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => !saving && setShowModal(false)}></div>
            <div className="bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
              
              <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-lg font-black text-stone-800 flex items-center gap-2">
                    <span className="text-orange-500">🚜</span> ลงบิลตั๋วชั่งชุดใหญ่
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">ระบุชื่อคนรถครั้งเดียว แล้วป้อนน้ำหนักสลับโรงงานได้เลย (กดปุ่ม Enter ตรงน้ำหนักเพื่อเพิ่มแถวทันที!)</p>
                </div>
                <button onClick={() => !saving && setShowModal(false)} className="w-8 h-8 rounded-full bg-stone-200 text-stone-500 hover:bg-stone-300 flex items-center justify-center font-bold transition-colors">✕</button>
              </div>

              <form onSubmit={handleSaveBulkTickets} className="flex-1 overflow-y-auto p-6 space-y-6">
                
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/60 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 mb-1">งวดที่ตัด</label>
                    <select value={formHeader.period_no} onChange={(e) => setFormHeader({...formHeader, period_no: e.target.value})} className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-800 outline-none">
                      {['งวดที่ 1', 'งวดที่ 2', 'งวดที่ 3', 'งวดที่ 4', 'งวดที่ 5'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-baseline mb-1">
                      <label className="block text-[11px] font-bold text-stone-500">โควตารถ</label>
                      <button type="button" onClick={() => openCustomPrompt('emp', 'เพิ่มคนรถ/โควตาใหม่', 'พิมพ์ชื่อ...')} className="text-[9px] text-orange-600 font-bold bg-white border border-orange-200 px-1.5 rounded">+ ใหม่</button>
                    </div>
                    <select value={formHeader.emp_name} onChange={(e) => setFormHeader({...formHeader, emp_name: e.target.value})} className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-800 outline-none">
                      {empOptions.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 mb-1">🚚 ทะเบียนรถ (ตัวหัว)</label>
                    <input type="text" placeholder="เช่น 86-1926" required value={formHeader.truck_plate_head} onChange={(e) => setFormHeader({...formHeader, truck_plate_head: e.target.value})} className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-800 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 mb-1">🚛 ทะเบียนรถ (ตัวหางพ่วง)</label>
                    <input type="text" placeholder="เช่น 86-7196 (เว้นได้ถ้าไม่มี)" value={formHeader.truck_plate_tail} onChange={(e) => setFormHeader({...formHeader, truck_plate_tail: e.target.value})} className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-xs font-black text-stone-800 outline-none" />
                  </div>
                </div>

                <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                  <h4 className="text-[11px] font-bold text-orange-800 mb-3">⚙️ ตั้งค่าเลขประจำรถและกลุ่ม (ผูกติดกับโรงงานที่ไปส่ง)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {factoryOptions.map(factory => (
                      <div key={factory} className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-stone-200 shadow-sm">
                        <span className="text-xs font-black text-orange-700 border-b border-stone-100 pb-1">🏭 {factory}</span>
                        
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-stone-400 block">● ข้อมูลสัญญา [ตัวหัวรถ]</span>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="เลขประจำรถหัว..." 
                              value={factoryConfigs[`${factory}_head`]?.quota_no || ''} 
                              onChange={(e) => updateFactoryConfig(factory, 'head', 'quota_no', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs font-black text-blue-600 uppercase outline-none focus:border-orange-500" 
                            />
                            <input 
                              type="text" 
                              placeholder="หัวหน้ากลุ่มหัว..." 
                              value={factoryConfigs[`${factory}_head`]?.group_leader || ''} 
                              onChange={(e) => updateFactoryConfig(factory, 'head', 'group_leader', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 outline-none focus:border-orange-500" 
                            />
                          </div>
                        </div>

                        {formHeader.truck_plate_tail.trim() && (
                          <div className="space-y-1 pt-1 border-t border-dashed border-stone-100">
                            <span className="text-[10px] font-bold text-stone-400 block">● ข้อมูลสัญญา [ตัวหางพ่วง]</span>
                            <div className="flex gap-2">
                              <input type="text" placeholder="เลขประจำรถหาง..." value={factoryConfigs[`${factory}_tail`]?.quota_no || ''} onChange={(e) => updateFactoryConfig(factory, 'tail', 'quota_no', e.target.value)} className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs font-black text-purple-600 uppercase outline-none focus:border-orange-500" />
                              <input type="text" placeholder="หัวหน้ากลุ่มหาง..." value={factoryConfigs[`${factory}_tail`]?.group_leader || ''} onChange={(e) => updateFactoryConfig(factory, 'tail', 'group_leader', e.target.value)} className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 outline-none focus:border-orange-500" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-orange-600 font-medium mt-2">* ระบบจะดึงเลขที่ตั้งไว้นี้ ไปใส่ให้ในบิลย่อยด้านล่างอัตโนมัติตามโรงงานที่คุณเลือก</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-2">
                    <h4 className="text-sm font-black text-stone-700">📋 คีย์ตั๋วชั่งอ้อย ({ticketRows.length} เที่ยว)</h4>
                    <button type="button" onClick={addTicketRow} className="px-4 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors">
                      ➕ เพิ่มแถวเที่ยวชั่ง
                    </button>
                  </div>

                  <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200">
                          <th className="py-3 px-3 w-32">วันที่ส่งอ้อย</th>
                          <th className="py-3 px-3 w-40">
                            <div className="flex justify-between items-center">
                              <span>โรงงานปลายทาง</span>
                              <button type="button" onClick={() => openCustomPrompt('factory', 'เพิ่มโรงงานปลายทางใหม่', 'พิมพ์ชื่อโรงงาน...')} className="text-[9px] text-orange-600 bg-white border border-orange-200 px-1.5 rounded">+ ใหม่</button>
                            </div>
                          </th>
                          <th className="py-3 px-3 w-28 text-center">ตัวรถพ่วง</th>
                          <th className="py-3 px-3 w-20 text-center">ประเภท</th>
                          <th className="py-3 px-3 w-40">เลขที่ตั๋วชั่ง</th>
                          <th className="py-3 px-3 text-right w-44">⚖️ น้ำหนักสุทธิ (ตัน)</th>
                          <th className="py-3 px-3 text-center w-12">ลบ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 bg-white">
                        {ticketRows.map((row) => (
                          <tr key={row.id} className="hover:bg-stone-50/50">
                            <td className="p-2">
                              <input 
                                type="date" 
                                required 
                                value={row.date} 
                                onChange={(e) => updateRowValue(row.id, 'date', e.target.value)} 
                                onKeyDown={(e) => { if(e.key === 'Enter') e.preventDefault(); }}
                                className="w-full px-2 py-2 border border-stone-200 rounded-lg font-bold text-stone-700 outline-none focus:border-orange-500" 
                              />
                            </td>
                            <td className="p-2">
                              <select 
                                value={row.factory_name} 
                                onChange={(e) => updateRowValue(row.id, 'factory_name', e.target.value)} 
                                className="w-full px-2 py-2 border border-stone-200 rounded-lg font-bold text-stone-800 outline-none bg-white focus:border-orange-500 shadow-sm"
                              >
                                {factoryOptions.map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                            </td>
                            <td className="p-2">
                              <select 
                                value={row.truck_part} 
                                onChange={(e) => updateRowValue(row.id, 'truck_part', e.target.value as any)} 
                                className={`w-full px-2 py-2 border border-stone-200 rounded-lg font-bold outline-none text-center ${row.truck_part === 'head' ? 'text-blue-700 bg-blue-50' : 'text-purple-700 bg-purple-50'}`}
                              >
                                <option value="head">🚚 ตัวหัว</option>
                                {formHeader.truck_plate_tail.trim() && <option value="tail">🚛 ตัวหาง</option>}
                              </select>
                            </td>
                            <td className="p-2">
                              <select 
                                value={row.cane_type} 
                                onChange={(e) => updateRowValue(row.id, 'cane_type', e.target.value)} 
                                className={`w-full px-1 py-2 border border-stone-200 rounded-lg font-black outline-none ${row.cane_type === 'สด' ? 'text-emerald-600' : 'text-rose-500'}`}
                              >
                                <option value="สด">สด</option>
                                <option value="เผา">เผา</option>
                              </select>
                            </td>
                            <td className="p-2">
                              <input 
                                type="text" 
                                placeholder="ใบชั่ง #..." 
                                value={row.ticket_no} 
                                onChange={(e) => updateRowValue(row.id, 'ticket_no', e.target.value)} 
                                onKeyDown={(e) => { if(e.key === 'Enter') e.preventDefault(); }}
                                className="w-full px-3 py-2 border border-stone-200 rounded-lg font-medium text-stone-700 outline-none focus:border-orange-500" 
                              />
                            </td>
                            <td className="p-2">
                              <div className="relative flex items-center">
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  required 
                                  placeholder="0.00" 
                                  value={recordWeightValue(row.id)} 
                                  onChange={(e) => updateRowWeight(row.id, e.target.value)} 
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault(); 
                                      addTicketRow(); 
                                    }
                                  }}
                                  className="w-full pl-3 pr-10 py-2 border-2 border-orange-200 focus:border-orange-500 bg-orange-50/20 text-right text-sm font-black text-stone-800 rounded-xl outline-none" 
                                />
                                <span className="absolute right-3 font-bold text-stone-400 text-[10px]">ตัน</span>
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              <button type="button" onClick={() => removeTicketRow(row.id)} disabled={ticketRows.length === 1} className="p-1.5 text-stone-300 hover:text-red-500 disabled:opacity-30 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button type="button" onClick={addTicketRow} className="w-full py-2.5 border-2 border-dashed border-stone-200 text-stone-400 hover:text-orange-500 hover:border-orange-300 rounded-xl font-bold transition-all text-xs text-center bg-stone-50/50 hover:bg-orange-50/20">
                      + คลิกเพื่อขยายแถว (หรือกด Enter ที่ช่องน้ำหนักเพื่อเพิ่มแถวเที่ยวอ้อยใบถัดไป)
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={saving} className={`w-full py-4 rounded-xl font-black text-white text-lg shadow-lg transition-all ${saving ? 'bg-stone-300' : 'bg-orange-600 hover:bg-orange-700 active:scale-95 shadow-orange-500/30'}`}>
                  {saving ? 'กำลังประมวลผลข้อมูลบิล...' : `💾 ยืนยันบันทึกข้อมูลรวมทั้งสิ้น ${ticketRows.length} เที่ยวพร้อมกัน`}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* CUSTOM PROMPT WINDOW */}
        {customPrompt.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setCustomPrompt({ ...customPrompt, isOpen: false })}></div>
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative z-10 p-6 animate-in fade-in zoom-in-95">
              <h3 className="text-lg font-black text-stone-800 mb-1">{customPrompt.title}</h3>
              <p className="text-xs text-stone-500 mb-4">ข้อมูลจะถูกบันทึกชั่วคราวให้ในงวดนี้</p>
              <form onSubmit={handleCustomPromptSubmit}>
                <input type="text" autoFocus required placeholder={customPrompt.placeholder} value={customPrompt.inputValue} onChange={(e) => setCustomPrompt({ ...customPrompt, inputValue: e.target.value })} className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold text-stone-800 focus:ring-2 focus:ring-orange-500 outline-none mb-5" />
                <div className="flex gap-3">
                  <button type="button" onClick={() => setCustomPrompt({ ...customPrompt, isOpen: false })} className="flex-1 py-2.5 rounded-xl font-bold text-stone-500 bg-stone-100 text-sm">ยกเลิก</button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl font-bold text-white bg-orange-600 text-sm shadow-md">ตกลง</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Custom Notifications popup */}
        {notify.isOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in" onClick={closeNotify}></div>
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative z-10 p-6 animate-in fade-in zoom-in-95 flex flex-col items-center text-center">
              
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                notify.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                notify.type === 'error' ? 'bg-rose-100 text-rose-600' :
                notify.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                'bg-orange-100 text-orange-600'
              }`}>
                {notify.type === 'success' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
                {notify.type === 'error' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>}
                {notify.type === 'warning' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                {notify.type === 'confirm' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>}
              </div>

              <h3 className="text-xl font-black text-stone-800 mb-2">{notify.title}</h3>
              <p className="text-sm text-stone-500 font-medium mb-6">{notify.message}</p>

              {notify.type === 'confirm' ? (
                <div className="flex gap-3 w-full">
                  <button onClick={closeNotify} className="flex-1 py-3 rounded-xl font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors">ยกเลิก</button>
                  <button 
                    onClick={() => {
                      if (notify.onConfirm) notify.onConfirm();
                      closeNotify();
                    }} 
                    className="flex-1 py-3 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-md"
                  >
                    ยืนยันลบ
                  </button>
                </div>
              ) : (
                <button 
                  onClick={closeNotify} 
                  className={`w-full py-3 rounded-xl font-bold text-white shadow-md transition-colors ${
                    notify.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    notify.type === 'error' ? 'bg-rose-600 hover:bg-rose-700' :
                    'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  ตกลง
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* 🖨️ PERFECT EXCEL PRINT LAYOUT */}
      {/* ========================================== */}
      <div className="hidden print:block w-full bg-white text-black font-sans p-2">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body { background-color: white !important; color: black !important; margin: 0; padding: 0; }
            @page { size: A4 landscape; margin: 8mm; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .excel-table th, .excel-table td { border: 1.5px solid black !important; font-family: 'Segoe UI', Tahoma, sans-serif !important; }
            tr { break-inside: avoid; page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-row-group; }
          }
        `}} />
        
        {/* หัวกระดาษเอกสารไร่อ้อยอย่างเป็นทางการ */}
        <div className="flex items-center justify-between border-b-4 border-black pb-3 mb-5">
          <div className="flex items-center gap-4">
            <img src="/iconapp.jpg" alt="Logo" className="w-20 h-20 object-cover rounded-full border-2 border-black shadow-xs" />
            <div>
              <h1 className="text-2xl font-black text-black tracking-tight mb-0.5">หนุ่มไร่อ้อย จรุงพัฒนานนท์</h1>
              <p className="text-xs font-bold text-gray-700">
                รายงานบัญชีน้ำหนักอ้อยส่งโรงงานหีบอ้อย <span className="font-black underline px-1 text-black">{selectedPeriod}</span> | สรุปข้อมูลดิบชุดประวัติถาวร
              </p>
            </div>
          </div>
          <div className="text-right text-[10px] font-black text-gray-500 leading-tight">
            <div>ไร่อ้อยจรุงพัฒนานนท์ ERP</div>
            <div className="mt-1 font-bold">วันที่ออกเอกสาร: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        {/* 🌟 1 โควตา = 1 กลุ่มข้อมูลหลัก 🌟 */}
        {Object.entries(printGroupedData).map(([empName, truckMap]: any) => {
          
          return (
            <div key={empName} className="mb-6 break-inside-avoid">
              
              {/* คาดหัวชื่อคนขับ/ชื่อโควตาหลักสีฟ้าอ่อนสวยงาม */}
              <div className="w-full text-center font-black text-[13px] bg-[#9CC2E5] border-2 border-black py-1.5 mb-2 tracking-wide text-black print:bg-[#9CC2E5]">
                ชื่อคนขับ / โควตาหลัก: {empName}
              </div>

              {/* 🌟 โลจิกแยกประเภท "ดำ" (รถพ่วง) vs "คนอื่น" (รถเดี่ยว) 🌟 */}
              {empName === 'ดำ' ? (
                // 🚛 รูปแบบรถพ่วง (สำหรับ ดำ) - กางเต็มความกว้าง 2 คอลัมน์คู่กัน
                <div className="grid grid-cols-2 gap-4 items-start w-full">
                  {(() => {
                    const truckPlates = Object.keys(truckMap).sort();
                    const pairs = [];
                    for (let i = 0; i < truckPlates.length; i += 2) {
                      pairs.push([truckPlates[i], truckPlates[i+1] || null]);
                    }

                    return pairs.map(([plate1, plate2], pairIdx) => {
                      const deliv1 = (plate1 !== null && plate1 !== undefined) ? [...truckMap[plate1]].sort((a, b) => a.date.localeCompare(b.date)) : [];
                      const deliv2 = plate2 ? [...truckMap[plate2]].sort((a, b) => a.date.localeCompare(b.date)) : [];

                      const maxLen = Math.max(deliv1.length, deliv2.length);

                      // นับเที่ยวแยกหัว หาง อย่างอิสระ
                      const freshTripsCount = 
                        deliv1.filter((d: any) => d.factory_name.includes('ระยอง') && d.cane_type === 'สด').length +
                        deliv2.filter((d: any) => d.factory_name.includes('ระยอง') && d.cane_type === 'สด').length;

                      const burntTripsCount = 
                        deliv1.filter((d: any) => d.factory_name.includes('ระยอง') && d.cane_type === 'เผา').length +
                        deliv2.filter((d: any) => d.factory_name.includes('ระยอง') && d.cane_type === 'เผา').length;

                      const chonburiTripsCount = 
                        deliv1.filter((d: any) => d.factory_name.includes('ชลบุรี')).length +
                        deliv2.filter((d: any) => d.factory_name.includes('ชลบุรี')).length;

                      const freshWeightTotal = 
                        deliv1.filter((d: any) => d.factory_name.includes('ระยอง') && d.cane_type === 'สด').reduce((s: number, d: any) => s + Number(d.net_weight), 0) +
                        deliv2.filter((d: any) => d.factory_name.includes('ระยอง') && d.cane_type === 'สด').reduce((s: number, d: any) => s + Number(d.net_weight), 0);

                      const burntWeightTotal = 
                        deliv1.filter((d: any) => d.factory_name.includes('ระยอง') && d.cane_type === 'เผา').reduce((s: number, d: any) => s + Number(d.net_weight), 0) +
                        deliv2.filter((d: any) => d.factory_name.includes('ระยอง') && d.cane_type === 'เผา').reduce((s: number, d: any) => s + Number(d.net_weight), 0);

                      const chonburiWeightTotal = 
                        deliv1.filter((d: any) => d.factory_name.includes('ชลบุรี')).reduce((s: number, d: any) => s + Number(d.net_weight), 0) +
                        deliv2.filter((d: any) => d.factory_name.includes('ชลบุรี')).reduce((s: number, d: any) => s + Number(d.net_weight), 0);

                      const quotaRayong1 = deliv1.find((d: any) => d.factory_name.includes('ระยอง'))?.quota_no || deliv1[0]?.quota_no || '-';
                      const quotaRayong2 = deliv2.find((d: any) => d.factory_name.includes('ระยอง'))?.quota_no || deliv2[0]?.quota_no || '-';
                      const displayQuota = [quotaRayong1, quotaRayong2].filter(q => q && q !== '-').join('-');

                      const groupChonburi1 = deliv1.find((d: any) => d.factory_name.includes('ชลบุรี'))?.group_leader || deliv1[0]?.group_leader || '-';
                      const groupChonburi2 = deliv2.find((d: any) => d.factory_name.includes('ชลบุรี'))?.group_leader || deliv2[0]?.group_leader || '-';
                      
                      const groupRayong1 = deliv1.find((d: any) => d.factory_name.includes('ระยอง'))?.group_leader || deliv1[0]?.group_leader || '-';
                      const groupRayong2 = deliv2.find((d: any) => d.factory_name.includes('ระยอง'))?.group_leader || deliv2[0]?.group_leader || '-';

                      return (
                        <div className="w-full break-inside-avoid" key={`pair-${pairIdx}`}>
                          <table className="excel-table w-full text-center border-collapse border-2 border-black text-[9.5px] bg-white">
                            <thead className="bg-gray-100">
                              <tr>
                                <th rowSpan={4} className="bg-gray-100 border border-black w-[10%] align-middle text-[11px] font-black text-center whitespace-nowrap px-1">วันที่</th>
                                <th colSpan={4} className="border border-black py-1 bg-[#BDD7EE] text-[10.5px] font-black">ทะเบียน {plate1}</th>
                                <th colSpan={4} className="border border-black py-1 bg-[#BDD7EE] text-[10.5px] font-black">ทะเบียน {plate2 || '-'}</th>
                              </tr>
                              <tr className="bg-white font-bold text-black text-[9.5px]">
                                <th colSpan={3} className="border border-black py-0.5 bg-[#FFF2CC]">น้ำตาลระยอง</th>
                                <th colSpan={1} className="border border-black py-0.5 bg-[#E2EFDA]">สหการชลบุรี</th>
                                <th colSpan={3} className="border border-black py-0.5 bg-[#FFF2CC]">น้ำตาลระยอง</th>
                                <th colSpan={1} className="border border-black py-0.5 bg-[#E2EFDA]">สหการชลบุรี</th>
                              </tr>
                              <tr className="bg-white font-bold text-black text-[9.5px] leading-tight">
                                <th colSpan={2} className="border border-black py-0.5">{quotaRayong1}</th>
                                <th colSpan={1} className="border border-black py-0.5 bg-gray-50 font-medium">หัวหน้ากลุ่มที่</th>
                                <th colSpan={1} className="border border-black py-0.5 bg-[#E2EFDA]">{groupChonburi1}</th>
                                <th colSpan={2} className="border border-black py-0.5">{quotaRayong2}</th>
                                <th colSpan={1} className="border border-black py-0.5 bg-gray-50 font-medium">หัวหน้ากลุ่มที่</th>
                                <th colSpan={1} className="border border-black py-0.5 bg-[#E2EFDA]">{groupChonburi2}</th>
                              </tr>
                              <tr className="bg-gray-100 text-stone-800 font-bold text-[9.5px]">
                                <th className="border border-black py-0.5 text-emerald-800 w-[9%]">สด</th>
                                <th className="border border-black py-0.5 text-rose-700 w-[9%]">เผา</th>
                                <th className="border border-black py-0.5 w-[15%] font-black text-black">{groupRayong1}</th>
                                <th className="border border-black py-0.5 text-blue-800 w-[11%]">น้ำหนัก</th>
                                <th className="border border-black py-0.5 text-emerald-800 w-[9%]">สด</th>
                                <th className="border border-black py-0.5 text-rose-700 w-[9%]">เผา</th>
                                <th className="border border-black py-0.5 w-[15%] font-black text-black">{groupRayong2}</th>
                                <th className="border border-black py-0.5 text-blue-800 w-[11%]">น้ำหนัก</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black bg-white">
                              {Array.from({ length: Math.max(maxLen, 4) }).map((_, idx) => {
                                const d1 = deliv1[idx];
                                const d2 = deliv2[idx];
                                const rowDate = d1?.date || d2?.date;

                                const isRayong1 = d1?.factory_name.includes('ระยอง');
                                const isChonburi1 = d1?.factory_name.includes('ชลบุรี');
                                const isRayong2 = d2?.factory_name.includes('ระยอง');
                                const isChonburi2 = d2?.factory_name.includes('ชลบุรี');

                                return (
                                  <tr key={idx} className="h-[22px]">
                                    <td className="border border-black p-0.5 font-bold whitespace-nowrap">{rowDate ? formatDateShort(rowDate) : ''}</td>
                                    <td className="border border-black p-0.5 text-emerald-700 font-black text-right pr-1">
                                      {isRayong1 && d1?.cane_type === 'สด' ? Number(d1.net_weight).toFixed(2) : ''}
                                    </td>
                                    <td className="border border-black p-0.5 text-rose-700 font-black text-right pr-1">
                                      {isRayong1 && d1?.cane_type === 'เผา' ? Number(d1.net_weight).toFixed(2) : ''}
                                    </td>
                                    <td className="border border-black text-stone-600 text-[10px] font-bold">
                                      {isRayong1 ? d1?.group_leader : ''}
                                    </td>
                                    <td className="border border-black font-black text-blue-700 text-right pr-1 bg-[#F9FBF6]">
                                      {isChonburi1 ? Number(d1.net_weight).toFixed(2) : ''}
                                    </td>
                                    <td className="border border-black p-0.5 text-emerald-700 font-black text-right pr-1">
                                      {isRayong2 && d2?.cane_type === 'สด' ? Number(d2.net_weight).toFixed(2) : ''}
                                    </td>
                                    <td className="border border-black p-0.5 text-rose-700 font-black text-right pr-1">
                                      {isRayong2 && d2?.cane_type === 'เผา' ? Number(d2.net_weight).toFixed(2) : ''}
                                    </td>
                                    <td className="border border-black text-stone-600 text-[10px] font-bold">
                                      {isRayong2 ? d2?.group_leader : ''}
                                    </td>
                                    <td className="border border-black font-black text-blue-700 text-right pr-1 bg-[#F9FBF6]">
                                      {isChonburi2 ? Number(d2.net_weight).toFixed(2) : ''}
                                    </td>
                                  </tr>
                                );
                              })}
                              {/* เติมแถวว่างจำลองให้ตารางสมดุล */}
                              {maxLen < 4 && Array.from({length: 4 - maxLen}).map((_, i) => (
                                <tr key={`empty-${i}`} className="h-[22px]">
                                  <td className="border border-black p-0.5"></td>
                                  <td className="border border-black p-0.5"></td><td className="border border-black p-0.5"></td><td className="border border-black p-0.5"></td><td className="border border-black p-0.5 bg-[#F9FBF6]"></td>
                                  <td className="border border-black p-0.5"></td><td className="border border-black p-0.5"></td><td className="border border-black p-0.5"></td><td className="border border-black p-0.5 bg-[#F9FBF6]"></td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="font-bold bg-white text-[11px]">
                              <tr className="border-t-2 border-black">
                                <td colSpan={8} className="border border-black p-1.5 text-left pl-2 bg-gray-50">รวมอ้อยสด {displayQuota} = {freshTripsCount} เที่ยว</td>
                                <td className="border border-black p-1.5 text-right pr-2 font-black">{freshWeightTotal > 0 ? freshWeightTotal.toFixed(2) : '0'}</td>
                              </tr>
                              <tr className="border-t border-black text-black">
                                <td colSpan={8} className="border border-black p-1.5 text-left pl-2 bg-gray-50">รวมอ้อยเผา {displayQuota} = {burntTripsCount} เที่ยว</td>
                                <td className="border border-black p-1.5 text-right pr-2 font-black">{burntWeightTotal > 0 ? burntWeightTotal.toFixed(2) : '0'}</td>
                              </tr>
                              <tr className="border-t border-black text-black">
                                <td colSpan={8} className="border border-black p-1.5 text-left pl-2 bg-gray-50">รวม273(สหการ) = {chonburiTripsCount} เที่ยว</td>
                                <td className="border border-black p-1.5 text-right pr-2 font-black">{chonburiWeightTotal > 0 ? chonburiWeightTotal.toFixed(2) : '0'}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                // 🚚 รูปแบบรถเดี่ยวปกติ (สำหรับ รักษ์, อู๊ด, ฯลฯ) - วางเรียงอิสระ 3 คอลัมน์
                <div className="grid grid-cols-3 gap-4 items-start">
                  {Object.keys(truckMap).sort().map((truckPlate) => {
                    // จัดเรียงวันที่น้อยไปมาก
                    const deliv1 = truckMap[truckPlate] ? [...truckMap[truckPlate]].sort((a, b) => a.date.localeCompare(b.date)) : [];
                    
                    const rayongRecord1 = deliv1.find((d: any) => d.factory_name.includes('ระยอง'));
                    const chonburiRecord1 = deliv1.find((d: any) => d.factory_name.includes('ชลบุรี'));
                    const quotaRayong1 = rayongRecord1?.quota_no || deliv1[0]?.quota_no || '-';
                    const groupRayong1 = rayongRecord1?.group_leader || deliv1[0]?.group_leader || '-';
                    const groupChonburi1 = chonburiRecord1?.group_leader || deliv1[0]?.group_leader || '-';
                    
                    const rayongFreshWeight1 = deliv1.filter((d: any) => d.factory_name.includes('ระยอง') && d.cane_type === 'สด').reduce((s: number, d: any) => s + Number(d.net_weight), 0);
                    const rayongBurntWeight1 = deliv1.filter((d: any) => d.factory_name.includes('ระยอง') && d.cane_type === 'เผา').reduce((s: number, d: any) => s + Number(d.net_weight), 0);
                    const chonburiWeight1 = deliv1.filter((d: any) => d.factory_name.includes('ชลบุรี')).reduce((s: number, d: any) => s + Number(d.net_weight), 0);

                    const totalFreshTrips = deliv1.filter((d: any) => d.factory_name.includes('ระยอง') && d.cane_type === 'สด').length;
                    const totalBurntTrips = deliv1.filter((d: any) => d.factory_name.includes('ระยอง') && d.cane_type === 'เผา').length;
                    const totalChonburiTrips = deliv1.filter((d: any) => d.factory_name.includes('ชลบุรี')).length;

                    return (
                      <table key={truckPlate} className="excel-table w-full text-[11px] text-center border-collapse border-2 border-black bg-white break-inside-avoid">
                        <thead>
                          <tr className="bg-[#BDD7EE] font-black text-black text-[12px]">
                            <th colSpan={5} className="py-1 border border-black text-center">ทะเบียนรถ {truckPlate}</th>
                          </tr>
                          <tr className="bg-white font-bold text-black text-[11px]">
                            <th className="border border-black py-0.5 w-[20%] whitespace-nowrap" rowSpan={3}>วันที่</th>
                            <th colSpan={3} className="border border-black py-0.5 bg-[#FFF2CC]">น้ำตาลระยอง</th>
                            <th colSpan={1} className="border border-black py-0.5 bg-[#E2EFDA]">สหการชลบุรี</th>
                          </tr>
                          <tr className="bg-white font-bold text-black text-[10px] leading-tight">
                            <th colSpan={2} className="border border-black py-0.5">{quotaRayong1}</th>
                            <th colSpan={1} className="border border-black py-0.5 bg-gray-50 font-medium">หัวหน้ากลุ่มที่</th>
                            <th colSpan={1} className="border border-black py-0.5 bg-[#E2EFDA]">{groupChonburi1}</th>
                          </tr>
                          <tr className="bg-gray-100 text-stone-800 font-bold text-[10px]">
                            <th className="border border-black py-0.5 text-emerald-800 w-[18%]">สด</th>
                            <th className="border border-black py-0.5 text-rose-800 w-[18%]">เผา</th>
                            <th className="border border-black py-0.5 w-[24%] font-black text-black">{groupRayong1}</th>
                            <th className="border border-black py-0.5 text-blue-800 w-[20%]">น้ำหนัก</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black">
                          {deliv1.map((d: any, idx: number) => {
                            const isRayong = d.factory_name.includes('ระยอง');
                            const isChonburi = d.factory_name.includes('ชลบุรี');

                            return (
                              <tr key={idx} className="bg-white text-black font-medium h-[24px]">
                                <td className="border border-black font-bold whitespace-nowrap">{formatDateShort(d.date)}</td>
                                <td className="border border-black font-black text-emerald-700 text-right pr-1">
                                  {isRayong && d.cane_type === 'สด' ? d.net_weight.toFixed(2) : ''}
                                </td>
                                <td className="border border-black font-black text-rose-600 text-right pr-1">
                                  {isRayong && d.cane_type === 'เผา' ? d.net_weight.toFixed(2) : ''}
                                </td>
                                <td className="border border-black text-stone-600 text-[10px] font-bold">
                                  {isRayong ? d.group_leader : ''}
                                </td>
                                <td className="border border-black font-black text-blue-700 text-right pr-1 bg-[#F9FBF6]">
                                  {isChonburi ? d.net_weight.toFixed(2) : ''}
                                </td>
                              </tr>
                            );
                          })}
                          {/* ป้องกันตารางแหว่ง: เติมแถวเปล่าเสริมเลย์เอาต์ */}
                          {deliv1.length < 4 && Array.from({ length: 4 - deliv1.length }).map((_, i) => (
                            <tr key={`blank-${i}`} className="h-[24px]">
                              <td className="border border-black"></td>
                              <td className="border border-black"></td>
                              <td className="border border-black"></td>
                              <td className="border border-black"></td>
                              <td className="border border-black bg-[#F9FBF6]"></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="font-bold bg-white text-[10.5px]">
                          <tr className="border-t-2 border-black">
                            <td className="border border-black py-1 text-center bg-gray-50 font-bold">รวมเที่ยว</td>
                            <td className="border border-black py-1 text-emerald-800 text-center font-bold">{totalFreshTrips > 0 ? `${totalFreshTrips} เที่ยว` : '0 เที่ยว'}</td>
                            <td className="border border-black py-1 text-rose-800 text-center font-bold">{totalBurntTrips > 0 ? `${totalBurntTrips} เที่ยว` : '0 เที่ยว'}</td>
                            <td className="border border-black py-1 bg-gray-50"></td>
                            <td className="border border-black py-1 text-blue-800 bg-[#E2EFDA] text-center font-bold">{totalChonburiTrips > 0 ? `${totalChonburiTrips} เที่ยว` : '0 เที่ยว'}</td>
                          </tr>
                          <tr className="bg-gray-200 border-t border-black text-black">
                            <td className="border border-black py-1 text-[10px] font-black bg-gray-100">น้ำหนักสุทธิรวม</td>
                            <td className="border border-black py-1 text-right pr-1 text-emerald-700 bg-white">{rayongFreshWeight1 > 0 ? rayongFreshWeight1.toFixed(2) : '0.00'}</td>
                            <td className="border border-black py-1 text-right pr-1 text-rose-600 bg-white">{rayongBurntWeight1 > 0 ? rayongBurntWeight1.toFixed(2) : '0.00'}</td>
                            <td className="border border-black py-1 bg-gray-100"></td>
                            <td className="border border-black py-1 text-right pr-1 text-blue-700 bg-[#E2EFDA]">{chonburiWeight1 > 0 ? chonburiWeight1.toFixed(2) : '0.00'}</td>
                          </tr>
                        </tfoot>
                      </table>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* 📊 บล็อกสรุปผลรวมน้ำหนักสุทธิทั้งหมด 📊 */}
        <div className="mt-6 flex justify-between items-start break-inside-avoid pr-8">
          <div className="w-[450px]">
            <table className="excel-table w-full text-[12px] font-bold text-black border-2 border-black border-collapse text-left">
              <tbody>
                <tr>
                  <td className="px-3 py-1.5 bg-[#FFF2CC] border border-black w-2/3">รวมน้ำหนักสุทธิอ้อยสดน้ำตาลระยอง</td>
                  <td className="text-right pr-3 font-black text-sm border border-black bg-white">
                    {deliveries.filter(d => d.factory_name.includes('ระยอง') && d.cane_type === 'สด').reduce((s, d) => s + Number(d.net_weight), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 bg-[#E2EFDA] border border-black">รวมน้ำหนักสุทธิอ้อยสดสหการชลบุรี</td>
                  <td className="text-right pr-3 font-black text-sm border border-black bg-white">
                    {deliveries.filter(d => d.factory_name.includes('ชลบุรี')).reduce((s, d) => s + Number(d.net_weight), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5 border border-black bg-white">รวมน้ำหนักสุทธิอ้อยเผาน้ำตาลระยอง</td>
                  <td className="text-right pr-3 font-black text-sm border border-black bg-white">
                    {deliveries.filter(d => d.factory_name.includes('ระยอง') && d.cane_type === 'เผา').reduce((s, d) => s + Number(d.net_weight), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </td>
                </tr>
                <tr className="bg-white">
                  <td className="px-3 py-2 border border-black text-black font-black text-[13px]">รวมทั้งหมด (อ้อยส่งเข้าหีบสุทธิประจำงวด)</td>
                  <td className="text-right pr-3 text-base font-black border border-black text-[#C00000]">
                    {grandTotalWeight.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className="text-[10px] text-black font-bold">ตัน</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );

  function recordWeightValue(id: string) {
    const matchedRow = ticketRows.find(row => row.id === id);
    return matchedRow ? matchedRow.net_weight : '';
  }

  function updateRowWeight(id: string, value: string) {
    updateRowValue(id, 'net_weight', value);
  }
}