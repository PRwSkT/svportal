export type { NFCReaderService } from './reader'
export { HIDKeyboardReader } from './hid-reader'
export { SerialNFCReader } from './serial-reader'

import { HIDKeyboardReader } from './hid-reader'
import { SerialNFCReader } from './serial-reader'
import type { NFCReaderService } from './reader'

/**
 * createNFCReader — factory ที่เลือกตัวอ่านบัตร NFC ที่เหมาะสม
 *
 * ลำดับการลอง:
 *  1. Web Serial API (ถ้าเบราว์เซอร์รองรับ และผู้ใช้อนุญาต)
 *  2. HID Keyboard mode (ใช้ได้เสมอในเบราว์เซอร์)
 */
export async function createNFCReader(): Promise<NFCReaderService> {
  // --- Try Web Serial first ---
  const serialReader = new SerialNFCReader()
  const serialAvailable = await serialReader.isAvailable()

  if (serialAvailable) {
    try {
      // We return the reader; actual port selection happens on startListening()
      return serialReader
    } catch {
      // Fall through to HID if Serial setup fails
      console.warn(
        '[createNFCReader] Web Serial ไม่สามารถเริ่มได้ — ใช้ HID แทน',
      )
    }
  }

  // --- Fallback: HID keyboard mode (always available) ---
  return new HIDKeyboardReader()
}
