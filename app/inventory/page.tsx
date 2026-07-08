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
      setPopup({ show: true, type: 'success', message: `ทำรายการ ${stockActionType === 'receive' ? 'รับของเข้า' : 'เบิกของออก'} เรียบร้อยแล้ว ยอดคงเหลือล่าสุดคือ ${finalAmount} ${selectedItemForStock.unit}` });
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

  if (loading) return <div className="min-h-screen bg-[#FCFBF7] flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#FCFBF7] pb-12 font-sans relative">
      
      {/* 🌟 อัปเกรด Header Bar (Responsive) 🌟 */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button onClick={() => router.push('/')} className="p-2 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors shrink-0">
              <svg className="w-6 h-6 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-stone-800 leading-tight">คลังสินค้า & สต็อกวัตถุดิบ</h1>
              <p className="text-[10px] sm:text-xs text-stone-500 mt-0.5">โมดูล Inventory & Costing Control</p>
            </div>
          </div>
          <button 
            onClick={openAddItemModal}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 sm:py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center transition-all active:scale-95"
          >
            <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            <span>เพิ่มวัตถุดิบใหม่</span>
          </button>
        </div>
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 mt-6 sm:mt-8">
        
        {/* ส่วนสรุปตัวเลข */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-stone-200 shadow-sm flex items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-indigo-600 mr-3 sm:mr-4 shrink-0">
               <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-stone-500 font-bold uppercase">รายการในคลังรวม</p>
              <h3 className="text-xl sm:text-2xl font-black text-stone-800">{items.length} <span className="text-sm">รายการ</span></h3>
            </div>
          </div>
          
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-stone-200 shadow-sm flex items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-rose-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-rose-600 mr-3 sm:mr-4 shrink-0">
               <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-stone-500 font-bold uppercase">วัตถุดิบสต็อกต่ำ / หมด</p>
              <h3 className="text-xl sm:text-2xl font-black text-rose-600">{lowStockCount} <span className="text-sm">รายการ</span></h3>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-stone-200 shadow-sm flex items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-emerald-600 mr-3 sm:mr-4 shrink-0">
               <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-stone-500 font-bold uppercase">สถานะภาพรวม</p>
              <h3 className={`text-sm sm:text-xl font-black ${lowStockCount > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                {lowStockCount > 0 ? 'ควรเตรียมสั่งของเพิ่ม' : 'ของครบพร้อมใช้งาน'}
              </h3>
            </div>
          </div>
        </div>

        {/* ตัวค้นหาและฟิลเตอร์ */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-stone-200 shadow-sm mb-6 sm:mb-8 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="relative flex-grow max-w-md">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input
              type="text"
              placeholder="ค้นหาชื่อปุ๋ย, ตัวยา, สารเคมี..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-[#FCFBF7] border border-stone-200 rounded-xl sm:rounded-2xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm text-sm font-semibold"
            />
          </div>

          <div className="flex overflow-x-auto pb-2 sm:pb-0 gap-2 text-[10px] sm:text-sm font-bold no-scrollbar">
            {[
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'fertilizer', label: '🚜 ปุ๋ยเคมี/อินทรีย์' },
              { id: 'pesticide', label: '🧪 สารเคมี' },
              { id: 'fuel', label: '⛽ เชื้อเพลิง' },
              { id: 'seed', label: '🌱 ท่อนพันธุ์' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl transition-all whitespace-nowrap shrink-0 ${
                  selectedCategory === tab.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>


        {/* ======================================================= */}
        {/* 📱 MOBILE VIEW: แสดงแบบการ์ดสินค้า 📱 */}
        {/* ======================================================= */}
        <div className="block md:hidden space-y-4">
          {filteredItems.length > 0 ? filteredItems.map((item) => {
            const isLowStock = item.stock <= item.min_stock;
            const isOutOfStock = item.stock === 0;

            return (
              <div key={`mob-${item.id}`} className={`p-4 rounded-2xl border bg-white shadow-sm relative ${isOutOfStock ? 'border-red-200 bg-red-50/30' : isLowStock ? 'border-amber-200' : 'border-stone-200'}`}>
                
                <div className="flex justify-between items-start mb-3 border-b border-stone-100 pb-3">
                  <div className="pr-4">
                    <h3 className="font-black text-stone-800 text-base leading-tight">{item.name}</h3>
                    <p className="text-[10px] font-bold text-stone-400 mt-1">
                      {item.category === 'fertilizer' && 'ปุ๋ยบำรุง'}
                      {item.category === 'pesticide' && 'ยา/สารเคมี'}
                      {item.category === 'fuel' && 'น้ำมันเชื้อเพลิง'}
                      {item.category === 'seed' && 'ท่อนพันธุ์อ้อย'}
                      <span className="mx-2">•</span> 📍 {item.location}
                    </p>
                  </div>
                  <button onClick={() => openEditItemModal(item)} className="p-1.5 bg-stone-100 text-stone-500 rounded-lg hover:bg-stone-200 shrink-0">
                    ⚙️
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">ยอดคงเหลือ</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-2xl font-black ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-indigo-700'}`}>
                        {item.stock.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-stone-500">{item.unit}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => openStockAdjustmentModal(item)}
                    className={`flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border-2 transition-all active:scale-95 ${
                      isLowStock 
                        ? 'bg-red-50 border-red-200 text-red-600 shadow-sm' 
                        : 'bg-indigo-50 border-indigo-100 text-indigo-700 shadow-sm'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    <span className="text-xs font-black">ปรับยอด</span>
                  </button>
                </div>

                {isLowStock && (
                  <div className={`mt-3 px-3 py-1.5 rounded-lg text-[10px] font-bold text-center ${isOutOfStock ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-amber-100 text-amber-800'}`}>
                    {isOutOfStock ? '✖ สินค้าหมดคลัง กรุณาสั่งซื้อด่วน' : `⚠️ สต็อกต่ำกว่าเกณฑ์ (Min: ${item.min_stock})`}
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="text-center py-12 bg-white rounded-2xl border-2 border-stone-200 border-dashed">
              <p className="text-stone-400 font-bold text-sm">ไม่พบรายการวัตถุดิบชิ้นนี้ในระบบ</p>
            </div>
          )}
        </div>


        {/* ======================================================= */}
        {/* 💻 DESKTOP VIEW: ตารางสต็อกสินค้า 💻 */}
        {/* ======================================================= */}
        <div className="hidden md:block bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-4 px-6">ชื่อวัตถุดิบ/สินค้าในไร่</th>
                  <th className="py-4 px-6">หมวดหมู่</th>
                  <th className="py-4 px-6">คงเหลือในคลัง (กดเพื่อปรับยอด)</th>
                  <th className="py-4 px-6">จุดเตือนสต็อกต่ำ</th>
                  <th className="py-4 px-6">สถานที่จัดเก็บ</th>
                  <th className="py-4 px-6 text-center">สถานะ</th>
                  <th className="py-4 px-6 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm font-medium text-stone-700">
                {filteredItems.length > 0 ? filteredItems.map((item) => {
                  let statusBadge = <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">สินค้าเพียงพอ</span>;
                  if (item.stock === 0) {
                    statusBadge = <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold animate-pulse">✖ ของหมดคลัง</span>;
                  } else if (item.stock <= item.min_stock) {
                    statusBadge = <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold">⚠️ สต็อกต่ำ</span>;
                  }

                  const isLowStock = item.stock <= item.min_stock;

                  return (
                    <tr key={item.id} className="hover:bg-stone-50/40 transition-colors">
                      <td className="py-4 px-6 font-bold text-stone-800">{item.name}</td>
                      <td className="py-4 px-6 text-stone-500">
                        {item.category === 'fertilizer' && 'ปุ๋ยบำรุง'}
                        {item.category === 'pesticide' && 'ยา/สารเคมี'}
                        {item.category === 'fuel' && 'น้ำมันเชื้อเพลิง'}
                        {item.category === 'seed' && 'ท่อนพันธุ์อ้อย'}
                      </td>

                      <td className="py-3 px-6">
                        <button
                          onClick={() => openStockAdjustmentModal(item)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all active:scale-95 group w-fit ${
                            isLowStock 
                              ? 'bg-red-50 border-red-200 hover:bg-red-100 hover:border-red-300' 
                              : 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100 hover:border-indigo-300'
                          }`}
                          title="คลิกเพื่อเบิก หรือ รับของเข้า"
                        >
                          <span className={`font-black text-lg ${isLowStock ? 'text-red-600' : 'text-indigo-700'}`}>
                            {item.stock.toLocaleString()}
                          </span>
                          <span className={`text-xs font-bold ${isLowStock ? 'text-red-400' : 'text-indigo-400'}`}>
                            {item.unit}
                          </span>
                          
                          <div className={`ml-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black text-white shadow-sm transition-opacity opacity-80 group-hover:opacity-100 ${isLowStock ? 'bg-red-500' : 'bg-indigo-500'}`}>
                             <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                             ปรับยอด
                          </div>
                        </button>
                      </td>

                      <td className="py-4 px-6 text-stone-400">{item.min_stock.toLocaleString()} {item.unit}</td>
                      <td className="py-4 px-6 text-stone-600">{item.location}</td>
                      <td className="py-4 px-6 text-center">{statusBadge}</td>
                      <td className="py-4 px-6 text-center">
                        <button onClick={() => openEditItemModal(item)} className="text-xs font-bold text-stone-500 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-stone-200 hover:border-indigo-200 transition-colors">
                          ⚙️ ตั้งค่า
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={7} className="py-12 text-center text-stone-400 font-bold">ไม่พบรายการคลังวัตถุดิบชิ้นนี้ในระบบ</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ======================================================= */}
      {/* 🌟 CUSTOM MODAL 1: เพิ่ม / แก้ไขข้อมูลสินค้า (Responsive) 🌟 */}
      {/* ======================================================= */}
      {showItemModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowItemModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-black text-stone-800 flex items-center gap-2">
                <span>📦</span> {editingItem ? `ตั้งค่า ${editingItem.name}` : 'ลงทะเบียนสินค้าใหม่'}
              </h3>
              <button onClick={() => setShowItemModal(false)} className="text-stone-400 hover:text-stone-600 bg-stone-100 w-8 h-8 rounded-full flex items-center justify-center font-bold">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase mb-1.5 block">ชื่อสินค้า (ระบุสูตรหรือยี่ห้อ)</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="เช่น ปุ๋ยตรากระต่าย, ดีเซล..." className="w-full px-4 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-1/2">
                  <label className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase mb-1.5 block">หมวดหมู่สินค้า</label>
                  <select value={formCategory} onChange={(e: any) => setFormCategory(e.target.value)} className="w-full px-3 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm">
                    <option value="fertilizer">ปุ๋ยบำรุงอ้อย</option>
                    <option value="pesticide">ยาคุมหญ้า / เคมี</option>
                    <option value="fuel">น้ำมันเชื้อเพลิง</option>
                    <option value="seed">ท่อนพันธุ์อ้อย</option>
                  </select>
                </div>
                <div className="w-full sm:w-1/2">
                  <label className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase mb-1.5 block">หน่วยนับ</label>
                  <input type="text" value={formUnit} onChange={(e) => setFormUnit(e.target.value)} placeholder="กระสอบ / ลิตร / กล่อง" className="w-full px-4 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none text-sm" />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-1/2">
                  <label className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase mb-1.5 block text-indigo-600">จำนวนตั้งต้น / คงเหลือ</label>
                  <input type="number" min="0" value={formStock} onChange={(e) => setFormStock(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className="w-full px-4 py-2.5 sm:py-3 bg-indigo-50/30 border border-indigo-200 rounded-xl text-indigo-700 font-black focus:ring-2 focus:ring-indigo-500 outline-none text-base text-left sm:text-right" />
                </div>
                <div className="w-full sm:w-1/2">
                  <label className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase mb-1.5 block text-red-500">เตือนสต็อกต่ำกว่า (Min)</label>
                  <input type="number" min="0" value={formMinStock} onChange={(e) => setFormMinStock(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className="w-full px-4 py-2.5 sm:py-3 bg-white border border-stone-300 rounded-xl text-red-600 font-black focus:ring-2 focus:ring-indigo-500 outline-none text-base text-left sm:text-right" />
                </div>
              </div>

              <div>
                <label className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase mb-1.5 block">สถานที่จัดเก็บ</label>
                <input type="text" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="เช่น โรงเก็บ A, โรงรถ" className="w-full px-4 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 outline-none text-sm" />
              </div>
            </div>

            <button onClick={handleSaveItem} disabled={saving} className={`w-full mt-6 sm:mt-8 py-3.5 sm:py-4 rounded-xl font-black text-white text-base sm:text-lg shadow-lg transition-all ${saving ? 'bg-stone-300' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-indigo-600/20'}`}>
              {saving ? 'กำลังบันทึก...' : '💾 ยืนยันบันทึกข้อมูลสินค้า'}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 CUSTOM MODAL 2: ตัดยอด เบิกของ / รับเข้า 🌟 */}
      {/* ======================================================= */}
      {showStockModal && selectedItemForStock && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowStockModal(false)}></div>
          <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base sm:text-lg font-black text-stone-800">🚜 อัปเดตยอดสต็อก</h3>
              <button onClick={() => setShowStockModal(false)} className="text-stone-400 hover:text-stone-600 bg-stone-100 w-7 h-7 rounded-full flex items-center justify-center font-bold">✕</button>
            </div>

            <div className="bg-indigo-50 p-4 rounded-2xl mb-5 border border-indigo-100 text-center">
              <h4 className="text-sm sm:text-base font-black text-indigo-900 leading-tight">{selectedItemForStock.name}</h4>
              <p className="text-xs text-indigo-700 font-bold mt-1.5">คงเหลือเดิม: {selectedItemForStock.stock.toLocaleString()} {selectedItemForStock.unit}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase mb-2 block text-center">ต้องการทำรายการใด?</label>
                <div className="grid grid-cols-2 bg-stone-100 p-1 rounded-xl gap-1">
                  <button onClick={() => setStockActionType('receive')} className={`py-2.5 rounded-lg text-[10px] sm:text-xs font-black transition-all ${stockActionType === 'receive' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500 hover:bg-stone-200'}`}>➕ เติมของเข้า</button>
                  <button onClick={() => setStockActionType('dispense')} className={`py-2.5 rounded-lg text-[10px] sm:text-xs font-black transition-all ${stockActionType === 'dispense' ? 'bg-white text-red-600 shadow-sm' : 'text-stone-500 hover:bg-stone-200'}`}>➖ เบิกออกใช้งาน</button>
                </div>
              </div>

              <div>
                <label className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase mb-1.5 block text-center">ระบุจำนวน ({selectedItemForStock.unit})</label>
                <div className="relative max-w-[200px] mx-auto">
                  <input type="number" min="1" value={stockAmount} onChange={(e) => setStockAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className={`w-full px-4 py-2.5 sm:py-3 text-center border-2 rounded-xl sm:rounded-2xl font-black text-xl sm:text-2xl outline-none focus:ring-2 focus:ring-indigo-500 ${stockActionType === 'receive' ? 'border-emerald-300 text-emerald-700 bg-emerald-50/20' : 'border-red-300 text-red-600 bg-red-50/20'}`} autoFocus />
                  <span className="absolute right-4 bottom-3 sm:bottom-3.5 text-stone-400 text-xs font-bold">{selectedItemForStock.unit}</span>
                </div>
              </div>
            </div>

            <button onClick={handleUpdateStockQuantity} disabled={saving} className={`w-full mt-6 sm:mt-8 py-3.5 sm:py-4 rounded-xl font-black text-white text-sm sm:text-base shadow-lg transition-all ${saving ? 'bg-stone-300' : stockActionType === 'receive' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'}`}>
              {saving ? '⏳ กำลังคำนวณตัดยอด...' : `💾 ยืนยันบันทึกยอดรายการ`}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 🌟 CUSTOM NOTIFICATION POPUP 🌟 */}
      {/* ======================================================= */}
      {popup.show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-xs animate-in fade-in" onClick={() => setPopup({ show: false, type: '', message: '' })}></div>
          <div className="bg-white w-full max-w-sm rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 text-center border border-stone-100">
            {popup.type === 'success' ? (
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              </div>
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
            )}
            <h3 className="text-base sm:text-lg font-black text-stone-800 mb-2">{popup.type === 'success' ? 'ทำรายการสำเร็จ!' : 'เกิดข้อผิดพลาด'}</h3>
            <p className="text-xs sm:text-sm text-stone-500 mb-6 leading-relaxed whitespace-pre-line">{popup.message}</p>
            <button onClick={() => setPopup({ show: false, type: '', message: '' })} className={`w-full py-2.5 sm:py-3 font-bold rounded-xl text-white shadow-md text-sm ${popup.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}>
              ตกลง
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