# @lcthe/dsh-timeline-rail

[English](README.md) | [简体中文](README.zh-CN.md)

A **message timeline rail** for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web chat.

Along the right edge of the conversation, above the composer, it draws a **low-contrast, evenly spaced column of thin tick marks** — one tick per durable user message, styled after a meeting-notes / editor timeline. Hover a tick to preview that message; click it to jump the conversation straight to it.

> **Desktop & Web both supported.** The DeepSeek Harness **desktop** app is an Electron shell that embeds the same browser client served over a localhost web server, so a "web" plugin renders identically on both. This package targets the browser-side conversation slot and works wherever that client runs — Desktop **and** Web. Only headless / TUI profiles have no composer slot and render nothing.

![screenshot placeholder](docs/screenshot.png)

## Features

- **Evenly spaced ticks** — one short horizontal line per user message along a 1px track, so a conversation reads as a clean time axis instead of a clamped map.
- **Click to jump** — aligns the selected user message to the top of the visible message area.
- **Hover to preview** — a compact wide card shows which message it is (`用户 · 第 N 条`) plus the first lines of its text; image/attachment-only messages get a labelled placeholder.
- **Theme aware** — colors come from `--dsw-*` tokens, so it follows the light/dark theme with no extra config.
- **Slim and out of the way** — pointer-events are none except on the ticks themselves; the rail never blocks clicks on the messages.

## How it works

DSH's web GUI is a Cordis composition. This package is a **client plugin** that registers a single entry into the `conversation.input.dock` slot (the additive band above the composer card). It reads the live `ConversationSnapshot` through the slot's `useSession` hook, maps each durable `kind: 'user'` node to a tick, and measures the scrollport (`[data-conversation-scroll]`, `[data-composer-seat]`) to lay the rail out on the right edge. It defines no service and no host-side behavior.

Positioning is computed against the same stable data attributes the product itself uses (`[data-conversation-scroll]`, `[data-chat-flow]`, `[data-chat-anchor-key]`, `[data-composer-seat]`), so the rail stays correct across sidebar collapse, the details panel, theme changes, and live message appends.

## Install

Requires a DeepSeek Harness deployment with the **browser client** — that is the **desktop** app (Web UI embedded) or the **web** version alike. The rail is pure presentation; it renders only where the conversation composer exists.

```sh
pnpm add @lcthe/dsh-timeline-rail
```

Then add the plugin row to your `cordis.yml` at the same include level as the bundle rows:

```yaml
- insert:
    - id: dsh-timeline-rail
      name: '@lcthe/dsh-timeline-rail'
```

Full wiring details live in [INSTALL.cordis.yml.md](INSTALL.cordis.yml.md).

### Alternative: load in-session as a dynamic plugin

DSH web also ships a first-class dynamic-Cordis tool. If you are in a session and just want to try it, ask the agent to load the plugin (it can `cordis_define` + `cordis_run` this package). This is the recommendable route for quick evaluation; the npm package is the stable, shareable form.

## Peer dependencies

| package | range |
| --- | --- |
| `@deepseek-ai/cordis` | `>=4.0.1-rc.1` |
| `@deepseek-ai/dsh-client-locale` | `^0.0.1-rc.1` |
| `@deepseek-ai/dsh-client-runtime` | `^0.0.1-rc.1` |
| `@deepseek-ai/dsh-client-ui-conversation` | `^0.0.1-rc.1` |
| `@deepseek-ai/dsh-client-ui-slots` | `^0.0.1-rc.1` |
| `react` / `react-dom` | `^18.2.0` |

## Development

```sh
pnpm install
pnpm run build     # typecheck (tsc) + bundle (tsdown) -> lib/
```

- `lib/index.js`, `lib/invariant.js` — node-half ESM for the Host Loader.
- `lib/client.js` — the browser bundle in DSH's `__ModuleLoader__.load({ id, factory })` closure format, with CSS modules inlined and auto-injecting a `<style data-plugin>`.
- `lib/types/**` — emitted TypeScript declarations.

## Known limitations and deferred work

- The rail renders only in the **web** client; headless/TUI profiles have no composer slot, so nothing shows there.
- Ticks are currently **evenly spaced** (one per user message) rather than reflecting each message's true scroll position; a "minimap" mode that puts each tick at the message's real position is a natural follow-up.
- Message preview text is clamped to four lines; longer messages are truncated without an affordance to expand in the rail itself (clicking the tick already jumps you to the full message).
- The plugin targets the slot contract as of the `0.0.1-rc.1` release line of the Harness client packages. If the `conversation.input.dock` contract changes in a later RC, this package may need a bump.

## License

[MIT](LICENSE)
