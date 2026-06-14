'use client'

import { useState } from 'react'
import { ManualCardEntry } from './ManualCardEntry'

interface NFCTapPromptProps {
  onCardRead: (uid: string) => void
  onManualEntry: (value: string) => void
  onCancel: () => void
  mode: 'hid' | 'serial' | 'manual'
}

/** Human‑readable Thai labels for each mode */
const MODE_LABELS: Record<NFCTapPromptProps['mode'], string> = {
  hid: 'HID คีย์บอร์ด',
  serial: 'Serial พอร์ต',
  manual: 'กรอกด้วยตนเอง',
}

/** Badge colour per mode */
const MODE_COLOURS: Record<NFCTapPromptProps['mode'], string> = {
  hid: 'bg-emerald-100 text-emerald-700',
  serial: 'bg-sky-100 text-sky-700',
  manual: 'bg-amber-100 text-amber-700',
}

export function NFCTapPrompt({
  onCardRead,
  onManualEntry,
  onCancel,
  mode,
}: NFCTapPromptProps) {
  const [showManual, setShowManual] = useState(mode === 'manual')

  return (
    <div className="relative flex w-full flex-col items-center justify-center gap-8 rounded-2xl bg-white px-6 py-12 shadow-lg">
      {/* ─── Mode badge ─── */}
      <span
        className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-medium ${MODE_COLOURS[mode]}`}
      >
        {MODE_LABELS[mode]}
      </span>

      {showManual ? (
        /* ─── Manual entry view ─── */
        <div className="flex w-full flex-col items-center gap-6">
          <h2 className="text-lg font-semibold text-gray-800">
            กรอกข้อมูลด้วยตนเอง
          </h2>

          <ManualCardEntry onSubmit={onManualEntry} />

          <button
            type="button"
            onClick={() => setShowManual(false)}
            className="text-sm text-blue-600 underline-offset-2 transition hover:underline"
          >
            กลับไปแตะบัตร
          </button>
        </div>
      ) : (
        /* ─── NFC waiting view ─── */
        <div className="flex flex-col items-center gap-6">
          {/* Animated card icon */}
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-blue-50">
            <span
              className="animate-pulse text-6xl"
              role="img"
              aria-label="บัตร NFC"
            >
              💳
            </span>
          </div>

          <p className="text-center text-2xl font-bold text-gray-800">
            แตะบัตรนักเรียน
          </p>

          <p className="text-sm text-gray-500">
            วางบัตรนักเรียนบนเครื่องอ่านเพื่อเริ่มทำรายการ
          </p>

          {/* Manual entry toggle */}
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="text-sm text-blue-600 underline-offset-2 transition hover:underline"
          >
            กรอกรหัสด้วยตนเอง
          </button>
        </div>
      )}

      {/* ─── Cancel button (always visible) ─── */}
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-600
                   transition hover:bg-gray-100
                   focus:outline-none focus:ring-2 focus:ring-gray-300/50"
      >
        ยกเลิก
      </button>
    </div>
  )
}
