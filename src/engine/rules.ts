// The check rules (docs/design.md §5.2), as in the original:
// active checks roll 2d6 + skill + modifiers against the difficulty; 2 always fails and
// 12 always succeeds. Passive checks do not roll: 6 + skill ≥ difficulty.
import type { Condition, Modifier, SkillId, Story } from '../content/schema';
import type { AppliedModifier } from './types';

export function passiveFires(skill: number, dc: number): boolean {
  return 6 + skill >= dc;
}

/** Whether a roll succeeds, and whether it was a critical. */
export function resolveRoll(dice: [number, number], bonus: number, dc: number): { success: boolean; crit: 'snake' | 'boxcars' | null } {
  const sum = dice[0] + dice[1];
  if (sum === 2) return { success: false, crit: 'snake' };
  if (sum === 12) return { success: true, crit: 'boxcars' };
  return { success: sum + bonus >= dc, crit: null };
}

/** Chance (0–1) that 2d6 + bonus ≥ dc, with the 2/12 rules. */
export function chance(bonus: number, dc: number): number {
  let wins = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (resolveRoll([a, b], bonus, dc).success) wins++;
  return wins / 36;
}

/** The modifiers that apply while their flags are set. */
export function applicableModifiers(mods: Modifier[] | undefined, flags: ReadonlySet<string>): AppliedModifier[] {
  return (mods ?? []).filter((m) => flags.has(m.flag)).map((m) => ({ label: m.label, value: m.value }));
}

export interface ConditionState {
  flags: ReadonlySet<string>;
  morale: number;
  sheet: Readonly<Record<SkillId, number>>;
}

export function evidenceCount(story: Story, flags: ReadonlySet<string>): number {
  return story.evidence.filter((f) => flags.has(f)).length;
}

export function holds(c: Condition | undefined, s: ConditionState, story: Story): boolean {
  if (!c) return true;
  if (c.flags && !c.flags.every((f) => s.flags.has(f))) return false;
  if (c.notFlags && c.notFlags.some((f) => s.flags.has(f))) return false;
  if (c.minEvidence !== undefined && evidenceCount(story, s.flags) < c.minEvidence) return false;
  if (c.minMorale !== undefined && s.morale < c.minMorale) return false;
  if (c.skillAtLeast) {
    for (const [k, v] of Object.entries(c.skillAtLeast) as [SkillId, number][]) if (s.sheet[k] < v) return false;
  }
  return true;
}
