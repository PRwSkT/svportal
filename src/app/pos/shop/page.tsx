'use client';

import { useState, useEffect, useRef } from 'react';
import { Product, CartItem, ShopTransaction } from '@/types';
import { searchProducts, getProductByBarcode, createShopTransaction } from '@/lib/supabase/shop';

export default function POSShopPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet'>('cash');
  const [studentId, setStudentId] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  
  const [successSlip, setSuccessSlip] = useState<ShopTransaction | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    barcodeInputRef.current?.focus();
    
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_qty) return prev;
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.product.price }
            : item
        );
      }
      return [...prev, { product, quantity: 1, subtotal: product.price }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (!existing) return prev;
      if (existing.quantity > 1) {
        return prev.map(item =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1, subtotal: (item.quantity - 1) * item.product.price }
            : item
        );
      }
      return prev.filter(item => item.product.id !== productId);
    });
  };

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!val.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const exactMatch = await getProductByBarcode(val);
        if (exactMatch && exactMatch.stock_qty > 0) {
          addToCart(exactMatch);
          setSearchQuery('');
          setSearchResults([]);
          setIsSearching(false);
          return;
        }

        const results = await searchProducts(val);
        setSearchResults(results);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchResults.length === 1 && searchResults[0].stock_qty > 0) {
        addToCart(searchResults[0]);
        setSearchQuery('');
        setSearchResults([]);
      }
    }
  };

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    setCheckoutError(null);
    try {
      const tx = await createShopTransaction(cart, paymentMethod, studentId || null);
      setSuccessSlip(tx);
      setCart([]);
      setShowCheckout(false);
      setStudentId('');
      setPaymentMethod('cash');
    } catch (err: unknown) {
      const error = err as Error;
      setCheckoutError(error.message || 'เกิดข้อผิดพลาดในการชำระเงิน');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

  if (successSlip) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center print:bg-white print:p-0">
        <div className="w-full max-w-sm border p-6 rounded shadow print:shadow-none print:border-none print:w-full">
          <h2 className="text-2xl font-bold text-center mb-4">ใบเสร็จรับเงิน</h2>
          <p className="text-sm text-center mb-6">
            รหัสอ้างอิง: {successSlip.id.slice(-8).toUpperCase()}<br/>
            {new Date(successSlip.created_at).toLocaleString('th-TH')}
          </p>
          
          <table className="w-full mb-4 text-sm">
            <tbody>
              {successSlip.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-1">{item.product.name} x{item.quantity}</td>
                  <td className="text-right py-1">฿{item.subtotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t pt-4 font-bold flex justify-between text-lg mb-2">
            <span>ยอดสุทธิ</span>
            <span>฿{successSlip.total_amount.toFixed(2)}</span>
          </div>
          <p className="text-sm text-gray-600 flex justify-between">
            <span>การชำระเงิน</span>
            <span>{successSlip.payment_method === 'wallet' ? 'Wallet บัตรนักเรียน' : 'เงินสด'}</span>
          </p>

          <div className="mt-8 flex gap-4 print:hidden">
            <button onClick={() => window.print()} className="flex-1 bg-gray-200 py-3 rounded font-semibold text-lg">พิมพ์สลิป</button>
            <button 
              onClick={() => { 
                setSuccessSlip(null); 
                setTimeout(() => barcodeInputRef.current?.focus(), 300); 
              }} 
              className="flex-1 bg-blue-600 text-white py-3 rounded font-semibold text-lg"
            >
              ปิด
            </button>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * { visibility: hidden; }
            .print\\:bg-white, .print\\:bg-white * { visibility: visible; }
            .print\\:hidden { display: none !important; }
          }
        `}} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden font-sans">
      {isOffline && (
        <div className="bg-orange-500 text-white text-center py-2 font-bold z-50 text-lg shadow">
          ออฟไลน์ — ข้อมูลจะซิงค์เมื่อเชื่อมต่อใหม่
        </div>
      )}
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Cart */}
        <div className="w-[60%] bg-white border-r flex flex-col shadow-lg z-10">
          <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">ตะกร้าสินค้า ({cart.reduce((s, i) => s + i.quantity, 0)} ชิ้น)</h2>
            <button 
              onClick={() => setCart([])} 
              disabled={cart.length === 0}
              className="text-red-500 hover:text-red-700 font-semibold text-lg px-4 py-2 disabled:opacity-50"
            >
              ล้างตะกร้า
            </button>
          </div>
          
          <div className="flex-1 overflow-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-50">
                <svg className="w-24 h-24 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                <p className="text-gray-500 text-xl font-medium">ยังไม่มีสินค้าในตะกร้า</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product.id} className="flex justify-between items-center border-b border-gray-100 pb-4">
                  <div className="flex-1 pr-4">
                    <p className="font-semibold text-xl text-gray-800 truncate">{item.product.name}</p>
                    <p className="text-gray-500 text-lg">฿{item.product.price.toFixed(2)} / ชิ้น</p>
                  </div>
                  <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-xl">
                    <button onClick={() => removeFromCart(item.product.id)} className="w-12 h-12 rounded-lg bg-white shadow-sm text-2xl font-bold flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors">−</button>
                    <span className="text-2xl font-bold w-10 text-center text-gray-800">{item.quantity}</span>
                    <button onClick={() => addToCart(item.product)} disabled={item.quantity >= item.product.stock_qty} className="w-12 h-12 rounded-lg bg-white shadow-sm text-2xl font-bold flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50">+</button>
                  </div>
                  <div className="w-32 text-right">
                    <p className="font-bold text-2xl text-blue-600">฿{item.subtotal.toFixed(2)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-8 bg-gray-50 border-t">
            <div className="flex justify-between items-center mb-6">
              <span className="text-2xl font-bold text-gray-500">ยอดรวมทั้งสิ้น</span>
              <span className="text-5xl font-extrabold text-blue-600 tracking-tight">฿{total.toFixed(2)}</span>
            </div>
            <button 
              onClick={() => setShowCheckout(true)}
              disabled={cart.length === 0}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white text-3xl font-bold py-6 rounded-2xl shadow-lg transition-all active:scale-[0.98]"
            >
              ชำระเงิน
            </button>
          </div>
        </div>

        {/* Right Panel: Search/Scan */}
        <div className="w-[40%] bg-gray-100 flex flex-col p-8">
          <div className="mb-6 relative">
            <input 
              ref={barcodeInputRef}
              type="text" 
              placeholder="ค้นหาสินค้า หรือ สแกนบาร์โค้ด..." 
              className="w-full p-5 pl-14 text-xl border-2 border-transparent shadow-sm rounded-2xl focus:border-blue-500 focus:ring-0 transition-all outline-none"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
            />
            <div className="absolute left-5 top-5 text-gray-400">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            {isSearching && (
              <div className="absolute right-5 top-5">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              {searchResults.map(p => (
                <button 
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock_qty <= 0}
                  className="bg-white p-5 rounded-2xl shadow-sm border-2 border-transparent text-left hover:border-blue-500 hover:shadow-md focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden transition-all group"
                >
                  {p.stock_qty <= 0 && <div className="absolute top-3 right-3 bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-lg">หมด</div>}
                  <h3 className="font-bold text-lg mb-3 text-gray-800 leading-tight group-hover:text-blue-600 transition-colors">{p.name}</h3>
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-extrabold text-blue-600">฿{p.price.toFixed(2)}</span>
                    <span className="text-sm font-medium text-gray-400">คงเหลือ {p.stock_qty}</span>
                  </div>
                </button>
              ))}
              {!isSearching && searchQuery && searchResults.length === 0 && (
                <div className="col-span-2 flex flex-col items-center justify-center py-20 text-gray-400">
                  <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-xl font-medium">ไม่พบสินค้า</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">ยืนยันการชำระเงิน</h2>
              <button onClick={() => setShowCheckout(false)} className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 text-2xl font-bold transition-colors">&times;</button>
            </div>
            
            <div className="p-8 flex-1 overflow-auto">
              <div className="flex justify-between items-end mb-8 border-b border-gray-100 pb-6">
                <span className="text-xl font-medium text-gray-500">ยอดรวมที่ต้องชำระ</span>
                <span className="text-5xl font-extrabold text-blue-600 tracking-tight">฿{total.toFixed(2)}</span>
              </div>

              <div className="mb-8">
                <p className="font-bold text-lg mb-4 text-gray-700">เลือกช่องทางการชำระเงิน</p>
                <div className="flex gap-4">
                  <label className={`flex-1 border-2 p-5 rounded-2xl cursor-pointer text-center font-bold text-xl transition-all ${paymentMethod === 'cash' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-inner' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}>
                    <input type="radio" name="payment" className="hidden" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} />
                    เงินสด
                  </label>
                  <label className={`flex-1 border-2 p-5 rounded-2xl cursor-pointer text-center font-bold text-xl transition-all ${paymentMethod === 'wallet' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-inner' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}>
                    <input type="radio" name="payment" className="hidden" checked={paymentMethod === 'wallet'} onChange={() => setPaymentMethod('wallet')} />
                    Wallet บัตรนักเรียน
                  </label>
                </div>
              </div>

              {paymentMethod === 'wallet' && (
                <div className="mb-8 bg-blue-50/50 p-6 rounded-2xl border border-blue-100 animate-in slide-in-from-top-2 duration-200">
                  <label className="block font-bold text-lg mb-3 text-blue-900">รหัสนักเรียน (4-5 หลัก)</label>
                  <input 
                    type="text" 
                    placeholder="สแกนหรือพิมพ์รหัสนักเรียน..." 
                    className="w-full text-2xl p-4 border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:ring-0 outline-none transition-colors bg-white shadow-sm"
                    value={studentId}
                    onChange={e => setStudentId(e.target.value)}
                    autoFocus
                  />
                </div>
              )}

              {checkoutError && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-5 rounded-r-xl mb-6 font-semibold flex items-center gap-3 shadow-sm">
                  <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {checkoutError}
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t flex gap-4">
              <button onClick={() => setShowCheckout(false)} className="flex-1 py-4 text-xl font-bold text-gray-600 bg-white border-2 border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all">
                ยกเลิก
              </button>
              <button 
                onClick={handleCheckout} 
                disabled={isCheckingOut || (paymentMethod === 'wallet' && !studentId)}
                className="flex-[2] py-4 text-xl font-bold text-white bg-green-500 rounded-2xl hover:bg-green-600 disabled:opacity-50 disabled:bg-gray-300 flex justify-center items-center shadow-md transition-all active:scale-[0.98]"
              >
                {isCheckingOut ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    กำลังดำเนินการ...
                  </div>
                ) : 'ยืนยันชำระเงิน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
