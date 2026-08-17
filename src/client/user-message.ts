/**
 * Content helpers over a user chat node.
 *
 * A user message node's `data` is a shape with a `kind: 'user'` arm whose
 * `content` is an ordered block list. Text blocks carry a `type: 'text'` arm;
 * image blocks carry a `type: 'image'` arm. This mirrors how the conversation
 * package renders the bubble text (`contentParts`).
 */

/** One content block of a user message, as produced by the host. */
export interface ContentBlock {
  readonly type: string
  readonly text?: unknown
  readonly attachment?: unknown
}

/** The `data` payload of a `kind: 'user'` chat node. */
export interface UserNodeData {
  readonly kind: 'user'
  readonly content: unknown
}

/**
 * Join the text of a user message's content into a preview string.
 * @param content - the raw `data.content` (block list, string, or absent).
 * @returns the concatenated text blocks, or an empty string.
 */
export function textOfContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    let text = ''
    for (const block of content) {
      const b = block as Partial<ContentBlock>
      if (b?.type === 'text' && typeof b.text === 'string') text += b.text
    }
    return text
  }
  return ''
}

/**
 * Whether a user message's content carries at least one image block.
 * @param content - the raw `data.content` (block list).
 * @returns true when any block is an image.
 */
export function hasImageContent(content: unknown): boolean {
  if (!Array.isArray(content)) return false
  return content.some((block) => (block as Partial<ContentBlock>)?.type === 'image')
}
