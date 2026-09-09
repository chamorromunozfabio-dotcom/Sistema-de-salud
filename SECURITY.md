# 🔒 Guía de Seguridad – SaludPública Connect

## 1. SQL Injection – Mitigado ✅
- **ORM Prisma** usa consultas parametrizadas; **no se usa `$queryRaw`/`$executeRaw`/`$queryRawUnsafe`** en ningún servicio (`backend/src/**/*.ts`).
- Todos los `where` usan tipado Prisma (`findUnique`, `findMany`, `updateMany`) sin concatenación de strings.
- `ValidationPipe` con `whitelist:true, forbidNonWhitelisted:true` rechaza campos no declarados en DTOs, evitando `{"email": {"$gt":""}}` style injection.
- Verificación: `grep -R "\$queryRaw" backend/src` → 0 resultados.

## 2. JS / XSS Injection – Mitigado ✅
### Backend
- `helmet` headers (`main.ts:10`) + `hpp` anti-parameter pollution.
- `SanitizePipe` global (`common/pipes/sanitize.pipe.ts:8`) que aplica `xss.filterXSS` con whitelist vacía a todo body/query.
- DTOs con `@Transform(sanitizeString)` en campos sensibles: `RegisterDto`, `LoginDto`, `CreateAppointmentDto.patientName/notes`, `TriageDto.symptoms`, `CreateDoctorDto.name/hospital` (`backend/src/**/dto/*.ts`).
- `MaxLength` en todos los strings (evita payloads gigantes).
- Nunca se usa `eval`, `Function`, `innerHTML` en backend ni `dangerouslySetInnerHTML` en frontend.

### Frontend
- React escapa automáticamente `{value}` (no se usa `dangerouslySetInnerHTML` en todo `frontend/`).
- `frontend/utils/sanitize.ts` + `frontend/services/*` sanitizan antes de enviar al backend (`sanitizeObject`).
- Validación de `token` público con regex `/^[a-f0-9]{64}$/i` antes de fetch (`AppointmentPublicView.tsx:33`).
- CSP via `helmet.contentSecurityPolicy:false` permitido solo para Swagger; frontend no carga scripts externos con `importmap` controlado (`index.html:14`).

## 3. Almacenamiento – SIN localStorage / sessionStorage / cookies ✅
- **Antes**: `localStorage.getItem('token')` en `authService.ts`, `doctorService.ts`, etc.
- **Ahora**: `frontend/services/tokenService.ts:9` – token vive solo en **variable de cierre en memoria RAM** (`let _token: string|null`). No se persiste.
  - `setToken` / `getToken` / `removeToken` operan sobre memoria.
  - `AuthContext.tsx:21` explica: al recargar (F5) el token se pierde y el usuario debe re-loguearse. Esto es intencional por requisito.
  - Se eliminó todo `localStorage/sessionStorage/document.cookie` del código fuente (verificado con `grep`).
  - No se usa `cookie-parser` ni cookies httpOnly en backend (requisito “sin cookies”).

## 4. Autenticación por Tokens JWT ✅
- **Emisión**: `backend/src/auth/auth.service.ts:159` `jwtService.sign(payload)` con `sub`, `email`, `role`.
- **Almacenamiento**: Solo en memoria frontend (ver §3), transmitido vía `Authorization: Bearer <token>`.
- **Expiración corta**: `JWT_EXPIRES_IN=15m` (`backend/.env:14`), `REFRESH_TOKEN_EXPIRES_IN=7d` configurable. En `auth.module.ts:16` `expiresIn` tomado de `ConfigService`.
- **Validación**: `JwtStrategy` (`auth/strategies/jwt.strategy.ts:9`) verifica `secret` y `isActive`. `JwtAuthGuard` + `RolesGuard` protegen rutas (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(USER_ADMIN)`).
- **Brute-force**: `ThrottlerModule` global 60 req/min + `auth` 5-10 req/min en `POST /auth/login|register` (`auth.controller.ts:15`). `app.module.ts:15` registra `ThrottlerGuard`.
- **Hash**: `bcrypt` saltRounds 10 (`auth.service.ts:148`). Sin logs de password.

## 5. .env y Secretos – NO subir a Git ✅
- `.env` removido del índice: `git rm --cached backend/.env frontend/.env` (ahora untracked).
- `.gitignore` raíz y por carpeta (`/.gitignore:1`, `backend/.gitignore:1`, `frontend/.gitignore:1`) excluye `.env`, `.env.local`, `node_modules/`, `dist/`.
- Proveídos solo ejemplos sin secretos: `backend/.env.example:1`, `frontend/.env.example:1`.
- **Si el histórico ya contenía `.env`**: debes rotar secretos antes de push:
  ```bash
  # 1. Generar nuevo JWT
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  # Pegar en backend/.env como JWT_SECRET (>=32 chars)
  # 2. Cambiar DATABASE_URL password, EMAIL_PASS, GEMINI_API_KEY

  # 3. Purgar histórico (opción A: repo NUEVO limpio recomendado)
  # Copia solo archivos fuente a carpeta nueva y git init
  mkdir salud-clean && cd salud-clean
  # copiar backend/src, prisma, frontend/src, etc. sin node_modules/dist/.env
  git init && git add . && git commit -m "initial clean"
  git remote add origin <NUEVO_REPO_URL>
  git push -u origin main

  # Opción B: filtrar histórico existente (requiere git-filter-repo)
  pip install git-filter-repo
  git filter-repo --invert-paths --path backend/.env --path frontend/.env --path backend/node_modules --path frontend/node_modules
  git remote add origin <NUEVO_REPO_URL> # si aún no existe
  git push --force
  ```
- Verificar que no queden secretos trackeados: `git ls-files | grep -E "\.env"` debe salir vacío.

## 6. Checklist antes de `git push` a nuevo repositorio
- [ ] `git status` no muestra `.env`, `node_modules`, `dist`
- [ ] `git ls-files | grep node_modules` vacío
- [ ] `backend/.env.example` y `frontend/.env.example` presentes, sin valores reales
- [ ] `npm run build` en backend y frontend OK
- [ ] Probar flujo sin localStorage: login → navegar → F5 → debe pedir login (esperado)
- [ ] Revisar Swagger `http://localhost:3001/api` con Bearer token funciona
