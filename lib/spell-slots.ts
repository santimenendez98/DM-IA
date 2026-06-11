// D&D 5e spell slot tables (PHB)
// Indexed by [characterLevel - 1][spellLevel - 1] → slotCount

const FULL_CASTER: number[][] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0], // level 1
  [3, 0, 0, 0, 0, 0, 0, 0, 0], // level 2
  [4, 2, 0, 0, 0, 0, 0, 0, 0], // level 3
  [4, 3, 0, 0, 0, 0, 0, 0, 0], // level 4
  [4, 3, 2, 0, 0, 0, 0, 0, 0], // level 5
  [4, 3, 3, 0, 0, 0, 0, 0, 0], // level 6
  [4, 3, 3, 1, 0, 0, 0, 0, 0], // level 7
  [4, 3, 3, 2, 0, 0, 0, 0, 0], // level 8
  [4, 3, 3, 3, 1, 0, 0, 0, 0], // level 9
  [4, 3, 3, 3, 2, 0, 0, 0, 0], // level 10
  [4, 3, 3, 3, 2, 1, 0, 0, 0], // level 11
  [4, 3, 3, 3, 2, 1, 0, 0, 0], // level 12
  [4, 3, 3, 3, 2, 1, 1, 0, 0], // level 13
  [4, 3, 3, 3, 2, 1, 1, 0, 0], // level 14
  [4, 3, 3, 3, 2, 1, 1, 1, 0], // level 15
  [4, 3, 3, 3, 2, 1, 1, 1, 0], // level 16
  [4, 3, 3, 3, 2, 1, 1, 1, 1], // level 17
  [4, 3, 3, 3, 3, 1, 1, 1, 1], // level 18
  [4, 3, 3, 3, 3, 2, 1, 1, 1], // level 19
  [4, 3, 3, 3, 3, 2, 2, 1, 1], // level 20
];

// Half casters (Paladin, Ranger) — no slots at level 1
const HALF_CASTER: number[][] = [
  [0, 0, 0, 0, 0], // level 1
  [2, 0, 0, 0, 0], // level 2
  [3, 0, 0, 0, 0], // level 3
  [3, 0, 0, 0, 0], // level 4
  [4, 2, 0, 0, 0], // level 5
  [4, 2, 0, 0, 0], // level 6
  [4, 3, 0, 0, 0], // level 7
  [4, 3, 0, 0, 0], // level 8
  [4, 3, 2, 0, 0], // level 9
  [4, 3, 2, 0, 0], // level 10
  [4, 3, 3, 0, 0], // level 11
  [4, 3, 3, 0, 0], // level 12
  [4, 3, 3, 1, 0], // level 13
  [4, 3, 3, 1, 0], // level 14
  [4, 3, 3, 2, 0], // level 15
  [4, 3, 3, 2, 0], // level 16
  [4, 3, 3, 3, 1], // level 17
  [4, 3, 3, 3, 1], // level 18
  [4, 3, 3, 3, 2], // level 19
  [4, 3, 3, 3, 2], // level 20
];

// Warlock Pact Magic: all slots at the same level, recovered on short rest
// [charLevel - 1] → [slotCount, slotLevel]
const WARLOCK_PACT: [number, number][] = [
  [1, 1], // level 1
  [2, 1], // level 2
  [2, 2], // level 3
  [2, 2], // level 4
  [2, 3], // level 5
  [2, 3], // level 6
  [2, 4], // level 7
  [2, 4], // level 8
  [2, 5], // level 9
  [2, 5], // level 10
  [3, 5], // level 11
  [3, 5], // level 12
  [3, 5], // level 13
  [3, 5], // level 14
  [3, 5], // level 15
  [3, 5], // level 16
  [4, 5], // level 17
  [4, 5], // level 18
  [4, 5], // level 19
  [4, 5], // level 20
];

const FULL_CASTERS = new Set(["Mago", "Bardo", "Hechicero", "Clérigo", "Druida"]);
const HALF_CASTERS = new Set(["Paladín", "Explorador"]);

// spell level (as string key) → max slot count
export type SpellSlotMap = Record<string, number>;

export function getMaxSpellSlots(charClass: string, level: number): SpellSlotMap {
  const idx = Math.min(Math.max(level, 1), 20) - 1;

  if (charClass === "Brujo") {
    const [count, slotLevel] = WARLOCK_PACT[idx];
    return count > 0 ? { [slotLevel]: count } : {};
  }

  const table = FULL_CASTERS.has(charClass) ? FULL_CASTER
    : HALF_CASTERS.has(charClass) ? HALF_CASTER
    : null;

  if (!table) return {};

  const result: SpellSlotMap = {};
  table[idx].forEach((count, i) => {
    if (count > 0) result[i + 1] = count;
  });
  return result;
}

export function hasSpellSlots(charClass: string): boolean {
  return FULL_CASTERS.has(charClass) || HALF_CASTERS.has(charClass) || charClass === "Brujo";
}

export function isWarlock(charClass: string): boolean {
  return charClass === "Brujo";
}

const CLASS_HIT_DIE: Record<string, number> = {
  "Guerrero": 10, "Mago": 6, "Clérigo": 8, "Pícaro": 8,
  "Bárbaro": 12, "Bardo": 8, "Druida": 8, "Monje": 8,
  "Paladín": 10, "Explorador": 10, "Hechicero": 6, "Brujo": 8,
};

export function getHitDie(charClass: string): number {
  return CLASS_HIT_DIE[charClass] ?? 8;
}
