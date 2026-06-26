import { ArrowDown, ArrowUp, RotateCw, type LucideIcon } from 'lucide-react'
import { Badge } from './ui/badge'
import { Card } from './ui/card'
import { Progress } from './ui/progress'
import { Flag } from './Flag'
import { StatusDot } from './StatusDot'
import { bytes, pct, relativeAge, uptime } from '../utils/format'
import { cpuLabel, deriveUsage, displayName, letterIcon, osLabel, vendorLogo, virtLabel } from '../utils/derive'
import { cn, loadColor } from '../utils/cn'
import { useLayoutEffect, useRef } from 'react'
import type { Node } from '../types'
import type { ReactNode } from 'react'
import { computePeriodUsage, bytesToGB, daysUntilReset, type TrafficState } from '../utils/traffic'

export function NodeCard({ node, isExpanded, onClick }: { node: Node; isExpanded?: boolean; onClick?: () => void }) {
  const u = deriveUsage(node)
  const tags = Array.isArray(node.meta?.tags) ? node.meta.tags : []
  const os = osLabel(node)
  const vendor = vendorLogo(node)
  const letter = letterIcon(node)
  const virt = virtLabel(node)
  const cpu = cpuLabel(node)

  const d = node.dynamic
  const trafficState: TrafficState | null = (d && node.trafficBaseline) ? computePeriodUsage(
    d.total_received ?? 0, d.total_transmitted ?? 0,
    node.trafficBaseline.rx, node.trafficBaseline.tx,
    node.trafficBaseline.adjustRx, node.trafficBaseline.adjustTx,
  ) : null
  const trafficUsed = trafficState ? bytesToGB(trafficState.usedRx + trafficState.usedTx) : null
  const limitGb = node.meta?.trafficLimitGb
  const hasLimit = typeof limitGb === 'number' && limitGb > 0
  const trafficPct = (trafficUsed != null && hasLimit) ? Math.min(100, (trafficUsed / limitGb!) * 100) : null

  const cardRef = useRef<HTMLDivElement>(null)

  const firstRender = useRef(true)

  useLayoutEffect(() => {
    // 仅在首次渲染时（hash 进入/刷新）聚焦，点击不聚焦
    if (isExpanded && firstRender.current) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    firstRender.current = false
  }, [isExpanded])

  return (
      <Card
          ref={cardRef}
          className={cn(
              'p-4 flex flex-col gap-3 cursor-pointer',
              isExpanded
                ? 'ring-2 ring-primary border-primary shadow-[0_1px_2px_hsl(var(--primary)/0.10),0_4px_24px_-4px_hsl(var(--primary)/0.28),0_8px_36px_-8px_hsl(var(--primary)/0.08)]'
                : 'hover:border-primary/40',
              !node.online && 'opacity-60',
          )}
          style={{
        ...(isExpanded ? { scrollMarginTop: 64 } : {}),
        '--card-light-delay': `${((node.uuid.charCodeAt(0) + node.uuid.charCodeAt(node.uuid.length - 1)) % 10) * -1}s`,
      } as React.CSSProperties}
          onClick={onClick}
      >
          <div className="flex items-center gap-2">
            <StatusDot online={node.online} />
            <img src={vendor || letter} alt="" className="w-5 h-5 shrink-0 object-contain rounded" loading="lazy" />
            <span className="font-semibold flex-1 min-w-0 truncate" title={displayName(node)}>
            {displayName(node)}
          </span>
            <Flag code={node.meta?.region} className="shrink-0" />
          </div>

          <div className="font-mono text-xs text-muted-foreground truncate">
            {[os, uptime(u.uptime), virt].filter(Boolean).join(' · ')}
          </div>


          <div className="flex flex-col gap-2.5">
            <Metric label="CPU" value={u.cpu} sub={cpu || null} subTitle={cpu || undefined} />
            <Metric
                label="内存"
                value={u.mem}
                sub={u.memTotal ? `${bytes(u.memUsed)} / ${bytes(u.memTotal)}` : null}
            />
            <Metric
                label="磁盘"
                value={u.disk}
                sub={u.diskTotal ? `${bytes(u.diskUsed)} / ${bytes(u.diskTotal)}` : null}
            />
            {/* 流量使用 */}
            {trafficUsed != null && (() => {
              const resetDays = daysUntilReset(node.meta?.trafficStartDate ?? '', node.meta?.trafficPeriod)
              return (
              <div className="min-w-0">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <span>流量</span>
                    {resetDays != null && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
                        <RotateCw className="h-2.5 w-2.5" />
                        <span>{resetDays === 0 ? '今日重置' : `${resetDays} 天后重置`}</span>
                      </span>
                    )}
                  </span>
                  <span className="font-mono">
                    {bytes(trafficUsed * 1024 * 1024 * 1024)}
                    {hasLimit ? ` / ${bytes(limitGb! * 1024 * 1024 * 1024)}` : ' / ∞'}
                  </span>
                </div>
                <Progress value={hasLimit ? (trafficPct ?? 0) : 0} indicatorClassName={hasLimit ? loadColor(trafficPct ?? 0) : loadColor(0)} className="mt-1 h-1.5" />
              </div>
            )})()}
          </div>

          <div className="pt-2.5 border-t border-dashed font-mono text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <Stat icon={ArrowDown}>{bytes(u.netIn || 0)}/s</Stat>
              <Stat icon={ArrowUp}>{bytes(u.netOut || 0)}/s</Stat>
              <span className="ml-auto">{relativeAge(u.ts)}</span>
            </div>
          </div>


          {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                ))}
              </div>
          )}
        </Card>
  )
}

function Stat({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
      <span className="inline-flex items-center gap-1">
      <Icon className="h-3 w-3" />
        {children}
    </span>
  )
}

function Metric({
                  label,
                  value,
                  sub,
                  subTitle,
                }: {
  label: string
  value: number | undefined
  sub?: string | null
  subTitle?: string
}) {
  return (
      <div className="min-w-0">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-mono">{pct(value)}</span>
        </div>
        <Progress value={value} indicatorClassName={loadColor(value)} className="mt-1 h-1.5" />
        {sub && (
            <div
                className="font-mono text-[11px] text-muted-foreground mt-1 truncate"
                title={subTitle}
            >
              {sub}
            </div>
        )}
      </div>
  )
}
