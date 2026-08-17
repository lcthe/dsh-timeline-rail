# @lcthe/dsh-timeline-rail

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 网页会话的 **消息时间轴导航条**。

在会话消息区右侧、输入框上方,绘制一条**低对比、等间距的短横线刻度列**——每条用户消息一个刻度,风格接近编辑器 / 会议记录阅读器。悬浮刻度预览该条消息,点击把会话跳到这条消息。

![screenshot placeholder](docs/screenshot.png)

## 功能

- **等间距刻度** —— 每条用户消息在 1px 细轨道上对应一条短横线,整段对话读起来是一条干净的时间轴,而不是按位置压缩的地图。
- **点击跳转** —— 把选中的用户消息对齐到消息区顶部。
- **悬浮预览** —— 弹出紧凑宽卡片:显示「用户 · 第 N 条」和消息前几行文本;纯图片 / 附件消息显示对应的占位文案。
- **跟随主题** —— 颜色全部取自 `--dsw-*` token,深浅色主题自动适配,无需额外配置。
- **不挡界面** —— 除刻度本身外全线透传 pointer-events,绝不影响消息区点击。

## 原理

DSH 的 Web 界面是一个 Cordis 组合。这个包是**客户端插件**,只向 `conversation.input.dock` 槽位(输入框上方那条加法带)注册一个入口:通过槽位提供的 `useSession` hook 读取实时的 `ConversationSnapshot`,把每条 `kind: 'user'` 节点映射成一个刻度,再测量滚动容器(`[data-conversation-scroll]`、`[data-composer-seat]`)把轨道铺到右侧边缘。它不定义任何服务,也没有宿主侧行为。

定位使用的正是产品自身的那组稳定 data 属性(`[data-conversation-scroll]`、`[data-chat-flow]`、`[data-chat-anchor-key]`、`[data-composer-seat]`),所以在折叠侧栏、打开详情列、切换主题、新消息追加时都能保持正确。

## 安装

需要 DeepSeek Harness **Web**(浏览器端)部署。这是纯展示功能,只有存在会话输入框的地方才会渲染。

```sh
pnpm add @lcthe/dsh-timeline-rail
```

然后在 `cordis.yml` 与其它 bundle 行的同一 include 层级加入插件行:

```yaml
- insert:
    - id: dsh-timeline-rail
      name: '@lcthe/dsh-timeline-rail'
```

完整的接线说明见 [INSTALL.cordis.yml.md](INSTALL.cordis.yml.md)。

### 另一种方式:作为动态插件在会话内加载

DSH Web 自带一等公民的动态 Cordis 工具。如果想在某个会话里快速试用,让 agent 加载本包(`cordis_define` + `cordis_run`)即可;npm 包则是稳定、可共享的形式。

## 对等依赖

| package | range |
| --- | --- |
| `@deepseek-ai/cordis` | `>=4.0.1-rc.1` |
| `@deepseek-ai/dsh-client-locale` | `^0.0.1-rc.1` |
| `@deepseek-ai/dsh-client-runtime` | `^0.0.1-rc.1` |
| `@deepseek-ai/dsh-client-ui-conversation` | `^0.0.1-rc.1` |
| `@deepseek-ai/dsh-client-ui-slots` | `^0.0.1-rc.1` |
| `react` / `react-dom` | `^18.2.0` |

## 开发

```sh
pnpm install
pnpm run build     # typecheck(tsc)+ bundle(tsdown)-> lib/
```

- `lib/index.js`、`lib/invariant.js` —— 宿主 Loader 用的 node 半区 ESM。
- `lib/client.js` —— 浏览器打包产物,DSH 的 `__ModuleLoader__.load({ id, factory })` 闭包工厂格式,CSS Module 内联并自动注入 `<style data-plugin>`。
- `lib/types/**` —— 生成的 TypeScript 声明。

## 已知限制与后续计划

- 只在 **Web** 客户端渲染;headless / TUI profile 没有输入槽位,因此不显示。
- 目前刻度是**等间距**(每条用户消息一个),不反映消息的真实滚动位置;"minimap 模式"(刻度对应真实位置)是自然的后续增强。
- 预览文本最多显示 4 行,更长的消息会被截断,且在时间轴内没有就地展开的入口(点击刻度已能跳到完整消息)。
- 插件面向 Harness 客户端 `0.0.1-rc.1` 发布线的槽位契约;如果后续 RC 里 `conversation.input.dock` 契约变化,本包可能需要跟随升级。

## License

[MIT](LICENSE)
