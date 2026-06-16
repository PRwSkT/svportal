'use client';

import { createClient } from '@/lib/supabase/client';
import { Product } from '@/types';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, Trash2, Edit2, ArchiveX, Search } from 'lucide-react';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');

  const supabase = createClient();

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*').eq('is_active', true).order('name');
    if (!error && data) setProducts(data);
    else if (error) toast.error('โหลดข้อมูลล้มเหลว', { description: error.message });
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const loadingToast = toast.loading('กำลังเพิ่มสินค้า...');
    const { error } = await supabase.from('products').insert({
      name,
      price: parseFloat(price),
      stock_qty: parseInt(stock, 10),
      barcode: barcode || null,
      category: category || null,
    });
    if (!error) {
      toast.success('เพิ่มสินค้าเรียบร้อยแล้ว', { id: loadingToast });
      setName(''); setPrice(''); setStock(''); setBarcode(''); setCategory('');
      fetchProducts();
    } else {
      toast.error('ไม่สามารถเพิ่มสินค้าได้', { id: loadingToast, description: error.message });
    }
  }

  async function handleSoftDelete(id: string) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบสินค้านี้?')) return;
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (!error) {
      toast.success('ลบสินค้าเรียบร้อยแล้ว');
      fetchProducts();
    } else {
      toast.error('ไม่สามารถลบสินค้าได้', { description: error.message });
    }
  }

  async function handleUpdate(id: string, field: 'price' | 'stock_qty', value: string) {
    const numValue = field === 'price' ? parseFloat(value) : parseInt(value, 10);
    if (isNaN(numValue)) return;
    
    // Don't update if empty or invalid
    const { error } = await supabase.from('products').update({ [field]: numValue }).eq('id', id);
    if (!error) {
      toast.success(`อัปเดต${field === 'price' ? 'ราคา' : 'สต็อก'}เรียบร้อยแล้ว`);
      fetchProducts();
    } else {
      toast.error('อัปเดตล้มเหลว', { description: error.message });
    }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.barcode?.includes(searchQuery) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 max-w-7xl mx-auto space-y-8 font-sans"
    >
      <div className="flex justify-between items-center bg-surface/80 backdrop-blur-xl p-6 rounded-3xl shadow-lg border border-white/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary mb-1">จัดการสินค้า</h1>
            <p className="text-foreground/60 font-medium">เพิ่ม ลด และแก้ไขข้อมูลสินค้าในร้านสหกรณ์</p>
          </div>
        </div>
      </div>

      <div className="bg-surface/80 backdrop-blur-xl rounded-3xl shadow-lg border border-white/20 p-6">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" /> เพิ่มสินค้าใหม่
        </h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-foreground/70 mb-1">ชื่อสินค้า *</label>
            <input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-background border border-foreground/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" placeholder="เช่น น้ำดื่ม, ปากกา" />
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground/70 mb-1">ราคา (บาท) *</label>
            <input required type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-background border border-foreground/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground/70 mb-1">จำนวน *</label>
            <input required type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} className="w-full bg-background border border-foreground/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground/70 mb-1">บาร์โค้ด</label>
            <input value={barcode} onChange={e => setBarcode(e.target.value)} className="w-full bg-background border border-foreground/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" placeholder="สแกนหรือพิมพ์" />
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground/70 mb-1">หมวดหมู่</label>
            <input value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-background border border-foreground/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" placeholder="เช่น เครื่องเขียน" />
          </div>
          <div className="md:col-span-6 flex justify-end mt-2">
            <button type="submit" className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20 active:scale-95">
              <Plus className="w-4 h-4" /> เพิ่มเข้าระบบ
            </button>
          </div>
        </form>
      </div>

      <div className="bg-surface/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden min-h-[400px]">
        <div className="p-4 border-b border-foreground/5 flex items-center gap-4 bg-foreground/[0.02]">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <input 
              type="text" 
              placeholder="ค้นหาสินค้า (ชื่อ, บาร์โค้ด, หมวดหมู่)..." 
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-foreground/10 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="flex-1 h-12 bg-foreground/5 rounded-xl"></div>
                <div className="w-24 h-12 bg-foreground/5 rounded-xl"></div>
                <div className="w-24 h-12 bg-foreground/5 rounded-xl"></div>
                <div className="w-24 h-12 bg-foreground/5 rounded-xl"></div>
                <div className="w-16 h-12 bg-foreground/5 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-foreground/40 space-y-4">
            <ArchiveX className="w-16 h-16 opacity-20" />
            <p className="text-lg font-medium">ไม่พบสินค้าในระบบ</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-foreground/[0.02] border-b border-foreground/5">
                <tr>
                  <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider">ชื่อสินค้า</th>
                  <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider">หมวดหมู่</th>
                  <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider">บาร์โค้ด</th>
                  <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider text-right">ราคา (บาท)</th>
                  <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider text-right">สต็อกคงเหลือ</th>
                  <th className="p-5 font-bold text-foreground/50 text-xs uppercase tracking-wider text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                <AnimatePresence>
                  {filteredProducts.map(p => (
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      layout
                      key={p.id} 
                      className="hover:bg-foreground/[0.02] transition-colors"
                    >
                      <td className="p-5 font-bold text-primary">{p.name}</td>
                      <td className="p-5 text-sm font-medium text-foreground/70">
                        {p.category ? (
                          <span className="px-2.5 py-1 bg-foreground/5 rounded-full">{p.category}</span>
                        ) : '-'}
                      </td>
                      <td className="p-5 text-sm font-mono text-foreground/60">{p.barcode || '-'}</td>
                      <td className="p-5 text-right">
                        <div className="flex items-center justify-end gap-2 group">
                          <Edit2 className="w-3 h-3 text-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <input 
                            type="number" 
                            step="0.01" 
                            defaultValue={p.price} 
                            onBlur={e => {
                              if (parseFloat(e.target.value) !== p.price) {
                                handleUpdate(p.id, 'price', e.target.value);
                              }
                            }} 
                            className="w-24 bg-transparent border-b border-transparent hover:border-foreground/20 focus:border-primary focus:bg-background px-2 py-1 text-right font-bold text-foreground outline-none transition-all rounded-md" 
                          />
                        </div>
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex items-center justify-end gap-2 group">
                          <Edit2 className="w-3 h-3 text-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <input 
                            type="number" 
                            defaultValue={p.stock_qty} 
                            onBlur={e => {
                              if (parseInt(e.target.value, 10) !== p.stock_qty) {
                                handleUpdate(p.id, 'stock_qty', e.target.value);
                              }
                            }} 
                            className={`w-24 bg-transparent border-b border-transparent hover:border-foreground/20 focus:border-primary focus:bg-background px-2 py-1 text-right font-bold outline-none transition-all rounded-md ${p.stock_qty < 10 ? 'text-red-500' : 'text-foreground'}`} 
                          />
                        </div>
                      </td>
                      <td className="p-5 text-center">
                        <button 
                          onClick={() => handleSoftDelete(p.id)} 
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center justify-center"
                          title="ลบสินค้า"
                        >
                          <Trash2 className="w-5 h-5" />
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
