# 《雪落之前》交互式立体书 Demo 方案设计

> 项目代号 agent-elysium。目标是一个网页端的交互式动态立体绘本：画面是纸艺立体书，叙事与系统致敬《极乐迪斯科》。本文档是最小 Demo 之前的完整方案。

## 1. 目标与范围

| 项目 | 内容 |
|---|---|
| 形态 | 浏览器运行的单页应用，桌面优先，16:9 画面 |
| 交互 | 固定选项的对话树，部分选项触发能力检定，检定时掷两枚骰子 |
| 内容 | 一个新写的小案件：原作的哈里与金在马丁内斯勘察一间密室书房，还原案发经过 |
| 风格 | 立体书的纸艺分层舞台 + 《极乐迪斯科》的配色、文字排版与内心声音 |
| 语言 | 中文与英文并行，运行时可切换 |
| 阶段 | 先做最小 Demo 确定风格，再扩展 |

不在范围内：角色创建、完整 24 项技能、思维阁、存档、移动端适配、音乐。这些留到后续阶段。

与原作的关系：本 Demo 是非商业的同人演示。角色、地名、技能名与说话方式沿用原作，案件与台词为新写，纸偶按原作形象用剪纸重绘。原作的图片素材目前没有引入，原因见第 9 节。

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

角色、地名、技能名与说话方式沿用《极乐迪斯科》。中文名称采用官方简体中文版的译名。案件与全部台词为新写。

### 3.1 世界

瑞瓦肖（Revachol）城北的马丁内斯（Martinaise）区，一座破败的港口街区。时代感接近 20 世纪 70 年代末：老式电话、煤气暖气、钟表匠还能靠手艺退休。本章发生在冬夜，雪从夜里十一点开始下。

画面上的整座书房由纸折成，折痕露出纸的本色。叙述偶尔提及这一点，把它当作世界的既定事实，不当作比喻。

### 3.2 玩家角色：哈里尔·杜博阿 / Harrier "Harry" Du Bois

- 44 岁，RCM 41 分局警探。失忆，酗酒，情绪大起大落。直觉极强，常被脑子里的声音带跑。
- 叙述用第二人称「你」。说出口的话由玩家从选项里挑：有专业的，有情绪化的，也有荒唐的，三者并存是原作的核心体验。
- 金称他「警探」，不叫名字。
- 他丢了警徽和配枪，也没有自己的笔记本。剧本里会顺手提到这件事。
- 纸偶造型见 6.4 节：魁梧，挺着肚子，一头及领的乱发，一对浓密的大鬓角。穿绿色麂皮西装外套和白色缎面衬衫，系恐怖领带，下身是金褐色喇叭裤。

### 3.3 搭档：金·曷城警督 / Lieutenant Kim Kitsuragi

- 43 岁，RCM 57 分局警督。冷静、克制、讲程序，原则清楚，不轻易流露情绪。
- 说话短而准，多用陈述句。纠正哈里时从不提高音量，偶尔带一点冷幽默。
- 常见的动作描写：扶眼镜，在笔记本上写一行字，停顿，看你一眼。
- 关心的方式是在哈里犯错之前把话说在前面，但他从不承认这是关心。
- 纸偶造型见 6.4 节：身形清瘦，比哈里矮半头。穿橙色飞行员夹克，戴小圆框眼镜，黑色短发向后梳，手戴棕红色驾驶手套，手里拿笔记本。

### 3.4 死者：阿尔贝·勒诺 / Albert Renaud

六十七岁，退休钟表匠，独居在四楼书房。画面上只以伏在桌上的剪纸剪影出现，没有血迹，没有面部细节。

### 3.5 嫌疑人：马雷克 / Marek

勒诺的外甥，租住二楼。Demo 中不出场，只在金的口述与还原动画中以剪影出现。

### 3.6 内心声音

Demo 使用 9 项技能和一个特殊声音。每项技能都是一个会插话的角色。

| 技能 | 属性 | 语气 |
|---|---|---|
| 逻辑思维 LOGIC | 智力 | 短句，给结论和推导，略带自负 |
| 博学多闻 ENCYCLOPEDIA | 智力 | 倾泻冷知识，爱跑题到瑞瓦肖的历史和侦探小说 |
| 见微知著 VISUAL CALCULUS | 智力 | 在脑中搭建现场模型，描述轨迹、角度、痕迹 |
| 内陆帝国 INLAND EMPIRE | 精神 | 让物件开口说话，给出没有根据却常常对的直觉 |
| 通情达理 EMPATHY | 精神 | 读金的表情和沉默 |
| 争强好胜 AUTHORITY | 精神 | 要求被服从，自认是法律本身，失败时最先受伤 |
| 五感发达 PERCEPTION | 身手 | 按感官分项报告：视觉、嗅觉、听觉 |
| 食髓知味 ELECTROCHEMISTRY | 体格 | 惦记酒、烟和一切能让人好受一点的东西，理直气壮 |
| 天人感应 SHIVERS | 体格 | 城市本身在说话，视角突然拉远到整片街区，语气像诗 |
| 恐怖领带 HORRIFIC NECKTIE | 特殊 | 哈里脖子上那条领带。只在内陆帝国够高时出现，只想喝酒和开派对 |

## 4. 剧本：第一章《雪落之前》/ Before the Snow

### 4.1 案件真相

| 时间 | 事件 |
|---|---|
| 22:30 | 马雷克上楼。房东太太的狗睡在楼梯口，认得这双鞋，没有叫。 |
| 22:35 | 书房内一击致命。钟没有停。 |
| 22:40 | 马雷克用手按停钟摆，把指针拨到 23:40。打开窗户，制造外人从防火梯进入的假象。 |
| 22:50 | 马雷克从楼梯离开。狗仍然没有叫。 |
| 23:00 | 开始下雪。防火梯被完整覆盖。 |
| 23:30 | 马雷克出现在街角酒馆，三名证人。 |
| 次日 07:00 | 房东太太发现尸体。 |

用到的经典桥段：停摆的钟伪造死亡时间；开着的窗作为误导；雪地无脚印证明无人从窗离开；没有叫的狗证明来客是熟人。

### 4.2 证据链

三条证据，各自对应一个旗标，还原时每条证据给逻辑思维检定 +1：

| 旗标 | 证据 | 获取途径 |
|---|---|---|
| `clock_tampered` | 钟的调针旋钮有新鲜划痕，指针被人拨过 | 检查钟，见微知著检定成功 |
| `no_footprints` | 防火梯上积雪完整，23:00 之后无人从窗离开 | 检查窗，五感发达（视觉）检定成功 |
| `dog_silent` | 楼梯口的狗整晚没叫，来客是熟人 | 问金「楼里还有谁住」，或争强好胜检定成功 |

### 4.3 对话树结构

```
study.intro ─┬─ study.clock ──── [见微知著 10 白] ──────┐
             ├─ study.window ─── [五感发达 10 白] ───────┤
             ├─ study.kim ───┬── 问死亡时间              ├─→ 回到 study.intro
             │               ├── 问楼里还有谁            │
             │               ├── 问自己是不是好警察      │
             │               └── [争强好胜 10 红] ───────┤
             ├─ study.brandy ── 闻一闻 / 放回去 ─────────┘
             └─ (证据≥2) study.reconstruct ── [逻辑思维 12 白，+证据数]
                                              ├─ 成功 → study.reconstruct.ok → study.end
                                              └─ 失败 → study.reconstruct.fail → study.intro
```

4 次主动检定，6 次被动检定。

### 4.4 完整台词

格式沿用原作的对话日志：

- 每行以说话者开头，后接破折号。说话者可以是人物、技能，也可以是物件或地点，例如「黄铜座钟 —」。
- 技能插话带检定结果标签，例如「博学多闻 [极易：成功] —」。
- 玩家已选的话以「你 —」开头。
- 当前可选项编号列出。带检定的选项在前面标出技能与难度，例如「[见微知著 - 中等 10]」。红色检定另行注明。
- 没有说话者的行是旁白，只用于还原动画。

#### study.intro

书房 — 一间折出来的书房。靛蓝墙纸褪了色，折痕处露出纸的本色。壁炉上的钟停了。窗开着，窗台上压着一层没人碰过的雪。桌前坐着一个老人，头枕在账本上。他在睡觉。不，他没有。
: THE STUDY — A study, folded out of a single sheet. The indigo wallpaper has faded; the creases show the paper's true colour. The clock on the mantelpiece has stopped. The window is open, a layer of untouched snow on the sill. An old man sits at the desk, his head on a ledger. He's asleep. No, he isn't.

金·曷城 — 「警探。」警督翻开笔记本。「死者阿尔贝·勒诺，六十七岁，退休钟表匠。房东太太今早七点发现了他。」他扶了扶眼镜。「先看，再碰。拜托了。」
: KIM KITSURAGI — "Detective." The lieutenant opens his notebook. "The deceased is Albert Renaud, sixty-seven, retired clockmaker. The landlady found him at seven this morning." He adjusts his glasses. "Look first, touch later. Please."

五感发达（视觉）[容易：成功] — 窗台上的雪是平的。没有手印，没有融水的痕迹。开窗的人没有从这里出去。
: PERCEPTION (SIGHT) [Easy: Success] — The snow on the sill is flat. No handprints, no meltwater. Whoever opened this window didn't leave through it.

内陆帝国 [中等：成功] — 钟在看着你。它停在 23:40，可它的表情不像一只死在 23:40 的钟。它在撒谎，而且撒得很笨拙。
: INLAND EMPIRE [Medium: Success] — The clock is watching you. It stopped at 23:40, but it doesn't wear the face of a clock that died at 23:40. It's lying. Badly.

食髓知味 [极易：成功] — 书架第二层，一瓶梨子白兰地，还剩三分之一。死人喝不完它了。总得有人帮忙。
: ELECTROCHEMISTRY [Trivial: Success] — Second shelf: a bottle of pear brandy, a third left. The dead man won't be finishing it. Somebody has to.

选项
: 1. 检查壁炉上的钟。/ Examine the clock on the mantelpiece. → study.clock
: 2. 检查窗户。/ Examine the window. → study.window
: 3. 「金，我们谈谈。」/ "Kim, let's talk." → study.kim
: 4. 看看那瓶白兰地。/ Look at the pear brandy. → study.brandy
: 5. [逻辑思维 - 挑战 12] 「我知道这里发生了什么。」/ [Logic - Challenging 12] "I know what happened here." 需要证据 ≥ 2 → study.reconstruct

#### study.clock

黄铜座钟 — 一只黄铜座钟。玻璃罩后的钟摆一动不动。指针停在 23:40。
: BRASS MANTEL CLOCK — A brass mantel clock. Behind the glass the pendulum hangs motionless. The hands have stopped at 23:40.

博学多闻 [极易：成功] — 瑞瓦肖晚期工坊的摆钟，受到重击就会停摆。侦探小说对此情有独钟：死者倒下，钟停了，死亡时间被永远保存下来。作家喜欢这个桥段。凶手也喜欢。
: ENCYCLOPEDIA [Trivial: Success] — A late Revacholian workshop pendulum clock. Knock one hard and it stops. Detective fiction adores the device: the victim falls, the clock stops, the hour of death is preserved forever. Writers love it. So do murderers.

选项
: 1. [见微知著 - 中等 10] 把钟转过来，看看背面。/ [Visual Calculus - Medium 10] Turn the clock around.
: 2. 「这只钟在撒谎，金。」/ "This clock is lying, Kim." 需要 `clock_tampered`
: 3. 回到房间中央。/ Step back. → study.intro

见微知著 成功
: 见微知著 [中等：成功] — 模型在你脑中搭了起来：调针旋钮上有三道新鲜划痕，全是顺时针，转了不止一圈。钟停摆之后，有人拨过指针。
: VISUAL CALCULUS [Medium: Success] — The model assembles itself: three fresh scratches on the regulator knob, all clockwise, more than one full turn. Someone moved the hands after the clock had stopped.
: 金·曷城 — 「记下了。」他在笔记本上写了一行字。
: KIM KITSURAGI — "Noted." He writes a line in his notebook.
: 获得旗标 `clock_tampered`。

见微知著 失败
: 见微知著 [中等：失败] — 后盖上有划痕。可能是昨晚的，也可能是六十七年攒下来的。模型拒绝成形。
: VISUAL CALCULUS [Medium: Failure] — There are scratches on the back. Last night's, or sixty-seven years' worth. The model refuses to form.
: 金·曷城 — 「警探，把它放回去。轻一点。」
: KIM KITSURAGI — "Detective. Put it back. Gently."

「这只钟在撒谎」
: 金·曷城 — 「钟不会撒谎，警探。」他看了一眼表盘。「拨它的人会。」
: KIM KITSURAGI — "Clocks don't lie, detective." He glances at the dial. "The people who set them do."

#### study.window

窗户 — 窗外是防火梯，再往下是结了冰的院子。雪还在马丁内斯上空慢慢地下。冷风灌进来，纸做的窗帘一下一下拍着墙。
: THE WINDOW — Outside is the fire escape, and below it an icy yard. Snow is still falling over Martinaise, slowly. Cold air pours in; the paper curtain slaps the wall, again and again.

天人感应 [中等：成功] — 雪落在港口的吊车上，落在渔村的屋顶上，落在一千扇关着的窗上。只有这一扇开着。这座城从昨晚十一点起就一直看着它。
: SHIVERS [Medium: Success] — Snow falls on the harbour cranes, on the roofs of the fishing village, on a thousand closed windows. Only this one is open. The city has been watching it since eleven last night.

选项
: 1. [五感发达（视觉）- 中等 10] 探身出去，看看防火梯。/ [Perception (Sight) - Medium 10] Lean out and look at the fire escape.
: 2. 关上窗户。/ Close the window.
: 3. 回到房间中央。/ Step back. → study.intro

五感发达 成功
: 五感发达（视觉）[中等：成功] — 防火梯上积着完整的一层雪。没有脚印，一个都没有。金的笔记本上写着：雪是昨晚十一点开始下的。十一点以后，没有人从这扇窗出去过。
: PERCEPTION (SIGHT) [Medium: Success] — A full, unbroken layer of snow on the fire escape. No footprints. Not one. Kim's notebook says the snow started at eleven last night. No one has left through this window since eleven.
: 获得旗标 `no_footprints`。

五感发达 失败
: 五感发达（视觉）[中等：失败] — 你探得太远了。雪灌进领口。一只戴手套的手揪住了你的外套后领。
: PERCEPTION (SIGHT) [Medium: Failure] — You lean too far. Snow goes down your collar. A gloved hand catches the back of your blazer.
: 金·曷城 — 「从四楼掉下去，案子不会变简单，警探。」
: KIM KITSURAGI — "Falling four floors will not simplify the case, detective."
: 士气 -1。

关上窗户
: 金·曷城 — 「别动它。开着的窗也是证物。」
: KIM KITSURAGI — "Leave it. An open window is evidence too."

#### study.kim

金·曷城 — 警督合上笔记本，等你开口。镜片后面的眼睛很平静，也很疲倦。
: KIM KITSURAGI — The lieutenant closes his notebook and waits. Behind the lenses his eyes are calm, and tired.

通情达理 [容易：成功] — 他不是在等你的结论。他在等你犯错，好在你犯错之前把你拉回来。这是一种关心。他绝不会这么叫它。
: EMPATHY [Easy: Success] — He isn't waiting for your conclusion. He's waiting for you to make a mistake, so he can pull you back before you do. It's a kind of care. He would never call it that.

选项
: 1. 「死亡时间？」/ "Time of death?"
: 2. 「楼里还有谁住？」/ "Who else lives in the building?"
: 3. [争强好胜 - 中等 10]（红色检定）「把你的笔记本给我。」/ [Authority - Medium 10] (red check) "Give me your notebook."
: 4. 「金，你觉得我是个好警察吗？」/ "Kim, do you think I'm a good cop?"
: 5. 回到房间中央。/ Step back. → study.intro

死亡时间
: 金·曷城 — 「法医的初步估计是二十二点到零点之间。气象站记录，雪是二十三点开始下的。」
: KIM KITSURAGI — "The coroner's preliminary estimate is between twenty-two hundred and midnight. According to the weather station, the snow began at twenty-three hundred."

楼里还有谁住
: 金·曷城 — 「二楼有个房客，马雷克，死者的外甥。昨晚二十三点半到凌晨一点在街角的酒馆，三个证人。」他停顿了一下。「房东太太的狗睡在楼梯口。它整晚都没叫。」
: KIM KITSURAGI — "A lodger on the second floor. Marek, the victim's nephew. At the corner tavern from twenty-three thirty until one in the morning; three witnesses." He pauses. "The landlady's dog sleeps at the foot of the stairs. It didn't bark all night."
: 获得旗标 `dog_silent`。

争强好胜 成功
: 争强好胜 [中等：成功] — 你伸出手。你是法律，而法律需要一本笔记本。
: AUTHORITY [Medium: Success] — You hold out your hand. You are the law, and the law requires a notebook.
: 金·曷城 — 他没有把笔记本交出来，但把它转了过来，让你看清其中一页：「狗，没叫。房客，狗认识。」
: KIM KITSURAGI — He does not hand it over, but he turns it around so you can read one page: "Dog: silent. Lodger: known to the dog."
: 获得旗标 `dog_silent`。

争强好胜 失败
: 争强好胜 [中等：失败] — 你伸出手。手在半空中停了太久。
: AUTHORITY [Medium: Failure] — You hold out your hand. It stays in the air for too long.
: 金·曷城 — 「不行。」笔记本回到了他的口袋里。「你有自己的笔记本，警探。」
: KIM KITSURAGI — "No." The notebook goes back into his pocket. "You have your own notebook, detective."
: 争强好胜 — 你没有自己的笔记本。你连警徽都没有。
: AUTHORITY — You do not have your own notebook. You don't even have your badge.
: 士气 -1。红色检定，不可重试。

好警察
: 金·曷城 — 「现在不是谈这个的时候，警探。」他顿了顿。「先把案子办完。」
: KIM KITSURAGI — "This is not the time, detective." A pause. "Let's close the case first."

#### study.brandy

梨子白兰地 — 一瓶梨子白兰地，也许沾着死者的指纹。还剩三分之一。
: PEAR BRANDY — A bottle of pear brandy, possibly bearing the dead man's fingerprints. A third left.

食髓知味 [极易：成功] — 就闻一下。闻一下不犯法。闻一下甚至算是侦查。
: ELECTROCHEMISTRY [Trivial: Success] — Just a sniff. Sniffing isn't a crime. Sniffing is practically detective work.

选项
: 1. 拧开瓶盖，闻一闻。/ Unscrew the cap and take a sniff.
: 2. 把它放回去。/ Put it back. → study.intro

闻一闻
: 金·曷城 — 「警探。」只有这两个字。
: KIM KITSURAGI — "Detective." That's all he says.
: 食髓知味 — 你把瓶盖拧了回去。下次吧。下次一定。
: ELECTROCHEMISTRY — You screw the cap back on. Next time. Definitely next time.

#### study.reconstruct

你 — 「我知道这里发生了什么。」

逻辑思维 [挑战 12，白色检定]，修正：「+1 指针被拨过」「+1 防火梯上没有脚印」「+1 狗没有叫」。

#### study.reconstruct.ok

舞台切换为夜晚，开始下雪，剪影动画按下列四段旁白依次播放。

逻辑思维 [挑战：成功] — 碎片全都对上了。你闭上眼睛，书房在眼皮后面重新折了一遍。
: LOGIC [Challenging: Success] — Every piece fits. You close your eyes, and behind them the study folds itself again.

旁白
: 二十二点半。雪还没有下。马雷克上楼，狗抬了一下头，又趴了回去。它认识这双鞋。
: Twenty-two thirty. No snow yet. Marek climbs the stairs; the dog lifts its head and lowers it again. It knows these shoes.
: 书房里有过争吵，也可能没有。一记重击。钟没有停。它停下来是后来的事，是被一只手停下的。
: An argument in the study, or none. A single blow. The clock does not stop. It stops later, by hand.
: 他把指针拨到 23:40，按住钟摆。他打开窗，让雪去讲一个关于陌生人的故事。
: He sets the hands to 23:40 and stills the pendulum. He opens the window, so the snow can tell a story about a stranger.
: 二十三点前，他从楼梯下去。狗没有叫。二十三点半，他坐在酒馆里，被三个人看见。雪开始下，把防火梯盖得干干净净。
: Before twenty-three hundred he goes down the stairs. The dog does not bark. At twenty-three thirty he is in the tavern, seen by three people. The snow begins, and covers the fire escape clean.

金·曷城 — 他写了很久，然后合上笔记本。「成立。」停顿。「去二楼，警探。」
: KIM KITSURAGI — He writes for a long time, then closes the notebook. "It holds." A pause. "Second floor, detective."

恐怖领带 — 我们抓到他了，宝贝！现在去喝一杯！就一杯！
: HORRIFIC NECKTIE — We got him, baby! Now let's get a drink! Just one!

选项
: 1. 翻页。/ Turn the page. → study.end

#### study.reconstruct.fail

逻辑思维 [挑战：失败] — 一个陌生人从窗口爬了进来，肩上落着雪。他和勒诺争吵，然后……
: LOGIC [Challenging: Failure] — A stranger climbs in through the window, snow on his shoulders. He argues with Renaud, and then...

金·曷城 — 「窗台上的雪是平的，警探。」他没有抬头。「再想想。」
: KIM KITSURAGI — "The snow on the sill is flat, detective." He doesn't look up. "Think again."

白色检定，获得新证据后可重试。回到 study.intro。

#### 再次进入

再次检查同一物件或再找金说话时，不重复完整描述，只显示一句短句；被动检定也只触发一次。「回到房间中央」直接回到选项，不重复书房描述。

| 节点 | 短句 |
|---|---|
| study.clock | 黄铜座钟 — 指针依然停在 23:40。钟摆一动不动。/ The hands still read 23:40. The pendulum does not move. |
| study.window | 窗户 — 冷风还在往屋里灌。纸做的窗帘拍着墙。/ The cold keeps pouring in. The paper curtain slaps the wall. |
| study.kim | 金·曷城 — 警督抬起眼睛，等你开口。/ The lieutenant looks up and waits. |
| study.brandy | 梨子白兰地 — 还剩三分之一。它哪儿也不去。/ A third left. It isn't going anywhere. |

#### study.end

右页翻过，露出一张空白纸页，中央一行字：「第一章 完」/ "End of Chapter One"。

## 5. 游戏系统

### 5.1 角色数值

Demo 不做角色创建，使用固定角色卡：

| 技能 | 属性 | 初始值 |
|---|---|---|
| 逻辑思维 | 智力 | 4 |
| 博学多闻 | 智力 | 2 |
| 见微知著 | 智力 | 3 |
| 内陆帝国 | 精神 | 5 |
| 通情达理 | 精神 | 3 |
| 争强好胜 | 精神 | 2 |
| 五感发达 | 身手 | 2 |
| 食髓知味 | 体格 | 5 |
| 天人感应 | 体格 | 4 |

恐怖领带不是技能，内陆帝国 ≥ 5 时它才会开口。

士气初始 4，上限 4。归零时不结束游戏，只显示一段内心声音并锁定争强好胜检定。属性、生命、经验、技能点均不在 Demo 中实现。

### 5.2 检定规则

- 公式：2d6 + 技能值 + 修正值 ≥ 难度阈值。
- 掷出 2 必定失败，掷出 12 必定成功。
- 难度分级沿用原作中文版：极易 6、容易 8、中等 10、挑战 12、困难 13、极难 14、专家 15、噩梦 16、炼狱 18。Demo 只用到 6、8、10、12。
- 白色检定：成功后选项消失。失败后选项变灰；获得任何新旗标，或此后又做了 3 次选择，选项重新亮起。后一条保证本章不会卡关。
- 红色检定：一次性，失败后选项消失。
- 被动检定：按原作规则不掷骰，6 + 技能值 ≥ 阈值即触发，成功时插入对应内心声音。
- 修正值来源：旗标。显示格式为「+1 指针被拨过」，与原作的提示方式一致。

Demo 中各检定的成功率：

| 检定 | 技能值 | 阈值 | 需要点数 | 成功率 |
|---|---|---|---|---|
| 见微知著 白 | 3 | 10 | 7+ | 58% |
| 五感发达（视觉）白 | 2 | 10 | 8+ | 42% |
| 争强好胜 红 | 2 | 10 | 8+ | 42% |
| 逻辑思维 白，0 证据 | 4 | 12 | 8+ | 42% |
| 逻辑思维 白，2 证据 | 4+2 | 12 | 6+ | 72% |
| 逻辑思维 白，3 证据 | 4+3 | 12 | 5+ | 83% |

被动检定不掷骰，按上面的角色卡全部触发：

| 被动检定 | 6 + 技能值 | 阈值 |
|---|---|---|
| 五感发达（视觉） | 8 | 容易 8 |
| 内陆帝国 | 11 | 中等 10 |
| 食髓知味 | 11 | 极易 6 |
| 博学多闻 | 8 | 极易 6 |
| 天人感应 | 10 | 中等 10 |
| 通情达理 | 9 | 容易 8 |

### 5.3 骰子表现

- 选择带检定的选项后，左页文字暂停，右页地面上落下两枚纸骰子，翻滚约 0.8 秒后停下。
- 骰子停下后，左页先出现一行掷骰算式 `[见微知著 - 中等 10]  4 + 5 + 3 = 12`，再出现带结果标签的技能插话 `见微知著 [中等：成功] — ……`。技能名颜色随所属属性。
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
│  │ 你 — 检查壁炉上的钟。           │   哈里        金       │        │
│  │ 黄铜座钟 — ……                  │                       │        │
│  │ 见微知著 [中等：成功] — ……     │        ⚂ ⚄            │        │
│  │ 1. 回到房间中央。▮             │                       │        │
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
| 靛蓝 | `#1F2A44` | 墙纸、夜空 |
| 锈橙 | `#C2562B` | 当前选项、烟头光 |
| 灰绿 | `#7A8C7E` | 远景 |
| 青绿 | `#3F6E68` | 书架、家具 |
| 赭黄 | `#C9A05A` | 钟、灯光、暖色点缀 |
| 木桌 | `#2A1E16` | 画面最外层 |
| 白色检定 | `#F2EFE6` | 检定标签底色 |
| 红色检定 | `#A3232B` | 检定标签底色 |

技能名颜色按原作的四色体系：智力青蓝、精神紫、体格洋红、身手金黄。参考值为智力 `#5CB9D6`、精神 `#8466CC`、体格 `#C84466`、身手 `#E0B43A`，印在纸上时按需要压暗以保证对比度。人物、物件与地点的名称统一用一种中性色，与原作一致。

### 6.3 字体

| 用途 | 中文 | 英文 |
|---|---|---|
| 叙述 | 思源宋体 Noto Serif SC | EB Garamond |
| 玩家选项 | 霞鹜文楷等宽 LXGW WenKai Mono | JetBrains Mono |
| 技能名与检定标签 | 思源黑体 Noto Sans SC，全大写风格用字重表达 | Inter，全大写，字距加宽 |

中文字体体积大，需用 fonttools 按台词文本裁剪子集后自托管。叙述段首保留参考 demo 的首字下沉，中文版改为段首缩进两字并把第一行加重。

### 6.4 角色纸偶

- 纸偶是侧面剪纸，面部只保留最少的记号，靠轮廓与配色识别。两人相对而立：哈里朝右，金朝左。
- 哈里：
  - 身形高大魁梧，挺着肚子，肩背微驼，站姿松垮。
  - 深棕色乱发垂到领口，一对浓密的大鬓角，脸浮肿，鼻头发红，眼袋明显。
  - 绿色麂皮西装外套，敞着怀，背后和右袖有 RCM 水印。里面是发皱的白色缎面衬衫。
  - 恐怖领带：70 年代的宽领带，芥末黄、锈红、青绿交错的俗艳花纹，歪在一边。
  - 金褐色喇叭裤，裤脚大幅外扩；浅色蛇皮鞋。
  - 可以夹一支烟，烟头保留橙色光点。
- 金：
  - 身形清瘦，比哈里矮半头，站得笔直，动作克制。
  - 黑色短发向后梳，戴小圆框黑边眼镜。
  - 橙色飞行员夹克，罗纹立领、罗纹袖口和下摆颜色更深。
  - 棕红色皮质驾驶手套，棕色长裤，深棕色靴子。
  - 一手拿小笔记本，一手拿笔。
- 每个纸偶有 3 个姿势：站立、指向、蹲下。姿势切换用 200 毫秒的交叉淡入。
- 纸偶底部有一条深色阴影线，模拟纸片立在页面上的感觉。
- 说话时纸偶轻微上下浮动，幅度 2 像素。

### 6.5 动效清单

| 触发 | 表现 |
|---|---|
| 进入场景 | 背景板从平放旋转到竖起，各层依次弹出，总时长 1.2 秒 |
| 新叙述 | 左页文字逐字出现，中文每字 55 毫秒，英文每字符 28 毫秒；逗号类标点后多停 120 毫秒（英文 80），句末标点后多停 260 毫秒（英文 180）；打字中点击直接补全本段 |
| 逐段推进 | 每段话打完后停下，左页右下角闪烁「▼ 继续」，点击、空格或回车进入下一段。玩家自己说的「你 —」行、紧接选项的最后一段、掷骰算式行不停顿 |
| 新线索 | 日志中插入一行系统提示「新线索　指针被拨过（1/3）」；右页落下一张贴着胶带的大纸卡，点击后滑走；士气下方常驻「线索 1/3」计数 |
| 内心声音 | 技能名以属性色出现，文字前有 0.3 秒停顿 |
| 主动检定 | 骰子落下翻滚，结算行出现，纸偶做对应姿势 |
| 士气变化 | 右页角落的纸质心形褪色一格 |
| 还原成功 | 背景板颜色过渡到夜色，雪片开始飘落，楼梯层从背景板后升起，马雷克与狗的剪影按 4.4 节的四段叙述依次移动；钟的指针转动；窗户打开 |
| 还原失败 | 背景板短暂变暗后恢复，雪片不出现 |
| 章节结束 | 右页整页翻起，露出空白页 |

还原成功的动画是整个 Demo 的展示核心，对应参考 demo 中巨龙升起的时刻。

### 6.6 与原作的差异处理

原作是厚涂油画，本项目是剪纸。为保持辨识度，在剪纸之上做三件事：整体叠加低透明度的噪点纹理；背景板用带笔触感的渐变而不是纯色；角色轮廓保留手剪的不规则边缘。文字区域沿用原作的对话日志格式：说话者名称加破折号，物件和地点也可以是说话者；技能名按属性着色并带检定结果标签；玩家已选的话以「你 —」开头；当前选项编号列出，带检定的选项前标出技能与难度。

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
  | 'inlandEmpire' | 'empathy' | 'authority'
  | 'perception' | 'electrochemistry' | 'shivers';

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
  // 'you' 为玩家已选的话；'necktie' 为恐怖领带；Text 为物件或地点名，例如「黄铜座钟」
  speaker: 'narrator' | 'you' | 'kim' | 'necktie' | SkillId | Text;
  text: Text;
  // 技能插话的检定结果标签，例如 [中等：成功]
  result?: { dc: number; success: boolean };
  // 五感发达的分项，例如（视觉）
  sense?: 'sight' | 'smell' | 'hearing';
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

状态：已完成。通关截图见 `docs/m1-*.png`，由 `npm run play` 按固定骰子与路径无头通关生成。

- 第 4 章的全部节点，中英双语。
- 4 次主动检定与骰子动画，6 次被动检定。
- 旗标、士气、白色重试、红色一次性。
- 还原成功的完整舞台动画。
- 语言切换。

验收标准：从开场到「第一章 完」可完整走通；三条证据都能获取；逻辑思维检定失败后收集新证据可重试；争强好胜检定失败后选项消失；切换语言后当前页面文字与字体正确更新。

### M2 扩展

- 第二章：二楼房客的房间，对质马雷克，引入争强好胜与循循善诱的对抗检定。
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

原作图片素材：当前云端环境的网络策略拦截了 Steam、Fandom、维基百科、百度百科等站点，无法下载原作立绘作参考。纸偶暂按文字资料重绘。需要按立绘校准时，有两种途径：在对话中直接附上参考图，或在环境设置中放行对应域名。

待确认：

- 是否需要键盘操作选项。
- 是否引入 GSAP，还是只用 Web Animations API。
- 部署目标是 GitHub Pages 还是其他静态托管。
- 中文选项字体是否接受霞鹜文楷的手写感，还是改用更硬朗的等宽字体。
