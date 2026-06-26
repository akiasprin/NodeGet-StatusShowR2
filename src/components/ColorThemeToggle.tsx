import { useEffect, useRef, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { Button } from './ui/button'

interface Preset {
  name: string
  label: string
  primary: string       // light mode
  ring: string
  primaryDark: string   // dark mode
  ringDark: string
}

const PRESETS: Preset[] = [
  { name: 'blue', label: '蓝', primary: '212 100% 60%', ring: '212 100% 60%', primaryDark: '212 100% 52%', ringDark: '212 100% 52%' },
  { name: 'purple', label: '紫', primary: '268 85% 56%', ring: '268 85% 56%', primaryDark: '268 70% 44%', ringDark: '268 70% 44%' },
  { name: 'butter', label: '黄油', primary: '38 98% 56%', ring: '38 98% 56%', primaryDark: '38 88% 46%', ringDark: '38 88% 46%' },
  { name: 'green', label: '绿', primary: '150 65% 50%', ring: '150 65% 50%', primaryDark: '150 50% 38%', ringDark: '150 50% 38%' },
  { name: 'pink', label: '粉', primary: '335 94% 65%', ring: '335 94% 65%', primaryDark: '340 82% 59%', ringDark: '340 82% 59%' },
]

const STORAGE_KEY = 'nodeget.colorTheme'
const STYLE_ID = 'color-theme-style'

function loadColorTheme(defaultColor?: string): string {
  return localStorage.getItem(STORAGE_KEY) || defaultColor || 'blue'
}

function buildStyleSheet(name: string): string {
  const preset = PRESETS.find(p => p.name === name) ?? PRESETS[0]
  return `:root{--primary:${preset.primary};--ring:${preset.ring};}.dark{--primary:${preset.primaryDark};--ring:${preset.ringDark};}`
}

function applyColorTheme(name: string) {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = buildStyleSheet(name)
  localStorage.setItem(STORAGE_KEY, name)
}

export function ColorThemeToggle({ defaultColor }: { defaultColor?: string }) {
  const [active, setActive] = useState(() => loadColorTheme(defaultColor))
  const [open, setOpen] = useState(false)
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    applyColorTheme(active)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useEffect(() => {
    if (open) setShow(true)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(o => !o)}
        aria-label="切换主题色"
        title="主题色"
      >
        <Palette className="h-4 w-4" />
      </Button>
      {show && (
        <div
          data-state={open ? 'open' : 'closed'}
          onAnimationEnd={() => {
            if (!open) setShow(false)
          }}
          className="absolute right-0 mt-1 origin-top-right z-20 rounded-md border bg-popover shadow-md p-1.5 fill-mode-forwards data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <div className="flex gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setActive(p.name)
                  setOpen(false)
                }}
                title={p.label}
                className="relative w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none"
                style={{ background: `hsl(${p.primary})` }}
              >
                {p.name === active && <Check className="h-3 w-3 text-white absolute inset-0 m-auto drop-shadow" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
