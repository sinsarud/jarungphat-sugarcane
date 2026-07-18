'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface InventoryItem {
  id: string;
  name: string;
  category: 'fertilizer' | 'pesticide' | 'seed' | 'fuel';
  stock: number;
  min_stock: number; 
  unit: string;
  location: string;
  last_received: string;
}

export default function InventoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [showItemModal, setShowItemModal] = useState(false); 
  const [showStockModal, setShowStockModal] = useState(false); 
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItemForStock, setSelectedItemForStock] = useState<InventoryItem | null>(null);

  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<'fertilizer' | 'pesticide' | 'seed' | 'fuel'>('fertilizer');
  const [formStock, setFormStock] = useState<number | ''>(''); 
  const [formMinStock, setFormMinStock] = useState<number | ''>('');
  const [formUnit, setFormUnit] = useState('กระสอบ');
  const [formLocation, setFormLocation] = useState('');

  const [stockActionType, setStockActionType] = useState<'receive' | 'dispense'>('receive');
  const [stockAmount, setStockAmount] = useState<number | ''>('');

  const [popup, setPopup] = useState({ show: false, type: '', message: '' });

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('name', { ascending: true });

    if (data && !error) {
      setItems(data.map((d: any) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        stock: Number(d.stock),
        min_stock: Number(d.min_stock),
        unit: d.unit,
        location: d.location || '-',
        last_received: d.last_received
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push('/login');
      else fetchInventory();
    }
    checkAuth();
  }, [router]);

  const openAddItemModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormCategory('fertilizer');
    setFormStock(''); 
    setFormMinStock('');
    setFormUnit('กระสอบ');
    setFormLocation('');
    setShowItemModal(true);
  };

  const openEditItemModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormStock(item.stock); 
    setFormMinStock(item.min_stock);
    setFormUnit(item.unit);
    setFormLocation(item.location);
    setShowItemModal(true);
  };

  const openStockAdjustmentModal = (item: InventoryItem) => {
    setSelectedItemForStock(item);
    setStockActionType('receive');
    setStockAmount('');
    setShowStockModal(true);
  };

  const handleSaveItem = async () => {
    if (!formName.trim() || formStock === '' || formStock < 0 || formMinStock === '' || formMinStock < 0) {
      setPopup({ show: true, type: 'error', message: 'กรุณากรอกชื่อสินค้า จำนวนตั้งต้น และจุดเตือนสต็อกให้ถูกต้อง' });
      return;
    }

    setSaving(true);
    const itemData = {
      name: formName.trim(),
      category: formCategory,
      stock: Number(formStock), 
      min_stock: Number(formMinStock),
      unit: formUnit.trim(),
      location: formLocation.trim() || 'คลังหลัก'
    };

    try {
      if (editingItem) {
        const { error } = await supabase.from('inventory').update(itemData).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory').insert([{ ...itemData }]);
        if (error) throw error;
      }

      setShowItemModal(false);
      setPopup({ show: true, type: 'success', message: 'บันทึกข้อมูลสินค้าวัตถุดิบเรียบร้อยแล้ว!' });
      fetchInventory();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStockQuantity = async () => {
    if (!selectedItemForStock || !stockAmount || stockAmount <= 0) {
      setPopup({ show: true, type: 'error', message: 'กรุณาระบุจำนวนสินค้าให้ถูกต้อง' });
      return;
    }

    setSaving(true);
    let finalAmount = selectedItemForStock.stock;

    if (stockActionType === 'receive') {
      finalAmount += Number(stockAmount);
    } else {
      if (selectedItemForStock.stock < stockAmount) {
        setPopup({ show: true, type: 'error', message: 'สินค้าในคลังมีไม่พอให้เบิกจ่ายหน้างานครับ' });
        setSaving(false);
        return;
      }
      finalAmount -= Number(stockAmount);
    }

    try {
      const { error } = await supabase
        .from('inventory')
        .update({ 
          stock: finalAmount,
          last_received: new Date().toISOString()
        })
        .eq('id', selectedItemForStock.id);

      if (error) throw error;

      setShowStockModal(false);
      setPopup({ show: true, type: 'success', message: `ทำรายการ ${stockActionType === 'receive' ? 'รับของเข้า' : 'เบิกของออก'} เรียบร้อยแล้ว\nยอดคงเหลือล่าสุดคือ ${finalAmount.toLocaleString()} ${selectedItemForStock.unit}` });
      fetchInventory();
    } catch (error: any) {
      setPopup({ show: true, type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const lowStockCount = items.filter(item => item.stock <= item.min_stock).length;

  const getCategoryMeta = (cat: string) => {
    switch (cat) {
      case 'fertilizer': return { label: 'ปุ๋ยบำรุง', icon: '🚜', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'pesticide': return { label: 'ยา/สารเคมี', icon: '🧪', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'fuel': return { label: 'เชื้อเพลิง', icon: '⛽', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'seed': return { label: 'ท่อนพันธุ์', icon: '🌱', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      default: return { label: 'ทั่วไป', icon: '📦', color: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin shadow-lg shadow-emerald-600/20"></div>
        <p className="mt-4 text-xs font-bold text-slate-400 tracking-wider uppercase animate-pulse">Loading Inventory...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans text-slate-800 antialiased selection:bg-emerald-500 selection:text-white relative">
      
      {/* 🌟 Premium Glassmorphism Header 🌟 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 transition-all">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button 
              onClick={() => router.push('/')} 
              className="p-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-xl transition-all shrink-0 active:scale-95"
              title="กลับหน้าหลัก"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">คลังสินค้า & สต็อกวัตถุดิบ</h1>
                <span className="hidden md:inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full uppercase tracking-wider">Pro Module</span>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 mt-1">ระบบบริหารจัดการคลังสินค้า และควบคุมต้นทุนในไร่</p>
            </div>
          </div>

          <button 
            onClick={openAddItemModal}
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 py-3 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all active:scale-95 border border-emerald-500/20"
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            </div>
            <span>ลงทะเบียนสินค้าใหม่</span>
          </button>
        </div>
      </header>

      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 mt-6 sm:mt-8">
        
        {/* 🌟 Premium Stats Banner 🌟 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          
          <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:border-slate-300 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-100 to-transparent rounded-bl-full -mr-6 -mt-6 pointer-events-none transition-transform group-hover:scale-110"></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-md shadow-slate-900/10 shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">รายการในคลังรวม</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{items.length}</h3>
                  <span className="text-xs font-bold text-slate-500">รายการ</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:border-red-200 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-50 to-transparent rounded-bl-full -mr-6 -mt-6 pointer-events-none transition-transform group-hover:scale-110"></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-red-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-rose-500/20 shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">สต็อกต่ำกว่าเกณฑ์ / หมด</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <h3 className="text-2xl sm:text-3xl font-black text-rose-600 tracking-tight">{lowStockCount}</h3>
                  <span className="text-xs font-bold text-slate-500">รายการ</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:border-emerald-200 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-50 to-transparent rounded-bl-full -mr-6 -mt-6 pointer-events-none transition-transform group-hover:scale-110"></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">สถานะคลังภาพรวม</p>
                <h3 className={`text-base sm:text-lg font-black mt-1 ${lowStockCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {lowStockCount > 0 ? '⚠️ ควรเตรียมสั่งของเพิ่ม' : '✨ ของครบพร้อมใช้งาน'}
                </h3>
              </div>
            </div>
          </div>

        </div>

        {/* 🌟 Advanced Search & Segmented Filters 🌟 */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] mb-6 sm:mb-8 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          
          <div className="relative flex-grow max-w-md">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input
              type="text"
              placeholder="ค้นหาชื่อปุ๋ย, ตัวยา, สารเคมี, สูตร..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl sm:rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-xs sm:text-sm font-semibold"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          <div className="flex overflow-x-auto pb-1 sm:pb-0 gap-1.5 text-xs font-bold no-scrollbar bg-slate-100/80 p-1.5 rounded-xl sm:rounded-2xl border border-slate-200/60">
            {[
              { id: 'all', label: '📦 ทั้งหมด' },
              { id: 'fertilizer', label: '🚜 ปุ๋ยบำรุง' },
              { id: 'pesticide', label: '🧪 สารเคมี' },
              { id: 'fuel', label: '⛽ เชื้อเพลิง' },
              { id: 'seed', label: '🌱 ท่อนพันธุ์' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3.5 py-2 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap shrink-0 ${
                  selectedCategory === tab.id 
                    ? 'bg-white text-slate-900 shadow-sm shadow-slate-900/5 font-black' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

        </div>

        {/* ======================================================= */}
        {/* 📱 MOBILE VIEW: Premium Card Layout 📱 */}
        {/* ======================================================= */}
        <div className="block md:hidden space-y-3.5">
          {filteredItems.length > 0 ? filteredItems.map((item) => {
            const isLowStock = item.stock <= item.min_stock;
            const isOutOfStock = item.stock === 0;
            const meta = getCategoryMeta(item.category);

            return (
              <div 
                key={`mob-${item.id}`} 
                className={`p-4 rounded-2xl border bg-white shadow-sm relative transition-all ${
                  isOutOfStock ? 'border-red-300 bg-gradient-to-br from-red-50/50 to-white' : 
                  isLowStock ? 'border-amber-300 bg-gradient-to-br from-amber-50/30 to-white' : 
                  'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3 gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="text-2xl p-2 bg-slate-50 rounded-xl border border-slate-100 shrink-0 leading-none">{meta.icon}</span>
                    <div>
                      <h3 className="font-black text-slate-900 text-base leading-tight">{item.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.color}`}>{meta.label}</span>
                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          {item.location}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => openEditItemModal(item)} 
                    className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200/60 shrink-0 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 mt-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ยอดคงเหลือในสต็อก</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-2xl sm:text-3xl font-black tracking-tight ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-slate-900'}`}>
                        {item.stock.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-slate-500">{item.unit}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => openStockAdjustmentModal(item)}
                    className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border font-bold text-xs transition-all active:scale-95 shadow-sm ${
                      isLowStock 
                        ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-transparent shadow-red-500/20' 
                        : 'bg-slate-900 text-white border-transparent hover:bg-slate-800 shadow-slate-900/10'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                    <span>ปรับสต็อก</span>
                  </button>
                </div>

                {isLowStock && (
                  <div className={`mt-3 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${isOutOfStock ? 'bg-red-100/80 text-red-700 border border-red-200 animate-pulse' : 'bg-amber-100/80 text-amber-800 border border-amber-200'}`}>
                    <span>{isOutOfStock ? '🚨' : '⚠️'}</span>
                    <span>{isOutOfStock ? 'สินค้าหมดคลัง! กรุณาสั่งซื้อด่วน' : `สต็อกต่ำกว่าเกณฑ์ที่กำหนด (ขั้นต่ำ: ${item.min_stock.toLocaleString()})`}</span>
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 border-dashed">
              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">📦</div>
              <p className="text-slate-500 font-bold text-sm">ไม่พบรายการวัตถุดิบที่ค้นหา</p>
              <p className="text-slate-400 text-xs mt-1">ลองเปลี่ยนคำค้นหา หรือกดปุ่มลงทะเบียนสินค้าใหม่ด้านบน</p>
            </div>
          )}
        </div>

        {/* ======================================================= */}
        {/* 💻 DESKTOP VIEW: Clean Enterprise Table 💻 */}
        {/* ======================================================= */}
        <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">ชื่อวัตถุดิบ / สินค้าในไร่</th>
                  <th className="py-4 px-6">หมวดหมู่</th>
                  <th className="py-4 px-6">คงเหลือในคลัง (กดเพื่อปรับยอด)</th>
                  <th className="py-4 px-6">จุดเตือนสต็อก (Min)</th>
                  <th className="py-4 px-6">สถานที่จัดเก็บ</th>
                  <th className="py-4 px-6 text-center">สถานะ</th>
                  <th className="py-4 px-6 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                {filteredItems.length > 0 ? filteredItems.map((item) => {
                  const isLowStock = item.stock <= item.min_stock;
                  const isOutOfStock = item.stock === 0;
                  const meta = getCategoryMeta(item.category);

                  let statusBadge = (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      พร้อมใช้งาน
                    </span>
                  );
                  if (isOutOfStock) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-bold animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span>
                        ของหมดคลัง
                      </span>
                    );
                  } else if (isLowStock) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        สต็อกต่ำกว่าเกณฑ์
                      </span>
                    );
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 text-base group-hover:text-emerald-700 transition-colors">{item.name}</div>
                      </td>
                      
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${meta.color}`}>
                          <span>{meta.icon}</span>
                          <span>{meta.label}</span>
                        </span>
                      </td>

                      <td className="py-3 px-6">
                        <button
                          onClick={() => openStockAdjustmentModal(item)}
                          className={`flex items-center gap-3 px-3.5 py-1.5 rounded-xl border transition-all active:scale-95 group/btn w-fit ${
                            isOutOfStock 
                              ? 'bg-red-50/50 border-red-200 hover:bg-red-100 hover:border-red-300' 
                              : isLowStock 
                              ? 'bg-amber-50/50 border-amber-200 hover:bg-amber-100 hover:border-amber-300'
                              : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-sm'
                          }`}
                          title="คลิกเพื่อเบิก หรือ รับของเข้า"
                        >
                          <div className="flex items-baseline gap-1">
                            <span className={`font-black text-lg tracking-tight ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-slate-900'}`}>
                              {item.stock.toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-slate-500">{item.unit}</span>
                          </div>
                          
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            isLowStock 
                              ? 'bg-red-600 text-white shadow-sm shadow-red-500/20' 
                              : 'bg-slate-200 text-slate-700 group-hover/btn:bg-slate-900 group-hover/btn:text-white'
                          }`}>
                            <svg className="w-3 h-3 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                            <span>ปรับยอด</span>
                          </div>
                        </button>
                      </td>

                      <td className="py-4 px-6 text-slate-400 font-semibold">{item.min_stock.toLocaleString()} <span className="text-xs">{item.unit}</span></td>
                      
                      <td className="py-4 px-6">
                        <span className="text-slate-600 font-medium flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          {item.location}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-center">{statusBadge}</td>
                      
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={() => openEditItemModal(item)} 
                          className="text-xs font-bold text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl border border-slate-200/80 transition-all inline-flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span>แก้ไข</span>
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">📦</div>
                      <p className="text-slate-500 font-bold text-base">ไม่พบรายการคลังวัตถุดิบที่ค้นหา</p>
                      <p className="text-slate-400 text-xs mt-1">ลองตรวจสอบตัวสะกด หรือกดลงทะเบียนสินค้าใหม่ด้านบน</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ======================================================= */}
      {/* 🌟 PREMIUM MODAL 1: เพิ่ม / แก้ไขข้อมูลสินค้า 🌟 */}
      {/* ======================================================= */}
      {showItemModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowItemModal(false)}></div>
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto border border-slate-100">
            
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg shrink-0">
                    {editingItem ? '⚙️' : '📦'}
                  </span>
                  <span>{editingItem ? `แก้ไขข้อมูล: ${editingItem.name}` : 'ลงทะเบียนสินค้า / วัตถุดิบใหม่'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 pl-11">กำหนดชื่อ หมวดหมู่ และเกณฑ์การแจ้งเตือนเมื่อของใกล้หมด</p>
              </div>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all">✕</button>
            </div>

            <div className="space-y-5">
              
              {/* 1. เลือกหมวดหมู่แบบ Interactive Cards */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">1. เลือกหมวดหมู่สินค้า</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'fertilizer', label: 'ปุ๋ยบำรุง', icon: '🚜', desc: 'ปุ๋ยเคมี, ปุ๋ยอินทรีย์' },
                    { id: 'pesticide', label: 'ยา/สารเคมี', icon: '🧪', desc: 'ยาคุมหญ้า, ฮอร์โมน' },
                    { id: 'fuel', label: 'เชื้อเพลิง', icon: '⛽', desc: 'ดีเซล, เบนซิน, น้ำมันเครื่อง' },
                    { id: 'seed', label: 'ท่อนพันธุ์', icon: '🌱', desc: 'พันธุ์อ้อย, ท่อนพันธุ์' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormCategory(cat.id as any)}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                        formCategory === cat.id 
                          ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950' 
                          : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="text-2xl p-2 bg-white rounded-xl shadow-sm border border-slate-100 shrink-0 leading-none">{cat.icon}</span>
                      <div>
                        <div className="font-bold text-sm leading-tight">{cat.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">{cat.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. ชื่อสินค้าและหน่วยนับ */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">2. ชื่อสินค้า / สูตรยี่ห้อ <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={formName} 
                    onChange={(e) => setFormName(e.target.value)} 
                    placeholder="เช่น ปุ๋ยตรากระต่าย 46-0-0, ดีเซล บี7..." 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">หน่วยนับ <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={formUnit} 
                    onChange={(e) => setFormUnit(e.target.value)} 
                    placeholder="กระสอบ / ลิตร / ตัน" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm text-center transition-all" 
                  />
                </div>
              </div>

              {/* 3. สต็อกและการแจ้งเตือน */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 block">3. จำนวนตั้งต้น / ยอดปัจจุบัน <span className="text-red-500">*</span></label>
                  <div className="relative mt-1">
                    <input 
                      type="number" 
                      min="0" 
                      value={formStock} 
                      onChange={(e) => setFormStock(e.target.value === '' ? '' : Number(e.target.value))} 
                      placeholder="0" 
                      className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-black text-lg text-right focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" 
                    />
                    <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">{formUnit || 'หน่วย'}</span>
                  </div>
                </div>
                
                <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/60">
                  <label className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>⚡ เตือนเมื่อต่ำกว่า (Min) <span className="text-red-500">*</span></span>
                  </label>
                  <div className="relative mt-1">
                    <input 
                      type="number" 
                      min="0" 
                      value={formMinStock} 
                      onChange={(e) => setFormMinStock(e.target.value === '' ? '' : Number(e.target.value))} 
                      placeholder="5" 
                      className="w-full pl-4 pr-12 py-2.5 bg-white border border-amber-300/80 rounded-xl text-amber-700 font-black text-lg text-right focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all" 
                    />
                    <span className="absolute right-3.5 top-3 text-xs font-bold text-amber-500">{formUnit || 'หน่วย'}</span>
                  </div>
                </div>
              </div>

              {/* 4. สถานที่จัดเก็บ */}
              <div className="pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">4. สถานที่จัดเก็บ (ระบุเพื่อให้ค้นหาง่าย)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </span>
                  <input 
                    type="text" 
                    value={formLocation} 
                    onChange={(e) => setFormLocation(e.target.value)} 
                    placeholder="เช่น โรงเก็บ A, โกดังข้างบ้านพัก, ในโรงรถ..." 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all" 
                  />
                </div>
              </div>

            </div>

            <div className="mt-8 flex items-center gap-3">
              <button 
                type="button"
                onClick={() => setShowItemModal(false)} 
                className="w-1/3 py-3.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 bg-slate-50 border border-slate-200/80 text-sm transition-all"
              >
                ยกเลิก
              </button>
              <button 
                type="button"
                onClick={handleSaveItem} 
                disabled={saving} 
                className={`w-2/3 py-3.5 rounded-xl font-black text-white text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                  saving 
                    ? 'bg-slate-300 shadow-none cursor-not-allowed' 
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 shadow-emerald-500/25'
                }`}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span>ยืนยันบันทึกข้อมูล</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 PREMIUM MODAL 2: ตัดยอด เบิกของ / รับเข้า 🌟 */}
      {/* ======================================================= */}
      {showStockModal && selectedItemForStock && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowStockModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center text-base">🚜</span>
                <span>อัปเดตยอดสต็อกหน้างาน</span>
              </h3>
              <button onClick={() => setShowStockModal(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all">✕</button>
            </div>

            {/* ข้อมูลสินค้าปัจจุบัน */}
            <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-500">
                  {getCategoryMeta(selectedItemForStock.category).label}
                </span>
                <h4 className="text-base font-black text-slate-900 mt-1 leading-tight">{selectedItemForStock.name}</h4>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold text-slate-400 uppercase">คงเหลือปัจจุบัน</p>
                <p className="text-xl font-black text-slate-900 leading-none mt-0.5">{selectedItemForStock.stock.toLocaleString()} <span className="text-xs font-bold text-slate-500">{selectedItemForStock.unit}</span></p>
              </div>
            </div>

            <div className="space-y-5">
              
              {/* สวิตช์เลือกประเภทรายการแบบ Premium Segmented */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block text-center">เลือกประเภทรายการทำรายการ</label>
                <div className="grid grid-cols-2 bg-slate-100/80 p-1.5 rounded-2xl gap-1.5 border border-slate-200/60">
                  <button 
                    type="button"
                    onClick={() => setStockActionType('receive')} 
                    className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      stockActionType === 'receive' 
                        ? 'bg-white text-emerald-700 shadow-sm shadow-slate-900/5 ring-1 ring-slate-900/5 scale-[1.02]' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs">➕</span>
                    <span>รับของเข้า (ซื้อเพิ่ม)</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setStockActionType('dispense')} 
                    className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      stockActionType === 'dispense' 
                        ? 'bg-white text-red-600 shadow-sm shadow-slate-900/5 ring-1 ring-slate-900/5 scale-[1.02]' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs">➖</span>
                    <span>เบิกออก (นำไปใช้)</span>
                  </button>
                </div>
              </div>

              {/* ช่องระบุจำนวน */}
              <div className="pt-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block text-center">
                  ระบุจำนวนที่ต้องการ {stockActionType === 'receive' ? 'เพิ่มเข้าสต็อก' : 'เบิกออกใช้งาน'} ({selectedItemForStock.unit})
                </label>
                <div className="relative max-w-[240px] mx-auto">
                  <input 
                    type="number" 
                    min="1" 
                    value={stockAmount} 
                    onChange={(e) => setStockAmount(e.target.value === '' ? '' : Number(e.target.value))} 
                    placeholder="0" 
                    className={`w-full px-4 py-3.5 text-center border-2 rounded-2xl font-black text-3xl outline-none transition-all shadow-inner ${
                      stockActionType === 'receive' 
                        ? 'border-emerald-400 text-emerald-700 bg-emerald-50/30 focus:ring-4 focus:ring-emerald-500/20' 
                        : 'border-red-300 text-red-600 bg-red-50/30 focus:ring-4 focus:ring-red-500/20'
                    }`} 
                    autoFocus 
                  />
                  <span className="absolute right-4 bottom-4 text-slate-400 text-sm font-bold pointer-events-none">{selectedItemForStock.unit}</span>
                </div>

                {/* พรีวิวคำนวณยอดใหม่ */}
                {stockAmount !== '' && Number(stockAmount) > 0 && (
                  <p className="text-center text-xs font-bold mt-3 text-slate-500 animate-in fade-in">
                    💡 ยอดคงเหลือหลังทำรายการจะเป็น: <span className={`text-sm underline ${stockActionType === 'receive' ? 'text-emerald-600 font-black' : 'text-red-600 font-black'}`}>
                      {(stockActionType === 'receive' 
                        ? selectedItemForStock.stock + Number(stockAmount) 
                        : selectedItemForStock.stock - Number(stockAmount)
                      ).toLocaleString()} {selectedItemForStock.unit}
                    </span>
                  </p>
                )}
              </div>

            </div>

            <div className="mt-8 flex items-center gap-3">
              <button 
                type="button"
                onClick={() => setShowStockModal(false)} 
                className="w-1/3 py-3.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 bg-slate-50 border border-slate-200/80 text-sm transition-all"
              >
                ยกเลิก
              </button>
              <button 
                type="button"
                onClick={handleUpdateStockQuantity} 
                disabled={saving} 
                className={`w-2/3 py-3.5 rounded-xl font-black text-white text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                  saving 
                    ? 'bg-slate-300 shadow-none cursor-not-allowed' 
                    : stockActionType === 'receive' 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/25 active:scale-95' 
                    : 'bg-gradient-to-r from-slate-900 to-slate-800 hover:from-black hover:to-slate-900 shadow-slate-900/20 active:scale-95'
                }`}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>กำลังคำนวณ...</span>
                  </>
                ) : (
                  <>
                    <span>💾 ยืนยัน{stockActionType === 'receive' ? 'รับของเข้า' : 'เบิกของออก'}</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 PREMIUM NOTIFICATION POPUP (Toast / Alert) 🌟 */}
      {/* ======================================================= */}
      {popup.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 text-center border border-slate-100">
            {popup.type === 'success' ? (
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                <svg className="w-8 h-8 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                <svg className="w-8 h-8 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
            )}
            
            <h3 className="text-lg font-black text-slate-900 mb-1.5">{popup.type === 'success' ? 'ทำรายการสำเร็จ!' : 'แจ้งเตือน / ข้อผิดพลาด'}</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed whitespace-pre-line font-medium">{popup.message}</p>
            
            <button 
              type="button"
              onClick={() => setPopup({ show: false, type: '', message: '' })} 
              className={`w-full py-3 font-bold rounded-xl text-white shadow-md text-sm transition-all active:scale-95 ${
                popup.type === 'success' 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 shadow-emerald-500/20' 
                  : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 shadow-red-500/20'
              }`}
            >
              ตกลงเข้าใจแล้ว
            </button>
          </div>
        </div>
      )}

      {/* ซ่อน Scrollbar แนวนอนสำหรับปุ่ม Filter */}
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}