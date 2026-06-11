'use client';

import { createClient } from '@/lib/supabase/client';
import { Product } from '@/types';
import { useEffect, useState } from 'react';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('products').insert({
      name,
      price: parseFloat(price),
      stock_qty: parseInt(stock, 10),
      barcode: barcode || null,
      category: category || null,
    });
    if (!error) {
      setName(''); setPrice(''); setStock(''); setBarcode(''); setCategory('');
      fetchProducts();
    } else {
      alert('Error adding product: ' + error.message);
    }
  }

  async function handleSoftDelete(id: string) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (!error) fetchProducts();
  }

  async function handleUpdate(id: string, field: 'price' | 'stock_qty', value: string) {
    const numValue = field === 'price' ? parseFloat(value) : parseInt(value, 10);
    if (isNaN(numValue)) return;
    const { error } = await supabase.from('products').update({ [field]: numValue }).eq('id', id);
    if (!error) fetchProducts();
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">จัดการสินค้า (Products)</h1>
      
      <form onSubmit={handleAdd} className="mb-8 p-4 bg-gray-50 border rounded-lg flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm">ชื่อสินค้า</label>
          <input required value={name} onChange={e => setName(e.target.value)} className="border p-2 rounded" />
        </div>
        <div>
          <label className="block text-sm">ราคา (บาท)</label>
          <input required type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} className="border p-2 rounded w-24" />
        </div>
        <div>
          <label className="block text-sm">จำนวน</label>
          <input required type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} className="border p-2 rounded w-24" />
        </div>
        <div>
          <label className="block text-sm">บาร์โค้ด</label>
          <input value={barcode} onChange={e => setBarcode(e.target.value)} className="border p-2 rounded" />
        </div>
        <div>
          <label className="block text-sm">หมวดหมู่</label>
          <input value={category} onChange={e => setCategory(e.target.value)} className="border p-2 rounded" />
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700">เพิ่มสินค้า</button>
      </form>

      {loading ? <p>กำลังโหลด...</p> : (
        <table className="w-full border-collapse border">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">ชื่อสินค้า</th>
              <th className="border p-2 text-left">หมวดหมู่</th>
              <th className="border p-2 text-left">บาร์โค้ด</th>
              <th className="border p-2 text-right">ราคา</th>
              <th className="border p-2 text-right">สต็อก</th>
              <th className="border p-2 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td className="border p-2">{p.name}</td>
                <td className="border p-2">{p.category}</td>
                <td className="border p-2">{p.barcode}</td>
                <td className="border p-2 text-right">
                  <input type="number" step="0.01" defaultValue={p.price} onBlur={e => handleUpdate(p.id, 'price', e.target.value)} className="w-20 border text-right p-1" />
                </td>
                <td className="border p-2 text-right">
                  <input type="number" defaultValue={p.stock_qty} onBlur={e => handleUpdate(p.id, 'stock_qty', e.target.value)} className="w-20 border text-right p-1" />
                </td>
                <td className="border p-2 text-center">
                  <button onClick={() => handleSoftDelete(p.id)} className="text-red-600 hover:text-red-800">ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
