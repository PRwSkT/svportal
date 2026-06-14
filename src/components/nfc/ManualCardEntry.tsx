'use client'

import { useState, type FormEvent } from 'react'

interface ManualCardEntryProps {
  onSubmit: (value: string) => void
  isLoading?: boolean
}

export function ManualCardEntry({ onSubmit, isLoading = false }: ManualCardEntryProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed.length === 0) return
    onSubmit(trimmed)
    setValue('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md items-center gap-2"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="กรอก UID บัตรหรือรหัสนักเรียน" // 4–5 digit numeric string
        disabled={isLoading}
        className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5
                   text-sm text-gray-900 placeholder-gray-400
                   shadow-sm transition
                   focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30
                   disabled:cursor-not-allowed disabled:opacity-60"
      />

      <button
        type="submit"
        disabled={isLoading || value.trim().length === 0}
        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5
                   text-sm font-semibold text-white shadow-sm transition
                   hover:bg-blue-700
                   focus:outline-none focus:ring-2 focus:ring-blue-500/30
                   disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          'ค้นหา'
        )}
      </button>
    </form>
  )
}
