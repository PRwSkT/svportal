/**
 * NFCReaderService — unified interface for all NFC reader backends
 *
 * Supported modes:
 *   'hid'    – USB reader that emulates keyboard (types UID + Enter)
 *   'serial' – USB reader connected via Web Serial API (COM port)
 *   'manual' – Fallback: user types UID / student_id manually
 */
export interface NFCReaderService {
  /** ตรวจสอบว่าตัวอ่านบัตรพร้อมใช้งานหรือไม่ */
  isAvailable(): Promise<boolean>

  /** เริ่มฟังการแตะบัตร — เรียก callback เมื่ออ่าน UID ได้ */
  startListening(onCardRead: (uid: string) => void): Promise<void>

  /** หยุดฟังและทำความสะอาดทรัพยากร */
  stopListening(): void

  /** โหมดการทำงานปัจจุบัน */
  getMode(): 'hid' | 'serial' | 'manual'
}
