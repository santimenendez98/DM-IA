# Hearth & Hall

Plataforma web para gestionar campañas de rol con un Dungeon Master impulsado por IA. Los jugadores crean personajes, se unen a campañas y juegan en tiempo real mientras una IA narra la historia, aplica reglas D&D 5e y actualiza el estado del juego automáticamente.

---

## Tecnologías

| Capa      | Tecnología                              |
| --------- | --------------------------------------- |
| Framework | Next.js 16 (App Router)                 |
| UI        | React 19 + CSS Modules                  |
| Auth & DB | Supabase (PostgreSQL + Auth + Realtime) |
| IA / DM   | OpenRouter → DeepSeek V3                |
| Imágenes  | Cloudinary                              |
| Idiomas   | Español · English · Português           |
| Lenguaje  | TypeScript                              |

---

## Requisitos previos

- **Node.js** 18 o superior
- **npm** 9 o superior
- Cuenta en [Supabase](https://supabase.com) (plan gratuito funciona)
- Cuenta en [OpenRouter](https://openrouter.ai) con créditos
- Cuenta en [Cloudinary](https://cloudinary.com) (plan gratuito funciona)
- _(Opcional)_ Cuenta en [Google Cloud Console](https://console.cloud.google.com) para login con Google

---

## Instalación rápida

```bash
git clone <url-del-repo>
cd dm-ia
npm install
cp .env.example .env.local
```

Completa `.env.local` con tus claves (ver sección siguiente) y luego:

```bash
npm run dev
```

La app estará en `http://localhost:3000`.

---

## Variables de entorno

Copia `.env.example` a `.env.local` y rellena cada valor:

```env
# ── IA ──────────────────────────────────────────────────────────
OPENROUTER_API_KEY=sk-or-...

# ── Supabase ────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...

# ── Cloudinary ──────────────────────────────────────────────────
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu-cloud-name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=tu-upload-preset

# ── Rate limiting (opcional) ────────────────────────────────────
# Llamadas al DM permitidas por usuario por hora. Default: 20
DM_RATE_LIMIT_PER_HOUR=20
```

| Variable                               | Dónde obtenerla                                              |
| -------------------------------------- | ------------------------------------------------------------ |
| `OPENROUTER_API_KEY`                   | OpenRouter → Keys                                            |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase → Project Settings → API                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Supabase → Project Settings → API                            |
| `SUPABASE_SERVICE_ROLE_KEY`            | Supabase → Project Settings → API (nunca exponer al cliente) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`    | Cloudinary → Dashboard                                       |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary → Settings → Upload Presets                       |

---

## 1. Configurar Supabase

### 1.1 Crear el proyecto

1. Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto.
2. Anota la **URL**, **anon key** y **service role key** desde **Project Settings → API**.

### 1.2 Crear las tablas base

Ve a **SQL Editor** y ejecuta el siguiente bloque completo:

```sql
-- ── campaigns ────────────────────────────────────────────────
create table if not exists campaigns (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  name          text        not null,
  setting       text        not null,  -- fantasy | sci-fi | horror | cyberpunk | custom
  tone          text        not null,  -- epic | dark | comedic | gritty | whimsical
  system_prompt text,
  is_public     boolean     not null default false,
  invite_code   text        unique,
  started_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table campaigns enable row level security;

create policy "Owners can manage own campaigns"
  on campaigns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Authenticated users can read public campaigns"
  on campaigns for select to authenticated
  using (is_public = true);

create policy "Campaign participants can read campaigns"
  on campaigns for select to authenticated
  using (
    user_id = auth.uid()
    or is_public = true
    or id in (
      select cc.campaign_id from campaign_characters cc
      join characters ch on ch.id = cc.character_id
      where ch.user_id = auth.uid()
    )
  );

-- ── characters ───────────────────────────────────────────────
create table if not exists characters (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  class       text        not null,
  level       int         not null default 1,
  hp          int         not null,
  max_hp      int         not null,
  stats       jsonb       not null default '{
    "strength":10,"dexterity":10,"constitution":10,
    "intelligence":10,"wisdom":10,"charisma":10
  }'::jsonb,
  backstory   text,
  image_url   text,
  items       jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table characters enable row level security;

create policy "Users can manage own characters"
  on characters for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── campaign_characters ──────────────────────────────────────
create table if not exists campaign_characters (
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  character_id uuid not null references characters(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (campaign_id, character_id)
);

alter table campaign_characters enable row level security;

create policy "Campaign members can read party"
  on campaign_characters for select to authenticated
  using (
    campaign_id in (select id from campaigns where user_id = auth.uid())
    or character_id in (select id from characters where user_id = auth.uid())
  );

create policy "Campaign owners can manage party"
  on campaign_characters for all
  using (
    campaign_id in (select id from campaigns where user_id = auth.uid())
  );

-- ── campaign_messages ────────────────────────────────────────
create table if not exists campaign_messages (
  id           uuid        primary key default gen_random_uuid(),
  campaign_id  uuid        not null references campaigns(id) on delete cascade,
  character_id uuid        references characters(id) on delete set null,
  role         text        not null check (role in ('user', 'dm')),
  content      text        not null,
  turn_number  int         not null,
  created_at   timestamptz not null default now()
);

alter table campaign_messages enable row level security;

create policy "Campaign members can read messages"
  on campaign_messages for select to authenticated
  using (
    campaign_id in (select id from campaigns where user_id = auth.uid())
    or campaign_id in (
      select cc.campaign_id from campaign_characters cc
      join characters ch on ch.id = cc.character_id
      where ch.user_id = auth.uid()
    )
  );
```

### 1.3 Ejecutar las migraciones

Ejecuta cada archivo de `supabase/migrations/` en este orden desde el SQL Editor:

| Orden | Archivo                            | Qué agrega                                  |
| ----- | ---------------------------------- | ------------------------------------------- |
| 1     | `add_campaign_join_requests.sql`   | Tabla de solicitudes para unirse a campañas |
| 2     | `add_is_public_to_campaigns.sql`   | Columna `is_public` + política corregida    |
| 3     | `add_invite_code_to_campaigns.sql` | Código de sala de 6 caracteres              |
| 4     | `add_realtime_rls.sql`             | Políticas RLS para Realtime + publicación   |
| 5     | `add_image_url_to_characters.sql`  | Columna `image_url` en personajes           |
| 6     | `add_items_to_characters.sql`      | Inventario JSON en personajes               |
| 7     | `dm_rate_limits.sql`               | Tabla de rate limiting del DM               |

### 1.4 Activar Realtime

Ve a **Database → Replication** y asegúrate de que estas tablas estén en la publicación `supabase_realtime`:

- `campaign_messages`
- `campaign_characters`
- `campaigns`

> El script `add_realtime_rls.sql` ya lo hace automáticamente si lo ejecutaste.

### 1.5 Configurar perfiles de usuario (opcional pero recomendado)

Si quieres guardar el `username` de forma persistente en una tabla separada, puedes crear un trigger. Sin esto, el username se guarda en `user_metadata` de Supabase Auth, lo cual es suficiente para el funcionamiento básico.

---

## 2. Configurar OpenRouter

1. Crea una cuenta en [openrouter.ai](https://openrouter.ai).
2. Ve a **Keys → Create Key** y copia la clave.
3. Asegúrate de tener créditos; el modelo usado es **DeepSeek V3** (`deepseek/deepseek-chat-v3-5k`).
4. Pega la clave como `OPENROUTER_API_KEY` en `.env.local`.

El DM responde automáticamente en el idioma seleccionado por el jugador (ES / EN / PT).

---

## 3. Configurar Cloudinary (subida de imágenes)

Las imágenes de perfil de personajes se suben a Cloudinary.

1. Crea una cuenta en [cloudinary.com](https://cloudinary.com).
2. Desde el **Dashboard** anota tu **Cloud Name**.
3. Ve a **Settings → Upload → Upload Presets → Add upload preset**:
   - Signing mode: **Unsigned**
   - Anota el nombre del preset.
4. Completa en `.env.local`:
   ```env
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu-cloud-name
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=tu-preset
   ```

---

## 4. Configurar Google OAuth (opcional)

Permite a los usuarios iniciar sesión con su cuenta de Google.

### 4.1 Google Cloud Console

1. Ve a [console.cloud.google.com](https://console.cloud.google.com).
2. Crea un proyecto o selecciona uno existente.
3. Ve a **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
4. Tipo de aplicación: **Web application**.
5. En **Authorized redirect URIs** agrega:
   ```
   https://[tu-project-ref].supabase.co/auth/v1/callback
   ```
   (el `project-ref` está en la URL de tu proyecto Supabase)
6. Crea el cliente. Copia el **Client ID** (termina en `.apps.googleusercontent.com`) y el **Client Secret**.

### 4.2 Supabase Dashboard

1. Ve a **Authentication → Providers → Google**.
2. Activa el toggle.
3. Pega el **Client ID** en el campo "Client ID" (no en "Authorized Client IDs").
4. Pega el **Client Secret**.
5. Guarda.
6. Ve a **Authentication → URL Configuration → Redirect URLs** y agrega:
   ```
   http://localhost:3000/auth/callback
   ```
   Para producción agrega también:
   ```
   https://tu-dominio.com/auth/callback
   ```

> No requiere cambios en el código: `lib/auth.ts` ya tiene `signInWithGoogle()` y `app/auth/callback/route.ts` maneja el intercambio de tokens.

---

## 5. Rate Limiting del DM

Controla cuántas veces por hora un usuario puede invocar al DM para evitar abuso de la API.

- La tabla `dm_rate_limits` (creada en la migración) registra las llamadas por usuario/hora.
- El límite por defecto es **20 llamadas/hora**. Cámbialo con:
  ```env
  DM_RATE_LIMIT_PER_HOUR=30
  ```
- Si un usuario supera el límite, su mensaje se guarda pero el DM responde con un aviso indicando cuántos minutos faltan para el reset. No se consume API de OpenRouter.

---

## Estructura del proyecto

```
dm-ia/
├── app/
│   ├── api/                    # API Routes (Next.js)
│   │   ├── campaigns/          # CRUD + mensajes + lobby
│   │   ├── characters/         # CRUD de personajes
│   │   └── messages/           # Mensajes directos entre usuarios
│   ├── auth/
│   │   ├── login/
│   │   ├── signup/
│   │   └── callback/           # OAuth callback (Google)
│   ├── campaigns/
│   │   └── [id]/
│   │       ├── play/           # Sala de juego en tiempo real
│   │       └── lobby/          # Sala de espera
│   ├── characters/
│   ├── dashboard/
│   └── messages/               # Chat entre usuarios
├── components/                 # Componentes reutilizables
├── lib/
│   ├── auth.ts                 # Funciones de autenticación
│   ├── lang.ts                 # Store de idioma reactivo
│   ├── loader.ts               # Overlay de carga global
│   ├── openrouter.ts           # Cliente de la IA (DM)
│   ├── rate-limit.ts           # Rate limiting por usuario
│   ├── translations.ts         # Textos ES / EN / PT
│   └── supabase/               # Clientes Supabase (browser / server / admin)
├── supabase/
│   └── migrations/             # SQL a ejecutar en orden
├── types/                      # Tipos TypeScript del dominio
└── .env.example                # Plantilla de variables de entorno
```

---

## Scripts disponibles

```bash
npm run dev      # Servidor de desarrollo en http://localhost:3000
npm run build    # Build de producción
npm run start    # Servidor de producción (requiere build previo)
npm run lint     # Linter ESLint
```

---
