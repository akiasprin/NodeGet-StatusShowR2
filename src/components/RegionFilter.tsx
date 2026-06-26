import { cn } from '../utils/cn'
import { Flag } from './Flag'
import React from "react";

interface Props {
  regions: { code: string; count: number }[]
  total: number
  active: string | null
  onChange: (code: string | null) => void
}

export function RegionFilter({ regions, total, active, onChange }: Props) {
  if (regions.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip selected={active === null} onClick={() => onChange(null)}>
        全部
      </Chip>
      {regions.map(r => (
        <Chip key={r.code} selected={active === r.code} onClick={() => onChange(r.code)}>
          <Flag code={r.code} className="w-4 h-3" />
          <span>{r.code}</span>
        </Chip>
      ))}
    </div>
  )
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded transition-colors shrink-0 leading-none',
        selected
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
      )}
    >
      {children}
    </button>
  )
}
