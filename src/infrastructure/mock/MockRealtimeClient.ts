import { LIVE_NAMES, MOCK_CHURCH_ID } from './mockData'

export interface IRealtimePayload {
  new: Record<string, unknown>
}

export type RealtimeCallback = (payload: IRealtimePayload) => void

export interface IRealtimeChannel {
  on(type: string, filter: Record<string, unknown>, callback: RealtimeCallback): IRealtimeChannel
  subscribe(): IRealtimeChannel
}

export interface IRealtimeClient {
  channel(name: string): IRealtimeChannel
  removeChannel(channel: IRealtimeChannel): Promise<unknown>
}

const SIMULATE_INTERVAL_MS = 9_000
let liveNameIndex = 0

export class MockRealtimeClient implements IRealtimeClient {
  private intervals = new Map<IRealtimeChannel, ReturnType<typeof setInterval>>()

  channel(_name: string): IRealtimeChannel {
    let storedCallback: RealtimeCallback | null = null

    const ch: IRealtimeChannel = {
      on(_type, _filter, callback) {
        storedCallback = callback
        return ch
      },
      subscribe: () => {
        const interval = setInterval(() => {
          if (!storedCallback) return
          const name = LIVE_NAMES[liveNameIndex % LIVE_NAMES.length]
          liveNameIndex++
          const row = {
            id: crypto.randomUUID(),
            church_id: MOCK_CHURCH_ID,
            name,
            committed_at: new Date().toISOString(),
            reminder_active: true,
            last_reminded_at: null,
          }
          storedCallback({ new: row })
        }, SIMULATE_INTERVAL_MS)

        this.intervals.set(ch, interval)
        return ch
      },
    }

    return ch
  }

  removeChannel(channel: IRealtimeChannel): Promise<unknown> {
    const interval = this.intervals.get(channel)
    if (interval !== undefined) {
      clearInterval(interval)
      this.intervals.delete(channel)
    }
    return Promise.resolve('ok')
  }
}
