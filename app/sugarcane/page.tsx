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
  truck_part?: 'head' | 'tail';
  factory_name: string;
  cane_type: string;
  net_weight: number;
  ticket_no: string;
  group_leader: string; 
  quota_no: string;      
}

// 🌟 [อัปเกรด 1] เพิ่ม group_leader และ quota_no ในโครงสร้างตั๋วย่อย เพื่อรองรับหลายหัวหน้ากลุ่มในคันเดียว
interface TicketRow {
  id: string;
  date: string;
  factory_name: string; 
  cane_type: string;
  net_weight: string;
  ticket_no: string;
  truck_part: 'head' | 'tail';
  group_leader?: string; // อนุญาตให้ระบุหัวหน้ากลุ่มแยกรายเที่ยวได้
  quota_no?: string;
}

export default function SugarcaneBillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deliveries, setDeliveries] = useState<CaneDelivery[]>([]);
  
  const [factoryOptions, setFactoryOptions] = useState<string[]>(['น้ำตาลระยอง', 'สหการชลบุรี']);
  const [empOptions, setEmpOptions] = useState<string[]>(['รักษ์', 'อู๊ด', 'ดำ']);

  const [selectedYear, setSelectedYear] = useState('2569');
  const [selectedPeriod, setSelectedDatePeriod] = useState('งวดที่ 1');
  const [selectedFactory, setSelectedFactory] = useState('ทั้งหมด');

  const [basePrice, setBasePrice] = useState<number>(1000); 
  const [burntPenalty, setBurntPenalty] = useState<number>(30); 

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

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
    { id: '1', date: new Date().toISOString().split('T')[0], factory_name: 'น้ำตาลระยอง', cane_type: 'สด', net_weight: '', ticket_no: '', truck_part: 'head', group_leader: '' }
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

  const [editModal, setEditModal] = useState<{ isOpen: boolean; data: CaneDelivery | null }>({ isOpen: false, data: null });
  const [updating, setUpdating] = useState(false);

  const [printDateTime, setPrintDateTime] = useState('');

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
    setPrintDateTime(new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
  }, []);

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
      
      if (selectedYear !== 'ทั้งหมด') {
        const gregorianYear = (Number(selectedYear) - 543).toString();
        query = query.gte('date', `${gregorianYear}-01-01`).lte('date', `${gregorianYear}-12-31`);
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
  }, [selectedPeriod, selectedFactory, selectedYear]); 

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPeriod, selectedFactory, selectedYear, searchQuery, deliveries.length]);

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
        truck_part: lastRow ? lastRow.truck_part : 'head',
        group_leader: '' // ให้เริ่มต้นว่างไว้ เพื่อให้ใช้ระบบ Smart Default ดึงจากค่าด้านบน
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

  // 🌟 [อัปเกรด 2] ปรับปรุงระบบบันทึก ให้รองรับหัวหน้ากลุ่มที่ต่างกันในแต่ละแถวได้พร้อมกัน!
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

      // 🌟 คำนวณรายเที่ยว: ถ้าแถวไหนมีการพิมพ์เลขกลุ่มเฉพาะแถว ให้ใช้เลขนั้น ถ้าไม่พิมพ์ ให้ดึงจาก config ด้านบน
      const insertData = ticketRows.map(row => {
        const isHead = row.truck_part === 'head';
        const currentPlate = isHead ? formHeader.truck_plate_head.trim() : formHeader.truck_plate_tail.trim();
        const configKey = `${row.factory_name}_${row.truck_part}`;

        const defaultGroupLeader = (factoryConfigs[configKey]?.group_leader || '').trim();
        const effectiveGroupLeader = (row.group_leader !== undefined && row.group_leader.trim() !== '') 
          ? row.group_leader.trim() 
          : defaultGroupLeader;

        const defaultQuotaNo = (factoryConfigs[configKey]?.quota_no || '').trim().toUpperCase();
        const effectiveQuotaNo = (row.quota_no !== undefined && row.quota_no.trim() !== '')
          ? row.quota_no.trim().toUpperCase()
          : defaultQuotaNo;

        return {
          date: row.date,
          period_no: formHeader.period_no,
          emp_name: formHeader.emp_name,
          truck_plate: currentPlate,
          truck_part: row.truck_part,
          factory_name: row.factory_name, 
          cane_type: row.cane_type,
          net_weight: Number(row.net_weight),
          ticket_no: row.ticket_no.trim(),
          quota_no: effectiveQuotaNo,
          group_leader: effectiveGroupLeader
        };
      });

      const { error } = await supabase.from('sugarcane_deliveries').insert(insertData);
      if (error) throw error;
      
      setShowModal(false);
      setTicketRows([{ id: '1', date: new Date().toISOString().split('T')[0], factory_name: factoryOptions[0] || 'น้ำตาลระยอง', cane_type: 'สด', net_weight: '', ticket_no: '', truck_part: 'head', group_leader: '' }]);
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

  const handleUpdateSingleDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.data) return;

    setUpdating(true);
    try {
      const { id, ...updatePayload } = editModal.data;
      
      const { data: configData } = await supabase
        .from('truck_quota_configs')
        .select('quota_no, group_leader')
        .eq('emp_name', updatePayload.emp_name)
        .eq('truck_plate', updatePayload.truck_plate)
        .eq('factory_name', updatePayload.factory_name)
        .single();

      const finalPayload = {
        ...updatePayload,
        quota_no: configData?.quota_no || updatePayload.quota_no,
        group_leader: configData?.group_leader || updatePayload.group_leader,
      };

      const { error } = await supabase.from('sugarcane_deliveries').update(finalPayload).eq('id', id);
      if (error) throw error;

      setEditModal({ isOpen: false, data: null });
      fetchDeliveries();
      showAlert('success', 'แก้ไขข้อมูลสำเร็จ', 'อัปเดตข้อมูลตั๋วชั่งใบนี้เรียบร้อยแล้วครับ');
    } catch (error: any) {
      showAlert('error', 'แก้ไขไม่สำเร็จ', error.message);
    } finally {
      setUpdating(false);
    }
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
    setCustomPrompt({ isOpen: true, title, placeholder, type, inputValue: '' });
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

  // 🌟 Component Pagination 
  const renderPagination = () => {
    if (loading || filteredDeliveries.length === 0) return null;
    return (
      <div className="p-4 bg-white border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between text-xs font-bold text-stone-500 gap-4 rounded-b-2xl">
        <span>
          แสดงรายการที่ {indexOfFirstRow + 1} ถึง {Math.min(indexOfLastRow, filteredDeliveries.length)} จากทั้งหมด {filteredDeliveries.length}
        </span>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 disabled:opacity-40 transition-colors shadow-sm"
          >
            ก่อนหน้า
          </button>
          <span className="px-3 py-1.5 bg-stone-100 border border-stone-300 rounded-lg text-stone-800 font-bold shadow-sm">
            {currentPage} / {totalPages}
          </span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 disabled:opacity-40 transition-colors shadow-sm"
          >
            ถัดไป
          </button>
        </div>
      </div>
    );
  };

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

  const employeeSummaryList = Object.values(summaryPerEmployee).sort((a:any, b:any) => b.totalMoney - a.totalMoney);
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

  const groupLeaderSummaryMap = deliveries.reduce((acc: Record<string, { fresh: number, burnt: number, total: number }>, cur) => {
    const leader = cur.group_leader && cur.group_leader.trim() !== '' ? cur.group_leader.trim() : 'ไม่ได้ระบุกลุ่ม';
    if (!acc[leader]) {
      acc[leader] = { fresh: 0, burnt: 0, total: 0 };
    }
    const w = Number(cur.net_weight || 0);
    if (cur.cane_type === 'สด') acc[leader].fresh += w;
    else if (cur.cane_type === 'เผา') acc[leader].burnt += w;
    acc[leader].total += w;
    return acc;
  }, {});

  const groupLeaderSummaryList = Object.entries(groupLeaderSummaryMap).sort((a: any, b: any) => b[1].total - a[1].total);

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
      'สถานะรถ': record.truck_part === 'tail' ? 'หางพ่วง' : 'ตัวหัว/รถเดี่ยว',
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
    XLSX.writeFile(workbook, `รายละเอียดบิลอ้อย_${selectedPeriod}_ปี${selectedYear !== 'ทั้งหมด' ? selectedYear : 'ทั้งหมด'}.xlsx`);
  };

  const printGroupedData = deliveries.reduce((acc: any, curr) => {
    if (!acc[curr.emp_name]) acc[curr.emp_name] = {};
    if (!acc[curr.emp_name][curr.truck_plate]) acc[curr.emp_name][curr.truck_plate] = [];
    acc[curr.emp_name][curr.truck_plate].push(curr);
    return acc;
  }, {});

  return (
    <>
      {/* ========================================== */}
      {/* 💻 หน้าจอแอปพลิเคชันหลัก (UI อัปเกรด High Contrast) */}
      {/* ========================================== */}
      <div className="min-h-screen bg-[#F1F5F9] pb-16 font-sans print:hidden">
        
        {/* 🌟 ส่วนที่อัปเกรด (Header ปรับให้สวยหรูทันสมัยแบบแอปองค์กร) */}
        <div className="bg-white/90 backdrop-blur-md border-b border-stone-200 sticky top-0 z-30 shadow-sm">
          <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button onClick={() => router.push('/')} className="group w-10 h-10 bg-white border border-stone-200 hover:border-orange-400 hover:bg-orange-50 rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm">
                <svg className="w-5 h-5 text-stone-400 group-hover:text-orange-600 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </button>
              <div className="h-8 w-px bg-stone-200 hidden sm:block mx-1"></div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
                <div className="flex flex-col justify-center">
                  <h1 className="text-xl font-black text-stone-900 tracking-tight leading-none mb-1">ระบบคิดเงินอ้อยเข้าโรงงาน</h1>
                  <p className="text-[11px] font-bold text-stone-500 leading-none hidden sm:block">บันทึก คำนวณยอดเงิน และจัดการข้อมูลตั๋วชั่งอย่างเป็นระบบ</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={exportToExcel} 
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-emerald-200 text-emerald-700 font-bold rounded-lg hover:bg-emerald-50 transition-colors shadow-sm text-xs sm:text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4V4" /></svg>
                <span>ส่งออก Excel</span>
              </button>
              <button 
                onClick={() => window.print()} 
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-blue-200 text-blue-700 font-bold rounded-lg hover:bg-blue-50 transition-colors shadow-sm text-xs sm:text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                <span>พิมพ์รายงาน</span>
              </button>
              <button onClick={() => setShowModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-all shadow-md text-xs sm:text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                <span>บันทึกตั๋วชุดรายคัน</span>
              </button>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 mt-6 sm:mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* ⬅️ Sidebar Left: ตัวกรองและตั้งราคา */}
            <div className="lg:col-span-3 space-y-6">
              
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
                <h3 className="font-black text-stone-900 border-b border-stone-200 pb-3 flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-md bg-orange-50 text-orange-600 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                  </div>
                  เงื่อนไขดึงข้อมูล & ตั้งราคา
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">ปีฤดูหีบ</label>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg font-bold text-stone-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all text-xs">
                      <option value="ทั้งหมด">ทั้งหมด</option>
                      <option value="2567">2567</option>
                      <option value="2568">2568</option>
                      <option value="2569">2569</option>
                      <option value="2570">2570</option>
                      <option value="2571">2571</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">เลือกงวดการตัด</label>
                    <select value={selectedPeriod} onChange={(e) => setSelectedDatePeriod(e.target.value)} className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg font-bold text-stone-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all text-xs">
                      {['งวดที่ 1', 'งวดที่ 2', 'งวดที่ 3', 'งวดที่ 4', 'งวดที่ 5'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">โรงงานปลายทาง</label>
                    <select value={selectedFactory} onChange={(e) => setSelectedFactory(e.target.value)} className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg font-bold text-stone-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all text-xs">
                      <option value="ทั้งหมด">ทั้งหมด</option>
                      {factoryOptions.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>

                <div className="border-t border-stone-200 pt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-700 mb-1">ราคาอ้อยสด (บาท)</label>
                    <input type="number" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value) || 0)} className="w-full px-2 py-2 border border-emerald-200 bg-emerald-50/50 text-emerald-800 font-black rounded-lg text-xs focus:border-emerald-500 outline-none text-right" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-rose-700 mb-1">หักอ้อยเผา (บาท)</label>
                    <input type="number" value={burntPenalty} onChange={(e) => setBurntPenalty(Number(e.target.value) || 0)} className="w-full px-2 py-2 border border-rose-200 bg-rose-50/50 text-rose-800 font-black rounded-lg text-xs focus:border-rose-500 outline-none text-right" />
                  </div>
                </div>
              </div>

              {/* Card Hero: ยอดเงินรวม */}
              <div className="bg-[#1C1917] text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-orange-500/20 rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-bold text-orange-400">ยอดรวมเงินค่าอ้อยสุทธิ</p>
                    <span className="text-[9px] font-bold bg-stone-800 border border-stone-700 px-2 py-0.5 rounded text-stone-300">{selectedPeriod}</span>
                  </div>
                  <h2 className="text-3xl font-black tracking-tight mb-6">
                    <span className="text-orange-500 mr-1 text-2xl">฿</span>
                    {grandTotalMoney.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h2>
                  <div className="flex justify-between items-center pt-4 border-t border-stone-700 text-xs">
                    <span className="text-stone-400 font-medium">น้ำหนักส่งเข้าหีบแล้ว:</span>
                    <span className="font-black text-white">{grandTotalWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[9px] text-stone-400 font-normal">ตัน</span></span>
                  </div>
                </div>
              </div>

              {/* Card: สรุปน้ำหนักแยกหัวหน้ากลุ่ม (ดีไซน์ใหม่ ให้อ่านง่ายเหมือนตารางขวา) */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-stone-200 bg-stone-50">
                  <h4 className="font-black text-stone-900 text-sm flex items-center gap-2">
                    👑 สรุปน้ำหนักแยกหัวหน้ากลุ่ม
                  </h4>
                </div>
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-stone-50/50 sticky top-0 z-10">
                      <tr className="border-b border-stone-200 text-stone-500 font-bold">
                        <th className="py-2 px-3">กลุ่ม</th>
                        <th className="py-2 px-2 text-right">สด</th>
                        <th className="py-2 px-2 text-right">เผา</th>
                        <th className="py-2 px-3 text-right">รวม(ตัน)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {groupLeaderSummaryList.length > 0 ? groupLeaderSummaryList.map(([leaderName, values]: any) => (
                        <tr key={leaderName} className="hover:bg-stone-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-stone-800">{leaderName}</td>
                          <td className="py-2.5 px-2 text-right font-semibold text-emerald-600">{Number(values.fresh).toFixed(2)}</td>
                          <td className="py-2.5 px-2 text-right font-semibold text-rose-600">{Number(values.burnt).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-black text-stone-900">{Number(values.total).toFixed(2)}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} className="text-center text-stone-400 font-bold py-6 text-xs bg-stone-50/50">ยังไม่มีข้อมูลกลุ่ม</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
            </div>

            {/* ➡️ Main Content Right: Tables */}
            <div className="lg:col-span-9 space-y-6">
              
              {/* ตารางที่ 1: สรุปยอดรวมแยกตามโควตา/รถ */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-stone-200 bg-stone-50 flex items-center gap-3">
                  <div className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m32 0v-2a4 4 0 00-4-4h-1a4 4 0 00-4 4v2m-24-4a4 4 0 11-8 0 4 4 0 018 0zm24 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <h2 className="text-sm font-black text-stone-900">สรุปยอดรวมแยกคนรถ/โควตา</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-white text-[11px] font-bold text-stone-500 border-b border-stone-200">
                        <th className="py-3 px-5">ชื่อคนรถ / โควตาหลัก</th>
                        <th className="py-3 px-4 text-center">เที่ยว</th>
                        <th className="py-3 px-4 text-right">อ้อยสด (ตัน)</th>
                        <th className="py-3 px-4 text-right">อ้อยเผา (ตัน)</th>
                        <th className="py-3 px-5 text-right text-orange-600">ยอดเงินสุทธิ</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-stone-100 bg-white">
                      {employeeSummaryList.length > 0 ? employeeSummaryList.map((emp: any) => (
                        <tr key={emp.name} className="hover:bg-stone-50 transition-colors">
                          <td className="py-3 px-5 font-black text-stone-900">{emp.name}</td>
                          <td className="py-3 px-4 text-center font-bold text-stone-500">{emp.trips}</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">{Number(emp.freshWeight || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="py-3 px-4 text-right font-bold text-rose-500">{Number(emp.burntWeight || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                          <td className="py-3 px-5 text-right font-black text-orange-600 text-[13px]">฿ {emp.totalMoney.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} className="py-12 text-center text-stone-500 font-bold text-sm bg-stone-50/50">ยังไม่มีข้อมูลสรุปยอดในงวดนี้</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ตารางที่ 2: ประวัติบิลตั๋วชั่งฉบับละเอียด */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-rose-100 text-rose-600 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    </div>
                    <h2 className="text-sm font-black text-stone-900">ประวัติบิลตั๋วชั่งฉบับละเอียด</h2>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                      <input 
                        type="text" 
                        placeholder="ค้นหา (ทะเบียน, ชื่อ, โรงงาน...)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 border border-stone-300 rounded-lg text-xs font-bold text-stone-800 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all bg-white"
                      />
                      <svg className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-stone-600 whitespace-nowrap">
                      <span>แถวต่อหน้า:</span>
                      <select 
                        value={rowsPerPage} 
                        onChange={(e) => setRowsPerPage(Number(e.target.value))} 
                        className="px-2 py-1 border border-stone-300 rounded-md outline-none cursor-pointer focus:border-orange-500 bg-white text-xs"
                      >
                        {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 🌟 คืนค่า Pagination ด้านบน */}
                {renderPagination()}

                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left whitespace-nowrap border-collapse min-w-[950px]">
                    <thead className="bg-white">
                      <tr className="text-[10px] font-bold text-stone-500 border-y border-stone-200">
                        <th className="py-3 px-5">วันที่ส่ง</th>
                        <th className="py-3 px-4">ทะเบียนรถ / โควตา</th>
                        <th className="py-3 px-4">กลุ่ม / รหัส</th>
                        <th className="py-3 px-4">โรงงาน</th>
                        <th className="py-3 px-2 text-center">ประเภท</th>
                        <th className="py-3 px-4 text-center">ตั๋วชั่ง</th>
                        <th className="py-3 px-5 text-right">น้ำหนักสุทธิ</th>
                        <th className="py-3 px-5 text-center">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-medium text-stone-800 divide-y divide-stone-100 bg-white">
                      {loading ? (
                        <tr><td colSpan={8} className="py-16 text-center"><div className="w-6 h-6 border-2 border-stone-300 border-t-orange-600 rounded-full animate-spin mx-auto"></div></td></tr>
                      ) : currentRows.length > 0 ? currentRows.map((record: any) => (
                        <tr key={record.id} className="hover:bg-orange-50/50 transition-colors">
                          <td className="py-2.5 px-5 font-bold text-stone-600">{formatDateShort(record.date)}</td>
                          <td className="py-2.5 px-4">
                            <span className="font-bold text-stone-500 block text-[9px] mb-0.5">{record.emp_name}</span>
                            <span className="font-black text-stone-900 text-xs">{record.truck_plate || '-'}</span>
                            <span className={`ml-1.5 inline-block w-2 h-2 rounded-full ${record.truck_part === 'tail' ? 'bg-purple-500' : 'bg-blue-500'}`} title={record.truck_part === 'tail' ? 'หางพ่วง' : 'ตัวหัว'}></span>
                          </td>
                          <td className="py-2.5 px-4 leading-tight">
                            <span className="font-bold text-stone-700 block truncate max-w-[120px] mb-1" title={record.group_leader || '-'}>{record.group_leader || '-'}</span>
                            <span className="font-black text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded text-[9px]">{record.quota_no || '-'}</span>
                          </td>
                          <td className="py-2.5 px-4 text-stone-700 font-bold">{record.factory_name}</td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`px-2 py-0.5 rounded border text-[9px] font-black ${record.cane_type === 'สด' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                              {record.cane_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center font-bold text-stone-500">{record.ticket_no || '-'}</td>
                          <td className="py-2.5 px-5 text-right font-black text-stone-900 text-sm">{Number(record.net_weight).toFixed(2)}</td>
                          <td className="py-2.5 px-5 text-center space-x-1.5">
                            <button onClick={() => setEditModal({ isOpen: true, data: record })} className="text-amber-600 bg-white hover:bg-amber-50 p-1.5 rounded-md transition-colors border border-amber-200 shadow-sm">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => handleDelete(record.id)} className="text-rose-600 bg-white hover:bg-rose-50 p-1.5 rounded-md transition-colors border border-rose-200 shadow-sm">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={8} className="py-16 text-center text-stone-500 font-bold bg-stone-50/50">ไม่พบข้อมูลบิลตั๋วชั่งในช่วงเวลานี้</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 🌟 คืนค่า Pagination ด้านล่าง */}
                {renderPagination()}
              </div>
            </div>

          </div>
        </div>

        {/* MODAL แก้ไขบิลใบเดียว */}
        {editModal.isOpen && editModal.data && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => !updating && setEditModal({ isOpen: false, data: null })}></div>
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative z-10 p-6 animate-in fade-in zoom-in-95 border border-stone-200">
              
              <div className="flex justify-between items-center mb-5 border-b border-stone-200 pb-3">
                <h3 className="text-lg font-black text-amber-600 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  แก้ไขบิลตั๋วชั่งอ้อย
                </h3>
                <button type="button" onClick={() => !updating && setEditModal({ isOpen: false, data: null })} className="text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 p-1.5 rounded-md transition-colors font-bold">✕</button>
              </div>

              <form onSubmit={handleUpdateSingleDelivery} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">วันที่ส่งอ้อย</label>
                    <input type="date" required value={editModal.data.date} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, date: e.target.value } })} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">งวดที่ตัด</label>
                    <select value={editModal.data.period_no} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, period_no: e.target.value } })} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
                      {['งวดที่ 1', 'งวดที่ 2', 'งวดที่ 3', 'งวดที่ 4', 'งวดที่ 5'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">คนรถ / โควตา</label>
                    <select value={editModal.data.emp_name} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, emp_name: e.target.value } })} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
                      {empOptions.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">ทะเบียนรถ</label>
                    <input type="text" required value={editModal.data.truck_plate} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, truck_plate: e.target.value } })} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">โรงงานปลายทาง</label>
                    <select value={editModal.data.factory_name} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, factory_name: e.target.value } })} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
                      {factoryOptions.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">สถานะรถ</label>
                    <select value={editModal.data.truck_part || 'head'} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, truck_part: e.target.value as any } })} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
                      <option value="head">🚚 ตัวหัว / รถเดี่ยว</option>
                      <option value="tail">🚛 ตัวหางพ่วง</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">ประเภทอ้อย</label>
                    <select value={editModal.data.cane_type} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, cane_type: e.target.value } })} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
                      <option value="สด">สด</option>
                      <option value="เผา">เผา</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">เลขที่ตั๋วชั่ง</label>
                    <input type="text" value={editModal.data.ticket_no} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, ticket_no: e.target.value } })} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" />
                  </div>
                </div>

                <div className="pt-1">
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">น้ำหนักสุทธิ (ตัน)</label>
                  <div className="relative">
                    <input type="number" step="0.01" required value={editModal.data.net_weight} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, net_weight: Number(e.target.value) } })} className="w-full px-4 py-2.5 border-2 border-stone-300 bg-stone-50 rounded-lg text-lg font-black text-stone-900 text-right pr-10 outline-none focus:border-amber-500 focus:bg-white transition-all tabular-nums" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-stone-500 text-xs">ตัน</span>
                  </div>
                </div>

                <div className="pt-4 flex gap-3 border-t border-stone-200 mt-4">
                  <button type="button" onClick={() => setEditModal({ isOpen: false, data: null })} disabled={updating} className="flex-1 py-2.5 rounded-lg font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 border border-stone-300 transition-colors disabled:opacity-50 text-xs">
                    ยกเลิก
                  </button>
                  <button type="submit" disabled={updating} className="flex-1 py-2.5 rounded-lg font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2 text-xs">
                    {updating ? 'บันทึก...' : 'บันทึกการแก้ไข'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL ลงบิลชุดใหญ่ */}
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4">
            <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => !saving && setShowModal(false)}></div>
            <div className="bg-stone-50 w-full max-w-7xl rounded-2xl shadow-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[96vh] border border-stone-300">
              
              <div className="px-6 py-4 bg-white border-b border-stone-300 flex justify-between items-center shrink-0 shadow-sm z-10">
                <div>
                  <h3 className="text-lg font-black text-stone-900 flex items-center gap-2">
                    <div className="p-1.5 bg-orange-600 text-white rounded shadow-sm">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    ลงบิลตั๋วชั่งแบบชุดรายคัน
                  </h3>
                </div>
                <button type="button" onClick={() => !saving && setShowModal(false)} className="w-8 h-8 rounded-md bg-stone-100 border border-stone-300 text-stone-500 hover:bg-stone-200 hover:text-stone-800 flex items-center justify-center font-bold transition-colors">✕</button>
              </div>

              <form onSubmit={handleSaveBulkTickets} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                
                {/* Header Form */}
                <div className="bg-white p-5 rounded-xl border border-stone-300 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">งวดที่ตัด</label>
                    <select value={formHeader.period_no} onChange={(e) => setFormHeader({...formHeader, period_no: e.target.value})} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 cursor-pointer">
                      {['งวดที่ 1', 'งวดที่ 2', 'งวดที่ 3', 'งวดที่ 4', 'งวดที่ 5'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[11px] font-bold text-stone-600">โควตารถ</label>
                      <button type="button" onClick={() => openCustomPrompt('emp', 'เพิ่มโควตาใหม่', 'ชื่อคนรถ/รหัสโควตา...')} className="text-[9px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-100">+ ใหม่</button>
                    </div>
                    <select value={formHeader.emp_name} onChange={(e) => setFormHeader({...formHeader, emp_name: e.target.value})} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 cursor-pointer">
                      {empOptions.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">🚚 ทะเบียนรถ (หัว)</label>
                    <input type="text" placeholder="เช่น 86-1926" required value={formHeader.truck_plate_head} onChange={(e) => setFormHeader({...formHeader, truck_plate_head: e.target.value})} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">🚛 ทะเบียนรถ (หาง)</label>
                    <input type="text" placeholder="เว้นว่างได้ถ้าไม่มี" value={formHeader.truck_plate_tail} onChange={(e) => setFormHeader({...formHeader, truck_plate_tail: e.target.value})} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-bold text-stone-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" />
                  </div>
                </div>

                {/* Quota Configs */}
                <div className="bg-white p-5 rounded-xl border border-stone-300 shadow-sm">
                  <h4 className="text-[11px] font-black text-stone-800 mb-3 flex items-center gap-2 border-b border-stone-200 pb-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> 
                     ตั้งค่ารหัสคู่สัญญา (ดึงไปใส่อัตโนมัติ)
                  </h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {factoryOptions.map(factory => (
                      <div key={factory} className="flex flex-col gap-2 bg-stone-50 p-3 rounded-lg border border-stone-200">
                        <span className="text-xs font-black text-stone-900">🏭 {factory}</span>
                        
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-stone-500 block">ข้อมูล [ตัวหัวรถ]</span>
                          <div className="flex gap-2">
                            <input type="text" placeholder="รหัสโควตา..." value={factoryConfigs[`${factory}_head`]?.quota_no || ''} onChange={(e) => updateFactoryConfig(factory, 'head', 'quota_no', e.target.value)} className="w-1/2 px-2.5 py-1.5 border border-stone-300 rounded-md text-[11px] font-black text-blue-700 outline-none focus:border-orange-500 uppercase" />
                            <input type="text" placeholder="ชื่อหัวหน้ากลุ่ม..." value={factoryConfigs[`${factory}_head`]?.group_leader || ''} onChange={(e) => updateFactoryConfig(factory, 'head', 'group_leader', e.target.value)} className="w-1/2 px-2.5 py-1.5 border border-stone-300 rounded-md text-[11px] font-bold text-stone-800 outline-none focus:border-orange-500" />
                          </div>
                        </div>

                        {formHeader.truck_plate_tail.trim() && (
                          <div className="space-y-1 pt-1.5 border-t border-stone-200 border-dashed mt-1">
                            <span className="text-[9px] font-bold text-stone-500 block">ข้อมูล [ตัวหางพ่วง]</span>
                            <div className="flex gap-2">
                              <input type="text" placeholder="รหัสโควตา..." value={factoryConfigs[`${factory}_tail`]?.quota_no || ''} onChange={(e) => updateFactoryConfig(factory, 'tail', 'quota_no', e.target.value)} className="w-1/2 px-2.5 py-1.5 border border-stone-300 rounded-md text-[11px] font-black text-purple-700 outline-none focus:border-orange-500 uppercase" />
                              <input type="text" placeholder="ชื่อหัวหน้ากลุ่ม..." value={factoryConfigs[`${factory}_tail`]?.group_leader || ''} onChange={(e) => updateFactoryConfig(factory, 'tail', 'group_leader', e.target.value)} className="w-1/2 px-2.5 py-1.5 border border-stone-300 rounded-md text-[11px] font-bold text-stone-800 outline-none focus:border-orange-500" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ticket Rows */}
                <div className="bg-white rounded-xl border border-stone-300 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-stone-300 bg-stone-100 flex justify-between items-center">
                    <h4 className="text-xs font-black text-stone-900 flex items-center gap-2">
                       📋 รายการชั่งน้ำหนัก ({ticketRows.length} เที่ยว)
                    </h4>
                    <button type="button" onClick={addTicketRow} className="px-3 py-1.5 bg-stone-900 text-white font-bold rounded-md text-[10px] hover:bg-stone-800 transition-colors shadow-sm">
                      + เพิ่มรายการ
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto w-full max-h-[40vh] custom-scrollbar relative">
                    <table className="w-full text-left whitespace-nowrap border-collapse min-w-[900px]">
                      <thead className="bg-white sticky top-0 z-10 shadow-sm">
                        <tr className="text-[10px] font-bold text-stone-600 border-b-2 border-stone-300">
                          <th className="py-2 px-3 w-32 border-r border-stone-200">วันที่ส่ง</th>
                          <th className="py-2 px-3 w-40 border-r border-stone-200">
                            <div className="flex justify-between items-center">
                              <span>โรงงาน</span>
                              <button type="button" onClick={() => openCustomPrompt('factory', 'เพิ่มโรงงาน', 'ชื่อโรงงาน...')} className="text-[9px] text-orange-700 bg-orange-100 px-1 py-0.5 rounded border border-orange-200">+ ใหม่</button>
                            </div>
                          </th>
                          <th className="py-2 px-3 w-28 text-center border-r border-stone-200">ตัวรถ</th>
                          <th className="py-2 px-3 w-24 text-center border-r border-stone-200">ประเภท</th>
                          <th className="py-2 px-3 w-32 border-r border-stone-200">เลขที่ตั๋วชั่ง</th>
                          <th className="py-2 px-3 w-36 text-center text-amber-800 bg-amber-50 border-r border-stone-200">👑 เปลี่ยนกลุ่ม (ถ้ามี)</th>
                          <th className="py-2 px-3 text-right w-36 border-r border-stone-200">น้ำหนัก (ตัน)</th>
                          <th className="py-2 px-2 text-center w-12">ลบ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 bg-stone-50/30">
                        {ticketRows.map((row) => (
                          <tr key={row.id} className="hover:bg-orange-50/50">
                            <td className="p-1.5 border-r border-stone-200">
                              <input type="date" required value={row.date} onChange={(e) => updateRowValue(row.id, 'date', e.target.value)} className="w-full px-2 py-1.5 border border-stone-300 rounded font-bold text-stone-800 outline-none focus:border-orange-500 text-[11px] bg-white" />
                            </td>
                            <td className="p-1.5 border-r border-stone-200">
                              <select value={row.factory_name} onChange={(e) => updateRowValue(row.id, 'factory_name', e.target.value)} className="w-full px-2 py-1.5 border border-stone-300 rounded font-bold text-stone-900 outline-none focus:border-orange-500 text-[11px] bg-white cursor-pointer">
                                {factoryOptions.map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                            </td>
                            <td className="p-1.5 border-r border-stone-200">
                              <select value={row.truck_part} onChange={(e) => updateRowValue(row.id, 'truck_part', e.target.value as any)} className={`w-full px-1 py-1.5 border border-stone-300 rounded font-bold outline-none text-center text-[11px] cursor-pointer ${row.truck_part === 'head' ? 'text-blue-700 bg-blue-50' : 'text-purple-700 bg-purple-50'}`}>
                                <option value="head">🚚 ตัวหัว</option>
                                {formHeader.truck_plate_tail.trim() && <option value="tail">🚛 หาง</option>}
                              </select>
                            </td>
                            <td className="p-1.5 border-r border-stone-200">
                              <select value={row.cane_type} onChange={(e) => updateRowValue(row.id, 'cane_type', e.target.value)} className={`w-full px-1 py-1.5 border border-stone-300 rounded font-black outline-none text-[11px] text-center cursor-pointer ${row.cane_type === 'สด' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                                <option value="สด">สด</option>
                                <option value="เผา">เผา</option>
                              </select>
                            </td>
                            <td className="p-1.5 border-r border-stone-200">
                              <input type="text" placeholder="เลขบิล..." value={row.ticket_no} onChange={(e) => updateRowValue(row.id, 'ticket_no', e.target.value)} className="w-full px-2 py-1.5 border border-stone-300 rounded font-bold text-stone-800 outline-none focus:border-orange-500 text-[11px] bg-white" />
                            </td>
                            <td className="p-1.5 bg-amber-50/30 border-r border-stone-200">
                              <input 
                                type="text" 
                                placeholder="ดึงอัตโนมัติ"
                                value={row.group_leader || ''} 
                                onChange={(e) => updateRowValue(row.id, 'group_leader', e.target.value)} 
                                className={`w-full px-2 py-1.5 border rounded font-bold text-center outline-none text-[11px] ${
                                  row.group_leader ? 'border-amber-400 bg-amber-100/50 text-amber-900' : 'border-stone-300 bg-white text-stone-500 focus:border-orange-500'
                                }`}
                              />
                            </td>
                            <td className="p-1.5 border-r border-stone-200 relative">
                              <input type="number" step="0.01" required placeholder="0.00" value={recordWeightValue(row.id)} onChange={(e) => updateRowWeight(row.id, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTicketRow(); } }} className="w-full pl-2 pr-7 py-1.5 border-2 border-stone-300 focus:border-orange-500 bg-white text-right text-[13px] font-black text-stone-900 rounded outline-none tabular-nums" />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-stone-400 text-[9px]">ตัน</span>
                            </td>
                            <td className="p-1.5 text-center">
                              <button type="button" onClick={() => removeTicketRow(row.id)} disabled={ticketRows.length === 1} className="w-6 h-6 flex items-center justify-center rounded bg-white border border-stone-300 text-stone-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 disabled:opacity-30 transition-colors mx-auto shadow-sm">
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-2">
                    <button type="submit" disabled={saving} className={`w-full py-3.5 rounded-xl font-black text-white text-[15px] shadow-sm transition-all border ${saving ? 'bg-stone-400 border-stone-400 cursor-not-allowed shadow-none' : 'bg-orange-600 border-orange-700 hover:bg-orange-500 active:scale-[0.99]'}`}>
                      {saving ? 'กำลังประมวลผลข้อมูล...' : `💾 ยืนยันบันทึกข้อมูล ${ticketRows.length} เที่ยว`}
                    </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CUSTOM PROMPT WINDOW */}
        {customPrompt.isOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setCustomPrompt({ ...customPrompt, isOpen: false })}></div>
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl relative z-10 p-6 animate-in fade-in zoom-in-95 border border-stone-200">
              <h3 className="text-base font-black text-stone-900 mb-1">{customPrompt.title}</h3>
              <p className="text-[11px] text-stone-500 font-bold mb-4">ข้อมูลจะถูกเพิ่มให้เลือกชั่วคราวในงวดนี้</p>
              <form onSubmit={handleCustomPromptSubmit}>
                <input type="text" autoFocus required placeholder={customPrompt.placeholder} value={customPrompt.inputValue} onChange={(e) => setCustomPrompt({ ...customPrompt, inputValue: e.target.value })} className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-lg text-sm font-bold text-stone-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none mb-4" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCustomPrompt({ ...customPrompt, isOpen: false })} className="flex-1 py-2 rounded-lg font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-xs transition-colors">ยกเลิก</button>
                  <button type="submit" className="flex-1 py-2 rounded-lg font-bold text-white bg-orange-600 hover:bg-orange-700 text-xs shadow-sm transition-colors">ตกลง</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Notifications popup */}
        {notify.isOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in" onClick={closeNotify}></div>
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl relative z-10 p-8 animate-in fade-in zoom-in-95 flex flex-col items-center text-center border border-stone-200">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 border ${
                notify.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                notify.type === 'error' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                notify.type === 'warning' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                'bg-orange-50 text-orange-600 border-orange-200'
              }`}>
                {notify.type === 'success' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>}
                {notify.type === 'error' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>}
                {(notify.type === 'warning' || notify.type === 'confirm') && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
              </div>

              <h3 className="text-xl font-black text-stone-900 mb-2">{notify.title}</h3>
              <p className="text-sm text-stone-500 font-bold mb-8">{notify.message}</p>

              {notify.type === 'confirm' ? (
                <div className="flex gap-3 w-full">
                  <button onClick={closeNotify} className="flex-1 py-3 rounded-lg font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 border border-stone-300">ยกเลิก</button>
                  <button 
                    onClick={() => {
                      if (notify.onConfirm) notify.onConfirm();
                      closeNotify();
                    }} 
                    className="flex-1 py-3 rounded-lg font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md"
                  >
                    ยืนยันลบ
                  </button>
                </div>
              ) : (
                <button 
                  onClick={closeNotify} 
                  className={`w-full py-3 rounded-lg font-bold text-white shadow-md ${
                    notify.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    notify.type === 'error' ? 'bg-rose-600 hover:bg-rose-700' :
                    'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  รับทราบ
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* 🖨️ PERFECT EXCEL PRINT LAYOUT (คงเดิม 100%) */}
      {/* ========================================== */}
      <div className="hidden print:block w-full bg-white text-black font-sans p-2">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body { background-color: white !important; color: black !important; margin: 0; padding: 0; }
            @page { size: A4 landscape; margin: 5mm; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            
            .excel-table { border-collapse: collapse; width: 100%; border: none !important; }
            .excel-table th, .excel-table td { border: 1.5px solid black !important; font-family: 'Segoe UI', Tahoma, sans-serif !important; padding-top: 1px !important; padding-bottom: 1px !important; }
            
            .employee-page-container { page-break-after: always !important; break-after: page !important; width: 100%; }
            
            .tables-layout-container { 
              display: flex; 
              flex-wrap: wrap; 
              gap: 1.5%; 
              width: 100%; 
              justify-content: flex-start;
              align-items: flex-start;
            }

            .normal-truck-wrapper { width: 32%; margin-bottom: 2mm; flex-shrink: 0; }
            .trailer-truck-wrapper { width: 49%; margin-bottom: 2mm; flex-shrink: 0; }

            .print-block-wrapper { page-break-inside: avoid !important; break-inside: avoid !important; }
            .excel-table tr { break-inside: avoid !important; page-break-inside: avoid !important; }
            thead { display: table-header-group; }
            tfoot { display: table-row-group; break-inside: avoid !important; }
          }
        `}} />

        {Object.entries(printGroupedData).map(([empName, truckMap]: any) => {
          const sortedPlates = Object.keys(truckMap).sort();
          const hasTrailer = deliveries.some(d => d.emp_name === empName && d.truck_part === 'tail');

          return (
            <div key={empName} className="employee-page-container">
              
              <div className="flex items-center justify-between border-b-4 border-black pb-1 mb-1 pt-1">
                <div className="flex items-center gap-4">
                  <img src="/iconapp.jpg" alt="Logo" className="w-18 h-18 object-cover rounded-full border-2 border-black" />
                  <div className="text-left">
                    <h1 className="text-2xl font-black text-black tracking-tight mb-0.5">หนุ่มไร่อ้อย จรุงพัฒนานนท์</h1>
                    <p className="text-xs font-bold text-gray-700">
                      รายงานบัญชีน้ำหนักอ้อยส่งโรงงานหีบอ้อย <span className="font-black underline px-1 text-black">{selectedPeriod} {selectedYear !== 'ทั้งหมด' ? `ปี ${selectedYear}` : ''}</span> | สรุปข้อมูลดิบชุดประวัติถาวร
                    </p>
                  </div>
                </div>
                <div className="text-right text-[10px] font-black text-gray-500 leading-tight">
                  <div>ไร่อ้อยจรุงพัฒนานนท์ ERP</div>
                  <div className="mt-1 font-bold">วันที่ออกเอกสาร: {printDateTime || 'กำลังโหลด...'}</div>
                </div>
              </div>
              
              <div className="w-full text-center font-black text-[13px] bg-[#9CC2E5] border-2 border-black py-1 mb-1.5 tracking-wide text-black print:bg-[#9CC2E5]">
                ชื่อคนขับ / โควตาหลัก: {empName}
              </div>

              <div className={hasTrailer ? "grid grid-cols-2 gap-x-4 gap-y-1.5 w-full items-start" : "flex flex-row flex-wrap gap-2 w-full items-start"}>
                {(() => {
                  return sortedPlates.map((plateName) => {
                    const delivs = [...truckMap[plateName]].sort((a, b) => a.date.localeCompare(b.date));
                    
                    const getStats = (ds: any[]) => {
                      if (!ds.length) return null;
                      const rayong = ds.filter(d => d.factory_name.includes('ระยอง'));
                      const chonburi = ds.filter(d => d.factory_name.includes('ชลบุรี'));
                      return {
                        quotaRayong: rayong[0]?.quota_no || ds[0]?.quota_no || '-',
                        groupRayong: rayong[0]?.group_leader || ds[0]?.group_leader || '-',
                        groupChonburi: chonburi[0]?.group_leader || ds[0]?.group_leader || '-',
                        freshWeight: rayong.filter(d => d.cane_type === 'สด').reduce((s, d) => s + Number(d.net_weight), 0),
                        burntWeight: rayong.filter(d => d.cane_type === 'เผา').reduce((s, d) => s + Number(d.net_weight), 0),
                        chonburiWeight: chonburi.reduce((s, d) => s + Number(d.net_weight), 0),
                        freshTrips: rayong.filter(d => d.cane_type === 'สด').length,
                        burntTrips: rayong.filter(d => d.cane_type === 'เผา').length,
                        chonburiTrips: chonburi.length
                      };
                    };

                    const s = getStats(delivs);

                    const itemClass = hasTrailer ? "w-full" : "";
                    const itemStyle = hasTrailer 
                      ? { pageBreakInside: 'auto' as const }
                      : { pageBreakInside: 'avoid' as const, width: '32%', flexGrow: 0, flexShrink: 0, marginBottom: '8px' };

                    return (
                      <div key={plateName} className={itemClass} style={itemStyle}>
                        <table className="excel-table w-full text-center border-collapse border-2 border-black text-[9px] bg-white">
                          <thead className="bg-gray-100">
                            <tr className="bg-[#BDD7EE] font-black text-black text-[10px]">
                              <th colSpan={5} className="py-0.5 border border-black text-center whitespace-nowrap">
                                🚚 ทะเบียน {plateName} {delivs[0]?.truck_part === 'tail' ? '(หางพ่วง)' : ''}
                              </th>
                            </tr>
                            <tr className="bg-white font-bold text-black text-[9px]">
                              <th className="border border-black py-0.5 w-[15%]" rowSpan={3}>วันที่</th>
                              <th colSpan={3} className="border border-black py-0.5 bg-[#FFF2CC] w-[55%]">น้ำตาลระยอง</th>
                              <th colSpan={1} className="border border-black py-0.5 bg-[#E2EFDA] w-[30%]">สหการชลบุรี</th>
                            </tr>
                            <tr className="bg-white font-bold text-black text-[8.5px] leading-tight">
                              <th colSpan={2} className="border border-black py-0.5">{s?.quotaRayong}</th>
                              <th colSpan={1} className="border border-black py-0.5 bg-gray-50 font-medium">กลุ่มที่</th>
                              <th colSpan={1} className="border border-black py-0.5 bg-[#E2EFDA]">{s?.groupChonburi}</th>
                            </tr>
                            <tr className="bg-gray-100 text-stone-800 font-bold text-[8.5px]">
                              <th className="border border-black py-0.5 text-emerald-800">สด</th>
                              <th className="border border-black py-0.5 text-rose-700">เผา</th>
                              <th className="border border-black py-0.5 font-black text-black">{s?.groupRayong}</th>
                              <th className="border border-black py-0.5 text-blue-800">น้ำหนัก</th>
                            </tr>
                          </thead>
                          
                          <tbody className="divide-y divide-black bg-white tabular-nums">
                            {delivs.map((d: any, idx: number) => {
                              const isRayong = d.factory_name.includes('ระยอง');
                              const isChonburi = d.factory_name.includes('ชลบุรี');
                              return (
                                <tr key={idx} className="h-auto">
                                  <td className={`border border-black font-bold whitespace-nowrap px-0.5 py-0.5`}>{formatDateShort(d.date)}</td>
                                  <td className="border border-black font-black text-emerald-700 text-right pr-1 py-0.5">
                                    {isRayong && d.cane_type === 'สด' ? Number(d.net_weight).toFixed(2) : ''}
                                  </td>
                                  <td className="border border-black font-black text-rose-600 text-right pr-1 py-0.5">
                                    {isRayong && d.cane_type === 'เผา' ? Number(d.net_weight).toFixed(2) : ''}
                                  </td>
                                  <td className="border border-black text-stone-600 text-[8.5px] font-bold py-0.5">
                                    {isRayong ? d.group_leader : ''}
                                  </td>
                                  <td className="border border-black font-black text-blue-700 text-right pr-1 bg-[#F9FBF6] py-0.5">
                                    {isChonburi ? Number(d.net_weight).toFixed(2) : ''}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          
                          <tbody className="font-bold bg-white text-[9.5px] tabular-nums">
                            <tr className="border-t-2 border-black">
                              <td className="border border-black py-0.5 text-center bg-gray-50 font-bold">รวมเที่ยว</td>
                              <td className="border border-black py-0.5 text-emerald-800 text-center font-bold">{s?.freshTrips || 0}</td>
                              <td className="border border-black py-0.5 text-rose-800 text-center font-bold">{s?.burntTrips || 0}</td>
                              <td className="border border-black py-0.5 bg-gray-50"></td>
                              <td className="border border-black py-0.5 text-blue-800 bg-[#E2EFDA] text-center font-bold">{s?.chonburiTrips || 0}</td>
                            </tr>
                            <tr className="bg-gray-200 border-t border-black text-black">
                              <td className="border border-black py-0.5 text-[8.5px] font-black bg-gray-100 whitespace-nowrap">น้ำหนักสุทธิ</td>
                              <td className="border border-black py-0.5 text-right pr-1 text-emerald-700 bg-white font-black">{s?.freshWeight ? s.freshWeight.toFixed(2) : '0.00'}</td>
                              <td className="border border-black py-0.5 text-right pr-1 text-rose-600 bg-white font-black">{s?.burntWeight ? s.burntWeight.toFixed(2) : '0.00'}</td>
                              <td className="border border-black py-0.5 bg-gray-100"></td>
                              <td className="border border-black py-0.5 text-right pr-1 text-blue-700 bg-[#E2EFDA] font-black">{s?.chonburiWeight ? s.chonburiWeight.toFixed(2) : '0.00'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          );
        })}

        {/* 📊 บล็อกสรุปผลรวมน้ำหนักสุทธิทั้งหมด 📊 */}
        <div className="summary-page" style={{ pageBreakBefore: 'always' }}>
          <div className="flex items-center justify-between border-b-4 border-black pb-3 mb-3 pt-1">
            <div className="flex items-center gap-4">
              <img src="/iconapp.jpg" alt="Logo" className="w-18 h-18 object-cover rounded-full border-2 border-black" />
              <div className="text-left">
                <h1 className="text-2xl font-black text-black tracking-tight mb-0.5">หนุ่มไร่อ้อย จรุงพัฒนานนท์</h1>
                <p className="text-xs font-bold text-gray-700">
                  รายงานบัญชีน้ำหนักอ้อยส่งโรงงานหีบอ้อย <span className="font-black underline px-1 text-black">{selectedPeriod} {selectedYear !== 'ทั้งหมด' ? `ปี ${selectedYear}` : ''}</span> | สรุปข้อมูลดิบชุดประวัติถาวร
                </p>
              </div>
            </div>
            <div className="text-right text-[10px] font-black text-gray-500 leading-tight">
              <div>ไร่อ้อยจรุงพัฒนานนท์ ERP</div>
              <div className="mt-1 font-bold">วันที่ออกเอกสาร: {printDateTime || 'กำลังโหลด...'}</div>
            </div>
          </div>

          <div className="w-full text-center font-black text-[13px] bg-[#F8CBAD] border-2 border-black py-1.5 mb-4 tracking-wide text-black print:bg-[#F8CBAD]">
            ตารางสรุปยอดรวมทั้งระบบประจำงวด
          </div>

          <div className="flex items-start gap-8 pr-2 tabular-nums">
            <div className="w-[450px] shrink-0">
              <table className="excel-table w-full text-[12px] font-bold text-black border-2 border-black border-collapse text-left">
                <tbody>
                  <tr>
                    <td className="px-3 py-2 bg-[#FFF2CC] border border-black w-2/3">รวมน้ำหนักสุทธิอ้อยสดน้ำตาลระยอง</td>
                    <td className="text-right pr-3 font-black text-sm border border-black bg-white">
                      {deliveries.filter(d => d.factory_name.includes('ระยอง') && d.cane_type === 'สด').reduce((s, d) => s + Number(d.net_weight), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 bg-[#E2EFDA] border border-black">รวมน้ำหนักสุทธิอ้อยสดสหการชลบุรี</td>
                    <td className="text-right pr-3 font-black text-sm border border-black bg-white">
                      {deliveries.filter(d => d.factory_name.includes('ชลบุรี')).reduce((s, d) => s + Number(d.net_weight), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 border border-black bg-white">รวมน้ำหนักสุทธิอ้อยเผาน้ำตาลระยอง</td>
                    <td className="text-right pr-3 font-black text-sm border border-black bg-white">
                      {deliveries.filter(d => d.factory_name.includes('ระยอง') && d.cane_type === 'เผา').reduce((s, d) => s + Number(d.net_weight), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-3 py-2.5 border border-black text-black font-black text-[13px]">รวมน้ำหนักอ้อยส่งเข้าหีบสุทธิประจำงวด</td>
                    <td className="text-right pr-3 text-base font-black border border-black text-[#C00000]">
                      {grandTotalWeight.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className="text-[10px] text-black font-bold">ตัน</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex-1 max-w-[500px]">
              <table className="excel-table w-full text-[11px] font-bold text-black border-2 border-black border-collapse text-center">
                <thead>
                  <tr className="bg-[#D9E1F2] print:bg-[#D9E1F2]">
                    <th colSpan={4} className="py-1.5 border border-black font-black text-[12px]">สรุปน้ำหนักแยกตามหัวหน้ากลุ่ม</th>
                  </tr>
                  <tr className="bg-gray-100 print:bg-gray-100">
                    <th className="px-2 py-1.5 border border-black w-2/5">หัวหน้ากลุ่ม</th>
                    <th className="px-2 py-1.5 border border-black text-emerald-800">สด (ตัน)</th>
                    <th className="px-2 py-1.5 border border-black text-rose-800">เผา (ตัน)</th>
                    <th className="px-2 py-1.5 border border-black text-blue-900 font-black">รวมสุทธิ</th>
                  </tr>
                </thead>
                <tbody>
                  {groupLeaderSummaryList.length > 0 ? groupLeaderSummaryList.map(([leaderName, values]: any) => (
                    <tr key={leaderName} className="bg-white">
                      <td className="px-2 py-1 border border-black text-left">{leaderName}</td>
                      <td className="px-2 py-1 border border-black text-right text-emerald-700">{Number(values.fresh).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="px-2 py-1 border border-black text-right text-rose-700">{Number(values.burnt).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="px-2 py-1 border border-black text-right font-black text-black">{Number(values.total).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>
                  )) : (
                    <tr className="bg-white">
                      <td colSpan={4} className="px-2 py-2 border border-black text-center text-gray-500">ไม่มีข้อมูลคู่สัญญาในงวดนี้</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d6d3d1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a8a29e;
        }
        
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.5;
          transition: 0.2s;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover {
          opacity: 0.8;
        }
      `}</style>
    </>
  );

  // **Helper Functions from Original Code (Untouched)**

  function recordWeightValue(id: string) {
    const matchedRow = ticketRows.find(row => row.id === id);
    return matchedRow ? matchedRow.net_weight : '';
  }

  function updateRowWeight(id: string, value: string) {
    updateRowValue(id, 'net_weight', value);
  }
}