/**
 * TimelineRail: a fixed column of evenly spaced tick marks along the right
 * edge of the message area, one tick per durable user message. Hovering a tick
 * shows a preview card; clicking it scrolls that user message to the top.
 *
 * Receives the dock slot's standard kit through the framework props shares —
 * the live chat snapshot arrives reactively via `useSession`, never as local
 * state. Layout measurement is component-internal behavior.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { hasImageContent, textOfContent, type UserNodeData } from './user-message.ts'
import type { NS } from './locales.ts'
import css from './timeline-rail.module.css'

/** Full props of a dock entry: owner share + session standard kit + locale seat. */
export type TimelineRailProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<typeof NS>

interface UserMessage {
  readonly key: string
  readonly text: string
  readonly hasImage: boolean
}

const GAP = 22
const SCROLL_OFFSET = 16

/** Navigate the scrollport to bring the message row with `key` to the viewport top. */
function scrollToUserMessage(key: string, host: HTMLDivElement | null): void {
  if (host === null) return
  const scroll = host.closest('[data-conversation-scroll]')
  if (scroll === null) return
  const flow = scroll.querySelector('[data-chat-flow]')
  const rows = flow === null ? scroll.querySelectorAll('[data-chat-anchor-key]') : flow.querySelectorAll('[data-chat-anchor-key]')
  for (const row of rows) {
    if (row instanceof HTMLElement && row.dataset.chatAnchorKey !== key) continue
    if (!(row instanceof HTMLElement)) continue
    const sr = scroll.getBoundingClientRect()
    scroll.scrollTop += row.getBoundingClientRect().top - sr.top - SCROLL_OFFSET
    return
  }
}

/** Derive the ordered list of durable user messages from the chat snapshot. */
function selectUserMessages(chat: ChatSnapshot | undefined): UserMessage[] {
  if (chat === undefined) return []
  const out: UserMessage[] = []
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

export function TimelineRail({ useSession, t }: TimelineRailProps): JSX.Element | null {
  const hostRef = useRef<HTMLDivElement>(null)
  const [geometry, setGeometry] = useState<{ readonly top: number; readonly height: number; readonly right: number } | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  const chat = useSession((s) => s.chat)
  const messages = useMemo(() => selectUserMessages(chat), [chat])
  const count = messages.length

  // Measure the message area geometry against the live scrollport. Runs once
  // the ref is mounted (the container renders unconditionally) and re-runs on
  // any change to the scrollport / composer / flow size.
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
      } catch {
        // Measurement is non-critical; a failed read keeps the last geometry.
      }
    }
    measure()
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    })
    observer.observe(scroll)
    const composer = scroll.querySelector('[data-composer-seat]')
    if (composer !== null) observer.observe(composer)
    const flow = scroll.querySelector('[data-chat-flow]')
    if (flow !== null) observer.observe(flow)
    const onResize = (): void => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    window.addEventListener('resize', onResize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
    }
  }, [count])

  const ready = count > 0 && geometry !== null
  const railStyle = geometry === null
    ? { top: 0, height: 0, right: 0 }
    : { top: geometry.top, height: geometry.height, right: geometry.right }
  // Fixed-gap centered: marks are evenly spaced with GAP px between each,
  // vertically centered within the message area.
  const tickTop = (index: number): number => {
    const totalMarks = (count - 1) * GAP
    return (geometry!.height - totalMarks) / 2 + index * GAP
  }

  const tip = (() => {
    if (!ready || hover === null || messages[hover] === undefined) return null
    const message = messages[hover]!
    const top = tickTop(hover)
    const style: React.CSSProperties = { top, transform: 'translateY(-50%)' }
    return (
      <div className={css.tip} style={style} key="tip">
        <span className={css.tipTitle}>{t('tip.title', { n: hover + 1 })}</span>
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
      {ready && messages.map((message, index) => (
        <button
          key={message.key}
          type="button"
          className={css.tick}
          style={{ top: tickTop(index) }}
          aria-label={t('marker.aria', { n: index + 1 })}
          onClick={() => scrollToUserMessage(message.key, hostRef.current)}
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
