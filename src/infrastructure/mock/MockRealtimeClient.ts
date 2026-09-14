import { LIVE_NAMES, MOCK_WALL_ID, MOCK_GIVING_WALL_ID } from './mockData'

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
const SIMULATED_AMOUNTS_CENTS = [1000, 2500, 5000, 10000, 25000]
let liveNameIndex = 0

interface Subscription {
  table: string
  callback: RealtimeCallback
}

function nextLiveName(): string {
  const name = LIVE_NAMES[liveNameIndex % LIVE_NAMES.length]
  liveNameIndex++
  return name
}

/** Row shapes mirror the Postgres columns the realtime hooks expect. */
function simulatedRow(table: string): Record<string, unknown> | null {
  if (table === 'commitments') {
    return {
      id: crypto.randomUUID(),
      wall_id: MOCK_WALL_ID,
      name: nextLiveName(),
      committed_at: new Date().toISOString(),
      reminder_active: true,
      last_reminded_at: null,
    }
  }
  if (table === 'donations') {
    return {
      id: crypto.randomUUID(),
      giving_wall_id: MOCK_GIVING_WALL_ID,
      name: nextLiveName(),
      amount_cents: SIMULATED_AMOUNTS_CENTS[Math.floor(Math.random() * SIMULATED_AMOUNTS_CENTS.length)],
      currency: 'usd',
      processor_ref: null,
      email_opt_out: false,
      donated_at: new Date().toISOString(),
    }
  }
  return null
}

export class MockRealtimeClient implements IRealtimeClient {
  private subscriptions = new Map<IRealtimeChannel, Subscription>()
  private intervals = new Map<IRealtimeChannel, ReturnType<typeof setInterval>>()

  channel(_name: string): IRealtimeChannel {
    const ch: IRealtimeChannel = {
      on: (_type, filter, callback) => {
        this.subscriptions.set(ch, { table: String(filter.table ?? ''), callback })
        return ch
      },
      subscribe: () => {
        const sub = this.subscriptions.get(ch)
        if (!sub) return ch

        const interval = setInterval(() => {
          const row = simulatedRow(sub.table)
          if (row) sub.callback({ new: row })
        }, SIMULATE_INTERVAL_MS)

        this.intervals.set(ch, interval)
        return ch
      },
    }

    return ch
  }

  /**
   * Push a row to every subscriber of `table`. Lets MockPaymentGateway deliver a
   * simulated donation by the same route production uses (webhook → INSERT →
   * realtime), so no presentation code needs a mock-only code path.
   */
  emitInsert(table: string, row: Record<string, unknown>): void {
    for (const sub of this.subscriptions.values()) {
      if (sub.table === table) sub.callback({ new: row })
    }
  }

  removeChannel(channel: IRealtimeChannel): Promise<unknown> {
    const interval = this.intervals.get(channel)
    if (interval !== undefined) {
      clearInterval(interval)
      this.intervals.delete(channel)
    }
    this.subscriptions.delete(channel)
    return Promise.resolve('ok')
  }
}
