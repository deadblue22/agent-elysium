// Skills, attributes and difficulty names (docs/design.md §3.6, §5.1, §5.2, §6.2).
import type { SkillId, Text } from './schema';

export type Attribute = 'intellect' | 'psyche' | 'physique' | 'motorics';

/** Attribute colours from §6.2 (for dark backgrounds). */
export const ATTRIBUTE_COLOR: Record<Attribute, string> = {
  intellect: '#6FA8DC',
  psyche: '#B07BC4',
  physique: '#D9703B',
  motorics: '#E3C25A',
};

/** The same hues pushed toward ink so they survive on cream paper: 62% hue + 38% #14213a (the M0 board's mix). */
export const ATTRIBUTE_INK: Record<Attribute, string> = {
  intellect: '#4C759E',
  psyche: '#755990',
  physique: '#8E523B',
  motorics: '#94854E',
};

export interface Skill { name: Text; attribute: Attribute; value: number }

export const SKILLS: Record<SkillId, Skill> = {
  logic: { name: { zh: '逻辑', en: 'LOGIC' }, attribute: 'intellect', value: 4 },
  encyclopedia: { name: { zh: '博学多闻', en: 'ENCYCLOPEDIA' }, attribute: 'intellect', value: 2 },
  visualCalculus: { name: { zh: '视觉计算', en: 'VISUAL CALCULUS' }, attribute: 'intellect', value: 3 },
  inlandEmpire: { name: { zh: '内陆帝国', en: 'INLAND EMPIRE' }, attribute: 'psyche', value: 5 },
  empathy: { name: { zh: '同理心', en: 'EMPATHY' }, attribute: 'psyche', value: 3 },
  authority: { name: { zh: '权威', en: 'AUTHORITY' }, attribute: 'psyche', value: 2 },
  perception: { name: { zh: '感知', en: 'PERCEPTION' }, attribute: 'motorics', value: 2 },
};

export const DIFFICULTY: Record<number, Text> = {
  6: { zh: '琐碎', en: 'TRIVIAL' },
  8: { zh: '简单', en: 'EASY' },
  10: { zh: '中等', en: 'MEDIUM' },
  12: { zh: '挑战', en: 'CHALLENGING' },
  13: { zh: '艰难', en: 'FORMIDABLE' },
  14: { zh: '传奇', en: 'LEGENDARY' },
  15: { zh: '英雄', en: 'HEROIC' },
  16: { zh: '神圣', en: 'GODLY' },
  18: { zh: '不可能', en: 'IMPOSSIBLE' },
};

export const SPEAKERS = {
  kask: { zh: '卡斯克警督', en: 'LIEUTENANT KASK' },
} satisfies Record<string, Text>;

export const RESULT: Record<'success' | 'failure', Text> = {
  success: { zh: '成功', en: 'SUCCESS' },
  failure: { zh: '失败', en: 'FAILURE' },
};
