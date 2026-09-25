// Skills, attributes, difficulty tiers, speakers and the log's tags (docs/design.md §3.6,
// §5.1, §5.2, §6.2). Chinese names follow the official Simplified Chinese localisation.
import type { Check, Lang, Sense, SkillId, Speaker, Text } from './schema';

export type Attribute = 'intellect' | 'psyche' | 'physique' | 'motorics';

/**
 * The original's four attribute colours (§6.2): `color` is the reference value (for dark
 * backgrounds); `ink` is the same hue darkened to the same luminance (0.125) for all four,
 * so skill names printed on the cream page read with equal contrast (about 4.4 : 1).
 */
export const ATTRIBUTES: Record<Attribute, { name: Text; color: string; ink: string }> = {
  intellect: { name: { zh: '智力', en: 'Intellect' }, color: '#5CB9D6', ink: '#2F6A81' },
  psyche: { name: { zh: '精神', en: 'Psyche' }, color: '#8466CC', ink: '#6C54AA' },
  physique: { name: { zh: '体格', en: 'Physique' }, color: '#C84466', ink: '#AC3A57' },
  motorics: { name: { zh: '身手', en: 'Motorics' }, color: '#E0B43A', ink: '#7A5E1C' },
};

export interface Skill { name: Text; attribute: Attribute; value: number }

/** The nine skills of the demo, with the fixed character sheet (§5.1). */
export const SKILLS: Record<SkillId, Skill> = {
  logic: { name: { zh: '逻辑思维', en: 'Logic' }, attribute: 'intellect', value: 4 },
  encyclopedia: { name: { zh: '博学多闻', en: 'Encyclopedia' }, attribute: 'intellect', value: 2 },
  visualCalculus: { name: { zh: '见微知著', en: 'Visual Calculus' }, attribute: 'intellect', value: 3 },
  inlandEmpire: { name: { zh: '内陆帝国', en: 'Inland Empire' }, attribute: 'psyche', value: 5 },
  empathy: { name: { zh: '通情达理', en: 'Empathy' }, attribute: 'psyche', value: 3 },
  authority: { name: { zh: '争强好胜', en: 'Authority' }, attribute: 'psyche', value: 2 },
  perception: { name: { zh: '五感发达', en: 'Perception' }, attribute: 'motorics', value: 2 },
  electrochemistry: { name: { zh: '食髓知味', en: 'Electrochemistry' }, attribute: 'physique', value: 5 },
  shivers: { name: { zh: '天人感应', en: 'Shivers' }, attribute: 'physique', value: 4 },
};

export const SENSES: Record<Sense, Text> = {
  sight: { zh: '视觉', en: 'Sight' },
  smell: { zh: '嗅觉', en: 'Smell' },
  hearing: { zh: '听觉', en: 'Hearing' },
};

/** Difficulty tiers (§5.2), as the original's Chinese edition names them. */
export const DIFFICULTY: Record<number, Text> = {
  6: { zh: '极易', en: 'Trivial' },
  8: { zh: '容易', en: 'Easy' },
  10: { zh: '中等', en: 'Medium' },
  12: { zh: '挑战', en: 'Challenging' },
  13: { zh: '困难', en: 'Formidable' },
  14: { zh: '极难', en: 'Legendary' },
  15: { zh: '专家', en: 'Heroic' },
  16: { zh: '噩梦', en: 'Godly' },
  18: { zh: '炼狱', en: 'Impossible' },
};

export const RESULT: Record<'success' | 'failure', Text> = {
  success: { zh: '成功', en: 'Success' },
  failure: { zh: '失败', en: 'Failure' },
};

/** Named speakers. The Horrific Necktie is a voice, not a skill (it speaks when Inland Empire ≥ 5). */
export const SPEAKERS = {
  you: { zh: '你', en: 'You' },
  kim: { zh: '金·曷城', en: 'Kim Kitsuragi' },
  necktie: { zh: '恐怖领带', en: 'Horrific Necktie' },
} satisfies Record<string, Text>;

const isSkill = (s: Speaker): s is SkillId => typeof s === 'string' && s in SKILLS;

/** A skill's name, with Perception's sense: 五感发达（视觉）/ Perception (Sight). */
export function skillName(skill: SkillId, sense: Sense | undefined, lang: Lang): string {
  const name = SKILLS[skill].name[lang];
  if (!sense) return name;
  return lang === 'zh' ? `${name}（${SENSES[sense].zh}）` : `${name} (${SENSES[sense].en})`;
}

/** How a speaker is named in the log (EN speaker names are set in capitals by the layout). */
export function speakerName(line: { speaker: Speaker; sense?: Sense }, lang: Lang): string {
  const s = line.speaker;
  if (typeof s === 'object') return s[lang];
  if (isSkill(s)) return skillName(s, line.sense, lang);
  if (s === 'narrator') return '';
  return SPEAKERS[s][lang];
}

/** The ink a speaker's name is printed in: skills and the necktie in their attribute's colour, everyone else neutral. */
export function speakerInk(s: Speaker, neutral: string): string {
  if (isSkill(s)) return ATTRIBUTES[SKILLS[s].attribute].ink;
  if (s === 'necktie') return ATTRIBUTES.psyche.ink;
  return neutral;
}

/** The result tag after a voice's name: [极易：成功] / [Trivial: Success]. */
export function resultTag(result: { dc: number; success: boolean }, lang: Lang): string {
  const tier = DIFFICULTY[result.dc][lang], word = RESULT[result.success ? 'success' : 'failure'][lang];
  return lang === 'zh' ? `[${tier}：${word}]` : `[${tier}: ${word}]`;
}

/** A check's tag, on options and on the dice line: [见微知著 - 中等 10] / [Visual Calculus - Medium 10]. */
export function checkTag(check: Check, lang: Lang): { open: string; skill: string; rest: string } {
  return { open: '[', skill: skillName(check.skill, check.sense, lang), rest: ` - ${DIFFICULTY[check.dc][lang]} ${check.dc}]` };
}
