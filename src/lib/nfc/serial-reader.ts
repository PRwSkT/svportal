import type { NFCReaderService } from './reader'

/* ------------------------------------------------------------------ */
/*  Web Serial API type shims (not in standard lib)                    */
/* ------------------------------------------------------------------ */

interface SerialPort {
  open(options: SerialOptions): Promise<void>
  close(): Promise<void>
  readonly readable: ReadableStream<Uint8Array> | null
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface SerialOptions {
  baudRate: number
  dataBits?: number
  stopBits?: number
  parity?: 'none' | 'even' | 'odd'
  bufferSize?: number
  flowControl?: 'none' | 'hardware'
}

interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[]
}

interface SerialPortFilter {
  usbVendorId?: number
  usbProductId?: number
}

/** Extend Navigator so we can type‑assert `navigator.serial` */
interface NavigatorWithSerial extends Navigator {
  serial?: Serial
}

/* ------------------------------------------------------------------ */
/*  SerialNFCReader                                                    */
/* ------------------------------------------------------------------ */

const DEFAULT_BAUD_RATE = 9600

export class SerialNFCReader implements NFCReaderService {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private onCardRead: ((uid: string) => void) | null = null
  private listening = false
  private abortController: AbortController | null = null

  /* ---------------------------------------------------------------- */
  /*  NFCReaderService                                                 */
  /* ---------------------------------------------------------------- */

  async isAvailable(): Promise<boolean> {
    return typeof navigator !== 'undefined' && 'serial' in navigator
  }

  async startListening(onCardRead: (uid: string) => void): Promise<void> {
    if (this.listening) return

    const nav = navigator as NavigatorWithSerial
    if (!nav.serial) {
      throw new Error('Web Serial API ไม่พร้อมใช้งานในเบราว์เซอร์นี้')
    }

    this.onCardRead = onCardRead
    this.port = await nav.serial.requestPort()
    await this.port.open({ baudRate: DEFAULT_BAUD_RATE })

    this.listening = true
    this.abortController = new AbortController()

    // Listen for unexpected disconnect
    this.port.addEventListener('disconnect', this.handleDisconnect)

    // Start the read loop (runs in background, does not block)
    this.readLoop().catch((err: unknown) => {
      // Only log if we haven't intentionally stopped
      if (this.listening) {
        console.error('[SerialNFCReader] อ่านข้อมูลผิดพลาด:', err)
      }
    })
  }

  stopListening(): void {
    this.listening = false
    this.onCardRead = null

    // Cancel the read stream
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    // Release the reader lock before closing the port
    if (this.reader) {
      this.reader.cancel().catch(() => {
        /* swallow — port may already be closed */
      })
      this.reader = null
    }

    if (this.port) {
      this.port.removeEventListener('disconnect', this.handleDisconnect)
      this.port.close().catch(() => {
        /* swallow — port may already be closed */
      })
      this.port = null
    }
  }

  getMode(): 'serial' {
    return 'serial'
  }

  /* ---------------------------------------------------------------- */
  /*  Internal                                                         */
  /* ---------------------------------------------------------------- */

  private handleDisconnect = (): void => {
    console.warn('[SerialNFCReader] พอร์ตถูกถอดออก')
    this.stopListening()
  }

  /**
   * Continuously read bytes from the serial port and accumulate
   * until a newline (\n) or carriage‑return (\r) is received.
   */
  private async readLoop(): Promise<void> {
    if (!this.port?.readable) return

    const decoder = new TextDecoder()
    let buffer = ''

    this.reader = this.port.readable.getReader()

    try {
      while (this.listening) {
        const { value, done } = await this.reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Split on CR / LF / CRLF
        let newlineIdx: number
        while (
          (newlineIdx = buffer.search(/\r\n|\r|\n/)) !== -1
        ) {
          const line = buffer.slice(0, newlineIdx)
          // Skip the matched newline character(s)
          const match = buffer.slice(newlineIdx).match(/^\r\n|\r|\n/)
          buffer = buffer.slice(newlineIdx + (match?.[0].length ?? 1))

          const uid = line.trim().toUpperCase()
          if (uid.length > 0 && this.onCardRead) {
            this.onCardRead(uid)
          }
        }
      }
    } finally {
      this.reader.releaseLock()
      this.reader = null
    }
  }
}
