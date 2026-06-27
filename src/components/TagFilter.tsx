import { cn } from '../utils/cn'

interface Props {
  tags: string[]
  active: string | null
  onChange: (tag: string | null) => void
}

export function TagFilter({ tags, active, onChange }: Props) {
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip selected={active === null} onClick={() => onChange(null)}>
        全球
      </Chip>
      {tags.map(t => (
        <Chip key={t} selected={active === t} onClick={() => onChange(t)}>
          {t}
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
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors shrink-0 leading-none',
        selected
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
      )}
    >
      {children}
    </button>
  )
}
