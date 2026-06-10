// Multilingual D&D 5e class features and racial traits.
// Keys are Spanish DB values (character.class / baseRace stored in Spanish).

export type ClassFeature = { name: string; desc: string };
export type ClassFeaturesMap = Record<string, ClassFeature[]>;
export type RaceTraitsMap   = Record<string, string[]>;

// ─── Class Features EN ─────────────────────────────────────────

export const CLASS_FEATURES_EN: ClassFeaturesMap = {
  "Guerrero": [
    { name: "Fighting Style",   desc: "Choose Archery, Defense, Dueling, Great Weapon Fighting, or Two-Weapon Fighting." },
    { name: "Second Wind",      desc: "Bonus action: regain 1d10 + level HP once between rests." },
  ],
  "Mago": [
    { name: "Spellcasting",     desc: "Cast spells using INT. Spell save DC = 8 + INT mod + proficiency bonus." },
    { name: "Arcane Recovery",  desc: "Recover spell slots on a short rest (total slot levels ≤ ½ wizard level)." },
  ],
  "Clérigo": [
    { name: "Spellcasting",     desc: "Cast divine spells using WIS. Spell save DC = 8 + WIS mod + proficiency bonus." },
    { name: "Divine Domain",    desc: "Choose a domain granting bonus spells and special domain features." },
  ],
  "Pícaro": [
    { name: "Expertise (×2)",      desc: "Double your proficiency bonus for two chosen skills." },
    { name: "Sneak Attack 1d6",    desc: "Deal extra 1d6 damage when you have advantage or an ally is adjacent to your target." },
    { name: "Thieves' Cant",       desc: "A secret language of the criminal underworld understood only by other rogues." },
  ],
  "Bárbaro": [
    { name: "Rage (2/long rest)",  desc: "Advantage on STR checks, +2 melee damage, and resistance to physical damage for 1 min." },
    { name: "Unarmored Defense",   desc: "Without armor: AC = 10 + DEX mod + CON mod." },
  ],
  "Bardo": [
    { name: "Spellcasting",              desc: "Cast spells using CHA. You know 2 cantrips and 2 level 1 spells." },
    { name: "Bardic Inspiration (d6)",   desc: "Grant a d6 to an ally to add to a roll. Uses = CHA mod per long rest." },
  ],
  "Druida": [
    { name: "Druidic",          desc: "You know the secret language of druids, understood only by other druids." },
    { name: "Spellcasting",     desc: "Use WIS to prepare and cast druid spells each day." },
  ],
  "Monje": [
    { name: "Unarmored Defense", desc: "Without armor or shield: AC = 10 + DEX mod + WIS mod." },
    { name: "Martial Arts",      desc: "Use DEX instead of STR for monk weapons. Unarmed damage: 1d4. Bonus unarmed strike." },
  ],
  "Paladín": [
    { name: "Divine Sense",    desc: "Detect celestials, fiends, or undead within 60 ft. Uses = 1 + CHA mod per long rest." },
    { name: "Lay on Hands",    desc: "Restore HP by touch. Pool = 5 × level HP. Cure diseases (costs 5 HP from pool)." },
  ],
  "Explorador": [
    { name: "Favored Enemy",    desc: "Advantage on Survival checks to track your chosen enemy type." },
    { name: "Natural Explorer", desc: "In your favored terrain you can't get lost and forage twice as efficiently." },
  ],
  "Hechicero": [
    { name: "Spellcasting",      desc: "Cast spells using CHA. You know 4 cantrips and 2 level 1 spells." },
    { name: "Sorcerous Origin",  desc: "Draconic Bloodline or Wild Magic: grants bonus spells and a sorcerous trait." },
  ],
  "Brujo": [
    { name: "Otherworldly Patron", desc: "Choose a patron (Archfey, Fiend, or Great Old One) granting spells and a trait." },
    { name: "Pact Magic",          desc: "Cast spells using CHA. All spell slots recover on a short rest." },
  ],
};

// ─── Class Features PT ─────────────────────────────────────────

export const CLASS_FEATURES_PT: ClassFeaturesMap = {
  "Guerrero": [
    { name: "Estilo de Combate",  desc: "Escolha Arqueria, Defesa, Duelo, Arma de Duas Mãos ou Combate com Duas Armas." },
    { name: "Recuperação",        desc: "Ação bônus: recupera 1d10 + nível em PV uma vez entre descansos." },
  ],
  "Mago": [
    { name: "Conjuração de Magias", desc: "Conjura magias usando INT. CD = 8 + mod INT + bônus de competência." },
    { name: "Recuperação Arcana",   desc: "Recupera espaços de magia em descanso curto (total ≤ ½ nível de mago)." },
  ],
  "Clérigo": [
    { name: "Conjuração de Magias", desc: "Conjura magias divinas usando SAB. CD = 8 + mod SAB + bônus de competência." },
    { name: "Domínio Divino",       desc: "Escolha um domínio que concede magias adicionais e poderes especiais." },
  ],
  "Pícaro": [
    { name: "Perícia (×2)",         desc: "Dobra o bônus de competência em duas habilidades escolhidas." },
    { name: "Ataque Furtivo 1d6",   desc: "Dano extra de 1d6 quando você tem vantagem ou um aliado está adjacente ao alvo." },
    { name: "Calão dos Ladrões",    desc: "Linguagem secreta do submundo compreendida apenas por outros ladinos." },
  ],
  "Bárbaro": [
    { name: "Fúria (2/desc. longo)",  desc: "Vantagem em FOR, +2 dano corpo a corpo e resistência a dano físico por 1 min." },
    { name: "Defesa sem Armadura",    desc: "Sem armadura: CA = 10 + mod DES + mod CON." },
  ],
  "Bardo": [
    { name: "Conjuração de Magias",    desc: "Conjura magias usando CAR. Você conhece 2 truques e 2 magias de nível 1." },
    { name: "Inspiração Bárdica (d6)", desc: "Concede um d6 a um aliado para adicionar a uma jogada. Usos = mod CAR por descanso longo." },
  ],
  "Druida": [
    { name: "Língua Druídica",      desc: "Você conhece a linguagem secreta dos druidas, compreendida apenas por outros druidas." },
    { name: "Conjuração de Magias", desc: "Use SAB para preparar e conjurar magias de druida a cada dia." },
  ],
  "Monje": [
    { name: "Defesa sem Armadura", desc: "Sem armadura ou escudo: CA = 10 + mod DES + mod SAB." },
    { name: "Artes Marciais",      desc: "Use DES em vez de FOR com armas de monge. Dano desarmado: 1d4. Ataque desarmado bônus." },
  ],
  "Paladín": [
    { name: "Sentido Divino",      desc: "Detecta celestiais, demônios ou mortos-vivos em 18 m. Usos = 1 + mod CAR por descanso longo." },
    { name: "Imposição de Mãos",   desc: "Restaura PV com o toque. Reserva = 5 × nível PV. Cura doenças (custa 5 PV)." },
  ],
  "Explorador": [
    { name: "Inimigo Predileto",   desc: "Vantagem em Sobrevivência para rastrear o tipo de inimigo escolhido." },
    { name: "Explorador Natural",  desc: "Em seu terreno favorito você não se perde e forrageia o dobro do normal." },
  ],
  "Hechicero": [
    { name: "Conjuração de Magias", desc: "Conjura magias usando CAR. Você conhece 4 truques e 2 magias de nível 1." },
    { name: "Origem Feiticeira",    desc: "Linhagem Dracônica ou Magia Selvagem: concede magias bônus e um traço feiticeiro." },
  ],
  "Brujo": [
    { name: "Patrono Sobrenatural", desc: "Escolha um patrono (Arquifada, Demônio ou Grande Ancião) concedendo magias e um traço." },
    { name: "Magia do Pacto",       desc: "Conjura magias usando CAR. Todos os espaços de magia se recuperam em descanso curto." },
  ],
};

// ─── Racial Traits EN ──────────────────────────────────────────

export const RACE_TRAITS_EN: RaceTraitsMap = {
  "Humano":    ["+1 to all ability scores", "Additional language of choice"],
  "Elfo":      ["Darkvision (60 ft)", "Fey Ancestry — advantage vs. charm, immune to magic sleep", "Keen Senses — Perception proficiency", "Trance — meditates 4 h instead of sleeping"],
  "Enano":     ["Darkvision (60 ft)", "Poison Resistance", "Battleaxe & warhammer proficiency", "Artisan tool proficiency"],
  "Mediano":   ["Lucky — reroll natural 1s on attacks, checks, and saves", "Brave — advantage against the frightened condition", "Halfling Nimbleness — move through spaces of larger creatures"],
  "Dracónido": ["Breath Weapon (1d10, DC 8 + CON mod + proficiency)", "Damage Resistance matching draconic ancestor", "Draconic language"],
  "Gnomo":     ["Darkvision (60 ft)", "Gnome Cunning — advantage on INT, WIS, and CHA saves against magic"],
  "Semielfo":  ["Darkvision (60 ft)", "Fey Ancestry — advantage vs. charm, immune to magic sleep", "Skill Versatility — proficiency in 2 skills of choice"],
  "Semiorco":  ["Darkvision (60 ft)", "Relentless Endurance — drop to 1 HP instead of 0 (1/long rest)", "Savage Attacks — critical hits roll one extra damage die", "Intimidation proficiency"],
  "Tiefling":  ["Darkvision (60 ft)", "Hellish Resistance — resistance to fire damage", "Infernal Legacy: Thaumaturgy + Hellish Rebuke + Darkness"],
};

// ─── Racial Traits PT ──────────────────────────────────────────

export const RACE_TRAITS_PT: RaceTraitsMap = {
  "Humano":    ["+1 em todos os atributos", "Idioma adicional à escolha"],
  "Elfo":      ["Visão no Escuro (18 m)", "Ancestralidade Feérica — vantagem vs. encanto, imune a sono mágico", "Sentidos Aguçados — competência em Percepção", "Transe — medita 4 h em vez de dormir"],
  "Enano":     ["Visão no Escuro (18 m)", "Resistência a Veneno", "Competência com machado de batalha e martelo de guerra", "Ferramentas de artesão"],
  "Mediano":   ["Sortudo — relança 1s naturais em ataques, testes e salvamentos", "Corajoso — vantagem contra a condição amedrontado", "Agilidade do Halfling — move-se por espaços de criaturas maiores"],
  "Dracónido": ["Arma de Sopro (1d10, CD 8 + mod CON + competência)", "Resistência a dano conforme o ancestral dracônico", "Idioma dracônico"],
  "Gnomo":     ["Visão no Escuro (18 m)", "Astúcia Gnômica — vantagem em salvamentos de INT, SAB e CAR contra magia"],
  "Semielfo":  ["Visão no Escuro (18 m)", "Ancestralidade Feérica — vantagem vs. encanto, imune a sono mágico", "Versatilidade de Habilidades — competência em 2 habilidades à escolha"],
  "Semiorco":  ["Visão no Escuro (18 m)", "Resistência Implacável — fica com 1 PV em vez de cair a 0 (1/desc. longo)", "Ataques Selvagens — acertos críticos jogam um dado de dano extra", "Competência em Intimidação"],
  "Tiefling":  ["Visão no Escuro (18 m)", "Resistência Infernal — resistência a dano de fogo", "Legado Infernal: Taumaturgia + Represália Infernal + Escuridão"],
};

// ─── Helpers ───────────────────────────────────────────────────

export function getClassFeatures(lang: string, cls: string): ClassFeature[] {
  if (lang === "en") return CLASS_FEATURES_EN[cls] ?? [];
  if (lang === "pt") return CLASS_FEATURES_PT[cls] ?? [];
  return [];
}

export function getRaceTraits(lang: string, race: string): string[] {
  if (lang === "en") return RACE_TRAITS_EN[race] ?? [];
  if (lang === "pt") return RACE_TRAITS_PT[race] ?? [];
  return [];
}
