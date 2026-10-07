'use client';

import { Product } from '@/types';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, Trash2, Edit2, ArchiveX, Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AdminProductsPage() {
  const { dict, isThai, formatCurrency } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/products');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setProducts(data);
    } catch (error: any) {
      toast.error(isThai ? 'โหลดข้อมูลล้มเหลว' : 'Failed to load products', { description: error.message });
    }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const loadingToast = toast.loading(isThai ? 'กำลังเพิ่มสินค้า...' : 'Adding product...');
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          price: parseFloat(price),
          stock_qty: parseInt(stock, 10),
          barcode: barcode || null,
          category: category || null,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add product');
      }
      toast.success(isThai ? 'เพิ่มสินค้าเรียบร้อยแล้ว' : 'Product added successfully', { id: loadingToast });
      setName(''); setPrice(''); setStock(''); setBarcode(''); setCategory('');
      fetchProducts();
    } catch (error: any) {
      toast.error(isThai ? 'ไม่สามารถเพิ่มสินค้าได้' : 'Failed to add product', { id: loadingToast, description: error.message });
    }
  }

  async function handleSoftDelete(id: string) {
    if (!confirm(isThai ? 'คุณแน่ใจหรือไม่ว่าต้องการลบสินค้านี้?' : 'Are you sure you want to remove this product?')) return;
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: false }),
      });
      if (!res.ok) throw new Error('Failed to delete product');
      toast.success(isThai ? 'ลบสินค้าเรียบร้อยแล้ว' : 'Product removed successfully');
      fetchProducts();
    } catch (error: any) {
      toast.error(isThai ? 'ไม่สามารถลบสินค้าได้' : 'Failed to delete product', { description: error.message });
    }
  }

  async function handleUpdate(id: string, field: 'price' | 'stock_qty', value: string) {
    const numValue = field === 'price' ? parseFloat(value) : parseInt(value, 10);
    if (isNaN(numValue)) return;
    
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: numValue }),
      });
      if (!res.ok) throw new Error('Failed to update product');
      toast.success(isThai ? `อัปเดต${field === 'price' ? 'ราคา' : 'สต็อก'}เรียบร้อยแล้ว` : `Updated ${field === 'price' ? 'price' : 'stock'} successfully`);
      fetchProducts();
    } catch (error: any) {
      toast.error(isThai ? 'อัปเดตล้มเหลว' : 'Update failed', { description: error.message });
    }
  }

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  const lowStockCount = products.filter(p => p.stock_qty < 10).length;
  const totalStockValue = products.reduce((sum, p) => sum + (p.price * p.stock_qty), 0);

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.barcode?.includes(searchQuery) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'low_stock') return p.stock_qty < 10;
    return p.category === selectedCategory;
  });

  async function handleDeltaStock(id: string, currentStock: number, delta: number) {
    const newStock = Math.max(0, currentStock + delta);
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stock_qty: newStock }),
      });
      if (!res.ok) throw new Error('Failed to update stock');
      setProducts(prev => prev.map(p => p.id === id ? { ...p, stock_qty: newStock } : p));
      toast.success(isThai ? `ปรับสต็อกเป็น ${newStock} ชิ้น` : `Updated stock to ${newStock} items`);
    } catch (error: any) {
      toast.error(isThai ? 'อัปเดตสต็อกล้มเหลว' : 'Failed to update stock', { description: error.message });
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-sans"
    >
      {/* Official SV Portal Hero Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {dict.common.officialBadge}
              </span>
              <span className="text-xs text-slate-500 font-medium">{dict.shop.title}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {dict.products.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {dict.products.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddForm(prev => !prev)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm bg-[#7B1C3E] text-white hover:bg-[#631430] active:scale-95 transition-all shadow-md shadow-[#7B1C3E]/20"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddForm ? dict.products.hideForm : dict.products.addProduct}</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/60">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{dict.products.totalProducts}</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{products.length} <span className="text-sm font-semibold text-slate-400">{dict.dashboard.items}</span></p>
          </div>
          <div className={`p-4 rounded-2xl border ${lowStockCount > 0 ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${lowStockCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>
              {dict.products.lowStockAlert}
            </p>
            <p className={`text-2xl font-black mt-1 ${lowStockCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
              {lowStockCount} <span className="text-sm font-semibold opacity-70">{dict.dashboard.items}</span>
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{dict.products.stockValue}</p>
            <p className="text-2xl font-black text-[#7B1C3E] dark:text-pink-400 mt-1">
              {formatCurrency(totalStockValue)}
            </p>
          </div>
        </div>
      </div>

      {/* Add Product Collapsible Card */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#7B1C3E]" /> {dict.products.addProduct}
              </h2>
              <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{dict.products.productName} *</label>
                  <input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[#7B1C3E]/20 focus:border-[#7B1C3E] transition-all text-sm outline-none text-slate-900 dark:text-white" placeholder={isThai ? 'เช่น น้ำดื่ม, ปากกาน้ำเงิน' : 'e.g. Drinking Water, Notebook'} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{dict.products.price} *</label>
                  <input required type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[#7B1C3E]/20 focus:border-[#7B1C3E] transition-all text-sm outline-none text-slate-900 dark:text-white" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{dict.products.stock} *</label>
                  <input required type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[#7B1C3E]/20 focus:border-[#7B1C3E] transition-all text-sm outline-none text-slate-900 dark:text-white" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{dict.products.barcode}</label>
                  <input value={barcode} onChange={e => setBarcode(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[#7B1C3E]/20 focus:border-[#7B1C3E] transition-all text-sm outline-none font-mono text-slate-900 dark:text-white" placeholder={isThai ? 'สแกนหรือพิมพ์' : 'Scan or type'} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{dict.products.category}</label>
                  <input value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[#7B1C3E]/20 focus:border-[#7B1C3E] transition-all text-sm outline-none text-slate-900 dark:text-white" placeholder={isThai ? 'เช่น เครื่องดื่ม, เครื่องเขียน' : 'e.g. Beverages, Stationery'} />
                </div>
                <div className="md:col-span-6 flex justify-end gap-3 mt-2">
                  <button type="button" onClick={() => setShowAddForm(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    {dict.common.cancel}
                  </button>
                  <button type="submit" className="flex items-center gap-2 bg-[#7B1C3E] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#631430] transition-all shadow-md shadow-[#7B1C3E]/20 active:scale-95 text-sm">
                    <Plus className="w-4 h-4" /> {dict.products.saveProduct}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden min-h-[400px]">
        {/* Search & Category Filter Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder={isThai ? 'ค้นหาสินค้า (ชื่อ, บาร์โค้ด, หมวดหมู่)...' : 'Search products (name, barcode, category)...'} 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#7B1C3E] focus:ring-2 focus:ring-[#7B1C3E]/20 text-sm transition-all text-slate-900 dark:text-white"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="text-xs font-bold text-slate-500">
              {isThai ? `พบ ${filteredProducts.length} จาก ${products.length} รายการ` : `Found ${filteredProducts.length} of ${products.length} items`}
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-[#7B1C3E] text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {dict.common.all} ({products.length})
            </button>
            {lowStockCount > 0 && (
              <button
                onClick={() => setSelectedCategory('low_stock')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === 'low_stock'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100'
                }`}
              >
                {isThai ? 'ใกล้หมด' : 'Low Stock'} ({lowStockCount})
              </button>
            )}
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-[#7B1C3E] text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {cat} ({products.filter(p => p.category === cat).length})
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="flex-1 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                <div className="w-24 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                <div className="w-24 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                <div className="w-24 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                <div className="w-16 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-slate-400 space-y-3">
            <ArchiveX className="w-14 h-14 opacity-30" />
            <p className="text-base font-semibold">{dict.shop.notFound}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-4 px-5 font-bold text-slate-500 text-xs uppercase tracking-wider">{dict.products.productName}</th>
                  <th className="py-4 px-5 font-bold text-slate-500 text-xs uppercase tracking-wider">{dict.products.category}</th>
                  <th className="py-4 px-5 font-bold text-slate-500 text-xs uppercase tracking-wider">{dict.products.barcode}</th>
                  <th className="py-4 px-5 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">{dict.products.price}</th>
                  <th className="py-4 px-5 font-bold text-slate-500 text-xs uppercase tracking-wider text-center">{dict.products.stock}</th>
                  <th className="py-4 px-5 font-bold text-slate-500 text-xs uppercase tracking-wider text-center">{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                <AnimatePresence>
                  {filteredProducts.map(p => (
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      layout
                      key={p.id} 
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-4 px-5 font-bold text-slate-900 dark:text-white">
                        {p.name}
                        {p.stock_qty < 10 && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                            {isThai ? 'ใกล้หมด' : 'Low Stock'}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-sm font-medium text-slate-600 dark:text-slate-300">
                        {p.category ? (
                          <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">{p.category}</span>
                        ) : '-'}
                      </td>
                      <td className="py-4 px-5 text-sm font-mono text-slate-500">{p.barcode || '-'}</td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5 group">
                          <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <input 
                            type="number" 
                            step="0.01" 
                            defaultValue={p.price} 
                            onBlur={e => {
                              if (parseFloat(e.target.value) !== p.price) {
                                handleUpdate(p.id, 'price', e.target.value);
                              }
                            }} 
                            className="w-24 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#7B1C3E] focus:bg-slate-50 dark:focus:bg-slate-800 px-2 py-1 text-right font-bold text-slate-900 dark:text-white outline-none transition-all rounded-md" 
                          />
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                          <button
                            onClick={() => handleDeltaStock(p.id, p.stock_qty, -1)}
                            disabled={p.stock_qty <= 0}
                            className="w-7 h-7 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-colors flex items-center justify-center font-bold"
                            title={isThai ? 'ลด 1 ชิ้น' : 'Decrease 1'}
                          >
                            -
                          </button>
                          <input 
                            type="number" 
                            defaultValue={p.stock_qty} 
                            onBlur={e => {
                              if (parseInt(e.target.value, 10) !== p.stock_qty) {
                                handleUpdate(p.id, 'stock_qty', e.target.value);
                              }
                            }} 
                            className={`w-14 bg-transparent text-center font-black outline-none ${p.stock_qty < 10 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`} 
                          />
                          <button
                            onClick={() => handleDeltaStock(p.id, p.stock_qty, 1)}
                            className="w-7 h-7 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center font-bold"
                            title={isThai ? 'เพิ่ม 1 ชิ้น' : 'Increase 1'}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <button 
                          onClick={() => handleSoftDelete(p.id)} 
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors inline-flex items-center justify-center"
                          title={dict.common.delete}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
