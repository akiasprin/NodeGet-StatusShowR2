import { useEffect, useRef, useState } from 'react'
import { Badge } from './ui/badge'
import { Card } from './ui/card'
import { Progress } from './ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Flag } from './Flag'
import { StatusDot } from './StatusDot'
import { bytes, pct, relativeAge } from '../utils/format'
import { deriveUsage, displayName, distroLogo, virtLabel } from '../utils/derive'
import { cn, loadColor } from '../utils/cn'
import { InlineNodeDetail } from './InlineNodeDetail'
import type { BackendPool } from '../api/pool'
import type { Node } from '../types'

interface Props {
  nodes: Node[]
  expandedSet: Set<string>
  onToggle?: (uuid: string) => void
  onClose?: (uuid: string) => void
  pool: BackendPool | null
  showSource: boolean
}

export function NodeTable({ nodes, expandedSet, onToggle, onClose, pool, showSource }: Props) {
  const COL_COUNT = 10
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-8" />
            <TableHead className="text-xs">名称</TableHead>
            <TableHead className="w-12 text-center text-xs">地区</TableHead>
            <TableHead className="text-xs">架构</TableHead>
            <TableHead className="text-xs">CPU</TableHead>
            <TableHead className="text-xs">内存</TableHead>
            <TableHead className="text-xs">磁盘</TableHead>
            <TableHead className="text-xs">下行</TableHead>
            <TableHead className="text-xs">上行</TableHead>
            <TableHead className="text-xs">更新</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {nodes.map(n => {
            const u = deriveUsage(n)
            const logo = distroLogo(n)
            const virt = virtLabel(n)
            const isSelected = expandedSet.has(n.uuid)
            return (
              <>
                <TableRow
                  key={n.uuid}
                  onClick={() => onToggle?.(n.uuid)}
                  className={cn(
                    'cursor-pointer',
                    isSelected && '!bg-primary/10 hover:!bg-primary/10',
                    !n.online && 'opacity-60',
                  )}
                >
                <TableCell className="text-xs">
                  <StatusDot online={n.online} />
                </TableCell>
                <TableCell className="font-medium text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {logo && (
                      <img
                        src={logo}
                        alt=""
                        className="w-4 h-4 shrink-0 object-contain"
                        loading="lazy"
                      />
                    )}
                    <span className="truncate">{displayName(n)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-xs">
                  {n.meta?.region ? (
                    <Flag code={n.meta.region} />
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {virt ? (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      {virt}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <CellBar value={u.cpu} />
                </TableCell>
                <TableCell className="text-xs">
                  <CellBar
                    value={u.mem}
                    hint={u.memTotal ? `${bytes(u.memUsed)} / ${bytes(u.memTotal)}` : null}
                  />
                </TableCell>
                <TableCell className="text-xs">
                  <CellBar
                    value={u.disk}
                    hint={u.diskTotal ? `${bytes(u.diskUsed)} / ${bytes(u.diskTotal)}` : null}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">{bytes(u.netIn || 0)}/s</TableCell>
                <TableCell className="font-mono text-xs">{bytes(u.netOut || 0)}/s</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {relativeAge(u.ts)}
                </TableCell>
              </TableRow>
                <ExpandRow
                  key={`${n.uuid}-detail`}
                  open={isSelected && !!pool}
                  colSpan={COL_COUNT}
                >
                  {pool && (
                    <InlineNodeDetail
                      node={n}
                      onClose={() => onClose?.(n.uuid)}
                      showSource={showSource}
                      pool={pool}
                      variant="table"
                    />
                  )}
                </ExpandRow>
              </>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}

function CellBar({ value, hint }: { value: number | undefined; hint?: string | null }) {
  return (
    <div className="flex items-center gap-2 min-w-[110px]" title={hint || ''}>
      <Progress value={value} indicatorClassName={loadColor(value)} className="flex-1 h-1.5" />
      <span className="font-mono text-xs w-12 text-right">{pct(value)}</span>
    </div>
  )
}

function ExpandRow({ open, colSpan, children }: { open: boolean; colSpan: number; children: React.ReactNode }) {
  const [render, setRender] = useState(open)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (open) {
      setRender(true)
      requestAnimationFrame(() => setAnimating(true))
    } else {
      setAnimating(false)
      timerRef.current = setTimeout(() => setRender(false), 300)
    }
    return () => clearTimeout(timerRef.current)
  }, [open])

  if (!render) return null

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0 border-0">
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-300 ease-out',
            animating ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            {children}
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}
