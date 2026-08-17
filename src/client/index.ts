/**
 * Browser timeline plugin contributing one entry to the `conversation.input.dock`
 * slot without defining a service.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: the `slot` service and locale context merges, and — critically —
// the `conversation.input.dock` SlotMap row declared by the slot's owning
// package, so the register call types against the live contract.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { en, NS, zh } from './locales.ts'
import { TimelineRail } from './TimelineRail.tsx'

/** Required service: the slot registry and the locale store. */
export const inject = ['slots', 'locale']

/**
 * Register the timeline rail dock entry. Registration rides `slots.inject`,
 * so it waits on the slot declaration, survives its redeclaration, and is
 * removed together with this plugin.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-timeline-rail: dictionaries')
  ctx.slots.inject('conversation.input.dock', () =>
    ctx.slots.register({ name: 'conversation.input.dock', id: 'timeline-rail', order: 100, locale: NS }, TimelineRail))
}
