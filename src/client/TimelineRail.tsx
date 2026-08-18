/**
 * TimelineRail: a fixed column of evenly spaced tick marks along the right
 * edge of the message area, one tick per durable message. Supports type
 * filtering, search, current-message highlighting, and hover preview.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { hasImageContent, textOfContent, type UserNodeData } from './user-message.ts'
import type { NS } from './locales.ts'
import css from './timeline-rail.module.css'

export type TimelineRailProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<typeof NS>

type MessageKind = 'user' | 'assistant' | 'tool' | 'context' | 'steering'
type FilterKind = 'all' | MessageKind

interface ChatMessage {
  readonly key: string
  readonly text: string
  readonly kind: MessageKind
  readonly hasImage: boolean
}

const GAP = 16
const SCROLL_OFFSET = 16
const SEARCH_DEBOUNCE = 150

function scrollToMessage(key: string, host: HTMLDivElement | null): void {
  if (host === null) return
  const scroll = host.closest('[data-conversation-scroll]')
  if (scroll === null) return
  const flow = scroll.querySelector('[data-chat-flow]')
  const rows = flow === null
    ? scroll.querySelectorAll('[data-chat-anchor-key]')
    : flow.querySelectorAll('[data-chat-anchor-key]')
  for (const row of rows) {
    if (row instanceof HTMLElement && row.dataset.chatAnchorKey !== key) continue
    if (!(row instanceof HTMLElement)) continue
    const sr = scroll.getBoundingClientRect()
    scroll.scrollTop += row.getBoundingClientRect().top - sr.top - SCROLL_OFFSET
    return
  }
}

function isKnownKind(kind: string): kind is MessageKind {
  return kind === 'user' || kind === 'assistant' || kind === 'tool' || kind === 'context' || kind === 'steering'
}

function selectMessages(chat: ChatSnapshot | undefined): ChatMessage[] {
  if (chat === undefined) return []
  const out: ChatMessage[] = []
  for (const key of chat.order) {
    const node = chat.nodes.get(key)
    if (node === undefined) continue
    const kind: MessageKind = isKnownKind(node.kind) ? node.kind : 'context'
    const data = node.data as UserNodeData | undefined
    out.push({
      key,
      text: textOfContent(data?.content),
      kind,
      hasImage: hasImageContent(data?.content),
    })
  }
  return out
}

export function TimelineRail({ useSession, t }: TimelineRailProps): JSX.Element | null {
  const hostRef = useRef<HTMLDivElement>(null)
  const [geometry, setGeometry] = useState<{ readonly top: number; readonly height: number; readonly right: number } | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [filter, setFilter] = useState<FilterKind>('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const chat = useSession((s) => s.chat)
  const allMessages = useMemo(() => selectMessages(chat), [chat])

  // Filter by type
  const typeFiltered = useMemo(() =>
    filter === 'all' ? allMessages : allMessages.filter((m) => m.kind === filter),
    [allMessages, filter],
  )

  // Filter by search text
  const messages = useMemo(() => {
    if (searchText.trim() === '') return typeFiltered
    const q = searchText.toLowerCase()
    return typeFiltered.filter((m) => m.text.toLowerCase().includes(q))
  }, [typeFiltered, searchText])

  const count = messages.length

  // --- Geometry measurement ---
  useEffect(() => {
    const host = hostRef.current
    const scroll = host === null ? null : host.closest('[data-conversation-scroll]')
    if (count === 0 || scroll === null) return
    let raf = 0
    const measure = (): void => {
      try {
        const sr = scroll.getBoundingClientRect()
        const composer = scroll.querySelector('[data-composer-seat]')
        const cr = composer === null ? null : composer.getBoundingClientRect()
        const height = cr === null ? Math.max(0, sr.height) : Math.max(0, cr.top - sr.top)
        const gutter = Math.max(0, scroll.offsetWidth - scroll.clientWidth)
        setGeometry({ top: sr.top, height, right: Math.max(0, window.innerWidth - sr.right) + gutter + 4 })
      } catch { /* keep last geometry */ }
    }
    measure()
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure) })
    ro.observe(scroll)
    const composer = scroll.querySelector('[data-composer-seat]')
    if (composer !== null) ro.observe(composer)
    const flow = scroll.querySelector('[data-chat-flow]')
    if (flow !== null) ro.observe(flow)
    const onWin = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure) }
    window.addEventListener('resize', onWin)
    return () => { ro.disconnect(); window.removeEventListener('resize', onWin); cancelAnimationFrame(raf) }
  }, [count])

  // --- Current-message highlight via IntersectionObserver ---
  useEffect(() => {
    const host = hostRef.current
    const scroll = host === null ? null : host.closest('[data-conversation-scroll]')
    if (scroll === null || messages.length === 0) return
    const keys = new Set(messages.map((m) => m.key))
    const flow = scroll.querySelector('[data-chat-flow]')
    const rows = (flow ?? scroll).querySelectorAll('[data-chat-anchor-key]')

    const visible = new Map<string, number>() // key → intersectionRatio
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const k = (e.target as HTMLElement).dataset.chatAnchorKey
        if (k === undefined) continue
        if (e.isIntersecting) visible.set(k, e.intersectionRatio)
        else visible.delete(k)
      }
      // Pick the row with highest intersection ratio
      let best: string | null = null
      let bestRatio = -1
      for (const [k, r] of visible) {
        if (!keys.has(k)) continue
        if (r > bestRatio) { bestRatio = r; best = k }
      }
      setActiveKey(best)
    }, { root: scroll, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] })

    for (const row of rows) {
      if (row instanceof HTMLElement) observer.observe(row)
    }
    return () => observer.disconnect()
  }, [messages])

  // --- Search input auto-focus ---
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const toggleFilter = useCallback((kind: FilterKind) => {
    setFilter((prev) => prev === kind ? 'all' : kind)
  }, [])

  const ready = count > 0 && geometry !== null
  const railStyle = geometry === null
    ? { top: 0, height: 0, right: 0 }
    : { top: geometry.top, height: geometry.height, right: geometry.right }

  const tickTop = (index: number): number => {
    const totalMarks = (count - 1) * GAP
    return (geometry!.height - totalMarks) / 2 + index * GAP
  }

  // --- Filter icons (SVG inline) ---
  const FilterBar = () => (
    <div className={css.filterBar}>
      {([
        { kind: 'all' as FilterKind, icon: '◉', label: 'all' },
        { kind: 'user' as FilterKind, icon: '◉', label: 'user' },
        { kind: 'assistant' as FilterKind, icon: '◉', label: 'assistant' },
        { kind: 'tool' as FilterKind, icon: '◉', label: 'tool' },
      ]).map(({ kind, label }) => (
        <button
          key={kind}
          type="button"
          className={`${css.filterBtn} ${filter === kind ? css.filterActive : ''}`}
          onClick={() => toggleFilter(kind)}
          title={t(`filter.${label}`)}
        >
          {kind === 'all' && 'All'}
          {kind === 'user' && 'U'}
          {kind === 'assistant' && 'A'}
          {kind === 'tool' && 'T'}
        </button>
      ))}
      <button
        type="button"
        className={`${css.filterBtn} ${searchOpen ? css.filterActive : ''}`}
        onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearchText('') }}
        title={t('filter.search')}
      >
        🔍
      </button>
    </div>
  )

  // --- Tooltip ---
  const tip = (() => {
    if (!ready || hover === null || messages[hover] === undefined) return null
    const message = messages[hover]!
    const top = tickTop(hover)
    const kindLabel = message.kind === 'user' ? t('tip.user') : message.kind === 'assistant' ? t('tip.assistant') : t('tip.tool')
    return (
      <div className={css.tip} style={{ top, transform: 'translateY(-50%)' }} key="tip">
        <span className={css.tipTitle}>{kindLabel} · {t('tip.nth', { n: hover + 1 })}</span>
        {message.text.length > 0
          ? <p className={css.tipText}>{message.text}</p>
          : <span className={css.tipEmpty}>{message.hasImage ? t('tip.image') : t('tip.attachment')}</span>}
      </div>
    )
  })()

  return (
    <div
      ref={hostRef}
      className={css.rail}
      style={railStyle}
      role="navigation"
      aria-label={t('rail.aria')}
    >
      <div className={css.track} />
      <FilterBar />
      {searchOpen && (
        <input
          ref={searchInputRef}
          type="text"
          className={css.searchInput}
          placeholder={t('filter.searchPlaceholder')}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      )}
      {ready && messages.map((message, index) => (
        <button
          key={message.key}
          type="button"
          className={`${css.tick} ${message.kind === 'user' ? css.tickUser : message.kind === 'assistant' ? css.tickAssistant : css.tickTool} ${activeKey === message.key ? css.tickActive : ''}`}
          style={{ top: tickTop(index) }}
          aria-label={t('marker.aria', { n: index + 1 })}
          onClick={() => scrollToMessage(message.key, hostRef.current)}
          onMouseEnter={() => setHover(index)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(index)}
          onBlur={() => setHover(null)}
        />
      ))}
      {tip}
    </div>
  )
}
