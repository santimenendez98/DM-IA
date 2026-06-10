// i18n for character-creation data (races, classes, backgrounds, alignments).
// Keys are the Spanish `id` fields from the in-component data arrays.

// ── Types ──────────────────────────────────────────────────────

export type RaceI18n = {
  name: string; desc: string; traits: string[];
  subraces?: Record<string, { name: string; trait: string }>;
};
export type ClassI18n = {
  name: string; role: string; desc: string;
  primaryStat: string; savingThrows: string[]; armorProf: string;
};
export type BgI18n = {
  name: string; desc: string; toolOrLang: string;
  feature: { name: string; desc: string };
};
export type AlignI18n = { label: string; desc: string };

// ── Races ──────────────────────────────────────────────────────

const RACES_EN: Record<string, RaceI18n> = {
  human:      { name: "Human",      desc: "Versatile and ambitious. +1 to all stats.", traits: ["Additional language of choice"] },
  elf:        { name: "Elf",        desc: "Agile and intuitive. +2 DEX. Darkvision.",
    traits: ["Darkvision (60 ft)", "Fey Ancestry", "Keen Senses (Perception)", "Trance (meditates instead of sleeping)"],
    subraces: {
      "high-elf":  { name: "High Elf",   trait: "+1 INT · One wizard cantrip · Extra language" },
      "wood-elf":  { name: "Wood Elf",   trait: "+1 WIS · Speed 35 ft · Hide in foliage" },
    },
  },
  dwarf:      { name: "Dwarf",      desc: "Resilient and hardworking. +2 CON. Darkvision.",
    traits: ["Darkvision (60 ft)", "Poison resistance", "Axe & warhammer training", "Artisan tool proficiency"],
    subraces: {
      "hill-dwarf":     { name: "Hill Dwarf",     trait: "+1 WIS · +1 HP per level" },
      "mountain-dwarf": { name: "Mountain Dwarf", trait: "+2 STR · Light and medium armor" },
    },
  },
  halfling:   { name: "Halfling",   desc: "Lucky and brave. +2 DEX. Never fails on a natural 1.",
    traits: ["Lucky (reroll natural 1s)", "Brave (advantage vs. fear)", "Halfling Nimbleness"],
    subraces: {
      "lightfoot": { name: "Lightfoot", trait: "+1 CHA · Hide behind larger creatures" },
      "stout":     { name: "Stout",     trait: "+1 CON · Poison resistance" },
    },
  },
  dragonborn: { name: "Dragonborn", desc: "Draconic lineage. +2 STR, +1 CHA. Breath weapon.",
    traits: ["Breath weapon (1d10, DC 8 + CON mod)", "Damage resistance by draconic ancestry", "Draconic language"],
  },
  gnome:      { name: "Gnome",      desc: "Ingenious and inventive. +2 INT. Gnome Cunning.",
    traits: ["Darkvision (60 ft)", "Gnome Cunning — advantage on INT/WIS/CHA magic saves"],
    subraces: {
      "forest-gnome": { name: "Forest Gnome",  trait: "+1 DEX · Speak with small beasts · Minor Illusion cantrip" },
      "rock-gnome":   { name: "Rock Gnome",    trait: "+1 CON · Artisan tools · Knowledge of gadgets" },
    },
  },
  "half-elf": { name: "Half-Elf",   desc: "Fey and human heritage. +2 CHA, +1 to two stats.",
    traits: ["Darkvision (60 ft)", "Fey Ancestry", "Skill Versatility — proficiency in 2 skills of choice"],
  },
  "half-orc": { name: "Half-Orc",   desc: "Strength and tenacity. +2 STR, +1 CON.",
    traits: ["Darkvision (60 ft)", "Relentless Endurance — drop to 1 HP instead of 0 (1/long rest)", "Savage Attacks — extra damage die on crits", "Intimidation proficiency"],
  },
  tiefling:   { name: "Tiefling",   desc: "Infernal blood. +2 CHA, +1 INT. Dark innate magic.",
    traits: ["Darkvision (60 ft)", "Hellish Resistance (fire damage resistance)", "Infernal Legacy: Thaumaturgy + Hellish Rebuke + Darkness"],
  },
};

const RACES_PT: Record<string, RaceI18n> = {
  human:      { name: "Humano",    desc: "Versátil e ambicioso. +1 em todos os atributos.", traits: ["Idioma adicional à escolha"] },
  elf:        { name: "Elfo",      desc: "Ágil e intuitivo. +2 DES. Visão no escuro.",
    traits: ["Visão no escuro (18 m)", "Ancestralidade feérica", "Sentidos aguçados (Percepção)", "Transe (medita em vez de dormir)"],
    subraces: {
      "high-elf":  { name: "Alto Elfo",        trait: "+1 INT · Um truque de mago · Idioma extra" },
      "wood-elf":  { name: "Elfo da Floresta",  trait: "+1 SAB · Vel. 35 ft · Esconder-se na folhagem" },
    },
  },
  dwarf:      { name: "Anão",      desc: "Resistente e trabalhador. +2 CON. Visão no escuro.",
    traits: ["Visão no escuro (18 m)", "Resistência a veneno", "Treinamento com machado e martelo de guerra", "Proficiência com ferramentas de artesão"],
    subraces: {
      "hill-dwarf":     { name: "Anão das Colinas",  trait: "+1 SAB · +1 PV por nível" },
      "mountain-dwarf": { name: "Anão da Montanha",  trait: "+2 FOR · Armadura leve e média" },
    },
  },
  halfling:   { name: "Halfling",  desc: "Sortudo e corajoso. +2 DES. Nunca falha com 1 natural.",
    traits: ["Sortudo (relança 1s naturais)", "Corajoso (vantagem contra medo)", "Agilidade do Halfling"],
    subraces: {
      "lightfoot": { name: "Pés Leves",  trait: "+1 CAR · Esconder-se atrás de criaturas maiores" },
      "stout":     { name: "Robusto",    trait: "+1 CON · Resistência a veneno" },
    },
  },
  dragonborn: { name: "Draconato", desc: "Linhagem dracônica. +2 FOR, +1 CAR. Arma de sopro.",
    traits: ["Arma de sopro (1d10, CD 8 + mod CON)", "Resistência a dano conforme ancestral dracônico", "Idioma dracônico"],
  },
  gnome:      { name: "Gnomo",     desc: "Engenhoso e inventivo. +2 INT. Astúcia gnômica.",
    traits: ["Visão no escuro (18 m)", "Astúcia Gnômica — vantagem em salvamentos mágicos de INT/SAB/CAR"],
    subraces: {
      "forest-gnome": { name: "Gnomo da Floresta",  trait: "+1 DES · Falar com animais pequenos · Truque Ilusão Menor" },
      "rock-gnome":   { name: "Gnomo das Rochas",   trait: "+1 CON · Ferramentas de artesão · Conhecimento de engenhocas" },
    },
  },
  "half-elf": { name: "Meio-Elfo", desc: "Herança feérica e humana. +2 CAR, +1 em dois atributos.",
    traits: ["Visão no escuro (18 m)", "Ancestralidade feérica", "Versatilidade de habilidades — proficiência em 2 habilidades à escolha"],
  },
  "half-orc": { name: "Meio-Orc",  desc: "Força e tenacidade. +2 FOR, +1 CON.",
    traits: ["Visão no escuro (18 m)", "Resistência Implacável — fica com 1 PV em vez de cair a 0 (1/desc. longo)", "Ataques Selvagens — dado extra em acertos críticos", "Proficiência em Intimidação"],
  },
  tiefling:   { name: "Tiefling",  desc: "Sangue infernal. +2 CAR, +1 INT. Magia inata sombria.",
    traits: ["Visão no escuro (18 m)", "Resistência Infernal (resistência a fogo)", "Legado Infernal: Taumaturgia + Represália Infernal + Escuridão"],
  },
};

// ── Classes ────────────────────────────────────────────────────

const CLASSES_EN: Record<string, ClassI18n> = {
  fighter:   { name: "Fighter",   role: "Tank / DPS",              desc: "Master of combat",                       primaryStat: "STR or DEX",  savingThrows: ["Strength", "Constitution"],   armorProf: "All armor and shields" },
  wizard:    { name: "Wizard",    role: "Spellcaster",             desc: "Arcane power and intelligence",          primaryStat: "INT",          savingThrows: ["Intelligence", "Wisdom"],      armorProf: "None" },
  cleric:    { name: "Cleric",    role: "Support / Healer",        desc: "Divine power and healing",              primaryStat: "WIS",          savingThrows: ["Wisdom", "Charisma"],          armorProf: "Light, medium, and shields" },
  rogue:     { name: "Rogue",     role: "Stealth / DPS",           desc: "Stealth, deception and precision",      primaryStat: "DEX",          savingThrows: ["Dexterity", "Intelligence"],   armorProf: "Light armor" },
  barbarian: { name: "Barbarian", role: "Melee / Tank",            desc: "Savage fury and pure instinct",         primaryStat: "STR",          savingThrows: ["Strength", "Constitution"],   armorProf: "Light, medium, and shields" },
  bard:      { name: "Bard",      role: "Versatile / Support",     desc: "Magic, music and social wit",           primaryStat: "CHA",          savingThrows: ["Dexterity", "Charisma"],       armorProf: "Light armor" },
  druid:     { name: "Druid",     role: "Spellcaster / Support",   desc: "Nature guardian and its magic",         primaryStat: "WIS",          savingThrows: ["Intelligence", "Wisdom"],      armorProf: "Light and medium (non-metal), non-metal shields" },
  monk:      { name: "Monk",      role: "Agile / DPS",             desc: "Martial discipline and ki power",       primaryStat: "DEX / WIS",    savingThrows: ["Strength", "Dexterity"],       armorProf: "None" },
  paladin:   { name: "Paladin",   role: "Tank / Support",          desc: "Sacred oath and divine power",          primaryStat: "STR / CHA",    savingThrows: ["Wisdom", "Charisma"],          armorProf: "All armor and shields" },
  ranger:    { name: "Ranger",    role: "DPS / Exploration",       desc: "Tracker and archer of the wilds",       primaryStat: "DEX",          savingThrows: ["Strength", "Dexterity"],       armorProf: "Light, medium, and shields" },
  sorcerer:  { name: "Sorcerer",  role: "Spellcaster / DPS",       desc: "Innate magic that flows in the blood",  primaryStat: "CHA",          savingThrows: ["Constitution", "Charisma"],    armorProf: "None" },
  warlock:   { name: "Warlock",   role: "Spellcaster / DPS",       desc: "Power from a pact with an entity",      primaryStat: "CHA",          savingThrows: ["Wisdom", "Charisma"],          armorProf: "Light armor" },
};

const CLASSES_PT: Record<string, ClassI18n> = {
  fighter:   { name: "Guerreiro",   role: "Tanque / DPS",             desc: "Mestre do combate",                           primaryStat: "FOR ou DES",  savingThrows: ["Força", "Constituição"],         armorProf: "Toda armadura e escudos" },
  wizard:    { name: "Mago",        role: "Conjurador de feitiços",   desc: "Poder arcano e inteligência",                 primaryStat: "INT",          savingThrows: ["Inteligência", "Sabedoria"],     armorProf: "Nenhuma" },
  cleric:    { name: "Clérigo",     role: "Suporte / Curandeiro",     desc: "Poder divino e cura",                         primaryStat: "SAB",          savingThrows: ["Sabedoria", "Carisma"],          armorProf: "Armadura leve, média e escudos" },
  rogue:     { name: "Ladino",      role: "Furtivo / DPS",            desc: "Furtividade, engano e precisão",              primaryStat: "DES",          savingThrows: ["Destreza", "Inteligência"],      armorProf: "Armadura leve" },
  barbarian: { name: "Bárbaro",     role: "Corpo a corpo / Tanque",   desc: "Fúria selvagem e instinto puro",              primaryStat: "FOR",          savingThrows: ["Força", "Constituição"],         armorProf: "Armadura leve, média e escudos" },
  bard:      { name: "Bardo",       role: "Versátil / Suporte",       desc: "Magia, música e engenho social",              primaryStat: "CAR",          savingThrows: ["Destreza", "Carisma"],           armorProf: "Armadura leve" },
  druid:     { name: "Druida",      role: "Conjurador / Suporte",     desc: "Guardião da natureza e suas magias",          primaryStat: "SAB",          savingThrows: ["Inteligência", "Sabedoria"],     armorProf: "Armadura leve e média (não metálica), escudos não metálicos" },
  monk:      { name: "Monge",       role: "Ágil / DPS",               desc: "Disciplina marcial e poder do ki",            primaryStat: "DES / SAB",    savingThrows: ["Força", "Destreza"],             armorProf: "Nenhuma" },
  paladin:   { name: "Paladino",    role: "Tanque / Suporte",         desc: "Juramento sagrado e poder divino",            primaryStat: "FOR / CAR",    savingThrows: ["Sabedoria", "Carisma"],          armorProf: "Toda armadura e escudos" },
  ranger:    { name: "Patrulheiro", role: "DPS / Exploração",         desc: "Rastreador e arqueiro do ermo",               primaryStat: "DES",          savingThrows: ["Força", "Destreza"],             armorProf: "Armadura leve, média e escudos" },
  sorcerer:  { name: "Feiticeiro",  role: "Conjurador / DPS",         desc: "Magia inata que flui no sangue",              primaryStat: "CAR",          savingThrows: ["Constituição", "Carisma"],       armorProf: "Nenhuma" },
  warlock:   { name: "Bruxo",       role: "Conjurador / DPS",         desc: "Poder de um pacto com uma entidade",          primaryStat: "CAR",          savingThrows: ["Sabedoria", "Carisma"],          armorProf: "Armadura leve" },
};

// ── Equipment choice labels ─────────────────────────────────────

const EQUIP_LABELS_EN: Record<string, string> = {
  "Armadura":           "Armor",
  "Arma principal":     "Main weapon",
  "Arma de mano":       "One-handed weapon",
  "Arma y protección":  "Weapon and shield",
  "Instrumento musical":"Musical instrument",
  "Arma":              "Weapon",
  "Mochila":           "Pack",
  "Arma y escudo":     "Weapon and shield",
  "Armas de mano":     "One-handed weapons",
  "Arma ligera":       "Light weapon",
  "Foco mágico":       "Arcane focus",
};

const EQUIP_LABELS_PT: Record<string, string> = {
  "Armadura":           "Armadura",
  "Arma principal":     "Arma principal",
  "Arma de mano":       "Arma de mão",
  "Arma y protección":  "Arma e escudo",
  "Instrumento musical":"Instrumento musical",
  "Arma":              "Arma",
  "Mochila":           "Mochila",
  "Arma y escudo":     "Arma e escudo",
  "Armas de mano":     "Armas de mão",
  "Arma ligera":       "Arma leve",
  "Foco mágico":       "Foco mágico",
};

// ── Backgrounds ────────────────────────────────────────────────

const BACKGROUNDS_EN: Record<string, BgI18n> = {
  acolyte:       { name: "Acolyte",        desc: "Servant of a temple and its gods",              toolOrLang: "2 languages of choice",           feature: { name: "Shelter of the Faithful",    desc: "Temples offer you lodging and food in exchange for small services." } },
  criminal:      { name: "Criminal",       desc: "Life on the wrong side of the law",             toolOrLang: "Gaming set + thieves' tools",      feature: { name: "Criminal Contact",           desc: "You have an underworld contact who can pass information or jobs." } },
  "folk-hero":   { name: "Folk Hero",      desc: "Defender of common folk",                       toolOrLang: "Artisan tools + land vehicles",    feature: { name: "Rustic Hospitality",         desc: "Common folk will hide and protect you without risking their lives." } },
  noble:         { name: "Noble",          desc: "Born into nobility and privilege",               toolOrLang: "Gaming set + 1 language",          feature: { name: "Position of Privilege",      desc: "People assume you have a right to be where you are. Access to high society." } },
  sage:          { name: "Sage",           desc: "Scholar of the arcane and history",             toolOrLang: "2 languages of choice",            feature: { name: "Researcher",                 desc: "If you don't know something, you know where and who to ask to get the answer." } },
  soldier:       { name: "Soldier",        desc: "Veteran of military life",                      toolOrLang: "Gaming set + land vehicles",       feature: { name: "Military Rank",              desc: "Soldiers from your former organization recognize your authority." } },
  charlatan:     { name: "Charlatan",      desc: "Master of deception and false identities",      toolOrLang: "Disguise kit + forgery kit",        feature: { name: "False Identity",             desc: "You have one or more fictitious identities with forged documents." } },
  entertainer:   { name: "Entertainer",   desc: "Musician, actor or acrobat who lives for audiences", toolOrLang: "Disguise kit + musical instrument", feature: { name: "By Popular Demand",      desc: "Wherever you perform you can secure free lodging and food in exchange for performing." } },
  "guild-artisan":{ name: "Guild Artisan", desc: "Member of a craftsman guild",                   toolOrLang: "Artisan tools (of choice)",        feature: { name: "Guild Membership",           desc: "Your guild provides lodging and support. In return you pay dues and help members." } },
  hermit:        { name: "Hermit",         desc: "Years of solitude and contemplation",           toolOrLang: "Herbalism kit",                    feature: { name: "Discovery",                  desc: "Your seclusion let you uncover a unique truth about the cosmos, gods, or world forces." } },
  outlander:     { name: "Outlander",      desc: "Raised at the fringes of civilization",         toolOrLang: "Musical instrument of choice",     feature: { name: "Wanderer",                   desc: "You can find food, water and shelter for yourself and up to 5 companions in any natural environment." } },
  sailor:        { name: "Sailor",         desc: "Veteran of the maritime routes",                toolOrLang: "Navigator's tools + water vehicles",feature: { name: "Ship's Passage",             desc: "When needed, you can secure free passage on ships for yourself and companions in exchange for work." } },
  urchin:        { name: "Urchin",         desc: "Raised in the streets of a great city",         toolOrLang: "Thieves' tools + disguise kit",    feature: { name: "City Secrets",               desc: "You know hidden passages of cities. You can move at double speed through them unseen." } },
};

const BACKGROUNDS_PT: Record<string, BgI18n> = {
  acolyte:       { name: "Acólito",            desc: "Servo de um templo e seus deuses",              toolOrLang: "2 idiomas à escolha",               feature: { name: "Abrigo dos Fiéis",          desc: "Templos oferecem hospedagem e comida em troca de pequenos serviços." } },
  criminal:      { name: "Criminoso",          desc: "Vida à margem da lei",                          toolOrLang: "Kit de jogo + ferramentas de ladrão",feature: { name: "Contato Criminal",          desc: "Você tem um contato no submundo que pode passar informações ou trabalhos." } },
  "folk-hero":   { name: "Herói do Povo",      desc: "Defensor do povo comum",                        toolOrLang: "Ferramentas de artesão + veículos terrestres", feature: { name: "Hospitalidade Rústica",  desc: "Os camponeses vão escondê-lo e protegê-lo sem arriscar suas vidas." } },
  noble:         { name: "Nobre",              desc: "Nascido na nobreza e no privilégio",             toolOrLang: "Kit de jogo + 1 idioma",             feature: { name: "Posição Privilegiada",      desc: "As pessoas assumem que você tem o direito de estar onde está. Acesso à alta sociedade." } },
  sage:          { name: "Sábio",              desc: "Estudioso dos arcanos e da história",            toolOrLang: "2 idiomas à escolha",               feature: { name: "Pesquisador",               desc: "Se não sabe algo, você sabe onde e a quem perguntar para obter a resposta." } },
  soldier:       { name: "Soldado",            desc: "Veterano da vida militar",                       toolOrLang: "Kit de jogo + veículos terrestres",  feature: { name: "Patente Militar",           desc: "Soldados da sua antiga organização reconhecem sua autoridade." } },
  charlatan:     { name: "Charlatão",          desc: "Mestre do engano e das identidades falsas",      toolOrLang: "Kit de disfarce + kit de falsificação",feature: { name: "Identidade Falsa",         desc: "Você tem uma ou mais identidades fictícias com documentos falsificados." } },
  entertainer:   { name: "Artista",            desc: "Músico, ator ou acrobata que vive do público",  toolOrLang: "Kit de disfarce + instrumento musical",feature: { name: "Por Aclamação Popular",   desc: "Onde quer que se apresente, você pode conseguir hospedagem e comida grátis em troca de sua atuação." } },
  "guild-artisan":{ name: "Artesão de Guilda", desc: "Membro de uma guilda de ofícios",               toolOrLang: "Ferramentas de artesão (à escolha)", feature: { name: "Filiação à Guilda",         desc: "Sua guilda fornece hospedagem e apoio. Em troca, você paga taxas mensais e ajuda outros membros." } },
  hermit:        { name: "Eremita",            desc: "Anos de solidão e contemplação",                toolOrLang: "Kit de herbalismo",                  feature: { name: "Descoberta",                desc: "Seu recolhimento permitiu que você fizesse uma descoberta única sobre o cosmos ou os deuses." } },
  outlander:     { name: "Forasteiro",         desc: "Criado nos limites da civilização",             toolOrLang: "Instrumento musical à escolha",      feature: { name: "Andarilho",                 desc: "Você pode encontrar comida, água e abrigo para si e até 5 companheiros em qualquer ambiente natural." } },
  sailor:        { name: "Marinheiro",         desc: "Veterano das rotas marítimas",                  toolOrLang: "Ferramentas de navegante + veículos aquáticos", feature: { name: "Passagem Segura",    desc: "Quando precisar, você consegue passagem gratuita em navios para si e companheiros em troca de trabalho." } },
  urchin:        { name: "Arteiro",            desc: "Criado nas ruas de uma grande cidade",          toolOrLang: "Ferramentas de ladrão + kit de disfarce", feature: { name: "Segredos da Cidade",  desc: "Você conhece passagens e atalhos ocultos das cidades. Pode se mover ao dobro da velocidade por elas." } },
};

// ── Alignments ─────────────────────────────────────────────────

const ALIGNMENTS_EN: Record<string, AlignI18n> = {
  lg: { label: "Lawful Good",     desc: "Does what is right according to the law" },
  ng: { label: "Neutral Good",    desc: "Helps others without restrictions" },
  cg: { label: "Chaotic Good",    desc: "Follows their conscience freely" },
  ln: { label: "Lawful Neutral",  desc: "Follows order without moral judgement" },
  tn: { label: "True Neutral",    desc: "Avoids extremes at all times" },
  cn: { label: "Chaotic Neutral", desc: "Follows their own whims" },
  le: { label: "Lawful Evil",     desc: "Takes what they want within a code" },
  ne: { label: "Neutral Evil",    desc: "Acts without compassion or code" },
  ce: { label: "Chaotic Evil",    desc: "Violence and chaos without restrictions" },
};

const ALIGNMENTS_PT: Record<string, AlignI18n> = {
  lg: { label: "Leal Bom",         desc: "Faz o que é certo segundo a lei" },
  ng: { label: "Neutro Bom",       desc: "Ajuda os outros sem restrições" },
  cg: { label: "Caótico Bom",      desc: "Segue sua consciência livremente" },
  ln: { label: "Leal Neutro",      desc: "Segue a ordem sem julgamentos morais" },
  tn: { label: "Neutro Verdadeiro",desc: "Evita os extremos sempre" },
  cn: { label: "Caótico Neutro",   desc: "Segue seus próprios caprichos" },
  le: { label: "Leal Mau",         desc: "Pega o que quer dentro de um código" },
  ne: { label: "Neutro Mau",       desc: "Age sem compaixão ou código" },
  ce: { label: "Caótico Mau",      desc: "Violência e caos sem restrições" },
};

// ── Helpers ────────────────────────────────────────────────────

export function getRaceI18n(lang: string, id: string): RaceI18n | null {
  if (lang === "en") return RACES_EN[id] ?? null;
  if (lang === "pt") return RACES_PT[id] ?? null;
  return null;
}

export function getClassI18n(lang: string, id: string): ClassI18n | null {
  if (lang === "en") return CLASSES_EN[id] ?? null;
  if (lang === "pt") return CLASSES_PT[id] ?? null;
  return null;
}

export function getEquipLabel(lang: string, esLabel: string): string {
  if (lang === "en") return EQUIP_LABELS_EN[esLabel] ?? esLabel;
  if (lang === "pt") return EQUIP_LABELS_PT[esLabel] ?? esLabel;
  return esLabel;
}

export function getBgI18n(lang: string, id: string): BgI18n | null {
  if (lang === "en") return BACKGROUNDS_EN[id] ?? null;
  if (lang === "pt") return BACKGROUNDS_PT[id] ?? null;
  return null;
}

export function getAlignI18n(lang: string, id: string): AlignI18n | null {
  if (lang === "en") return ALIGNMENTS_EN[id] ?? null;
  if (lang === "pt") return ALIGNMENTS_PT[id] ?? null;
  return null;
}
