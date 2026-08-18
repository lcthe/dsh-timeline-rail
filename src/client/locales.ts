/**
 * Locale dictionaries for the timeline rail. Product copy follows the repo
 * convention: Chinese primary, English mirror.
 */
import type { LocaleDict } from '@deepseek-ai/dsh-client-locale/client'

export const NS = 'dsh-timeline-rail' as const

export const zh: LocaleDict = {
  'marker.aria': '跳转到第 {n} 条消息',
  'tip.title': '消息 · 第 {n} 条',
  'tip.user': '用户',
  'tip.assistant': '助手',
  'tip.tool': '工具',
  'tip.nth': '第 {n} 条',
  'tip.attachment': '（附件消息）',
  'tip.image': '（图片消息）',
  'rail.aria': '消息时间轴',
  'filter.all': '全部',
  'filter.user': '用户消息',
  'filter.assistant': '助手消息',
  'filter.tool': '工具调用',
  'filter.search': '搜索',
  'filter.searchPlaceholder': '…',
} as const

export const en: LocaleDict = {
  'marker.aria': 'Jump to message {n}',
  'tip.title': 'Message · #{n}',
  'tip.user': 'User',
  'tip.assistant': 'Assistant',
  'tip.tool': 'Tool',
  'tip.nth': '#{n}',
  'tip.attachment': '(attachment)',
  'tip.image': '(image)',
  'rail.aria': 'Message timeline',
  'filter.all': 'All',
  'filter.user': 'User messages',
  'filter.assistant': 'Assistant messages',
  'filter.tool': 'Tool calls',
  'filter.search': 'Search',
  'filter.searchPlaceholder': '…',
} as const

export type TimelNameSpace = typeof NS
