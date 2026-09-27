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

## 2. 当前状态（2026-09-27）

- `main`：M1 最小 Demo 完成，第一章可从开场玩到「第一章 完」。含 M1 之后的两次打磨：
  - 第一次（提交 37792f4）：放大日志、逐段推进、减淡纸纹、加强光影、突出新线索、悬停提示。
  - 第二次（[PR #1](https://github.com/deadblue22/agent-elysium/pull/1)，已合并）：视角 58°、日志字形约 16 像素、右页改为房间地板、骰子等道具移到桌面、马雷克走动、结尾离场熄烛。
- [PR #2](https://github.com/deadblue22/agent-elysium/pull/2)（分支 `claude/handsoff-polish-9bc7b7` → `main`）：M1 之后的第三次打磨，针对质感。
  - 主光阴影随距离变软（PCSS）：落脚处清晰，远处柔和。墙在桌面上的影子不再是硬边的深色楔形。
  - 立体层、纸偶、楼梯、狗与马雷克有了卡纸厚度：朝上的切边露出一条浅色纸芯。卡片从背面看是素色纸背。
  - 木桌改为着色器绘制的胡桃木：木板、年轮、导管、板缝。原来的 1 倍烘焙纹理是拉伸的噪声，放大后是模糊的横纹。
  - 地板上的散落纸页从 14 张减到 10 张，分账页与订货单两种，颜色压暗，集中在书桌附近。
  - 纸心改为哑光纸片，沿中线对折；骰子改为圆角纸骰；桌面线索卡放大 1.25 倍。
  - 开场：立体层先正面朝下折在书页上，露出素色纸背，再由后往前逐排翻起。窗扇随墙打开，书桌立起后点亮蜡烛，墙立起后开始下雪。修复了立体层向后倒平时伸出书头、悬在桌面上方的问题。
  - 纹理改为 WebP（色彩有损、透明通道无损），`public/textures` 从 14.9 MB 降到 1.8 MB，构建产物从约 18 MB 降到约 3 MB。
  - 工具脚本在 macOS 上改用本机 Chrome 与 GPU。
  - 验证已通过：单元测试 28 项、构建、中英文静帧、中英文无头通关（无控制台错误）、悬停提示命中检查。
- 第四轮（分支 `claude/round4-view-bgm-cast-style`，基于 PR #2 的分支）：由四个子任务并行完成后合并。
  - 取景：相机改为坐在桌前的读者视角，默认视角 2（眼高约 47 cm、离书中心约 64 cm），书前留出桌面，桌面木板由近及远。`?view=0|1|2|3` 切换候选，0 为此前的取景（`docs/view.md`）。
  - 背景音乐：当时是 Web Audio 实时合成的原创芯片音乐，之后换成用户提供的录音（见下）。
  - 纸偶：按原作四类参考图（对话肖像、游戏内 3D 模型、封面、设定图）各画一版，`?cast=1|2|3|4` 切换，默认仍是原来的一对。参考图只在文档里外链。第六轮选定新方向后删除。
  - 原作风格：三组参考（对话与界面、油画与光色、标志性细节）与对应的三个运行时预设，`?style=1|2|3` 可组合，默认不启用（`docs/style-refs.md`）。
  - 验证：单元测试 41 项、构建、中英文静帧、中英文无头通关（默认参数）均通过；各子任务在各自的候选参数下也完整通关过。
  - 待用户选定：取景、纸偶版本、风格预设的取舍，见第 8 节。
- PR #2 与第四轮（PR #4）已合入 `main`。第四轮之后：
  - 音效：用 Web Audio 实时合成（`src/audio/sfx.ts`），覆盖写字、骰子、检定、内心声音、线索、士气、纸片、窗扇、钟、脚步、蜡烛等；右上角独立开关。
  - 背景音乐：换成用户提供的录音 `public/audio/elysium.mp3`，音量比原文件低约 9 dB；合成曲（`score.ts`、`engine.ts`）已删除。第六轮之后用户反馈音乐仍比音效大不少，再降约 10 dB（共约 −19 dB，−34.7 LUFS）。
  - 按用户试听反馈改了两个音效：打字声改为铅笔写字（每字两笔、有抬笔），骰子改为清脆的塑料磕碰与弹跳。
- 第五轮（用户反馈原作风格体现不够、场景太温馨，需要更大胆的尝试；附五张原作参考图）：三个子任务并行。
  - `?ui=de`：左页日志印成原作的深色对话面板（白色衬线字、粗体大写名称、按属性着色的技能名、检定纸条、青色继续条与红色颜料），画面四周加原作的 HUD（哈里与金的圆形头像、生命与士气格、工具图标与线索角标、按台词走的时钟、技能标签与检定横幅）。见 `docs/ui.md`。
  - `?look=winter`：低角度冬阳从窗洞射入，长而硬的蓝灰影，带灰尘的光束，台灯关闭，蜡烛成为唯一的暖色，降饱和调色；`?look=noir`：暗房、月光光束、蜡烛的暖光池与金色光点、深暗角。两者都叠加运行时绘制的脏旧。见 `docs/look.md`。
  - `?paint=1|2`：整帧重画成油画（画家调色板、各向异性 Kuwahara 滤波、笔触与刮刀痕、画布纹理），窗外换成按 Rostov 概念画绘制的远景。曾合入 `main`（PR #8），第六轮移除。
  - 默认参数下画面与此前逐像素一致。
- 第六轮（用户反馈：「`?look=winter&ui=de` 这个组合还不错，但有几个 UI 似乎没有实际用途。油画直接用在画面上效果并不好」）：
  - 冬日与原作界面改为默认。`?ui=book` 回到书页排法，`?look=warm` 回到暖色绘本，`?look=noir` 为夜；`?still&ui=book&look=warm` 与此前默认的静帧逐像素一致。
  - HUD 只留本章用得上的部分：头像（说话者）、士气、时钟与检定横幅。去掉生命（本章没有生命规则）、角色、物品、思维阁图标（不能点击）、日志图标与线索角标（与桌上线索卡堆重复）、托盘上的胶片编码。原作界面下桌上不再放纸心，士气只显示在 HUD 上：失去时横幅、下降音、格子逐个熄灭；悬停十字框显示士气提示。见 `docs/ui.md` 3.3 节。
  - 油画后期整体移除（代码、文档与截图），不再作为候选。原因：滤镜盖在整帧上，纸片、文字与桌面一起被涂抹，失去立体书的材质与清晰度。若之后仍要油画感，应画进素材（墙纸、窗外远景等纹理），不要做成整帧后期。
  - `tools/play.mjs` 新增 `--query`，在额外的页面参数下通关（例如 `--query "ui=book&look=warm"`）。
  - 背景音乐再降约 10 dB（PR #10）。
  - 深色面板的排版：字号小约一成（中文 22），行距 1.66 倍，两条日志之间空约 0.4 行，文字栏四周的边距加宽（`docs/ui.md` 3.4 节）。
  - 纸偶：用户要求用十套不同的原作参考图各做一套人物设计、尝试不同风格与抽象程度（也可以直接抠原作的图），并做单独的预览页。五个子任务并行做了 v5–v14（设定图抠图、游戏画面抠图、肖像拼贴、封面丝网印、技能肖像、政治海报、夜色剪影、思维阁线稿、低多边形纸模、贴纸卡通），预览页只在本机。用户选定 v13 低多边形纸模：`assets/art/harry.svg`、`kim.svg` 改由 `tools/papercraft` 生成；第四轮的 v1–v4、`?cast` 参数与 `tools/cast.mjs` 删除。见 `docs/cast.md`。
  - 去掉内心声音标签：用户认为「检定信息在书上弹出看起来不太真实」。平面的 HTML 标签叠在倾斜的书页上，看起来是贴上去的；技能名本来就按属性颜色印在日志里。
  - 「你」的台词改为浅橙色（名字 #F48D66、话 #E6AA8E），与金的白色区分：用户反馈两个主角的名字和说话颜色区分不出来（`docs/ui.md` 3.5 节）。
- 本文件第 3–8 节描述合并后的 `main`。

## 3. 环境与命令

| 命令 | 作用 | 云端容器内耗时 | macOS（M4 Pro）耗时 |
|---|---|---|---|
| `npm install` | 安装依赖（需要 Node 20+） | — | — |
| `npm test` | 引擎、打字节奏、风格、界面与氛围参数的单元测试（35 项） | 约 1 秒 | 约 1 秒 |
| `npm run build` | 类型检查并构建到 `dist/` | 约 5 秒 | 约 1 秒；产物约 3 MB |
| `npm run dev` | 开发服务器 | — | — |
| `npm run shot` / `npm run shot -- --lang en` | 渲染风格板静帧，写 `docs/style-board-three*.png`，并打印构图、字形尺寸与帧耗时；`-- --view 0,1,2,3` 改为写各取景的 `docs/view-N.png` | 约 1 分钟 | 约 5 秒 |
| `npm run play` | 无头通关中英文各一遍，写 `docs/m1-*.png`；`-- --only zh` 只跑中文；`-- --view N --out 目录` 在指定取景下通关并把截图写到别处；`-- --query "ui=book&look=warm"` 加页面参数 | 约 8 分钟（只跑中文约 5 分钟） | 约 2 分钟 |
| `npm run papercraft` | 由 `tools/papercraft/harry.mjs`、`kim.mjs` 生成 `assets/art/harry.svg`、`kim.svg` 并烘焙 | — | 约 3 秒 |
| `npm run extract-art` | 从 `demo/index.html` 重新生成提取类纸片的 SVG | 数秒 | 数秒 |
| `npm run bake [名称…]` | 把 `assets/art/*.svg` 烘焙成 `public/textures/*.webp` 与 `manifest.json` | 地板约 18 秒，其余数秒 | 地板约 2 秒 |
| `npm run fonts` | 按全部台词重新裁剪字体子集（需要访问 Google Fonts） | — | — |

页面参数：`?still` 风格板静帧；`?lang=en` 英文；`?seed=N` 骰子种子；`?dice=4-5,3-3` 强制掷骰点数；`?speed=N` 倍速；`?debug` 在 `window.__debug` 暴露场景对象；`?view=N` 取景候选；`?style=1|2|3` 风格预设（可组合，按书页排法设计）；`?ui=book` 书页排法（默认为原作对话面板与 HUD）；`?look=noir|warm` 夜或暖色绘本（默认为冬日）。`tools/play.mjs` 通过 `window.__play` 驱动游戏。

浏览器：`tools/chromium.mjs` 决定 `bake`、`shot`、`play`、`extract-art` 使用的浏览器，可用 `CHROMIUM_PATH` 覆盖。

- macOS：使用 `/Applications/Google Chrome.app`，WebGL 2 走 GPU（ANGLE Metal），1600 × 900 约 8 毫秒一帧。
- 云端容器：使用预装的 Chromium（`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`），不要运行 `playwright install`。

云端容器的注意事项：

- 没有 GPU，WebGL 2 由 SwiftShader 提供，每帧 2–3 秒。
- 网络策略放行 Google Fonts；拦截 vercel.app、vercel.com、Steam、Fandom、维基百科、百度百科。因此无法在容器内查看部署页，也无法下载原作图片。
- 长任务（`play`）放到后台运行，按输出文件判断进度。

## 4. 代码地图

| 要改的东西 | 位置 |
|---|---|
| 相机俯角、焦距、构图、视差 | `src/scene/camera.ts` 的 `VIEWS`（每个候选取景一行：光轴俯角、焦距、光轴所在行、书尾边所在行与宽度、书中心列、日志纵向拉伸 `ink`、木板走向 `boards`）与 `DEFAULT_VIEW`（2：俯角 42、焦距 1700 帧像素、书尾边在第 770 行、封面宽 1250 像素、拉伸 1.21、木板由近及远）；参数与指标见 `docs/view.md` |
| 书页尺寸 | `src/page/layout.ts` 的 `PAGE`（670 × 720），必须与 `tools/extract-art.mjs` 的 `BOOK_H` 一致 |
| 撕口、家具行距、地毯 | `tools/extract-art.mjs` 开头的 `LEFT_TEAR`、`RIGHT_TEAR`、`ROWS`、`RUG`、`FLOOR_H` 与地板脚本；改完运行 `extract-art`，再 `bake floor page-left page-right` |
| 散落纸页 | `assets/art/floor-papers.json`（每张 `[x, y, 角度, 宽, 高]`，y 从折线量起；高大于宽为账页，否则为订货单）。`extract-art` 按它画进地板，悬停提示按它划分区域；改完运行 `extract-art` 与 `bake floor` |
| 立体层的铰接行与后倾角 | `src/scene/popup.ts` 的 `PIECES` |
| 哈里与金的位置、大小 | `src/scene/puppets.ts` 的 `PUPPETS` |
| 桌面道具（线索卡堆、纸心、骰子） | `src/scene/tabletop.ts` 的 `TABLE`；线索卡落点与尺寸在 `src/scene/lead.ts` 的 `DROP`、`FILED`。纸心只在 `?ui=book` 下出现 |
| 日志字号与行高 | `src/page/layout.ts` 的 `SIZES`（书页排法）与 `SIZES_DE`（深色面板：字号、行距、段距 `gap`、选项间距 `optionGap`）；文字栏范围与边距 `textColumn`；纵向拉伸按取景取 `VIEWS[n].ink`（`src/main.ts` 的 `INK_STRETCH`） |
| 打字速度、标点停顿 | `src/play/log.ts` 的 `TYPE_MS`、`PAUSES`；逐段停顿规则在 `src/play/director.ts` |
| 灯光 | `src/scene/lights.ts`（半球光、左侧主光、蜡烛、窗光、台灯） |
| 主光软阴影 | `src/scene/penumbra.ts`；光源角半径 `angle`（度）与最大半影 `max`（世界单位）在 `lights.ts` 调用 `softShadows` 处 |
| 卡纸厚度与纸背 | `src/scene/paper.ts` 的 `cardEdge`、`CARD_T`（厚度）、`CARD_CORE`（纸芯颜色） |
| 木桌 | `src/scene/table.ts` 的 `BOARD`（板宽、板长）与着色器 `WOOD`（颜色、年轮密度、板缝） |
| 纸心的折痕、骰子的圆角 | `src/scene/hearts.ts` 的 `FOLD`；`src/scene/dice.ts` 的 `RoundedBoxGeometry` 半径 |
| 颗粒、暗角、调色、夜色 | `src/scene/post.ts` |
| 舞台动画 | `src/scene/cues.ts`。剧本里用到的指令：`flashback`、`snow-stop`、`raise-stairs`、`marek-climb`、`marek-blow`、`clock-set`、`window-open`、`marek-leave`、`snow-start`、`present`、`exit`。时间标记在 `REAL_TIME`，马雷克的行走点在 `SPOT` |
| 开场 | `src/scene/cues.ts` 的 `FOLDED`（折叠角度）、`flatten()` 与 `enter()`（逐排翻起的节奏、窗扇、蜡烛、雪、烟头） |
| 剧本、选项、检定 | `src/content/study.ts`，与 `docs/design.md` 4.4 节保持一致；技能与难度在 `skills.ts`；界面文字在 `ui.ts` |
| 悬停提示 | 文案在 `src/content/hotspots.ts`；拾取区域在 `src/scene/hotspots.ts` 的 `REGIONS` |
| 检定、旗标、重试规则 | `src/engine/`（`runner.ts`、`rules.ts`），测试在 `runner.test.ts` |
| 背景音乐 | 录音 `public/audio/elysium.mp3`；音量 `VOLUME`、回忆时的低通与音量 `COLD`、淡入淡出 `FADE` 在 `src/audio/music.ts`；剧情钩子经 `createCues` 的 `onCue` 回调接入。说明见 `docs/music.md` |
| 音效 | 配方、音量与混响在 `src/audio/sfx.ts` 的 `createBank`（每个音效一段，按名称 `SoundName` 调用）；触发点：`src/play/log.ts` 的 `onType`（写字）、`src/play/director.ts`（继续、选择、内心声音、检定结果）、`src/scene/dice.ts` 的 `CONTACTS`（骰子落桌）、`hearts.ts`、`lead.ts`、`cues.ts`（纸片、脚步、窗扇、钟、风、蜡烛、钟摆） |
| 纸偶的造型 | `tools/papercraft/harry.mjs`、`kim.mjs`：材质颜色 `M`，各部件的截面环（形体与比例），`make()` 的朝向 `yaw` / `pitch`、光照、折线与切边的粗细；渲染器在 `lib3d.mjs`。改完运行 `npm run papercraft`。生成的 SVG 不要手改。根元素的 `data-*`（脚底、立脚范围、烟头）由脚本写出 |
| 原作界面（默认；`?ui=book` 为书页排法） | 开关 `src/ui.ts`；日志的深色面板排版 `src/page/layout.ts` 的 `DE` 与 `painter.ts`；HUD `src/play/hud.ts`（头像、士气、时钟、横幅）、头像 `src/play/portraits.ts`；样式在 `index.html` 的 `[data-ui]` 下；士气显示在 HUD 还是纸心由 `src/main.ts` 的 `morale` 决定。说明见 `docs/ui.md` |
| 氛围预设（默认冬日；`?look=noir|warm`） | 预设参数 `src/scene/mood.ts`；光束与浮尘 `shaft.ts`；脏旧 `grime.ts`（各纸片按自身坐标生成污渍）；在剧本指令读取灯光基准值之前生效。说明见 `docs/look.md` |
| 原作风格预设 | 开关 `src/style.ts`；预设 1 在 `src/page/layout.ts`、`painter.ts`、`src/play/log.ts` 与 `index.html` 的 `data-style` 样式；预设 2 在 `src/scene/palette.ts` 与 `post.ts`；预设 3 在 `src/scene/details.ts`。参考与取舍见 `docs/style-refs.md` |

## 5. 约定

- **坐标**：书页像素 `bx` 0–1340（书脊在 670）、`by` 0–720（从书头到书尾）；100 书页像素 = 1 世界单位；世界 Y 向上，桌面 Y = 0，+Z 朝向读者。换算函数 `wx`、`wz` 在 `src/scene/space.ts`。
- **立体层**：每层是一张铰接在底页折线上的纸片（`standing()`），`hinge` 为折线的 `by`，`lean` 为后倾角。
- **美术流水线**：`assets/art/*.svg` 是源文件。`public/textures/` 由 `bake` 生成（WebP，质量 0.92，透明通道无损），不手改。
  - `extract-art` 会重新生成以下提取类纸片：far、far-snow、wall、sill-snow、furniture、desk、front-chair、front-right、floor、page-left、page-right、dice。要改这些纸片，改脚本，不要直接改 SVG，否则下次提取会被覆盖。
  - 木桌不是纸片，由 `src/scene/table.ts` 的着色器绘制，没有纹理。
  - 纸偶 harry、kim 由 `tools/papercraft` 生成。以下为手绘纸片，不受 `extract-art` 影响：casement、clock-hour、clock-minute、pendulum、stairs、dog、dog-head、marek、heart、heart-empty、lead-card。
  - SVG 根元素的 `data-*` 属性进入 `manifest.json` 的 `meta`，例如脚底位置、撕口范围、地毯范围。
- **文字**：日志用 Canvas 2D 排版，作为纹理贴在左页网格上，点击用射线取 UV。排版在未拉伸的坐标里进行，绘制时按取景纵向拉伸（默认 1.21 倍）；`optionRects()` 返回拉伸后的真实页面坐标。
- **候选方案**：`?view`、`?style`、`?look=noir` 是给用户比较用的开关。选定后把选中的一项设为默认，其余删掉或保留作对照，并同步本文件、README 与 design.md。第六轮选定的界面与氛围保留了此前的默认作对照（`?ui=book`、`?look=warm`）。
- **音乐与音效**：只在第一次点击、触摸或按键之后创建 AudioContext（浏览器会对更早的尝试发出警告，`play` 把控制台警告当失败）；`?still` 不出声。音效与音乐各用一个 AudioContext、各有开关。场景模块通过注入的 `sound(name, options)` 发声（`createDice`、`createHearts`、`createLeadCard`、`createCues` 的参数，`Director` 的 `Stagehands.sound`），不直接依赖音频实现。
- **参考图**：原作图片只在文档里外链，不进仓库；纸偶与界面都是自绘。
- **动画**：一律走 `src/play/clock.ts` 的虚拟时钟（`tween`、`wait`），因此支持倍速、减少动态效果与测试冻结。引擎只产出节拍，`Director` 逐个播放。
- **卡纸**：用 `standing()` 立起的纸片调用 `cardEdge()`，得到纸芯切边与纸背。平放在地板或桌面上的纸片（地板、线索卡、纸心）不加。
- **着色器补丁**：`penumbra.ts` 在任何材质编译之前改写 three.js 的 `shadowmap_pars_fragment`、`lights_fragment_begin` 与 `shadowmask_pars_fragment`。升级 three.js 后如果锚点文本变了，启动时直接报错，不会静默失效。主光的阴影贴图是普通深度纹理，只能用 `PCFShadowMap` 类型；聚光灯与蜡烛仍用 three.js 自带的 PCF。
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
| 纸偶按文字资料绘制（此前） | 原作图片所在站点被网络策略拦截 |
| 纸偶改为低多边形纸模型 | 第六轮用户从十个方向中选定：形体按 Rauno Somelar 的 3D 雕刻稿，颜色按游戏内模型；用生成器画，没有原作像素，可以放进公开仓库 |
| 主光阴影用 PCSS | 窗光是大面积光源，影子应在落脚处清晰、随距离变软；统一的小半径 PCF 让桌面上的墙影又硬又暗。three.js r186 的 PCF 用比较采样器，读不到遮挡物深度，所以主光单独用普通深度纹理 |
| 卡纸厚度用背面副本实现 | 相机从上方看，副本只在朝上的切边露出，与真实卡纸的受光方式一致；不需要为每张纸片生成挤出网格，副本同时充当纸背 |
| 开场改为向前折叠 | 向后倒平时，高的纸片伸出书头、悬在桌面上方。真实立体书合上时纸片向前折在书页上；朝前折叠后越靠后的纸片越在上层，由后往前翻起时不会互相穿过 |
| 木桌用着色器绘制 | 原烘焙纹理只有 1 倍分辨率，放大后是模糊的横纹；着色器按世界坐标绘制，任何分辨率都清晰，还省去 1 MB 纹理 |
| 纹理用 WebP | PNG 共 14.9 MB，其中地板与墙各 4 MB 以上；WebP 质量 0.92 时色差约 2/255，透明通道无损，总量 1.8 MB |
| 相机改为读者视角（默认视角 2） | 用户反馈书尾边贴着画面下沿、操作别扭，桌面与书的透视不自然。长焦加 58° 俯视让桌面像一张平的背景；视角 2 相当于坐在桌前读书，书前留出桌面，木板由近及远与书的侧边一起汇聚。44° 时文字吃力的问题当时没有纵向拉伸，现在按取景拉伸补偿 |
| 背景音乐用用户提供的录音 | 用户希望用「Whirling-In-Rags」风格的曲子，由用户自行制作或取得并提供文件。此前的原创合成曲已删除。仓库公开，音频文件随仓库与部署公开 |
| 默认改为冬日光线与原作界面 | 用户认为此前的画面太温馨、原作风格体现不够；第五轮的候选里选定 `?look=winter&ui=de` |
| HUD 只放本章用得上的元素 | 用户指出几个 UI 没有实际用途。生命、工具栏、胶片编码没有对应的玩法；士气原先同时显示在纸心与 HUD 上，冬日光下纸心又看不清，改为只在 HUD 上 |
| 书上不叠加 HUD 元素 | 内心声音标签叠在倾斜的书页上，不随透视与光照变化，用户认为不真实；HUD 只在画面四角 |
| 深色面板用更小的字与更宽的行距、段距、边距 | 用户要求；此前几轮为了可读性放大过日志，密度偏高 |
| 不做整帧油画后期 | 用户认为油画直接用在画面上效果不好：滤镜把纸片、文字与桌面一起涂抹，立体书的材质与清晰度都丢了 |

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
  - 画面不要太温馨，要有原作的冷峻与破败感（第五轮）。
  - 界面上每个元素都要有实际用途，装饰性的 UI 去掉（第六轮）。
  - 书上不要弹出平面的界面元素：屏幕空间的 HUD 只放画面四角，书上或桌上的信息要印进书页或做成实物（第六轮）。
  - 日志的字可以小一些，行距、段距、页边距要明显（第六轮）。
  - 「你」与金的台词要一眼分得开，名字与话都要有不同的颜色（第六轮）。
  - 不要把油画滤镜直接盖在整帧上（第六轮）。
- 人物形象、性格与语言风格采用原作。只是 Demo，不考虑版权。
- 工作流：在分支上开发，开 PR；本地检查（`npm test`、`build`、`shot`、`play`）通过后直接合入 `main`，不停在 PR 等待审阅，由 Vercel 部署。

## 8. 已知问题与候选工作

待用户选定（第四轮的候选方案）：

- 取景：推荐视角 2；视角 3 更有实物感，但上下字号差 19%、日志少约 2 行。选定后删掉其余候选并更新 design.md 6.1 与本文件。
- 风格：子任务推荐以预设 1 为基础，叠加预设 3 的检定纸条与交互标记，预设 2 只取青色暗部、暗角与蜡烛辉光。待定细节：普通选项悬停的变化是否够明显、检定卡片写难度档位还是原作的概率描述词、继续条的颜色、交互标记是否按节点设定。
- 音乐：只有开关，没有音量滑块。用户试听后两次要求调小，现在比原文件低约 19 dB（−34.7 LUFS），骰子与检定比它高 7–9 LU，写字低 6–9 LU（`docs/music.md`）。
- 音效：只有开关，没有音量滑块；音量按离线渲染测量平衡过（骰子与重击书桌峰值约 −12 dBFS，写字约 −29 dBFS，其余在 −14 到 −41 dBFS）。写字声在音乐下面可能偏轻，需要试听后再调。
- 冬日与原作界面（默认）的已知问题：
  - 光束不知道相机方向上的遮挡，书桌上方有一层淡雾。
  - 回忆里阳光方向不变，夜里仍有长影。
  - `?look=noir` 下深色面板上的选项偏暗。
  - 第四轮的 `?style=1`、`?style=3` 按书页排法设计，在深色面板下大部分不起作用；要看原样需加 `ui=book&look=warm`。

- 纸偶（低多边形纸模）：1 倍下哈里的眼睛很小，靠胡子、鼻子、头发和烟认人；头约占身高的六分之一，比此前的纸偶小；折痕要 2 倍才明显。马雷克、狗等其他纸片仍是平面剪纸。
- 主光软阴影的采样盘按像素旋转，宽半影里有细小的噪点，被颗粒掩盖。弱 GPU 上帧耗时会增加（M4 Pro 上 1600 × 900 约 8 毫秒）。
- 回忆中的楼梯与狗仍从向后平躺升起，升起途中穿过家具层，大部分被墙与家具挡住。
- 纸心的对折在书右侧的墙影里不明显（那里只有台灯照明）。
- 线索卡堆已放大，但卡上的证据名在 1600 宽画面中仍只有约 14 像素，完整列表靠悬停提示。
- `docs/design.md` 7.2 节是方案阶段的模块规划，与实际代码不一致，以 README 为准。
- M2 计划（`docs/design.md` 8 节）：
  - 第二章：二楼房客的房间，对质马雷克。
  - 士气归零的处理。
  - 简化版思维阁。
  - 音效。
  - 移动端布局。

## 9. 迭代流程

1. 从 `main` 建分支。
2. 修改后依次运行 `npm test`、`npm run build`、`npm run shot`（中英文）。改到交互或动画时，再跑 `npm run play`。
3. 同步更新 README、`docs/design.md`、本文件与截图。
4. 提交并推送，开 PR 到 `main`，检查通过后直接合并（用户要求不停在 PR）。Vercel 从 `main` 部署。
