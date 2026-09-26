// Chapter one, 《雪落之前》/ Before the Snow: every node of docs/design.md §4.4, zh + en.
import type { Check, Goto, Line, Modifier, Node, Option, SkillId, Story, Text } from './schema';
import { SKILLS } from './skills';

const t = (zh: string, en: string): Text => ({ zh, en });
const kim = (zh: string, en: string): Line => ({ speaker: 'kim', text: t(zh, en) });
const thing = (name: Text, zh: string, en: string): Line => ({ speaker: name, text: t(zh, en) });
const voice = (skill: SkillId, zh: string, en: string, result?: Line['result'], sense?: Line['sense']): Line =>
  ({ speaker: skill, text: t(zh, en), result, sense });
const narrate = (zh: string, en: string): Line => ({ speaker: 'narrator', text: t(zh, en) });
const back = (node: string): Goto => ({ node, silent: true });

// --- evidence --------------------------------------------------------------------------

export const EVIDENCE_LABELS: Record<string, Text> = {
  clock_tampered: t('指针被拨过', 'The hands were moved'),
  no_footprints: t('防火梯上没有脚印', 'No footprints on the fire escape'),
  dog_silent: t('狗没有叫', "The dog didn't bark"),
};

const EVIDENCE = Object.keys(EVIDENCE_LABELS);

const evidenceModifiers: Modifier[] = EVIDENCE.map((flag) => ({ flag, value: 1, label: EVIDENCE_LABELS[flag] }));

const flag = (key: string) => ({ type: 'flag' as const, key, value: true });

// --- names -----------------------------------------------------------------------------

const STUDY = t('书房', 'The Study');
const CLOCK = t('黄铜座钟', 'Brass Mantel Clock');
const WINDOW = t('窗户', 'The Window');
const BRANDY = t('梨子白兰地', 'Pear Brandy');

// --- options shared by several nodes -----------------------------------------------------

const stepBack = (id: string): Option => ({ id, text: t('回到房间中央。', 'Step back.'), next: 'study.intro', silent: true });

const reconstructCheck: Check = {
  skill: 'logic', dc: 12, kind: 'white', modifiers: evidenceModifiers,
  success: 'study.reconstruct.ok', failure: 'study.reconstruct.fail',
};

// --- nodes -----------------------------------------------------------------------------

const nodes: Node[] = [
  // ---------------------------------------------------------------- the room
  {
    id: 'study.intro',
    lines: [
      thing(STUDY,
        '一间折出来的书房。靛蓝墙纸褪了色，折痕处露出纸的本色。壁炉上的钟停了。窗开着，窗台上压着一层没人碰过的雪。桌前坐着一个老人，头枕在账本上。他在睡觉。不，他没有。',
        "A study, folded out of a single sheet. The indigo wallpaper has faded; the creases show the paper's true colour. The clock on the mantelpiece has stopped. The window is open, a layer of untouched snow on the sill. An old man sits at the desk, his head on a ledger. He's asleep. No, he isn't."),
      kim('「警探。」警督翻开笔记本。「死者阿尔贝·勒诺，六十七岁，退休钟表匠。房东太太今早七点发现了他。」他扶了扶眼镜。「先看，再碰。拜托了。」',
        '"Detective." The lieutenant opens his notebook. "The deceased is Albert Renaud, sixty-seven, retired clockmaker. The landlady found him at seven this morning." He adjusts his glasses. "Look first, touch later. Please."'),
    ],
    passive: [
      { skill: 'perception', sense: 'sight', dc: 8,
        text: t('窗台上的雪是平的。没有手印，没有融水的痕迹。开窗的人没有从这里出去。',
          "The snow on the sill is flat. No handprints, no meltwater. Whoever opened this window didn't leave through it.") },
      { skill: 'inlandEmpire', dc: 10,
        text: t('钟在看着你。它停在 23:40，可它的表情不像一只死在 23:40 的钟。它在撒谎，而且撒得很笨拙。',
          "The clock is watching you. It stopped at 23:40, but it doesn't wear the face of a clock that died at 23:40. It's lying. Badly.") },
      { skill: 'electrochemistry', dc: 6,
        text: t('书架第二层，一瓶梨子白兰地，还剩三分之一。死人喝不完它了。总得有人帮忙。',
          "Second shelf: a bottle of pear brandy, a third left. The dead man won't be finishing it. Somebody has to.") },
    ],
    options: [
      { id: 'intro.clock', text: t('检查壁炉上的钟。', 'Examine the clock on the mantelpiece.'), next: 'study.clock' },
      { id: 'intro.window', text: t('检查窗户。', 'Examine the window.'), next: 'study.window' },
      { id: 'intro.kim', text: t('「金，我们谈谈。」', '"Kim, let\'s talk."'), next: 'study.kim' },
      { id: 'intro.brandy', text: t('看看那瓶白兰地。', 'Look at the pear brandy.'), next: 'study.brandy' },
      { id: 'intro.reconstruct', text: t('「我知道这里发生了什么。」', '"I know what happened here."'),
        check: reconstructCheck, requires: { minEvidence: 2 } },
    ],
  },

  // ---------------------------------------------------------------- the clock
  {
    id: 'study.clock',
    lines: [thing(CLOCK, '一只黄铜座钟。玻璃罩后的钟摆一动不动。指针停在 23:40。',
      'A brass mantel clock. Behind the glass the pendulum hangs motionless. The hands have stopped at 23:40.')],
    revisit: [thing(CLOCK, '指针依然停在 23:40。钟摆一动不动。', 'The hands still read 23:40. The pendulum does not move.')],
    passive: [{ skill: 'encyclopedia', dc: 6,
      text: t('瑞瓦肖晚期工坊的摆钟，受到重击就会停摆。侦探小说对此情有独钟：死者倒下，钟停了，死亡时间被永远保存下来。作家喜欢这个桥段。凶手也喜欢。',
        'A late Revacholian workshop pendulum clock. Knock one hard and it stops. Detective fiction adores the device: the victim falls, the clock stops, the hour of death is preserved forever. Writers love it. So do murderers.') }],
    options: [
      { id: 'clock.turn', text: t('把钟转过来，看看背面。', 'Turn the clock around.'),
        check: { skill: 'visualCalculus', dc: 10, kind: 'white', success: 'study.clock.ok', failure: 'study.clock.fail' } },
      { id: 'clock.lying', text: t('「这只钟在撒谎，金。」', '"This clock is lying, Kim."'),
        requires: { flags: ['clock_tampered'] }, once: true, next: 'study.clock.lying' },
      stepBack('clock.back'),
    ],
  },
  {
    id: 'study.clock.ok',
    effects: [flag('clock_tampered')],
    lines: [
      voice('visualCalculus',
        '模型在你脑中搭了起来：调针旋钮上有三道新鲜划痕，全是顺时针，转了不止一圈。钟停摆之后，有人拨过指针。',
        'The model assembles itself: three fresh scratches on the regulator knob, all clockwise, more than one full turn. Someone moved the hands after the clock had stopped.',
        { dc: 10, success: true }),
      kim('「记下了。」他在笔记本上写了一行字。', '"Noted." He writes a line in his notebook.'),
    ],
    options: [],
    next: back('study.clock'),
  },
  {
    id: 'study.clock.fail',
    lines: [
      voice('visualCalculus',
        '后盖上有划痕。可能是昨晚的，也可能是六十七年攒下来的。模型拒绝成形。',
        "There are scratches on the back. Last night's, or sixty-seven years' worth. The model refuses to form.",
        { dc: 10, success: false }),
      kim('「警探，把它放回去。轻一点。」', '"Detective. Put it back. Gently."'),
    ],
    options: [],
    next: back('study.clock'),
  },
  {
    id: 'study.clock.lying',
    lines: [kim('「钟不会撒谎，警探。」他看了一眼表盘。「拨它的人会。」',
      '"Clocks don\'t lie, detective." He glances at the dial. "The people who set them do."')],
    options: [],
    next: back('study.clock'),
  },

  // ---------------------------------------------------------------- the window
  {
    id: 'study.window',
    lines: [thing(WINDOW,
      '窗外是防火梯，再往下是结了冰的院子。雪还在马丁内斯上空慢慢地下。冷风灌进来，纸做的窗帘一下一下拍着墙。',
      'Outside is the fire escape, and below it an icy yard. Snow is still falling over Martinaise, slowly. Cold air pours in; the paper curtain slaps the wall, again and again.')],
    revisit: [thing(WINDOW, '冷风还在往屋里灌。纸做的窗帘拍着墙。', 'The cold keeps pouring in. The paper curtain slaps the wall.')],
    passive: [{ skill: 'shivers', dc: 10,
      text: t('雪落在港口的吊车上，落在渔村的屋顶上，落在一千扇关着的窗上。只有这一扇开着。这座城从昨晚十一点起就一直看着它。',
        'Snow falls on the harbour cranes, on the roofs of the fishing village, on a thousand closed windows. Only this one is open. The city has been watching it since eleven last night.') }],
    options: [
      { id: 'window.lean', text: t('探身出去，看看防火梯。', 'Lean out and look at the fire escape.'),
        check: { skill: 'perception', sense: 'sight', dc: 10, kind: 'white', success: 'study.window.ok', failure: 'study.window.fail' } },
      { id: 'window.close', text: t('关上窗户。', 'Close the window.'), once: true, next: 'study.window.close' },
      stepBack('window.back'),
    ],
  },
  {
    id: 'study.window.ok',
    effects: [flag('no_footprints')],
    lines: [voice('perception',
      '防火梯上积着完整的一层雪。没有脚印，一个都没有。金的笔记本上写着：雪是昨晚十一点开始下的。十一点以后，没有人从这扇窗出去过。',
      "A full, unbroken layer of snow on the fire escape. No footprints. Not one. Kim's notebook says the snow started at eleven last night. No one has left through this window since eleven.",
      { dc: 10, success: true }, 'sight')],
    options: [],
    next: back('study.window'),
  },
  {
    id: 'study.window.fail',
    effects: [{ type: 'morale', delta: -1 }],
    lines: [
      voice('perception', '你探得太远了。雪灌进领口。一只戴手套的手揪住了你的外套后领。',
        'You lean too far. Snow goes down your collar. A gloved hand catches the back of your blazer.',
        { dc: 10, success: false }, 'sight'),
      kim('「从四楼掉下去，案子不会变简单，警探。」', '"Falling four floors will not simplify the case, detective."'),
    ],
    options: [],
    next: back('study.window'),
  },
  {
    id: 'study.window.close',
    lines: [kim('「别动它。开着的窗也是证物。」', '"Leave it. An open window is evidence too."')],
    options: [],
    next: back('study.window'),
  },

  // ---------------------------------------------------------------- Kim
  {
    id: 'study.kim',
    lines: [kim('警督合上笔记本，等你开口。镜片后面的眼睛很平静，也很疲倦。',
      'The lieutenant closes his notebook and waits. Behind the lenses his eyes are calm, and tired.')],
    revisit: [kim('警督抬起眼睛，等你开口。', 'The lieutenant looks up and waits.')],
    passive: [{ skill: 'empathy', dc: 8,
      text: t('他不是在等你的结论。他在等你犯错，好在你犯错之前把你拉回来。这是一种关心。他绝不会这么叫它。',
        "He isn't waiting for your conclusion. He's waiting for you to make a mistake, so he can pull you back before you do. It's a kind of care. He would never call it that.") }],
    options: [
      { id: 'kim.time', text: t('「死亡时间？」', '"Time of death?"'), once: true, next: 'study.kim.time' },
      { id: 'kim.who', text: t('「楼里还有谁住？」', '"Who else lives in the building?"'), once: true, next: 'study.kim.who' },
      { id: 'kim.notebook', text: t('「把你的笔记本给我。」', '"Give me your notebook."'),
        requires: { minMorale: 1 },
        check: { skill: 'authority', dc: 10, kind: 'red', success: 'study.kim.notebook.ok', failure: 'study.kim.notebook.fail' } },
      { id: 'kim.goodcop', text: t('「金，你觉得我是个好警察吗？」', '"Kim, do you think I\'m a good cop?"'), once: true, next: 'study.kim.goodcop' },
      stepBack('kim.back'),
    ],
  },
  {
    id: 'study.kim.time',
    lines: [kim('「法医的初步估计是二十二点到零点之间。气象站记录，雪是二十三点开始下的。」',
      '"The coroner\'s preliminary estimate is between twenty-two hundred and midnight. According to the weather station, the snow began at twenty-three hundred."')],
    options: [],
    next: back('study.kim'),
  },
  {
    id: 'study.kim.who',
    effects: [flag('dog_silent')],
    lines: [kim('「二楼有个房客，马雷克，死者的外甥。昨晚二十三点半到凌晨一点在街角的酒馆，三个证人。」他停顿了一下。「房东太太的狗睡在楼梯口。它整晚都没叫。」',
      '"A lodger on the second floor. Marek, the victim\'s nephew. At the corner tavern from twenty-three thirty until one in the morning; three witnesses." He pauses. "The landlady\'s dog sleeps at the foot of the stairs. It didn\'t bark all night."')],
    options: [],
    next: back('study.kim'),
  },
  {
    id: 'study.kim.notebook.ok',
    effects: [flag('dog_silent')],
    lines: [
      voice('authority', '你伸出手。你是法律，而法律需要一本笔记本。', 'You hold out your hand. You are the law, and the law requires a notebook.',
        { dc: 10, success: true }),
      kim('他没有把笔记本交出来，但把它转了过来，让你看清其中一页：「狗，没叫。房客，狗认识。」',
        'He does not hand it over, but he turns it around so you can read one page: "Dog: silent. Lodger: known to the dog."'),
    ],
    options: [],
    next: back('study.kim'),
  },
  {
    id: 'study.kim.notebook.fail',
    effects: [{ type: 'morale', delta: -1 }],
    lines: [
      voice('authority', '你伸出手。手在半空中停了太久。', 'You hold out your hand. It stays in the air for too long.',
        { dc: 10, success: false }),
      kim('「不行。」笔记本回到了他的口袋里。「你有自己的笔记本，警探。」', '"No." The notebook goes back into his pocket. "You have your own notebook, detective."'),
      voice('authority', '你没有自己的笔记本。你连警徽都没有。', "You do not have your own notebook. You don't even have your badge."),
    ],
    options: [],
    next: back('study.kim'),
  },
  {
    id: 'study.kim.goodcop',
    lines: [kim('「现在不是谈这个的时候，警探。」他顿了顿。「先把案子办完。」', '"This is not the time, detective." A pause. "Let\'s close the case first."')],
    options: [],
    next: back('study.kim'),
  },

  // ---------------------------------------------------------------- the brandy
  {
    id: 'study.brandy',
    lines: [thing(BRANDY, '一瓶梨子白兰地，也许沾着死者的指纹。还剩三分之一。',
      "A bottle of pear brandy, possibly bearing the dead man's fingerprints. A third left.")],
    revisit: [thing(BRANDY, '还剩三分之一。它哪儿也不去。', "A third left. It isn't going anywhere.")],
    passive: [{ skill: 'electrochemistry', dc: 6,
      text: t('就闻一下。闻一下不犯法。闻一下甚至算是侦查。', "Just a sniff. Sniffing isn't a crime. Sniffing is practically detective work.") }],
    options: [
      { id: 'brandy.sniff', text: t('拧开瓶盖，闻一闻。', 'Unscrew the cap and take a sniff.'), once: true, next: 'study.brandy.sniff' },
      { id: 'brandy.back', text: t('把它放回去。', 'Put it back.'), next: 'study.intro', silent: true },
    ],
  },
  {
    id: 'study.brandy.sniff',
    lines: [
      kim('「警探。」只有这两个字。', '"Detective." That\'s all he says.'),
      voice('electrochemistry', '你把瓶盖拧了回去。下次吧。下次一定。', 'You screw the cap back on. Next time. Definitely next time.'),
    ],
    options: [],
    next: back('study.brandy'),
  },

  // ---------------------------------------------------------------- the reconstruction
  {
    id: 'study.reconstruct.fail',
    lines: [
      voice('logic', '一个陌生人从窗口爬了进来，肩上落着雪。他和勒诺争吵，然后……',
        'A stranger climbs in through the window, snow on his shoulders. He argues with Renaud, and then...',
        { dc: 12, success: false }),
      kim('「窗台上的雪是平的，警探。」他没有抬头。「再想想。」', '"The snow on the sill is flat, detective." He doesn\'t look up. "Think again."'),
    ],
    options: [],
    next: back('study.intro'),
  },
  {
    id: 'study.reconstruct.ok',
    lines: [voice('logic', '碎片全都对上了。你闭上眼睛，书房在眼皮后面重新折了一遍。',
      'Every piece fits. You close your eyes, and behind them the study folds itself again.', { dc: 12, success: true })],
    options: [],
    next: { node: 'study.recon.1' },
  },
  {
    id: 'study.recon.1',
    stage: ['flashback', 'snow-stop', 'raise-stairs', 'marek-climb'],
    lines: [narrate('二十二点半。雪还没有下。马雷克上楼，狗抬了一下头，又趴了回去。它认识这双鞋。',
      'Twenty-two thirty. No snow yet. Marek climbs the stairs; the dog lifts its head and lowers it again. It knows these shoes.')],
    options: [],
    next: { node: 'study.recon.2' },
  },
  {
    id: 'study.recon.2',
    stage: ['marek-blow'],
    lines: [narrate('书房里有过争吵，也可能没有。一记重击。钟没有停。它停下来是后来的事，是被一只手停下的。',
      'An argument in the study, or none. A single blow. The clock does not stop. It stops later, by hand.')],
    options: [],
    next: { node: 'study.recon.3' },
  },
  {
    id: 'study.recon.3',
    stage: ['clock-set', 'window-open'],
    lines: [narrate('他把指针拨到 23:40，按住钟摆。他打开窗，让雪去讲一个关于陌生人的故事。',
      'He sets the hands to 23:40 and stills the pendulum. He opens the window, so the snow can tell a story about a stranger.')],
    options: [],
    next: { node: 'study.recon.4' },
  },
  {
    id: 'study.recon.4',
    stage: ['marek-leave', 'snow-start'],
    lines: [narrate('二十三点前，他从楼梯下去。狗没有叫。二十三点半，他坐在酒馆里，被三个人看见。雪开始下，把防火梯盖得干干净净。',
      'Before twenty-three hundred he goes down the stairs. The dog does not bark. At twenty-three thirty he is in the tavern, seen by three people. The snow begins, and covers the fire escape clean.')],
    options: [],
    next: { node: 'study.recon.5' },
  },
  {
    id: 'study.recon.5',
    stage: ['present'],
    effects: [flag('case_reconstructed')],
    lines: [
      kim('他写了很久，然后合上笔记本。「成立。」停顿。「去二楼，警探。」',
        'He writes for a long time, then closes the notebook. "It holds." A pause. "Second floor, detective."'),
      { speaker: 'necktie', text: t('我们抓到他了，宝贝！现在去喝一杯！就一杯！', "We got him, baby! Now let's get a drink! Just one!"),
        when: { skillAtLeast: { inlandEmpire: 5 } } },
    ],
    options: [{ id: 'recon.upstairs', text: t('「走吧，去二楼。」', '"Let\'s go. Second floor."'), next: 'study.end' }],
  },
  {
    id: 'study.end',
    stage: ['exit'],
    lines: [],
    options: [],
    end: true,
  },
];

export const study: Story = {
  start: 'study.intro',
  nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
  evidence: EVIDENCE,
  sheet: Object.fromEntries(Object.entries(SKILLS).map(([k, s]) => [k, s.value])) as Record<SkillId, number>,
  morale: { start: 4, max: 4 },
};
