/**
 * TimelineRail: a fixed column of evenly spaced tick marks along the right
 * edge of the message area, one tick per durable message. Hovering a tick
 * shows a preview card and scales nearby ticks; clicking scrolls to that message.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { hasImageContent, textOfContent, type UserNodeData } from './user-message.ts'
import type { NS } from './locales.ts'
import css from './timeline-rail.module.css'

export type TimelineRailProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<typeof NS> & TimelineRailInjected

export interface TimelineRailInjected {
  readonly loadOlder: () => Promise<void> | void
}

interface ChatMessage {
  readonly key: string
  readonly text: string
  readonly hasImage: boolean
}

interface RailLayout {
  readonly contentHeight: number
  readonly start: number
  readonly gap: number
}

const GAP = 12
const RAIL_PADDING = 12
const SCROLL_OFFSET = 16
const HOVER_SIGMA = 2.5
const AUTO_LOAD_RETRY_MS = 250

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

function selectMessages(chat: ChatSnapshot | undefined): ChatMessage[] {
  if (chat === undefined) return []
  const out: ChatMessage[] = []
  for (const key of chat.order) {
    const node = chat.nodes.get(key)
    if (node === undefined || node.kind !== 'user') continue
    const data = node.data as UserNodeData | undefined
    out.push({
      key,
      text: textOfContent(data?.content),
      hasImage: hasImageContent(data?.content),
    })
  }
  return out
}

/** Gaussian decay: smooth magnifying-glass scale based on distance from mouse. */
function hoverScale(index: number, hoverPos: number | null): number {
  if (hoverPos === null) return 1
  const d = index - hoverPos
  const factor = Math.exp(-(d * d) / (2 * HOVER_SIGMA * HOVER_SIGMA))
  return 1 + 0.7 * factor
}

function layoutFor(count: number, height: number): RailLayout {
  const marksHeight = Math.max(0, count - 1) * GAP
  const contentHeight = Math.max(height, RAIL_PADDING * 2 + marksHeight)
  const start = contentHeight === height
    ? (height - marksHeight) / 2
    : RAIL_PADDING
  return { contentHeight, start, gap: count <= 1 ? 0 : GAP }
}

export function TimelineRail({ useSession, t, loadOlder }: TimelineRailProps): JSX.Element | null {
  const hostRef = useRef<HTMLDivElement>(null)
  const autoLoadInFlight = useRef(false)
  const autoLoadStopped = useRef(false)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const disposedRef = useRef(false)
  const sessionStateRef = useRef({ openState: 'cold' as string, hasMore: false, loadingOlder: false })
  const pendingScrollRestore = useRef<{ readonly scroll: HTMLElement; readonly height: number; readonly top: number } | null>(null)
  const railViewportRef = useRef<HTMLDivElement>(null)
  const railContentHeight = useRef<number | null>(null)
  const railPinnedBottom = useRef(true)
  const [geometry, setGeometry] = useState<{ readonly top: number; readonly height: number; readonly right: number } | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const chat = useSession((s) => s.chat)
  const order = useSession((s) => s.chat.order)
  const openState = useSession((s) => s.openState)
  const hasMore = useSession((s) => s.hasMore)
  const loadingOlder = useSession((s) => s.loadingOlder)
  const allMessages = useMemo(() => selectMessages(chat), [chat])
  const count = allMessages.length
  sessionStateRef.current = { openState, hasMore, loadingOlder }

  useLayoutEffect(() => {
    const restore = pendingScrollRestore.current
    if (restore === null) return
    const delta = restore.scroll.scrollHeight - restore.height
    restore.scroll.scrollTop = restore.top + delta
    pendingScrollRestore.current = null
  }, [order])

  useEffect(() => {
    disposedRef.current = false
    const schedule = (): void => {
      if (disposedRef.current || retryTimerRef.current !== null) return
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null
        void drain()
      }, AUTO_LOAD_RETRY_MS)
    }
    const drain = async (): Promise<void> => {
      if (disposedRef.current || autoLoadInFlight.current || autoLoadStopped.current) return
      const state = sessionStateRef.current
      if (state.openState !== 'open' || !state.hasMore || state.loadingOlder) {
        if (state.openState === 'open' && !state.hasMore) autoLoadStopped.current = true
        else schedule()
        return
      }
      const host = hostRef.current
      const scroll = host?.closest('[data-conversation-scroll]')
      if (scroll instanceof HTMLElement) {
        pendingScrollRestore.current = {
          scroll,
          height: scroll.scrollHeight,
          top: scroll.scrollTop,
        }
      }
      autoLoadInFlight.current = true
      try {
        await loadOlder()
      } catch (error: unknown) {
        console.error('[dsh-timeline-rail] automatic history loading failed:', error)
      } finally {
        autoLoadInFlight.current = false
        schedule()
      }
    }
    void drain()
    return () => {
      disposedRef.current = true
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [loadOlder])

  // --- Geometry measurement ---
  useEffect(() => {
    const host = hostRef.current
    const scroll = host === null ? null : host.closest('[data-conversation-scroll]')
    if (count === 0 || scroll === null) return
    let raf = 0
    const measure = (): void => {
      try {
        const sr = scroll.getBoundingClientRect()
        const paddingTop = parseFloat(getComputedStyle(scroll).paddingTop) || 0
        const composer = scroll.querySelector('[data-composer-seat]')
        const cr = composer === null ? null : composer.getBoundingClientRect()
        const top = Math.max(0, sr.top + paddingTop)
        const bottom = Math.min(
          window.innerHeight,
          sr.bottom,
          cr === null ? window.innerHeight : cr.top,
        )
        const height = Math.max(0, bottom - top)
        const gutter = Math.max(0, scroll instanceof HTMLElement ? scroll.offsetWidth - scroll.clientWidth : 0)
        setGeometry({ top, height, right: Math.max(0, window.innerWidth - sr.right) + gutter + 4 })
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
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure) }
    window.addEventListener('resize', onWin)
    scroll.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onWin)
      scroll.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [count])

  // --- Current-message highlight via IntersectionObserver ---
  useEffect(() => {
    const host = hostRef.current
    const scroll = host === null ? null : host.closest('[data-conversation-scroll]')
    if (scroll === null || allMessages.length === 0) return
    const keys = new Set(allMessages.map((m) => m.key))
    const flow = scroll.querySelector('[data-chat-flow]')
    const rows = (flow ?? scroll).querySelectorAll('[data-chat-anchor-key]')
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const k = (e.target as HTMLElement).dataset.chatAnchorKey
        if (k === undefined) continue
        if (e.isIntersecting) visible.set(k, e.intersectionRatio)
        else visible.delete(k)
      }
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
  }, [allMessages])

  const ready = count > 0 && geometry !== null
  const railStyle = geometry === null
    ? { top: 0, height: 0, right: 0 }
    : { top: geometry.top, height: geometry.height, right: geometry.right }
  const layout = geometry === null ? null : layoutFor(count, geometry.height)
  const tickTop = (index: number): number => layout === null ? 0 : layout.start + index * layout.gap

  useLayoutEffect(() => {
    const viewport = railViewportRef.current
    if (viewport === null || layout === null) return
    const contentHeight = layout.contentHeight
    if (railContentHeight.current === contentHeight && !railPinnedBottom.current) return
    railContentHeight.current = contentHeight
    if (railPinnedBottom.current) viewport.scrollTop = viewport.scrollHeight
  }, [layout?.contentHeight, count])

  const onRailScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const viewport = e.currentTarget
    railPinnedBottom.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 1
  }

  // --- Tooltip ---
  const tip = (() => {
    if (!ready || hover === null || layout === null) return null
    const idx = Math.round(hover)
    const message = allMessages[idx]
    if (message === undefined) return null
    return (
      <div className={css.tip} style={{ top: tickTop(idx), transform: 'translateY(-50%)' }} key="tip">
        <span className={css.tipTitle}>{t('tip.nth', { n: idx + 1 })}</span>
        {message.text.length > 0
          ? <p className={css.tipText}>{message.text}</p>
          : <span className={css.tipEmpty}>{message.hasImage ? t('tip.image') : t('tip.attachment')}</span>}
      </div>
    )
  })()

  /** Track nearest tick position from mouse Y — includes the rail viewport scroll offset. */
  const onRailMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!ready || layout === null || layout.gap === 0) return
    const viewport = e.currentTarget
    const mouseY = e.clientY - viewport.getBoundingClientRect().top + viewport.scrollTop
    const rawIndex = (mouseY - layout.start) / layout.gap
    const clamped = Math.max(0, Math.min(count - 1, rawIndex))
    setHover(clamped)
  }

  const onRailMouseLeave = (): void => setHover(null)

  return (
    <div
      ref={hostRef}
      className={css.rail}
      style={railStyle}
      role="navigation"
      aria-label={t('rail.aria')}
    >
      <div
        ref={railViewportRef}
        className={css.viewport}
        onScroll={onRailScroll}
        onMouseMove={onRailMouseMove}
        onMouseLeave={onRailMouseLeave}
      >
        <div className={css.content} style={{ height: layout?.contentHeight ?? 0 }}>
          <div className={css.track} />
          {ready && allMessages.map((message, index) => {
            const scale = hoverScale(index, hover)
            const activeClass = activeKey === message.key ? css.tickActive : ''
            return (
              <button
                key={message.key}
                type="button"
                className={`${css.tick} ${activeClass}`}
                style={{ top: tickTop(index), transform: `translate(-50%, -50%) scaleX(${scale})` }}
                aria-label={t('marker.aria', { n: index + 1 })}
                onClick={() => scrollToMessage(message.key, hostRef.current)}
              />
            )
          })}
          {tip}
        </div>
      </div>
    </div>
  )
}
