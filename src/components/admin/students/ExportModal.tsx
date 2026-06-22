import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

type ExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const personalFields = [
  { id: 'id', label: 'เลขประจำตัวนักเรียน' },
  { id: 'grade', label: 'ชั้นเรียน' },
  { id: 'status', label: 'สถานะนักเรียน' },
  { id: 'prefix', label: 'คำนำหน้า' },
  { id: 'first_name', label: 'ชื่อ' },
  { id: 'last_name', label: 'นามสกุล' },
  { id: 'citizen_id', label: 'เลขประจำตัวประชาชน' },
  { id: 'gender', label: 'เพศ' },
  { id: 'birth_date', label: 'วันเกิด' },
  { id: 'nationality', label: 'สัญชาติ' },
  { id: 'religion', label: 'ศาสนา' },
  { id: 'height', label: 'ส่วนสูง (ซม.)' },
  { id: 'weight', label: 'น้ำหนัก (กก.)' },
  { id: 'wallet_balance', label: 'ยอดเงินคงเหลือ' },
];

const addressFields = [
  { id: 'house_code', label: 'รหัสประจำบ้าน' },
  { id: 'house_number', label: 'บ้านเลขที่' },
  { id: 'moo', label: 'หมู่ที่' },
  { id: 'soi', label: 'ซอย' },
  { id: 'road', label: 'ถนน' },
  { id: 'sub_district', label: 'ตำบล' },
  { id: 'district', label: 'อำเภอ' },
  { id: 'province', label: 'จังหวัด' },
  { id: 'zip_code', label: 'รหัสไปรษณีย์' },
];

const parentFields = [
  { id: 'prefix', label: 'คำนำหน้า' },
  { id: 'first_name', label: 'ชื่อ' },
  { id: 'last_name', label: 'นามสกุล' },
  { id: 'citizen_id', label: 'เลขประจำตัวประชาชน' },
  { id: 'phone_number', label: 'เบอร์โทรศัพท์' },
  { id: 'occupation', label: 'อาชีพ' },
  { id: 'salary', label: 'เงินเดือน' },
];

const gradeOptions = [
  'อ.1/1', 'อ.1/2', 'อ.2/1', 'อ.2/2', 'อ.3/1', 'อ.3/2',
  'ป.1/1', 'ป.1/2', 'ป.2/1', 'ป.2/2', 'ป.3/1', 'ป.3/2',
  'ป.4/1', 'ป.4/2', 'ป.5/1', 'ป.5/2', 'ป.6/1', 'ป.6/2'
];

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const [selectedGrades, setSelectedGrades] = useState<string[]>(gradeOptions);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['personal']);

  // Selected fields state
  const [selectedPersonal, setSelectedPersonal] = useState<string[]>(personalFields.map(f => f.id));
  const [selectedAddress, setSelectedAddress] = useState<string[]>([]);
  const [selectedFather, setSelectedFather] = useState<string[]>([]);
  const [selectedMother, setSelectedMother] = useState<string[]>([]);
  const [selectedGuardian, setSelectedGuardian] = useState<string[]>([]);

  const toggleSection = (sec: string) => {
    setExpandedSections(prev => 
      prev.includes(sec) ? prev.filter(s => s !== sec) : [...prev, sec]
    );
  };

  const handleCheckboxToggle = (
    id: string, 
    list: string[], 
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = (
    items: { id: string }[], 
    list: string[], 
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (list.length === items.length) {
      setList([]);
    } else {
      setList(items.map(i => i.id));
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    const toastId = toast.loading('กำลังรวบรวมข้อมูลเพื่อส่งออก...');
    try {
      // 1. Fetch data
      const gradeQuery = selectedGrades.length === gradeOptions.length ? 'all' : selectedGrades.join(',');
      const res = await fetch(`/api/admin/students?limit=10000&grade=${encodeURIComponent(gradeQuery)}`);
      if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลได้');
      const json = await res.json();
      const students = Array.isArray(json) ? json : (json.data || []);

      if (students.length === 0) {
        toast.error('ไม่พบข้อมูลนักเรียนในหมวดนี้', { id: toastId });
        setIsExporting(false);
        return;
      }

      // 2. Prepare headers
      const headers: string[] = [];
      const keysMap: { [key: string]: (s: any) => string } = {};

      personalFields.forEach(f => {
        if (selectedPersonal.includes(f.id)) {
          headers.push(f.label);
          keysMap[f.label] = (s: any) => s[f.id] || '';
        }
      });

      addressFields.forEach(f => {
        if (selectedAddress.includes(f.id)) {
          headers.push(`[ที่อยู่] ${f.label}`);
          keysMap[`[ที่อยู่] ${f.label}`] = (s: any) => {
            const addr = s.student_addresses?.[0];
            return addr ? addr[f.id] || '' : '';
          };
        }
      });

      const addParentFields = (role: string, selectedArr: string[]) => {
        parentFields.forEach(f => {
          if (selectedArr.includes(f.id)) {
            headers.push(`[${role}] ${f.label}`);
            keysMap[`[${role}] ${f.label}`] = (s: any) => {
              const p = s.student_parents?.find((x: any) => x.relationship === role);
              return p ? p[f.id] || '' : '';
            };
          }
        });
      };

      addParentFields('บิดา', selectedFather);
      addParentFields('มารดา', selectedMother);
      addParentFields('ผู้ปกครอง', selectedGuardian);

      if (headers.length === 0) {
        toast.error('กรุณาเลือกฟิลด์ข้อมูลอย่างน้อย 1 รายการ', { id: toastId });
        setIsExporting(false);
        return;
      }

      // 3. Generate CSV rows
      const escapeCsv = (str: any) => {
        if (str === null || str === undefined) return '';
        const s = String(str);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const csvRows = [];
      csvRows.push(headers.map(escapeCsv).join(','));

      students.forEach((s: any) => {
        const row = headers.map(h => escapeCsv(keysMap[h](s)));
        csvRows.push(row.join(','));
      });

      const csvString = '\uFEFF' + csvRows.join('\n'); // Add BOM for Excel UTF-8 support

      // 4. Download file
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const isAllGrades = selectedGrades.length === gradeOptions.length;
      link.setAttribute('download', `students_export_${isAllGrades ? 'all' : selectedGrades.join('_')}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('ดาวน์โหลดไฟล์ CSV สำเร็จ!', { id: toastId });
      onClose();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาดในการส่งออก', { id: toastId, description: err.message });
    } finally {
      setIsExporting(false);
    }
  };

  const renderFieldGroup = (
    title: string, 
    key: string, 
    fields: {id: string, label: string}[], 
    selectedList: string[], 
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const isExpanded = expandedSections.includes(key);
    const isAllSelected = selectedList.length === fields.length && fields.length > 0;

    return (
      <div className="border border-foreground/10 rounded-xl overflow-hidden mb-3 bg-surface shadow-sm">
        <div 
          className="p-3 flex items-center justify-between cursor-pointer hover:bg-foreground/[0.02] transition-colors"
          onClick={() => toggleSection(key)}
        >
          <div className="flex items-center gap-3 font-bold text-foreground/80">
            {isExpanded ? <ChevronDown className="w-5 h-5 text-primary" /> : <ChevronRight className="w-5 h-5" />}
            {title}
            <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {selectedList.length}/{fields.length}
            </span>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); handleSelectAll(fields, selectedList, setList); }}
            className="text-xs text-primary font-bold hover:underline"
          >
            {isAllSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
          </button>
        </div>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-3 pb-3 grid grid-cols-2 md:grid-cols-3 gap-2"
            >
              {fields.map(f => (
                <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-foreground/5 p-1.5 rounded transition-colors group">
                  <input 
                    type="checkbox" 
                    checked={selectedList.includes(f.id)}
                    onChange={() => handleCheckboxToggle(f.id, selectedList, setList)}
                    className="w-4 h-4 rounded border-foreground/20 text-primary focus:ring-primary/20 bg-background accent-primary"
                  />
                  <span className="text-foreground/80 group-hover:text-primary transition-colors">{f.label}</span>
                </label>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-3xl max-h-[90vh] bg-surface/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl overflow-hidden flex flex-col font-sans"
          >
            <div className="flex items-center justify-between p-6 border-b border-foreground/10 bg-surface/50">
              <div className="flex items-center gap-3 text-primary">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Export นักเรียนเป็น CSV</h2>
                  <p className="text-xs text-foreground/50 font-medium mt-0.5">เลือกข้อมูลที่ต้องการส่งออกไปใช้งานบน Excel/Numbers</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 bg-foreground/5 hover:bg-foreground/10 text-foreground/60 rounded-full transition-colors active:scale-95">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div>
                <label className="block text-sm font-bold text-foreground/70 mb-3">ตัวกรองชั้นเรียน</label>
                {renderFieldGroup(
                  'เลือกชั้นเรียนที่ต้องการ', 
                  'grades', 
                  gradeOptions.map(g => ({ id: g, label: g })), 
                  selectedGrades, 
                  setSelectedGrades
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground/70 mb-3">ข้อมูลที่ต้องการส่งออก (Fields)</label>
                <div className="space-y-1">
                  {renderFieldGroup('ข้อมูลส่วนตัว', 'personal', personalFields, selectedPersonal, setSelectedPersonal)}
                  {renderFieldGroup('ข้อมูลที่อยู่', 'address', addressFields, selectedAddress, setSelectedAddress)}
                  {renderFieldGroup('ข้อมูลครอบครัว (บิดา)', 'father', parentFields, selectedFather, setSelectedFather)}
                  {renderFieldGroup('ข้อมูลครอบครัว (มารดา)', 'mother', parentFields, selectedMother, setSelectedMother)}
                  {renderFieldGroup('ข้อมูลครอบครัว (ผู้ปกครองหลัก)', 'guardian', parentFields, selectedGuardian, setSelectedGuardian)}
                </div>
              </div>

            </div>

            <div className="p-6 border-t border-foreground/10 bg-surface flex justify-end gap-3 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
              <button 
                onClick={onClose}
                className="px-6 py-3 font-bold text-foreground/60 bg-foreground/5 hover:bg-foreground/10 rounded-xl transition-all active:scale-95"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleExport}
                disabled={isExporting || (selectedPersonal.length + selectedAddress.length + selectedFather.length + selectedMother.length + selectedGuardian.length === 0)}
                className="flex items-center gap-2 px-8 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-5 h-5" /> {isExporting ? 'กำลังส่งออก...' : 'ดาวน์โหลดไฟล์ CSV'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
