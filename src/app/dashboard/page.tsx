import { getDailySummary } from '@/lib/supabase/reports';
import DashboardView from './DashboardView';

export default async function DashboardPage() {
  // Get today's summary in YYYY-MM-DD
  const today = new Date();
  // Adjust for local timezone to get local date string
  const offset = today.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(today.getTime() - offset)).toISOString().split('T')[0];
  
  const summary = await getDailySummary(localISOTime);

  // Format date to Thai format
  const thaiDate = new Intl.DateTimeFormat('th-TH', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }).format(today);

  const lastUpdated = new Date().toLocaleTimeString('th-TH');

  return <DashboardView summary={summary} thaiDate={thaiDate} lastUpdated={lastUpdated} />;
}
