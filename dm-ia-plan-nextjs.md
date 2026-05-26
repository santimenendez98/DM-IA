# DM IA — Plan de proyecto (Next.js)

Proyecto de portafolio: Dungeon Master con IA que mantiene memoria persistente de campañas, personajes, items y mundo.

**Stack:** Next.js 14+ (App Router) + TypeScript + TailwindCSS / Firestore o Supabase / Claude API / Vercel

---

## Progreso general

- [ ] Fase 0 — Setup inicial
- [ ] Fase 1 — MVP funcional
- [ ] Fase 2 — Memoria y estado estructurado
- [ ] Fase 3 — UI rica
- [ ] Fase 4 — Polish para portafolio

---

## Fase 0 — Setup inicial (1-2 días)

### Repo y proyecto

- [x] **0.1** Crear repo en GitHub con README, .gitignore y licencia MIT
- [x] **0.2** Inicializar Next.js: `npx create-next-app@latest dm-ia --typescript --tailwind --app --eslint`
- [x] **0.3** Estructura de carpetas: `/app /components /lib /lib/prompts /types`
- [x] **0.4** Configurar `.env.local` con variables: `ANTHROPIC_API_KEY`, credenciales DB, etc
- [x] **0.5** Agregar `.env.example` al repo (sin secrets) y `.env.local` al gitignore

### Servicios externos

- [ ] **0.6** Crear proyecto en Firebase (Firestore + Auth) o Supabase
- [ ] **0.7** Instalar SDK correspondiente: `firebase` o `@supabase/supabase-js`
- [ ] **0.8** Crear `lib/db.ts` con cliente exportado
- [ ] **0.9** Crear cuenta Anthropic y obtener API key
- [ ] **0.10** Instalar `@anthropic-ai/sdk` y crear `lib/claude.ts` con función `callClaude()`
- [ ] **0.11** Test: API route `/api/health` que llama a Claude y devuelve respuesta

### Deploy inicial

- [ ] **0.12** Conectar repo a Vercel
- [ ] **0.13** Configurar variables de entorno en Vercel
- [ ] **0.14** Verificar deploy exitoso con URL pública
- [ ] **0.15** Configurar dominio o subdominio (opcional)

---

## Fase 1 — MVP funcional (1-2 semanas)

**Objetivo:** Crear campaña, chatear con el DM, persistencia básica.

### Auth

- [ ] **1.1** Configurar Firebase Auth / Supabase Auth con email+password
- [ ] **1.2** Crear `lib/auth.ts` con helpers: `signUp`, `signIn`, `signOut`, `getCurrentUser`
- [ ] **1.3** Crear hook `useAuth()` con contexto de usuario
- [ ] **1.4** Página `/login` con form de login y registro (toggle)
- [ ] **1.5** Middleware de Next.js para proteger rutas autenticadas (`middleware.ts`)
- [ ] **1.6** Helper `getUserFromRequest()` para validar auth en API routes
- [ ] **1.7** Botón de logout en header

### Tipos TypeScript

- [ ] **1.8** Crear `types/index.ts` con interfaces: `Campaign`, `Character`, `Message`, `Item`, `NPC`, `Location`, `Quest`, `Summary`
- [ ] **1.9** Exportar tipos compartidos para frontend y API routes

### Modelo de datos

- [ ] **1.10** Schema/colección `campaigns`: id, userId, name, setting, tone, systemPrompt, createdAt, updatedAt
- [ ] **1.11** Schema/colección `characters`: campaignId, name, class, stats{}, hp, maxHp, level, backstory
- [ ] **1.12** Schema/colección `messages`: campaignId, role, content, turnNumber, createdAt
- [ ] **1.13** Configurar índices por `userId` y `campaignId`
- [ ] **1.14** Reglas de seguridad: cada usuario solo accede a sus campañas

### API routes

- [ ] **1.15** `POST /api/campaigns` — crear campaña
- [ ] **1.16** `GET /api/campaigns` — listar campañas del usuario
- [ ] **1.17** `GET /api/campaigns/[id]` — detalle de campaña
- [ ] **1.18** `DELETE /api/campaigns/[id]` — eliminar campaña
- [ ] **1.19** `POST /api/campaigns/[id]/characters` — crear personaje
- [ ] **1.20** `GET /api/campaigns/[id]/messages` — listar mensajes paginados
- [ ] **1.21** `POST /api/campaigns/[id]/message` — enviar mensaje y obtener respuesta del DM

### Lógica del DM

- [ ] **1.22** Crear `lib/prompts/dmSystem.ts` con system prompt base configurable por tono/setting
- [ ] **1.23** Función `buildMessages(campaignId)` que arma array de mensajes para Claude
- [ ] **1.24** Función `sendToDM(campaignId, userMessage)` que llama a Claude y guarda respuesta
- [ ] **1.25** Función `generateOpeningScene(campaign, character)` para mensaje inicial automático

### UI

- [ ] **1.26** Página `/` (landing) con CTA a login
- [ ] **1.27** Página `/dashboard` con lista de campañas y botón "Nueva campaña"
- [ ] **1.28** Modal/página "Nueva campaña": form con nombre, setting (select), tono (select)
- [ ] **1.29** Modal/página "Crear personaje": nombre, clase, stats, backstory
- [ ] **1.30** Página `/campaign/[id]` con layout básico (chat centrado)
- [ ] **1.31** Componente `<Chat />` con lista de mensajes scrolleable
- [ ] **1.32** Componente `<MessageInput />` con textarea y botón enviar
- [ ] **1.33** Indicador "DM está pensando..." mientras se espera respuesta
- [ ] **1.34** Auto-scroll al último mensaje
- [ ] **1.35** Markdown rendering en mensajes del DM (react-markdown)

**Criterio de fin de Fase 1:** Crear campaña → crear personaje → conversación de 20+ turnos persistida.

---

## Fase 2 — Memoria y estado estructurado (1-2 semanas)

**Objetivo:** Estado del juego se actualiza automáticamente, el DM no alucina.

### Schemas extendidos

- [ ] **2.1** Colección `items`: campaignId, ownerId, name, description, quantity, equipped, createdAt
- [ ] **2.2** Colección `npcs`: campaignId, name, description, relationship, location, alive, firstMet
- [ ] **2.3** Colección `locations`: campaignId, name, description, visited, connections[], currentLocation
- [ ] **2.4** Colección `quests`: campaignId, title, description, status, objectives[], rewards
- [ ] **2.5** Colección `summaries`: campaignId, upToTurn, content, createdAt

### Extracción automática de estado

- [ ] **2.6** Crear `lib/prompts/stateExtractor.ts` — prompt que devuelve JSON con cambios
- [ ] **2.7** Definir schema Zod para validar JSON del extractor
- [ ] **2.8** Función `extractStateChanges(userMsg, dmResponse, currentState)` que devuelve objeto tipado
- [ ] **2.9** Función `applyStateChanges(campaignId, changes)` que mapea a operaciones DB
- [ ] **2.10** Manejar operaciones: addItem, removeItem, updateHp, meetNpc, updateNpc, addLocation, visitLocation, addQuest, updateQuest
- [ ] **2.11** Integrar extractor en `/api/campaigns/[id]/message` (correr después de respuesta del DM)
- [ ] **2.12** Manejo de errores: retry una vez, logging, fallback sin actualizar
- [ ] **2.13** Usar Claude Haiku para el extractor (más barato y rápido)

### Sistema de resúmenes

- [ ] **2.14** Crear `lib/prompts/summarizer.ts` — prompt para generar resumen narrativo
- [ ] **2.15** Función `generateSummary(campaignId, fromTurn, toTurn)` que devuelve texto
- [ ] **2.16** Trigger automático: cada 20 turnos genera resumen incremental
- [ ] **2.17** Si existe resumen previo, usarlo como base + mensajes nuevos
- [ ] **2.18** Guardar resúmenes en DB para no regenerar

### Construcción del prompt mejorado

- [ ] **2.19** Función `buildContextualPrompt(campaignId)` que compone todo el contexto
- [ ] **2.20** Función `serializeGameState(state)` que convierte estado en texto legible
- [ ] **2.21** Inyectar en system prompt: lore + estado actual + último resumen + últimos 10 mensajes
- [ ] **2.22** Token budget: si excede límite, recortar mensajes más viejos primero
- [ ] **2.23** Logging de tokens usados por request para monitoreo

### Testing manual

- [ ] **2.24** Jugar sesión de 30+ turnos verificando que items se registran correctamente
- [ ] **2.25** Verificar que NPCs persisten en sesiones largas
- [ ] **2.26** Verificar que resúmenes capturan los eventos clave

**Criterio de fin de Fase 2:** 100+ turnos sin que el DM olvide items obtenidos ni NPCs conocidos.

---

## Fase 3 — UI rica (1 semana)

**Objetivo:** Interfaz tipo videojuego, no chat con sidebar.

### Layout

- [ ] **3.1** Layout 3 paneles en `/campaign/[id]`: izq personaje, centro chat, der mundo
- [ ] **3.2** Sidebars colapsables en desktop
- [ ] **3.3** Versión mobile con tabs o drawers
- [ ] **3.4** Listener en tiempo real (Firestore onSnapshot o Supabase realtime) para actualizar paneles

### Panel de personaje

- [ ] **3.5** Componente `<CharacterCard />`: nombre, clase, nivel, avatar
- [ ] **3.6** Componente `<HpBar />` con animación de cambio
- [ ] **3.7** Componente `<StatsGrid />` con stats principales
- [ ] **3.8** Componente `<Inventory />`: lista de items con icono, nombre, cantidad
- [ ] **3.9** Click en item muestra descripción (popover o modal)
- [ ] **3.10** Badge visual para items equipados
- [ ] **3.11** Filtros: todos / armas / armaduras / consumibles / otros

### Panel del mundo

- [ ] **3.12** Componente `<NpcList />` agrupado por relación (aliado/enemigo/neutral)
- [ ] **3.13** Click en NPC muestra descripción y contexto
- [ ] **3.14** Componente `<LocationsList />` con visitadas y conocidas
- [ ] **3.15** Indicador visual de ubicación actual
- [ ] **3.16** Componente `<QuestLog />` con activas arriba, completadas colapsables
- [ ] **3.17** Objetivos dentro de cada quest con checkbox visual

### Tiradas de dados

- [ ] **3.18** Componente `<DiceRoller />` con botones d4/d6/d8/d10/d12/d20/d100
- [ ] **3.19** Animación de tirada y mostrar resultado
- [ ] **3.20** Actualizar system prompt del DM para que use formato `[ROLL:d20+3]` cuando pida tiradas
- [ ] **3.21** Parser en frontend que detecta `[ROLL:...]` y renderiza botón inline
- [ ] **3.22** Al tirar, mandar resultado al chat automáticamente con formato claro

**Criterio de fin de Fase 3:** Se siente como un juego visual con estado vivo.

---

## Fase 4 — Polish para portafolio (1 semana)

**Objetivo:** Proyecto destacable y bien documentado.

### Features destacables

- [ ] **4.1** Integrar generación de imágenes (DALL-E 3, Flux o Stable Diffusion vía Replicate)
- [ ] **4.2** Botón "Generar imagen" en cards de NPCs y ubicaciones
- [ ] **4.3** Storage de imágenes (Firebase Storage / Supabase Storage)
- [ ] **4.4** Cache de imágenes generadas para no regenerar
- [ ] **4.5** Exportar campaña como markdown narrado (endpoint + descarga)
- [ ] **4.6** Exportar campaña como PDF (opcional, usando react-pdf o similar)
- [ ] **4.7** Switcher de campañas en header (dropdown sin volver al dashboard)
- [ ] **4.8** Tema visual: paleta cálida tipo pergamino, fuente serif para narrativa
- [ ] **4.9** Dark mode (opcional pero queda bien)

### Calidad UX

- [ ] **4.10** Toasts para errores y confirmaciones (sonner o react-hot-toast)
- [ ] **4.11** Empty states bien diseñados (sin campañas, sin NPCs, etc)
- [ ] **4.12** Skeleton loaders mientras carga
- [ ] **4.13** Paginación de mensajes (cargar más al scrollear arriba)
- [ ] **4.14** Confirmación antes de eliminar campañas
- [ ] **4.15** Página 404 personalizada

### Documentación

- [ ] **4.16** README completo con: descripción, demo GIF, stack, features, setup local
- [ ] **4.17** Sección "Arquitectura" con diagrama del sistema de memoria en capas
- [ ] **4.18** Sección "Decisiones técnicas" explicando 3-5 elecciones clave
- [ ] **4.19** Diagrama de flujo de datos (Excalidraw o Mermaid)
- [ ] **4.20** Screenshots de la app en el README
- [ ] **4.21** Video demo de 2-3 min mostrando sesión real (YouTube/Loom)
- [ ] **4.22** Link al deploy en producción visible en el README

### Performance y costos

- [ ] **4.23** Lazy loading de componentes pesados con `next/dynamic`
- [ ] **4.24** Optimizar imágenes con `next/image`
- [ ] **4.25** Rate limiting en API routes (upstash/ratelimit o similar)
- [ ] **4.26** Cache de resúmenes ya generados
- [ ] **4.27** Métricas: contador de tokens usados por usuario/campaña

### Bonus opcionales

- [ ] **4.28** Voice mode (TTS para respuestas del DM con ElevenLabs o Web Speech API)
- [ ] **4.29** Modo combate estructurado con iniciativa y daño calculado
- [ ] **4.30** Link público read-only para compartir una sesión
- [ ] **4.31** Múltiples personajes por campaña (party)
- [ ] **4.32** Streaming de respuestas del DM (mejor UX)

---

## Cronograma sugerido

| Semana | Foco                                            |
| ------ | ----------------------------------------------- |
| 1      | Fase 0 + Fase 1 (auth, schemas, chat funcional) |
| 2      | Terminar Fase 1 + arrancar Fase 2               |
| 3      | Fase 2 completa (memoria y estado)              |
| 4      | Fase 3 (UI rica)                                |
| 5      | Fase 4 (polish, docs, video demo)               |

---

## Riesgos y mitigaciones

| Riesgo                              | Mitigación                                                    |
| ----------------------------------- | ------------------------------------------------------------- |
| Extractor devuelve JSON malformado  | Validación con Zod, retry, fallback sin actualizar            |
| Costos de API se disparan           | Haiku para extracción, cache de resúmenes, rate limiting      |
| DM se contradice en sesiones largas | Estado estructurado explícito en cada prompt, no solo resumen |
| Scope creep                         | Bonus de Fase 4 son opcionales, MVP útil termina en Fase 3    |
| Vercel timeout en respuestas largas | Usar streaming, o background functions para tareas pesadas    |

---

## Estructura del proyecto

```
dm-ia/
├── app/
│   ├── page.tsx                      # landing
│   ├── login/page.tsx
│   ├── dashboard/page.tsx
│   ├── campaign/[id]/page.tsx
│   ├── layout.tsx
│   └── api/
│       ├── health/route.ts
│       ├── campaigns/
│       │   ├── route.ts              # GET, POST
│       │   └── [id]/
│       │       ├── route.ts          # GET, DELETE
│       │       ├── message/route.ts
│       │       ├── characters/route.ts
│       │       └── export/route.ts
│       └── auth/...
├── components/
│   ├── Chat.tsx
│   ├── MessageInput.tsx
│   ├── CharacterPanel.tsx
│   ├── WorldPanel.tsx
│   ├── DiceRoller.tsx
│   └── ui/                           # primitivos
├── lib/
│   ├── claude.ts
│   ├── db.ts
│   ├── auth.ts
│   ├── memory.ts                     # construcción de prompts
│   ├── stateExtractor.ts
│   ├── summarizer.ts
│   └── prompts/
│       ├── dmSystem.ts
│       ├── stateExtractor.ts
│       └── summarizer.ts
├── types/
│   └── index.ts
├── middleware.ts
├── .env.example
└── README.md
```
