import { getDailySummary } from '@/lib/supabase/reports';
import { DashboardRefresh } from '@/components/DashboardRefresh';

// Format currency
const formatTHB = (amount: number) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
};

export default async function DashboardPage() {
  // Get today's summary in YYYY-MM-DD
  const today = new Date();
  // Adjust for local timezone to get local date string
  const offset = today.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(today.getTime() - offset)).toISOString().split('T')[0];
  
  const summary = await getDailySummary(localISOTime);

  // Format date to Thai format (พ.ศ. is built into 'th-TH' if Buddhist calendar is specified, usually default for th-TH)
  const thaiDate = new Intl.DateTimeFormat('th-TH', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }).format(today);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <DashboardRefresh intervalMs={15000} /> {/* Refresh every 15s */}
      
      <div>
        <h1 className="text-3xl font-bold text-gray-900">แดชบอร์ดสรุปยอดประจำวัน</h1>
        <p className="text-gray-500 mt-2">ข้อมูล ณ วันที่ {thaiDate}</p>
      </div>

      {/* Top Level Summary */}
      <div className="bg-white rounded-2xl shadow-sm border p-8 flex items-center justify-between">
        <div>
          <p className="text-lg font-medium text-gray-500">ยอดรับรวมทั้งสิ้น</p>
          <p className="text-5xl font-extrabold text-blue-600 mt-2">{formatTHB(summary.total_received)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">อัปเดตล่าสุด: {new Date().toLocaleTimeString('th-TH')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tuition Fees */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition-shadow">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
            ค่าเทอม
          </h2>
          <div className="space-y-2">
            <p className="text-3xl font-bold text-gray-900">{formatTHB(summary.tuition_amount)}</p>
            <p className="text-sm text-gray-500">{summary.tuition_count} รายการ</p>
          </div>
        </div>

        {/* Co-op Shop */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition-shadow">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            ร้านสหกรณ์
          </h2>
          <div className="space-y-2">
            <p className="text-3xl font-bold text-gray-900">{formatTHB(summary.shop_amount)}</p>
            <p className="text-sm text-gray-500">{summary.shop_count} รายการ</p>
          </div>
        </div>

        {/* Wallet Topup */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition-shadow">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            เติมเงิน Wallet
          </h2>
          <div className="space-y-2">
            <p className="text-3xl font-bold text-gray-900">{formatTHB(summary.topup_amount)}</p>
            <p className="text-sm text-gray-500">{summary.topup_count} รายการ</p>
          </div>
        </div>
      </div>
    </div>
  );
}
