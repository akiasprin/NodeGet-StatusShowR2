import { useEffect, useMemo, useState } from 'react'
import { BackendPool } from '../api/pool'
import { dynamicSummaryMulti } from '../api/methods'
import { httpRpcCall } from '../api/client'
import { isOnline } from '../utils/status'
import type { DynamicSummary, HistorySample, Node, NodeMeta, SiteConfig, StaticData } from '../types'

type Agent = Pick<Node, 'uuid' | 'source' | 'meta' | 'static' | 'trafficBaseline'>

interface BackendError {
  source: string
  error: unknown
}

const STATIC_FIELDS = ['cpu', 'system']
const DYNAMIC_FIELDS = [
  'cpu_usage',
  'used_memory',
  'total_memory',
  'available_memory',
  'used_swap',
  'total_swap',
  'total_space',
  'available_space',
  'read_speed',
  'write_speed',
  'receive_speed',
  'transmit_speed',
  'total_received',
  'total_transmitted',
  'load_one',
  'load_five',
  'load_fifteen',
  'uptime',
  'boot_time',
  'process_count',
  'tcp_connections',
  'udp_connections',
]
const META_KEYS = [
  'metadata_name',
  'metadata_region',
  'metadata_tags',
  'metadata_hidden',
  'metadata_virtualization',
  'metadata_latitude',
  'metadata_longitude',
  'metadata_order',
  'metadata_price',
  'metadata_price_unit',
  'metadata_price_cycle',
  'metadata_expire_time',
  'metadata_traffic_limit_gb',
  'metadata_traffic_price_per_gb',
  'metadata_traffic_period',
  'metadata_traffic_start_date',
]
const DYN_INTERVAL_MS = 2000
const HISTORY_LIMIT = 300

function emptyMeta(): NodeMeta {
  return {
    name: '',
    region: '',
    tags: [],
    hidden: false,
    virtualization: '',
    lat: null,
    lng: null,
    order: 0,
    price: 0,
    priceUnit: '$',
    priceCycle: 30,
    expireTime: '',
    trafficLimitGb: 0,
    trafficPricePerGb: 0,
    trafficPeriod: '1m',
    trafficStartDate: '',
  }
}

function blankAgent(uuid: string, source: string): Agent {
  return { uuid, source, meta: emptyMeta(), static: {} }
}

function parseMeta(raw: Record<string, unknown>): NodeMeta {
  const lat = Number(raw.metadata_latitude)
  const lng = Number(raw.metadata_longitude)
  const order = Number(raw.metadata_order)
  const price = Number(raw.metadata_price)
  const cycle = Number(raw.metadata_price_cycle)
  return {
    name: raw.metadata_name ? String(raw.metadata_name) : '',
    region: raw.metadata_region ? String(raw.metadata_region) : '',
    tags: Array.isArray(raw.metadata_tags) ? raw.metadata_tags.filter(Boolean) : [],
    hidden: Boolean(raw.metadata_hidden),
    virtualization: raw.metadata_virtualization ? String(raw.metadata_virtualization) : '',
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    order: Number.isFinite(order) ? order : 0,
    price: Number.isFinite(price) ? price : 0,
    priceUnit: raw.metadata_price_unit ? String(raw.metadata_price_unit) : '$',
    priceCycle: Number.isFinite(cycle) && cycle > 0 ? cycle : 30,
    expireTime: raw.metadata_expire_time ? String(raw.metadata_expire_time) : '',
    trafficLimitGb: Number(raw.metadata_traffic_limit_gb) || 0,
    trafficPricePerGb: Number(raw.metadata_traffic_price_per_gb) || 0,
    trafficPeriod: raw.metadata_traffic_period ? String(raw.metadata_traffic_period) : '1m',
    trafficStartDate: raw.metadata_traffic_start_date ? String(raw.metadata_traffic_start_date) : '',
  }
}

function parseTrafficBaseline(raw: Record<string, unknown>): Node['trafficBaseline'] {
  const v = raw.traffic_baseline
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const rx = Number(o.rx)
  const tx = Number(o.tx)
  const adjustRx = Number(o.adjust_rx)
  const adjustTx = Number(o.adjust_tx)
  if (!Number.isFinite(rx) || !Number.isFinite(tx)) return undefined
  return {
    rx,
    tx,
    adjustRx: Number.isFinite(adjustRx) ? adjustRx : 0,
    adjustTx: Number.isFinite(adjustTx) ? adjustTx : 0,
  }
}

function sampleFrom(row: DynamicSummary): HistorySample {
  const memTotal = row.total_memory || 0
  const diskTotal = row.total_space || 0
  return {
    t: row.timestamp,
    cpu: row.cpu_usage ?? null,
    mem: memTotal && row.used_memory != null ? (row.used_memory / memTotal) * 100 : null,
    disk:
      diskTotal && row.available_space != null
        ? ((diskTotal - row.available_space) / diskTotal) * 100
        : null,
    netIn: row.receive_speed ?? 0,
    netOut: row.transmit_speed ?? 0,
  }
}

export function useNodes(config: SiteConfig | null) {
  const [agents, setAgents] = useState<Map<string, Agent>>(new Map())
  const [live, setLive] = useState<Map<string, DynamicSummary>>(new Map())
  const [history, setHistory] = useState<Map<string, HistorySample[]>>(new Map())
  const [errors, setErrors] = useState<BackendError[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [pool, setPool] = useState<BackendPool | null>(null)

  useEffect(() => {
    if (!config?.site_tokens?.length) {
      setLoading(false)
      return
    }
    setLoading(true)
    const pool = new BackendPool(config.site_tokens)
    setPool(pool)
    const sourceUuids = new Map<string, string[]>()

    const bootstrap = async () => {
      // HTTP POST 复用页面已有 HTTPS 连接，省掉 WSS TLS 握手
      const uuidList: { source: string; rows: string[] }[] = []
      const uuidErrors: { source: string; error: unknown }[] = []
      await Promise.allSettled(
        pool.entries.map(async entry => {
          try {
            const res = await httpRpcCall<{ uuids?: string[] }>(
              entry.client.url, entry.client.token, 'nodeget-server_list_all_agent_uuid', {},
            )
            uuidList.push({ source: entry.name, rows: res?.uuids || [] })
          } catch (e) {
            uuidErrors.push({ source: entry.name, error: e })
          }
        }),
      )
      setErrors(prev => [...prev, ...uuidErrors])

      const seed = new Map<string, Agent>()
      for (const { source, rows } of uuidList) {
        const uuids = rows ?? []
        sourceUuids.set(source, uuids)
        for (const uuid of uuids) seed.set(uuid, blankAgent(uuid, source))
      }
      setAgents(seed)

      await Promise.all(
        pool.entries.map(async entry => {
          const uuids = sourceUuids.get(entry.name) || []
          if (!uuids.length) return

          const { url, token, name } = entry.client
          const kvItems = uuids.flatMap(u => META_KEYS.map(k => ({ namespace: u, key: k })))
          const baselineItems = uuids.map(u => ({ namespace: u, key: 'traffic_baseline' }))
          const [meta, stat, dyn, baseline] = await Promise.allSettled([
            httpRpcCall<{ namespace: string; key: string; value: unknown }[]>(
              url, token, 'kv_get_multi_value', { namespace_key: kvItems },
            ),
            httpRpcCall<StaticData[]>(
              url, token, 'agent_static_data_multi_last_query', { uuids, fields: STATIC_FIELDS },
            ),
            httpRpcCall<DynamicSummary[]>(
              url, token, 'agent_dynamic_summary_multi_last_query', { uuids, fields: DYNAMIC_FIELDS },
            ),
            httpRpcCall<{ namespace: string; key: string; value: unknown }[]>(
              url, token, 'kv_get_multi_value', { namespace_key: baselineItems },
            ),
          ])

          const batchErrors: BackendError[] = []
          if (meta.status === 'rejected') batchErrors.push({ source: `${name}/kv`, error: meta.reason })
          if (stat.status === 'rejected') batchErrors.push({ source: `${name}/static`, error: stat.reason })
          if (dyn.status === 'rejected') batchErrors.push({ source: `${name}/dynamic`, error: dyn.reason })
          if (baseline.status === 'rejected') batchErrors.push({ source: `${name}/kv-baseline`, error: baseline.reason })
          if (batchErrors.length) setErrors(prev => [...prev, ...batchErrors])

          setAgents(prev => {
            const next = new Map(prev)

            if (meta.status === 'fulfilled' && meta.value) {
              const grouped = new Map<string, Record<string, unknown>>()
              for (const row of meta.value) {
                if (!row || row.value == null) continue
                let bucket = grouped.get(row.namespace)
                if (!bucket) grouped.set(row.namespace, (bucket = {}))
                bucket[row.key] = row.value
              }
              for (const uuid of uuids) {
                const cur = next.get(uuid) ?? blankAgent(uuid, name)
                const raw = grouped.get(uuid) ?? {}
                next.set(uuid, { ...cur, meta: parseMeta(raw) })
              }
            }

            if (baseline.status === 'fulfilled' && baseline.value) {
              const grouped = new Map<string, Record<string, unknown>>()
              for (const row of baseline.value) {
                if (!row || row.value == null) continue
                grouped.set(row.namespace, { traffic_baseline: row.value })
              }
              for (const uuid of uuids) {
                const cur = next.get(uuid) ?? blankAgent(uuid, name)
                next.set(uuid, { ...cur, trafficBaseline: parseTrafficBaseline(grouped.get(uuid) ?? {}) })
              }
            }

            if (stat.status === 'fulfilled' && stat.value) {
              for (const row of stat.value) {
                if (!row.uuid) continue
                const cur = next.get(row.uuid) ?? blankAgent(row.uuid, name)
                next.set(row.uuid, { ...cur, static: row })
              }
            }
            return next
          })

          if (dyn.status === 'fulfilled' && dyn.value) {
            setLive(prev => {
              const next = new Map(prev)
              for (const row of dyn.value) next.set(row.uuid, row)
              return next
            })
            setHistory(prev => {
              const next = new Map(prev)
              for (const row of dyn.value) {
                const arr = next.get(row.uuid) || []
                const sample = sampleFrom(row)
                const dedup = arr.length && arr[arr.length - 1].t === sample.t ? arr : arr.concat(sample)
                next.set(row.uuid, dedup.slice(-HISTORY_LIMIT))
              }
              return next
            })
          }
        }),
      )

      setLoading(false)

      // 后台静默回填历史数据
      const histFrom = Date.now() - 60_000
      const histTo = Date.now()
      pool.entries.forEach(async entry => {
        const uuids = sourceUuids.get(entry.name) || []
        const { url, token } = entry.client
        await Promise.allSettled(
          uuids.map(async uuid => {
            try {
              const rows = await httpRpcCall<DynamicSummary[]>(
                url, token, 'agent_query_dynamic_summary', {
                  query: {
                    fields: DYNAMIC_FIELDS,
                    condition: [{ uuid }, { timestamp_from_to: [histFrom, histTo] }],
                  },
                },
              )
              if (!rows?.length) return
              setHistory(prev => {
                const next = new Map(prev)
                let arr = next.get(uuid) || []
                for (const row of rows) {
                  const s = sampleFrom(row)
                  if (!arr.length || arr[arr.length - 1].t !== s.t) arr.push(s)
                }
                arr.sort((a, b) => a.t - b.t)
                next.set(uuid, arr.slice(-HISTORY_LIMIT))
                return next
              })
            } catch {}
          }),
        )
      })
    }

    const tickDynamic = async () => {
      const updates: DynamicSummary[] = []
      await Promise.allSettled(
        pool.entries.map(async entry => {
          const uuids = sourceUuids.get(entry.name) || []
          if (!uuids.length) return
          try {
            const rows = await dynamicSummaryMulti(entry.client, uuids, DYNAMIC_FIELDS)
            for (const row of rows || []) updates.push(row)
          } catch {}
        }),
      )
      if (!updates.length) return

      setLive(prev => {
        const next = new Map(prev)
        for (const row of updates) next.set(row.uuid, row)
        return next
      })
      setHistory(prev => {
        const next = new Map(prev)
        for (const row of updates) {
          const arr = next.get(row.uuid) || []
          const sample = sampleFrom(row)
          const dedup = arr.length && arr[arr.length - 1].t === sample.t ? arr : arr.concat(sample)
          next.set(row.uuid, dedup.slice(-HISTORY_LIMIT))
        }
        return next
      })
    }

    bootstrap().catch((e: unknown) => {
      setErrors(prev => [...prev, { source: '*', error: e }])
      setLoading(false)
    })

    const onVisible = () => {
      if (document.visibilityState === 'visible') tickDynamic()
    }
    document.addEventListener('visibilitychange', onVisible)

    const dynTimer = setInterval(tickDynamic, DYN_INTERVAL_MS)
    const clockTimer = setInterval(() => setTick(t => t + 1), 5000)

    return () => {
      clearInterval(dynTimer)
      clearInterval(clockTimer)
      document.removeEventListener('visibilitychange', onVisible)
      setPool(null)
      pool.close()
    }
  }, [config])

  const nodes = useMemo(() => {
    const now = Date.now()
    const out = new Map<string, Node>()
    for (const [uuid, a] of agents) {
      const dyn = live.get(uuid) || null
      out.set(uuid, {
        ...a,
        dynamic: dyn,
        history: history.get(uuid) || [],
        online: isOnline(dyn?.timestamp, now),
      })
    }
    return out
  }, [agents, live, history, tick])

  return { nodes, errors, loading, pool }
}
