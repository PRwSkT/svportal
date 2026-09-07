import type { NFCReaderService } from './reader';

/**
 * HIDKeyboardReader
 *
 * Modern keyboard-wedge RFID reader handler that uses window-level key events
 * and timing heuristics without stealing focus from interactive form inputs.
 */
export class HIDKeyboardReader implements NFCReaderService {
  private onCardRead: ((uid: string) => void) | null = null;
  private buffer: string = '';
  private lastKeyTime: number = 0;
  private listening = false;
  private readonly MAX_INTERVAL_MS = 100; // Keystrokes faster than this are from a scanner

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined';
  }

  async startListening(onCardRead: (uid: string) => void): Promise<void> {
    if (this.listening) return;
    this.onCardRead = onCardRead;
    this.listening = true;
    this.buffer = '';
    this.lastKeyTime = 0;

    window.addEventListener('keydown', this.handleKeyDown, true);
  }

  stopListening(): void {
    this.listening = false;
    this.buffer = '';
    this.lastKeyTime = 0;
    this.onCardRead = null;

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown, true);
    }
  }

  getMode(): 'hid' {
    return 'hid';
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.listening) return;

    const target = event.target as HTMLElement | null;
    const isEditingInput =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    // If typing inside an active form input, don't hijack unless it's a designated scanner input
    if (isEditingInput && !target?.dataset.nfcScanner) {
      return;
    }

    const now = Date.now();
    const isRapid = this.lastKeyTime === 0 || now - this.lastKeyTime <= this.MAX_INTERVAL_MS;
    this.lastKeyTime = now;

    if (event.key === 'Enter') {
      if (this.buffer.length >= 4 && this.onCardRead) {
        event.preventDefault();
        event.stopPropagation();
        const uid = this.buffer.trim().toUpperCase();
        this.buffer = '';
        this.onCardRead(uid);
      } else {
        this.buffer = '';
      }
      return;
    }

    // Accumulate printable characters
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      if (!isRapid && this.buffer.length > 0) {
        // Slow typing reset
        this.buffer = '';
      }
      this.buffer += event.key;
    }
  };
}
