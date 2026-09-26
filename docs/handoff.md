# 交接文档

后续迭代的入口。记录项目现状、运行方式、代码位置、约定、设计决定、用户反馈与待办。每次合并到 `main` 的改动如果影响这些内容，同步更新本文件。

## 1. 项目一览

| 项 | 内容 |
|---|---|
| 内容 | 网页端交互式立体书 Demo。人物与系统沿用《极乐迪斯科》：警探哈里尔·杜博阿与搭档金·曷城勘察一间密室书房；固定选项的对话树、2d6 能力检定、内心声音；中英双语，中文名称采用官方简体中文版译名 |
| 剧本 | 第一章《雪落之前》：书房勘察、三条线索、逻辑思维还原案发经过（`docs/design.md` 第 4 节） |
| 仓库 | `deadblue22/agent-elysium`（公开） |
| 部署 | Vercel 从 `main` 自动部署生产环境；其他分支与 PR 生成预览部署。GitHub 默认分支为 `main`；Vercel 的生产分支在 Settings → Environments → Production → Branch Tracking |
| 技术栈 | Vite 8、TypeScript 5.9（strict，禁止未使用变量）、Three.js r186（WebGL 2），无 UI 框架；测试用 vitest |
| 文档 | `README.md`（运行、模块、功能说明）、`docs/design.md`（方案、剧本、规则、视觉）、`docs/tech-eval.md`（技术栈评估）、本文件 |

## 2. 当前状态（2026-09-26）

- `main`：M1 最小 Demo 完成，第一章可从开场玩到「第一章 完」；含 M1 之后的第一次打磨（提交 37792f4：放大日志、逐段推进、减淡纸纹、加强光影、突出新线索、悬停提示）。
- [PR #1](https://github.com/deadblue22/agent-elysium/pull/1)（草稿，分支 `claude/gracious-pascal-b81l6p` → `main`）：M1 之后的第二次打磨。
  - 视角从 74° 改为 58°，整本书入画。
  - 书页加深到 670 × 720。
  - 日志字形从 20–22 像素缩小到约 16 像素，纵向拉伸 1.1 倍补偿斜视。
  - 右页改为房间地板，人物站进房间；骰子、士气、线索卡移到桌面。
  - 马雷克在房间里走动；时间标记显示真实时间；雪只在窗外。
  - 结尾改为离场、熄烛、「第一章 完」。
  - 验证已通过：单元测试 28 项、构建、中英文静帧、中英文无头通关；Vercel 预览部署成功。
  - 合并前需在浏览器中目视确认预览页。
- 本文件第 4–8 节描述 PR #1 合并后的代码。PR #1 未合并时，从该分支继续开发。

## 3. 环境与命令

| 命令 | 作用 | 云端容器内耗时 |
|---|---|---|
| `npm install` | 安装依赖（需要 Node 20+） | — |
| `npm test` | 引擎与打字节奏的单元测试 | 约 1 秒 |
| `npm run build` | 类型检查并构建到 `dist/` | 约 5 秒，产物约 18 MB |
| `npm run dev` | 开发服务器 | — |
| `npm run shot` / `npm run shot -- --lang en` | 渲染风格板静帧，写 `docs/style-board-three*.png`，并打印构图与字形尺寸 | 约 1 分钟 |
| `npm run play` | 无头通关中英文各一遍，写 `docs/m1-*.png`；`-- --only zh` 只跑中文 | 约 8 分钟（只跑中文约 5 分钟） |
| `npm run extract-art` | 从 `demo/index.html` 重新生成提取类纸片的 SVG | 数秒 |
| `npm run bake [名称…]` | 把 `assets/art/*.svg` 烘焙成 `public/textures/*.png` 与 `manifest.json` | 地板约 18 秒，其余数秒 |
| `npm run fonts` | 按全部台词重新裁剪字体子集（需要访问 Google Fonts） | — |

页面参数：`?still` 风格板静帧；`?lang=en` 英文；`?seed=N` 骰子种子；`?dice=4-5,3-3` 强制掷骰点数；`?speed=N` 倍速；`?debug` 在 `window.__debug` 暴露场景对象。`tools/play.mjs` 通过 `window.__play` 驱动游戏。

云端容器的注意事项：

- Chromium 预装在 `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`（`tools/chromium.mjs`，可用 `CHROMIUM_PATH` 覆盖），不要运行 `playwright install`。没有 GPU，WebGL 2 由 SwiftShader 提供，每帧 2–3 秒。
- 网络策略放行 Google Fonts；拦截 vercel.app、vercel.com、Steam、Fandom、维基百科、百度百科。因此无法在容器内查看部署页，也无法下载原作图片。
- 长任务（`play`）放到后台运行，按输出文件判断进度。

## 4. 代码地图

| 要改的东西 | 位置 |
|---|---|
| 相机俯角、焦距、构图、视差 | `src/scene/camera.ts` 的 `VIEW`（俯角 58、焦距 2600 帧像素、书尾边在画面第 858 行、封面宽 1190 像素、书中心在第 736 列） |
| 书页尺寸 | `src/page/layout.ts` 的 `PAGE`（670 × 720），必须与 `tools/extract-art.mjs` 的 `BOOK_H` 一致 |
| 撕口、家具行距、地毯、散落纸页 | `tools/extract-art.mjs` 开头的 `LEFT_TEAR`、`RIGHT_TEAR`、`ROWS`、`RUG`、`FLOOR_H` 与地板脚本；改完运行 `extract-art`，再 `bake floor page-left page-right`。散落纸页的坐标在 `src/scene/hotspots.ts` 的 `PAPERS` 里有一份副本，需同步 |
| 立体层的铰接行与后倾角 | `src/scene/popup.ts` 的 `PIECES` |
| 哈里与金的位置、大小 | `src/scene/puppets.ts` 的 `PUPPETS` |
| 桌面道具（线索卡堆、纸心、骰子） | `src/scene/tabletop.ts` 的 `TABLE`；线索卡落点与尺寸在 `src/scene/lead.ts` 的 `DROP`、`FILED` |
| 日志字号与行高 | `src/page/layout.ts` 的 `SIZES`；文字栏范围 `textColumn`；纵向拉伸 `src/main.ts` 的 `INK_STRETCH` |
| 打字速度、标点停顿 | `src/play/log.ts` 的 `TYPE_MS`、`PAUSES`；逐段停顿规则在 `src/play/director.ts` |
| 灯光 | `src/scene/lights.ts`（半球光、左侧主光、蜡烛、窗光、台灯） |
| 颗粒、暗角、调色、夜色 | `src/scene/post.ts` |
| 舞台动画 | `src/scene/cues.ts`。剧本里用到的指令：`flashback`、`snow-stop`、`raise-stairs`、`marek-climb`、`marek-blow`、`clock-set`、`window-open`、`marek-leave`、`snow-start`、`present`、`exit`。时间标记在 `REAL_TIME`，马雷克的行走点在 `SPOT` |
| 剧本、选项、检定 | `src/content/study.ts`，与 `docs/design.md` 4.4 节保持一致；技能与难度在 `skills.ts`；界面文字在 `ui.ts` |
| 悬停提示 | 文案在 `src/content/hotspots.ts`；拾取区域在 `src/scene/hotspots.ts` 的 `REGIONS` |
| 检定、旗标、重试规则 | `src/engine/`（`runner.ts`、`rules.ts`），测试在 `runner.test.ts` |

## 5. 约定

- **坐标**：书页像素 `bx` 0–1340（书脊在 670）、`by` 0–720（从书头到书尾）；100 书页像素 = 1 世界单位；世界 Y 向上，桌面 Y = 0，+Z 朝向读者。换算函数 `wx`、`wz` 在 `src/scene/space.ts`。
- **立体层**：每层是一张铰接在底页折线上的纸片（`standing()`），`hinge` 为折线的 `by`，`lean` 为后倾角。
- **美术流水线**：`assets/art/*.svg` 是源文件。`public/textures/` 由 `bake` 生成，不手改。
  - `extract-art` 会重新生成以下提取类纸片：far、far-snow、wall、sill-snow、furniture、desk、front-chair、front-right、floor、page-left、page-right、table、dice。要改这些纸片，改脚本，不要直接改 SVG，否则下次提取会被覆盖。
  - 以下为手绘纸片，不受 `extract-art` 影响：harry、kim、casement、clock-hour、clock-minute、pendulum、stairs、dog、dog-head、marek、heart、heart-empty、lead-card。
  - SVG 根元素的 `data-*` 属性进入 `manifest.json` 的 `meta`，例如脚底位置、撕口范围、地毯范围。
- **文字**：日志用 Canvas 2D 排版，作为纹理贴在左页网格上，点击用射线取 UV。排版在未拉伸的坐标里进行，绘制时纵向拉伸 1.1 倍；`optionRects()` 返回拉伸后的真实页面坐标。
- **动画**：一律走 `src/play/clock.ts` 的虚拟时钟（`tween`、`wait`），因此支持倍速、减少动态效果与测试冻结。引擎只产出节拍，`Director` 逐个播放。
- **字体**：新增或修改台词后运行 `npm run fonts`，否则缺字会回退到系统字体。
- **双语**：每条文本写成 `{ zh, en }`。
- **截图**：画面改动后重新生成 `docs/style-board-three*.png`（`shot`）与 `docs/m1-*.png`（`play`）并提交。

## 6. 设计决定

| 决定 | 原因 |
|---|---|
| 渲染从 CSS 3D 迁到 Three.js | CSS 3D 下文字透视与纸面不一致、发虚，层间没有真实投影（`docs/tech-eval.md`） |
| 相机俯角：44° → 68° → 74° → 58° | 44° 时文字看着吃力，改为更俯视；74° 时整体压扁、不舒服。58° 接近参考 demo，文字问题改用长焦与纵向拉伸解决 |
| 右页改为房间地板 | 人物站在白纸上、脱离房间，右页只剩界面元素，显得不合理 |
| 士气、线索、骰子放到桌面 | 右页不承载界面；桌面道具符合实物立体书的场景 |
| 结尾不再翻页 | 右页现在是整块房间地板，翻页会穿过立着的家具；改为两人离场、熄烛 |
| 雪只在窗外 | 室内飘雪不自然 |
| 颗粒强度 0.05 | 用户认为噪点过重，多次下调 |
| 纸偶按文字资料绘制 | 原作图片所在站点被网络策略拦截 |

## 7. 用户偏好

- 交流用中文。文档写法客观简洁，接近 Wiki，少用人称代词，不用修辞性表达。
- 视觉目标：精致、自然；可以做较大幅度的修改。
- 历次反馈的要点：
  - 文字要可读，但不能过大。
  - 视角不要过度俯视。
  - 纸纹与噪点要克制，光影要有层次。
  - 新线索要显眼。
  - 每段话停下等点击，打字不要太快。
  - 物件悬停要有提示。
- 人物形象、性格与语言风格采用原作。只是 Demo，不考虑版权。
- 工作流：在分支上开发，开 PR 合并到 `main`，由 Vercel 部署。

## 8. 已知问题与候选工作

- 主光在左侧，墙在书右后方的桌面上投下的影子偏大、偏暗。可以抬高主光或加大阴影半径。
- 线索卡堆上的字很小，目前靠悬停提示查看。
- 纸偶没有按原作立绘校准，需要用户在对话中附参考图，或在环境设置中放行对应域名。
- 开场首帧，立体层向后倒平时会伸出书头、悬在桌面上方，持续不到 1 秒。
- 包体约 18 MB，其中 `floor.png` 4.7 MB。可以改用 WebP，或降低烘焙倍率。
- `docs/design.md` 7.2 节是方案阶段的模块规划，与实际代码不一致，以 README 为准。
- M2 计划（`docs/design.md` 8 节）：
  - 第二章：二楼房客的房间，对质马雷克。
  - 士气归零的处理。
  - 简化版思维阁。
  - 音效。
  - 移动端布局。

## 9. 迭代流程

1. 从 `main` 建分支。PR #1 未合并时，从 `claude/gracious-pascal-b81l6p` 继续。
2. 修改后依次运行 `npm test`、`npm run build`、`npm run shot`（中英文）。改到交互或动画时，再跑 `npm run play`。
3. 同步更新 README、`docs/design.md`、本文件与截图。
4. 提交并推送，开 PR 到 `main`。Vercel 生成预览部署，在浏览器中确认后合并。
