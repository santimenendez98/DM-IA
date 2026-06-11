import type { Character } from "@/types/character";

export function rawMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function statMod(score: number): string {
  const m = rawMod(score);
  return m >= 0 ? `+${m}` : `${m}`;
}

export function fmtBonus(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function profBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}

export function calculateAC(character: Character): number {
  const dex = rawMod(character.stats.dexterity);
  const con = rawMod(character.stats.constitution);
  const wis = rawMod(character.stats.wisdom);
  const names = character.items.map((i) => i.name.toLowerCase());
  const has = (kw: string) => names.some((n) => n.includes(kw.toLowerCase()));
  const shield = has("escudo") ? 2 : 0;
  if (has("cota de malla"))          return 16 + shield;
  if (has("armadura de placas"))     return 18 + shield;
  if (has("cota de escamas"))        return 14 + Math.min(dex, 2) + shield;
  if (has("cuero tachonado"))        return 12 + dex + shield;
  if (has("armadura de cuero"))      return 11 + dex + shield;
  if (character.class === "Bárbaro") return 10 + dex + con;
  if (character.class === "Monje")   return 10 + dex + wis;
  return 10 + dex + shield;
}
