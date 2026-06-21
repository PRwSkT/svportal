'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Product, CartItem, ShopTransaction, WalletAccount } from '@/types';

import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, X, CheckCircle2, Wallet, Banknote, CreditCard, SearchIcon, Trash2, Plus, Minus, ScanBarcode, Store, ChevronRight } from 'lucide-react';

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

  // NFC Wallet state
  const [walletAccount, setWalletAccount] = useState<WalletAccount | null>(null);
  const [walletStudentName, setWalletStudentName] = useState('');
  const [walletTodaySpend, setWalletTodaySpend] = useState(0);
  const [walletSearching, setWalletSearching] = useState(false);
  const [walletInput, setWalletInput] = useState('');
  const [nfcMode] = useState<'hid' | 'serial' | 'manual'>('manual');
  
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
        if (existing.quantity >= product.stock_qty) {
          toast.warning(`สต๊อกสินค้าไม่พอ (มีแค่ ${product.stock_qty} ชิ้น)`);
          return prev;
        }
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
        const exactRes = await fetch(`/api/pos/products?barcode=${encodeURIComponent(val)}`);
        if (exactRes.ok) {
          const exactMatch = await exactRes.json();
          if (exactMatch && exactMatch.stock_qty > 0) {
            addToCart(exactMatch);
            setSearchQuery('');
            setSearchResults([]);
            setIsSearching(false);
            return;
          }
        }

        const searchRes = await fetch(`/api/pos/products?q=${encodeURIComponent(val)}`);
        if (searchRes.ok) {
          const results = await searchRes.json();
          setSearchResults(results);
        }
      } catch (err: any) {
        toast.error('ค้นหาสินค้าไม่สำเร็จ', { description: err.message });
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

  // NFC card scan handler for wallet checkout
  const handleWalletCardScan = useCallback(async (uid: string) => {
    setWalletSearching(true);
    const loadingToast = toast.loading('กำลังค้นหาข้อมูลนักเรียน...');
    try {
      const isStudentId = /^\d{4,5}$/.test(uid.trim());
      const queryParam = isStudentId ? `student_id=${encodeURIComponent(uid.trim())}` : `card_uid=${encodeURIComponent(uid.trim())}`;
      const res = await fetch(`/api/pos/wallet?${queryParam}`);
      
      if (!res.ok) {
        if (res.status === 404) {
          toast.error(isStudentId ? `ไม่พบ Wallet ของนักเรียนรหัส ${uid}` : 'ไม่พบบัตรในระบบ', { id: loadingToast });
        } else {
          toast.error('เกิดข้อผิดพลาดในการค้นหา', { id: loadingToast });
        }
        return;
      }
      
      const { wallet: w, today_spend: spend, student_name } = await res.json();

      if (!w.is_active) {
        toast.error('Wallet ถูกระงับการใช้งาน', { id: loadingToast });
        return;
      }

      setWalletAccount(w);
      setStudentId(w.student_id);
      setWalletStudentName(student_name);
      setWalletTodaySpend(spend);

      const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
      
      if (w.balance < cartTotal) {
        toast.error(`ยอดเงินไม่เพียงพอ (คงเหลือ ฿${w.balance.toLocaleString()})`, { id: loadingToast });
      } else if (w.daily_limit !== null && (spend + cartTotal) > w.daily_limit) {
        toast.error(`เกินวงเงินรายวัน (วงเงิน ฿${w.daily_limit.toLocaleString()})`, { id: loadingToast });
      } else {
        toast.success(`พบข้อมูล: ${walletStudentName || w.student_id}`, { id: loadingToast });
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการค้นหา', { id: loadingToast, description: err.message });
    } finally {
      setWalletSearching(false);
    }
  }, [cart, walletStudentName]);

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    const loadingToast = toast.loading('กำลังชำระเงิน...');
    try {
      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart, paymentMethod, studentId: studentId || null })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Checkout failed');
      }
      
      const tx = await res.json();
      setSuccessSlip(tx);
      setCart([]);
      setShowCheckout(false);
      setStudentId('');
      setPaymentMethod('cash');
      setWalletAccount(null);
      setWalletStudentName('');
      setWalletTodaySpend(0);
      setWalletInput('');
      toast.success('ชำระเงินสำเร็จ!', { id: loadingToast });
    } catch (err: any) {
      const msg = err.message || '';
      let errorMsg = 'เกิดข้อผิดพลาดในการชำระเงิน';
      if (msg.includes('INSUFFICIENT_BALANCE')) errorMsg = `ยอดเงินไม่เพียงพอ (คงเหลือ ฿${walletAccount?.balance.toLocaleString() || '?'})`;
      else if (msg.includes('DAILY_LIMIT_EXCEEDED')) errorMsg = `เกินวงเงินรายวัน (วงเงิน ฿${walletAccount?.daily_limit?.toLocaleString() || '?'})`;
      else if (msg.includes('WALLET_NOT_FOUND')) errorMsg = 'ไม่พบ Wallet';
      else if (msg.includes('WALLET_INACTIVE')) errorMsg = 'Wallet ถูกระงับการใช้งาน';
      
      toast.error(errorMsg, { id: loadingToast, description: msg });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

  if (successSlip) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center print:bg-white print:p-0">
        <div className="w-full max-w-sm border p-6 rounded-2xl shadow-xl print:shadow-none print:border-none print:w-full">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-3 print:hidden">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-extrabold text-center mb-2">ใบเสร็จรับเงิน</h2>
            <p className="text-sm text-center text-gray-500">
              รหัสอ้างอิง: <span className="font-mono">{successSlip.id.slice(-8).toUpperCase()}</span><br/>
              {new Date(successSlip.created_at).toLocaleString('th-TH')}
            </p>
          </div>
          
          <table className="w-full mb-6 text-sm">
            <thead className="border-b-2 border-gray-100 mb-2">
              <tr>
                <th className="text-left pb-2 text-gray-500 font-medium">รายการ</th>
                <th className="text-right pb-2 text-gray-500 font-medium">จำนวน</th>
                <th className="text-right pb-2 text-gray-500 font-medium">ราคา</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {successSlip.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-3 font-medium text-gray-800">{item.product.name}</td>
                  <td className="text-right py-3 text-gray-600">x{item.quantity}</td>
                  <td className="text-right py-3 font-medium text-gray-800">฿{item.subtotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t-2 border-dashed border-gray-200 pt-4 font-extrabold flex justify-between text-xl mb-4">
            <span>ยอดสุทธิ</span>
            <span>฿{successSlip.total_amount.toFixed(2)}</span>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-600 flex justify-between font-medium items-center">
            <span>ช่องทางการชำระเงิน</span>
            <span className="flex items-center gap-1">
              {successSlip.payment_method === 'wallet' ? <><Wallet className="w-4 h-4 text-blue-600"/> Wallet บัตรนักเรียน</> : <><Banknote className="w-4 h-4 text-green-600"/> เงินสด</>}
            </span>
          </div>

          <div className="mt-8 flex gap-4 print:hidden">
            <button onClick={() => window.print()} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors">พิมพ์สลิป</button>
            <button 
              onClick={() => { 
                setSuccessSlip(null); 
                setTimeout(() => barcodeInputRef.current?.focus(), 300); 
              }} 
              className="flex-1 bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
            >
              ทำรายการใหม่
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
    <div className="h-screen flex flex-col bg-background overflow-hidden font-sans relative">
      {isOffline && (
        <motion.div 
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          className="bg-orange-500 text-white text-center py-2 font-bold z-50 text-sm shadow-md flex justify-center items-center gap-2"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
          ออฟไลน์ — ข้อมูลจะซิงค์เมื่อเชื่อมต่อใหม่
        </motion.div>
      )}
      
      <div className="flex flex-1 overflow-hidden h-full">
        {/* Left Panel: Cart */}
        <div className="w-[55%] bg-surface border-r border-foreground/5 flex flex-col shadow-2xl z-10 h-full">
          <div className="p-6 bg-background/50 border-b border-foreground/5 flex justify-between items-center backdrop-blur-md">
            <h2 className="text-2xl font-extrabold text-primary flex items-center gap-3">
              <Store className="w-8 h-8" />
              ตะกร้าสินค้า 
              <span className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-full font-bold ml-2">
                {cart.reduce((s, i) => s + i.quantity, 0)} ชิ้น
              </span>
            </h2>
            <button 
              onClick={() => setCart([])} 
              disabled={cart.length === 0}
              className="text-red-500 hover:bg-red-50 font-bold text-sm px-4 py-2 rounded-xl disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> ล้างตะกร้า
            </button>
          </div>
          
          <div className="flex-1 overflow-auto p-6 space-y-4 bg-background/30">
            <AnimatePresence mode="popLayout">
              {cart.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-full opacity-50"
                >
                  <ShoppingCart className="w-24 h-24 text-foreground/30 mb-6" />
                  <p className="text-foreground/50 text-xl font-bold">ยังไม่มีสินค้าในตะกร้า</p>
                  <p className="text-foreground/40 text-sm mt-2">สแกนบาร์โค้ดหรือค้นหาสินค้าด้านขวาเพื่อเพิ่ม</p>
                </motion.div>
              ) : (
                cart.map(item => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20, scale: 0.95 }}
                    key={item.product.id} 
                    className="flex justify-between items-center bg-surface p-4 rounded-2xl shadow-sm border border-foreground/5 group hover:border-primary/20 transition-colors"
                  >
                    <div className="flex-1 pr-4">
                      <p className="font-extrabold text-lg text-foreground truncate">{item.product.name}</p>
                      <p className="text-foreground/50 font-medium text-sm">฿{item.product.price.toFixed(2)} / ชิ้น</p>
                    </div>
                    <div className="flex items-center gap-2 bg-background p-1.5 rounded-xl border border-foreground/5">
                      <button onClick={() => removeFromCart(item.product.id)} className="w-10 h-10 rounded-lg hover:bg-surface text-foreground/70 transition-colors flex items-center justify-center">
                        <Minus className="w-5 h-5" />
                      </button>
                      <span className="text-xl font-extrabold w-10 text-center text-primary">{item.quantity}</span>
                      <button onClick={() => addToCart(item.product)} disabled={item.quantity >= item.product.stock_qty} className="w-10 h-10 rounded-lg hover:bg-surface text-foreground/70 transition-colors disabled:opacity-30 flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="w-32 text-right">
                      <p className="font-black text-2xl text-primary">฿{item.subtotal.toFixed(2)}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="p-8 bg-surface border-t border-foreground/5 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] z-20">
            <div className="flex justify-between items-end mb-6">
              <span className="text-lg font-bold text-foreground/50 uppercase tracking-widest">ยอดรวมทั้งสิ้น</span>
              <span className="text-6xl font-black text-primary tracking-tight">฿{total.toFixed(2)}</span>
            </div>
            <button 
              onClick={() => setShowCheckout(true)}
              disabled={cart.length === 0}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-foreground/20 disabled:text-foreground/40 text-white text-2xl font-black py-6 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              ชำระเงิน <ChevronRight className="w-8 h-8" />
            </button>
          </div>
        </div>

        {/* Right Panel: Search/Scan */}
        <div className="w-[45%] bg-background/50 flex flex-col p-8 relative">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          
          <div className="mb-6 relative z-10">
            <div className="relative group">
              <input 
                ref={barcodeInputRef}
                type="text" 
                placeholder="ค้นหาสินค้า หรือ สแกนบาร์โค้ด..." 
                className="w-full p-5 pl-14 text-lg font-medium border-2 border-transparent bg-surface shadow-sm rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-foreground placeholder:text-foreground/40"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
              />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground/40 group-focus-within:text-primary transition-colors">
                <ScanBarcode className="w-6 h-6" />
              </div>
              {isSearching && (
                <div className="absolute right-5 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto pr-2 z-10 hide-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <AnimatePresence>
                {searchResults.map((p, i) => (
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={p.stock_qty <= 0}
                    className="bg-surface p-6 rounded-2xl shadow-sm border-2 border-transparent text-left hover:border-primary/50 hover:shadow-lg focus:outline-none focus:border-primary disabled:opacity-50 disabled:grayscale relative overflow-hidden transition-all group flex flex-col justify-between min-h-[140px]"
                  >
                    {p.stock_qty <= 0 && <div className="absolute top-3 right-3 bg-secondary text-white text-xs font-black px-2 py-1 rounded-md uppercase tracking-wider">หมด</div>}
                    <h3 className="font-extrabold text-lg mb-4 text-foreground/80 leading-tight group-hover:text-primary transition-colors line-clamp-2">{p.name}</h3>
                    <div className="flex justify-between items-end w-full mt-auto">
                      <span className="text-3xl font-black text-primary">฿{p.price.toFixed(2)}</span>
                      <span className="text-xs font-bold text-foreground/40 bg-foreground/5 px-2 py-1 rounded-md">เหลือ {p.stock_qty}</span>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
              
              {!isSearching && searchQuery && searchResults.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-2 flex flex-col items-center justify-center py-32 text-foreground/40"
                >
                  <SearchIcon className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-xl font-bold">ไม่พบสินค้าที่ค้นหา</p>
                </motion.div>
              )}
              
              {!searchQuery && searchResults.length === 0 && (
                <div className="col-span-2 flex flex-col items-center justify-center py-32 text-foreground/20">
                  <ScanBarcode className="w-24 h-24 mb-6 opacity-30" />
                  <p className="text-2xl font-bold tracking-tight">พร้อมสแกนบาร์โค้ด</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {showCheckout && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-surface w-full max-w-2xl rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 bg-background/30 border-b border-foreground/5 flex justify-between items-center">
                <h2 className="text-2xl font-extrabold text-primary flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6" /> ยืนยันการชำระเงิน
                </h2>
                <button onClick={() => setShowCheckout(false)} className="w-10 h-10 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground/60 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 flex-1 overflow-auto bg-surface">
                <div className="flex justify-between items-end mb-8 bg-primary/5 p-6 rounded-3xl border border-primary/10">
                  <span className="text-xl font-bold text-primary/70 uppercase tracking-widest">ยอดที่ต้องชำระ</span>
                  <span className="text-6xl font-black text-primary tracking-tight">฿{total.toFixed(2)}</span>
                </div>

                <div className="mb-8">
                  <p className="font-bold text-lg mb-4 text-foreground/70 uppercase tracking-wider text-sm">เลือกช่องทางการชำระเงิน</p>
                  <div className="flex gap-4">
                    <label className={`flex-1 relative overflow-hidden p-6 rounded-3xl cursor-pointer text-center font-bold text-xl transition-all border-2 ${paymentMethod === 'cash' ? 'border-green-500 bg-green-50/50 text-green-700 shadow-lg shadow-green-500/10' : 'border-foreground/10 hover:border-foreground/20 text-foreground/60 bg-background'}`}>
                      <input type="radio" name="payment" className="hidden" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} />
                      <div className="flex flex-col items-center gap-3">
                        <Banknote className={`w-10 h-10 ${paymentMethod === 'cash' ? 'text-green-500' : 'text-foreground/30'}`} />
                        เงินสด
                      </div>
                      {paymentMethod === 'cash' && <div className="absolute top-3 right-3"><CheckCircle2 className="w-5 h-5 text-green-500"/></div>}
                    </label>
                    
                    <label className={`flex-1 relative overflow-hidden p-6 rounded-3xl cursor-pointer text-center font-bold text-xl transition-all border-2 ${paymentMethod === 'wallet' ? 'border-primary bg-primary/5 text-primary shadow-lg shadow-primary/10' : 'border-foreground/10 hover:border-foreground/20 text-foreground/60 bg-background'}`}>
                      <input type="radio" name="payment" className="hidden" checked={paymentMethod === 'wallet'} onChange={() => setPaymentMethod('wallet')} />
                      <div className="flex flex-col items-center gap-3">
                        <Wallet className={`w-10 h-10 ${paymentMethod === 'wallet' ? 'text-primary' : 'text-foreground/30'}`} />
                        Wallet นักเรียน
                      </div>
                      {paymentMethod === 'wallet' && <div className="absolute top-3 right-3"><CheckCircle2 className="w-5 h-5 text-primary"/></div>}
                    </label>
                  </div>
                </div>

                <AnimatePresence>
                  {paymentMethod === 'wallet' && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mb-8 bg-background p-6 rounded-3xl border border-foreground/10 shadow-inner">
                        <div className="flex justify-between items-center mb-6">
                          <span className="font-extrabold text-xl text-primary flex items-center gap-2">
                            <CreditCard className="w-5 h-5" /> ข้อมูล Wallet
                          </span>
                          <span className="text-xs font-bold bg-surface border border-foreground/10 text-foreground/50 px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                            Mode: {nfcMode === 'hid' ? 'HID' : nfcMode === 'serial' ? 'Serial' : 'Manual'}
                          </span>
                        </div>

                        {!walletAccount ? (
                          <div className="text-center py-6">
                            <div className="flex justify-center mb-6 relative">
                              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full w-16 h-16 mx-auto animate-pulse"></div>
                              <CreditCard className="w-16 h-16 text-primary relative z-10 animate-bounce" />
                            </div>
                            <p className="text-xl font-bold text-foreground mb-6">แตะบัตรนักเรียน หรือ สแกนบาร์โค้ดรหัส</p>
                            <div className="flex gap-3 max-w-sm mx-auto">
                              <input
                                type="text"
                                value={walletInput}
                                onChange={e => setWalletInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && walletInput.trim()) handleWalletCardScan(walletInput); }}
                                placeholder="รหัส หรือ UID..."
                                className="flex-1 text-lg font-bold p-4 border-2 border-foreground/10 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-surface text-center uppercase tracking-widest"
                                autoFocus
                              />
                              <button
                                onClick={() => walletInput.trim() && handleWalletCardScan(walletInput)}
                                disabled={walletSearching}
                                className="px-6 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 disabled:opacity-50 shadow-md transition-all active:scale-95"
                              >
                                {walletSearching ? '...' : 'ค้นหา'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                            <div className="flex justify-between items-center bg-surface p-5 rounded-2xl border border-foreground/10 shadow-sm">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xl">
                                  {walletStudentName.charAt(0) || '?'}
                                </div>
                                <div>
                                  <p className="font-extrabold text-xl text-foreground">{walletStudentName}</p>
                                  <p className="text-sm font-bold text-foreground/50 tracking-wider">ID: {walletAccount.student_id}</p>
                                </div>
                              </div>
                              <div className="text-right bg-primary/5 px-4 py-2 rounded-xl">
                                <p className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-1">ยอดคงเหลือ</p>
                                <p className={`text-3xl font-black ${walletAccount.balance < total ? 'text-secondary' : 'text-primary'}`}>
                                  ฿{walletAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>

                            {walletAccount.daily_limit !== null && (
                              <div className="bg-surface p-5 rounded-2xl border border-foreground/10 shadow-sm">
                                <div className="flex justify-between text-sm font-bold mb-3">
                                  <span className="text-foreground/50 uppercase tracking-wider">การใช้วงเงินรายวัน</span>
                                  <span className="text-primary">
                                    ฿{walletTodaySpend.toLocaleString('en-US', { minimumFractionDigits: 2 })} / ฿{walletAccount.daily_limit.toLocaleString('en-US')}
                                  </span>
                                </div>
                                <div className="w-full bg-foreground/5 rounded-full h-3 overflow-hidden border border-foreground/5">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 relative overflow-hidden ${
                                      (walletTodaySpend + total) > walletAccount.daily_limit ? 'bg-secondary' :
                                      walletTodaySpend / walletAccount.daily_limit > 0.8 ? 'bg-amber-500' : 'bg-primary'
                                    }`}
                                    style={{ width: `${Math.min(100, (walletTodaySpend / walletAccount.daily_limit) * 100)}%` }}
                                  >
                                     <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <button
                              onClick={() => { setWalletAccount(null); setStudentId(''); setWalletInput(''); }}
                              className="text-sm font-bold text-primary/70 hover:text-primary transition-colors flex items-center justify-center w-full py-2 hover:bg-primary/5 rounded-xl"
                            >
                              เปลี่ยนบัตร / ผู้ใช้งานอื่น
                            </button>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-6 bg-background/50 border-t border-foreground/5 flex gap-4 backdrop-blur-md">
                <button onClick={() => setShowCheckout(false)} className="w-1/3 py-5 text-xl font-bold text-foreground/60 bg-surface border-2 border-foreground/10 rounded-2xl hover:bg-foreground/5 transition-all">
                  ยกเลิก
                </button>
                <button 
                  onClick={handleCheckout} 
                  disabled={isCheckingOut || (paymentMethod === 'wallet' && !walletAccount)}
                  className="flex-1 py-5 text-2xl font-black text-white bg-primary rounded-2xl hover:bg-primary/90 disabled:opacity-50 disabled:bg-foreground/20 flex justify-center items-center shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                >
                  {isCheckingOut ? (
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                      กำลังประมวลผล...
                    </div>
                  ) : 'ยืนยันการชำระเงิน'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
