// Hover tips for the things on the stage: a name, set like a speaker in the log, and one line.
// A tip can change with the game state: the first variant whose `when` holds replaces `tip`.
// Keys name scene pieces (or regions of a baked layer); the scene maps each key to its shape.
import type { Condition, Text } from './schema';

export interface Hotspot {
  name: Text;
  tip: Text;
  variants?: { when: Condition; tip: Text }[];
  /** Only shown while the reconstruction's flashback is on stage. */
  flashbackOnly?: boolean;
}

const t = (zh: string, en: string): Text => ({ zh, en });

export const HOTSPOTS: Record<string, Hotspot> = {
  // --- people ---------------------------------------------------------------------------
  harry: {
    name: t('你', 'You'),
    tip: t('一个穿绿色麂皮西装、系着恐怖领带的警探。你自己。大概吧。', 'A detective in a green suede blazer and a horrific necktie. You. Probably.'),
  },
  kim: {
    name: t('金·曷城', 'Kim Kitsuragi'),
    tip: t('RCM 57 分局警督。橙色飞行员夹克，一丝不苟的笔记。他在看案子，也在看你。', 'Lieutenant, RCM Precinct 57. Orange bomber jacket, meticulous notes. He is watching the case, and you.'),
    variants: [{
      when: { flags: ['case_reconstructed'] },
      tip: t('他合上了笔记本。这是他表达满意的方式。', 'He has closed his notebook. That is how he says he is satisfied.'),
    }],
  },
  victim: {
    name: t('阿尔贝·勒诺', 'Albert Renaud'),
    tip: t('六十七岁，退休钟表匠。头枕在账本上，停在一行没写完的数字上。', 'Sixty-seven, retired clockmaker. His head rests on the ledger, on a row of figures he never finished.'),
  },

  // --- the back wall and the furniture row ----------------------------------------------
  clock: {
    name: t('黄铜座钟', 'Brass Mantel Clock'),
    tip: t('指针停在 23:40。钟摆一动不动。', 'The hands read 23:40. The pendulum does not move.'),
    variants: [{
      when: { flags: ['clock_tampered'] },
      tip: t('指针停在 23:40。是被一只手停下的。', 'The hands read 23:40. A hand put them there.'),
    }],
  },
  window: {
    name: t('窗户', 'The Window'),
    tip: t('开着。冷风灌进来。窗台上的雪很平。', 'Open. The cold pours in. The snow on the sill is flat.'),
    variants: [{
      when: { flags: ['no_footprints'] },
      tip: t('开着。防火梯上的雪没有被人踩过。', 'Open. No one has walked on the snow on the fire escape.'),
    }],
  },
  curtain: {
    name: t('窗帘', 'The Curtain'),
    tip: t('纸做的窗帘，一下一下拍着墙。', 'A paper curtain, slapping the wall again and again.'),
  },
  bookshelf: {
    name: t('书架', 'Bookshelf'),
    tip: t('钟表修理手册，瑞瓦肖地方史。第二层有一瓶梨子白兰地。', 'Clock-repair manuals, local histories of Revachol. A bottle of pear brandy on the second shelf.'),
  },
  fireplace: {
    name: t('壁炉', 'Fireplace'),
    tip: t('灰是冷的。昨晚没人生火。', 'The ashes are cold. No one lit a fire last night.'),
  },
  mirror: {
    name: t('镜子', 'Mirror'),
    tip: t('你决定暂时不看它。', 'You decide not to look into it. Not yet.'),
  },
  photo: {
    name: t('相框', 'Photograph'),
    tip: t('一个年轻人站在一家钟表铺门口。可能是勒诺。可能是任何人。', 'A young man in front of a clockmaker\'s shop. Maybe Renaud. Maybe anyone.'),
  },
  calendar: {
    name: t('日历', 'Calendar'),
    tip: t('某一天被红笔圈了起来。旁边什么也没写。', 'One day is circled in red. Nothing is written next to it.'),
  },
  radiator: {
    name: t('暖气片', 'Radiator'),
    tip: t('冰凉。房东太太在省煤。', 'Ice cold. The landlady is saving coal.'),
  },

  // --- the desk row ---------------------------------------------------------------------
  desk: {
    name: t('书桌', 'Desk'),
    tip: t('账本摊开着，墨水瓶没盖。一切都停在昨晚。', 'The ledger lies open, the inkwell uncapped. Everything stopped last night.'),
  },
  candle: {
    name: t('蜡烛', 'Candle'),
    tip: t('烧了一半。有人比它先离开了这个房间。', 'Burned halfway down. Someone left the room before it did.'),
  },
  rug: {
    name: t('地毯', 'Rug'),
    tip: t('边角磨破了。从门口到书桌，踩出了一条颜色更浅的路。', 'Frayed at the corners. A paler path is worn into it, from the door to the desk.'),
  },

  // --- the front row and the floor ------------------------------------------------------
  armchair: {
    name: t('扶手椅', 'Armchair'),
    tip: t('坐垫上有一个旧凹陷，是一个人坐了很多年的形状。', 'An old hollow in the cushion, the shape of one man sitting for many years.'),
  },
  coatStand: {
    name: t('衣帽架', 'Coat Stand'),
    tip: t('一顶帽子，一件大衣。老人今天不会出门了。', 'A hat, a coat. The old man won\'t be going out today.'),
  },
  wastebasket: {
    name: t('废纸篓', 'Wastebasket'),
    tip: t('揉皱的纸团。是账单，不是遗书。', 'Crumpled paper. Bills, not a farewell note.'),
  },
  books: {
    name: t('书堆', 'Stack of Books'),
    tip: t('从书架上搬下来，还没来得及放回去。', 'Taken down from the shelf and never put back.'),
  },
  papers: {
    name: t('散落的纸', 'Loose Papers'),
    tip: t('账页，钟表零件的订单。没有一张写着凶手的名字。', 'Ledger pages, orders for clock parts. None of them names a murderer.'),
  },

  // --- on the table ----------------------------------------------------------------------
  dice: {
    name: t('骰子', 'Dice'),
    tip: t('两枚纸骰子。在这本书里，命运归它们管。', 'Two paper dice. In this book, fate is their department.'),
  },
  // the name is followed by the count (「士气 3 / 4」); the leads' line lists what was found
  morale: {
    name: t('士气', 'Morale'),
    tip: t('失败会让它流失。一颗也不剩的时候，你会放下这个案子。', 'Failures drain it. When no heart is left, you give up the case.'),
  },
  leads: {
    name: t('线索', 'Leads'),
    tip: t('还没有找到线索。', 'No leads yet.'),
  },

  // --- the reconstruction ---------------------------------------------------------------
  stairs: {
    name: t('楼梯', 'Stairs'),
    tip: t('每一级都嘎吱作响。昨晚也一样，只是没人在听。', 'Every step creaks. It did last night too; no one was listening.'),
    flashbackOnly: true,
  },
  dog: {
    name: t('房东太太的狗', "The Landlady's Dog"),
    tip: t('它认识这栋楼里的每一双鞋。', 'It knows every pair of shoes in this building.'),
    flashbackOnly: true,
  },
  marek: {
    name: t('马雷克', 'Marek'),
    tip: t('死者的外甥。在这段回忆里，他只是一个影子。', "The victim's nephew. In this memory he is only a shadow."),
    flashbackOnly: true,
  },
};
