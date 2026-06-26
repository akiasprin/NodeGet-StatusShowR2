import { useEffect, useRef, useState } from 'react'
import { Search as SearchIcon, X } from 'lucide-react'
import { Search } from './Search'
import { ViewToggle } from './ViewToggle'
import { ThemeToggle } from './ThemeToggle'
import { ColorThemeToggle } from './ColorThemeToggle'
import { SortMenu } from './SortMenu'
import { Button } from './ui/button'
import type { Sort, View } from '../types'

interface Props {
  siteName: string
  logo?: string
  query: string
  onQuery: (v: string) => void
  view: View
  onView: (v: View) => void
  sort: Sort
  onSort: (v: Sort) => void
  defaultColor?: string
}

export function Navbar({ siteName, logo, query, onQuery, view, onView, sort, onSort, defaultColor }: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [stuck, setStuck] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    const onScroll = () => {
      const h = headerRef.current?.offsetHeight ?? 60
      setStuck(window.scrollY > h)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-10 transition-[background-color,backdrop-filter,border-color] duration-200 ${
        stuck
          ? 'border-b border-primary/15 backdrop-blur bg-background/70 shadow-[0_1px_8px_-2px_hsl(var(--primary)/0.12)]'
          : 'border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 px-3 sm:px-6 py-3">
        <a
          href="./"
          className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
        >
          {logo && <img src={logo} alt="" className="w-6 h-6 rounded shrink-0" />}
          <span className="font-semibold tracking-wide truncate">{siteName}</span>
        </a>
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <div className="hidden sm:block">
            <Search value={query} onChange={onQuery} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={() => setSearchOpen(o => !o)}
            aria-label={searchOpen ? '关闭搜索' : '搜索'}
          >
            {searchOpen ? <X className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />}
          </Button>
          <SortMenu value={sort} onChange={onSort} />
          <ViewToggle value={view} onChange={onView} />
          <ColorThemeToggle defaultColor={defaultColor} />
          <ThemeToggle />
        </div>
      </div>

      <div
        aria-hidden={!searchOpen}
        className={`sm:hidden overflow-hidden transition-all duration-150 ease-out ${
          searchOpen ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pt-1 pb-3">
          <Search ref={inputRef} value={query} onChange={onQuery} className="w-full" />
        </div>
      </div>
    </header>
  )
}
