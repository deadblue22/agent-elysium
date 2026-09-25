# 《雪落之前》交互式立体书 Demo 方案设计

> 项目代号 agent-elysium。目标是一个网页端的交互式动态立体绘本：画面是纸艺立体书，叙事与系统致敬《极乐迪斯科》。本文档是最小 Demo 之前的完整方案。

## 1. 目标与范围

| 项目 | 内容 |
|---|---|
| 形态 | 浏览器运行的单页应用，桌面优先，16:9 画面 |
| 交互 | 固定选项的对话树，部分选项触发能力检定，检定时掷两枚骰子 |
| 内容 | 一个原创小场景：两位警探勘察一间密室书房，还原案发经过 |
| 风格 | 立体书的纸艺分层舞台 + 《极乐迪斯科》的配色、文字排版与内心声音 |
| 语言 | 中文与英文并行，运行时可切换 |
| 阶段 | 先做最小 Demo 确定风格，再扩展 |

不在范围内：角色创建、完整 24 项技能、思维阁、存档、移动端适配、音乐。这些留到后续阶段。

版权边界：只借鉴系统结构与文风，不使用原作的人名、地名、美术素材与字体。所有文本、角色与画面均为原创。

## 2. 参考 Demo 拆解

参考 demo 是一本放在木桌上的立体书。观察到的结构：

- **舞台分三层。** 上半部分是从书页折缝处竖起的立体背景板，顶边裁成云朵状的波浪；背景板前有多层剪纸树，形成前后景深。下半部分左页是文字，右页是角色活动的地面。
- **左页是文字日志。** 玩家指令用打字机字体、锈橙色、以 `>` 开头；叙述文字用衬线体，段首大写字母下沉。旧的指令与叙述随着推进变灰、上移。
- **右页是剪纸角色。** 一个带兜帽、围橙色围巾的纸偶，手持灯笼，站在草丛纸片间。
- **指令驱动场景变化。** 「点灯」后角色手中出现光晕；「敲门」后塔楼与巨龙从背景板后升起；「问龙想要什么」后昼夜切换、开始下雪、飘落的雪片浮在整个画面之上。

本项目保留的部分：木桌、开本、竖起的背景板、多层剪纸景深、左页文字日志、右页纸偶、由叙事驱动的场景变化。

本项目改变的部分：

| 参考 demo | 本项目 |
|---|---|
| 自由输入指令 | 固定选项的对话树 |
| 无数值系统 | 技能、检定、骰子、修正值、士气 |
| 童话题材，单一角色 | 犯罪现场，两位警探，死者，内心声音 |
| 明快的童书配色 | 《极乐迪斯科》式的低饱和、颗粒感、油画气质配色 |
| 英文 | 中英双语 |

## 3. 世界观与角色

### 3.1 世界

一座没有名字的港口城市，时代感接近 20 世纪 70 年代末：老式电话、煤气暖气、钟表匠还能靠手艺退休。整座城市由纸折成，折痕会露出纸的本色。这一点在叙述中会被偶尔提及，作为世界的既定事实而不是比喻。

### 3.2 玩家角色：警探 奥古斯特·维隆 / Detective August Villon

- 四十多岁，风衣皱得像睡过，领口有烟灰。
- 直觉强，逻辑不稳，容易被脑子里的声音带跑。
- 对话中几乎不直接说话；玩家看到的是内心声音和选项，说出口的话由选项决定。
- 纸偶造型：深靛蓝长外套、锈橙围巾、压低的帽檐、一小点烟头的橙光。围巾颜色与参考 demo 的兜帽人物呼应。

### 3.3 搭档：警督 伊莲娜·卡斯克 / Lieutenant Elena Kask

- 三十多岁，灰绿色制式外套，圆框眼镜，随身一本小笔记本。
- 精确、克制、不评价。说话短，多用陈述句，纠正维隆时不提高音量。
- 关心的方式是在维隆犯错之前把话说在前面。
- 对维隆的称呼固定为「警探」，从不叫名字。
- 纸偶造型：灰绿外套、白色笔记本、两个圆圈表示眼镜。

### 3.4 死者：阿尔贝·勒诺 / Albert Renaud

六十七岁，退休钟表匠，独居在四楼书房。画面上只以伏在桌上的剪纸剪影出现，没有血迹，没有面部细节。

### 3.5 嫌疑人：马雷克 / Marek

勒诺的外甥，租住二楼。Demo 中不出场，只在卡斯克的口述与还原动画中以剪影出现。

### 3.6 内心声音

Demo 使用 7 项技能，各自是一个会插话的角色。语气设定：

| 技能 | 属性 | 语气 |
|---|---|---|
| 逻辑 LOGIC | 智力 | 短句，只给结论和推导，不带情绪 |
| 博学多闻 ENCYCLOPEDIA | 智力 | 冷知识倾泻，经常跑题到推理小说史 |
| 视觉计算 VISUAL CALCULUS | 智力 | 描述轨迹、角度、痕迹，像在读一张图纸 |
| 内陆帝国 INLAND EMPIRE | 精神 | 让物件开口说话，钟、窗帘都有情绪 |
| 同理心 EMPATHY | 精神 | 读卡斯克的表情和沉默 |
| 权威 AUTHORITY | 精神 | 要求被服从，失败时最先受伤 |
| 感知 PERCEPTION | 运动 | 列举气味、温度、声音、雪的状态 |

## 4. 剧本：第一章《雪落之前》/ Before the Snow

### 4.1 案件真相

| 时间 | 事件 |
|---|---|
| 22:30 | 马雷克上楼。房东太太的狗睡在楼梯口，认得这双鞋，没有叫。 |
| 22:35 | 书房内一击致命。钟没有停。 |
| 22:40 | 马雷克用手拨停钟摆，把指针拨到 23:40。打开窗户，制造外人从防火梯进入的假象。 |
| 22:50 | 马雷克从楼梯离开。狗仍然没有叫。 |
| 23:00 | 开始下雪。防火梯被完整覆盖。 |
| 23:30 | 马雷克出现在街角酒吧，三名证人。 |
| 次日 07:00 | 房东太太发现尸体。 |

用到的经典桥段：停摆的钟伪造死亡时间；开着的窗作为误导；雪地无脚印证明无人从窗离开；没有叫的狗证明来客是熟人。

### 4.2 证据链

三条证据，各自对应一个旗标，还原时每条证据给逻辑检定 +1：

| 旗标 | 证据 | 获取途径 |
|---|---|---|
| `clock_tampered` | 钟的调针旋钮有新鲜划痕，指针被人拨过 | 检查钟，视觉计算检定成功 |
| `no_footprints` | 防火梯上积雪完整，23:00 之后无人从窗离开 | 检查窗，感知检定成功 |
| `dog_silent` | 楼梯口的狗整晚没叫，来客是熟人 | 问卡斯克「楼里还有谁」，或权威检定成功 |

### 4.3 对话树结构

```
study.intro ─┬─ study.clock ──── [视觉计算 10 白] ──┐
             ├─ study.window ─── [感知 10 白] ───────┤
             ├─ study.kask ──┬── 问死亡时间          ├─→ 回到 study.intro
             │              ├── 问楼里还有谁         │
             │              └── [权威 10 红] ────────┘
             └─ (证据≥2) study.reconstruct ── [逻辑 12 白，+证据数]
                                              ├─ 成功 → study.reconstruct.ok → study.end
                                              └─ 失败 → study.reconstruct.fail → study.intro
```

共 14 个节点，4 次主动检定，4 次被动检定。

### 4.4 完整台词

格式说明：`叙述` 为第二人称叙述；`卡斯克` 为搭档台词；大写技能名为内心声音；`>` 为玩家选项；方括号内为检定信息。

#### study.intro

叙述
: 书房是从一张纸上折出来的。墙纸是褪色的靛蓝，折痕处露出纸的本色。壁炉上的钟停了。窗开着，一层没人碰过的雪压在窗台上。桌前坐着一个人，头枕在账本上，像是睡着了。他没有睡着。
: The study is folded out of a single sheet. The wallpaper is a faded indigo, and the paper shows its true colour along the creases. The clock on the mantel has stopped. The window is open; a layer of untouched snow sits on the sill. A man sits at the desk, head resting on a ledger, as if asleep. He is not asleep.

卡斯克
: 「警探。死者阿尔贝·勒诺，六十七岁，退休钟表匠。房东太太今早七点发现的。」她没有抬头，笔在本子上走。「先看，再碰。」
: "Detective. Albert Renaud, sixty-seven, retired clockmaker. The landlady found him at seven this morning." She doesn't look up; the pen keeps moving across the notebook. "Look first. Touch later."

感知 [被动 简单 8]
: 窗台上的雪是平的。没有手印，没有滴水。开窗的人没有从这里出去。
: The snow on the sill is flat. No handprints, no drip marks. Whoever opened the window did not leave through it.

内陆帝国 [被动 中等 10]
: 钟在看你。它停在十一点四十分，但它的表情不像一个死在十一点四十分的钟。它在撒谎，而且撒得很不熟练。
: The clock is looking at you. It stopped at 11:40, but it does not wear the face of a clock that died at 11:40. It is lying, and it is not good at it.

选项
: `> 检查壁炉上的钟。` / `> Examine the clock on the mantel.` → study.clock
: `> 检查窗户。` / `> Examine the window.` → study.window
: `> 和卡斯克警督谈谈。` / `> Talk to Lieutenant Kask.` → study.kask
: `> 「我知道这里发生了什么。」` / `> "I know what happened here."` [逻辑 挑战 12 白] 需要证据 ≥ 2 → study.reconstruct

#### study.clock

叙述
: 一座黄铜座钟，玻璃罩里的钟摆一动不动。指针停在 23:40。
: A brass mantel clock, its pendulum motionless behind the glass. The hands are stopped at 23:40.

博学多闻 [被动 琐碎 6]
: 这种带钟摆的座钟受到撞击时会停摆。推理小说很喜欢这个桥段：死者倒下时撞停了钟，死亡时间就被永远记录下来。作家们很喜欢。凶手们也很喜欢。
: Pendulum clocks of this kind stop when knocked. Detective novels are fond of the device: the victim falls, the clock stops, and the hour of death is recorded forever. Writers love it. So do murderers.

选项
: `> 把钟转过来看背面。` / `> Turn the clock around.` [视觉计算 中等 10 白]
: `> 回到房间中央。` / `> Step back.` → study.intro

视觉计算 成功
: 后盖上的调针旋钮有新鲜的划痕，方向是顺时针，而且不止一圈。有人在钟停摆之后拨过指针。
: The regulator knob on the back carries fresh scratches, clockwise, more than one turn. Someone moved the hands after the clock stopped.
: 卡斯克：「记下了。」/ "Noted."
: 获得旗标 `clock_tampered`。

视觉计算 失败
: 后盖上有划痕。也可能是六十七年的划痕。你分不出来。
: There are scratches on the back. They could be sixty-seven years of scratches. You can't tell.
: 卡斯克：「警探，把它放回去。轻一点。」/ "Detective. Put it back. Gently."

#### study.window

叙述
: 窗外是防火梯，再往下是院子。雪还在下，很慢。冷空气从窗口灌进来，纸做的窗帘一下一下地拍着墙。
: Outside is the fire escape, and below it the yard. Snow is still falling, slowly. Cold air pours in; the paper curtain slaps the wall, again and again.

选项
: `> 探身去看防火梯。` / `> Lean out to look at the fire escape.` [感知 中等 10 白]
: `> 关上窗。` / `> Close the window.`
: `> 回到房间中央。` / `> Step back.` → study.intro

感知 成功
: 防火梯上积着完整的一层雪。没有脚印，一个都没有。雪是昨晚十一点开始下的，卡斯克的本子上写着。没有人在十一点以后从这扇窗出去过。
: A full, unbroken layer of snow on the fire escape. No footprints. Not one. The snow started at eleven last night; it's in Kask's notebook. No one left through this window after eleven.
: 获得旗标 `no_footprints`。

感知 失败
: 你探得太远了。雪落进领子里。一只手抓住了你的外套后领。
: You lean too far. Snow gets down your collar. A hand catches the back of your coat.
: 卡斯克：「从四楼掉下去不会让案子变简单。」/ "Falling four floors does not simplify the case."
: 士气 -1。

关上窗
: 卡斯克：「别动。开着的窗也是证物。」/ "Leave it. An open window is evidence too."

#### study.kask

叙述
: 她合上本子，看着你。镜片后面的眼睛有一夜没睡的红。
: She closes the notebook and looks at you. Behind the lenses, her eyes carry the red of a sleepless night.

同理心 [被动 简单 8]
: 她不是在等你的结论。她是在等你犯错，好在你犯错之前把你拉回来。这是一种关心。
: She isn't waiting for your conclusion. She is waiting for you to make a mistake, so she can pull you back before you do. It is a kind of care.

选项
: `> 「死亡时间？」` / `> "Time of death?"`
: `> 「楼里还有谁？」` / `> "Who else lives here?"`
: `> 「把你的本子给我看。」` / `> "Give me your notebook."` [权威 中等 10 红]
: `> 回到房间中央。` / `> Step back.` → study.intro

死亡时间
: 卡斯克：「法医的初步估计是二十二点到零点之间。气象站的记录，雪是二十三点开始下的。」
: "The examiner's preliminary estimate is between twenty-two hundred and midnight. Per the weather station, snow began at twenty-three hundred."

楼里还有谁
: 卡斯克：「二楼有个房客，马雷克，勒诺的外甥。昨晚二十三点半到凌晨一点在街角的酒吧，有三个证人。」她顿了一下。「房东太太的狗睡在楼梯口。整晚没叫。」
: "A lodger on the second floor. Marek, Renaud's nephew. At the corner bar from twenty-three thirty until one in the morning; three witnesses." She pauses. "The landlady's dog sleeps at the foot of the stairs. It didn't bark all night."
: 获得旗标 `dog_silent`。

权威 成功
: 她把本子递过来，翻到某一页。你看到一行小字：「狗，没叫。房客，认识狗。」
: She hands it over, open to a page. A line in small script: "Dog: silent. Lodger: known to the dog."
: 获得旗标 `dog_silent`。

权威 失败
: 「不。」她把本子放回口袋。「你有自己的本子，警探。」你没有自己的本子。
: "No." The notebook goes back into her pocket. "You have your own notebook, Detective." You do not have your own notebook.
: 士气 -1。红色检定，不可重试。

#### study.reconstruct

叙述
: 你闭上眼睛。书房在眼皮后面重新折了一遍。
: You close your eyes. Behind them, the study folds itself again.

逻辑 [挑战 12 白]，修正：`clock_tampered` +1、`no_footprints` +1、`dog_silent` +1。

#### study.reconstruct.ok

舞台切换为夜晚，开始下雪，剪影动画按下列四段依次播放。

叙述
: 二十二点半。雪还没有下。马雷克上楼，狗抬了一下头，又趴下。它认识这双鞋。
: Twenty-two thirty. No snow yet. Marek climbs the stairs; the dog lifts its head and lowers it again. It knows these shoes.
: 书房里有争吵，或者没有。有一下重击。钟没有停。它停下来是后来的事，被人用手停下的。
: An argument in the study, or none. A single blow. The clock does not stop. It stops later, by hand.
: 他把指针拨到二十三点四十分，让钟摆停在那里。他打开窗，让雪讲一个关于陌生人的故事。
: He sets the hands to twenty-three forty and stills the pendulum. He opens the window, so the snow can tell a story about a stranger.
: 二十三点以前，他从楼梯下去。狗没有叫。二十三点半，他在酒吧里，被三个人看见。雪开始下，把防火梯盖得干干净净。
: Before twenty-three hundred, he goes down the stairs. The dog does not bark. At twenty-three thirty he is in the bar, seen by three people. The snow begins, and covers the fire escape clean.

逻辑
: 成立。/ It holds.

卡斯克
: 她写了很久。然后合上本子。「成立。」停顿。「去二楼。」
: She writes for a long time. Then closes the notebook. "It holds." A pause. "Second floor."

选项
: `> 翻页。` / `> Turn the page.` → study.end

#### study.reconstruct.fail

叙述
: 你看见一个陌生人从窗口爬进来，雪落在他肩上。他和勒诺争执，然后……
: You see a stranger climbing in through the window, snow on his shoulders. He argues with Renaud, and then...

卡斯克
: 「窗台上的雪是平的，警探。」她没有抬头。「再想想。」
: "The snow on the sill is flat, Detective." She doesn't look up. "Think again."

白色检定，获得新证据后可重试。回到 study.intro。

#### study.end

右页翻过，露出一张空白纸页，中央一行字：「第一章 完」/ "End of Chapter One"。

## 5. 游戏系统

### 5.1 角色数值

Demo 不做角色创建，使用固定角色卡：

| 技能 | 初始值 |
|---|---|
| 逻辑 | 4 |
| 博学多闻 | 2 |
| 视觉计算 | 3 |
| 内陆帝国 | 5 |
| 同理心 | 3 |
| 权威 | 2 |
| 感知 | 2 |

士气初始 4，上限 4。归零时不结束游戏，只显示一段内心声音并锁定权威检定。属性、生命、经验、技能点均不在 Demo 中实现。

### 5.2 检定规则

- 公式：2d6 + 技能值 + 修正值 ≥ 难度阈值。
- 掷出 2 必定失败，掷出 12 必定成功。
- 难度阈值沿用原作分级：琐碎 6、简单 8、中等 10、挑战 12、艰难 13、传奇 14、英雄 15、神圣 16、不可能 18。Demo 只用到 6、8、10、12。
- 白色检定：失败后选项变灰，获得新旗标后重新亮起。
- 红色检定：一次性，失败后选项消失。
- 被动检定：进入节点时自动掷骰，不显示骰子，成功时插入对应内心声音。
- 修正值来源：旗标。显示格式为「+1 指针被拨动过」，与原作的提示方式一致。

Demo 中各检定的成功率：

| 检定 | 技能值 | 阈值 | 需要点数 | 成功率 |
|---|---|---|---|---|
| 视觉计算 白 | 3 | 10 | 7+ | 58% |
| 感知 白 | 2 | 10 | 8+ | 42% |
| 权威 红 | 2 | 10 | 8+ | 42% |
| 逻辑 白，0 证据 | 4 | 12 | 8+ | 42% |
| 逻辑 白，2 证据 | 4+2 | 12 | 6+ | 72% |
| 逻辑 白，3 证据 | 4+3 | 12 | 5+ | 83% |
| 感知 被动 | 2 | 8 | 6+ | 72% |
| 内陆帝国 被动 | 5 | 10 | 5+ | 83% |
| 同理心 被动 | 3 | 8 | 5+ | 83% |
| 博学多闻 被动 | 2 | 6 | 4+ | 92% |

### 5.3 骰子表现

- 选择带检定的选项后，左页文字暂停，右页地面上落下两枚纸骰子，翻滚约 0.8 秒后停下。
- 骰子停下后，左页出现结算行：`视觉计算 [中等 10]  4 + 5 + 3 = 12  成功`，颜色随技能所属属性。
- 掷出 2 或 12 时，结算行加一句固定文案：「蛇眼。」/ "Snake eyes." 或「满贯。」/ "Boxcars."

### 5.4 状态与旗标

全局状态只有四部分：技能值、士气、旗标集合、已失败的红色检定集合。所有条件判断只读旗标，所有效果只写旗标、士气与舞台指令。

## 6. 视觉与动效

### 6.1 画面布局

```
┌──────────────────────────────────────────────────────────────┐
│  木桌                                                         │
│      ┌─────────── 立体背景板（书房后墙）────────────┐            │
│      │  书架      窗（夜空/雪）      壁炉 + 钟       │            │
│      │        ┌── 中景：书桌 + 伏案剪影 ──┐          │            │
│  ────┴────────┴─────────── 折缝 ─────────┴──────────┴────        │
│  │ 左页：文字日志                 │ 右页：地面舞台         │        │
│  │ > 检查壁炉上的钟。              │   维隆      卡斯克     │        │
│  │ 叙述……                        │                       │        │
│  │ 视觉计算 [中等 10] 成功        │        ⚂ ⚄            │        │
│  │ > 回到房间中央。▮              │                       │        │
│  └───────────────────────────────┴───────────────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

布局示意图见 `docs/mockup-layout.svg`（源文件）与 `docs/mockup-layout.png`（渲染结果）。示意图只用于确认布局与配色关系，纸偶与家具的最终造型在 M0 阶段重新绘制。

- 背景板从折缝处以约 75° 竖起，顶边裁成书房天花板线脚的波浪形，与参考 demo 的云朵边呼应。
- 背景板前后共 5 层：夜空与雪（最远）、后墙、书架与壁炉、书桌与死者、前景纸片（散落的纸页、椅背）。鼠标移动时各层以不同幅度平移，形成视差。
- 左右页各占书的 50%。M0 风格板验证过：中文叙述用 22px 字号时，左页需要整整一半宽度才能容纳一个节点的八行日志。
- 相机角度以文字可读为先：书页后倾约 22°，文字日志作为平面图层贴在左页上，不放进 3D 平面，避免被透视压扁和光栅化模糊。背景板以约 70° 从折缝竖起，纸偶与背景板同角度竖立，尺寸约为书桌的 1.3 倍。

### 6.2 配色

参考 demo 是明快的童书色；原作是低饱和的油画色。融合方式：保留剪纸的平面形状，换用原作的色彩关系，再叠一层颗粒噪点。

| 用途 | 色值 | 说明 |
|---|---|---|
| 纸面 | `#E8DCC4` | 书页底色，带轻微噪点 |
| 墨色 | `#2B2622` | 叙述文字 |
| 靛蓝 | `#1F2A44` | 墙纸、维隆的外套、夜空 |
| 锈橙 | `#C2562B` | 玩家选项、围巾、烟头光 |
| 灰绿 | `#7A8C7E` | 卡斯克的外套、远景 |
| 青绿 | `#3F6E68` | 书架、家具 |
| 赭黄 | `#C9A05A` | 钟、灯光、暖色点缀 |
| 木桌 | `#2A1E16` | 画面最外层 |
| 白色检定 | `#F2EFE6` | 检定标签底色 |
| 红色检定 | `#A3232B` | 检定标签底色 |

技能名颜色按属性区分，参照原作的四色体系但重新取色：智力 `#6FA8DC`、精神 `#B07BC4`、体格 `#D9703B`、运动 `#E3C25A`。

### 6.3 字体

| 用途 | 中文 | 英文 |
|---|---|---|
| 叙述 | 思源宋体 Noto Serif SC | EB Garamond |
| 玩家选项 | 霞鹜文楷等宽 LXGW WenKai Mono | JetBrains Mono |
| 技能名与检定标签 | 思源黑体 Noto Sans SC，全大写风格用字重表达 | Inter，全大写，字距加宽 |

中文字体体积大，需用 fonttools 按台词文本裁剪子集后自托管。叙述段首保留参考 demo 的首字下沉，中文版改为段首缩进两字并把第一行加重。

### 6.4 角色纸偶

- 每个纸偶由 3 到 5 个 SVG 形状组成，无面部细节，靠轮廓与配色识别。
- 每个纸偶有 3 个姿势：站立、指向、蹲下。姿势切换用 200 毫秒的交叉淡入。
- 纸偶底部有一条深色阴影线，模拟纸片立在页面上的感觉。
- 说话时纸偶轻微上下浮动，幅度 2 像素。

### 6.5 动效清单

| 触发 | 表现 |
|---|---|
| 进入场景 | 背景板从平放旋转到竖起，各层依次弹出，总时长 1.2 秒 |
| 新叙述 | 左页文字逐字出现，中文每字 30 毫秒，英文每字符 15 毫秒；点击可跳过 |
| 内心声音 | 技能名以属性色出现，文字前有 0.3 秒停顿 |
| 主动检定 | 骰子落下翻滚，结算行出现，纸偶做对应姿势 |
| 士气变化 | 右页角落的纸质心形褪色一格 |
| 还原成功 | 背景板颜色过渡到夜色，雪片开始飘落，楼梯层从背景板后升起，马雷克与狗的剪影按 4.4 节的四段叙述依次移动；钟的指针转动；窗户打开 |
| 还原失败 | 背景板短暂变暗后恢复，雪片不出现 |
| 章节结束 | 右页整页翻起，露出空白页 |

还原成功的动画是整个 Demo 的展示核心，对应参考 demo 中巨龙升起的时刻。

### 6.6 与原作的差异处理

原作是厚涂油画，本项目是剪纸。为保持辨识度，在剪纸之上做三件事：整体叠加低透明度的噪点纹理；背景板用带笔触感的渐变而不是纯色；角色轮廓保留手剪的不规则边缘。文字区域完全沿用原作的排版语言：技能名大写、检定标签方框、选项前的 `>` 符号。

## 7. 技术方案

### 7.1 技术选型

| 层 | 选择 | 理由 |
|---|---|---|
| 构建 | Vite + TypeScript | 零配置，静态输出，可直接部署到 GitHub Pages |
| 渲染 | Three.js（WebGL 2） | 层间真实投影、可变光照、透视与视差由同一个场景完成，评估见 `docs/tech-eval.md` |
| 纸片素材 | SVG 源文件，构建前烘焙为带透明通道的 PNG | 撕边、纸纹、烧边在烘焙时计算一次，运行时没有 SVG 滤镜 |
| 光照与投影 | 半球光、窗侧冷光、蜡烛点光、台灯聚光，阴影贴图 | 投影随相机与光源自动变化，不再手绘 |
| 文字页 | Canvas 2D 排版绘制，作为画布纹理贴在左页网格上 | 文字随纸面透视、弧度与明暗变化，同时保持清晰；点击用射线取 UV 查行框 |
| 后期 | EffectComposer，一个自定义着色器通道 | 颗粒、暗角、色调一次完成，成本固定 |
| 动画 | requestAnimationFrame 缓动，必要时 GSAP | 序列动画用 GSAP 的时间线更省事 |
| 字体 | 自托管子集，FontFace API 加载完成后再绘制 | 避免运行时依赖 Google Fonts，画布不会先画出回退字体 |
| 随机 | 可播种的 PRNG | 开发时可复现骰子结果 |

### 7.2 模块划分

```
src/
  engine/
    state.ts        全局状态：技能、士气、旗标、红色检定记录
    dice.ts         2d6 与可播种 PRNG
    resolver.ts     条件判断、检定结算、效果应用
    runner.ts       节点遍历，驱动视图与舞台
  view/
    page-left.ts    文字日志的渲染与逐字动画
    page-right.ts   纸偶、骰子、士气
    stage.ts        背景板各层、视差、昼夜与雪
    i18n.ts         语言切换与文本取值
  content/
    schema.ts       类型定义
    skills.ts       技能表与颜色
    scenes/
      study.ts      第一章全部节点
  assets/
    svg/            背景层、纸偶、骰子、道具
    fonts/          子集字体
```

### 7.3 数据结构

```ts
type Text = { zh: string; en: string };

type SkillId =
  | 'logic' | 'encyclopedia' | 'visualCalculus'
  | 'inlandEmpire' | 'empathy' | 'authority' | 'perception';

type CheckKind = 'white' | 'red' | 'passive';

interface Modifier { flag: string; value: number; label: Text }

interface Check {
  skill: SkillId;
  dc: number;
  kind: CheckKind;
  modifiers?: Modifier[];
  success: string;   // 节点 id
  failure: string;   // 节点 id
}

interface Line {
  speaker: 'narrator' | 'kask' | SkillId;
  text: Text;
}

type Effect =
  | { type: 'flag'; key: string; value: boolean }
  | { type: 'morale'; delta: number }
  | { type: 'stage'; cue: string };

interface Option {
  text: Text;
  next?: string;
  check?: Check;
  requires?: { flags?: string[]; minEvidence?: number };
  effects?: Effect[];
}

interface Node {
  id: string;
  lines: Line[];
  passive?: Check[];
  options: Option[];
  stage?: string[];   // 进入节点时触发的舞台指令
}
```

舞台指令是字符串常量，例如 `night`、`snow`、`raise-stairs`、`marek-enter`、`clock-spin`、`window-open`、`page-turn`。舞台模块负责把指令映射为动画。

### 7.4 运行循环

1. 进入节点，执行 `stage` 指令。
2. 逐条掷被动检定，成功的插入对应 `Line`。
3. 逐字渲染 `lines`。
4. 渲染 `options`，按 `requires` 过滤，按红色检定记录隐藏，按白色检定失败记录置灰。
5. 玩家点击。若无检定则应用 `effects` 并跳转。若有检定则播放骰子，结算，记录，跳转到 `success` 或 `failure`。

### 7.5 多语言

- 所有文本以 `Text` 对象存储，视图层通过 `t(text)` 取当前语言。
- 语言切换按钮固定在木桌右上角，切换时重渲染当前节点，不重置状态。
- 逐字动画的速度按语言分别配置。
- 字体按语言切换 `lang` 属性，由 CSS 选择对应字体栈。

## 8. 最小 Demo 定义与里程碑

### M0 风格板

- 一个静态页面：木桌、开本、竖起的背景板、五层书房、两个纸偶、左页示例文本、两枚骰子。
- 目的：确认配色、字体、纸艺质感与原作气质的融合是否成立。
- 产出：一张截图与可运行页面。

### M1 最小 Demo

- 第 4 章的全部 14 个节点，中英双语。
- 4 次主动检定与骰子动画，4 次被动检定。
- 旗标、士气、白色重试、红色一次性。
- 还原成功的完整舞台动画。
- 语言切换。

验收标准：从开场到「第一章 完」可完整走通；三条证据都能获取；逻辑检定失败后收集新证据可重试；权威检定失败后选项消失；切换语言后当前页面文字与字体正确更新。

### M2 扩展

- 第二章：二楼房客的房间，对质马雷克，引入权威与暗示的对抗检定。
- 士气归零的处理与更多内心声音。
- 简化版思维阁：一个槽位，一条思想。
- 环境音与纸张翻动音效。
- 移动端布局。

## 9. 风险与未定事项

| 风险 | 应对 |
|---|---|
| 剪纸风与油画风融合后失去原作辨识度 | M0 阶段先出风格板，用文字排版与内心声音承担主要辨识度 |
| 中文字体体积过大 | 按文本裁剪子集，Demo 台词固定，子集可控 |
| CSS 2.5D 的背景板在不同浏览器表现不一致 | 只用 `rotateX` 与 `translateZ`，避免嵌套 3D 上下文 |
| 还原动画工作量大 | 拆成四段独立指令，先做静态版本再加动画 |

待确认：

- 是否需要键盘操作选项。
- 是否引入 GSAP，还是只用 Web Animations API。
- 部署目标是 GitHub Pages 还是其他静态托管。
- 中文选项字体是否接受霞鹜文楷的手写感，还是改用更硬朗的等宽字体。
