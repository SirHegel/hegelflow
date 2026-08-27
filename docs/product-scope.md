# Alcance de producto de HegelFlow

> Fecha de corte: 27 de agosto de 2026. Este documento distingue lo usable en la interfaz, lo disponible solo por API/dominio, lo que existe únicamente en PostgreSQL y lo que sigue en roadmap.

## Objetivo

HegelFlow es un sistema personal para planificar, delegar, ejecutar y auditar trabajo con Scrum y Kanban en un mismo espacio. Debe responder con datos verificables:

- qué trabajo existe, su prioridad y su propósito;
- quién es responsable y cuál es su capacidad;
- qué está vencido, bloqueado, en curso o completado;
- qué se comprometió y terminó en cada sprint;
- cuánto tarda el trabajo en recorrer el flujo;
- quién realizó cada cambio relevante.

La experiencia diaria busca la sencillez visual de Trello, acompañada por reglas de flujo, permisos y métricas propias de herramientas ágiles más estructuradas. Las referencias comparadas están en [benchmark.md](benchmark.md).

## Cómo se clasifica una función

| Estado | Significado |
| --- | --- |
| **Usable** | Tiene interfaz, lectura/escritura real y controles principales de servidor |
| **Backend** | Tiene API o servicio de dominio, pero el flujo de interfaz está ausente o incompleto |
| **Modelo** | La tabla o columna existe; no hay una función operativa completa |
| **Roadmap** | Requiere diseño e implementación nueva |

Una tabla por sí sola no convierte una capacidad en producto terminado. Para considerarla lista para producción también necesita autorización negativa, pruebas de integración, estados de error/recuperación y validación en el ambiente desplegado.

## Estado actual

### Experiencia usable

| Área | Capacidad disponible | Alcance actual |
| --- | --- | --- |
| Acceso | Login, logout, consulta de sesión y cambio de contraseña | Sesión opaca de 12 horas, revocación y rate limit de login |
| Resumen | Indicadores, sprint activo, carga, tableros y vencimientos | Agregados del workspace activo |
| Kanban | Tablero con drag-and-drop y vista de lista | Filtros por texto, prioridad y responsable; WIP cliente/servidor |
| Tareas | Crear, editar, mover y archivar | Tipo, prioridad, descripción, story points, fechas, responsables, etiquetas y sprint |
| Backlog | Trabajo sin sprint y asignación a sprint | Opera sobre el primer tablero activo |
| Scrum | Crear, iniciar y completar sprints | Un sprint activo por tablero y uno general por workspace; pendientes vuelven al backlog desde la UI actual |
| Calendario | Mes con inicios, vencimientos y fechas de sprint | Navegación mensual y resumen de vencidas |
| Reportes | Estado, prioridad, velocidad, cycle time y burndown | Primera versión; requiere validar fórmulas históricas |
| Actividad | Cronología de cambios de negocio | Hasta 100 eventos recientes en la vista |
| Búsqueda | Título, descripción y clave de tarea | Resultados del workspace, máximo 12 |
| Equipo | Ver personas, roles, capacidad y carga; crear perfil o cuenta | `OWNER` crea cuenta+perfil o habilita un perfil existente; `ADMIN` solo crea perfiles operativos |
| Configuración | Ver reglas, campos y vistas; activar/pausar reglas; cambiar contraseña | Guardado de workspace y creación de reglas/campos aún no están conectados |
| Administración y auditoría | Métricas de cuentas, políticas efectivas y últimos eventos de seguridad | Enlace, página y consulta exclusivos de `OWNER`; sin credenciales, IP ni metadata interna |

### Backend disponible sin flujo completo

- Crear tableros por API y crear columnas desde el servicio de dominio; falta la interfaz administrativa completa.
- Actualizar perfiles por API con protección contra escalamiento y contra eliminar al último propietario; el botón de edición no abre todavía un formulario funcional.
- Crear comentarios y checklists, agregar/actualizar elementos y editar/eliminar lógicamente comentarios desde el dominio. El editor de tarea solo presenta contadores y no ofrece la conversación/checklist completa.
- Filtrar tableros `PRIVATE` con `board_members`: `OWNER`/`ADMIN` ven el workspace completo; los demás necesitan ser creadores o miembros del tablero. La suite PostgreSQL cubre lecturas/agregados críticos y escritura denegada; falta la interfaz/API para administrar la ACL y una matriz E2E exhaustiva por ruta.
- Campos `parentTaskId` y `estimateMinutes` están soportados por modelo/servicio de tareas, pero el formulario y la ruta de actualización no exponen hoy el ciclo completo.
- La automatización de ejemplo puede activarse o pausarse, pero no se ejecuta.

### Capacidad únicamente modelada o parcial

- adjuntos y metadatos de archivo;
- dependencias entre tareas;
- valores de campos personalizados;
- vistas guardadas y compartidas;
- notificaciones;
- invitaciones con token hash y expiración;
- reglas de automatización, contadores y última ejecución;
- exportación e integraciones.

La ACL privada ya existe en las vistas principales y el dominio. Las pruebas de integración cubren tableros, reportes de sprint, actividad y configuración, y el smoke HTTP cubre búsqueda; sigue siendo un control de aplicación sin RLS y requiere una matriz E2E exhaustiva antes de considerarse una frontera plenamente auditada.

## Base técnica implementada

- Next.js 16, React 19, TypeScript estricto y Tailwind CSS 4.
- PostgreSQL con cliente serverless, TLS remoto y una conexión por instancia.
- Migración versionada con identidad, sesiones, workspaces, RBAC, trabajo ágil y trazabilidad.
- Seed repetible que obtiene usuario y contraseña inicial exclusivamente del entorno y guarda bcrypt.
- Roles `OWNER`, `ADMIN`, `MEMBER` y `VIEWER`, separados del cargo laboral.
- Validación Zod estricta y errores de dominio con códigos estables.
- Transacciones, bloqueos de filas, límite WIP y versión optimista para tareas.
- Activity log transaccional y eventos append-only de movimiento, cambio de sprint y cambio de estimación.
- Auditoría de seguridad separada y protegida contra actualización o borrado.
- Alta multiusuario transaccional y consola de auditoría con doble comprobación `OWNER`.
- ACL de tablero privado y triggers que rechazan relaciones cruzadas entre workspaces.
- CSP y cabeceras defensivas globales.
- Pruebas unitarias de seguridad HTTP, RBAC, validadores y utilidades.
- Pruebas de integración PostgreSQL para aislamiento, ACL, atomicidad, WIP/versiones y trazabilidad.
- Gate agregado de secretos, lint, tipos, cobertura, build y dependencias.
- Workflow de GitHub Actions para pull requests y `main`, más Dependabot semanal.

## Roles y perfiles

El cargo de una persona no debe codificarse como permiso. “CEO”, “Desarrollador”, “Product Owner” o “Scrum Master” son perfiles laborales configurables; `access_level` decide qué puede hacer la cuenta.

| Nivel actual | Uso esperado | Acceso efectivo principal |
| --- | --- | --- |
| `OWNER` | Propietario y gobierno | Todo el vocabulario de permisos; gobierno de roles y acciones administrativas disponibles |
| `ADMIN` | Administración operativa | Tableros, sprints, perfiles no administrativos, automatizaciones y archivo de tareas |
| `MEMBER` | Ejecución | Crear/editar/mover/asignar tareas, comentar y usar checklists |
| `VIEWER` | Seguimiento | Lectura de workspace, equipo, trabajo, sprints y reportes |

Los permisos declarados que aún no tienen endpoint —por ejemplo exportar datos, eliminar workspace o gestionar integraciones— no se consideran funciones implementadas.

## Alcance del MVP operativo

La base actual es una **alpha interna funcional**. Para considerarla MVP operativo en un equipo real debe completar, como mínimo:

### Acceso y delegación

- invitación de un solo uso o rotación inicial obligatoria sobre las cuentas que hoy aprovisiona `OWNER`;
- edición de nombre, cargo, capacidad, estado y nivel según jerarquía;
- recuperación de contraseña y revocación administrativa de sesiones;
- selección de workspace cuando un usuario pertenece a más de uno.

### Trabajo diario

- creación y configuración de tableros/columnas desde UI;
- conversación, checklist y dependencias dentro del editor de tarea;
- etiquetas y campos personalizados administrables;
- filtros persistentes y vista “Mi trabajo”;
- navegación explícita entre tableros en backlog, calendario y sprints.

### Seguridad y operación

- administración de miembros de tablero privado y ampliación E2E de todos sus read paths;
- ampliar la integración multi-tenant/RBAC contra PostgreSQL a cada rol y mutación;
- pruebas E2E de login, tareas, WIP, sprints y cambio de contraseña;
- base separada para Preview/Production, migraciones controladas y smoke tests;
- backups/PITR con restauración ensayada, logs, alertas y runbook de incidentes;
- política de retención para sesiones, intentos, actividad, transiciones y auditoría.

### Datos confiables

- contrastar el compromiso/velocidad basado en el primer evento de entrada de cada tarea al sprint;
- reconstruir burndown y cambios de alcance usando también `SPRINT_CHANGED` y `ESTIMATE_CHANGED`, no solo la membresía actual del sprint;
- casos de prueba conocidos para cycle time, reaperturas y tareas sin puntos;
- drill-down desde cada métrica hasta sus tareas fuente.

## Roadmap recomendado

### Fase 0 — Endurecimiento de la alpha

**Resultado:** el sistema puede probarse con datos no críticos sin brechas conocidas de aislamiento.

- Completar administración y matriz E2E de la ACL `PRIVATE` en todas las rutas.
- Ampliar la integración PostgreSQL y automatizar E2E de autorización.
- Completar edición de perfiles y gestión administrativa del ciclo de vida de las cuentas.
- Conectar los botones actualmente informativos de workspace, tableros y configuración.
- Validar migración y seed en bases vacías y ya migradas.
- Establecer Vercel Preview + Neon branch sin compartir producción.

### Fase 1 — MVP operativo de equipo

**Resultado:** dirección y desarrollo pueden delegar, ejecutar y revisar trabajo diariamente.

- CRUD de tableros, columnas, etiquetas y perfiles desde UI.
- Comentarios y checklists completos en la tarea.
- Invitaciones, recuperación de contraseña y gestión de sesiones.
- “Mi trabajo”, filtros guardados y navegación multitablero.
- Exportación CSV básica y exportación controlada de auditoría para `OWNER`.
- Reportes Scrum/Kanban corregidos y respaldados por pruebas históricas.

### Fase 2 — Flujo avanzado

**Resultado:** HegelFlow sustituye procesos manuales recurrentes.

- Campos personalizados y formularios.
- Dependencias, bloqueo con razón, subtareas y jerarquía epic/story.
- Adjuntos en object storage privado con escaneo y URLs firmadas.
- Motor de automatización trigger/condition/action con cola, idempotencia, reintentos y logs.
- Notificaciones in-app y correo con preferencias.
- Cumulative flow, burnup, lead time, throughput y workload histórico.
- Timeline, workload y políticas explícitas por columna.

### Fase 3 — Integraciones y portafolio

**Resultado:** producto, código, objetivos y operación comparten contexto.

- GitHub/GitLab para ramas, commits, pull requests y despliegues.
- Calendarios, correo y mensajería.
- Webhooks, API pública con scopes y rotación de tokens.
- Roadmaps, objetivos/OKR, portafolios y dashboards programados.
- Plantillas de proyecto, importación y exportación completa.

### Fase 4 — Gobierno avanzado

**Resultado:** el sistema puede crecer a múltiples equipos y terceros.

- SSO/OIDC o SAML, MFA obligatoria y SCIM.
- Roles personalizados, guests y permisos por proyecto/ítem.
- RLS, políticas de retención, legal hold y auditoría exportable.
- IP allowlist, gestión de dispositivos/sesiones y controles de residencia.
- Objetivos de recuperación, pruebas periódicas de restore y continuidad.

## Fuera del MVP

- IA generativa y agentes automáticos;
- aplicación móvil nativa;
- tableros públicos en Internet;
- facturación o planes comerciales;
- portafolio multiequipo avanzado;
- SSO/SCIM y permisos por campo.

Estas funciones no deben retrasar aislamiento, autenticación, autorización, recuperación, trazabilidad ni el flujo diario.

## Política de “ilimitado”

En HegelFlow, “ilimitado” significa que el producto interno no impone cuotas comerciales artificiales a usuarios, tableros, tareas, sprints, campos, vistas o automatizaciones según un plan de pago. No significa capacidad física infinita ni ausencia de controles.

Se conservan guardas técnicas y metodológicas:

- paginación y tamaño máximo de respuesta;
- límite de cuerpos JSON y de archivos futuros;
- rate limit en operaciones sensibles;
- timeouts y presupuesto de ejecución;
- límites WIP configurables;
- colas, reintentos e idempotencia para trabajo asíncrono;
- índices, archivado y agregados para consultas de gran volumen;
- límites de conexiones y concurrencia;
- alertas de almacenamiento, latencia y errores;
- políticas de retención y recuperación.

Una guarda debe tener motivo técnico, error accionable y observabilidad. Nunca debe borrar datos silenciosamente ni venderse como una limitación de plan.

## Decisiones de producto

### Scrum y Kanban conviven

- El tablero representa el flujo continuo y aplica WIP.
- El backlog y los sprints representan compromiso temporal, objetivo y capacidad.
- Una tarea puede vivir sin sprint; moverla por columnas no debe asignarla implícitamente a uno.
- Cerrar un sprint exige decidir el destino de pendientes y registrar el cambio.

### Historial antes que métricas decorativas

- Cada movimiento, entrada/salida de sprint, completado, reapertura y archivo conserva actor e instante.
- Cambios de alcance y estimación deben quedar en eventos antes de ofrecer métricas contractuales.
- Todo reporte debe explicar definición, zona horaria, ventana y tareas fuente.

### Seguridad en servidor

- Ocultar un botón no concede ni revoca acceso.
- Cada lectura y mutación debe aplicar workspace, membresía y permiso en servidor.
- Los secretos viven fuera de Git y los datos sensibles no aparecen en logs.
- Un perfil operativo no equivale a una cuenta autenticable; `OWNER` decide si crea o vincula sus credenciales.

### Archivado antes que borrado

- Las tareas se archivan para conservar contexto y reportes.
- El borrado definitivo exige política, autorización y auditoría explícitas.
- Adjuntos futuros requieren almacenamiento y ciclo de retención separado.

## Criterios de calidad por fase

Una capacidad solo avanza a “terminada” cuando:

1. tiene autorización positiva y negativa en servidor;
2. respeta workspace y visibilidad en lecturas y escrituras;
3. tiene pruebas de reglas, errores y concurrencia relevantes;
4. resuelve UI vacía, carga, error y recuperación;
5. registra las acciones sensibles y no filtra secretos;
6. su migración es repetible en una base vacía;
7. lint, typecheck, tests, build y auditorías pasan;
8. se verificó en Preview con una base aislada;
9. cuenta con rollback o ruta de recuperación proporcional al riesgo.

Consulte [architecture.md](architecture.md) para el diseño actual y [security-model.md](security-model.md) para controles, brechas y checklist de producción.
