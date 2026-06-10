// D&D 5e SRD spell data (Basic Rules subset, translated to Spanish)

export type Spell = {
  name: string;
  level: number; // 0 = cantrip
  school: string;
  desc: string;
};

// ─── Cantrips ──────────────────────────────────────────────────

const CANTRIPS: Spell[] = [
  // Bard / Wizard / Sorcerer shared
  { name: "Prestidigitación",    level: 0, school: "Transmutación", desc: "Efectos mágicos menores: colores, sabores, limpieza o ilusiones sensoriales leves." },
  { name: "Luz",                 level: 0, school: "Evocación",     desc: "Un objeto que tocas emite luz brillante 6 m y tenue 6 m más, durante 1 hora." },
  { name: "Ilusión menor",       level: 0, school: "Ilusionismo",   desc: "Crea un sonido o imagen inanimada en un punto a 9 m durante 1 minuto." },
  { name: "Mensaje",             level: 0, school: "Transmutación", desc: "Susurras un mensaje telepático a una criatura a 36 m; solo ella oye y puede responder." },
  { name: "Reparar",             level: 0, school: "Transmutación", desc: "Repara una grieta o rotura en un objeto sin rastro visible." },
  { name: "Mano de mago",        level: 0, school: "Conjuración",   desc: "Mano espectral que puede manipular objetos, abrir puertas o entregar cosas a 9 m." },
  { name: "Amistad",             level: 0, school: "Encantamiento", desc: "Ventaja en Persuasión contra un objetivo no hostil; te ve con hostilidad al terminar." },
  { name: "Golpe certero",       level: 0, school: "Adivinación",   desc: "Ventaja en el siguiente ataque contra el objetivo durante este turno." },
  // Bard exclusive
  { name: "Mofa cruel",          level: 0, school: "Encantamiento", desc: "Insulto mágico; falla INT: 1d4 psíquico y desventaja en su próximo ataque." },
  { name: "Taumaturgia",         level: 0, school: "Transmutación", desc: "Efectos menores: ampliar la voz, encender llamas, hacer temblar el suelo, etc." },
  { name: "Trucos de mano",      level: 0, school: "Transmutación", desc: "Truco mundano: mover objetos pequeños, hacer aparecer una moneda, pequeñas ilusiones." },
  // Wizard / Sorcerer exclusive
  { name: "Salpicadura ácida",   level: 0, school: "Conjuración",   desc: "Salpica ácido a 1–2 criaturas a 18 m; TS de DES o 1d6 daño ácido." },
  { name: "Toque helado",        level: 0, school: "Nigromancia",   desc: "Garras espectrales; 1d8 necrótico y el objetivo no recupera PV en su próximo turno." },
  { name: "Luces danzantes",     level: 0, school: "Evocación",     desc: "Hasta 4 luces flotantes que puedes mover 18 m como acción adicional cada turno." },
  { name: "Rayo de fuego",       level: 0, school: "Evocación",     desc: "Proyectil de fuego a 36 m; ataque de hechizo a distancia por 1d10 de fuego." },
  { name: "Atomizador venenoso", level: 0, school: "Conjuración",   desc: "Nube tóxica a 3 m; TS de CON o 1d12 veneno." },
  { name: "Rayo de escarcha",    level: 0, school: "Evocación",     desc: "Rayo de frío a 18 m; 1d8 frío y velocidad del objetivo −3 m hasta tu siguiente turno." },
  { name: "Sacudida eléctrica",  level: 0, school: "Evocación",     desc: "Descarga al tocar; TS de DES o 1d8 de rayo. Ventaja si el objetivo viste armadura metálica." },
  // Warlock exclusive
  { name: "Explosión sobrenatural", level: 0, school: "Evocación",  desc: "Rayo arcano a 36 m; ataque de hechizo a distancia por 1d10 de fuerza." },
  { name: "Tañido funerario",    level: 0, school: "Nigromancia",   desc: "Susurros del más allá; 1d8 necrótico o 1d12 si el objetivo tiene PV máximos bajos." },
  // Cleric
  { name: "Llama sagrada",       level: 0, school: "Evocación",     desc: "Llama divina cae sobre criatura a 18 m; TS de DES o 1d8 radiante (ignora cobertura)." },
  { name: "Salvar al moribundo", level: 0, school: "Abjuración",    desc: "Estabilizas a una criatura con 0 PV a tu alcance." },
  { name: "Guía",                level: 0, school: "Adivinación",   desc: "Una criatura que puedes tocar añade 1d4 a una prueba de característica antes de tu próximo turno." },
  // Druid
  { name: "Artesanía druídica",  level: 0, school: "Transmutación", desc: "Creas un efecto natural menor: florecer una planta, encender una hoguera, predecir el tiempo." },
  { name: "Producir llama",      level: 0, school: "Conjuración",   desc: "Llamas en tu mano: ilumina 3 m o lánzala a 9 m por 1d8 fuego." },
  { name: "Estaca de druida",    level: 0, school: "Transmutación", desc: "Convierte un garrote o bastón en +1 a ataques; usa SAB; 1d6+SAB contundente." },
];

// ─── Level 1 Spells ────────────────────────────────────────────

const LEVEL1: Spell[] = [
  { name: "Proyectil mágico",        level: 1, school: "Evocación",     desc: "3 dardos que impactan automáticamente; 1d4+1 de fuerza cada uno (sin ataque)." },
  { name: "Escudo",                  level: 1, school: "Abjuración",    desc: "Reacción: +5 CA hasta tu siguiente turno y anulas Proyectil mágico." },
  { name: "Armadura de mago",        level: 1, school: "Abjuración",    desc: "Aumenta tu CA base a 13+mod DES sin necesitar armadura, dura 8 horas." },
  { name: "Dormir",                  level: 1, school: "Encantamiento", desc: "Envía a dormir criaturas con un total de 5d8 PV (de las más débiles primero)." },
  { name: "Manos ardientes",         level: 1, school: "Evocación",     desc: "Cono de fuego de 4.5 m; TS de DES o 3d6 fuego (mitad si lo supera)." },
  { name: "Encantamiento de persona",level: 1, school: "Encantamiento", desc: "Un humanoide dentro de 9 m que falle SAB te ve como amigo durante 1 hora." },
  { name: "Spray de colores",        level: 1, school: "Ilusionismo",   desc: "Luz multicolor en cono de 4.5 m; criaturas con ≤6d10 PV quedan cegadas 1 turno." },
  { name: "Detectar magia",          level: 1, school: "Adivinación",   desc: "Concentración 10 min: percibe auras mágicas a 9 m y su escuela." },
  { name: "Identificar",             level: 1, school: "Adivinación",   desc: "Aprende las propiedades mágicas de un objeto o el efecto de un hechizo activo." },
  { name: "Disfrazarse",             level: 1, school: "Ilusionismo",   desc: "Tu ropa y rasgos cambian de apariencia hasta 1 hora (no engaña al tacto)." },
  { name: "Imagen silenciosa",       level: 1, school: "Ilusionismo",   desc: "Concentración 10 min: creas una imagen visual de tamaño ≤3×3×3 m a 18 m." },
  { name: "Caída de pluma",          level: 1, school: "Transmutación", desc: "Reacción: hasta 5 criaturas que caen descienden 18 m/turno sin daño." },
  { name: "Saltar",                  level: 1, school: "Transmutación", desc: "Triplica la distancia de salto de una criatura durante 1 minuto." },
  { name: "Zancadas largas",         level: 1, school: "Transmutación", desc: "La velocidad de la criatura aumenta 3 m durante 1 hora." },
  { name: "Ola de trueno",           level: 1, school: "Evocación",     desc: "Onda de trueno 4.5 m de radio; TS de CON o 2d8 trueno + empujar 3 m." },
  { name: "Risa horrísona",          level: 1, school: "Encantamiento", desc: "Un humanoide a 9 m que falle SAB ríe sin control tumbado durante 1 min (concentración)." },
  { name: "Vida falsa",              level: 1, school: "Nigromancia",   desc: "Ganas 1d4+4 PV temporales durante 1 hora." },
  { name: "Sirviente invisible",     level: 1, school: "Conjuración",   desc: "Fuerza invisible y sin forma ejecuta tareas sencillas 1 hora; AC 10, 1 PV." },
  { name: "Disco flotante",          level: 1, school: "Conjuración",   desc: "Disco de fuerza horizontal (90 cm Ø, 1.5 m del suelo) sigue a 1.5 m; carga 250 kg, 1 hora." },
  { name: "Encontrar familiar",      level: 1, school: "Conjuración",   desc: "Convocar un familiar (cuervo, gato, sapo, lechuza, etc.) que actúa como explorador." },
  { name: "Neblina",                 level: 1, school: "Conjuración",   desc: "Concentración 1 hora: esfera de neblina de 6 m de radio muy difícil de ver dentro." },
  { name: "Grasa",                   level: 1, school: "Conjuración",   desc: "Suelo grasiento en 3×3 m; criaturas que entren o empiecen deben TS de DES o caen tumbadas." },
  { name: "Curar heridas",           level: 1, school: "Evocación",     desc: "Toca a una criatura y le restaura 1d8+mod de lanzamiento PV." },
  { name: "Palabra curativa",        level: 1, school: "Evocación",     desc: "Acción adicional: una criatura a 18 m recupera 1d4+mod de lanzamiento PV." },
  { name: "Rayo guía",              level: 1, school: "Evocación",      desc: "Proyectil radiante a 36 m; 4d6 radiante y el siguiente ataque contra ese objetivo tiene ventaja." },
  { name: "Bendición",              level: 1, school: "Encantamiento",  desc: "Concentración 1 min: hasta 3 criaturas añaden 1d4 a ataques y tiradas de salvación." },
  { name: "Orden",                  level: 1, school: "Encantamiento",  desc: "Un humanoide que falle SAB obedece una orden de una palabra (acercarse, huir, etc.)." },
  { name: "Infligir heridas",       level: 1, school: "Nigromancia",    desc: "Toque; ataque de hechizo de melé por 3d10 necrótico." },
  { name: "Amistad animal",         level: 1, school: "Encantamiento",  desc: "Un bestia que falle SAB queda encantada durante 24 horas." },
  { name: "Hablar con animales",     level: 1, school: "Adivinación",   desc: "Comprendes y puedes comunicarte con bestias durante 10 minutos." },
  { name: "Fuego feérico",          level: 1, school: "Evocación",      desc: "Luz delinea criaturas en cubo 6 m; las afectadas no se benefician de invisibilidad y los ataques contra ellas tienen ventaja." },
  { name: "Susurros disonantes",    level: 1, school: "Encantamiento",  desc: "Melodía perturbadora; TS de SAB o 3d6 psíquico y el objetivo huye su velocidad completa." },
  { name: "Heroísmo",               level: 1, school: "Encantamiento",  desc: "Concentración 1 min: una criatura es inmune al miedo y gana PV temporales igual a tu mod de lanzamiento cada turno." },
  { name: "Marca del cazador",      level: 1, school: "Adivinación",    desc: "Concentración 1 hora: marcas un objetivo; +1d6 daño al golpearlo, ventaja en Percepción/Supervivencia para rastrearlo." },
  { name: "Trampa",                 level: 1, school: "Abjuración",     desc: "Cuerda mágica en el suelo; el primer ser mediano o menor que pase queda retenido hasta TS de DES." },
  { name: "Maldición oscura",       level: 1, school: "Encantamiento",  desc: "Concentración 1 hora: maldices a un objetivo; tus ataques contra él infligen +1d6 de daño adicional." },
  { name: "Brazos de Hadar",        level: 1, school: "Conjuración",    desc: "Tentáculos de sombra en radio 3 m; TS de FUE o 2d6 necrótico, velocidad 0 hasta tu sig. turno." },
  { name: "Represalia infernal",    level: 1, school: "Evocación",      desc: "Reacción cuando te dañan: 2d10 de fuego al atacante." },
  { name: "Comprensión de idiomas", level: 1, school: "Adivinación",    desc: "Comprendes cualquier idioma hablado o escrito durante 1 hora." },
  { name: "Escritura ilusoria",     level: 1, school: "Ilusionismo",    desc: "Texto invisible legible solo por quien tú designes; otra criatura que lo toque queda confundida 1 turno." },
];

// ─── Level 2 Spells ────────────────────────────────────────────

const LEVEL2: Spell[] = [
  { name: "Paso brumoso",          level: 2, school: "Conjuración",   desc: "Acción adicional: te teletransportas hasta 9 m a un espacio que puedas ver." },
  { name: "Invisibilidad",         level: 2, school: "Ilusionismo",   desc: "Concentración 1 hora: una criatura se vuelve invisible hasta que ataque o lance un hechizo." },
  { name: "Imagen especular",      level: 2, school: "Ilusionismo",   desc: "3 duplicados ilusorios de ti mismo; ataques contra ti pueden impactar a un duplicado en su lugar." },
  { name: "Paralizar persona",     level: 2, school: "Encantamiento", desc: "Concentración 1 min: un humanoide que falle SAB queda paralizado." },
  { name: "Sugestión",             level: 2, school: "Encantamiento", desc: "Concentración 8 horas: un objetivo que falle SAB sigue tu sugerencia razonable." },
  { name: "Silencio",              level: 2, school: "Ilusionismo",   desc: "Concentración 10 min: esfera de 6 m sin sonido; inmunidad a trueno, no se pueden lanzar hechizos con componentes vocales." },
  { name: "Rayo ardiente",         level: 2, school: "Evocación",     desc: "Hasta 3 rayos de fuego (ataque a distancia cada uno, 2d6 fuego por impacto) a 36 m." },
  { name: "Flecha ácida",          level: 2, school: "Evocación",     desc: "Flecha corrosiva a 27 m; 4d4 ácido inmediato + 2d4 al final del próximo turno." },
  { name: "Destrozar",             level: 2, school: "Evocación",     desc: "Explosión de sonido en punto a 18 m; TS de CON o 3d8 trueno; objetos no mágicos sufren daño." },
  { name: "Ver invisibilidad",     level: 2, school: "Adivinación",   desc: "Durante 1 hora puedes ver criaturas e ilusiones invisibles." },
  { name: "Detectar pensamientos", level: 2, school: "Adivinación",   desc: "Concentración 1 min: sientes pensamientos superficiales de una criatura a 9 m." },
  { name: "Ampliar/Reducir",       level: 2, school: "Transmutación", desc: "Concentración 1 min: una criatura u objeto duplica o reduce a la mitad su tamaño y daño." },
  { name: "Visión en la oscuridad",level: 2, school: "Transmutación", desc: "Una criatura toca obtiene visión en la oscuridad 18 m durante 8 horas." },
  { name: "Levitar",               level: 2, school: "Transmutación", desc: "Concentración 10 min: una criatura u objeto hasta 250 kg flota hasta 6 m, velocidad de ascenso/descenso 6 m." },
  { name: "Trepar arañas",         level: 2, school: "Transmutación", desc: "Concentración 1 hora: una criatura trepa superficies verticales y cuelga del techo." },
  { name: "Telaraña",              level: 2, school: "Conjuración",   desc: "Concentración 1 hora: telaraña en cubo 6 m de lado; terreno difícil, TS de DES o quedar atrapado." },
  { name: "Oscuridad",             level: 2, school: "Evocación",     desc: "Concentración 10 min: oscuridad mágica en radio de 4.5 m que bloquea incluso visión en la oscuridad." },
  { name: "Cerrojo arcano",        level: 2, school: "Abjuración",    desc: "Un puerta, ventana o cofre queda cerrado permanentemente; solo tú puedes abrirlo fácilmente." },
  { name: "Mejorar atributo",      level: 2, school: "Transmutación", desc: "Concentración 1 hora: una criatura tiene ventaja en todas las pruebas de un atributo elegido." },
  { name: "Restauración menor",    level: 2, school: "Abjuración",    desc: "Eliminas una enfermedad o condición (cegado, ensordecido, paralizado o envenenado) de una criatura." },
  { name: "Auxilio",               level: 2, school: "Abjuración",    desc: "Hasta 3 criaturas ganan +5 máximo y PV actuales de PV durante 8 horas." },
  { name: "Oración curativa",      level: 2, school: "Evocación",     desc: "Hasta 6 criaturas a 9 m recuperan 2d8+mod de lanzamiento PV cada una (no requiere concentración)." },
  { name: "Arma espiritual",       level: 2, school: "Evocación",     desc: "Concentración 1 min: arma espectral a 18 m que ataca con acción adicional (1d8+mod de lanzamiento)." },
  { name: "Calmar emociones",      level: 2, school: "Encantamiento", desc: "Concentración 1 min: neutraliza encantamientos o miedo en criaturas en radio de 6 m." },
  { name: "Rayo de luna",          level: 2, school: "Evocación",     desc: "Concentración 1 min: columna de luz lunar de 1.5 m de radio; TS de CON o 2d10 radiante." },
  { name: "Crecimiento de pinchos",level: 2, school: "Transmutación", desc: "Concentración 10 min: terreno difícil en radio 6 m; criaturas que se muevan por él: 2d4 perforante por metro." },
  { name: "Nube de dagas",         level: 2, school: "Conjuración",   desc: "Concentración 1 min: cubo 1.5 m de dagas giratorias; 4d4 perforante por turno a quienes estén dentro." },
  { name: "Cautivar",              level: 2, school: "Encantamiento", desc: "Concentración 1 min: uno o más humanoides que fallen SAB quedan cautivados por tu discurso en radio 18 m." },
  { name: "Fuerza fantasmal",      level: 2, school: "Ilusionismo",   desc: "Concentración 1 min: una criatura percibe una ilusión aterradora y recibe 1d6 psíquico/turno." },
  { name: "Rayo debilitante",      level: 2, school: "Nigromancia",   desc: "Concentración 1 min: ataque de hechizo a distancia; el objetivo hace sus tiradas de daño de FUE con desventaja." },
  { name: "Abrir",                 level: 2, school: "Transmutación", desc: "Abre hasta 3 cerraduras, objetos o cadenas cerradas mágicamente en un radio de 9 m." },
  { name: "Ceguera/Sordera",       level: 2, school: "Nigromancia",   desc: "TS de CON o la criatura queda ciega o sorda durante 1 minuto." },
];

// ─── Level 3 Spells ────────────────────────────────────────────

const LEVEL3: Spell[] = [
  { name: "Bola de fuego",          level: 3, school: "Evocación",     desc: "Explosión en radio de 6 m a 45 m; TS de DES o 8d6 fuego (mitad si supera)." },
  { name: "Rayo",                   level: 3, school: "Evocación",     desc: "Línea de rayo de 27 m; TS de DES o 8d6 de rayo." },
  { name: "Contrahechizo",          level: 3, school: "Abjuración",    desc: "Reacción a 18 m: cancelas automáticamente un hechizo de nivel ≤3 (o prueba para niveles mayores)." },
  { name: "Disipar magia",          level: 3, school: "Abjuración",    desc: "Termina hechizos activos de nivel ≤3 en un objetivo; prueba para los de mayor nivel." },
  { name: "Volar",                  level: 3, school: "Transmutación", desc: "Concentración 10 min: velocidad de vuelo 18 m para una criatura." },
  { name: "Prisa",                  level: 3, school: "Transmutación", desc: "Concentración 1 min: una criatura duplica velocidad, +2 CA, ventaja en TS de DES y una acción extra limitada." },
  { name: "Ralentizar",             level: 3, school: "Transmutación", desc: "Concentración 1 min: hasta 6 criaturas que fallen SAB van a la mitad, −2 CA y sin acción adicional." },
  { name: "Patrón hipnótico",       level: 3, school: "Ilusionismo",   desc: "Concentración 1 min: criaturas en cubo 9 m que fallen SAB quedan incapacitadas e inmóviles." },
  { name: "Imagen mayor",           level: 3, school: "Ilusionismo",   desc: "Concentración 10 min: imagen de hasta 6×6×6 m con sonido, olor y temperatura." },
  { name: "Forma gaseosa",          level: 3, school: "Transmutación", desc: "Concentración 1 hora: una criatura se convierte en gas, puede atravesar ranuras y es resistente a daño no mágico." },
  { name: "Toque vampírico",        level: 3, school: "Nigromancia",   desc: "Concentración 1 min: ataque de hechizo de melé; 3d6 necrótico, recuperas la mitad del daño en PV." },
  { name: "Animar muertos",         level: 3, school: "Nigromancia",   desc: "Animas hasta 3 esqueletos o zombis de cadáveres a 3 m bajo tus órdenes durante 24 horas." },
  { name: "Miedo",                  level: 3, school: "Ilusionismo",   desc: "Concentración 1 min: criaturas en cono 9 m que fallen SAB quedan asustadas y huyen." },
  { name: "Maldición",              level: 3, school: "Nigromancia",   desc: "Concentración hasta 1 hora: penaliza pruebas de un atributo y +1d8 necrótico al golpear al objetivo." },
  { name: "Eliminación de maldición",level: 3, school: "Abjuración",  desc: "Eliminás hasta 3 maldiciones o encantos de una criatura." },
  { name: "Guardianes espirituales",level: 3, school: "Evocación",     desc: "Concentración 10 min: espíritus en radio de 4.5 m; criaturas dentro a velocidad media y 3d8 radiante/necrótico/turno." },
  { name: "Revivir",                level: 3, school: "Nigromancia",   desc: "Devuelves la vida a una criatura muerta hace menos de 1 minuto con 1 PV." },
  { name: "Luz del día",            level: 3, school: "Evocación",     desc: "Punto que emite luz brillante en radio 18 m durante 1 hora (supera oscuridad mágica de nivel ≤3)." },
  { name: "Hambre de Hadar",        level: 3, school: "Conjuración",   desc: "Concentración 1 min: esfera de 4.5 m de tinieblas; criaturas dentro reciben 2d6 frío y 2d6 ácido/turno." },
  { name: "Crecer plantas",         level: 3, school: "Transmutación", desc: "Plantas en radio 30 m crecen densas, terreno muy difícil; o crecen en área de 100 m de radio (no combate)." },
  { name: "Envío",                  level: 3, school: "Evocación",     desc: "Envías un mensaje de 25 palabras a cualquier criatura conocida; puede responder brevemente." },
  { name: "Lenguas",                level: 3, school: "Adivinación",   desc: "Concentración 1 hora: una criatura comprende cualquier idioma hablado y es comprendida al hablar." },
  { name: "Nube apestosa",          level: 3, school: "Conjuración",   desc: "Concentración 1 min: nube de gas en radio 6 m; TS de CON o nauseas y pierden la acción." },
  { name: "Parpadeo",               level: 3, school: "Transmutación", desc: "Al final de cada uno de tus turnos hay un 50% de chance de ir al Plano Etéreo hasta el siguiente turno." },
  { name: "Respirar bajo el agua",  level: 3, school: "Transmutación", desc: "Hasta 10 criaturas voluntarias respiran bajo el agua durante 24 horas." },
];

// ─── Level 4 Spells ────────────────────────────────────────────

const LEVEL4: Spell[] = [
  { name: "Polimorfismo",          level: 4, school: "Transmutación", desc: "Concentración 1 hora: transforma criatura o tú mismo en una bestia; usa las estadísticas de esa bestia." },
  { name: "Invisibilidad mayor",   level: 4, school: "Ilusionismo",   desc: "Concentración 1 min: tú o criatura tocada permanece invisible incluso al atacar o lanzar hechizos." },
  { name: "Puerta dimensional",    level: 4, school: "Conjuración",   desc: "Te teletransportas (y un aliado) a cualquier punto a 150 m que puedas visualizar o describir." },
  { name: "Confusión",             level: 4, school: "Encantamiento", desc: "Concentración 1 min: criaturas en radio 4.5 m que fallen SAB actúan aleatoriamente cada turno." },
  { name: "Muro de fuego",         level: 4, school: "Evocación",     desc: "Concentración 1 min: muro de 18 m largo, 6 m alto, 0.3 m grueso; 5d8 fuego al cruzar." },
  { name: "Tormenta de hielo",     level: 4, school: "Evocación",     desc: "Cilindro de 6 m de radio: 2d8 contundente + 4d6 frío; terreno difícil hasta tu siguiente turno." },
  { name: "Destierro",             level: 4, school: "Abjuración",    desc: "Concentración 1 min: TS de CAR o el objetivo es desterrado; si es extraplanar, queda allí permanentemente." },
  { name: "Piel pétrea",           level: 4, school: "Abjuración",    desc: "Concentración 1 hora: resistencia al daño no mágico para una criatura que tocas." },
  { name: "Tentáculos negros",     level: 4, school: "Conjuración",   desc: "Concentración 1 min: tentáculos en cubo 6 m; TS de DES o quedar atrapado (3d6 contundente/turno)." },
  { name: "Plaga",                 level: 4, school: "Nigromancia",   desc: "Magia necrótica en radio 1.5 m; TS de CON o 8d8 necrótico (mitad si supera)." },
  { name: "Libertad de movimientos",level: 4, school: "Abjuración",   desc: "8 horas: una criatura ignora terreno difícil y magia de restricción; puede moverse y atacar bajo el agua normal." },
  { name: "Guardián de la fe",     level: 4, school: "Conjuración",   desc: "Guardián espectral en espacio de 3×3 m; criaturas hostiles reciben 20 de daño radiante (hasta 60 total)." },
  { name: "Ojo arcano",            level: 4, school: "Adivinación",   desc: "Concentración 1 hora: ojo mágico invisible que vuela 9 m/turno y puede ver en la oscuridad." },
  { name: "Escudo de fuego",       level: 4, school: "Evocación",     desc: "10 min: llamas cálidas o frías te envuelven; resistencia a frío/fuego y atacantes a melé reciben 2d8 daño." },
  { name: "Asesino fantasmal",     level: 4, school: "Ilusionismo",   desc: "Concentración 1 min: terror personalizado visible solo para el objetivo; 4d10 psíquico/turno si falla SAB." },
];

// ─── Level 5 Spells ────────────────────────────────────────────

const LEVEL5: Spell[] = [
  { name: "Cono de frío",          level: 5, school: "Evocación",     desc: "Cono helado de 18 m; TS de CON o 8d8 frío (mitad si supera)." },
  { name: "Bola de fuego potenciada",level: 5, school: "Evocación",   desc: "Como Bola de fuego pero inflige 10d6 fuego; la explosión tiene 9 m de radio." },
  { name: "Dominar persona",       level: 5, school: "Encantamiento", desc: "Concentración 1 min: controlas mentalmente a un humanoide que falle SAB." },
  { name: "Telequinesis",          level: 5, school: "Transmutación", desc: "Concentración 10 min: mueves criaturas u objetos a distancia; hasta 500 kg." },
  { name: "Bloquear monstruo",     level: 5, school: "Encantamiento", desc: "Concentración 1 min: cualquier criatura que falle SAB queda paralizada (no solo humanoides)." },
  { name: "Muro de fuerza",        level: 5, school: "Evocación",     desc: "Concentración 10 min: muro invisible e irrompible de fuerza (sin forma fija, ≤250 m²)." },
  { name: "Muro de piedra",        level: 5, school: "Evocación",     desc: "Concentración 10 min: muro de piedra de hasta 50 paneles de 3×3 m, impenetrable." },
  { name: "Leyenda antigua",       level: 5, school: "Adivinación",   desc: "En 10 minutos obtienes información sobre personas, lugares o cosas legendarias (hasta 3 datos)." },
  { name: "Modificar memoria",     level: 5, school: "Encantamiento", desc: "Concentración 1 min: TS de SAB; en éxito puedes alterar un recuerdo de los últimos 24 horas del objetivo." },
  { name: "Pasaredes",             level: 5, school: "Transmutación", desc: "Creas un pasaje de 1 m de ancho y 3 m de largo a través de madera, yeso, piedra o metal durante 1 hora." },
  { name: "Scruta",                level: 5, school: "Adivinación",   desc: "Concentración 10 min: creas un sensor invisible junto a una criatura en cualquier plano (TS de SAB para resistir)." },
  { name: "Resucitar muertos",     level: 5, school: "Nigromancia",   desc: "Devuelve la vida a criatura muerta hace hasta 10 días; necesitas el cuerpo; regresa con 1 PV." },
  { name: "Círculo de teletransporte",level: 5, school: "Conjuración",desc: "Creas un portal permanente de 1 min que conecta con un círculo permanente que conoces en otro lugar." },
  { name: "Animar objetos",        level: 5, school: "Transmutación", desc: "Concentración 1 min: animas hasta 10 objetos pequeños (o menos de mayor tamaño) que atacan por ti." },
  { name: "Nube de muerte",        level: 5, school: "Conjuración",   desc: "Concentración 10 min: esfera de 6 m de gas venenoso; TS de CON o 5d8 veneno (mitad si supera)." },
];

// ─── All spells by level ───────────────────────────────────────

export const ALL_SPELLS: Spell[] = [...CANTRIPS, ...LEVEL1, ...LEVEL2, ...LEVEL3, ...LEVEL4, ...LEVEL5];

// ─── Spell lists per class ──────────────────────────────────────
// Arrays of spell names the class has access to

const BARD_SPELLS = new Set([
  // Cantrips
  "Prestidigitación","Luz","Ilusión menor","Mofa cruel","Mensaje","Reparar","Mano de mago",
  "Taumaturgia","Amistad","Trucos de mano","Golpe certero",
  // Level 1
  "Curar heridas","Palabra curativa","Amistad animal","Encantamiento de persona","Imagen silenciosa",
  "Risa horrísona","Hablar con animales","Susurros disonantes","Heroísmo","Identificar","Dormir",
  "Ola de trueno","Comprensión de idiomas","Detectar magia","Disfrazarse","Caída de pluma",
  // Level 2
  "Auxilio","Calmar emociones","Detectar pensamientos","Mejorar atributo","Invisibilidad",
  "Imagen especular","Paso brumoso","Nube de dagas","Ver invisibilidad","Sugestión","Silencio",
  "Cautivar","Restauración menor","Fuerza fantasmal","Ampliar/Reducir",
  // Level 3
  "Disipar magia","Envío","Miedo","Patrón hipnótico","Imagen mayor","Lenguas","Nube apestosa",
  "Luz del día","Contrahechizo","Crecer plantas",
  // Level 4
  "Confusión","Libertad de movimientos","Polimorfismo","Puerta dimensional","Invisibilidad mayor",
  // Level 5
  "Dominar persona","Leyenda antigua","Modificar memoria","Scruta","Muro de fuerza",
]);

const WIZARD_SPELLS = new Set([
  // Cantrips
  "Salpicadura ácida","Toque helado","Luces danzantes","Rayo de fuego","Amistad","Luz",
  "Mano de mago","Reparar","Mensaje","Ilusión menor","Atomizador venenoso","Prestidigitación",
  "Rayo de escarcha","Sacudida eléctrica","Golpe certero","Taumaturgia",
  // Level 1
  "Proyectil mágico","Escudo","Armadura de mago","Dormir","Manos ardientes","Encantamiento de persona",
  "Spray de colores","Detectar magia","Identificar","Disfrazarse","Imagen silenciosa","Caída de pluma",
  "Saltar","Zancadas largas","Ola de trueno","Risa horrísona","Vida falsa","Sirviente invisible",
  "Disco flotante","Encontrar familiar","Neblina","Grasa","Comprensión de idiomas","Escritura ilusoria",
  // Level 2
  "Paso brumoso","Invisibilidad","Imagen especular","Paralizar persona","Sugestión","Silencio",
  "Rayo ardiente","Flecha ácida","Destrozar","Ver invisibilidad","Detectar pensamientos",
  "Ampliar/Reducir","Visión en la oscuridad","Levitar","Trepar arañas","Telaraña","Oscuridad",
  "Cerrojo arcano","Mejorar atributo","Nube de dagas","Fuerza fantasmal","Rayo debilitante",
  "Abrir","Ceguera/Sordera",
  // Level 3
  "Bola de fuego","Rayo","Contrahechizo","Disipar magia","Volar","Prisa","Ralentizar",
  "Patrón hipnótico","Imagen mayor","Forma gaseosa","Toque vampírico","Animar muertos",
  "Miedo","Maldición","Eliminación de maldición","Envío","Lenguas","Nube apestosa","Parpadeo",
  "Respirar bajo el agua","Luz del día",
  // Level 4
  "Polimorfismo","Invisibilidad mayor","Puerta dimensional","Confusión","Muro de fuego",
  "Tormenta de hielo","Destierro","Piel pétrea","Tentáculos negros","Plaga","Ojo arcano",
  "Escudo de fuego","Asesino fantasmal",
  // Level 5
  "Cono de frío","Bola de fuego potenciada","Dominar persona","Telequinesis","Bloquear monstruo",
  "Muro de fuerza","Muro de piedra","Leyenda antigua","Modificar memoria","Pasaredes","Scruta",
  "Círculo de teletransporte","Animar objetos","Nube de muerte",
]);

const SORCERER_SPELLS = new Set([
  // Cantrips (same as wizard minus some)
  "Salpicadura ácida","Toque helado","Luces danzantes","Rayo de fuego","Amistad","Luz",
  "Mano de mago","Reparar","Mensaje","Ilusión menor","Atomizador venenoso","Prestidigitación",
  "Rayo de escarcha","Sacudida eléctrica","Golpe certero",
  // Level 1
  "Proyectil mágico","Escudo","Armadura de mago","Dormir","Manos ardientes","Encantamiento de persona",
  "Spray de colores","Detectar magia","Imagen silenciosa","Caída de pluma","Saltar","Zancadas largas",
  "Ola de trueno","Vida falsa","Neblina","Grasa","Comprensión de idiomas",
  // Level 2
  "Paso brumoso","Invisibilidad","Imagen especular","Paralizar persona","Sugestión","Silencio",
  "Rayo ardiente","Ver invisibilidad","Detectar pensamientos","Ampliar/Reducir","Visión en la oscuridad",
  "Levitar","Oscuridad","Nube de dagas","Fuerza fantasmal","Ceguera/Sordera",
  // Level 3
  "Bola de fuego","Rayo","Contrahechizo","Disipar magia","Volar","Prisa","Ralentizar",
  "Patrón hipnótico","Imagen mayor","Forma gaseosa","Miedo","Envío","Lenguas","Nube apestosa",
  "Parpadeo","Luz del día",
  // Level 4
  "Polimorfismo","Invisibilidad mayor","Puerta dimensional","Confusión","Muro de fuego",
  "Tormenta de hielo","Destierro","Piel pétrea","Escudo de fuego",
  // Level 5
  "Cono de frío","Bola de fuego potenciada","Dominar persona","Telequinesis","Bloquear monstruo",
  "Muro de fuerza","Leyenda antigua","Modificar memoria","Nube de muerte",
]);

const WARLOCK_SPELLS = new Set([
  // Cantrips
  "Explosión sobrenatural","Tañido funerario","Toque helado","Mano de mago","Ilusión menor",
  "Atomizador venenoso","Prestidigitación","Golpe certero","Amistad",
  // Level 1
  "Maldición oscura","Brazos de Hadar","Represalia infernal","Proyectil mágico","Encantamiento de persona",
  "Detectar magia","Protección del bien y del mal","Imagen silenciosa","Comprensión de idiomas",
  "Escritura ilusoria","Hablar con animales","Vida falsa",
  // Level 2
  "Nube de dagas","Cautivar","Oscuridad","Ver invisibilidad","Sugestión","Silencio",
  "Imagen especular","Paso brumoso","Fuerza fantasmal","Invisibilidad","Detectar pensamientos",
  // Level 3
  "Hambre de Hadar","Contrahechizo","Disipar magia","Miedo","Patrón hipnótico","Imagen mayor",
  "Animar muertos","Forma gaseosa","Toque vampírico","Lenguas","Envío",
  // Level 4
  "Destierro","Puerta dimensional","Plaga","Asesino fantasmal","Confusión","Invisibilidad mayor",
  // Level 5
  "Dominar persona","Bloquear monstruo","Scruta","Leyenda antigua","Nube de muerte",
]);

const CLERIC_SPELLS = new Set([
  // Cantrips
  "Llama sagrada","Salvar al moribundo","Guía","Taumaturgia","Luz","Reparar",
  "Atomizador venenoso","Mano de mago","Toque helado",
  // Level 1
  "Curar heridas","Palabra curativa","Infligir heridas","Rayo guía","Bendición","Orden",
  "Detectar magia","Detectar el mal y el bien","Santuario","Protección del bien y del mal",
  "Herida de fuego","Escudo de la fe","Crear o destruir agua",
  // Level 2
  "Restauración menor","Oración curativa","Arma espiritual","Calmar emociones","Auxilio",
  "Silencio","Bloquear persona","Ver invisibilidad","Sugestión","Oscuridad",
  // Level 3
  "Guardianes espirituales","Revivir","Luz del día","Animar muertos","Disipar magia",
  "Maldición","Envío","Lenguas","Eliminación de maldición",
  // Level 4
  "Guardián de la fe","Libertad de movimientos","Polimorfismo","Destierro","Piel pétrea",
  // Level 5
  "Resucitar muertos","Leyenda antigua","Modificar memoria","Bloquear monstruo","Muro de piedra",
]);

const DRUID_SPELLS = new Set([
  // Cantrips
  "Artesanía druídica","Producir llama","Estaka de druida","Guía","Luz","Reparar",
  "Taumaturgia","Salvar al moribundo",
  // Level 1
  "Curar heridas","Palabra curativa","Amistad animal","Hablar con animales","Fuego feérico",
  "Enredar","Detectar magia","Neblina","Saltar","Zancadas largas","Crear o destruir agua",
  // Level 2
  "Restauración menor","Rayo de luna","Crecimiento de pinchos","Mejorar atributo","Ampliar/Reducir",
  "Visión en la oscuridad","Levitar","Silencio","Pasar sin rastro",
  // Level 3
  "Luz del día","Crecer plantas","Disipar magia","Hablar con plantas","Forma gaseosa",
  "Maldición","Lenguas","Revivir","Convocar animales",
  // Level 4
  "Polimorfismo","Libertad de movimientos","Piel pétrea","Tormenta de hielo","Muro de fuego",
  // Level 5
  "Resucitar muertos","Leyenda antigua","Muro de piedra","Bloquear monstruo","Nube de muerte",
]);

const PALADIN_SPELLS = new Set([
  // Level 1
  "Curar heridas","Bendición","Detectar el mal y el bien","Heroísmo","Protección del bien y del mal",
  "Escudo de la fe","Purificar comida y bebida","Orden",
  // Level 2
  "Auxilio","Restauración menor","Arma espiritual","Detectar pensamientos","Buscar trampa",
  "Zona de verdad","Silencio","Ley y orden",
  // Level 3
  "Disipar magia","Luz del día","Eliminar maldición","Revivir","Envío",
  // Level 4
  "Destierro","Libertad de movimientos","Guardián de la fe",
  // Level 5
  "Resucitar muertos","Disipar el mal y el bien","Bloquear monstruo",
]);

const RANGER_SPELLS = new Set([
  // Level 1
  "Marca del cazador","Trampa","Amistad animal","Hablar con animales","Detectar magia",
  "Curar heridas","Saltar","Zancadas largas","Neblina","Enredar",
  // Level 2
  "Pasar sin rastro","Crecimiento de pinchos","Silencio","Restauración menor","Mejorar atributo",
  "Visión en la oscuridad","Ver invisibilidad","Buscar trampa",
  // Level 3
  "Luz del día","Crecer plantas","Hablar con plantas","Disipar magia","Revivir",
  // Level 4
  "Libertad de movimientos","Polimorfismo",
  // Level 5
  "Leyenda antigua","Nube de muerte",
]);

export const CLASS_SPELL_SETS: Record<string, Set<string>> = {
  "Bardo":      BARD_SPELLS,
  "Mago":       WIZARD_SPELLS,
  "Hechicero":  SORCERER_SPELLS,
  "Brujo":      WARLOCK_SPELLS,
  "Clérigo":    CLERIC_SPELLS,
  "Druida":     DRUID_SPELLS,
  "Paladín":    PALADIN_SPELLS,
  "Explorador": RANGER_SPELLS,
};

// Returns the spell objects available to a class up to a max level
export function getSpellsForClass(charClass: string, maxLevel: number): Spell[] {
  const set = CLASS_SPELL_SETS[charClass];
  if (!set) return [];
  return ALL_SPELLS.filter((s) => s.level <= maxLevel && set.has(s.name));
}

// ─── Which classes need spell selection on level-up ─────────────

export const KNOWN_CASTERS = new Set(["Mago", "Bardo", "Hechicero", "Brujo", "Explorador"]);
export const PREPARED_CASTERS = new Set(["Clérigo", "Druida", "Paladín"]);
export const NON_CASTERS = new Set(["Guerrero", "Bárbaro", "Monje"]);

// Max spell level accessible at a given character level
export function maxSpellLevel(charClass: string, charLevel: number): number {
  if (NON_CASTERS.has(charClass)) return 0;
  if (charClass === "Paladín" || charClass === "Explorador") {
    if (charLevel < 2) return 0;
    return Math.min(5, Math.ceil((charLevel - 1) / 4));
  }
  return Math.min(9, Math.ceil(charLevel / 2));
}

// ─── Spell gaining progression ─────────────────────────────────

export type SpellGain = {
  newSpells: number;
  newCantrips: number;
  maxLevel: number;  // max spell level available to pick
  canReplace: boolean;
};

// Spells gained when leveling TO this level.
// Only defined for "known casters" (Mago, Bardo, Hechicero, Brujo, Explorador).
// Clérigo/Druida/Paladín are prepared casters — no selection needed.
export const SPELL_GAINS: Record<string, Record<number, SpellGain>> = {
  "Bardo": {
    1:  { newSpells: 2, newCantrips: 2, maxLevel: 1, canReplace: false },
    2:  { newSpells: 1, newCantrips: 0, maxLevel: 1, canReplace: false },
    3:  { newSpells: 1, newCantrips: 0, maxLevel: 2, canReplace: false },
    4:  { newSpells: 1, newCantrips: 1, maxLevel: 2, canReplace: true  },
    5:  { newSpells: 1, newCantrips: 0, maxLevel: 3, canReplace: false },
    6:  { newSpells: 1, newCantrips: 0, maxLevel: 3, canReplace: true  },
    7:  { newSpells: 1, newCantrips: 0, maxLevel: 4, canReplace: false },
    8:  { newSpells: 1, newCantrips: 0, maxLevel: 4, canReplace: true  },
    9:  { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    10: { newSpells: 2, newCantrips: 1, maxLevel: 5, canReplace: true  },
    11: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    12: { newSpells: 0, newCantrips: 0, maxLevel: 5, canReplace: true  },
    13: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    14: { newSpells: 2, newCantrips: 0, maxLevel: 5, canReplace: true  },
    15: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    16: { newSpells: 0, newCantrips: 0, maxLevel: 5, canReplace: true  },
    17: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    18: { newSpells: 2, newCantrips: 0, maxLevel: 5, canReplace: true  },
    19: { newSpells: 0, newCantrips: 0, maxLevel: 5, canReplace: true  },
    20: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
  },
  "Hechicero": {
    1:  { newSpells: 2, newCantrips: 4, maxLevel: 1, canReplace: false },
    2:  { newSpells: 1, newCantrips: 0, maxLevel: 1, canReplace: false },
    3:  { newSpells: 1, newCantrips: 0, maxLevel: 2, canReplace: false },
    4:  { newSpells: 1, newCantrips: 1, maxLevel: 2, canReplace: true  },
    5:  { newSpells: 1, newCantrips: 0, maxLevel: 3, canReplace: false },
    6:  { newSpells: 1, newCantrips: 0, maxLevel: 3, canReplace: true  },
    7:  { newSpells: 1, newCantrips: 0, maxLevel: 4, canReplace: false },
    8:  { newSpells: 1, newCantrips: 0, maxLevel: 4, canReplace: true  },
    9:  { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    10: { newSpells: 1, newCantrips: 1, maxLevel: 5, canReplace: true  },
    11: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    12: { newSpells: 0, newCantrips: 0, maxLevel: 5, canReplace: true  },
    13: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    14: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: true  },
    15: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    16: { newSpells: 0, newCantrips: 0, maxLevel: 5, canReplace: true  },
    17: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    18: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: true  },
    19: { newSpells: 0, newCantrips: 0, maxLevel: 5, canReplace: true  },
    20: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
  },
  "Brujo": {
    1:  { newSpells: 2, newCantrips: 2, maxLevel: 1, canReplace: false },
    2:  { newSpells: 1, newCantrips: 0, maxLevel: 1, canReplace: false },
    3:  { newSpells: 2, newCantrips: 0, maxLevel: 2, canReplace: true  },
    4:  { newSpells: 1, newCantrips: 1, maxLevel: 2, canReplace: true  },
    5:  { newSpells: 1, newCantrips: 0, maxLevel: 3, canReplace: false },
    6:  { newSpells: 1, newCantrips: 0, maxLevel: 3, canReplace: true  },
    7:  { newSpells: 1, newCantrips: 0, maxLevel: 4, canReplace: false },
    8:  { newSpells: 1, newCantrips: 0, maxLevel: 4, canReplace: true  },
    9:  { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    10: { newSpells: 1, newCantrips: 1, maxLevel: 5, canReplace: true  },
    11: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    12: { newSpells: 0, newCantrips: 0, maxLevel: 5, canReplace: true  },
    13: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    14: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: true  },
    15: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    16: { newSpells: 0, newCantrips: 0, maxLevel: 5, canReplace: true  },
    17: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    18: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: true  },
    19: { newSpells: 0, newCantrips: 0, maxLevel: 5, canReplace: true  },
    20: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
  },
  "Mago": {
    1:  { newSpells: 6, newCantrips: 3, maxLevel: 1, canReplace: false },
    2:  { newSpells: 2, newCantrips: 0, maxLevel: 1, canReplace: false },
    3:  { newSpells: 2, newCantrips: 0, maxLevel: 2, canReplace: false },
    4:  { newSpells: 2, newCantrips: 1, maxLevel: 2, canReplace: false },
    5:  { newSpells: 2, newCantrips: 0, maxLevel: 3, canReplace: false },
    6:  { newSpells: 2, newCantrips: 0, maxLevel: 3, canReplace: false },
    7:  { newSpells: 2, newCantrips: 0, maxLevel: 4, canReplace: false },
    8:  { newSpells: 2, newCantrips: 0, maxLevel: 4, canReplace: false },
    9:  { newSpells: 2, newCantrips: 0, maxLevel: 5, canReplace: false },
    10: { newSpells: 2, newCantrips: 1, maxLevel: 5, canReplace: false },
    11: { newSpells: 2, newCantrips: 0, maxLevel: 5, canReplace: false },
    12: { newSpells: 2, newCantrips: 0, maxLevel: 5, canReplace: false },
    13: { newSpells: 2, newCantrips: 0, maxLevel: 5, canReplace: false },
    14: { newSpells: 2, newCantrips: 0, maxLevel: 5, canReplace: false },
    15: { newSpells: 2, newCantrips: 0, maxLevel: 5, canReplace: false },
    16: { newSpells: 2, newCantrips: 0, maxLevel: 5, canReplace: false },
    17: { newSpells: 2, newCantrips: 0, maxLevel: 5, canReplace: false },
    18: { newSpells: 2, newCantrips: 0, maxLevel: 5, canReplace: false },
    19: { newSpells: 2, newCantrips: 0, maxLevel: 5, canReplace: false },
    20: { newSpells: 2, newCantrips: 0, maxLevel: 5, canReplace: false },
  },
  "Explorador": {
    2:  { newSpells: 2, newCantrips: 0, maxLevel: 1, canReplace: false },
    3:  { newSpells: 1, newCantrips: 0, maxLevel: 1, canReplace: false },
    4:  { newSpells: 0, newCantrips: 0, maxLevel: 1, canReplace: false },
    5:  { newSpells: 1, newCantrips: 0, maxLevel: 2, canReplace: false },
    6:  { newSpells: 0, newCantrips: 0, maxLevel: 2, canReplace: false },
    7:  { newSpells: 1, newCantrips: 0, maxLevel: 2, canReplace: false },
    8:  { newSpells: 0, newCantrips: 0, maxLevel: 2, canReplace: false },
    9:  { newSpells: 1, newCantrips: 0, maxLevel: 3, canReplace: false },
    10: { newSpells: 0, newCantrips: 0, maxLevel: 3, canReplace: false },
    11: { newSpells: 1, newCantrips: 0, maxLevel: 3, canReplace: false },
    12: { newSpells: 0, newCantrips: 0, maxLevel: 3, canReplace: false },
    13: { newSpells: 1, newCantrips: 0, maxLevel: 4, canReplace: false },
    14: { newSpells: 0, newCantrips: 0, maxLevel: 4, canReplace: false },
    15: { newSpells: 1, newCantrips: 0, maxLevel: 4, canReplace: false },
    16: { newSpells: 0, newCantrips: 0, maxLevel: 4, canReplace: false },
    17: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    18: { newSpells: 0, newCantrips: 0, maxLevel: 5, canReplace: false },
    19: { newSpells: 1, newCantrips: 0, maxLevel: 5, canReplace: false },
    20: { newSpells: 0, newCantrips: 0, maxLevel: 5, canReplace: false },
  },
};
