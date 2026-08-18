/**
 * TimelineRail: a fixed column of evenly spaced tick marks along the right
 * edge of the message area, one tick per durable message. Hovering a tick
 * shows a preview card and scales nearby ticks; clicking scrolls to that message.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { hasImageContent, textOfContent, type UserNodeData } from './user-message.ts'
import type { NS } from './locales.ts'
import css from './timeline-rail.module.css'

export type TimelineRailProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<typeof NS>

interface ChatMessage {
  readonly key: string
  readonly text: string
  readonly hasImage: boolean
}

const GAP = 12
const SCROLL_OFFSET = 16
const HOVER_SIGMA = 2.5

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
      kind: 'user',
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

export function TimelineRail({ useSession, t }: TimelineRailProps): JSX.Element | null {
  const hostRef = useRef<HTMLDivElement>(null)
  const [geometry, setGeometry] = useState<{ readonly top: number; readonly height: number; readonly right: number } | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const chat = useSession((s) => s.chat)
  const order = useSession((s) => s.chat.order)
  const nodeCount = useSession((s) => s.chat.nodes.size)
  const allMessages = useMemo(() => selectMessages(chat), [order, nodeCount])
  const count = allMessages.length

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
        const height = cr === null
          ? Math.max(0, sr.height - paddingTop)
          : Math.max(0, cr.top - sr.top - paddingTop)
        const gutter = Math.max(0, scroll.offsetWidth - scroll.clientWidth)
        setGeometry({ top: sr.top + paddingTop, height, right: Math.max(0, window.innerWidth - sr.right) + gutter + 4 })
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

  const tickTop = (index: number): number => {
    const totalMarks = (count - 1) * GAP
    return (geometry!.height - totalMarks) / 2 + index * GAP
  }

  // --- Tooltip ---
  const tip = (() => {
    if (!ready || hover === null) return null
    const idx = Math.round(hover)
    const message = allMessages[idx]
    if (message === undefined) return null
    const top = tickTop(idx)
    return (
      <div className={css.tip} style={{ top, transform: 'translateY(-50%)' }} key="tip">
        <span className={css.tipTitle}>{t('tip.nth', { n: idx + 1 })}</span>
        {message.text.length > 0
          ? <p className={css.tipText}>{message.text}</p>
          : <span className={css.tipEmpty}>{message.hasImage ? t('tip.image') : t('tip.attachment')}</span>}
      </div>
    )
  })()

  /** Track nearest tick position from mouse Y — uses fractional index for smooth scaling. */
  const onRailMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!ready || geometry === null) return
    const railTop = e.currentTarget.getBoundingClientRect().top
    const mouseY = e.clientY - railTop
    const totalMarks = (count - 1) * GAP
    const startY = (geometry.height - totalMarks) / 2
    const rawIndex = (mouseY - startY) / GAP
    // Clamp to valid range
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
      <div className={css.track} />
      {/* Transparent hit area for mouse tracking — wider than visible rail */}
      <div
        className={css.hitArea}
        onMouseMove={onRailMouseMove}
        onMouseLeave={onRailMouseLeave}
      />
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
  )
}
