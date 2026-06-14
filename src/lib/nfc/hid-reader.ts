import type { NFCReaderService } from './reader'

/**
 * HIDKeyboardReader
 *
 * Most USB NFC readers emulate a keyboard: they type the card UID as
 * a rapid sequence of keystrokes and finish with Enter.
 *
 * Strategy:
 *  1. Create a hidden <input> and keep it focused.
 *  2. On each keystroke reset a 100 ms debounce timer.
 *  3. When Enter fires (or the debounce expires with content) treat
 *     the accumulated value as a card UID.
 */

/** Threshold (ms) — keystrokes arriving faster than this are from a scanner */
const DEBOUNCE_MS = 100

export class HIDKeyboardReader implements NFCReaderService {
  private hiddenInput: HTMLInputElement | null = null
  private onCardRead: ((uid: string) => void) | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private listening = false

  /* ------------------------------------------------------------------ */
  /*  NFCReaderService                                                   */
  /* ------------------------------------------------------------------ */

  async isAvailable(): Promise<boolean> {
    // HID keyboard mode is always available inside a browser
    return typeof document !== 'undefined'
  }

  async startListening(onCardRead: (uid: string) => void): Promise<void> {
    if (this.listening) return
    this.onCardRead = onCardRead
    this.listening = true

    this.hiddenInput = document.createElement('input')
    const input = this.hiddenInput

    // Make the element invisible but still focusable
    Object.assign(input.style, {
      position: 'fixed',
      top: '-9999px',
      left: '-9999px',
      opacity: '0',
      width: '0',
      height: '0',
      border: 'none',
      outline: 'none',
    } satisfies Partial<CSSStyleDeclaration>)

    input.setAttribute('aria-hidden', 'true')
    input.setAttribute('tabindex', '-1')
    input.setAttribute('autocomplete', 'off')

    document.body.appendChild(input)
    input.focus()

    input.addEventListener('keydown', this.handleKeyDown)
    input.addEventListener('input', this.handleInput)

    // Re-focus when the element loses focus (e.g. user clicks elsewhere)
    input.addEventListener('blur', this.refocus)
  }

  stopListening(): void {
    this.listening = false
    this.clearDebounce()

    if (this.hiddenInput) {
      this.hiddenInput.removeEventListener('keydown', this.handleKeyDown)
      this.hiddenInput.removeEventListener('input', this.handleInput)
      this.hiddenInput.removeEventListener('blur', this.refocus)
      this.hiddenInput.remove()
      this.hiddenInput = null
    }

    this.onCardRead = null
  }

  getMode(): 'hid' {
    return 'hid'
  }

  /* ------------------------------------------------------------------ */
  /*  Internal handlers                                                  */
  /* ------------------------------------------------------------------ */

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      this.flushUID()
    }
  }

  private handleInput = (): void => {
    this.resetDebounce()
  }

  /** Keep the hidden input focused so keystrokes land here */
  private refocus = (): void => {
    if (this.listening && this.hiddenInput) {
      // Small delay prevents focus‑fight loops with other UI elements
      setTimeout(() => this.hiddenInput?.focus(), 10)
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Debounce helpers                                                   */
  /* ------------------------------------------------------------------ */

  private resetDebounce(): void {
    this.clearDebounce()
    this.debounceTimer = setTimeout(() => this.flushUID(), DEBOUNCE_MS)
  }

  private clearDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  /** Normalize & emit whatever has been accumulated so far */
  private flushUID(): void {
    this.clearDebounce()

    const raw = this.hiddenInput?.value ?? ''
    const uid = raw.trim().toUpperCase()

    if (uid.length > 0 && this.onCardRead) {
      this.onCardRead(uid)
    }

    // Clear for next scan
    if (this.hiddenInput) {
      this.hiddenInput.value = ''
    }
  }
}
