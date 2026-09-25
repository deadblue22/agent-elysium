# agent-elysium

网页端的交互式动态立体绘本 Demo。画面是纸艺立体书，叙事与系统致敬《极乐迪斯科》：固定选项的对话树、能力检定、掷骰子、内心声音，中英双语。

## 文档

- [方案设计](docs/design.md)：目标、参考 demo 拆解、角色、第一章完整剧本、游戏系统、视觉与动效、技术方案、里程碑。
- [技术栈评估](docs/tech-eval.md)：为什么从 CSS 3D 迁移到 Three.js，文字页如何贴在纸面上。
- [Three.js 画面](docs/style-board-three.png)与[左页 1:1 裁切](docs/style-board-three-text.png)：当前画面基准。
- [风格板截图](docs/style-board.png)：M0 阶段的 CSS 3D 画面，作对照。
- [早期布局示意图](docs/mockup-layout.png)：第一版平面示意，已被风格板取代，仅作对照。

## 运行

需要 Node 20 以上。

```
npm install
npm run dev      # 开发服务器
npm run build    # 类型检查并构建到 dist/
npm run bake     # assets/art/*.svg 烘焙为 public/textures/*.png 与 manifest.json
npm run shot     # 构建、在 Chromium 中渲染，截图到 docs/style-board-three*.png
```

内容是第一章 `study.clock` 节点的一个静止瞬间：木桌上的开本，书页平放、页叠错落；两张顶页的上半被撕去，露出底页上的书房地板，五层纸艺书房分排立在底页的地板上，排与排之间露出地板和投影；左页文字日志自下而上排列，旧行升入撕口处淡出，鼠标滚轮可在左页上翻看历史；右页两个纸偶与骰子站在撕口下的纸面上。鼠标移动时相机有几度的视差，悬停左页的当前选项会高亮，点击在控制台输出选项序号。右上角可切换中英文。

`bake` 与 `shot` 使用预装的 Chromium（路径见 `tools/chromium.mjs`，可用 `CHROMIUM_PATH` 覆盖），没有 GPU 时由 SwiftShader 提供 WebGL 2。页面参数：`?still` 冻结雪、颗粒与光标，用于截图；`?lang=en` 以英文打开。

## 模块

- `src/scene/`：`table` 木桌，`book` 封面、错落的页叠、底页上的地板与撕去上半的两张顶页，`popup` 背景板五层，`puppets` 纸偶、骰子与士气，`lights` 灯光与阴影，`post` 颗粒、暗角与调色，`camera` 相机与视差，`snow` 雪，`space` 坐标与纸片工具。
- `src/page/`：`layout` 日志排版（中文按字断行、避头尾，英文按词；自下而上锚定），`painter` 画布绘制、滚动窗口与撕口处的淡出，`hit` 射线命中选项。
- `src/content/`：`schema` 类型（design.md 7.3），`skills` 技能表与颜色，`study-clock` 本节点台词。
- `assets/art/*.svg`：每张纸片一个矢量源文件，撕边与纸纹滤镜写在文件里，只在烘焙时运行。
- `public/textures/`：烘焙结果；`public/fonts/`：字体子集。
- `tools/`：`bake` 烘焙，`shot` 截图，`fonts` 解出字体子集并复制拉丁字体，`extract-art` 从旧风格板提取纸片（一次性迁移工具，重跑会覆盖 `assets/art`）。

## 旧风格板

`demo/index.html` 是 M0 阶段的 CSS 3D 单文件页面，保留作对照，直接用浏览器打开即可，运行时不再使用。页面内嵌了按台词裁剪的字体子集，台词变更后先重新生成子集（需要 `fontTools` 与网络），再解出到 `public/fonts`：

```
python3 tools/embed_fonts.py
npm run fonts
```

## 当前阶段

M0 风格板已迁移到 Three.js：纸片纹理离线烘焙，投影与光照由渲染器产生，左页文字以画布纹理画在页面网格上。下一步进入 M1 最小 Demo（完整对话树、检定与骰子、还原动画、语言切换）。
