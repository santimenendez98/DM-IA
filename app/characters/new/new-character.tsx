"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import { loader } from "@/lib/loader";
import { FieldError } from "@/components/FieldError";
import { cx } from "@/components/cx";
import type { CharacterStats } from "@/types/character";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/translations";
import { getRaceI18n, getClassI18n, getEquipLabel, getBgI18n, getAlignI18n } from "@/lib/new-character-i18n";
import { getClassFeatures } from "@/lib/dnd-i18n";
import { translateItem } from "@/lib/equipment-i18n";
import s from "./new-character.module.css";
import { rawMod as mod, statMod as modStr } from "@/lib/dnd-utils";

// ── D&D Data ───────────────────────────────────────────────────

type RaceData = {
  id: string; name: string; desc: string; speed: number;
  bonuses: Partial<CharacterStats>; traits: string[]; icon: React.ReactElement;
  subraces?: { id: string; name: string; bonus: Partial<CharacterStats>; trait: string }[];
};

const RACES: RaceData[] = [
  {
    id: "human", name: "Humano", desc: "Versátil y ambicioso. +1 a todos los atributos.",
    speed: 30,
    bonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
    traits: ["Idioma adicional a elección"],
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="10" r="5" fill="none" stroke="#b8860b" strokeWidth="1.6"/>
        <path d="M5 30c0-6 4.9-11 11-11s11 5 11 11" fill="none" stroke="#b8860b" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "elf", name: "Elfo", desc: "Ágil e intuitivo. +2 DES. Visión en la oscuridad.",
    speed: 30,
    bonuses: { dexterity: 2 },
    traits: ["Visión en la oscuridad (18 m)", "Resistencia feérica", "Sentidos agudos (Percepción)", "Trance (medita en lugar de dormir)"],
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="10" r="5" fill="none" stroke="#b8860b" strokeWidth="1.6"/>
        <path d="M5 30c0-6 4.9-11 11-11s11 5 11 11" fill="none" stroke="#b8860b" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M9 8 Q16 4 23 8" fill="none" stroke="#e8c040" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
    ),
    subraces: [
      { id: "high-elf",  name: "Alto Elfo",   bonus: { intelligence: 1 }, trait: "+1 INT · Un truco de mago · Idioma extra" },
      { id: "wood-elf",  name: "Elfo del Bosque", bonus: { wisdom: 1 },   trait: "+1 SAB · Vel. 35 ft · Ocultarse entre follaje" },
    ],
  },
  {
    id: "dwarf", name: "Enano", desc: "Resistente y trabajador. +2 CON. Visión en la oscuridad.",
    speed: 25,
    bonuses: { constitution: 2 },
    traits: ["Visión en la oscuridad (18 m)", "Resistencia al veneno", "Entrenamiento con hacha y martillo", "Habilidad con herramientas de artesano"],
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="9" r="4.5" fill="none" stroke="#b8860b" strokeWidth="1.6"/>
        <path d="M7 30c0-5 4-9 9-9s9 4 9 9" fill="none" stroke="#b8860b" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M11 21 L10 28 M21 21 L22 28" stroke="#b8860b" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    subraces: [
      { id: "hill-dwarf",     name: "Enano de las Colinas", bonus: { wisdom: 1 },    trait: "+1 SAB · +1 HP por nivel" },
      { id: "mountain-dwarf", name: "Enano de la Montaña",  bonus: { strength: 2 },  trait: "+2 FUE · Armadura ligera y media" },
    ],
  },
  {
    id: "halfling", name: "Mediano", desc: "Suertudo y valiente. +2 DES. Nunca falla por 1 natural.",
    speed: 25,
    bonuses: { dexterity: 2 },
    traits: ["Afortunado (re-lanza los 1 naturales)", "Valiente (ventaja contra miedo)", "Agilidad del mediano"],
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="11" r="4" fill="none" stroke="#b8860b" strokeWidth="1.6"/>
        <path d="M7 30c0-5 3.8-8.5 9-8.5s9 3.5 9 8.5" fill="none" stroke="#b8860b" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="22" cy="12" r="2.5" fill="none" stroke="#e8c040" strokeWidth="1.1"/>
        <path d="M22 9.5 L22 6" stroke="#e8c040" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
    subraces: [
      { id: "lightfoot", name: "Pies Ligeros", bonus: { charisma: 1 },    trait: "+1 CAR · Ocultarse tras criaturas más grandes" },
      { id: "stout",     name: "Fornido",      bonus: { constitution: 1 }, trait: "+1 CON · Resistencia al veneno" },
    ],
  },
  {
    id: "dragonborn", name: "Dracónido", desc: "Linaje dracónico. +2 FUE, +1 CAR. Arma de aliento.",
    speed: 30,
    bonuses: { strength: 2, charisma: 1 },
    traits: ["Arma de aliento (1d10, CD 8 + mod CON)", "Resistencia al daño según el dragón ancestral", "Lenguaje Dracónico"],
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <path d="M16 4 L20 10 L26 8 L22 14 L28 16 L22 18 L24 24 L16 20 L8 24 L10 18 L4 16 L10 14 L6 8 L12 10 Z" fill="none" stroke="#b8860b" strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="16" cy="16" r="3" fill="#e8c040" opacity="0.7"/>
      </svg>
    ),
  },
  {
    id: "gnome", name: "Gnomo", desc: "Ingenioso e inventivo. +2 INT. Astucia gnómica.",
    speed: 25,
    bonuses: { intelligence: 2 },
    traits: ["Visión en la oscuridad (18 m)", "Astucia gnómica: ventaja en salvaciones mágicas INT/SAB/CAR"],
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="12" r="4" fill="none" stroke="#b8860b" strokeWidth="1.6"/>
        <path d="M8 29c0-4.5 3.6-8 8-8s8 3.5 8 8" fill="none" stroke="#b8860b" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M10 11 Q16 5 22 11" fill="none" stroke="#e8c040" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M12 7 L16 3 L20 7" fill="none" stroke="#e8c040" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    subraces: [
      { id: "forest-gnome", name: "Gnomo del Bosque", bonus: { dexterity: 1 }, trait: "+1 DES · Hablar con bestias pequeñas · Truco ilusorio" },
      { id: "rock-gnome",   name: "Gnomo de las Rocas", bonus: { constitution: 1 }, trait: "+1 CON · Herramientas de artesano · Conocimiento de ingenios" },
    ],
  },
  {
    id: "half-elf", name: "Semielfo", desc: "Herencia feérica y humana. +2 CAR, +1 a dos atributos.",
    speed: 30,
    bonuses: { charisma: 2, dexterity: 1, wisdom: 1 },
    traits: ["Visión en la oscuridad (18 m)", "Resistencia feérica", "Versatilidad de habilidades: competencia en 2 habilidades a elección"],
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="10" r="5" fill="none" stroke="#b8860b" strokeWidth="1.6"/>
        <path d="M5 30c0-6 4.9-11 11-11s11 5 11 11" fill="none" stroke="#b8860b" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M11 8 Q16 5 21 8" fill="none" stroke="#e8c040" strokeWidth="1.1" strokeLinecap="round"/>
        <path d="M22 9 L24 6" stroke="#e8c040" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "half-orc", name: "Semiorco", desc: "Fuerza y tenacidad. +2 FUE, +1 CON. Resistencia implacable.",
    speed: 30,
    bonuses: { strength: 2, constitution: 1 },
    traits: ["Visión en la oscuridad (18 m)", "Resistencia implacable: cuando caes a 0 PV puedes quedar en 1 (1/desc. largo)", "Ataques salvajes: críticos infligen 1 dado extra", "Competencia en Intimidación"],
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="10" r="5" fill="none" stroke="#b8860b" strokeWidth="1.8"/>
        <path d="M5 30c0-6 4.9-11 11-11s11 5 11 11" fill="none" stroke="#b8860b" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M12 13 L10 17 M20 13 L22 17" stroke="#e8c040" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "tiefling", name: "Tiefling", desc: "Sangre infernal. +2 CAR, +1 INT. Magia innata oscura.",
    speed: 30,
    bonuses: { charisma: 2, intelligence: 1 },
    traits: ["Visión en la oscuridad (18 m)", "Resistencia infernal (resistencia al fuego)", "Legado infernal: Taumaturgia + Represalia infernal + Oscuridad (usos limitados)"],
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="11" r="5" fill="none" stroke="#b8860b" strokeWidth="1.6"/>
        <path d="M5 30c0-6 4.9-11 11-11s11 5 11 11" fill="none" stroke="#b8860b" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M11 6 L9 2 M21 6 L23 2" stroke="#e8c040" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M10 7 Q16 4 22 7" fill="none" stroke="#e8c040" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
  },
];

type ClassData = {
  id: string; name: string; hitDie: number; desc: string; role: string;
  primaryStat: string; savingThrows: string[]; armorProf: string; weaponProf: string;
  skillCount: number; skillPool: string[];
  features: { name: string; desc: string }[];
  equipment: string[];
  equipmentChoices: { label: string; options: string[] }[];
  icon: React.ReactElement;
};

const CLASSES: ClassData[] = [
  {
    id: "fighter", name: "Guerrero", hitDie: 10, desc: "Maestro del combate", role: "Tanque / DPS",
    primaryStat: "FUE o DES", savingThrows: ["Fuerza", "Constitución"],
    armorProf: "Toda armadura y escudos", weaponProf: "Armas simples y marciales",
    skillCount: 2,
    skillPool: ["Acrobacias", "Manejo de Animales", "Atletismo", "Historia", "Perspicacia", "Intimidación", "Percepción", "Supervivencia"],
    features: [
      { name: "Estilo de combate", desc: "Elige Arquería, Defensa, Duelo, Lucha con arma grande o Combate con dos armas." },
      { name: "Recuperación", desc: "Acción adicional: recupera 1d10 + nivel en PV una vez entre descansos." },
    ],
    equipment: ["Ballesta ligera + 20 virotes", "Mochila de explorador"],
    equipmentChoices: [
      { label: "Armadura", options: ["Cota de malla", "Armadura de cuero, arco largo y 20 flechas"] },
      { label: "Arma principal", options: ["Arma marcial + escudo", "Dos armas marciales"] },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <line x1="14" y1="3" x2="14" y2="22" stroke="#b8860b" strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="9" y1="13" x2="19" y2="13" stroke="#b8860b" strokeWidth="2" strokeLinecap="round"/>
        <polygon points="14,3 12.5,7 15.5,7" fill="#e8c040"/>
        <rect x="12.5" y="21" width="3" height="2.5" rx="0.5" fill="#b8860b"/>
      </svg>
    ),
  },
  {
    id: "wizard", name: "Mago", hitDie: 6, desc: "Poder arcano e inteligencia", role: "Lanzador de hechizos",
    primaryStat: "INT", savingThrows: ["Inteligencia", "Sabiduría"],
    armorProf: "Ninguna", weaponProf: "Daga, dardo, honda, báculo, ballesta ligera",
    skillCount: 2,
    skillPool: ["Arcanos", "Historia", "Perspicacia", "Investigación", "Medicina", "Religión"],
    features: [
      { name: "Lanzamiento de hechizos", desc: "Lanza hechizos de mago usando Inteligencia. CD = 8 + mod INT + competencia." },
      { name: "Recuperación arcana", desc: "Recupera ranuras de hechizo durante un descanso corto (total de niveles ≤ ½ nv. mago)." },
    ],
    equipment: ["Libro de hechizos", "Mochila de estudioso", "Foco arcano"],
    equipmentChoices: [
      { label: "Arma de mano", options: ["Báculo cuártico", "Daga"] },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <line x1="14" y1="9" x2="14" y2="25" stroke="#b8860b" strokeWidth="2" strokeLinecap="round"/>
        <line x1="11" y1="20" x2="17" y2="20" stroke="#b8860b" strokeWidth="1.5" strokeLinecap="round"/>
        <polygon points="14,2 15.5,6 19,6 16.5,8.5 17.5,12 14,10 10.5,12 11.5,8.5 9,6 12.5,6" fill="none" stroke="#e8c040" strokeWidth="1.3" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "cleric", name: "Clérigo", hitDie: 8, desc: "Poder divino y curación", role: "Soporte / Sanador",
    primaryStat: "SAB", savingThrows: ["Sabiduría", "Carisma"],
    armorProf: "Armadura ligera, media y escudos", weaponProf: "Armas simples",
    skillCount: 2,
    skillPool: ["Historia", "Perspicacia", "Medicina", "Persuasión", "Religión"],
    features: [
      { name: "Lanzamiento de hechizos", desc: "Lanza hechizos de clérigo usando Sabiduría. CD = 8 + mod SAB + competencia." },
      { name: "Dominio divino", desc: "Elige un dominio que otorga hechizos adicionales y poderes especiales." },
    ],
    equipment: ["Símbolo sagrado", "Mochila de sacerdote"],
    equipmentChoices: [
      { label: "Arma y protección", options: ["Maza + escudo de madera", "Martillo de guerra + escudo"] },
      { label: "Armadura", options: ["Cota de escamas", "Armadura de cuero + ballesta ligera + 20 virotes"] },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <line x1="14" y1="3" x2="14" y2="25" stroke="#b8860b" strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="7" y1="10" x2="21" y2="10" stroke="#b8860b" strokeWidth="2.2" strokeLinecap="round"/>
        <circle cx="14" cy="13" r="2" fill="#e8c040"/>
      </svg>
    ),
  },
  {
    id: "rogue", name: "Pícaro", hitDie: 8, desc: "Sigilo, engaño y precisión", role: "Furtivo / DPS",
    primaryStat: "DES", savingThrows: ["Destreza", "Inteligencia"],
    armorProf: "Armadura ligera", weaponProf: "Armas simples, ballesta de mano, espada larga, estoque, espada corta",
    skillCount: 4,
    skillPool: ["Acrobacias", "Atletismo", "Engaño", "Perspicacia", "Intimidación", "Investigación", "Medicina", "Percepción", "Interpretación", "Persuasión", "Juego de Manos", "Sigilo"],
    features: [
      { name: "Pericia (×2)", desc: "Dobla el bonificador de competencia en dos habilidades elegidas." },
      { name: "Ataque furtivo 1d6", desc: "Daño extra cuando tienes ventaja o un aliado adyacente al objetivo." },
      { name: "Argot de ladrones", desc: "Lenguaje secreto del hampa que solo otros pícaros comprenden." },
    ],
    equipment: ["Armadura de cuero", "Arco corto + 20 flechas", "Daga (×2)", "Herramientas de ladrón", "Mochila de ladrón"],
    equipmentChoices: [
      { label: "Arma principal", options: ["Estoque", "Espada corta"] },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <path d="M21 4 L7 22" stroke="#b8860b" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M18 6 L21 4 L23 7" stroke="#b8860b" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="16" y1="12" x2="12" y2="16" stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="7" cy="22" r="2.5" fill="#e8c040" opacity="0.75"/>
      </svg>
    ),
  },
  {
    id: "barbarian", name: "Bárbaro", hitDie: 12, desc: "Furia salvaje e instinto puro", role: "Melee / Tanque",
    primaryStat: "FUE", savingThrows: ["Fuerza", "Constitución"],
    armorProf: "Armadura ligera, media y escudos", weaponProf: "Armas simples y marciales",
    skillCount: 2,
    skillPool: ["Manejo de Animales", "Atletismo", "Intimidación", "Naturaleza", "Percepción", "Supervivencia"],
    features: [
      { name: "Furia (2/desc. largo)", desc: "Acción adicional para entrar en furia: ventaja en FUE, +2 daño cuerpo a cuerpo, resistencia a daño físico. Dura 1 min." },
      { name: "Defensa sin armadura", desc: "Sin armadura: CA = 10 + mod DES + mod CON." },
    ],
    equipment: ["Dos hachas de mano", "Mochila de explorador", "4 jabalinas"],
    equipmentChoices: [
      { label: "Arma principal", options: ["Hacha grande", "Arma marcial cuerpo a cuerpo"] },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <line x1="7" y1="22" x2="19" y2="6" stroke="#b8860b" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="19" y1="6" x2="19" y2="11" stroke="#b8860b" strokeWidth="2" strokeLinecap="round"/>
        <line x1="19" y1="6" x2="14" y2="6" stroke="#b8860b" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="8" cy="20" r="2.5" fill="none" stroke="#e8c040" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    id: "bard", name: "Bardo", hitDie: 8, desc: "Magia, música e ingenio social", role: "Versátil / Soporte",
    primaryStat: "CAR", savingThrows: ["Destreza", "Carisma"],
    armorProf: "Armadura ligera", weaponProf: "Armas simples, ballesta de mano, espada larga, estoque, espada corta",
    skillCount: 3,
    skillPool: ["Acrobacias", "Arcanos", "Atletismo", "Engaño", "Historia", "Perspicacia", "Intimidación", "Investigación", "Medicina", "Naturaleza", "Percepción", "Interpretación", "Persuasión", "Religión", "Juego de Manos", "Sigilo", "Supervivencia"],
    features: [
      { name: "Lanzamiento de hechizos", desc: "Lanza hechizos de bardo usando Carisma. Conoces 2 trucos y 2 hechizos de nivel 1." },
      { name: "Inspiración bárdica (d6)", desc: "Acción adicional: otorgas un dado d6 a un aliado que puede añadirlo a una tirada. Usos = mod CAR por desc. largo." },
    ],
    equipment: ["Armadura de cuero", "Daga", "Mochila de diplomático"],
    equipmentChoices: [
      { label: "Arma principal", options: ["Estoque", "Espada larga", "Cualquier arma marcial"] },
      { label: "Instrumento musical", options: ["Laúd", "Arpa", "Flauta"] },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <ellipse cx="9" cy="19" rx="3.5" ry="2.5" fill="none" stroke="#b8860b" strokeWidth="1.5"/>
        <line x1="12" y1="17" x2="12" y2="7" stroke="#b8860b" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="12" y1="7" x2="18" y2="6" stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="18" y1="6" x2="18" y2="9.5" stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round"/>
        <ellipse cx="17" cy="10.5" rx="1.5" ry="1.2" fill="none" stroke="#b8860b" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    id: "druid", name: "Druida", hitDie: 8, desc: "Guardián de la naturaleza y sus magias", role: "Lanzador / Soporte",
    primaryStat: "SAB", savingThrows: ["Inteligencia", "Sabiduría"],
    armorProf: "Armadura ligera y media (no metálica), escudos (no metálicos)", weaponProf: "Garrote, daga, dardo, jabalina, maza, báculo, cimitarra, hoz, honda, lanza",
    skillCount: 2,
    skillPool: ["Arcanos", "Manejo de Animales", "Perspicacia", "Medicina", "Naturaleza", "Percepción", "Religión", "Supervivencia"],
    features: [
      { name: "Idioma druídico", desc: "Conoces el lenguaje secreto de los druidas para comunicarte y dejar mensajes ocultos en la naturaleza." },
      { name: "Lanzamiento de hechizos", desc: "Usas Sabiduría para lanzar hechizos de druida. Preparas mod SAB + nivel druida hechizos cada día." },
    ],
    equipment: ["Armadura de cuero", "Mochila de explorador", "Foco druídico"],
    equipmentChoices: [
      { label: "Arma principal", options: ["Báculo cuártico", "Cimitarra + escudo de madera"] },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <path d="M14 24 C14 24 6 19 7 11 C8 7 14 5 19 8 C23 13 19 20 14 24Z" fill="none" stroke="#b8860b" strokeWidth="1.6" strokeLinejoin="round"/>
        <line x1="14" y1="24" x2="14" y2="17" stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="11" y1="13" x2="16" y2="15" stroke="#b8860b" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "monk", name: "Monje", hitDie: 8, desc: "Disciplina marcial y poder del ki", role: "Ágil / DPS",
    primaryStat: "DES / SAB", savingThrows: ["Fuerza", "Destreza"],
    armorProf: "Ninguna", weaponProf: "Armas simples y espada corta",
    skillCount: 2,
    skillPool: ["Acrobacias", "Atletismo", "Historia", "Perspicacia", "Religión", "Sigilo"],
    features: [
      { name: "Defensa sin armadura", desc: "Sin armadura ni escudo: CA = 10 + mod DES + mod SAB." },
      { name: "Artes marciales", desc: "Puedes usar DES en vez de FUE. Daño desarmado: d4. Ataque adicional desarmado tras atacar con arma de monje." },
    ],
    equipment: ["10 dardos"],
    equipmentChoices: [
      { label: "Arma", options: ["Espada corta", "Cualquier arma simple"] },
      { label: "Mochila", options: ["Mochila de explorador", "Mochila de exploración de mazmorras"] },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <circle cx="14" cy="14" r="10" fill="none" stroke="#b8860b" strokeWidth="1.5"/>
        <path d="M14 4 C14 4 19 9 14 14 C9 19 14 24 14 24" fill="none" stroke="#b8860b" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="14" cy="9" r="1.5" fill="#e8c040"/>
        <circle cx="14" cy="19" r="1.5" fill="none" stroke="#b8860b" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    id: "paladin", name: "Paladín", hitDie: 10, desc: "Juramento sagrado y poder divino", role: "Tanque / Soporte",
    primaryStat: "FUE / CAR", savingThrows: ["Sabiduría", "Carisma"],
    armorProf: "Toda armadura y escudos", weaponProf: "Armas simples y marciales",
    skillCount: 2,
    skillPool: ["Atletismo", "Perspicacia", "Intimidación", "Medicina", "Persuasión", "Religión"],
    features: [
      { name: "Sentido divino", desc: "Detectas celestiales, demonios o no-muertos a 18 m. Usos = 1 + mod CAR por desc. largo." },
      { name: "Imposición de manos", desc: "Restauras PV con el toque. Reserva = 5 × nivel. También curas enfermedades y venenos (gasta 5 PV por condición)." },
    ],
    equipment: ["Cota de escamas", "Símbolo sagrado", "5 jabalinas"],
    equipmentChoices: [
      { label: "Arma y escudo", options: ["Espada larga + escudo", "Dos armas marciales"] },
      { label: "Mochila", options: ["Mochila de sacerdote", "Mochila de explorador"] },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <path d="M14 3 L21 6.5 L21 14 Q21 21 14 24 Q7 21 7 14 L7 6.5 Z" fill="none" stroke="#b8860b" strokeWidth="1.7" strokeLinejoin="round"/>
        <line x1="14" y1="9" x2="14" y2="18" stroke="#e8c040" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="10" y1="13" x2="18" y2="13" stroke="#e8c040" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "ranger", name: "Explorador", hitDie: 10, desc: "Rastreador y arquero del yermo", role: "DPS / Exploración",
    primaryStat: "DES", savingThrows: ["Fuerza", "Destreza"],
    armorProf: "Armadura ligera, media y escudos", weaponProf: "Armas simples y marciales",
    skillCount: 3,
    skillPool: ["Manejo de Animales", "Atletismo", "Perspicacia", "Investigación", "Naturaleza", "Percepción", "Sigilo", "Supervivencia"],
    features: [
      { name: "Enemigo predilecto", desc: "Elige un tipo de enemigo: ventaja en Supervivencia para rastrearlo y en conocimiento sobre esa criatura." },
      { name: "Explorador natural", desc: "Elige un terreno favorito: ventaja en Percepción, no te pierdes, doble eficiencia recogiendo alimento." },
    ],
    equipment: ["Cota de escamas", "Mochila de explorador", "Arco largo + 20 flechas"],
    equipmentChoices: [
      { label: "Armas de mano", options: ["Dos espadas cortas", "Dos armas simples cuerpo a cuerpo"] },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <line x1="5" y1="22" x2="22" y2="5" stroke="#b8860b" strokeWidth="1.8" strokeLinecap="round"/>
        <polygon points="22,5 17,7 20,10" fill="#e8c040"/>
        <line x1="5" y1="22" x2="7" y2="17" stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="5" y1="22" x2="10" y2="23" stroke="#b8860b" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M8 10 Q12 5 17 7" fill="none" stroke="#b8860b" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "sorcerer", name: "Hechicero", hitDie: 6, desc: "Magia innata que fluye en la sangre", role: "Lanzador / DPS",
    primaryStat: "CAR", savingThrows: ["Constitución", "Carisma"],
    armorProf: "Ninguna", weaponProf: "Daga, dardo, honda, báculo, ballesta ligera",
    skillCount: 2,
    skillPool: ["Arcanos", "Engaño", "Perspicacia", "Intimidación", "Persuasión", "Religión"],
    features: [
      { name: "Lanzamiento de hechizos", desc: "Usas Carisma para lanzar hechizos. Conoces 4 trucos y 2 hechizos de nivel 1 de la lista de hechicero." },
      { name: "Origen hechiceril", desc: "Elige tu origen: Linaje Dracónico o Magia Salvaje. Otorga hechizos adicionales y un rasgo de nivel 1." },
    ],
    equipment: ["Mochila de exploración de mazmorras"],
    equipmentChoices: [
      { label: "Arma ligera", options: ["Ballesta ligera + 20 virotes", "Daga"] },
      { label: "Foco mágico", options: ["Foco arcano", "Bolsa de componentes"] },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <path d="M14 22 C10 20 9 14 11 11 C11 14 14 13 14 11 C15 9 18 10 16 13 C19 11 19 17 17 20 C17 17 15 16 16 18 C16 21 18 20 18 22 C17 23 11 23 14 22Z" fill="none" stroke="#b8860b" strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="14" cy="6" r="2" fill="#e8c040" opacity="0.8"/>
      </svg>
    ),
  },
  {
    id: "warlock", name: "Brujo", hitDie: 8, desc: "Poder de un pacto con una entidad", role: "Lanzador / DPS",
    primaryStat: "CAR", savingThrows: ["Sabiduría", "Carisma"],
    armorProf: "Armadura ligera", weaponProf: "Armas simples",
    skillCount: 2,
    skillPool: ["Arcanos", "Engaño", "Historia", "Intimidación", "Investigación", "Naturaleza", "Religión"],
    features: [
      { name: "Patrón de ultratumba", desc: "Elige un patrón (El Archifeérico, El Demonio o El Gran Anciano) que otorga hechizos del pacto y un rasgo especial." },
      { name: "Magia del pacto", desc: "Usas Carisma para lanzar hechizos. Conoces 2 trucos y 2 hechizos. Las ranuras se recuperan en descanso corto." },
    ],
    equipment: ["Armadura de cuero", "Foco arcano", "Mochila de estudioso"],
    equipmentChoices: [
      { label: "Arma ligera", options: ["Ballesta ligera + 20 virotes", "Cualquier arma simple"] },
    ],
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <path d="M4 14 Q14 6 24 14 Q14 22 4 14Z" fill="none" stroke="#b8860b" strokeWidth="1.6"/>
        <circle cx="14" cy="14" r="3" fill="none" stroke="#b8860b" strokeWidth="1.5"/>
        <circle cx="14" cy="14" r="1.2" fill="#e8c040"/>
      </svg>
    ),
  },
];

type BackgroundData = {
  id: string; name: string; desc: string;
  skills: string[]; toolOrLang: string; startingGold: number;
  feature: { name: string; desc: string };
};

const BACKGROUNDS: BackgroundData[] = [
  {
    id: "acolyte", name: "Acólito", desc: "Sirviente de un templo y sus dioses",
    skills: ["Perspicacia", "Religión"], toolOrLang: "2 idiomas a elección", startingGold: 15,
    feature: { name: "Refugio de los fieles", desc: "Los templos te ofrecen alojamiento y comida a cambio de pequeños servicios." },
  },
  {
    id: "criminal", name: "Criminal", desc: "Vida al margen de la ley",
    skills: ["Engaño", "Sigilo"], toolOrLang: "Kit de juego + herramientas de ladrón", startingGold: 15,
    feature: { name: "Contacto criminal", desc: "Tienes un contacto en el hampa que puede pasar información o encargos." },
  },
  {
    id: "folk-hero", name: "Héroe del Pueblo", desc: "Defensor de la gente común",
    skills: ["Manejo de Animales", "Supervivencia"], toolOrLang: "Herramientas de artesano + vehículos terrestres", startingGold: 10,
    feature: { name: "Hospitalidad rústica", desc: "Los campesinos te esconden y protegen sin arriesgar sus vidas." },
  },
  {
    id: "noble", name: "Noble", desc: "Nacido en la nobleza y el privilegio",
    skills: ["Historia", "Persuasión"], toolOrLang: "Kit de juego + 1 idioma", startingGold: 25,
    feature: { name: "Posición privilegiada", desc: "La gente asume que tienes derecho a estar donde estás. Acceso a la alta sociedad." },
  },
  {
    id: "sage", name: "Sabio", desc: "Estudioso de los arcanos y la historia",
    skills: ["Arcanos", "Historia"], toolOrLang: "2 idiomas a elección", startingGold: 10,
    feature: { name: "Investigador", desc: "Si no sabes algo, sabes dónde y a quién preguntar para obtener la respuesta." },
  },
  {
    id: "soldier", name: "Soldado", desc: "Veterano de la vida militar",
    skills: ["Atletismo", "Intimidación"], toolOrLang: "Kit de juego + vehículos terrestres", startingGold: 10,
    feature: { name: "Rango militar", desc: "Soldados de tu antigua organización reconocen tu autoridad y te ceden el paso." },
  },
  {
    id: "charlatan", name: "Charlatán", desc: "Maestro del engaño y las identidades falsas",
    skills: ["Engaño", "Juego de Manos"], toolOrLang: "Kit de disfraz + kit de falsificación", startingGold: 15,
    feature: { name: "Identidad falsa", desc: "Tienes una o más identidades ficticias con documentos falsificados que puedes mantener de forma indefinida." },
  },
  {
    id: "entertainer", name: "Artista", desc: "Músico, actor o acróbata que vive del público",
    skills: ["Acrobacias", "Interpretación"], toolOrLang: "Kit de disfraz + instrumento musical", startingGold: 15,
    feature: { name: "Por aclamación popular", desc: "En cualquier lugar donde actúes, puedes conseguir alojamiento y comida gratuitos a cambio de tu actuación." },
  },
  {
    id: "guild-artisan", name: "Artesano de Gremio", desc: "Miembro de un gremio de oficios",
    skills: ["Perspicacia", "Persuasión"], toolOrLang: "Herramientas de artesano (a elección)", startingGold: 15,
    feature: { name: "Membresía del gremio", desc: "Tu gremio te provee de alojamiento y apoyo. A cambio pagas cuotas mensuales y ayudas a otros miembros." },
  },
  {
    id: "hermit", name: "Ermitaño", desc: "Años de soledad y contemplación",
    skills: ["Medicina", "Religión"], toolOrLang: "Kit de herbolario", startingGold: 5,
    feature: { name: "Descubrimiento", desc: "Tu reclusión te permitió hacer un descubrimiento único: una verdad sobre el cosmos, los dioses o las fuerzas del mundo." },
  },
  {
    id: "outlander", name: "Forastero", desc: "Criado en los límites de la civilización",
    skills: ["Atletismo", "Supervivencia"], toolOrLang: "Instrumento musical a elección", startingGold: 10,
    feature: { name: "Trotamundos", desc: "Puedes encontrar comida, agua y refugio para ti y hasta 5 compañeros en cualquier entorno natural." },
  },
  {
    id: "sailor", name: "Marinero", desc: "Veterano de las rutas marítimas",
    skills: ["Atletismo", "Percepción"], toolOrLang: "Herramientas de navegante + vehículos acuáticos", startingGold: 10,
    feature: { name: "Pasaje seguro", desc: "Cuando lo necesites puedes conseguir pasaje gratuito en barcos para ti y tus compañeros a cambio de trabajo." },
  },
  {
    id: "urchin", name: "Pillo", desc: "Criado en las calles de una gran ciudad",
    skills: ["Juego de Manos", "Sigilo"], toolOrLang: "Herramientas de ladrón + kit de disfraz", startingGold: 10,
    feature: { name: "Secretos de la ciudad", desc: "Conoces los pasajes y atajos ocultos de las ciudades. Puedes moverte al doble de velocidad por ellas sin ser visto." },
  },
];

const ALIGNMENTS = [
  { id: "lg", label: "Legal Bueno",     desc: "Hace lo correcto según la ley" },
  { id: "ng", label: "Neutral Bueno",   desc: "Ayuda a otros sin restricciones" },
  { id: "cg", label: "Caótico Bueno",   desc: "Sigue su conciencia libremente" },
  { id: "ln", label: "Legal Neutral",   desc: "Sigue el orden sin juicios morales" },
  { id: "tn", label: "Verdadero Neutral",desc: "Evita los extremos siempre" },
  { id: "cn", label: "Caótico Neutral", desc: "Sigue sus propios caprichos" },
  { id: "le", label: "Legal Malvado",   desc: "Toma lo que quiere dentro de un código" },
  { id: "ne", label: "Neutral Malvado", desc: "Actúa sin compasión ni código" },
  { id: "ce", label: "Caótico Malvado", desc: "Violencia y caos sin restricciones" },
];

const STAT_KEYS: (keyof CharacterStats)[] = ["strength","dexterity","constitution","intelligence","wisdom","charisma"];
const STAT_META: Record<keyof CharacterStats, { abbr: string; name: string; desc: string }> = {
  strength:     { abbr: "FUE", name: "Fuerza",        desc: "Poder físico, atletismo" },
  dexterity:    { abbr: "DES", name: "Destreza",       desc: "Reflejos, sigilo, precisión" },
  constitution: { abbr: "CON", name: "Constitución",   desc: "Resistencia, puntos de vida" },
  intelligence: { abbr: "INT", name: "Inteligencia",   desc: "Razonamiento, magia arcana" },
  wisdom:       { abbr: "SAB", name: "Sabiduría",      desc: "Intuición, magia divina" },
  charisma:     { abbr: "CAR", name: "Carisma",        desc: "Presencia, persuasión" },
};

const CLASS_PRIMARY: Record<string, keyof CharacterStats> = {
  fighter: "strength",   wizard: "intelligence", cleric: "wisdom",    rogue: "dexterity",
  barbarian: "strength", bard: "charisma",        druid: "wisdom",     monk: "dexterity",
  paladin: "charisma",   ranger: "dexterity",     sorcerer: "charisma", warlock: "charisma",
};

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// ── Component ──────────────────────────────────────────────────

export default function NewCharacter() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { lang } = useLang();
  const tr = t[lang].newCharacter;
  const STEPS = tr.stepLabels.map((label, i) => ({ label, desc: tr.stepDescs[i] }));
  const skillNames = t[lang].character.skillNames as unknown as Record<string, string>;
  const statAbbr   = t[lang].character.statAbbr   as unknown as Record<string, string>;
  const statFull   = t[lang].character.statFull   as unknown as Record<string, string>;
  const statDescs  = tr.statDescs as unknown as Record<string, string>;

  const [authLoading, setAuthLoading] = useState(true);
  const [step, setStep]               = useState(0);

  // Step 0 — Race
  const [raceId,    setRaceId]    = useState("");
  const [subraceId, setSubraceId] = useState("");

  // Step 1 — Class
  const [classId,         setClassId]         = useState("");
  const [fightingStyleIdx, setFightingStyleIdx] = useState<number | null>(null);

  // Step 2 — Stats (which STANDARD_ARRAY value is assigned to each stat)
  const [assignments, setAssignments] = useState<Partial<Record<keyof CharacterStats, number>>>({});
  const [dragging, setDragging]       = useState<number | null>(null);
  const [dragOver, setDragOver]       = useState<keyof CharacterStats | null>(null);
  const dragValueRef                  = useRef<number | null>(null);

  // Step 3 — Background
  const [bgId,          setBgId]          = useState("");
  // Step 4 — Equipment choices (index → chosen option)
  const [equipChoices,  setEquipChoices]  = useState<Record<number, string>>({});
  const [chosenSkills,  setChosenSkills]  = useState<string[]>([]);

  // Step 4 — Identity
  const [name,        setName]       = useState("");
  const [alignment,   setAlignment]  = useState("");
  const [backstory,   setBackstory]  = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl,    setImageUrl]   = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError,  setImageError] = useState<string | null>(null);

  // UI
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [shake,      setShake]      = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCurrUser().then((u) => {
      if (!u) { router.replace("/auth/login"); return; }
      loader.stop();
      setAuthLoading(false);
    });
  }, [router]);

  // ── Derived data ───────────────────────────────────────────────

  const raceData    = RACES.find((r) => r.id === raceId);
  const subraceData = raceData?.subraces?.find((s) => s.id === subraceId);
  const classData   = CLASSES.find((c) => c.id === classId);
  const bgData      = BACKGROUNDS.find((b) => b.id === bgId);

  const racialBonuses = useMemo<Partial<CharacterStats>>(() => {
    const bonuses = { ...(raceData?.bonuses ?? {}) };
    if (subraceData) {
      for (const [k, v] of Object.entries(subraceData.bonus)) {
        bonuses[k as keyof CharacterStats] = (bonuses[k as keyof CharacterStats] ?? 0) + v;
      }
    }
    return bonuses;
  }, [raceData, subraceData]);

  const finalStats = useMemo<CharacterStats>(() => {
    const base: CharacterStats = { strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 };
    for (const key of STAT_KEYS) {
      base[key] = (assignments[key] ?? 0) + (racialBonuses[key] ?? 0);
    }
    return base;
  }, [assignments, racialBonuses]);

  const remaining = useMemo(() => {
    const usedCounts: Record<number, number> = {};
    for (const v of Object.values(assignments) as number[]) usedCounts[v] = (usedCounts[v] ?? 0) + 1;
    return [...STANDARD_ARRAY].filter((v) => {
      if (usedCounts[v] && usedCounts[v] > 0) { usedCounts[v]--; return false; }
      return true;
    });
  }, [assignments]);

  const allAssigned = useMemo(() => STAT_KEYS.every((k) => assignments[k] !== undefined), [assignments]);

  const maxHp = classData
    ? classData.hitDie + mod(finalStats.constitution)
    : 8;

  const allSkills = useMemo(() => [...(bgData?.skills ?? []), ...chosenSkills], [bgData, chosenSkills]);

  const classI18n = useMemo(
    () => classData ? getClassI18n(lang, classData.id) : null,
    [classData, lang],
  );
  const classI18nFeatures = useMemo(
    () => classData && lang !== "es" ? getClassFeatures(lang, classData.name) : [],
    [classData, lang],
  );
  const bgI18n = useMemo(
    () => bgData ? getBgI18n(lang, bgData.id) : null,
    [bgData, lang],
  );

  // ── Handlers ──────────────────────────────────────────────────

  function triggerShake() { setShake(true); setTimeout(() => setShake(false), 450); }

  function assignStat(key: keyof CharacterStats, value: number) {
    setAssignments((prev) => {
      const next = { ...prev };
      // If this value is already used elsewhere, swap
      const existing = Object.entries(next).find(([k, v]) => k !== key && v === value);
      const myOld = next[key];
      if (existing) next[existing[0] as keyof CharacterStats] = myOld;
      else if (myOld !== undefined) delete next[key];
      next[key] = value;
      return next;
    });
  }

  function toggleSkill(skill: string) {
    if (bgData?.skills.includes(skill)) return; // locked from bg
    const needed = classData?.skillCount ?? 2;
    const classSkills = chosenSkills.filter((s) => !bgData?.skills.includes(s));
    if (classSkills.includes(skill)) {
      setChosenSkills((p) => p.filter((s) => s !== skill));
    } else if (classSkills.length < needed) {
      setChosenSkills((p) => [...p, skill]);
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setImageError(tr.imageErrType); return; }
    if (file.size > 5 * 1024 * 1024) { setImageError(tr.imageErrSize); return; }
    setImageError(null);
    setImagePreview(URL.createObjectURL(file));
    setImageUploading(true);
    setImageUrl(null);
    try {
      const cloudName    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", uploadPreset!);
      fd.append("folder", "hearth-hall/characters");
      const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { secure_url: string };
      setImageUrl(data.secure_url);
    } catch {
      setImageError(tr.imageErrUpload);
      setImagePreview(null);
    } finally {
      setImageUploading(false);
    }
  }

  function validateStep(s: number): Record<string, string> {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!raceId) errs.race = tr.errRace;
      else if (raceData?.subraces && !subraceId) errs.subrace = tr.errSubrace;
    }
    if (s === 1) {
      if (!classId) errs.class = tr.errClass;
    }
    if (s === 2) {
      if (!allAssigned) errs.stats = tr.errStats;
    }
    if (s === 3) {
      if (!bgId) errs.bg = tr.errBg;
      else {
        const needed  = classData?.skillCount ?? 2;
        const locked  = bgData?.skills ?? [];
        const picked  = chosenSkills.filter((sk) => !locked.includes(sk));
        if (picked.length < needed) errs.skills = tr.errSkillsFmt.replace("{n}", String(needed - picked.length));
      }
    }
    if (s === 4) {
      const choices = classData?.equipmentChoices ?? [];
      for (let i = 0; i < choices.length; i++) {
        if (!equipChoices[i]) {
          errs.equip = tr.errEquipFmt.replace("{n}", choices[i].label);
          break;
        }
      }
    }
    if (s === 5) {
      if (!name.trim()) errs.name = tr.errName;
      else if (name.trim().length < 2) errs.name = tr.errNameShort;
    }
    return errs;
  }

  function goNext() {
    const errs = validateStep(step);
    if (Object.keys(errs).length) { setErrors(errs); triggerShake(); return; }
    setErrors({});
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setErrors({});
    setStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateStep(5);
    if (Object.keys(errs).length) { setErrors(errs); triggerShake(); return; }
    setErrors({});
    setSubmitting(true);

    const raceName  = subraceData ? `${raceData!.name} (${subraceData.name})` : raceData!.name;
    const className = classData!.name;
    const bgName    = bgData!.name;
    const skills    = allSkills;

    let fullBackstory = `Raza: ${raceName} · Clase: ${className} · Trasfondo: ${bgName}`;
    if (backstory.trim()) fullBackstory += `\n\n${backstory.trim()}`;

    const chosenEquipItems = Object.values(equipChoices).map((n) => ({
      name: n, description: "Equipamiento inicial de clase (elegido)",
    }));
    const items = [
      ...classData!.equipment.map((n) => ({ name: n, description: "Equipamiento inicial de clase" })),
      ...chosenEquipItems,
      { name: `${bgData!.startingGold} piezas de oro`, description: `Oro inicial — trasfondo: ${bgName}` },
    ];

    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          class: className,
          level: 1,
          hp: Math.max(1, maxHp),
          max_hp: Math.max(1, maxHp),
          stats: finalStats,
          backstory: fullBackstory,
          image_url: imageUrl ?? undefined,
          race: raceName,
          background: bgName,
          alignment: ALIGNMENTS.find((a) => a.id === alignment)?.label ?? undefined,
          skill_proficiencies: skills,
          items,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ general: (data as { error?: string }).error ?? tr.errGeneral });
        triggerShake();
        return;
      }
      router.push("/dashboard");
    } catch {
      setErrors({ general: tr.errConn });
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.content}>
          <div className={s.skeleton} style={{ height: 600, borderRadius: 4 }} />
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      <div className={s.stars} aria-hidden />
      <div className={s.content}>

        <button className={s.back} onClick={() => router.push("/dashboard")} type="button">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <line x1="10" y1="6" x2="2" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M5 3L2 6l3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {tr.back}
        </button>

        <div className={cx(s.card, shake && s.cardShake)}>
          <div className={s.borderTop} />
          <div className={s.cardBody}>

            {/* Header */}
            <div className={s.header}>
              <h1 className={s.title}>{tr.title}</h1>
              <p className={s.subtitle}>{tr.subtitle}</p>
            </div>

            {/* Stepper */}
            <div className={s.stepper}>
              {STEPS.map((st, i) => (
                <React.Fragment key={st.label}>
                  <div className={s.stepperItem}>
                    <div className={cx(s.stepperCircle, i < step && s.stepperDone, i === step && s.stepperActive)}>
                      {i < step ? (
                        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                          <path d="M2 5.5l2.5 2.5L9 3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : <span>{i + 1}</span>}
                    </div>
                    <div className={cx(s.stepperLabel, i === step && s.stepperLabelActive)}>{st.label}</div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cx(s.stepperLine, i < step && s.stepperLineDone)} />
                  )}
                </React.Fragment>
              ))}
            </div>

            <p className={s.stepDesc}>{STEPS[step].desc}</p>

            {errors.general && (
              <div className={s.errorBanner} role="alert">
                <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden>
                  <path d="M7.5 1.5L13.5 13H1.5Z" stroke="#d07070" fill="rgba(120,30,30,0.3)" strokeWidth="1.3" strokeLinejoin="round"/>
                  <line x1="7.5" y1="6" x2="7.5" y2="9.5" stroke="#d07070" strokeWidth="1.3" strokeLinecap="round"/>
                  <circle cx="7.5" cy="11.2" r="0.85" fill="#d07070"/>
                </svg>
                {errors.general}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>

              {/* ── STEP 0: RAZA ────────────────────────────────── */}
              {step === 0 && (
                <div className={s.stepContent}>
                  <div className={s.raceGrid}>
                    {RACES.map((race) => {
                      const ri = getRaceI18n(lang, race.id);
                      return (
                        <button
                          key={race.id}
                          type="button"
                          className={cx(s.raceCard, raceId === race.id && s.raceCardSelected)}
                          onClick={() => { setRaceId(race.id); setSubraceId(""); setErrors((p) => ({ ...p, race: undefined as unknown as string })); }}
                        >
                          <div className={s.raceIcon}>{race.icon}</div>
                          <div className={s.raceName}>{ri?.name ?? race.name}</div>
                          <div className={s.raceDesc}>{ri?.desc ?? race.desc}</div>
                          <div className={s.raceSpeed}>{tr.speedFmt.replace("{n}", String(race.speed))}</div>
                        </button>
                      );
                    })}
                  </div>
                  {errors.race && <FieldError message={errors.race} className={s.fieldError} iconColor="#d07070"/>}

                  {/* Subrace */}
                  {raceData?.subraces && (
                    <div className={s.fieldGroup}>
                      <div className={s.sectionTitle}>{tr.raceSubrace}</div>
                      <div className={s.subraceRow}>
                        {raceData.subraces.map((sub) => {
                          const ri = getRaceI18n(lang, raceData.id);
                          const si = ri?.subraces?.[sub.id];
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              className={cx(s.subraceCard, subraceId === sub.id && s.subraceCardSelected)}
                              onClick={() => { setSubraceId(sub.id); setErrors((p) => ({ ...p, subrace: undefined as unknown as string })); }}
                            >
                              <div className={s.subraceName}>{si?.name ?? sub.name}</div>
                              <div className={s.subraceTrait}>{si?.trait ?? sub.trait}</div>
                            </button>
                          );
                        })}
                      </div>
                      {errors.subrace && <FieldError message={errors.subrace} className={s.fieldError} iconColor="#d07070"/>}
                    </div>
                  )}

                  {/* Race traits preview */}
                  {raceData && (
                    <div className={s.traitBox}>
                      <div className={s.traitBoxTitle}>{tr.raceTraits}</div>
                      <ul className={s.traitList}>
                        {(getRaceI18n(lang, raceData.id)?.traits ?? raceData.traits).map((trait) => (
                          <li key={trait} className={s.traitItem}>
                            <span className={s.traitBullet}>✦</span> {trait}
                          </li>
                        ))}
                      </ul>
                      <div className={s.bonusRow}>
                        {Object.entries(racialBonuses).map(([k, v]) => (
                          <span key={k} className={s.bonusBadge}>
                            {statAbbr[k] ?? STAT_META[k as keyof CharacterStats].abbr} +{v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 1: CLASE ───────────────────────────────── */}
              {step === 1 && (
                <div className={s.stepContent}>
                  <div className={s.classGrid}>
                    {CLASSES.map((cls) => {
                      const ci = getClassI18n(lang, cls.id);
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          className={cx(s.classCard, classId === cls.id && s.classCardSelected)}
                          onClick={() => { setClassId(cls.id); setChosenSkills([]); setEquipChoices({}); setErrors((p) => ({ ...p, class: undefined as unknown as string })); }}
                        >
                          <div className={s.classCardIcon}>{cls.icon}</div>
                          <div className={s.classCardName}>{ci?.name ?? cls.name}</div>
                          <div className={s.classCardRole}>{ci?.role ?? cls.role}</div>
                          <div className={s.classCardDie}>d{cls.hitDie}</div>
                        </button>
                      );
                    })}
                  </div>
                  {errors.class && <FieldError message={errors.class} className={s.fieldError} iconColor="#d07070"/>}

                  {classData && (
                    <div className={s.classDetail}>
                      <div className={s.classDetailHeader}>
                        <div className={s.classDetailIcon}>{classData.icon}</div>
                        <div>
                          <div className={s.classDetailName}>{classI18n?.name ?? classData.name}</div>
                          <div className={s.classDetailDesc}>{classI18n?.desc ?? classData.desc}</div>
                        </div>
                      </div>

                      <div className={s.classInfoGrid}>
                        <div className={s.classInfoItem}>
                          <div className={s.classInfoLabel}>{tr.classDie}</div>
                          <div className={s.classInfoValue}>d{classData.hitDie}</div>
                        </div>
                        <div className={s.classInfoItem}>
                          <div className={s.classInfoLabel}>{tr.classPrimary}</div>
                          <div className={s.classInfoValue}>{classI18n?.primaryStat ?? classData.primaryStat}</div>
                        </div>
                        <div className={s.classInfoItem}>
                          <div className={s.classInfoLabel}>{tr.classSaves}</div>
                          <div className={s.classInfoValue}>{(classI18n?.savingThrows ?? classData.savingThrows).join(" · ")}</div>
                        </div>
                        <div className={s.classInfoItem}>
                          <div className={s.classInfoLabel}>{tr.classArmor}</div>
                          <div className={s.classInfoValue}>{classI18n?.armorProf ?? classData.armorProf}</div>
                        </div>
                      </div>

                      <div className={s.featuresTitle}>{tr.classFeatures}</div>
                      {(lang === "es" ? classData.features : (classI18nFeatures.length ? classI18nFeatures : classData.features)).map((f) => (
                        <div key={f.name} className={s.featureRow}>
                          <div className={s.featureName}>{f.name}</div>
                          <div className={s.featureDesc}>{f.desc}</div>
                        </div>
                      ))}

                      {classData.id === "fighter" && (
                        <div className={s.fieldGroup} style={{ marginTop: 16 }}>
                          <div className={s.sectionTitle}>{tr.fightingStyleTitle}</div>
                          <div className={s.chipRow}>
                            {tr.fightingStyles.map((st, i) => (
                              <button
                                key={i}
                                type="button"
                                className={cx(s.chip, fightingStyleIdx === i && s.chipSelected)}
                                onClick={() => setFightingStyleIdx(i)}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: 16 }}>
                        <div className={s.featuresTitle}>{tr.classEquipInit}</div>
                        {classData.equipment.length > 0 && (
                          <ul className={s.equipList}>
                            {classData.equipment.map((item) => (
                              <li key={item} className={s.equipItem}>
                                <span className={s.equipBullet}>⚔</span> {translateItem(lang, item)}
                              </li>
                            ))}
                          </ul>
                        )}
                        {classData.equipmentChoices.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            {classData.equipmentChoices.map((c) => (
                              <div key={c.label} className={s.featureRow}>
                                <div className={s.featureName}>{getEquipLabel(lang, c.label)}</div>
                                <div className={s.featureDesc}>{c.options.map((o) => translateItem(lang, o)).join(" · ")}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 2: ATRIBUTOS ───────────────────────────── */}
              {step === 2 && (
                <div className={s.stepContent}>
                  <div className={s.arrayInfo}>
                    <div className={s.arrayInfoTitle}>{tr.statArray}</div>
                    <div className={s.arrayInfoDesc}>{tr.statArrayDesc}</div>
                    <div className={s.arrayPool}>
                      {STANDARD_ARRAY.map((v, i) => {
                        const inRemaining = remaining.includes(v);
                        return (
                          <button
                            key={i}
                            type="button"
                            draggable={inRemaining}
                            className={cx(s.arrayValue, !inRemaining && s.arrayValueUsed, dragging === v && s.arrayValueDragging)}
                            onClick={() => inRemaining && setDragging(dragging === v ? null : v)}
                            onDragStart={(e) => {
                              if (!inRemaining) { e.preventDefault(); return; }
                              dragValueRef.current = v;
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", String(v));
                            }}
                            onDragEnd={() => { dragValueRef.current = null; setDragOver(null); }}
                            disabled={!inRemaining}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={s.statGrid}>
                    {STAT_KEYS.map((key) => {
                      const assigned   = assignments[key];
                      const racial     = racialBonuses[key] ?? 0;
                      const total      = assigned !== undefined ? assigned + racial : undefined;
                      const isPrimary  = classData && CLASS_PRIMARY[classData.id] === key;
                      const m          = total !== undefined ? mod(total) : undefined;

                      return (
                        <div
                          key={key}
                          className={cx(
                            s.statBlock,
                            isPrimary && s.statBlockPrimary,
                            (dragging !== null || dragValueRef.current !== null) && s.statBlockClickable,
                            dragOver === key && s.statBlockDragOver,
                          )}
                          onClick={() => {
                            if (dragging !== null) { assignStat(key, dragging); setDragging(null); }
                          }}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(key); }}
                          onDragEnter={(e) => { e.preventDefault(); setDragOver(key); }}
                          onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const val = dragValueRef.current ?? Number(e.dataTransfer.getData("text/plain"));
                            if (!isNaN(val) && val > 0) { assignStat(key, val); }
                            dragValueRef.current = null;
                            setDragOver(null);
                          }}
                        >
                          {isPrimary && <div className={s.statPrimaryBadge}>{tr.statPrimary}</div>}
                          <div className={cx(
                            s.statMod,
                            m === undefined ? s.statModZero : m > 0 ? s.statModPos : m < 0 ? s.statModNeg : s.statModZero
                          )}>
                            {m !== undefined ? modStr(total!) : "—"}
                          </div>
                          <div className={s.statScore}>
                            {total !== undefined ? (
                              <>
                                <span className={s.statBase}>{assigned}</span>
                                {racial > 0 && <span className={s.statRacial}>+{racial}</span>}
                                <span className={s.statTotal}>{total}</span>
                              </>
                            ) : (
                              <span className={s.statEmpty}>—</span>
                            )}
                          </div>
                          <div className={s.statAbbr}>{statAbbr[key] ?? STAT_META[key].abbr}</div>
                          <div className={s.statFull}>{statFull[key] ?? STAT_META[key].name}</div>
                          <div className={s.statDesc}>{statDescs[key] ?? STAT_META[key].desc}</div>
                          {assigned !== undefined && (
                            <button
                              type="button"
                              className={s.statClear}
                              onClick={(e) => { e.stopPropagation(); setAssignments((p) => { const n = { ...p }; delete n[key]; return n; }); }}
                              aria-label={`${statFull[key] ?? STAT_META[key].name}`}
                            >×</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {errors.stats && <FieldError message={errors.stats} className={s.fieldError} iconColor="#d07070"/>}

                  {allAssigned && (
                    <div className={s.statSummary}>
                      <div className={s.statSummaryTitle}>{tr.statSummary}</div>
                      <div className={s.statSummaryHp}>
                        {classData?.hitDie ?? "?"} <span className={s.statSummaryPlus}>+</span> {mod(finalStats.constitution)} <span className={s.statSummaryEq}>=</span>
                        <span className={s.statSummaryVal}>{Math.max(1, maxHp)}</span> {tr.statHp}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 3: TRASFONDO ───────────────────────────── */}
              {step === 3 && (
                <div className={s.stepContent}>
                  <div className={s.bgGrid}>
                    {BACKGROUNDS.map((bg) => {
                      const bi = getBgI18n(lang, bg.id);
                      return (
                        <button
                          key={bg.id}
                          type="button"
                          className={cx(s.bgCard, bgId === bg.id && s.bgCardSelected)}
                          onClick={() => {
                            setBgId(bg.id);
                            setChosenSkills([]);
                            setErrors((p) => ({ ...p, bg: undefined as unknown as string, skills: undefined as unknown as string }));
                          }}
                        >
                          <div className={s.bgName}>{bi?.name ?? bg.name}</div>
                          <div className={s.bgDesc}>{bi?.desc ?? bg.desc}</div>
                          <div className={s.bgSkills}>{bg.skills.map((sk) => skillNames[sk] ?? sk).join(" · ")}</div>
                        </button>
                      );
                    })}
                  </div>
                  {errors.bg && <FieldError message={errors.bg} className={s.fieldError} iconColor="#d07070"/>}

                  {bgData && (
                    <>
                      <div className={s.traitBox}>
                        <div className={s.traitBoxTitle}>{bgI18n?.feature.name ?? bgData.feature.name}</div>
                        <p className={s.traitBoxDesc}>{bgI18n?.feature.desc ?? bgData.feature.desc}</p>
                        <div className={s.bgMeta}>
                          <span className={s.bgMetaItem}>{tr.bgGoldMeta.replace("{n}", String(bgData.startingGold))}</span>
                          <span className={s.bgMetaItem}>{bgI18n?.toolOrLang ?? bgData.toolOrLang}</span>
                        </div>
                      </div>

                      {/* Class skill picker */}
                      <div className={s.fieldGroup}>
                        <div className={s.sectionTitle}>
                          {tr.bgChooseSkillsFmt.replace("{n}", String(classData?.skillCount ?? 2))}
                        </div>
                        <div className={s.skillGrid}>
                          {(classData?.skillPool ?? []).map((skill) => {
                            const fromBg      = bgData.skills.includes(skill);
                            const fromClass   = chosenSkills.includes(skill);
                            const needed      = classData?.skillCount ?? 2;
                            const pickedCount = chosenSkills.filter((sk) => !bgData.skills.includes(sk)).length;
                            const canAdd      = pickedCount < needed;

                            return (
                              <button
                                key={skill}
                                type="button"
                                className={cx(s.skillChip, (fromBg || fromClass) && s.skillChipSelected, fromBg && s.skillChipLocked)}
                                onClick={() => !fromBg && toggleSkill(skill)}
                                disabled={fromBg || (!fromClass && !canAdd)}
                              >
                                {fromBg ? "✦ " : fromClass ? "● " : ""}{skillNames[skill] ?? skill}
                              </button>
                            );
                          })}
                        </div>
                        {errors.skills && <FieldError message={errors.skills} className={s.fieldError} iconColor="#d07070"/>}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── STEP 4: EQUIPO ──────────────────────────────── */}
              {step === 4 && (
                <div className={s.stepContent}>
                  {classData && (
                    <>
                      {classData.equipment.length > 0 && (
                        <div className={s.traitBox}>
                          <div className={s.traitBoxTitle}>{tr.classEquipFixed}</div>
                          <ul className={s.equipList}>
                            {classData.equipment.map((item) => (
                              <li key={item} className={s.equipItem}>
                                <span className={s.equipBullet}>⚔</span> {translateItem(lang, item)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {classData.equipmentChoices.map((choice, ci) => (
                        <div key={ci} className={s.fieldGroup}>
                          <div className={s.sectionTitle}>
                            {getEquipLabel(lang, choice.label)}
                            <span className={s.sectionTitleSub}> — {tr.classChooseOne}</span>
                          </div>
                          <div className={s.equipChoiceGrid}>
                            {choice.options.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                className={cx(s.equipChoiceCard, equipChoices[ci] === opt && s.equipChoiceCardSelected)}
                                onClick={() => {
                                  setEquipChoices((p) => ({ ...p, [ci]: opt }));
                                  setErrors((p) => ({ ...p, equip: undefined as unknown as string }));
                                }}
                              >
                                <span className={s.equipChoiceIcon}>{equipChoices[ci] === opt ? "●" : "○"}</span>
                                <span className={s.equipChoiceText}>{translateItem(lang, opt)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      {errors.equip && <FieldError message={errors.equip} className={s.fieldError} iconColor="#d07070"/>}

                      {bgData && (
                        <div className={s.traitBox} style={{ marginTop: 8 }}>
                          <div className={s.traitBoxTitle}>{tr.bgGoldSection}</div>
                          <p className={s.traitBoxDesc}>
                            {tr.bgGoldFmt.replace("{n}", bgData.name).replace("{g}", String(bgData.startingGold))}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── STEP 5: IDENTIDAD ───────────────────────────── */}
              {step === 5 && (
                <div className={s.stepContent}>

                  {/* Character summary card */}
                  {raceData && classData && bgData && (
                    <>
                    <div className={s.summaryBanner}>
                      <div className={s.summaryItem}>
                        <div className={s.summaryLabel}>{tr.summaryRace}</div>
                        <div className={s.summaryVal}>{subraceData ? `${raceData.name} · ${subraceData.name}` : raceData.name}</div>
                      </div>
                      <div className={s.summarySep}/>
                      <div className={s.summaryItem}>
                        <div className={s.summaryLabel}>{tr.summaryClass}</div>
                        <div className={s.summaryVal}>{classData.name}</div>
                      </div>
                      <div className={s.summarySep}/>
                      <div className={s.summaryItem}>
                        <div className={s.summaryLabel}>{tr.summaryBg}</div>
                        <div className={s.summaryVal}>{bgData.name}</div>
                      </div>
                      <div className={s.summarySep}/>
                      <div className={s.summaryItem}>
                        <div className={s.summaryLabel}>{tr.summaryHp}</div>
                        <div className={s.summaryVal}>{Math.max(1, maxHp)}</div>
                      </div>
                    </div>
                    <div className={s.traitBox}>
                      <div className={s.traitBoxTitle}>{tr.classEquipInit}</div>
                      <ul className={s.equipList}>
                        {classData.equipment.map((item) => (
                          <li key={item} className={s.equipItem}>
                            <span className={s.equipBullet}>⚔</span> {translateItem(lang, item)}
                          </li>
                        ))}
                        {Object.values(equipChoices).map((item, i) => (
                          <li key={`chosen-${i}`} className={s.equipItem}>
                            <span className={s.equipBullet}>⚔</span> {translateItem(lang, item)}
                          </li>
                        ))}
                        <li className={s.equipItem}>
                          <span className={s.equipBullet}>◈</span> {bgData.startingGold} {tr.equipGold} <span style={{ color: "#4a3510", fontStyle: "italic" }}>({tr.equipGoldBg})</span>
                        </li>
                      </ul>
                    </div>
                    </>
                  )}

                  {/* Name */}
                  <div className={s.fieldGroup}>
                    <label className={s.label} htmlFor="char-name">
                      {tr.identityName} <span className={s.labelRequired}>{tr.identityRequired}</span>
                    </label>
                    <input
                      id="char-name"
                      className={cx(s.input, errors.name && s.inputError)}
                      value={name}
                      onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined as unknown as string })); }}
                      placeholder={tr.identityNamePh}
                      maxLength={60}
                      autoFocus
                    />
                    {errors.name && <FieldError message={errors.name} className={s.fieldError} iconColor="#d07070"/>}
                  </div>

                  {/* Alignment */}
                  <div className={s.fieldGroup}>
                    <div className={s.label}>{tr.identityAlignment} <span className={s.labelOptional}>{tr.identityOptional}</span></div>
                    <div className={s.alignGrid}>
                      {ALIGNMENTS.map((al) => {
                        const ali = getAlignI18n(lang, al.id);
                        return (
                          <button
                            key={al.id}
                            type="button"
                            className={cx(s.alignCard, alignment === al.id && s.alignCardSelected)}
                            onClick={() => setAlignment((p) => p === al.id ? "" : al.id)}
                            title={ali?.desc ?? al.desc}
                          >
                            <div className={s.alignLabel}>{ali?.label ?? al.label}</div>
                            <div className={s.alignDesc}>{ali?.desc ?? al.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Portrait */}
                  <div className={s.fieldGroup}>
                    <div className={s.label}>{tr.identityPortrait} <span className={s.labelOptional}>{tr.identityOptional}</span></div>
                    <div className={s.portraitRow}>
                      <div
                        className={cx(s.portraitFrame, imagePreview && s.portraitFrameFilled)}
                        onClick={() => !imageUploading && fileInputRef.current?.click()}
                        role="button" tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                        aria-label={tr.identityUploadBtn}
                      >
                        {imagePreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imagePreview} alt="Retrato" className={s.portraitImg}/>
                        ) : (
                          <div className={s.portraitPlaceholder}>
                            <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
                              <circle cx="15" cy="10" r="5" fill="none" stroke="#7a5c1e" strokeWidth="1.5"/>
                              <path d="M4 28c0-6 5-10 11-10s11 4 11 10" fill="none" stroke="#7a5c1e" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            <span className={s.portraitPlaceholderText}>{tr.identityUploadBtn}</span>
                          </div>
                        )}
                        {imageUploading && <div className={s.portraitOverlay}><span className={s.portraitSpinner}/></div>}
                      </div>
                      <div className={s.portraitMeta}>
                        <p className={s.portraitHint}>{tr.identityPortraitHint}</p>
                        <p className={s.portraitHint} style={{ opacity: 0.5, fontSize: "11px" }}>{tr.identityPortraitFmt}</p>
                        {imageUrl && !imageUploading && (
                          <p className={s.portraitSuccess}>
                            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                              <circle cx="6" cy="6" r="5" fill="none" stroke="#4a9a5a" strokeWidth="1.4"/>
                              <path d="M3.5 6l2 2 3-3.5" stroke="#4a9a5a" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {tr.identityPortraitOk}
                          </p>
                        )}
                        {imageError && <p className={s.portraitError}>{imageError}</p>}
                        <div className={s.portraitActions}>
                          <button type="button" className={s.portraitBtn} onClick={() => fileInputRef.current?.click()} disabled={imageUploading}>
                            {imagePreview ? tr.identityPortraitChange : tr.identityPortraitSelect}
                          </button>
                          {imagePreview && (
                            <button type="button" className={s.portraitBtnRemove} onClick={() => { setImagePreview(null); setImageUrl(null); setImageError(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} disabled={imageUploading}>
                              {tr.identityPortraitRemove}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className={s.hiddenInput} onChange={handleImageChange}/>
                  </div>

                  {/* Backstory */}
                  <div className={s.fieldGroup}>
                    <label className={s.label} htmlFor="char-backstory">
                      {tr.identityBackstory} <span className={s.labelOptional}>{tr.identityOptional}</span>
                    </label>
                    <textarea
                      id="char-backstory"
                      className={s.textarea}
                      value={backstory}
                      onChange={(e) => setBackstory(e.target.value)}
                      placeholder={tr.identityBackstoryPh}
                      rows={5}
                      maxLength={2000}
                    />
                    <div className={s.charCount}>{backstory.length}/2000</div>
                  </div>

                  {/* Final stats preview */}
                  {allAssigned && (
                    <div className={s.finalStats}>
                      <div className={s.finalStatsTitle}>{tr.identityFinalStats}</div>
                      <div className={s.finalStatRow}>
                        {STAT_KEYS.map((k) => (
                          <div key={k} className={s.finalStatItem}>
                            <div className={cx(s.finalStatMod, mod(finalStats[k]) > 0 ? s.statModPos : mod(finalStats[k]) < 0 ? s.statModNeg : s.statModZero)}>
                              {modStr(finalStats[k])}
                            </div>
                            <div className={s.finalStatValue}>{finalStats[k]}</div>
                            <div className={s.finalStatAbbr}>{statAbbr[k] ?? STAT_META[k].abbr}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className={s.stepNav}>
                {step > 0 ? (
                  <button key="back" type="button" className={s.btnSecondary} onClick={goBack} disabled={submitting}>{tr.btnBack}</button>
                ) : (
                  <button key="cancel" type="button" className={s.btnSecondary} onClick={() => router.push("/dashboard")} disabled={submitting}>{tr.btnCancel}</button>
                )}
                {step < STEPS.length - 1 ? (
                  <button key="next" type="button" className={s.btnPrimary} onClick={goNext}>{tr.btnNext}</button>
                ) : (
                  <button key="submit" type="submit" className={s.btnPrimary} disabled={submitting}>
                    {submitting ? tr.btnSubmitting : tr.btnSubmit}
                  </button>
                )}
              </div>

            </form>
          </div>
          <div className={s.borderBottom} />
        </div>
      </div>
    </div>
  );
}
