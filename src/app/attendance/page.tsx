import { headers } from 'next/headers';
import AttendanceClient from './AttendanceClient';

export default async function AttendancePage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-background to-surface py-12 flex flex-col items-center">
      <div className="max-w-lg w-full px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-primary tracking-tight">ลงเวลาทำงาน</h1>
          <p className="text-foreground/60 mt-2 font-medium">บันทึกเวลาเข้า-ออกงานด้วยระบบ GPS</p>
        </div>
        
        <AttendanceClient />
      </div>
    </div>
  );
}
