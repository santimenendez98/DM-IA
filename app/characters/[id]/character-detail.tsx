"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCurrUser } from "@/lib/auth";
import { loader } from "@/lib/loader";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Character, CharacterStats, CharacterSpell } from "@/types/character";
import type { Campaign } from "@/types/campaing";
import { cx } from "@/components/cx";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/translations";
import s from "./character-detail.module.css";
import {
  KNOWN_CASTERS,
  PREPARED_CASTERS,
  SPELL_GAINS,
  getSpellsForClass,
  type Spell,
} from "@/app/data/spells";
import { getClassFeatures, getRaceTraits } from "@/lib/dnd-i18n";
import { translateSpell } from "@/lib/spell-i18n";
import { translateItem } from "@/lib/equipment-i18n";

// ── Stat helpers ───────────────────────────────────────────────

const STAT_KEYS: (keyof CharacterStats)[] = [
  "strength", "dexterity", "constitution",
  "intelligence", "wisdom", "charisma",
];

const STAT_META: Record<keyof CharacterStats, { abbr: string; full: string }> = {
  strength:     { abbr: "FUE", full: "Fuerza" },
  dexterity:    { abbr: "DES", full: "Destreza" },
  constitution: { abbr: "CON", full: "Constitución" },
  intelligence: { abbr: "INT", full: "Inteligencia" },
  wisdom:       { abbr: "SAB", full: "Sabiduría" },
  charisma:     { abbr: "CAR", full: "Carisma" },
};

function rawMod(score: number): number { return Math.floor((score - 10) / 2); }
function statMod(score: number): string { const m = rawMod(score); return m >= 0 ? `+${m}` : `${m}`; }
function profBonus(level: number): number { return Math.floor((level - 1) / 4) + 2; }
function fmtBonus(n: number): string { return n >= 0 ? `+${n}` : `${n}`; }

// ── D&D Static data ────────────────────────────────────────────

const SKILLS: { name: string; stat: keyof CharacterStats }[] = [
  { name: "Acrobacias",          stat: "dexterity" },
  { name: "Manejo de Animales",  stat: "wisdom" },
  { name: "Arcanos",             stat: "intelligence" },
  { name: "Atletismo",           stat: "strength" },
  { name: "Engaño",              stat: "charisma" },
  { name: "Historia",            stat: "intelligence" },
  { name: "Perspicacia",         stat: "wisdom" },
  { name: "Intimidación",        stat: "charisma" },
  { name: "Investigación",       stat: "intelligence" },
  { name: "Medicina",            stat: "wisdom" },
  { name: "Naturaleza",          stat: "intelligence" },
  { name: "Percepción",          stat: "wisdom" },
  { name: "Interpretación",      stat: "charisma" },
  { name: "Persuasión",          stat: "charisma" },
  { name: "Religión",            stat: "intelligence" },
  { name: "Juego de Manos",      stat: "dexterity" },
  { name: "Sigilo",              stat: "dexterity" },
  { name: "Supervivencia",       stat: "wisdom" },
];

const CLASS_SAVE_PROFS: Record<string, (keyof CharacterStats)[]> = {
  "Guerrero":   ["strength", "constitution"],
  "Mago":       ["intelligence", "wisdom"],
  "Clérigo":    ["wisdom", "charisma"],
  "Pícaro":     ["dexterity", "intelligence"],
  "Bárbaro":    ["strength", "constitution"],
  "Bardo":      ["dexterity", "charisma"],
  "Druida":     ["intelligence", "wisdom"],
  "Monje":      ["strength", "dexterity"],
  "Paladín":    ["wisdom", "charisma"],
  "Explorador": ["strength", "dexterity"],
  "Hechicero":  ["constitution", "charisma"],
  "Brujo":      ["wisdom", "charisma"],
};

const RACE_BASE_SPEED: Record<string, number> = {
  "Humano": 30, "Elfo": 30, "Enano": 25, "Mediano": 25,
  "Dracónido": 30, "Gnomo": 25, "Semielfo": 30, "Semiorco": 30, "Tiefling": 30,
};

const CLASS_FEATURES: Record<string, { name: string; desc: string }[]> = {
  "Guerrero": [
    { name: "Estilo de combate",   desc: "Elige Arquería, Defensa, Duelo, Lucha con arma grande o Combate con dos armas." },
    { name: "Recuperación",        desc: "Acción adicional: recupera 1d10 + nivel en PV una vez entre descansos." },
  ],
  "Mago": [
    { name: "Lanzamiento de hechizos", desc: "Lanza hechizos usando INT. CD = 8 + mod INT + competencia." },
    { name: "Recuperación arcana",     desc: "Recupera ranuras en descanso corto (total ≤ ½ nivel mago)." },
  ],
  "Clérigo": [
    { name: "Lanzamiento de hechizos", desc: "Lanza hechizos divinos usando SAB. CD = 8 + mod SAB + competencia." },
    { name: "Dominio divino",          desc: "Elige un dominio que otorga hechizos adicionales y poderes especiales." },
  ],
  "Pícaro": [
    { name: "Pericia (×2)",       desc: "Dobla el bono de competencia en dos habilidades elegidas." },
    { name: "Ataque furtivo 1d6", desc: "Daño extra cuando tienes ventaja o un aliado adyacente al objetivo." },
    { name: "Argot de ladrones",  desc: "Lenguaje secreto del hampa comprensible solo por otros pícaros." },
  ],
  "Bárbaro": [
    { name: "Furia (2/desc. largo)",  desc: "Ventaja en FUE, +2 daño cuerpo a cuerpo y resistencia a daño físico durante 1 min." },
    { name: "Defensa sin armadura",   desc: "Sin armadura: CA = 10 + mod DES + mod CON." },
  ],
  "Bardo": [
    { name: "Lanzamiento de hechizos",  desc: "Lanza hechizos usando CAR. Conoces 2 trucos y 2 hechizos de nivel 1." },
    { name: "Inspiración bárdica (d6)", desc: "Otorgas un d6 a un aliado para sumar a una tirada. Usos = mod CAR por desc. largo." },
  ],
  "Druida": [
    { name: "Idioma druídico",         desc: "Conoces el lenguaje secreto de los druidas." },
    { name: "Lanzamiento de hechizos", desc: "Usa SAB para preparar y lanzar hechizos de druida cada día." },
  ],
  "Monje": [
    { name: "Defensa sin armadura", desc: "Sin armadura ni escudo: CA = 10 + mod DES + mod SAB." },
    { name: "Artes marciales",      desc: "Usa DES en vez de FUE. Daño desarmado: 1d4. Ataque adicional desarmado." },
  ],
  "Paladín": [
    { name: "Sentido divino",      desc: "Detectas celestiales, demonios o no-muertos a 18 m. Usos = 1 + mod CAR/desc. largo." },
    { name: "Imposición de manos", desc: "Restauras PV con el toque. Reserva = 5 × nivel. Cura enfermedades (5 PV)." },
  ],
  "Explorador": [
    { name: "Enemigo predilecto", desc: "Ventaja en Supervivencia para rastrear el tipo de enemigo elegido." },
    { name: "Explorador natural", desc: "En tu terreno favorito no te pierdes y eres más eficiente buscando alimento." },
  ],
  "Hechicero": [
    { name: "Lanzamiento de hechizos", desc: "Lanza hechizos usando CAR. Conoces 4 trucos y 2 hechizos de nivel 1." },
    { name: "Origen hechiceril",       desc: "Linaje Dracónico o Magia Salvaje: otorga hechizos adicionales y un rasgo." },
  ],
  "Brujo": [
    { name: "Patrón de ultratumba", desc: "Elige un patrón (Archifeérico, Demonio, Gran Anciano) con hechizos y rasgo." },
    { name: "Magia del pacto",      desc: "Lanza hechizos usando CAR. Las ranuras se recuperan en descanso corto." },
  ],
};

const RACE_TRAITS: Record<string, string[]> = {
  "Humano":    ["+1 a todos los atributos", "Idioma adicional a elección"],
  "Elfo":      ["Visión en la oscuridad (18 m)", "Resistencia feérica", "Sentidos agudos (competencia en Percepción)", "Trance — medita en lugar de dormir"],
  "Enano":     ["Visión en la oscuridad (18 m)", "Resistencia al veneno", "Entrenamiento con hacha y martillo de guerra", "Herramientas de artesano"],
  "Mediano":   ["Afortunado — re-lanza los 1 naturales", "Valiente — ventaja contra el miedo", "Agilidad del mediano"],
  "Dracónido": ["Arma de aliento (1d10, CD 8 + mod CON + competencia)", "Resistencia al daño según el dragón ancestral", "Lenguaje dracónico"],
  "Gnomo":     ["Visión en la oscuridad (18 m)", "Astucia gnómica — ventaja en salvaciones mágicas de INT, SAB y CAR"],
  "Semielfo":  ["Visión en la oscuridad (18 m)", "Resistencia feérica", "Versatilidad de habilidades — competencia en 2 habilidades a elección"],
  "Semiorco":  ["Visión en la oscuridad (18 m)", "Resistencia implacable — queda con 1 PV en lugar de caer a 0 (1/desc. largo)", "Ataques salvajes — críticos infligen 1 dado de daño adicional", "Competencia en Intimidación"],
  "Tiefling":  ["Visión en la oscuridad (18 m)", "Resistencia infernal — resistencia al daño de fuego", "Legado infernal: Taumaturgia + Represalia infernal + Oscuridad"],
};

// ── Level-up data ──────────────────────────────────────────────

const CLASS_HIT_DIE: Record<string, number> = {
  "Guerrero": 10, "Mago": 6, "Clérigo": 8, "Pícaro": 8,
  "Bárbaro": 12, "Bardo": 8, "Druida": 8, "Monje": 8,
  "Paladín": 10, "Explorador": 10, "Hechicero": 6, "Brujo": 8,
};

type LevelFeature = { name: string; desc: string };
type LevelEntry = { features: LevelFeature[]; isASI: boolean };

const CLASS_PROGRESSION: Record<string, Record<number, LevelEntry>> = {
  "Guerrero": {
    2:  { isASI: false, features: [{ name: "Arremetida", desc: "Acción adicional para Atacar (1 ataque), Correr, Esconderse o Desengancharse. 1 uso/desc. corto." }] },
    3:  { isASI: false, features: [{ name: "Arquetipo Marcial", desc: "Elige especialización: Campeón (críticos 19-20), Maestro de Batalla (maniobras) o Caballero Arcano (hechizos)." }] },
    4:  { isASI: true,  features: [] },
    5:  { isASI: false, features: [{ name: "Ataque adicional", desc: "Realizas 2 ataques al usar la acción de Atacar." }] },
    6:  { isASI: true,  features: [] },
    7:  { isASI: false, features: [{ name: "Rasgo de arquetipo (nv. 7)", desc: "Ganas el rasgo de nivel 7 de tu arquetipo marcial." }] },
    8:  { isASI: true,  features: [] },
    9:  { isASI: false, features: [{ name: "Indomable (1 uso)", desc: "Repite una tirada de salvación fallida 1 vez por desc. largo." }] },
    10: { isASI: false, features: [{ name: "Rasgo de arquetipo (nv. 10)", desc: "Ganas el rasgo de nivel 10 de tu arquetipo marcial." }] },
    11: { isASI: false, features: [{ name: "Ataque adicional ×3", desc: "Realizas 3 ataques al usar la acción de Atacar." }] },
    12: { isASI: true,  features: [] },
    13: { isASI: false, features: [{ name: "Indomable (2 usos)", desc: "2 usos de Indomable por desc. largo." }] },
    14: { isASI: true,  features: [] },
    15: { isASI: false, features: [{ name: "Rasgo de arquetipo (nv. 15)", desc: "Ganas el rasgo de nivel 15 de tu arquetipo marcial." }] },
    16: { isASI: true,  features: [] },
    17: { isASI: false, features: [{ name: "Arremetida (2 usos)", desc: "2 usos de Arremetida por desc. corto." }, { name: "Indomable (3 usos)", desc: "3 usos de Indomable por desc. largo." }] },
    18: { isASI: false, features: [{ name: "Rasgo de arquetipo (nv. 18)", desc: "Ganas el rasgo de nivel 18 de tu arquetipo marcial." }] },
    19: { isASI: true,  features: [] },
    20: { isASI: false, features: [{ name: "Ataque adicional ×4", desc: "Realizas 4 ataques al usar la acción de Atacar." }] },
  },
  "Mago": {
    2:  { isASI: false, features: [{ name: "Tradición Arcana", desc: "Elige una escuela: Evocación, Adivinación, Transmutación, Ilusionismo, Nigromancia, Encantamiento, Conjuración o Abjuración." }] },
    3:  { isASI: false, features: [{ name: "Rasgo de escuela arcana", desc: "Ganas el rasgo de nivel 2 de tu escuela arcana." }] },
    4:  { isASI: true,  features: [{ name: "Truco adicional", desc: "Aprendes un truco más del libro de hechizos del mago." }] },
    5:  { isASI: false, features: [{ name: "Ranuras de nivel 3", desc: "Desbloqueas ranuras de hechizo de nivel 3 (2 ranuras)." }] },
    6:  { isASI: false, features: [{ name: "Rasgo de escuela arcana (nv. 6)", desc: "Ganas el rasgo de nivel 6 de tu escuela arcana." }] },
    7:  { isASI: false, features: [{ name: "Ranuras de nivel 4", desc: "Desbloqueas ranuras de hechizo de nivel 4." }] },
    8:  { isASI: true,  features: [] },
    9:  { isASI: false, features: [{ name: "Ranuras de nivel 5", desc: "Desbloqueas ranuras de hechizo de nivel 5." }] },
    10: { isASI: false, features: [{ name: "Rasgo de escuela (nv. 10)", desc: "Ganas el rasgo de nivel 10." }, { name: "Truco adicional", desc: "Aprendes otro truco de mago." }] },
    11: { isASI: false, features: [{ name: "Ranuras de nivel 6", desc: "Desbloqueas 1 ranura de hechizo de nivel 6." }] },
    12: { isASI: true,  features: [] },
    13: { isASI: false, features: [{ name: "Ranuras de nivel 7", desc: "Desbloqueas 1 ranura de hechizo de nivel 7." }] },
    14: { isASI: false, features: [{ name: "Rasgo de escuela (nv. 14)", desc: "Ganas el rasgo de nivel 14 de tu escuela arcana." }] },
    15: { isASI: false, features: [{ name: "Ranuras de nivel 8", desc: "Desbloqueas 1 ranura de hechizo de nivel 8." }] },
    16: { isASI: true,  features: [] },
    17: { isASI: false, features: [{ name: "Ranuras de nivel 9", desc: "Desbloqueas 1 ranura de hechizo de nivel 9 — los más poderosos del juego." }] },
    18: { isASI: false, features: [{ name: "Maestría en hechizos", desc: "Lanza un hechizo de nivel 1 y uno de nivel 2 elegidos a voluntad, sin gastar ranuras." }] },
    19: { isASI: true,  features: [] },
    20: { isASI: false, features: [{ name: "Hechizos maestros", desc: "Lanza un hechizo de nivel 3 y uno de nivel 4 elegidos una vez sin gastar ranura (desc. largo)." }] },
  },
  "Clérigo": {
    2:  { isASI: false, features: [{ name: "Canalizar Divinidad (1/desc. corto)", desc: "Expulsar no-muertos o usar el efecto de tu dominio divino." }] },
    3:  { isASI: false, features: [{ name: "Hechizos de dominio nv. 2", desc: "Ganas los hechizos de dominio de nivel 2." }] },
    4:  { isASI: true,  features: [{ name: "Truco adicional", desc: "Aprendes un truco más de clérigo." }] },
    5:  { isASI: false, features: [{ name: "Destruir no-muertos (CR ½)", desc: "Los no-muertos de CR ½ o menos son destruidos al ser expulsados." }] },
    6:  { isASI: false, features: [{ name: "Canalizar Divinidad (2/desc. corto)", desc: "2 usos de Canalizar Divinidad por desc. corto." }, { name: "Rasgo de dominio (nv. 6)", desc: "Ganas el rasgo de nivel 6 de tu Dominio Divino." }] },
    7:  { isASI: false, features: [{ name: "Hechizos de dominio nv. 4", desc: "Ganas los hechizos de dominio de nivel 4." }] },
    8:  { isASI: true,  features: [{ name: "Destruir no-muertos (CR 1)", desc: "Los no-muertos de CR 1 o menos son destruidos al ser expulsados." }, { name: "Rasgo de dominio (nv. 8)", desc: "Suele otorgar Golpe Divino o Potencia Divina." }] },
    9:  { isASI: false, features: [{ name: "Hechizos de dominio nv. 5", desc: "Ganas los hechizos de dominio de nivel 5." }] },
    10: { isASI: false, features: [{ name: "Intervención divina", desc: "Pide ayuda a tu deidad: tirada igual o menor a tu nivel en d100. El DM decide el efecto (desc. largo si tiene éxito, o siempre después de 7 días de fracasos)." }] },
    11: { isASI: false, features: [{ name: "Destruir no-muertos (CR 2)", desc: "Los no-muertos de CR 2 o menos son destruidos al ser expulsados." }] },
    12: { isASI: true,  features: [] },
    13: { isASI: false, features: [{ name: "Hechizos de dominio nv. 7", desc: "Ganas los hechizos de dominio de nivel 7." }] },
    14: { isASI: false, features: [{ name: "Destruir no-muertos (CR 3)", desc: "Los no-muertos de CR 3 o menos son destruidos al ser expulsados." }] },
    15: { isASI: false, features: [{ name: "Hechizos de dominio nv. 8", desc: "Ganas los hechizos de dominio de nivel 8." }] },
    16: { isASI: true,  features: [] },
    17: { isASI: false, features: [{ name: "Destruir no-muertos (CR 4)", desc: "Los no-muertos de CR 4 o menos son destruidos al ser expulsados." }, { name: "Hechizos de dominio nv. 9", desc: "Ganas los poderosos hechizos de dominio de nivel 9." }, { name: "Rasgo de dominio (nv. 17)", desc: "Ganas el poderoso rasgo de nivel 17 de tu Dominio Divino." }] },
    18: { isASI: false, features: [{ name: "Canalizar Divinidad (3/desc. corto)", desc: "3 usos de Canalizar Divinidad por desc. corto." }] },
    19: { isASI: true,  features: [] },
    20: { isASI: false, features: [{ name: "Intervención divina perfecta", desc: "Tu llamada a la deidad funciona automáticamente sin necesidad de tirada." }] },
  },
  "Pícaro": {
    2:  { isASI: false, features: [{ name: "Acción artera", desc: "Acción adicional para: Correr, Desengancharse, Esconderse, Usar objeto o Activar magia." }] },
    3:  { isASI: false, features: [{ name: "Arquetipo de pícaro", desc: "Elige especialización: Ladrón, Asesino o Embaucador Arcano." }, { name: "Ataque furtivo 2d6", desc: "Tu ataque furtivo inflige 2d6 de daño adicional." }] },
    4:  { isASI: true,  features: [] },
    5:  { isASI: false, features: [{ name: "Ataque furtivo 3d6", desc: "Tu ataque furtivo inflige 3d6 de daño adicional." }, { name: "Esquiva mágica", desc: "TS de DES: si apruebas no recibes daño, si fallas solo recibes la mitad." }] },
    6:  { isASI: false, features: [{ name: "Pericia adicional", desc: "Dobla el bono de competencia en 2 habilidades más." }] },
    7:  { isASI: false, features: [{ name: "Ataque furtivo 4d6", desc: "Tu ataque furtivo inflige 4d6 de daño adicional." }, { name: "Evasión", desc: "TS de DES: si apruebas no recibes daño, si fallas solo recibes la mitad." }] },
    8:  { isASI: true,  features: [] },
    9:  { isASI: false, features: [{ name: "Ataque furtivo 5d6", desc: "Tu ataque furtivo inflige 5d6 de daño adicional." }, { name: "Rasgo de arquetipo (nv. 9)", desc: "Ganas el rasgo de nivel 9 de tu arquetipo de pícaro." }] },
    10: { isASI: true,  features: [{ name: "Ataque furtivo 6d6", desc: "Tu ataque furtivo inflige 6d6 de daño adicional." }] },
    11: { isASI: false, features: [{ name: "Talento confiable", desc: "Si sacas 9 o menos en una prueba con competencia, trátalo como 10." }] },
    12: { isASI: true,  features: [{ name: "Ataque furtivo 7d6", desc: "Tu ataque furtivo inflige 7d6 de daño adicional." }] },
    13: { isASI: false, features: [{ name: "Rasgo de arquetipo (nv. 13)", desc: "Ganas el rasgo de nivel 13 de tu arquetipo de pícaro." }] },
    14: { isASI: false, features: [{ name: "Mente escurridiza", desc: "Ganas competencia en tiradas de salvación de SAB." }] },
    15: { isASI: false, features: [{ name: "Resbaladizo", desc: "Solo puedes ser paralizado o aturdido si lo haces voluntariamente." }] },
    16: { isASI: true,  features: [{ name: "Ataque furtivo 9d6", desc: "Tu ataque furtivo inflige 9d6 de daño adicional." }] },
    17: { isASI: false, features: [{ name: "Rasgo de arquetipo (nv. 17)", desc: "Ganas el poderoso rasgo de nivel 17 de tu arquetipo de pícaro." }] },
    18: { isASI: true,  features: [{ name: "Escurridizo", desc: "No puedes ser desaventajado en iniciativa ni sorprendido (si no estás incapacitado)." }] },
    19: { isASI: false, features: [{ name: "Esquiva de golpe", desc: "Cuando recibes daño, usa reacción para reducirlo a la mitad." }] },
    20: { isASI: false, features: [{ name: "Golpe de suerte", desc: "Convierte un ataque fallido o una salvación exitosa del objetivo en tu favor. 1/desc. largo." }] },
  },
  "Bárbaro": {
    2:  { isASI: false, features: [{ name: "Ataque irreflexivo", desc: "Ventaja en tus ataques con FUE a cambio de que los ataques contra ti también tengan ventaja." }, { name: "Sentido del peligro", desc: "Ventaja en TS de DES cuando puedes ver el peligro." }] },
    3:  { isASI: false, features: [{ name: "Senda Primitiva", desc: "Elige una senda: Berserker (furia extra), Tótem (poderes animales) u otra." }] },
    4:  { isASI: true,  features: [] },
    5:  { isASI: false, features: [{ name: "Ataque adicional", desc: "Realizas 2 ataques al usar la acción de Atacar." }, { name: "Movimiento rápido", desc: "Tu velocidad aumenta en 10 pies cuando no llevas armadura pesada." }] },
    6:  { isASI: false, features: [{ name: "Rasgo de senda (nv. 6)", desc: "Ganas el rasgo de nivel 6 de tu Senda Primitiva." }] },
    7:  { isASI: false, features: [{ name: "Instinto salvaje", desc: "Ventaja en iniciativa. Si eres sorprendido, puedes moverte y atacar si entras en furia." }] },
    8:  { isASI: true,  features: [] },
    9:  { isASI: false, features: [{ name: "Crítico brutal (1 dado)", desc: "En un golpe crítico, añades un dado de daño extra del arma." }] },
    10: { isASI: false, features: [{ name: "Rasgo de senda (nv. 10)", desc: "Ganas el rasgo de nivel 10 de tu Senda Primitiva." }, { name: "Intimidación con FUE", desc: "Puedes usar FUE en lugar de CAR en las pruebas de Intimidación." }] },
    11: { isASI: false, features: [{ name: "Furia persistente", desc: "Tu furia solo termina antes de tiempo si caes inconsciente." }] },
    12: { isASI: true,  features: [] },
    13: { isASI: false, features: [{ name: "Crítico brutal (2 dados)", desc: "En un golpe crítico, añades 2 dados de daño extra del arma." }] },
    14: { isASI: false, features: [{ name: "Rasgo de senda (nv. 14)", desc: "Ganas el poderoso rasgo de nivel 14 de tu Senda Primitiva." }] },
    15: { isASI: false, features: [{ name: "Furia implacable", desc: "Si caes a 0 PV en furia, haz TS de CON CD 10 para quedar en 1 PV." }] },
    16: { isASI: true,  features: [] },
    17: { isASI: false, features: [{ name: "Crítico brutal (3 dados)", desc: "En un golpe crítico, añades 3 dados de daño extra del arma." }] },
    18: { isASI: false, features: [{ name: "Poder primario indomable", desc: "Si una prueba de FUE es menor que tu puntuación de FUE, usa la puntuación." }] },
    19: { isASI: true,  features: [] },
    20: { isASI: false, features: [{ name: "Bestia primaria", desc: "FUE y CON aumentan en 4 cada una (máximo 24)." }] },
  },
  "Bardo": {
    2:  { isASI: false, features: [{ name: "Canción de descanso (d6)", desc: "Los aliados que te escuchen en un desc. corto recuperan 1d6 PV extra al gastar Dados de Golpe." }, { name: "Versatilidad arcana", desc: "Puedes sustituir un hechizo conocido al subir de nivel." }] },
    3:  { isASI: false, features: [{ name: "Colegio Bárdico", desc: "Elige un colegio: Valor (armadura y ataques), Saber (competencias y hechizos extra) u otro." }, { name: "Pericia (×2)", desc: "Dobla el bono de competencia en 2 habilidades elegidas." }] },
    4:  { isASI: true,  features: [{ name: "Truco adicional", desc: "Aprendes un truco más de bardo." }] },
    5:  { isASI: false, features: [{ name: "Inspiración bárdica (d8)", desc: "El dado de Inspiración pasa a d8." }, { name: "Fuente de inspiración", desc: "Recuperas usos de Inspiración en desc. corto O largo." }] },
    6:  { isASI: false, features: [{ name: "Contraencanto", desc: "Acción: otorgas ventaja a aliados en 30 pies en TS contra ser hechizados o asustados." }, { name: "Rasgo de colegio (nv. 6)", desc: "Ganas el rasgo de nivel 6 de tu Colegio Bárdico." }] },
    7:  { isASI: false, features: [] },
    8:  { isASI: true,  features: [] },
    9:  { isASI: false, features: [{ name: "Canción de descanso (d8)", desc: "El dado de Canción de Descanso pasa a d8." }] },
    10: { isASI: false, features: [{ name: "Inspiración bárdica (d10)", desc: "El dado de Inspiración pasa a d10." }, { name: "Secretos arcanos (×2)", desc: "Aprendes 2 hechizos de cualquier lista de magia." }, { name: "Truco adicional", desc: "Aprendes otro truco de bardo." }] },
    11: { isASI: false, features: [] },
    12: { isASI: true,  features: [] },
    13: { isASI: false, features: [{ name: "Canción de descanso (d10)", desc: "El dado de Canción de Descanso pasa a d10." }] },
    14: { isASI: false, features: [{ name: "Secretos arcanos (×4 total)", desc: "Aprendes 2 hechizos más de cualquier lista de magia." }, { name: "Rasgo de colegio (nv. 14)", desc: "Ganas el poderoso rasgo de nivel 14 de tu Colegio Bárdico." }] },
    15: { isASI: false, features: [{ name: "Inspiración bárdica (d12)", desc: "El dado de Inspiración pasa a d12, el máximo." }] },
    16: { isASI: true,  features: [] },
    17: { isASI: false, features: [{ name: "Canción de descanso (d12)", desc: "El dado de Canción de Descanso pasa a d12." }] },
    18: { isASI: false, features: [{ name: "Secretos arcanos superiores", desc: "Aprendes 2 hechizos más de cualquier lista de magia (pueden ser de nivel 6)." }] },
    19: { isASI: true,  features: [] },
    20: { isASI: false, features: [{ name: "Inspiración superior", desc: "Si sacas 1 o 2 en el dado de Inspiración, trátalo como 3." }] },
  },
  "Druida": {
    2:  { isASI: false, features: [{ name: "Forma Salvaje (CR ¼)", desc: "Acción adicional: te transformas en una bestia de CR ¼ o menos. Dura Nv/2 horas. 2 usos/desc. corto." }] },
    3:  { isASI: false, features: [{ name: "Círculo Druídico", desc: "Elige un círculo: Tierra (hechizos de terreno), Luna (transformaciones mejoradas) u otro." }] },
    4:  { isASI: true,  features: [{ name: "Forma Salvaje (CR ½)", desc: "Puedes transformarte en bestias de CR ½ o menos." }, { name: "Truco adicional", desc: "Aprendes un truco más de druida." }] },
    5:  { isASI: false, features: [{ name: "Ranuras de nivel 3", desc: "Desbloqueas ranuras de hechizo de nivel 3." }] },
    6:  { isASI: false, features: [{ name: "Rasgo de círculo (nv. 6)", desc: "Ganas el rasgo de nivel 6 de tu Círculo Druídico." }] },
    7:  { isASI: false, features: [{ name: "Forma Salvaje (CR 1)", desc: "Puedes transformarte en bestias de CR 1 o menos." }] },
    8:  { isASI: true,  features: [{ name: "Forma Salvaje (volar)", desc: "Puedes transformarte en bestias con velocidad de vuelo." }] },
    9:  { isASI: false, features: [{ name: "Ranuras de nivel 5", desc: "Desbloqueas ranuras de hechizo de nivel 5." }] },
    10: { isASI: false, features: [{ name: "Rasgo de círculo (nv. 10)", desc: "Ganas el rasgo de nivel 10 de tu Círculo Druídico." }] },
    11: { isASI: false, features: [] },
    12: { isASI: true,  features: [] },
    13: { isASI: false, features: [{ name: "Ranuras de nivel 7", desc: "Desbloqueas ranuras de hechizo de nivel 7." }] },
    14: { isASI: false, features: [{ name: "Rasgo de círculo (nv. 14)", desc: "Ganas el poderoso rasgo de nivel 14 de tu Círculo Druídico." }] },
    15: { isASI: false, features: [] },
    16: { isASI: true,  features: [] },
    17: { isASI: false, features: [{ name: "Ranuras de nivel 9", desc: "Desbloqueas ranuras de hechizo de nivel 9." }] },
    18: { isASI: false, features: [{ name: "Cuerpo eterno", desc: "Envejeces 10× más lento e eres inmune a enfermedades." }, { name: "Hechizos animalescos", desc: "Puedes lanzar hechizos de druida con V/S en Forma Salvaje." }] },
    19: { isASI: true,  features: [] },
    20: { isASI: false, features: [{ name: "Archidruida", desc: "Puedes usar Forma Salvaje un número ilimitado de veces." }] },
  },
  "Monje": {
    2:  { isASI: false, features: [{ name: "Ki (2 puntos)", desc: "Gasta ki para: Golpe de descanso (2 ataques adicionales), Paso del viento (Correr+Desengancharse) o Defensa ante el viento (esquivar). Recupera en desc. corto." }, { name: "Movimiento sin armadura", desc: "Tu velocidad aumenta en 10 pies sin armadura ni escudo." }] },
    3:  { isASI: false, features: [{ name: "Tradición Monástica", desc: "Elige una tradición: Mano Abierta (golpes supremos), Sombra (magia de sombras) o Cuatro Elementos (magia elemental)." }, { name: "Desviar proyectiles", desc: "Reacción: reduces el daño de un proyectil. Si lo reduces a 0, lo lanzas de vuelta." }] },
    4:  { isASI: true,  features: [{ name: "Caída lenta", desc: "Reacción: reduces el daño de caída en 5 × nivel de monje." }] },
    5:  { isASI: false, features: [{ name: "Ataque adicional", desc: "Realizas 2 ataques al usar la acción de Atacar." }, { name: "Golpe aturdidor", desc: "Al golpear: gasta 1 ki para que el objetivo haga TS de CON o quede aturdido hasta tu siguiente turno." }] },
    6:  { isASI: false, features: [{ name: "Golpes mágicos de ki", desc: "Tus ataques desarmados se consideran mágicos." }, { name: "Rasgo de tradición (nv. 6)", desc: "Ganas el rasgo de nivel 6 de tu Tradición Monástica." }] },
    7:  { isASI: false, features: [{ name: "Evasión", desc: "TS de DES: si apruebas no recibes daño, si fallas solo la mitad." }, { name: "Serenidad impenetrable", desc: "No puedes ser hechizado, asustado ni perder concentración involuntariamente." }] },
    8:  { isASI: true,  features: [] },
    9:  { isASI: false, features: [{ name: "Movimiento sin armadura +15", desc: "Puedes correr por superficies verticales y sobre el agua durante tu movimiento." }] },
    10: { isASI: false, features: [{ name: "Pureza de cuerpo", desc: "Inmune a enfermedades y venenos." }] },
    11: { isASI: false, features: [{ name: "Rasgo de tradición (nv. 11)", desc: "Ganas el rasgo de nivel 11 de tu Tradición Monástica." }] },
    12: { isASI: true,  features: [] },
    13: { isASI: false, features: [{ name: "Lengua del sol y la luna", desc: "Puedes comunicarte con cualquier criatura que hable al menos un idioma." }] },
    14: { isASI: false, features: [{ name: "Alma de diamante", desc: "Competencia en todas las tiradas de salvación. Cuando fallas una, gasta 1 ki para repetirla." }] },
    15: { isASI: false, features: [{ name: "Cuerpo eterno", desc: "No envejeces y no puedes ser envejecido mágicamente." }] },
    16: { isASI: true,  features: [] },
    17: { isASI: false, features: [{ name: "Rasgo de tradición (nv. 17)", desc: "Ganas el poderoso rasgo de nivel 17 de tu Tradición Monástica." }] },
    18: { isASI: false, features: [{ name: "Cuerpo vacío", desc: "Gasta 4 ki: eres invisible y tienes resistencia a todo el daño excepto fuerza durante 1 min." }] },
    19: { isASI: true,  features: [] },
    20: { isASI: false, features: [{ name: "Ser perfecto", desc: "DES y SAB aumentan en 2 cada una. Tu máximo para esos atributos es ahora 26." }] },
  },
  "Paladín": {
    2:  { isASI: false, features: [{ name: "Lanzamiento de hechizos", desc: "Preparas mod CAR + ½ nv. paladín hechizos divinos. Usas CAR como atributo de lanzamiento." }, { name: "Castigo divino", desc: "Al golpear, gasta una ranura para infligir 2d8 radiante adicional por nivel de ranura." }] },
    3:  { isASI: false, features: [{ name: "Sagrado Juramento", desc: "Elige un juramento: Devoción (guardián de luz), Antiguos (protector de la naturaleza) o Venganza (cazador de maldad)." }, { name: "Canal divino (1/desc. corto)", desc: "Usa el poder de tu juramento para efectos especiales." }] },
    4:  { isASI: true,  features: [] },
    5:  { isASI: false, features: [{ name: "Ataque adicional", desc: "Realizas 2 ataques al usar la acción de Atacar." }] },
    6:  { isASI: false, features: [{ name: "Aura de protección (10 pies)", desc: "Tú y aliados a 10 pies añaden tu mod CAR a todas las tiradas de salvación." }] },
    7:  { isASI: false, features: [{ name: "Rasgo de juramento (nv. 7)", desc: "Ganas el rasgo de nivel 7 de tu Sagrado Juramento." }] },
    8:  { isASI: true,  features: [] },
    9:  { isASI: false, features: [] },
    10: { isASI: false, features: [{ name: "Aura de coraje (10 pies)", desc: "Tú y aliados a 10 pies sois inmunes al miedo." }] },
    11: { isASI: false, features: [{ name: "Castigo divino mejorado", desc: "Tu Castigo Divino inflige siempre el máximo de daño sin importar el tipo." }] },
    12: { isASI: true,  features: [] },
    13: { isASI: false, features: [] },
    14: { isASI: false, features: [{ name: "Toque limpiador", desc: "Termina hechizos negativos sobre ti o un aliado. Usos = mod CAR/desc. largo." }] },
    15: { isASI: false, features: [{ name: "Rasgo de juramento (nv. 15)", desc: "Ganas el rasgo de nivel 15 de tu Sagrado Juramento." }] },
    16: { isASI: true,  features: [] },
    17: { isASI: false, features: [{ name: "Aura mejorada (30 pies)", desc: "El radio de tus auras de Protección y Coraje aumenta a 30 pies." }] },
    18: { isASI: false, features: [] },
    19: { isASI: true,  features: [] },
    20: { isASI: false, features: [{ name: "Forma sagrada", desc: "1 hora de transformación divina: ventaja en TS, resistencia a daño, aura de Protección +10 a las salvaciones." }] },
  },
  "Explorador": {
    2:  { isASI: false, features: [{ name: "Estilo de combate", desc: "Elige: Arquería (+2 a ataques a distancia), Defensa (+1 CA), o Combate con dos armas." }, { name: "Lanzamiento de hechizos", desc: "Acceso a hechizos de explorador usando SAB. 2 hechizos conocidos de nivel 1." }] },
    3:  { isASI: false, features: [{ name: "Arquetipo de Explorador", desc: "Elige especialización: Cazador (maestro de criaturas) o Señor de las Bestias (compañero animal)." }, { name: "Conciencia primaria", desc: "Gasta ranura de hechizo para sentir criaturas del tipo de tu enemigo predilecto a 1 milla." }] },
    4:  { isASI: true,  features: [] },
    5:  { isASI: false, features: [{ name: "Ataque adicional", desc: "Realizas 2 ataques al usar la acción de Atacar." }] },
    6:  { isASI: false, features: [{ name: "Enemigo predilecto adicional", desc: "Elige un segundo tipo de Enemigo Predilecto y un segundo Terreno Favorito." }] },
    7:  { isASI: false, features: [{ name: "Rasgo de arquetipo (nv. 7)", desc: "Ganas el rasgo de nivel 7 de tu Arquetipo de Explorador." }] },
    8:  { isASI: true,  features: [{ name: "Zancada del mundo", desc: "Los terrenos difíciles mágicos no te cuestan movimiento adicional." }] },
    9:  { isASI: false, features: [] },
    10: { isASI: false, features: [{ name: "Enemigo predilecto adicional (3)", desc: "Elige un tercer tipo de Enemigo Predilecto y Terreno Favorito." }, { name: "Caminante en la naturaleza", desc: "Inmune a veneno y enfermedad. Imposible perderse en terreno natural." }] },
    11: { isASI: false, features: [{ name: "Rasgo de arquetipo (nv. 11)", desc: "Ganas el rasgo de nivel 11 de tu Arquetipo de Explorador." }] },
    12: { isASI: true,  features: [] },
    13: { isASI: false, features: [] },
    14: { isASI: false, features: [{ name: "Desvanecerse", desc: "Ventaja en TS contra hechizos y habilidades de tus Enemigos Predilectos." }] },
    15: { isASI: false, features: [{ name: "Rasgo de arquetipo (nv. 15)", desc: "Ganas el rasgo de nivel 15 de tu Arquetipo de Explorador." }] },
    16: { isASI: true,  features: [] },
    17: { isASI: false, features: [] },
    18: { isASI: false, features: [{ name: "Sentidos de explorador", desc: "No tienes desventaja al atacar a criaturas invisibles a 30 pies si puedes percibirlas." }] },
    19: { isASI: true,  features: [] },
    20: { isASI: false, features: [{ name: "Cazador letal", desc: "Cuando atacas a un Enemigo Predilecto puedes usar la acción para hacerlo con ventaja en todos los ataques del turno." }] },
  },
  "Hechicero": {
    2:  { isASI: false, features: [{ name: "Fuente de magia (2 puntos)", desc: "Puntos de hechicería: convierte ranuras en puntos y viceversa para crear Metamagia o ranuras adicionales." }] },
    3:  { isASI: false, features: [{ name: "Metamagia (×2)", desc: "Elige 2 opciones: Distante, Extendido, Poderoso, Sutil, Acelerado (acción adicional) o Gemelo (2 objetivos)." }] },
    4:  { isASI: true,  features: [{ name: "Truco adicional", desc: "Aprendes un truco más de hechicero." }] },
    5:  { isASI: false, features: [{ name: "Ranuras de nivel 3", desc: "Desbloqueas ranuras de hechizo de nivel 3." }] },
    6:  { isASI: false, features: [{ name: "Rasgo de origen (nv. 6)", desc: "Ganas el rasgo de nivel 6 de tu Origen Hechiceril." }] },
    7:  { isASI: false, features: [{ name: "Ranuras de nivel 4", desc: "Desbloqueas ranuras de hechizo de nivel 4." }] },
    8:  { isASI: true,  features: [] },
    9:  { isASI: false, features: [{ name: "Ranuras de nivel 5", desc: "Desbloqueas ranuras de hechizo de nivel 5." }] },
    10: { isASI: false, features: [{ name: "Metamagia adicional", desc: "Aprendes una opción de Metamagia más." }, { name: "Truco adicional", desc: "Aprendes otro truco de hechicero." }] },
    11: { isASI: false, features: [{ name: "Ranuras de nivel 6", desc: "Desbloqueas 1 ranura de hechizo de nivel 6." }] },
    12: { isASI: true,  features: [] },
    13: { isASI: false, features: [{ name: "Ranuras de nivel 7", desc: "Desbloqueas 1 ranura de hechizo de nivel 7." }] },
    14: { isASI: false, features: [{ name: "Rasgo de origen (nv. 14)", desc: "Ganas el poderoso rasgo de nivel 14 de tu Origen Hechiceril." }] },
    15: { isASI: false, features: [{ name: "Ranuras de nivel 8", desc: "Desbloqueas 1 ranura de hechizo de nivel 8." }] },
    16: { isASI: true,  features: [] },
    17: { isASI: false, features: [{ name: "Ranuras de nivel 9", desc: "Desbloqueas 1 ranura de hechizo de nivel 9." }, { name: "Metamagia adicional", desc: "Aprendes una opción de Metamagia más." }] },
    18: { isASI: false, features: [{ name: "Rasgo de origen (nv. 18)", desc: "Ganas el poderoso rasgo de nivel 18 de tu Origen Hechiceril." }] },
    19: { isASI: true,  features: [] },
    20: { isASI: false, features: [{ name: "Restauración de hechicería", desc: "Al inicio de tu turno con 4 puntos de hechicería o menos, recuperas 4 puntos." }] },
  },
  "Brujo": {
    2:  { isASI: false, features: [{ name: "Invocaciones sobrenaturales (×2)", desc: "Elige 2 invocaciones permanentes: Visión del diablo, Lanzar hechizos a voluntad, Armadura arcana, etc." }] },
    3:  { isASI: false, features: [{ name: "Don del Pacto", desc: "Elige el tipo de pacto: Cadena (familiar mejorado), Cuchilla (arma de sombra) o Libro (grimorio con trucos)." }, { name: "Invocación adicional", desc: "Aprendes una invocación sobrenatural más." }] },
    4:  { isASI: true,  features: [{ name: "Truco adicional", desc: "Aprendes un truco más de brujo." }] },
    5:  { isASI: false, features: [{ name: "Invocación adicional", desc: "Aprendes una invocación sobrenatural más. Ranuras de nivel 3." }] },
    6:  { isASI: false, features: [{ name: "Rasgo del patrón (nv. 6)", desc: "Ganas el rasgo de nivel 6 de tu Patrón de Ultratumba." }] },
    7:  { isASI: false, features: [{ name: "Invocación adicional", desc: "Aprendes una invocación sobrenatural más. Ranuras de nivel 4." }] },
    8:  { isASI: true,  features: [] },
    9:  { isASI: false, features: [{ name: "Invocación adicional", desc: "Aprendes una invocación sobrenatural más. Ranuras de nivel 5." }] },
    10: { isASI: false, features: [{ name: "Rasgo del patrón (nv. 10)", desc: "Ganas el rasgo de nivel 10 de tu Patrón de Ultratumba." }] },
    11: { isASI: false, features: [{ name: "Secreto arcano (nivel 6)", desc: "Aprendes un hechizo de nivel 6 de cualquier lista que puedes lanzar una vez por desc. largo." }] },
    12: { isASI: true,  features: [{ name: "Invocación adicional", desc: "Aprendes una invocación sobrenatural más." }] },
    13: { isASI: false, features: [{ name: "Secreto arcano (nivel 7)", desc: "Aprendes un hechizo de nivel 7 que puedes lanzar una vez por desc. largo." }] },
    14: { isASI: false, features: [{ name: "Rasgo del patrón (nv. 14)", desc: "Ganas el poderoso rasgo de nivel 14 de tu Patrón de Ultratumba." }] },
    15: { isASI: false, features: [{ name: "Secreto arcano (nivel 8)", desc: "Aprendes un hechizo de nivel 8 que puedes lanzar una vez por desc. largo." }] },
    16: { isASI: true,  features: [{ name: "Invocación adicional", desc: "Aprendes una invocación sobrenatural más." }] },
    17: { isASI: false, features: [{ name: "Secreto arcano (nivel 9)", desc: "Aprendes un hechizo de nivel 9 que puedes lanzar una vez por desc. largo." }] },
    18: { isASI: false, features: [{ name: "Invocación adicional", desc: "Aprendes una invocación sobrenatural más." }] },
    19: { isASI: true,  features: [] },
    20: { isASI: false, features: [{ name: "Maestro del conocimiento arcano", desc: "Puedes lanzar tus Secretos Arcanos una vez cada desc. corto en lugar de largo." }] },
  },
};

// ── AC calculation ─────────────────────────────────────────────

function calculateAC(character: Character): number {
  const dex = rawMod(character.stats.dexterity);
  const con = rawMod(character.stats.constitution);
  const wis = rawMod(character.stats.wisdom);
  const names = character.items.map((i) => i.name.toLowerCase());
  const has = (kw: string) => names.some((n) => n.includes(kw.toLowerCase()));
  const shield = has("escudo") ? 2 : 0;
  if (has("cota de malla"))       return 16 + shield;
  if (has("armadura de placas"))  return 18 + shield;
  if (has("cota de escamas"))     return 14 + Math.min(dex, 2) + shield;
  if (has("cuero tachonado"))     return 12 + dex + shield;
  if (has("armadura de cuero"))   return 11 + dex + shield;
  if (character.class === "Bárbaro") return 10 + dex + con;
  if (character.class === "Monje")   return 10 + dex + wis;
  return 10 + dex + shield;
}

// ── Backstory parser ───────────────────────────────────────────

function parseBackstory(raw: string | null): string {
  if (!raw) return "";
  const parts = raw.split("\n\n");
  if (parts[0].includes("Raza:") || parts[0].includes("Clase:")) {
    return parts.slice(1).join("\n\n").trim();
  }
  return raw;
}


// ── Helpers ────────────────────────────────────────────────────

type SlimJoinedCampaign = {
  id: string; name: string; setting: string; tone: string;
  started_at: string | null; my_characters: Array<{ id: string }>;
};

function mergeCampaigns(own: Campaign[], joined: SlimJoinedCampaign[]): Campaign[] {
  const ownIds = new Set(own.map((c) => c.id));
  return [
    ...own,
    ...joined
      .filter((j) => !ownIds.has(j.id))
      .map((j) => ({
        ...j,
        character_ids: j.my_characters.map((c) => c.id),
        user_id: "", system_prompt: null, story_context: null,
        is_public: false, game_language: "es", invite_code: null,
        created_at: "", updated_at: "",
      } as Campaign)),
  ];
}

// ── Component ──────────────────────────────────────────────────

export default function CharacterDetail() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { lang } = useLang();
  const tr = t[lang].character;
  const settings   = t[lang].dashboard.settings  as Record<string, string>;
  const tones      = t[lang].dashboard.tones      as Record<string, string>;
  const statAbbr   = tr.statAbbr       as unknown as Record<string, string>;
  const statFull   = tr.statFull       as unknown as Record<string, string>;
  const skillNames = tr.skillNames     as unknown as Record<string, string>;
  const classNames = tr.classNames     as unknown as Record<string, string>;
  const raceNames  = tr.raceNames      as unknown as Record<string, string>;
  const bgNames    = tr.bgNames        as unknown as Record<string, string>;
  const alignNames = tr.alignmentNames as unknown as Record<string, string>;

  const [character, setCharacter] = useState<Character | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Level-up state
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [hpGain, setHpGain]           = useState<number | null>(null);
  const [lastRoll, setLastRoll]       = useState<number | null>(null);
  const [asiDeltas, setAsiDeltas]     = useState<Partial<Record<keyof CharacterStats, number>>>({});
  const [saving, setSaving]           = useState(false);
  const [justLeveled, setJustLeveled] = useState(false);
  // Spell selection state
  const [selectedSpells, setSelectedSpells]     = useState<Spell[]>([]);
  const [selectedCantrips, setSelectedCantrips] = useState<Spell[]>([]);
  const [replaceSpell, setReplaceSpell]         = useState<string | null>(null);
  const [spellTab, setSpellTab]                 = useState<number>(1);
  const [spellSearch, setSpellSearch]           = useState("");
  const [initSpellsOpen, setInitSpellsOpen]     = useState(false);

  useEffect(() => {
    getCurrUser().then(async (u) => {
      if (!u) { router.replace("/auth/login"); return; }
      const [charRes, campRes, joinedRes] = await Promise.all([
        fetch(`/api/characters/${id}`),
        fetch("/api/campaigns"),
        fetch("/api/campaigns/joined"),
      ]);
      if (!charRes.ok) { loader.stop(); setNotFound(true); setLoading(false); return; }
      const [char, camps, joined] = await Promise.all([
        charRes.json() as Promise<Character>,
        campRes.ok ? (campRes.json() as Promise<Campaign[]>) : Promise.resolve([]),
        joinedRes.ok ? (joinedRes.json() as Promise<SlimJoinedCampaign[]>) : Promise.resolve([]),
      ]);
      setCharacter(char);
      setCampaigns(mergeCampaigns(camps, joined));
      loader.stop();
      setLoading(false);
    });
  }, [id, router]);

  // Real-time: character row changes (items, HP, level) + campaign membership changes
  useEffect(() => {
    if (!id) return;
    const supabase = createSupabaseClient();
    const channel = supabase
      .channel(`char-detail-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "characters", filter: `id=eq.${id}` },
        (payload: { new: Record<string, unknown> }) => {
          setCharacter((prev) => prev ? { ...prev, ...(payload.new as Partial<Character>) } : prev);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_characters", filter: `character_id=eq.${id}` },
        async () => {
          const [campRes, joinedRes] = await Promise.all([
            fetch("/api/campaigns", { cache: "no-store" }),
            fetch("/api/campaigns/joined", { cache: "no-store" }),
          ]);
          const camps: Campaign[] = campRes.ok ? await campRes.json() : [];
          const joined: SlimJoinedCampaign[] = joinedRes.ok ? await joinedRes.json() : [];
          setCampaigns(mergeCampaigns(camps, joined));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // ── Spell picker memos (must be before any early return) ─────

  const classFeats = useMemo(
    () => !character ? [] :
      lang === "es" ? (CLASS_FEATURES[character.class] ?? []) : getClassFeatures(lang, character.class),
    [character, lang],
  );

  const raceTraits = useMemo(() => {
    if (!character) return [];
    const base = (character.race ?? "").split(" (")[0];
    return lang === "es" ? (RACE_TRAITS[base] ?? []) : getRaceTraits(lang, base);
  }, [character, lang]);

  const knownSpellNames = useMemo(
    () => new Set((character?.spells_known ?? []).map((s) => s.name)),
    [character?.spells_known],
  );

  const availableSpells = useMemo(() => {
    if (!character) return [];
    const gainLevel = initSpellsOpen ? 1 : character.level + 1;
    const gain = SPELL_GAINS[character.class]?.[gainLevel] ?? null;
    if (!gain) return [];
    return getSpellsForClass(character.class, gain.maxLevel)
      .filter((sp) => !knownSpellNames.has(sp.name));
  }, [character, knownSpellNames, initSpellsOpen]);

  const filteredSpells = useMemo(() => {
    const q = spellSearch.trim().toLowerCase();
    const list = availableSpells.filter((sp) => sp.level === spellTab);
    if (!q) return list;
    return list.filter(
      (sp) => sp.name.toLowerCase().includes(q) || sp.desc.toLowerCase().includes(q),
    );
  }, [availableSpells, spellTab, spellSearch]);

  const selectedSpellNames   = useMemo(() => new Set(selectedSpells.map((s) => s.name)),    [selectedSpells]);
  const selectedCantripNames = useMemo(() => new Set(selectedCantrips.map((s) => s.name)), [selectedCantrips]);

  // ── Loading / not-found ───────────────────────────────────────

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.content}>
          <div className={s.skeleton} style={{ height: 60, width: 200, marginBottom: 24 }} />
          <div className={s.skeleton} style={{ height: 500, borderRadius: 4 }} />
        </div>
      </div>
    );
  }

  if (notFound || !character) {
    return (
      <div className={s.page}>
        <div className={s.stars} aria-hidden />
        <div className={s.content}>
          <button className={s.back} onClick={() => router.push("/dashboard")} type="button">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <line x1="10" y1="6" x2="2" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M5 3L2 6l3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {tr.back}
          </button>
          <div className={s.notFound}>
            <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
              <circle cx="24" cy="24" r="20" fill="none" stroke="#4a3510" strokeWidth="1.5" />
              <line x1="24" y1="16" x2="24" y2="28" stroke="#4a3510" strokeWidth="2" strokeLinecap="round" />
              <circle cx="24" cy="34" r="1.5" fill="#4a3510" />
            </svg>
            <p>{tr.notFoundMsg}</p>
            <button className={s.btnSecondary} onClick={() => router.push("/dashboard")}>{tr.back}</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Handlers ──────────────────────────────────────────────────

  async function handleDelete() {
    setDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/characters/${id}`, { method: "DELETE" });
      if (res.status === 204) { router.push("/dashboard"); return; }
      const body = await res.json() as { error?: string };
      setDeleteError(body.error ?? tr.deleteErrFallback);
      setDeleteConfirm(false);
    } finally { setDeleting(false); }
  }

  const hitDie      = CLASS_HIT_DIE[character.class] ?? 8;
  const conMod      = rawMod(character.stats.constitution);
  const avgHpGain   = Math.max(1, Math.floor(hitDie / 2) + 1 + conMod);
  const nextLevel   = character.level + 1;
  const canLevelUp  = character.level < 20;
  const nextData    = CLASS_PROGRESSION[character.class]?.[nextLevel];
  const isASILevel  = nextData?.isASI ?? false;
  const asiUsed     = (Object.values(asiDeltas) as number[]).reduce((a, b) => a + b, 0);
  const asiLeft     = 2 - asiUsed;

  // Spell progression for this level-up
  const spellGain   = SPELL_GAINS[character.class]?.[nextLevel] ?? null;
  const isKnownCaster    = KNOWN_CASTERS.has(character.class);
  const isPreparedCaster = PREPARED_CASTERS.has(character.class);
  const hasSpellPick = isKnownCaster && spellGain !== null && (spellGain.newSpells > 0 || spellGain.newCantrips > 0);

  function openLevelUp() {
    setHpGain(null); setLastRoll(null); setAsiDeltas({});
    setSelectedSpells([]); setSelectedCantrips([]); setReplaceSpell(null);
    setSpellSearch("");
    setSpellTab(spellGain?.newCantrips ? 0 : 1);
    setLevelUpOpen(true);
    setTimeout(() => document.getElementById("lvlup-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }
  function closeLevelUp() { setLevelUpOpen(false); }

  function rollHp() {
    const roll = Math.floor(Math.random() * hitDie) + 1;
    setLastRoll(roll);
    setHpGain(Math.max(1, roll + conMod));
  }
  function useAvg() { setLastRoll(null); setHpGain(avgHpGain); }

  function addASI(key: keyof CharacterStats) {
    if (!character || asiLeft <= 0) return;
    const cur = asiDeltas[key] ?? 0;
    if (cur >= 2 || character.stats[key] + cur >= 20) return;
    setAsiDeltas((p) => ({ ...p, [key]: cur + 1 }));
  }
  function subASI(key: keyof CharacterStats) {
    const cur = asiDeltas[key] ?? 0;
    if (cur <= 0) return;
    setAsiDeltas((p) => {
      const next = { ...p, [key]: cur - 1 };
      if (next[key] === 0) delete next[key];
      return next;
    });
  }

  async function confirmLevelUp() {
    if (!character || !hpGain) return;
    setSaving(true);
    try {
      const newStats = { ...character.stats } as CharacterStats;
      for (const k of STAT_KEYS) {
        const delta = asiDeltas[k] ?? 0;
        if (delta > 0) newStats[k] = Math.min(20, character.stats[k] + delta);
      }
      // Retroactive HP if CON was raised
      const conDelta = asiDeltas.constitution ?? 0;
      const conModBefore = rawMod(character.stats.constitution);
      const conModAfter  = rawMod(newStats.constitution);
      const retroHP = (conModAfter - conModBefore) > 0 ? nextLevel * (conModAfter - conModBefore) : 0;
      const newMaxHp = character.max_hp + hpGain + retroHP;
      const newHp    = character.hp    + hpGain + retroHP;

      // Merge newly selected spells with existing ones (minus any replaced spell)
      const newSpellObjects: CharacterSpell[] = [
        ...selectedCantrips.map((sp) => ({ name: sp.name, level: sp.level, school: sp.school, desc: sp.desc })),
        ...selectedSpells.map((sp)   => ({ name: sp.name, level: sp.level, school: sp.school, desc: sp.desc })),
      ];
      const existingSpells = (character.spells_known ?? []).filter(
        (sp) => sp.name !== replaceSpell,
      );
      const mergedSpells: CharacterSpell[] = [...existingSpells, ...newSpellObjects];

      const res = await fetch(`/api/characters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: nextLevel, hp: newHp, max_hp: newMaxHp, stats: newStats, spells_known: mergedSpells }),
      });
      if (!res.ok) return;
      const updated = await res.json() as Character;
      setCharacter(updated);
      setLevelUpOpen(false);
      setJustLeveled(true);
      setTimeout(() => setJustLeveled(false), 3500);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ = conDelta; // suppress unused
    } finally { setSaving(false); }
  }

  const spellsRemaining   = (spellGain?.newSpells   ?? 0) - selectedSpells.length;
  const cantripsRemaining = (spellGain?.newCantrips ?? 0) - selectedCantrips.length;
  const spellsDone = spellsRemaining <= 0 && cantripsRemaining <= 0;

  function toggleSpell(spell: Spell) {
    const cRemaining = initSpellsOpen ? initCantripsRemaining : cantripsRemaining;
    const sRemaining = initSpellsOpen ? initSpellsRemaining   : spellsRemaining;
    if (spell.level === 0) {
      if (selectedCantripNames.has(spell.name)) {
        setSelectedCantrips((p) => p.filter((s) => s.name !== spell.name));
      } else if (cRemaining > 0) {
        setSelectedCantrips((p) => [...p, spell]);
      }
    } else {
      if (selectedSpellNames.has(spell.name)) {
        setSelectedSpells((p) => p.filter((s) => s.name !== spell.name));
      } else if (sRemaining > 0) {
        setSelectedSpells((p) => [...p, spell]);
      }
    }
  }

  // Check if level-up can be confirmed (hp required; spells required only if there are spells to pick)
  const canConfirm = hpGain !== null && (
    !hasSpellPick || spellsDone
  );

  // ── Initial spell selection (level 1 known casters) ──────────

  const needsInitSpells = character.level === 1 && KNOWN_CASTERS.has(character.class) && !(character.spells_known ?? []).length;
  const initSpellGain   = SPELL_GAINS[character.class]?.[1] ?? null;

  const initSpellsRemaining   = (initSpellGain?.newSpells   ?? 0) - selectedSpells.length;
  const initCantripsRemaining = (initSpellGain?.newCantrips ?? 0) - selectedCantrips.length;
  const initSpellsDone        = initSpellsRemaining <= 0 && initCantripsRemaining <= 0;

  function openInitSpells() {
    setSelectedSpells([]); setSelectedCantrips([]); setReplaceSpell(null);
    setSpellSearch("");
    setSpellTab(initSpellGain?.newCantrips ? 0 : 1);
    setInitSpellsOpen(true);
    setTimeout(() => document.getElementById("init-spells-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }
  function closeInitSpells() { setInitSpellsOpen(false); }

  async function confirmInitSpells() {
    if (!character) return;
    setSaving(true);
    try {
      const newSpells: CharacterSpell[] = [
        ...selectedCantrips.map((sp) => ({ name: sp.name, level: sp.level, school: sp.school, desc: sp.desc })),
        ...selectedSpells.map((sp)   => ({ name: sp.name, level: sp.level, school: sp.school, desc: sp.desc })),
      ];
      const res = await fetch(`/api/characters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spells_known: newSpells }),
      });
      if (!res.ok) return;
      const updated = await res.json() as Character;
      setCharacter(updated);
      setInitSpellsOpen(false);
    } finally { setSaving(false); }
  }

  // ── Derived display values ────────────────────────────────────

  const story       = parseBackstory(character.backstory);
  const hpPct       = Math.min(100, Math.round((character.hp / character.max_hp) * 100));
  const prof        = profBonus(character.level);
  const ac          = calculateAC(character);
  const initMod     = rawMod(character.stats.dexterity);
  const baseRace    = (character.race ?? "").split(" (")[0];
  const speed       = RACE_BASE_SPEED[baseRace] ?? 30;
  const saveProfs   = CLASS_SAVE_PROFS[character.class] ?? [];
  const newProfBonus = profBonus(nextLevel);

  // ── JSX ───────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      <div className={s.stars} aria-hidden />
      <div className={s.content}>

        {/* Top bar */}
        <div className={s.topBar}>
          <button className={s.back} onClick={() => router.push("/dashboard")} type="button">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <line x1="10" y1="6" x2="2" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M5 3L2 6l3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {tr.back}
          </button>
          <div className={s.topBarRight}>
            {deleteConfirm ? (
              <>
                <button className={cx(s.btnDanger, s.btnDangerConfirm)} onClick={handleDelete} disabled={deleting} type="button">{deleting ? tr.deleting : tr.deleteConfirmBtn}</button>
                <button className={s.btnDangerCancel} onClick={() => setDeleteConfirm(false)} disabled={deleting} type="button">{tr.cancel}</button>
              </>
            ) : (
              <button className={s.btnDanger} onClick={() => { setDeleteConfirm(true); setDeleteError(null); }} type="button">{tr.deleteBtn}</button>
            )}
          </div>
        </div>

        {/* Hero */}
        <div className={s.hero}>
          <div className={s.heroBorderTop} />
          <div className={s.heroBody}>
            <div className={s.heroLeft}>
              <div className={s.heroAvatar}>
                {character.image_url
                  ? <img src={character.image_url} alt={character.name} className={s.heroAvatarImg} />
                  : character.name[0].toUpperCase()}
              </div>
              <div className={s.heroInfo}>
                <h1 className={s.heroName}>{character.name}</h1>
                <div className={s.heroMeta}>
                  <span className={s.badge}>{classNames[character.class] ?? character.class}</span>
                  <span className={s.badge}>{tr.levelBadgeFmt.replace("{n}", String(character.level))}</span>
                  {character.race       && <span className={cx(s.badge, s.badgeRace)}>{raceNames[character.race] ?? character.race}</span>}
                  {character.background && <span className={cx(s.badge, s.badgeBg)}>{bgNames[character.background] ?? character.background}</span>}
                  {character.alignment  && <span className={cx(s.badge, s.badgeAlign)}>{alignNames[character.alignment] ?? character.alignment}</span>}
                </div>
              </div>
            </div>

            <div className={s.heroRight}>
              <div className={s.heroHp}>
                <div className={s.hpLabel}>{tr.hpLabel}</div>
                <div className={s.hpNumbers}>
                  <span className={s.hpCurrent}>{character.hp}</span>
                  <span className={s.hpSep}>/</span>
                  <span className={s.hpMax}>{character.max_hp}</span>
                </div>
                <div className={s.hpBarWrap}>
                  <div className={cx(s.hpBarFill, hpPct <= 25 ? s.hpDanger : hpPct <= 50 ? s.hpWarning : s.hpFull)} style={{ width: `${hpPct}%` }} />
                </div>
              </div>
              {canLevelUp && character.level_up_authorized && !levelUpOpen && !initSpellsOpen && (
                <button className={s.levelUpBtn} onClick={openLevelUp} type="button">
                  <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
                    <line x1="6.5" y1="11" x2="6.5" y2="2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M3 5L6.5 2L10 5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {tr.levelUpBtnFmt.replace("{n}", String(nextLevel))}
                </button>
              )}
              {canLevelUp && !character.level_up_authorized && !levelUpOpen && !initSpellsOpen && (
                <div className={s.waitingDM}>
                  <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                    <circle cx="5.5" cy="5.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                    <line x1="5.5" y1="3" x2="5.5" y2="5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    <circle cx="5.5" cy="7.5" r="0.7" fill="currentColor"/>
                  </svg>
                  {tr.waitingDM}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Level-up panel */}
        {levelUpOpen && canLevelUp && (
          <div id="lvlup-panel" className={s.levelUpPanel}>
            <div className={s.levelUpPanelBorder} />

            <div className={s.levelUpHead}>
              <div className={s.levelUpTransition}>
                <span className={s.levelUpOld}>{character.level}</span>
                <svg width="28" height="14" viewBox="0 0 28 14" aria-hidden>
                  <line x1="2" y1="7" x2="22" y2="7" stroke="#b8860b" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M18 3L26 7L18 11" stroke="#b8860b" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className={s.levelUpNew}>{nextLevel}</span>
              </div>
              <div className={s.levelUpSubtitle}>{tr.levelSubtitleFmt.replace("{cls}", character.class).replace("{n}", String(nextLevel))}</div>
              <button className={s.levelUpClose} onClick={closeLevelUp} type="button" aria-label={tr.close}>✕</button>
            </div>

            {/* New features */}
            {nextData && nextData.features.length > 0 && (
              <div className={s.luSection}>
                <div className={s.luSectionTitle}>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5" fill="none" stroke="#e8c040" strokeWidth="1.2" strokeLinejoin="round"/>
                  </svg>
                  {tr.newFeatures}
                </div>
                <div className={s.luFeatures}>
                  {nextData.features.map((f) => (
                    <div key={f.name} className={s.luFeatureCard}>
                      <div className={s.luFeatureName}>{f.name}</div>
                      <div className={s.luFeatureDesc}>{f.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proficiency bonus upgrade */}
            {newProfBonus > prof && (
              <div className={s.luSection}>
                <div className={s.luSectionTitle}>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <circle cx="6" cy="6" r="5" fill="none" stroke="#e8c040" strokeWidth="1.2"/>
                    <line x1="6" y1="3.5" x2="6" y2="8.5" stroke="#e8c040" strokeWidth="1.4" strokeLinecap="round"/>
                    <line x1="3.5" y1="6" x2="8.5" y2="6" stroke="#e8c040" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  {tr.profBonusTitle}
                </div>
                <div className={s.luProfRow}>
                  <span className={s.luProfOld}>{fmtBonus(prof)}</span>
                  <span className={s.luProfArrow}>→</span>
                  <span className={s.luProfNew}>{fmtBonus(newProfBonus)}</span>
                  <span className={s.luProfNote}>{tr.profBonusNote}</span>
                </div>
              </div>
            )}

            {/* HP gain */}
            <div className={s.luSection}>
              <div className={s.luSectionTitle}>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <path d="M6 10 C6 10 1 7 1 4 Q1 1 4 1 Q5.5 1 6 2.5 Q6.5 1 8 1 Q11 1 11 4 C11 7 6 10 6 10Z" fill="none" stroke="#c05050" strokeWidth="1.3"/>
                </svg>
                {tr.hpTitle}
              </div>
              <div className={s.luHpRow}>
                <div className={s.luHpFormula}>
                  <span className={s.luHpDie}>d{hitDie}</span>
                  <span className={s.luHpPlus}>+</span>
                  <span className={cx(s.luHpMod, conMod >= 0 ? s.luHpModPos : s.luHpModNeg)}>
                    {fmtBonus(conMod)} CON
                  </span>
                </div>
                <div className={s.luHpBtns}>
                  <button
                    type="button"
                    className={cx(s.luHpBtn, hpGain !== null && lastRoll !== null && s.luHpBtnActive)}
                    onClick={rollHp}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                      <rect x="1.5" y="1.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3"/>
                      <circle cx="4.5" cy="4.5" r="1" fill="currentColor"/>
                      <circle cx="9.5" cy="9.5" r="1" fill="currentColor"/>
                      <circle cx="9.5" cy="4.5" r="1" fill="currentColor"/>
                      <circle cx="4.5" cy="9.5" r="1" fill="currentColor"/>
                    </svg>
                    {tr.rollDice}
                  </button>
                  <button
                    type="button"
                    className={cx(s.luHpBtn, hpGain !== null && lastRoll === null && s.luHpBtnActive)}
                    onClick={useAvg}
                  >
                    {tr.avgHpFmt.replace("{n}", String(avgHpGain))}
                  </button>
                </div>
                {hpGain !== null && (
                  <div className={s.luHpResult}>
                    {lastRoll !== null && (
                      <span className={s.luHpRollDetail}>
                        ({lastRoll} + {fmtBonus(conMod)} CON) =
                      </span>
                    )}
                    <span className={s.luHpResultVal}>+{hpGain}</span>
                    <span className={s.luHpResultLabel}>{tr.hpAbbr}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ASI */}
            {isASILevel && (
              <div className={s.luSection}>
                <div className={s.luSectionTitle}>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <line x1="6" y1="10" x2="6" y2="2" stroke="#e8c040" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M3 5L6 2L9 5" stroke="#e8c040" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {tr.asiTitle}
                  <span className={cx(s.luAsiCounter, asiLeft === 0 && s.luAsiCounterDone)}>
                    {asiLeft > 0 ? tr.asiPointsFmt[asiLeft !== 1 ? 1 : 0].replace("{n}", String(asiLeft)) : tr.asiDone}
                  </span>
                </div>
                <p className={s.luAsiInfo}>{tr.asiInfo}</p>
                <div className={s.luAsiGrid}>
                  {STAT_KEYS.map((key) => {
                    const cur   = character.stats[key];
                    const delta = asiDeltas[key] ?? 0;
                    const newVal = Math.min(20, cur + delta);
                    const canAdd = asiLeft > 0 && cur + delta < 20 && delta < 2;
                    const canSub = delta > 0;
                    return (
                      <div key={key} className={cx(s.luAsiCard, delta > 0 && s.luAsiCardBoosted)}>
                        <div className={s.luAsiAbbr}>{statAbbr[key]}</div>
                        <div className={s.luAsiScore}>
                          {cur}
                          {delta > 0 && (
                            <span className={s.luAsiDelta}>+{delta}</span>
                          )}
                        </div>
                        {delta > 0 && (
                          <div className={s.luAsiNew}>{newVal}</div>
                        )}
                        <div className={s.luAsiBtns}>
                          <button
                            type="button"
                            className={cx(s.luAsiBtn, !canAdd && s.luAsiBtnOff)}
                            onClick={() => canAdd && addASI(key)}
                            disabled={!canAdd}
                            aria-label={tr.ariaAddStat.replace("{n}", statFull[key])}
                          >+</button>
                          <button
                            type="button"
                            className={cx(s.luAsiBtn, s.luAsiBtnSub, !canSub && s.luAsiBtnOff)}
                            onClick={() => canSub && subASI(key)}
                            disabled={!canSub}
                            aria-label={tr.ariaSubStat.replace("{n}", statFull[key])}
                          >−</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Prepared caster info (no spell picks needed) */}
            {isPreparedCaster && spellGain && (
              <div className={s.luSection}>
                <div className={s.luSectionTitle}>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <path d="M2 1 L10 1 L10 11 L6 9 L2 11 Z" fill="none" stroke="#e8c040" strokeWidth="1.2" strokeLinejoin="round"/>
                    <line x1="4" y1="4.5" x2="8" y2="4.5" stroke="#e8c040" strokeWidth="1"/>
                    <line x1="4" y1="6.5" x2="7" y2="6.5" stroke="#e8c040" strokeWidth="1"/>
                  </svg>
                  {tr.preparedCasterTitle}
                </div>
                <p className={s.luAsiInfo}>
                  {tr.preparedCasterFmt.replace("{n}", String(character.level + 1)).replace("{max}", String(spellGain.maxLevel))}
                </p>
              </div>
            )}

            {/* Spell picker for known casters */}
            {hasSpellPick && spellGain && (
              <div className={s.luSection}>
                <div className={s.luSectionTitle}>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <path d="M6 1 C6 1 10 3.5 10 7 Q10 10.5 6 11 Q2 10.5 2 7 C2 3.5 6 1 6 1Z" fill="none" stroke="#e8c040" strokeWidth="1.2"/>
                    <line x1="6" y1="4" x2="6" y2="8" stroke="#e8c040" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="4.5" y1="5.5" x2="7.5" y2="5.5" stroke="#e8c040" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  {tr.spellsNewTitle}
                  <span className={cx(s.luAsiCounter, spellsDone && s.luAsiCounterDone)}>
                    {!spellsDone
                      ? [
                          spellsRemaining > 0 && tr.spellsFmt[spellsRemaining !== 1 ? 1 : 0].replace("{n}", String(spellsRemaining)),
                          cantripsRemaining > 0 && tr.cantripsFmt[cantripsRemaining !== 1 ? 1 : 0].replace("{n}", String(cantripsRemaining)),
                        ].filter(Boolean).join(" + ") + ` ${tr.spellsRemaining}`
                      : tr.spellsDone}
                  </span>
                </div>

                {/* Tabs: cantrips + leveled */}
                <div className={s.spellTabs}>
                  {spellGain.newCantrips > 0 && (
                    <button
                      type="button"
                      className={cx(s.spellTab, spellTab === 0 && s.spellTabActive)}
                      onClick={() => setSpellTab(0)}
                    >
                      {tr.tabCantrips} {selectedCantripNames.size > 0 && `(${selectedCantripNames.size})`}
                    </button>
                  )}
                  {Array.from({ length: spellGain.maxLevel }, (_, i) => i + 1).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      className={cx(s.spellTab, spellTab === lvl && s.spellTabActive)}
                      onClick={() => setSpellTab(lvl)}
                    >
                      {tr.tabLevelFmt.replace("{n}", String(lvl))}
                      {selectedSpells.filter((sp) => sp.level === lvl).length > 0 &&
                        ` (${selectedSpells.filter((sp) => sp.level === lvl).length})`}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className={s.spellSearchWrap}>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={s.spellSearchIcon}>
                    <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                    <line x1="7.5" y1="7.5" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <input
                    type="text"
                    className={s.spellSearch}
                    placeholder={tr.spellSearch}
                    value={spellSearch}
                    onChange={(e) => setSpellSearch(e.target.value)}
                  />
                </div>

                {/* Spell list */}
                <div className={s.spellList}>
                  {filteredSpells.length === 0 ? (
                    <div className={s.spellEmpty}>
                      {spellSearch ? tr.spellsNoResults : tr.spellsAllKnown}
                    </div>
                  ) : (
                    filteredSpells.map((spell) => {
                      const spTr = translateSpell(lang, spell.name, spell.school, spell.desc);
                      const isSelected = spell.level === 0
                        ? selectedCantripNames.has(spell.name)
                        : selectedSpellNames.has(spell.name);
                      const isDisabled = !isSelected && (
                        spell.level === 0 ? cantripsRemaining <= 0 : spellsRemaining <= 0
                      );
                      return (
                        <button
                          key={spell.name}
                          type="button"
                          className={cx(s.spellCard, isSelected && s.spellCardSelected, isDisabled && s.spellCardDisabled)}
                          onClick={() => toggleSpell(spell)}
                          disabled={isDisabled && !isSelected}
                        >
                          <div className={s.spellCardCheck}>
                            {isSelected ? "●" : "○"}
                          </div>
                          <div className={s.spellCardBody}>
                            <div className={s.spellCardHead}>
                              <span className={s.spellCardName}>{spTr.name}</span>
                              <span className={s.spellCardSchool}>{spTr.school}</span>
                            </div>
                            <div className={s.spellCardDesc}>{spTr.desc}</div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Spell replacement (optional) */}
                {spellGain.canReplace && (character.spells_known ?? []).length > 0 && (
                  <div className={s.spellReplaceSection}>
                    <div className={s.spellReplaceTitle}>
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                        <path d="M2 3 L8 3 M6 1 L8 3 L6 5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8 7 L2 7 M4 5 L2 7 L4 9" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {tr.spellReplaceTitle}
                    </div>
                    <div className={s.spellReplaceList}>
                      {(character.spells_known ?? []).filter((sp) => sp.level > 0).map((sp) => {
                        const spTr = translateSpell(lang, sp.name, sp.school, sp.desc);
                        return (
                          <button
                            key={sp.name}
                            type="button"
                            className={cx(s.spellReplaceItem, replaceSpell === sp.name && s.spellReplaceItemActive)}
                            onClick={() => setReplaceSpell((prev) => prev === sp.name ? null : sp.name)}
                          >
                            <span className={s.spellReplaceCheck}>{replaceSpell === sp.name ? "✕" : "○"}</span>
                            <span>{spTr.name}</span>
                            <span className={s.spellReplaceLevel}>{tr.spellLevelFmt.replace("{n}", String(sp.level))}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className={s.luActions}>
              <button type="button" className={s.luCancel} onClick={closeLevelUp} disabled={saving}>
                {tr.cancel}
              </button>
              <button
                type="button"
                className={cx(s.luConfirm, !canConfirm && s.luConfirmDisabled)}
                onClick={confirmLevelUp}
                disabled={saving || !canConfirm}
              >
                {saving ? tr.saving : tr.levelUpConfirmFmt.replace("{n}", String(nextLevel))}
              </button>
            </div>
          </div>
        )}

        {/* Prompt: pick initial spells (level 1 caster, no spells yet) */}
        {needsInitSpells && !initSpellsOpen && (
          <div className={s.initSpellsPrompt}>
            <div className={s.initSpellsPromptBorder} />
            <div className={s.initSpellsPromptBody}>
              <div className={s.initSpellsPromptIcon} aria-hidden>
                <svg width="22" height="22" viewBox="0 0 22 22">
                  <path d="M11 2 C11 2 18 5.5 18 11 Q18 16.5 11 19 Q4 16.5 4 11 C4 5.5 11 2 11 2Z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="11" y1="6.5" x2="11" y2="15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="7" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className={s.initSpellsPromptInfo}>
                <div className={s.initSpellsPromptTitle}>{tr.initSpellsPromptTitle}</div>
                <div className={s.initSpellsPromptSub}>
                  {tr.initSpellsPromptPre.replace("{cls}", character.class)}{" "}
                  {initSpellGain && (
                    <>
                      <strong>{tr.spellsFmt[initSpellGain.newSpells !== 1 ? 1 : 0].replace("{n}", String(initSpellGain.newSpells))}</strong>
                      {initSpellGain.newCantrips > 0 && (
                        <> {tr.and} <strong>{tr.cantripsFmt[initSpellGain.newCantrips !== 1 ? 1 : 0].replace("{n}", String(initSpellGain.newCantrips))}</strong></>
                      )}
                    </>
                  )}{" "}
                  {tr.initSpellsPromptSuffix}
                </div>
              </div>
              <button className={s.initSpellsPromptBtn} onClick={openInitSpells} type="button">
                <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                  <path d="M5.5 1 C5.5 1 9.5 3 9.5 5.5 Q9.5 8.5 5.5 10 Q1.5 8.5 1.5 5.5 C1.5 3 5.5 1 5.5 1Z" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                  <line x1="5.5" y1="3.5" x2="5.5" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  <line x1="3.5" y1="5.5" x2="7.5" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {tr.initSpellsBtn}
              </button>
            </div>
          </div>
        )}

        {/* Initial spell selection panel */}
        {initSpellsOpen && initSpellGain && (
          <div id="init-spells-panel" className={s.levelUpPanel}>
            <div className={s.levelUpPanelBorder} />
            <div className={s.levelUpHead}>
              <div className={s.levelUpSubtitle}>{tr.initSpellsPanelFmt.replace("{cls}", character.class)}</div>
              <button className={s.levelUpClose} onClick={closeInitSpells} type="button" aria-label={tr.close}>✕</button>
            </div>

            <div className={s.luSection}>
              <div className={s.luSectionTitle}>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <path d="M6 1 C6 1 10 3.5 10 7 Q10 10.5 6 11 Q2 10.5 2 7 C2 3.5 6 1 6 1Z" fill="none" stroke="#e8c040" strokeWidth="1.2"/>
                  <line x1="6" y1="4" x2="6" y2="8" stroke="#e8c040" strokeWidth="1.2" strokeLinecap="round"/>
                  <line x1="4.5" y1="5.5" x2="7.5" y2="5.5" stroke="#e8c040" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {tr.initSpellsPickTitle}
                <span className={cx(s.luAsiCounter, initSpellsDone && s.luAsiCounterDone)}>
                  {!initSpellsDone
                    ? [
                        initSpellsRemaining > 0 && tr.spellsFmt[initSpellsRemaining !== 1 ? 1 : 0].replace("{n}", String(initSpellsRemaining)),
                        initCantripsRemaining > 0 && tr.cantripsFmt[initCantripsRemaining !== 1 ? 1 : 0].replace("{n}", String(initCantripsRemaining)),
                      ].filter(Boolean).join(" + ") + ` ${tr.spellsRemaining}`
                    : tr.spellsDone}
                </span>
              </div>

              <p className={s.luAsiInfo}>
                {tr.initSpellsSelectPrefix}{" "}
                {initSpellGain.newSpells > 0 && (
                  <><strong>{tr.spellsFmt[initSpellGain.newSpells !== 1 ? 1 : 0].replace("{n}", String(initSpellGain.newSpells))}</strong>{initSpellGain.newCantrips > 0 ? ` ${tr.and} ` : ""}</>
                )}
                {initSpellGain.newCantrips > 0 && (
                  <strong>{tr.cantripsFmt[initSpellGain.newCantrips !== 1 ? 1 : 0].replace("{n}", String(initSpellGain.newCantrips))}</strong>
                )}
                {" "}{tr.initSpellsFromListFmt.replace("{cls}", character.class)}
                {initSpellGain.newCantrips > 0 && ` ${tr.initSpellsCantripHint}`}
              </p>

              <div className={s.spellTabs}>
                {initSpellGain.newCantrips > 0 && (
                  <button
                    type="button"
                    className={cx(s.spellTab, spellTab === 0 && s.spellTabActive)}
                    onClick={() => setSpellTab(0)}
                  >
                    {tr.tabCantrips} {selectedCantripNames.size > 0 && `(${selectedCantripNames.size})`}
                  </button>
                )}
                {Array.from({ length: initSpellGain.maxLevel }, (_, i) => i + 1).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={cx(s.spellTab, spellTab === lvl && s.spellTabActive)}
                    onClick={() => setSpellTab(lvl)}
                  >
                    {tr.tabLevelFmt.replace("{n}", String(lvl))}
                    {selectedSpells.filter((sp) => sp.level === lvl).length > 0 &&
                      ` (${selectedSpells.filter((sp) => sp.level === lvl).length})`}
                  </button>
                ))}
              </div>

              <div className={s.spellSearchWrap}>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={s.spellSearchIcon}>
                  <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                  <line x1="7.5" y1="7.5" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  className={s.spellSearch}
                  placeholder={tr.spellSearch}
                  value={spellSearch}
                  onChange={(e) => setSpellSearch(e.target.value)}
                />
              </div>

              <div className={s.spellList}>
                {filteredSpells.length === 0 ? (
                  <div className={s.spellEmpty}>
                    {spellSearch ? tr.spellsNoResults : tr.initSpellsEmpty}
                  </div>
                ) : (
                  filteredSpells.map((spell) => {
                    const spTr = translateSpell(lang, spell.name, spell.school, spell.desc);
                    const isSelected = spell.level === 0
                      ? selectedCantripNames.has(spell.name)
                      : selectedSpellNames.has(spell.name);
                    const isDisabled = !isSelected && (
                      spell.level === 0 ? initCantripsRemaining <= 0 : initSpellsRemaining <= 0
                    );
                    return (
                      <button
                        key={spell.name}
                        type="button"
                        className={cx(s.spellCard, isSelected && s.spellCardSelected, isDisabled && s.spellCardDisabled)}
                        onClick={() => toggleSpell(spell)}
                        disabled={isDisabled && !isSelected}
                      >
                        <div className={s.spellCardCheck}>{isSelected ? "●" : "○"}</div>
                        <div className={s.spellCardBody}>
                          <div className={s.spellCardHead}>
                            <span className={s.spellCardName}>{spTr.name}</span>
                            <span className={s.spellCardSchool}>{spTr.school}</span>
                          </div>
                          <div className={s.spellCardDesc}>{spTr.desc}</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className={s.luActions}>
              <button type="button" className={s.luCancel} onClick={closeInitSpells} disabled={saving}>
                {tr.cancel}
              </button>
              <button
                type="button"
                className={cx(s.luConfirm, !initSpellsDone && s.luConfirmDisabled)}
                onClick={confirmInitSpells}
                disabled={saving || !initSpellsDone}
              >
                {saving ? tr.saving : tr.initSpellsConfirmBtn}
              </button>
            </div>
          </div>
        )}

        {/* Level-up toast */}
        {justLeveled && (
          <div className={s.levelToast}>
            {tr.levelUpToastFmt.replace("{n}", String(character.level))}
          </div>
        )}

        {deleteError && <div className={s.errorBanner}>{deleteError}</div>}

        {/* Main layout */}
        <div className={s.layout}>
          {/* Left sheet */}
          <div className={s.sheet}>

            {/* Combat stats */}
            <div className={s.card} style={{ marginBottom: 16 }}>
              <div className={s.cardHeader}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <path d="M7 1 L13 7 L7 13 L1 7 Z" fill="none" stroke="#c9a030" strokeWidth="1.3"/>
                  <path d="M4 4 L10 10 M10 4 L4 10" stroke="#c9a030" strokeWidth="1.1"/>
                </svg>
                {tr.cardCombat}
              </div>
              <div className={s.combatStrip}>
                <div className={s.combatItem}>
                  <div className={s.combatValue}>{ac}</div>
                  <div className={s.combatLabel}>{tr.cardAC}</div>
                </div>
                <div className={s.combatSep} />
                <div className={s.combatItem}>
                  <div className={s.combatValue}>{fmtBonus(initMod)}</div>
                  <div className={s.combatLabel}>{tr.cardInitiative}</div>
                </div>
                <div className={s.combatSep} />
                <div className={s.combatItem}>
                  <div className={s.combatValue}>{speed} ft</div>
                  <div className={s.combatLabel}>{tr.cardSpeed}</div>
                </div>
                <div className={s.combatSep} />
                <div className={s.combatItem}>
                  <div className={s.combatValue}>{fmtBonus(prof)}</div>
                  <div className={s.combatLabel}>{tr.cardProfBonus}</div>
                </div>
              </div>
            </div>

            {/* Ability scores */}
            <div className={s.card} style={{ marginBottom: 16 }}>
              <div className={s.cardHeader}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <rect x="1" y="1" width="12" height="12" rx="2" fill="none" stroke="#c9a030" strokeWidth="1.3"/>
                  <circle cx="4.5" cy="4.5" r="1" fill="#c9a030"/>
                  <circle cx="9.5" cy="4.5" r="1" fill="#c9a030"/>
                  <circle cx="7"   cy="7"   r="1" fill="#c9a030"/>
                  <circle cx="4.5" cy="9.5" r="1" fill="#c9a030"/>
                  <circle cx="9.5" cy="9.5" r="1" fill="#c9a030"/>
                </svg>
                {tr.cardStats}
              </div>
              <div className={s.statGrid}>
                {STAT_KEYS.map((key) => {
                  const score = character.stats[key];
                  return (
                    <div key={key} className={s.statBlock}>
                      <div className={s.statAbbr}>{statAbbr[key]}</div>
                      <div className={s.statScore}>{score}</div>
                      <div className={cx(s.statMod, score > 10 ? s.statModPos : score < 10 ? s.statModNeg : s.statModZero)}>
                        {statMod(score)}
                      </div>
                      <div className={s.statFull}>{statFull[key]}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Saving throws */}
            <div className={s.card} style={{ marginBottom: 16 }}>
              <div className={s.cardHeader}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <path d="M7 1 L13 4 L13 9 Q13 12 7 13 Q1 12 1 9 L1 4 Z" fill="none" stroke="#c9a030" strokeWidth="1.3" strokeLinejoin="round"/>
                  <path d="M4.5 7 L6 8.5 L9.5 5" stroke="#c9a030" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {tr.cardSaves}
              </div>
              <div className={s.savesList}>
                {STAT_KEYS.map((key) => {
                  const isPro  = saveProfs.includes(key);
                  const bonus  = rawMod(character.stats[key]) + (isPro ? prof : 0);
                  return (
                    <div key={key} className={s.saveRow}>
                      <div className={cx(s.saveDot, isPro && s.saveDotFilled)} />
                      <div className={s.saveName}>{statFull[key]}</div>
                      <div className={cx(s.saveBonus, bonus > 0 ? s.statModPos : bonus < 0 ? s.statModNeg : s.statModZero)}>
                        {fmtBonus(bonus)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Skills */}
            <div className={s.card} style={{ marginBottom: 16 }}>
              <div className={s.cardHeader}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <circle cx="7" cy="7" r="5.5" fill="none" stroke="#c9a030" strokeWidth="1.3"/>
                  <circle cx="7" cy="7" r="2" fill="#c9a030" opacity="0.7"/>
                  <line x1="7" y1="1.5" x2="7" y2="3" stroke="#c9a030" strokeWidth="1.2"/>
                  <line x1="7" y1="11" x2="7" y2="12.5" stroke="#c9a030" strokeWidth="1.2"/>
                  <line x1="1.5" y1="7" x2="3" y2="7" stroke="#c9a030" strokeWidth="1.2"/>
                  <line x1="11" y1="7" x2="12.5" y2="7" stroke="#c9a030" strokeWidth="1.2"/>
                </svg>
                {tr.cardSkills}
              </div>
              <div className={s.skillsList}>
                {SKILLS.map((sk) => {
                  const isPro  = character.skill_proficiencies.includes(sk.name);
                  const bonus  = rawMod(character.stats[sk.stat]) + (isPro ? prof : 0);
                  return (
                    <div key={sk.name} className={s.skillRow}>
                      <div className={cx(s.skillDot, isPro && s.skillDotFilled)} />
                      <div className={s.skillName}>{skillNames[sk.name] ?? sk.name}</div>
                      <div className={s.skillStat}>{statAbbr[sk.stat]}</div>
                      <div className={cx(s.skillBonus, bonus > 0 ? s.statModPos : bonus < 0 ? s.statModNeg : s.statModZero)}>
                        {fmtBonus(bonus)}
                      </div>
                    </div>
                  );
                })}
                <div className={s.skillPassive}>
                  {tr.passivePerceptionFmt.replace("{n}", String(10 + rawMod(character.stats.wisdom) + (character.skill_proficiencies.includes("Percepción") ? prof : 0)))}
                </div>
              </div>
            </div>

            {/* Inventory */}
            {character.items.length > 0 && (
              <div className={s.card} style={{ marginBottom: 16 }}>
                <div className={s.cardHeader}>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                    <rect x="2" y="5" width="10" height="8" rx="1" fill="none" stroke="#c9a030" strokeWidth="1.3"/>
                    <path d="M5 5 V3 Q5 1 7 1 Q9 1 9 3 V5" fill="none" stroke="#c9a030" strokeWidth="1.3" strokeLinecap="round"/>
                    <line x1="2" y1="8" x2="12" y2="8" stroke="#c9a030" strokeWidth="1"/>
                  </svg>
                  {tr.cardInventory}
                </div>
                <div className={s.inventoryList}>
                  {character.items.map((item, i) => (
                    <div key={i} className={s.inventoryItem}>
                      <div className={s.inventoryBullet}>⚔</div>
                      <div className={s.inventoryInfo}>
                        <div className={s.inventoryName}>{translateItem(lang, item.name)}</div>
                        {item.description && <div className={s.inventoryDesc}>{translateItem(lang, item.description)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className={s.sidebar}>
            {character.image_url && (
              <div className={s.sidebarPortrait}>
                <img src={character.image_url} alt={character.name} className={s.sidebarPortraitImg} />
              </div>
            )}

            {/* Class features */}
            {classFeats.length > 0 && (
              <div className={s.card} style={{ marginBottom: 16 }}>
                <div className={s.cardHeader}>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                    <polygon points="7,1 9,5 13,5.5 10,8.5 10.5,13 7,11 3.5,13 4,8.5 1,5.5 5,5" fill="none" stroke="#c9a030" strokeWidth="1.3" strokeLinejoin="round"/>
                  </svg>
                  {tr.cardClassFeatures}
                </div>
                <div className={s.featuresList}>
                  {classFeats.map((f) => (
                    <div key={f.name} className={s.featureRow}>
                      <div className={s.featureName}>{f.name}</div>
                      <div className={s.featureDesc}>{f.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spells known */}
            {(character.spells_known ?? []).length > 0 && (
              <div className={s.card} style={{ marginBottom: 16 }}>
                <div className={s.cardHeader}>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                    <path d="M7 1 C7 1 12 3.5 12 7.5 Q12 11.5 7 13 Q2 11.5 2 7.5 C2 3.5 7 1 7 1Z" fill="none" stroke="#c9a030" strokeWidth="1.3"/>
                    <line x1="7" y1="5" x2="7" y2="9" stroke="#c9a030" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="5.5" y1="6.5" x2="8.5" y2="6.5" stroke="#c9a030" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  {tr.cardSpells}
                </div>
                {[0, 1, 2, 3, 4, 5].map((lvl) => {
                  const lvlSpells = (character.spells_known ?? []).filter((sp) => sp.level === lvl);
                  if (!lvlSpells.length) return null;
                  return (
                    <div key={lvl} className={s.spellSheetGroup}>
                      <div className={s.spellSheetGroupLabel}>
                        {lvl === 0 ? tr.spellGroupCantrips : tr.spellGroupLevelFmt.replace("{n}", String(lvl))}
                      </div>
                      {lvlSpells.map((sp) => {
                        const spTr = translateSpell(lang, sp.name, sp.school, sp.desc);
                        return (
                          <div key={sp.name} className={s.spellSheetItem}>
                            <div className={s.spellSheetName}>{spTr.name}</div>
                            <div className={s.spellSheetSchool}>{spTr.school}</div>
                            <div className={s.spellSheetDesc}>{spTr.desc}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Racial traits */}
            {raceTraits.length > 0 && (
              <div className={s.card} style={{ marginBottom: 16 }}>
                <div className={s.cardHeader}>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                    <path d="M7 1 C7 1 12 4 12 8 Q12 12 7 13 Q2 12 2 8 C2 4 7 1 7 1Z" fill="none" stroke="#c9a030" strokeWidth="1.3"/>
                  </svg>
                  {tr.cardRaceTraits}
                </div>
                <ul className={s.traitsList}>
                  {raceTraits.map((t) => (
                    <li key={t} className={s.traitRow}>
                      <span className={s.traitBullet}>✦</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Campaigns */}
            <div className={s.card} style={{ marginBottom: 16 }}>
              <div className={s.cardHeader}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <line x1="7" y1="1" x2="7" y2="13" stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round"/>
                  <line x1="3" y1="1" x2="3" y2="9"  stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round"/>
                  <line x1="11" y1="1" x2="11" y2="9" stroke="#c9a030" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M3 1 L7 3 L11 1" stroke="#c9a030" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
                </svg>
                {tr.cardCampaigns}
              </div>
              {(() => {
                const active = campaigns.filter((c) => c.character_ids?.includes(character.id));
                if (!active.length) return (
                  <div className={s.emptyState}><p>{tr.noCampaigns}</p></div>
                );
                return (
                  <div className={s.campaignList}>
                    {active.map((camp) => (
                      <div key={camp.id} className={cx(s.campaignItem, s.campaignItemAssigned)}>
                        <div className={s.campaignItemTop} />
                        <div className={s.campaignItemInfo}>
                          <div className={s.campaignItemName}>{camp.name}</div>
                          <div className={s.campaignItemMeta}>
                            <span className={s.badgeSmall}>{settings[camp.setting] ?? camp.setting}</span>
                            <span className={s.badgeSmall}>{tones[camp.tone] ?? camp.tone}</span>
                          </div>
                        </div>
                        <div className={s.campaignItemAction}>
                          <span className={s.activePill}>{tr.activePill}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Backstory */}
            {story && (
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                    <rect x="2" y="1" width="10" height="12" rx="1.5" fill="none" stroke="#c9a030" strokeWidth="1.3"/>
                    <line x1="4.5" y1="4.5" x2="9.5" y2="4.5" stroke="#c9a030" strokeWidth="1" strokeLinecap="round"/>
                    <line x1="4.5" y1="7"   x2="9.5" y2="7"   stroke="#c9a030" strokeWidth="1" strokeLinecap="round"/>
                    <line x1="4.5" y1="9.5" x2="7.5" y2="9.5" stroke="#c9a030" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  {tr.cardBackstory}
                </div>
                <p className={s.storyText}>{story}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
