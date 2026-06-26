import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import { useConfig } from './hooks/useConfig'
import { useNodes } from './hooks/useNodes'
import { Background } from './components/Background'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { NodeCard } from './components/NodeCard'
import { NodeTable } from './components/NodeTable'
import { InlineNodeDetail } from './components/InlineNodeDetail'
import { TagFilter } from './components/TagFilter'
import { RegionFilter } from './components/RegionFilter'

const WorldMap = lazy(() =>
  import('./components/WorldMap').then(m => ({ default: m.WorldMap })),
)
import { deriveUsage, displayName } from './utils/derive'
import type { BackendPool } from './api/pool'
import type { Node, Sort, View } from './types'

const DEFAULT_LOGO = `${import.meta.env.BASE_URL}logo.png`
const VIEW_KEY = 'nodeget.view'
const SORT_KEY = 'nodeget.sort'

function initialView(): View {
  const v = localStorage.getItem(VIEW_KEY)
  if (v === 'table' || v === 'map') return v
  return 'cards'
}

function initialSort(): Sort {
  return (localStorage.getItem(SORT_KEY) as Sort) || 'default'
}

function readHash() {
  return decodeURIComponent(window.location.hash.slice(1)) || null
}

const num = (v?: number) => (Number.isFinite(v) ? (v as number) : -Infinity)

export function App() {
  const { config, error: configError } = useConfig()
  const { nodes, errors, loading, pool } = useNodes(config)

  const [view, setView] = useState<View>(initialView)
  const [sort, setSort] = useState<Sort>(initialSort)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [activeRegion, setActiveRegion] = useState<string | null>(null)
  const [expandedSet, setExpandedSet] = useState<Set<string>>(() => {
    const hash = readHash()
    return new Set(hash ? [hash] : [])
  })

  const toggleExpand = useCallback((uuid: string) => {
    setExpandedSet(prev => {
      if (prev.has(uuid)) {
        const next = new Set(prev)
        next.delete(uuid)
        return next
      }
      return new Set([uuid])
    })
  }, [])

  const closeExpand = useCallback((uuid: string) => {
    setExpandedSet(prev => {
      const next = new Set(prev)
      next.delete(uuid)
      return next
    })
  }, [])
  const [gridCols, setGridCols] = useState(4)

  const updateGridCols = useCallback(() => {
    const w = window.innerWidth
    if (w >= 1280) setGridCols(4)
    else if (w >= 1024) setGridCols(3)
    else if (w >= 640) setGridCols(2)
    else setGridCols(1)
  }, [])

  useEffect(() => {
    updateGridCols()
    window.addEventListener('resize', updateGridCols)
    return () => window.removeEventListener('resize', updateGridCols)
  }, [updateGridCols])

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view)
  }, [view])

  useEffect(() => {
    localStorage.setItem(SORT_KEY, sort)
  }, [sort])

  useEffect(() => {
    const onHash = () => {
      const hash = readHash()
      if (hash) setExpandedSet(prev => new Set(prev).add(hash))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const arr = [...expandedSet]
    const target = arr.length > 0 ? `#${encodeURIComponent(arr[0])}` : ''
    if (window.location.hash === target) return
    if (arr.length > 0) {
      history.replaceState(null, '', `#${encodeURIComponent(arr[0])}`)
    } else {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [expandedSet])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const n of nodes.values()) {
      if (n.meta?.hidden) continue
      for (const t of n.meta?.tags ?? []) set.add(t)
    }
    return [...set].sort()
  }, [nodes])

  const regions = useMemo(() => {
    const map = new Map<string, number>()
    let total = 0
    for (const n of nodes.values()) {
      if (n.meta?.hidden) continue
      total++
      const code = n.meta?.region?.trim().toUpperCase()
      if (!code || !/^[A-Z]{2}$/.test(code)) continue
      map.set(code, (map.get(code) ?? 0) + 1)
    }
    const list = [...map.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    return { list, total }
  }, [nodes])

  useEffect(() => {
    if (activeTag && !allTags.includes(activeTag)) setActiveTag(null)
  }, [allTags, activeTag])

  useEffect(() => {
    if (activeRegion && !regions.list.some(r => r.code === activeRegion)) setActiveRegion(null)
  }, [regions, activeRegion])

  const list = useMemo(() => {
    let arr = [...nodes.values()].filter(n => !n.meta?.hidden && n.meta?.name)
    if (activeTag) arr = arr.filter(n => n.meta?.tags?.includes(activeTag))
    if (activeRegion) {
      arr = arr.filter(n => n.meta?.region?.trim().toUpperCase() === activeRegion)
    }

    const q = query.trim().toLowerCase()
    if (q) {
      arr = arr.filter(n => {
        const hay = [
          n.uuid,
          n.source,
          n.meta?.name,
          n.meta?.region,
          n.meta?.virtualization,
          n.static?.system?.system_host_name,
          n.static?.system?.system_name,
          ...(n.meta?.tags ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    }

    const rank = new Map(regions.list.map((r, i) => [r.code, i]))

    return arr.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1

      const ua = deriveUsage(a)
      const ub = deriveUsage(b)
      let cmp = 0
      if (sort === 'cpu') cmp = num(ub.cpu) - num(ua.cpu)
      else if (sort === 'mem') cmp = num(ub.mem) - num(ua.mem)
      else if (sort === 'disk') cmp = num(ub.disk) - num(ua.disk)
      else if (sort === 'netIn') cmp = num(ub.netIn) - num(ua.netIn)
      else if (sort === 'netOut') cmp = num(ub.netOut) - num(ua.netOut)
      else if (sort === 'uptime') cmp = num(ub.uptime) - num(ua.uptime)
      else if (sort === 'region') {
        const ar = rank.get(a.meta?.region?.trim().toUpperCase() || '') ?? Infinity
        const br = rank.get(b.meta?.region?.trim().toUpperCase() || '') ?? Infinity
        cmp = ar - br
      }
      else if (sort === 'default') cmp = (a.meta?.order ?? 0) - (b.meta?.order ?? 0)

      return cmp || displayName(a).localeCompare(displayName(b))
    })
  }, [nodes, query, activeTag, activeRegion, sort, regions])

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>加载 config.json 失败</AlertTitle>
          <AlertDescription>{String(configError.message || configError)}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        加载中…
      </div>
    )
  }

  const logo = config.user_preferences.site_logo || DEFAULT_LOGO
  const empty = list.length === 0
  const hasErrors = errors.length > 0

  return (
    <div className="min-h-screen flex flex-col">
      <Background />
      <Navbar
        siteName={config.user_preferences.site_name || '你没设置'}
        logo={logo}
        query={query}
        onQuery={setQuery}
        view={view}
        onView={setView}
        sort={sort}
        onSort={setSort}
        defaultColor={config.user_preferences.color_theme}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {!empty && (
          <RegionFilter
            regions={regions.list}
            total={regions.total}
            active={activeRegion}
            onChange={setActiveRegion}
          />
        )}
        {!empty && <TagFilter tags={allTags} active={activeTag} onChange={setActiveTag} />}

        {empty && loading && !hasErrors && (
          <div className="py-24 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm">连接后端中…</span>
          </div>
        )}

        {empty && !loading && !hasErrors && (
          <div className="py-20 text-center text-muted-foreground">暂无节点</div>
        )}

        {!empty && view === 'cards' && (
          <ExpandCard
            list={list}
            expandedSet={expandedSet}
            gridCols={gridCols}
            nodes={nodes}
            onToggle={toggleExpand}
            onClose={closeExpand}
            pool={pool!}
            showSource={(config.site_tokens?.length ?? 0) > 1}
          />
        )}
        {!empty && view === 'table' && (
          <NodeTable
            nodes={list}
            expandedSet={expandedSet}
            onToggle={toggleExpand}
            onClose={closeExpand}
            pool={pool}
            showSource={(config.site_tokens?.length ?? 0) > 1}
          />
        )}
        {!empty && view === 'map' && (
          <Suspense
            fallback={
              <div className="py-24 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> 加载地图中…
              </div>
            }
          >
            <WorldMap nodes={list} onOpen={toggleExpand} />
          </Suspense>
        )}

        {hasErrors && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{errors.length} 个后端错误</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {errors.map((e, i) => (
                  <li key={i}>
                    <b>{e.source}</b>：
                    {e.error instanceof Error ? e.error.message : String(e.error)}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </main>

      <Footer text={config.user_preferences.footer} repo={config.repository} dist_page={config.dist_page}/>
    </div>
  )
}

function ExpandCard({
  list,
  expandedSet,
  gridCols,
  nodes,
  onToggle,
  onClose,
  pool,
  showSource,
}: {
  list: Node[]
  expandedSet: Set<string>
  gridCols: number
  nodes: Map<string, Node>
  onToggle: (uuid: string) => void
  onClose: (uuid: string) => void
  pool: BackendPool
  showSource: boolean
}) {
  // 计算每个展开节点所在行的最后一个位置（去重：同行只插一个详情）
  const detailSlots = new Map<number, string>() // lastInRow -> uuid
  for (const uuid of expandedSet) {
    const idx = list.findIndex(n => n.uuid === uuid)
    if (idx < 0) continue
    const row = Math.floor(idx / gridCols)
    const last = Math.min((row + 1) * gridCols - 1, list.length - 1)
    detailSlots.set(last, uuid)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {list.map((n, i) => {
        const isExpanded = expandedSet.has(n.uuid)
        const detailUuid = detailSlots.get(i)
        const detailNode = detailUuid ? nodes.get(detailUuid) ?? null : null
        return (
          <div key={n.uuid} className="contents">
            <NodeCard
              node={n}
              isExpanded={isExpanded}
              onClick={() => onToggle(n.uuid)}
            />
            {detailNode && (
              <InlineNodeDetail
                node={detailNode}
                onClose={() => onClose(detailUuid!)}
                showSource={showSource}
                pool={pool}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
