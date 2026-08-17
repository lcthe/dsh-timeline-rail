/**
 * Locale dictionaries for the timeline rail. Product copy follows the repo
 * convention: Chinese primary, English mirror.
 */
import type { LocaleDict } from '@deepseek-ai/dsh-client-locale/client'

/** The package's locale namespace; registered against the client locale store. */
export const NS = 'dsh-timeline-rail' as const

export const zh: LocaleDict = {
  'marker.aria': '跳转到第 {n} 条用户消息',
  'tip.title': '用户 · 第 {n} 条',
  'tip.attachment': '（附件消息）',
  'tip.image': '（图片消息）',
  'rail.aria': '消息时间轴',
} as const

export const en: LocaleDict = {
  'marker.aria': 'Jump to user message {n}',
  'tip.title': 'User message {n}',
  'tip.attachment': '(attachment)',
  'tip.image': '(image message)',
  'rail.aria': 'Message timeline',
} as const

export type TimelNameSpace = typeof NS
