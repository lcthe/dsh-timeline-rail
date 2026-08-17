/**
 * Standalone tsdown build for @lcthe/dsh-timeline-rail.
 *
 * Mirrors how the DeepSeek Harness monorepo builds a client UI plugin
 * (`packages/client/tsdown.client.ts`):
 *  - `src/index.ts` + `src/invariant.ts` -> plain ESM node lib (`lib/index.js`,
 *    `lib/invariant.js`) for the Host-side Loader.
 *  - `src/client/index.ts` -> the browser bundle `lib/client.js`, emitted as a
 *    `__ModuleLoader__.load({ id, factory })` closure so the web client runner
 *    can mount it. CSS Modules are compiled with lightningcss and injected as
 *    one `<style data-plugin>` tag; platform modules stay external and resolve
 *    through the runner's injected `require`.
 *
 * Types are emitted separately by `tsc -p tsconfig.build.json` into `lib/types`.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const ID = '@lcthe/dsh-timeline-rail'

/** Virtual-id wrapper keeping module CSS away from tsdown's own css pipeline. */
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** The shell's frozen module table: platform seed entries the runner provides. */
const PLATFORM_MODULES: readonly string[] = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
  // Documented runtime store exemption; the runner answers it in the same tier.
  '@deepseek-ai/dsh-client-runtime/client',
]

const externals = [...PLATFORM_MODULES]

/** Node-half ESM library config (Host-side Loader entry points). */
function libraryConfig(): UserConfig {
  return {
    name: ID,
    entry: ['src/index.ts', 'src/invariant.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  }
}

/** Browser closure-factory bundle consumed by the client runner. */
function clientConfig(entry: string): UserConfig {
  return {
    name: `${ID}/client`,
    entry: { client: entry },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    external: externals,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    noExternal: (id: string) => (externals.includes(id) ? undefined : true),
    plugins: [{
      name: 'dsh-css-modules-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.module.css')) return null
        const abs = importer !== undefined ? resolve(dirname(importer), source) : source
        return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
        const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        this.addWatchFile(fileId)
        const source = await readFile(fileId)
        const { code, exports: cssExports } = transform({
          filename: fileId,
          code: source,
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
        const tagId = `${ID}/${basename(fileId)}`
        return [
          `const css = ${JSON.stringify(code.toString())};`,
          `const tagId = ${JSON.stringify(tagId)};`,
          "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
          "  const tag = document.createElement('style');",
          `  tag.dataset.plugin = ${JSON.stringify(ID)};`,
          '  tag.dataset.pluginCss = tagId;',
          '  tag.textContent = css;',
          '  document.head.appendChild(tag);',
          '}',
          `export default ${JSON.stringify(classMap)};`,
        ].join('\n')
      },
    }],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  }
}

export default defineConfig(() => [libraryConfig(), clientConfig('src/client/index.ts')])
