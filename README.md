# HegelFlow

HegelFlow es una aplicación personal para delegar, priorizar y seguir trabajo con Scrum y Kanban. El repositorio contiene una aplicación web funcional con autenticación propia, tableros, backlog, sprints, calendario, reportes, perfiles de trabajo y trazabilidad sobre PostgreSQL.

> Estado revisado el 25 de agosto de 2026. El código demuestra la aplicación y su preparación para Vercel + Neon; no demuestra por sí solo que exista un despliegue de producción activo.

## Qué funciona hoy

- Inicio y cierre de sesión, sesiones revocables y cambio de contraseña.
- Resumen ejecutivo de trabajo abierto, vencimientos, sprint y carga por persona.
- Tablero Kanban con drag-and-drop, vista de lista, filtros y límites WIP.
- Creación, edición y archivo de tareas con tipo, prioridad, fechas, story points, responsables, etiquetas y sprint.
- Backlog y gestión de sprints: crear, iniciar, completar y devolver pendientes al backlog.
- Calendario mensual de fechas de tareas y sprints.
- Reportes base de burndown, velocidad, distribución por estado/prioridad y tiempo de ciclo.
- Cronología de actividad, búsqueda global, perfiles de trabajo y capacidad.
- Roles `OWNER`, `ADMIN`, `MEMBER` y `VIEWER`, separados del cargo laboral.
- Tableros de workspace o privados, con ACL explícita por miembro de tablero.
- Esquema para comentarios, checklists, adjuntos, dependencias, campos personalizados, vistas, notificaciones, invitaciones y automatizaciones. Algunas de estas capacidades aún no tienen flujo completo de interfaz o ejecución; consulte [Alcance del producto](docs/product-scope.md).

## Stack

| Capa | Tecnología |
| --- | --- |
| Aplicación | Next.js 16 App Router, React 19 y TypeScript estricto |
| Interfaz | Tailwind CSS 4, Lucide, dnd-kit y Recharts |
| Servidor | Route Handlers de Next.js y servicios de dominio transaccionales |
| Datos | PostgreSQL, `postgres.js` y migraciones SQL versionadas |
| Validación y acceso | Zod 4, bcrypt y sesiones opacas almacenadas por hash |
| Calidad | ESLint, TypeScript, Vitest, cobertura V8, auditoría de secretos y `npm audit` |
| Despliegue objetivo | Vercel con PostgreSQL administrado en Neon |

## Documentación

- [Arquitectura actual](docs/architecture.md)
- [Modelo de seguridad](docs/security-model.md)
- [Benchmark de Trello y alternativas](docs/benchmark.md)
- [Alcance implementado y roadmap](docs/product-scope.md)

## Puesta en marcha local

### Requisitos

- Node.js 20.9 o posterior, requisito de [Next.js 16](https://nextjs.org/docs/app/getting-started/installation).
- npm y una base PostgreSQL accesible.
- Para PostgreSQL remoto, una conexión TLS; el cliente exige validación completa del certificado fuera de hosts locales exactos.

### 1. Instalar dependencias

```bash
npm ci
```

### 2. Configurar el entorno

Cree `.env.local`; los archivos `.env*` están excluidos de Git. Los siguientes valores son ficticios y deben reemplazarse:

```dotenv
DATABASE_URL='postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=verify-full'
APP_URL='http://localhost:3000'
BOOTSTRAP_ADMIN_USERNAME='admin-ejemplo'
BOOTSTRAP_ADMIN_PASSWORD='change-me-with-a-long-random-value'
```

Variables:

| Variable | Uso | ¿Necesaria en runtime? |
| --- | --- | --- |
| `DATABASE_URL` | Conexión PostgreSQL | Sí |
| `APP_URL` | Origen canónico adicional para validar mutaciones | Recomendada |
| `BOOTSTRAP_ADMIN_USERNAME` | Usuario creado o actualizado por el seed | No; solo durante el seed |
| `BOOTSTRAP_ADMIN_PASSWORD` | Contraseña inicial, con mínimo de 12 caracteres | No; solo durante el seed |

No use credenciales reales en archivos versionados, incidencias, capturas o logs. Para un entorno compartido use una contraseña aleatoria de al menos 14 caracteres y retire las variables `BOOTSTRAP_*` después del seed.

### 3. Migrar y cargar datos iniciales

Los scripts `tsx` reciben variables del proceso; si usa Bash puede exportar temporalmente el archivo local:

```bash
set -a
source .env.local
set +a
npm run db:setup
```

`db:migrate` toma un advisory lock de PostgreSQL, crea el registro `schema_migrations` y aplica cada archivo de `db/migrations/` una sola vez, en orden y dentro de una transacción. `db:seed` es repetible, crea el espacio inicial y perfiles de demostración, y vuelve a establecer la contraseña del administrador cada vez que se ejecuta. No lo ejecute rutinariamente contra producción.

Tras el primer seed, elimine `BOOTSTRAP_ADMIN_USERNAME` y `BOOTSTRAP_ADMIN_PASSWORD` de `.env.local` si ya no va a reutilizarlos. Mantenga `DATABASE_URL` y `APP_URL`.

### 4. Ejecutar

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Inicie sesión con las credenciales que usted definió al ejecutar el seed; el repositorio no contiene una contraseña predeterminada utilizable.

## Scripts

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm start` | Ejecutar el build |
| `npm run lint` | ESLint sin advertencias permitidas |
| `npm run typecheck` | Genera tipos de rutas Next.js y comprueba TypeScript sin emitir |
| `npm test` | Pruebas unitarias con Vitest |
| `npm run test:coverage` | Pruebas y reporte de cobertura |
| `npm run audit:secrets` | Busca patrones de secretos en archivos rastreados y no ignorados |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:seed` | Carga o actualiza el entorno inicial |
| `npm run db:setup` | Migra y luego ejecuta el seed |
| `npm run audit:db` | Migra la base indicada y ejecuta integración/aislamiento PostgreSQL |
| `npm run audit:all` | Secretos, lint, tipos, cobertura, build y vulnerabilidades altas |

`audit:secrets` es una defensa preventiva, no sustituye un escáner de secretos con historial Git ni la rotación inmediata de una credencial expuesta.

En la verificación local del 25 de agosto de 2026 pasaron 26 pruebas unitarias y 6 pruebas de integración PostgreSQL. También se validaron una migración limpia en PostgreSQL 18, la repetición de migración/seed, login y páginas autenticadas, mutaciones de tarea, conflicto optimista, comentarios, checklist, búsqueda, archivado y snapshots de transición. `audit:all` terminó con lint/tipos/build en verde y 0 vulnerabilidades de npm. La cobertura unitaria global sigue baja —20,19 % de sentencias—, por lo que ampliar casos de dominio y automatizar el E2E HTTP completo continúa en el roadmap.

## Despliegue en Vercel + Neon

1. Cree un proyecto y una base en Neon. Copie su cadena de conexión desde el panel; la guía oficial explica la [conexión manual entre Neon y Vercel](https://neon.com/docs/guides/vercel-manual).
2. Conecte el repositorio a un proyecto de Vercel. Next.js no requiere `vercel.json` para el caso actual.
3. En **Project Settings → Environment Variables**, configure `DATABASE_URL` y `APP_URL` para cada ambiente. Vercel documenta la [separación entre Development, Preview y Production](https://vercel.com/docs/environment-variables).
4. Use una rama/base Neon separada para Preview; no conecte despliegues no confiables a datos de producción.
5. Desde una estación o job confiable, inyecte los secretos sin imprimirlos y ejecute `DATABASE_URL="$DATABASE_URL_UNPOOLED" npm run db:migrate` contra la base exacta que recibirá el despliegue. Las migraciones usan un bloqueo de sesión y rechazan la URL agrupada de Neon.
6. Solo en el primer aprovisionamiento, ejecute `npm run db:seed` con variables `BOOTSTRAP_*` temporales. Retírelas inmediatamente después.
7. Ejecute `npm run audit:all`, despliegue una Preview, haga smoke tests de login, permisos, movimientos y sprints, y después promueva a Production.

Cambiar una variable en Vercel solo afecta despliegues nuevos; vuelva a desplegar para aplicarla. El runtime usa Node.js y una conexión por instancia (`max: 1`); para carga serverless prefiera el hostname *pooled* que Neon ofrece y supervise el número de conexiones.

## Límites conocidos antes de producción

- No hay aprovisionamiento completo de cuentas: crear un perfil operativo no crea automáticamente un usuario con login.
- Los tableros `PRIVATE` se filtran por rol/ACL en las vistas principales, pero todavía no hay interfaz para administrar `board_members` ni pruebas negativas automatizadas de todos los read paths.
- No existe Row-Level Security en PostgreSQL; el aislamiento de lectura depende de la aplicación, complementado por triggers que rechazan asociaciones cruzadas entre workspaces.
- Automatizaciones, invitaciones, notificaciones y adjuntos están modelados, pero no tienen ejecución o flujo completo.
- Hay controles unitarios e integración PostgreSQL automatizada; aún falta automatizar el E2E HTTP/navegador completo y ampliar la matriz negativa de autorización.
- Los reportes son una primera versión; las fórmulas de compromiso, cambios de alcance y métricas históricas requieren validación con datos reales.
- No hay recuperación de contraseña, MFA, SSO, política de backups verificada desde el repositorio ni telemetría operativa configurada.

El detalle y la secuencia de trabajo están en [docs/product-scope.md](docs/product-scope.md).
