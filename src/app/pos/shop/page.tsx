'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Product, CartItem, ShopTransaction, WalletAccount } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, X, CheckCircle2, Wallet, Banknote, CreditCard, Trash2, Plus, Minus, ScanBarcode, Store, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function POSShopPage() {
  const { dict, isThai, formatDate, formatCurrency } = useLanguage();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet'>('cash');
  const [studentId, setStudentId] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [mobileTab, setMobileTab] = useState<'cart' | 'catalog'>('catalog');

  // NFC Wallet state
  const [walletAccount, setWalletAccount] = useState<WalletAccount | null>(null);
  const [walletStudentName, setWalletStudentName] = useState('');
  const [walletTodaySpend, setWalletTodaySpend] = useState(0);
  const [walletSearching, setWalletSearching] = useState(false);
  const [walletInput, setWalletInput] = useState('');
  const [nfcMode] = useState<'hid' | 'serial' | 'manual'>('manual');
  
  const [successSlip, setSuccessSlip] = useState<ShopTransaction | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [categories, setCategories] = useState<string[]>(['ALL']);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout>(null);

  const fetchCatalog = useCallback(async (cat = selectedCategory, q = searchQuery) => {
    setIsSearching(true);
    try {
      const url = new URL('/api/pos/products', window.location.origin);
      if (cat && cat !== 'ALL') url.searchParams.set('category', cat);
      if (q && q.trim()) url.searchParams.set('q', q.trim());
      const res = await fetch(url.toString());
      if (res.ok) {
        const data: Product[] = await res.json();
        setSearchResults(data);
        const distinctCats = Array.from(new Set(data.map(p => p.category).filter(Boolean))) as string[];
        if (distinctCats.length > 0) {
          setCategories(prev => Array.from(new Set(['ALL', ...prev.filter(c => c !== 'ALL'), ...distinctCats])));
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    barcodeInputRef.current?.focus();
    fetchCatalog('ALL', '');
    
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCheckout && !isCheckingOut) {
        setShowCheckout(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCheckout, isCheckingOut]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_qty) {
          toast.warning(isThai ? `สต๊อกสินค้าไม่พอ (มีแค่ ${product.stock_qty} ชิ้น)` : `Insufficient stock (only ${product.stock_qty} available)`);
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.product.price }
            : item
        );
      }
      if (product.stock_qty <= 0) {
        toast.warning(isThai ? 'สินค้าหมดสต๊อก' : 'Product out of stock');
        return prev;
      }
      return [...prev, { product, quantity: 1, subtotal: product.price }];
    });
  };

  const [cashReceived, setCashReceived] = useState<number | ''>('');

  const deleteItemFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(async () => {
      if (!val.trim()) {
        fetchCatalog(selectedCategory, '');
        return;
      }

      setIsSearching(true);
      try {
        const exactRes = await fetch(`/api/pos/products?barcode=${encodeURIComponent(val)}`);
        if (exactRes.ok) {
          const exactMatch = await exactRes.json();
          if (exactMatch && exactMatch.stock_qty > 0) {
            addToCart(exactMatch);
            setSearchQuery('');
            fetchCatalog(selectedCategory, '');
            return;
          }
        }

        const searchRes = await fetch(`/api/pos/products?q=${encodeURIComponent(val)}`);
        if (searchRes.ok) {
          const results = await searchRes.json();
          setSearchResults(results);
        }
      } catch (err: any) {
        toast.error(isThai ? 'ค้นหาสินค้าไม่สำเร็จ' : 'Search failed', { description: err.message });
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
        fetchCatalog(selectedCategory, '');
      }
    }
  };

  // NFC card scan handler for wallet checkout
  const handleWalletCardScan = useCallback(async (uid: string) => {
    setWalletSearching(true);
    const loadingToast = toast.loading(isThai ? 'กำลังค้นหาข้อมูลนักเรียน...' : 'Searching student wallet...');
    try {
      const isStudentId = /^\d{4,5}$/.test(uid.trim());
      const queryParam = isStudentId ? `student_id=${encodeURIComponent(uid.trim())}` : `card_uid=${encodeURIComponent(uid.trim())}`;
      const res = await fetch(`/api/pos/wallet?${queryParam}`);
      
      if (!res.ok) {
        if (res.status === 404) {
          toast.error(isStudentId ? (isThai ? `ไม่พบ Wallet ของนักเรียนรหัส ${uid}` : `Wallet not found for ID ${uid}`) : (isThai ? 'ไม่พบบัตรในระบบ' : 'Card not found'), { id: loadingToast });
        } else {
          toast.error(isThai ? 'เกิดข้อผิดพลาดในการค้นหา' : 'Search error', { id: loadingToast });
        }
        return;
      }
      
      const { wallet: w, today_spend: spend, student_name } = await res.json();

      if (!w.is_active) {
        toast.error(isThai ? 'Wallet ถูกระงับการใช้งาน' : 'Wallet account is inactive', { id: loadingToast });
        return;
      }

      setWalletAccount(w);
      setStudentId(w.student_id);
      setWalletStudentName(student_name);
      setWalletTodaySpend(spend);

      const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
      
      if (w.balance < cartTotal) {
        toast.error(isThai ? `ยอดเงินไม่เพียงพอ (คงเหลือ ฿${w.balance.toLocaleString()})` : `Insufficient balance (Balance ฿${w.balance.toLocaleString()})`, { id: loadingToast });
      } else if (w.daily_limit !== null && (spend + cartTotal) > w.daily_limit) {
        toast.error(isThai ? `เกินวงเงินรายวัน (วงเงิน ฿${w.daily_limit.toLocaleString()})` : `Daily limit exceeded (Limit ฿${w.daily_limit.toLocaleString()})`, { id: loadingToast });
      } else {
        toast.success(isThai ? `พบข้อมูล: ${student_name || w.student_id}` : `Found: ${student_name || w.student_id}`, { id: loadingToast });
      }
    } catch (err: any) {
      toast.error(isThai ? 'เกิดข้อผิดพลาดในการค้นหา' : 'Search failed', { id: loadingToast, description: err.message });
    } finally {
      setWalletSearching(false);
    }
  }, [cart, isThai]);

  const handleCheckout = async () => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);
    const loadingToast = toast.loading(isThai ? 'กำลังชำระเงิน...' : 'Processing payment...');
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
      toast.success(isThai ? 'ชำระเงินสำเร็จ!' : 'Payment completed successfully!', { id: loadingToast });
    } catch (err: any) {
      const msg = err.message || '';
      let errorMsg = isThai ? 'เกิดข้อผิดพลาดในการชำระเงิน' : 'Payment failed';
      if (msg.includes('INSUFFICIENT_BALANCE') || msg.includes('INSUFFICIENT_WALLET')) {
        errorMsg = isThai ? `ยอดเงินไม่เพียงพอ (คงเหลือ ฿${walletAccount?.balance.toLocaleString() || '?'})` : `Insufficient balance (Remaining ฿${walletAccount?.balance.toLocaleString() || '?'})`;
      } else if (msg.includes('DAILY_LIMIT_EXCEEDED')) {
        errorMsg = isThai ? `เกินวงเงินรายวัน (วงเงิน ฿${walletAccount?.daily_limit?.toLocaleString() || '?'})` : `Daily limit exceeded (Limit ฿${walletAccount?.daily_limit?.toLocaleString() || '?'})`;
      } else if (msg.includes('WALLET_NOT_FOUND')) {
        errorMsg = isThai ? 'ไม่พบ Wallet' : 'Wallet not found';
      } else if (msg.includes('WALLET_INACTIVE')) {
        errorMsg = isThai ? 'Wallet ถูกระงับการใช้งาน' : 'Wallet is inactive';
      }
      
      toast.error(errorMsg, { id: loadingToast, description: msg });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

  if (successSlip) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-slate-900 z-50 flex flex-col items-center justify-center print:bg-white print:p-0">
        <div className="w-full max-w-sm border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl print:shadow-none print:border-none print:w-full bg-white dark:bg-slate-900">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 print:hidden">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-extrabold text-center mb-2 text-slate-900 dark:text-white">{dict.shop.receipt}</h2>
            <p className="text-sm text-center text-slate-500">
              {dict.shop.refCode}: <span className="font-mono">{successSlip.id.slice(-8).toUpperCase()}</span><br/>
              {formatDate(new Date(successSlip.created_at), { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          
          <table className="w-full mb-6 text-sm">
            <thead className="border-b-2 border-slate-100 dark:border-slate-800 mb-2">
              <tr>
                <th className="text-left pb-2 text-slate-500 font-medium">{dict.shop.item}</th>
                <th className="text-right pb-2 text-slate-500 font-medium">{dict.shop.quantity}</th>
                <th className="text-right pb-2 text-slate-500 font-medium">{dict.shop.price}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {successSlip.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-3 font-medium text-slate-800 dark:text-slate-200">{item.product.name}</td>
                  <td className="text-right py-3 text-slate-500">x{item.quantity}</td>
                  <td className="text-right py-3 font-medium text-slate-800 dark:text-slate-200">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t-2 border-dashed border-slate-200 dark:border-slate-700 pt-4 font-extrabold flex justify-between text-xl mb-4 text-slate-900 dark:text-white">
            <span>{dict.shop.totalNet}</span>
            <span>{formatCurrency(successSlip.total_amount)}</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-sm text-slate-600 dark:text-slate-300 flex justify-between font-medium items-center">
            <span>{dict.fees.paymentMethod}</span>
            <span className="flex items-center gap-1">
              {successSlip.payment_method === 'wallet' ? <><Wallet className="w-4 h-4 text-blue-600"/> {dict.shop.studentWallet}</> : <><Banknote className="w-4 h-4 text-emerald-600"/> {dict.fees.cash}</>}
            </span>
          </div>

          <div className="mt-8 flex gap-4 print:hidden">
            <button onClick={() => window.print()} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">{dict.shop.printSlip}</button>
            <button 
              onClick={() => { 
                setSuccessSlip(null); 
                setTimeout(() => barcodeInputRef.current?.focus(), 300); 
              }} 
              className="flex-1 bg-[#7B1C3E] hover:bg-[#681834] text-white py-3 rounded-xl font-bold transition-colors shadow-md shadow-[#7B1C3E]/20"
            >
              {dict.fees.newTransaction}
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
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background overflow-hidden font-sans relative">
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
          {dict.shop.offlineNotice}
        </motion.div>
      )}

      {/* Mobile/Tablet View Switcher */}
      <div className="lg:hidden flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-20">
        <div className="grid grid-cols-2 gap-2 w-full">
          <button
            type="button"
            onClick={() => setMobileTab('catalog')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              mobileTab === 'catalog'
                ? 'bg-[#7B1C3E] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <ScanBarcode className="w-4 h-4" />
            <span>{isThai ? 'ค้นหา / สแกน' : 'Search / Scan'}</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all relative ${
              mobileTab === 'cart'
                ? 'bg-[#7B1C3E] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{dict.shop.cart}</span>
            {cart.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                mobileTab === 'cart' ? 'bg-white text-[#7B1C3E]' : 'bg-[#7B1C3E] text-white'
              }`}>
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden h-full">
        {/* Left Panel: Cart */}
        <div className={`w-full lg:w-[55%] bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 flex flex-col shadow-2xl z-10 h-full ${mobileTab === 'cart' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center backdrop-blur-md">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {dict.common.officialBadge}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">{dict.shop.title}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                <Store className="w-6 h-6 sm:w-7 sm:h-7 text-[#7B1C3E] dark:text-pink-400" />
                <span>{dict.shop.cart}</span>
                <span className="bg-[#7B1C3E]/10 text-[#7B1C3E] dark:text-pink-400 text-xs sm:text-sm px-2.5 py-0.5 rounded-full font-bold">
                  {cart.reduce((s, i) => s + i.quantity, 0)} {dict.shop.itemCount}
                </span>
              </h2>
            </div>
            <button 
              onClick={() => setCart([])} 
              disabled={cart.length === 0}
              className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> {dict.shop.clearCart}
            </button>
          </div>
          
          <div className="flex-1 overflow-auto p-6 space-y-4 bg-slate-50/30 dark:bg-slate-950/20">
            <AnimatePresence mode="popLayout">
              {cart.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-full opacity-50"
                >
                  <ShoppingCart className="w-24 h-24 text-slate-300 dark:text-slate-600 mb-6" />
                  <p className="text-slate-500 text-xl font-bold">{dict.shop.emptyCart}</p>
                  <p className="text-slate-400 text-sm mt-2">{dict.shop.emptyCartHint}</p>
                </motion.div>
              ) : (
                cart.map(item => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20, scale: 0.95 }}
                    key={item.product.id} 
                    className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 group hover:border-[#7B1C3E]/30 transition-colors"
                  >
                    <div className="flex-1 pr-4">
                      <p className="font-extrabold text-lg text-slate-900 dark:text-white truncate">{item.product.name}</p>
                      <p className="text-slate-500 font-medium text-sm">{formatCurrency(item.product.price)} / {dict.shop.itemCount}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-600">
                      <button onClick={() => removeFromCart(item.product.id)} className="w-10 h-10 rounded-lg hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center" title="ลดจำนวน">
                        <Minus className="w-5 h-5" />
                      </button>
                      <span className="text-xl font-extrabold w-10 text-center text-[#7B1C3E] dark:text-pink-400">{item.quantity}</span>
                      <button onClick={() => addToCart(item.product)} disabled={item.quantity >= item.product.stock_qty} className="w-10 h-10 rounded-lg hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-30 flex items-center justify-center" title="เพิ่มจำนวน">
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="w-24 text-right">
                      <p className="font-black text-2xl text-[#7B1C3E] dark:text-pink-400">{formatCurrency(item.subtotal)}</p>
                    </div>
                    <button 
                      onClick={() => deleteItemFromCart(item.product.id)} 
                      className="w-10 h-10 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors flex items-center justify-center ml-2"
                      title="ลบรายการนี้"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="p-4 sm:p-6 lg:p-8 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)] z-20">
            <div className="flex justify-between items-end mb-4 sm:mb-6">
              <span className="text-sm sm:text-base lg:text-lg font-bold text-slate-500 uppercase tracking-widest">{dict.shop.totalAmount}</span>
              <span className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#7B1C3E] dark:text-pink-400 tracking-tight">{formatCurrency(total)}</span>
            </div>
            <button 
              onClick={() => {
                setCashReceived(total);
                setShowCheckout(true);
              }}
              disabled={cart.length === 0}
              className="w-full bg-[#7B1C3E] hover:bg-[#681834] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-lg sm:text-xl lg:text-2xl font-black py-4 sm:py-5 lg:py-6 rounded-2xl shadow-xl shadow-[#7B1C3E]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 sm:gap-3"
            >
              <span>{dict.shop.checkout}</span>
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          </div>
        </div>

        {/* Right Panel: Search/Scan */}
        <div className={`w-full lg:w-[45%] bg-slate-50/50 dark:bg-slate-950/40 flex flex-col p-4 sm:p-6 lg:p-8 relative ${mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#7B1C3E]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          
          <div className="mb-6 relative z-10">
            <div className="relative group">
              <input 
                ref={barcodeInputRef}
                type="text" 
                placeholder={dict.shop.scanOrSearch} 
                className="w-full p-5 pl-14 text-lg font-medium border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm rounded-2xl focus:border-[#7B1C3E] focus:ring-4 focus:ring-[#7B1C3E]/10 transition-all outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
              />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#7B1C3E] transition-colors">
                <ScanBarcode className="w-6 h-6" />
              </div>
              {isSearching && (
                <div className="absolute right-5 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-[#7B1C3E]/30 border-t-[#7B1C3E] rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar z-10">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  fetchCatalog(cat, searchQuery);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-[#7B1C3E] text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {cat === 'ALL' ? dict.common.all : cat}
              </button>
            ))}
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
                    className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border-2 border-transparent text-left hover:border-[#7B1C3E]/50 hover:shadow-lg focus:outline-none focus:border-[#7B1C3E] disabled:opacity-50 disabled:grayscale relative overflow-hidden transition-all group flex flex-col justify-between min-h-[140px]"
                  >
                    {p.stock_qty <= 0 && <div className="absolute top-3 right-3 bg-rose-600 text-white text-xs font-black px-2 py-1 rounded-md uppercase tracking-wider">{dict.products.outOfStock}</div>}
                    <h3 className="font-extrabold text-lg mb-4 text-slate-800 dark:text-slate-100 leading-tight group-hover:text-[#7B1C3E] transition-colors line-clamp-2">{p.name}</h3>
                    <div className="flex justify-between items-baseline mt-auto">
                      <span className="font-black text-2xl text-[#7B1C3E] dark:text-pink-400">{formatCurrency(p.price)}</span>
                      <span className="text-xs font-bold text-slate-400">{p.stock_qty} {dict.shop.itemCount}</span>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
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
            onClick={(e) => { if (e.target === e.currentTarget) setShowCheckout(false); }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] cursor-default"
            >
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6 text-[#7B1C3E] dark:text-pink-400" /> {dict.shop.confirmPayment}
                </h2>
                <button onClick={() => setShowCheckout(false)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
                <div className="flex justify-between items-end mb-6 sm:mb-8 bg-[#7B1C3E]/5 dark:bg-[#7B1C3E]/10 p-4 sm:p-6 rounded-3xl border border-[#7B1C3E]/10">
                  <span className="text-sm sm:text-lg font-bold text-[#7B1C3E] dark:text-pink-400 uppercase tracking-widest">{dict.shop.amountDue}</span>
                  <span className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#7B1C3E] dark:text-pink-400 tracking-tight">{formatCurrency(total)}</span>
                </div>

                <div className="mb-8">
                  <p className="font-bold text-lg mb-4 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-sm">{dict.shop.selectPaymentMethod}</p>
                  <div className="flex gap-4">
                    <label className={`flex-1 relative overflow-hidden p-6 rounded-3xl cursor-pointer text-center font-bold text-xl transition-all border-2 ${paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 shadow-lg shadow-emerald-500/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800'}`}>
                      <input type="radio" name="payment" className="hidden" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} />
                      <div className="flex flex-col items-center gap-3">
                        <Banknote className={`w-10 h-10 ${paymentMethod === 'cash' ? 'text-emerald-500' : 'text-slate-400'}`} />
                        {dict.fees.cash}
                      </div>
                      {paymentMethod === 'cash' && <div className="absolute top-3 right-3"><CheckCircle2 className="w-5 h-5 text-emerald-500"/></div>}
                    </label>
                    
                    <label className={`flex-1 relative overflow-hidden p-6 rounded-3xl cursor-pointer text-center font-bold text-xl transition-all border-2 ${paymentMethod === 'wallet' ? 'border-[#7B1C3E] bg-[#7B1C3E]/5 text-[#7B1C3E] dark:text-pink-400 shadow-lg shadow-[#7B1C3E]/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800'}`}>
                      <input type="radio" name="payment" className="hidden" checked={paymentMethod === 'wallet'} onChange={() => setPaymentMethod('wallet')} />
                      <div className="flex flex-col items-center gap-3">
                        <Wallet className={`w-10 h-10 ${paymentMethod === 'wallet' ? 'text-[#7B1C3E] dark:text-pink-400' : 'text-slate-400'}`} />
                        {dict.shop.studentWallet}
                      </div>
                      {paymentMethod === 'wallet' && <div className="absolute top-3 right-3"><CheckCircle2 className="w-5 h-5 text-[#7B1C3E] dark:text-pink-400"/></div>}
                    </label>
                  </div>
                </div>

                <AnimatePresence>
                  {paymentMethod === 'cash' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-8"
                    >
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="flex justify-between items-center">
                          <label className="font-extrabold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                            <Banknote className="w-4 h-4 text-emerald-600" />
                            {dict.shop.cashReceived}
                          </label>
                          <button
                            type="button"
                            onClick={() => setCashReceived(total)}
                            className="text-xs font-bold text-[#7B1C3E] dark:text-pink-400 hover:underline"
                          >
                            {dict.shop.exactCash} ({formatCurrency(total)})
                          </button>
                        </div>

                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">฿</span>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={cashReceived}
                            onChange={(e) => setCashReceived(e.target.value === '' ? '' : parseFloat(e.target.value))}
                            placeholder={total.toFixed(2)}
                            className="w-full text-2xl font-black pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none text-slate-900 dark:text-white"
                          />
                        </div>

                        {/* Quick preset buttons */}
                        <div className="flex flex-wrap gap-2">
                          {Array.from(new Set([total, 50, 100, 500, 1000].filter(v => v >= total))).sort((a, b) => a - b).map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setCashReceived(preset)}
                              className={`px-4 py-2 rounded-xl font-bold text-sm border transition-all ${
                                cashReceived === preset 
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                  : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              ฿{preset.toLocaleString()}
                            </button>
                          ))}
                        </div>

                        {/* Change display */}
                        {typeof cashReceived === 'number' && (
                          <div className={`p-4 rounded-2xl border flex justify-between items-center ${
                            cashReceived >= total 
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' 
                              : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
                          }`}>
                            <span className={`font-bold ${cashReceived >= total ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'}`}>
                              {cashReceived >= total ? dict.shop.change : dict.shop.insufficientCash}
                            </span>
                            <span className={`text-2xl font-black ${cashReceived >= total ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              ฿{Math.abs(cashReceived - total).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {paymentMethod === 'wallet' && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mb-8 bg-slate-50 dark:bg-slate-800/60 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-inner">
                        <div className="flex justify-between items-center mb-6">
                          <span className="font-extrabold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-[#7B1C3E] dark:text-pink-400" /> {dict.shop.walletInfo}
                          </span>
                          <span className="text-xs font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                            Mode: {nfcMode === 'hid' ? 'HID' : nfcMode === 'serial' ? 'Serial' : 'Manual'}
                          </span>
                        </div>

                        {!walletAccount ? (
                          <div className="text-center py-6">
                            <div className="flex justify-center mb-6 relative">
                              <div className="absolute inset-0 bg-[#7B1C3E]/20 blur-xl rounded-full w-16 h-16 mx-auto animate-pulse"></div>
                              <CreditCard className="w-16 h-16 text-[#7B1C3E] dark:text-pink-400 relative z-10 animate-bounce" />
                            </div>
                            <p className="text-xl font-bold text-slate-900 dark:text-white mb-6">{dict.shop.tapOrScanStudentCard}</p>
                            <div className="flex gap-3 max-w-sm mx-auto">
                              <input
                                type="text"
                                value={walletInput}
                                onChange={e => setWalletInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && walletInput.trim()) handleWalletCardScan(walletInput); }}
                                placeholder={isThai ? 'รหัส หรือ UID...' : 'ID or Card UID...'}
                                className="flex-1 text-lg font-bold p-4 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-[#7B1C3E] focus:ring-4 focus:ring-[#7B1C3E]/10 outline-none bg-white dark:bg-slate-900 text-center uppercase tracking-widest text-slate-900 dark:text-white"
                                autoFocus
                              />
                              <button
                                onClick={() => walletInput.trim() && handleWalletCardScan(walletInput)}
                                disabled={walletSearching}
                                className="px-6 py-4 bg-[#7B1C3E] hover:bg-[#681834] text-white rounded-2xl font-bold disabled:opacity-50 shadow-md transition-all active:scale-95"
                              >
                                {walletSearching ? '...' : dict.common.search}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#7B1C3E]/10 rounded-full flex items-center justify-center text-[#7B1C3E] dark:text-pink-400 font-bold text-xl">
                                  {walletStudentName.charAt(0) || '?'}
                                </div>
                                <div>
                                  <p className="font-extrabold text-xl text-slate-900 dark:text-white">{walletStudentName}</p>
                                  <p className="text-sm font-bold text-slate-500 tracking-wider">ID: {walletAccount.student_id}</p>
                                </div>
                              </div>
                              <div className="text-right bg-[#7B1C3E]/5 dark:bg-[#7B1C3E]/10 px-4 py-2 rounded-xl">
                                <p className="text-xs font-bold text-[#7B1C3E] dark:text-pink-400 uppercase tracking-widest mb-1">{dict.wallet.currentBalance}</p>
                                <p className={`text-3xl font-black ${walletAccount.balance < total ? 'text-rose-600' : 'text-[#7B1C3E] dark:text-pink-400'}`}>
                                  {formatCurrency(walletAccount.balance)}
                                </p>
                              </div>
                            </div>

                            {walletAccount.daily_limit !== null && (
                              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <div className="flex justify-between text-sm font-bold mb-3">
                                  <span className="text-slate-500 uppercase tracking-wider">{dict.shop.dailyUsage}</span>
                                  <span className="text-[#7B1C3E] dark:text-pink-400">
                                    {formatCurrency(walletTodaySpend)} / {formatCurrency(walletAccount.daily_limit)}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-200 dark:border-slate-700">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 relative overflow-hidden ${
                                      (walletTodaySpend + total) > walletAccount.daily_limit ? 'bg-rose-600' :
                                      walletTodaySpend / walletAccount.daily_limit > 0.8 ? 'bg-amber-500' : 'bg-[#7B1C3E]'
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
                              className="text-sm font-bold text-[#7B1C3E] dark:text-pink-400 hover:underline transition-colors flex items-center justify-center w-full py-2 hover:bg-[#7B1C3E]/5 rounded-xl"
                            >
                              {dict.shop.changeCard}
                            </button>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex gap-4 backdrop-blur-md">
                <button onClick={() => setShowCheckout(false)} className="w-1/3 py-5 text-xl font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-100 transition-all">
                  {dict.common.cancel}
                </button>
                <button 
                  onClick={handleCheckout} 
                  disabled={isCheckingOut || (paymentMethod === 'wallet' && !walletAccount) || (paymentMethod === 'cash' && typeof cashReceived === 'number' && cashReceived < total)}
                  className="flex-1 py-5 text-2xl font-black text-white bg-[#7B1C3E] hover:bg-[#681834] rounded-2xl disabled:opacity-50 disabled:bg-slate-300 flex justify-center items-center shadow-xl shadow-[#7B1C3E]/20 transition-all active:scale-[0.98]"
                >
                  {isCheckingOut ? (
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                      {isThai ? 'กำลังประมวลผล...' : 'Processing...'}
                    </div>
                  ) : dict.shop.confirmPayment}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
