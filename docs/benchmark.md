# Benchmark de producto: Scrum, Kanban y gestión de trabajo

> Fecha de corte: 25 de agosto de 2026. Precios de lista consultados en las páginas oficiales, antes de impuestos y normalmente con facturación anual. Pueden variar por país, cantidad de usuarios, moneda, modalidad de cobro y promociones.

## Resumen ejecutivo

HegelFlow no debe ser una copia literal de Trello. La referencia de producto elegida combina:

- la sencillez visual y el drag-and-drop de Trello;
- el motor Scrum/Kanban, los workflows y las métricas de Jira;
- la experiencia de desarrollo y la integración con Git de Linear;
- la gestión de carga, portafolios y objetivos de Asana y ClickUp;
- los campos, formularios y permisos configurables de monday.com;
- la documentación vinculada al trabajo de Notion.

Trello es una referencia sólida de UX, pero no cubre por sí solo el producto objetivo. Su documentación confirma que no tiene [dependencias de tareas nativas](https://support.atlassian.com/trello/docs/creating-and-managing-task-dependencies/) y que su [Dashboard Premium](https://support.atlassian.com/trello/docs/dashboard-view/) está orientado a conteos simples en barras y pasteles; no sustituye reportes ágiles como burndown, velocity, cumulative flow, lead time o cycle time.

## Trello: planes y capacidades

| Plan | Precio de lista | Capacidades principales | Gobierno, vistas y reportes | Límites vigentes relevantes |
| --- | ---: | --- | --- | --- |
| Free | USD 0 | Tarjetas y Power-Ups ilimitados, Inbox, responsables, fechas, actividad y 2FA | Tablero Kanban básico. Todos los miembros del Workspace son administradores | 10 tableros abiertos, 10 colaboradores, 10 MB por archivo, 250 ejecuciones y 2.500 operaciones de automatización al mes |
| Standard | USD 5 por usuario/mes anual; USD 6 mensual | Tableros y colaboradores ilimitados, campos personalizados, checklists avanzados, card mirroring, colores y colapsado de listas, Planner y búsquedas guardadas | Mejora la estructura del tablero, pero no incluye el gobierno ni las vistas de Premium | 250 MB por archivo, 1.000 ejecuciones y 20.000 operaciones de automatización al mes |
| Premium | USD 10 por usuario/mes anual; USD 12,50 mensual | Todo Standard, plantillas de Workspace, colecciones, observadores, exportación CSV, AI y soporte prioritario | Calendar, Timeline, Table, Dashboard y Map; vistas Table y Calendar entre tableros; administrador/miembro/observador y restricciones de dominio e invitados | Ejecuciones de automatización anunciadas como ilimitadas, pero 150.000 operaciones más 10.000 por usuario, con máximo de 250.000 por Workspace |
| Enterprise | USD 17,50 por usuario/mes anual | Todo Premium, Workspaces ilimitados, tableros visibles para la organización, invitados multitablero y administración de adjuntos, Power-Ups y tableros públicos | Administración central, permisos corporativos, SSO y aprovisionamiento con Atlassian Guard | Conserva guardas de plataforma; la cuota documentada de operaciones de automatización llega a un máximo de 250.000 por Workspace |

Fuentes oficiales: [precios y comparación de Trello](https://trello.com/pricing), [cuotas de Automation](https://support.atlassian.com/trello/docs/butler-quotas-and-limits/), [roles y permisos Premium](https://support.atlassian.com/trello/docs/setting-up-your-premium-workspace/) y [administración Enterprise](https://support.atlassian.com/trello/docs/enterprise-admin-dashboard/).

### Lecciones específicas de Trello

- El plan Free no ofrece separación administrativa suficiente para una empresa: todos los miembros del Workspace son administradores.
- Los campos, checklists y tableros cubren Kanban liviano, pero Scrum se representa mediante convenciones, listas, plantillas y automatizaciones; no existe un objeto Sprint con analítica equivalente a Jira.
- “Ejecuciones ilimitadas” no significa capacidad informática sin límites: Trello conserva cuotas de operaciones, correo, acciones por ejecución y rate limits.
- Los observadores y los permisos de dominio son referencias útiles para el futuro acceso de clientes y proveedores.

## Comparación de alternativas

| Sistema | Planes y precio de lista | Scrum, Kanban y workflows | Roles y permisos | Vistas, reporting y automatización | Límite o aprendizaje para HegelFlow |
| --- | --- | --- | --- | --- | --- |
| [Jira](https://www.atlassian.com/software/jira/jira/pricing) | Free; Standard USD 7,91; Premium USD 14,54 por usuario/mes; Enterprise a medida | Scrum y Kanban nativos, backlog, sprints, objetivos, epics, dependencias, WIP y workflows con estados, transiciones, validaciones y aprobaciones | Free no incluye esquemas de permisos. Standard agrega roles, permisos y seguridad por ítem; Enterprise agrega gobierno e IAM | Board, backlog, list, timeline, calendar y dashboards; sprint report, burndown/burnup, velocity, cumulative flow y control chart. Automatización: 100 Free, 1.700 Standard, 1.000 por usuario Premium e ilimitada Enterprise | Es la referencia funcional para el núcleo ágil y la analítica. Free está limitado a 10 usuarios y 2 GB. Fuentes: [reportes](https://www.atlassian.com/software/jira/features/reports) y [permisos](https://support.atlassian.com/jira-cloud-administration/docs/types-of-permissions-in-jira/) |
| [Asana](https://asana.com/pricing) | Personal USD 0; Starter USD 10,99; Advanced USD 24,99 por usuario/mes anual; Enterprise a medida | Kanban y flujos configurables, dependencias, hitos, formularios, reglas y aprobaciones. Scrum se configura, pero es menos nativo que en Jira | Personal admite 2 usuarios; Starter agrega invitados; Enterprise agrega SAML, SCIM, licencias de solo lectura y controles administrativos | List, Board y Calendar; Starter agrega Timeline/Gantt y dashboards; Advanced agrega portfolios, goals, workload, time tracking, critical path y fórmulas; reglas ilimitadas desde Starter | Referencia para delegación, objetivos y capacidad, no para analítica Scrum profunda |
| [ClickUp](https://clickup.com/pricing) | Free; Unlimited USD 7; Business USD 12 por usuario/mes anual; Enterprise a medida | Jerarquía Workspace/Space/Folder/List/task, Kanban, sprints, story points, dependencias y estados configurables | Owner, admin, member, limited member y guests. Los [roles personalizados](https://help.clickup.com/hc/en-us/articles/6309195687959-Manage-Custom-Role-permissions) requieren Business Plus o Enterprise | List, Board, Calendar, Gantt, Timeline, Workload, dashboards, docs y whiteboards. Business incluye reportes de sprint, cumulative flow, cycle time y lead time | Automatización: 100 acciones Free, 1.000 Unlimited, 5.000 Business y 250.000 Enterprise. Fuente: [cuotas oficiales](https://help.clickup.com/hc/en-us/articles/23477062949911-Automations-feature-availability-and-limits). Es el patrón “todo en uno”, con riesgo de sobrecargar la interfaz |
| [Linear](https://linear.app/pricing) | Free; Basic USD 10; Business USD 16 por usuario/mes anual; Enterprise a medida | Issues, backlog, workflows por equipo, cycles de 1 a 8 semanas, projects, initiatives, triage y SLA | En Free todos son administradores. Basic agrega roles administrativos; Business equipos privados y guests; Enterprise SAML, SCIM y controles granulares | Board/list, vistas personalizadas, timeline de proyectos y gráficos de ciclo; Insights en Business. [GitHub](https://linear.app/docs/github-integration) actualiza trabajo desde branches, commits y pull requests | Free permite miembros ilimitados, pero solo 2 equipos y 250 issues. Es la referencia de velocidad de uso e integración con código |
| [monday.com / monday dev](https://monday.com/pricing) | Free; Basic desde USD 9; Standard desde USD 12; Pro desde USD 19 por asiento/mes anual; Enterprise a medida | Workflows configurables; monday dev agrega sprints, story points, roadmap y jerarquía epic/task/subtask | Main, private y shareable boards. Enterprise agrega Owner, Editor, Contributor, Assigned contributor y Viewer, más permisos por columna, board, Workspace y cuenta | Kanban, Table, Gantt, Timeline, Calendar, Workload, Chart, Map, Form y Pivot. monday dev Pro incorpora reporting ágil y roadmap entre equipos | Free: 2 asientos, 3 tableros y sin automatizaciones. Standard: 250 acciones; Pro: 25.000; Enterprise: 250.000. Fuentes: [cuotas](https://support.monday.com/hc/en-us/articles/360002826680-Automations-and-integrations-pricing) y [permisos](https://support.monday.com/hc/en-us/articles/360019222479-Permissions-on-monday-com) |
| [Notion](https://www.notion.com/pricing) | Free; Plus USD 10; Business USD 20 por usuario/mes; Enterprise a medida | Base de datos de tareas con estado, responsable y fecha; backlog, sprint actual, planificación, ciclos automáticos, subtareas y dependencias | Member, restricted member, guest y owner. Business agrega permisos granulares de base de datos, teamspaces privados y SSO; Enterprise SCIM y audit log | Table, Board, List, Timeline, Calendar, Gallery, charts y dashboards; botones en Free y automatizaciones de bases de datos en Plus | No sustituye reporting ágil, WIP ni cycle time de Jira. Es la referencia para wiki y contexto. Fuentes: [sprints](https://www.notion.com/help/sprints) y [roles](https://www.notion.com/help/whos-who-in-a-workspace) |

## Decisiones de diseño derivadas del benchmark

1. **Board-first, no board-only.** El tablero es la entrada principal, pero todos los ítems viven en un modelo único que también alimenta backlog, lista, calendario, timeline, workload y reportes.
2. **Scrum y Kanban son capacidades nativas.** Los sprints, objetivos, story points, rollover, WIP, bloqueos y métricas no se simulan con etiquetas o nombres de listas.
3. **Rol laboral y permiso son conceptos distintos.** “CEO”, “Desarrollador” o “Product Owner” describen el perfil de trabajo; `OWNER`, `ADMIN`, `MEMBER` y `VIEWER` gobiernan acceso. Una persona puede reunir varios perfiles metodológicos sin recibir permisos innecesarios.
4. **Historial antes que dashboards.** Las transiciones deben registrarse desde el inicio. Sin eventos históricos no es posible calcular de forma fiable burndown, cambios de alcance, lead time, cycle time ni auditorías.
5. **Configuración gradual.** El flujo por defecto debe funcionar sin configuración, mientras que campos, estados, reglas y permisos avanzados se habilitan progresivamente para evitar la complejidad de ClickUp o Jira en el primer uso.
6. **Integración con desarrollo.** Branches, commits, pull requests y despliegues deben poder vincularse a una tarea y actualizar su estado mediante reglas auditables.
7. **Sin límites comerciales artificiales.** HegelFlow no bloqueará por plan la cantidad de usuarios, tableros, tareas, vistas o sprints del espacio interno. Sí aplicará guardas técnicas configurables para asegurar disponibilidad y seguridad.
8. **AI no es una dependencia del núcleo.** Resúmenes, clasificación y sugerencias pueden añadirse después; el flujo, los permisos y los reportes deben seguir funcionando sin AI.

## Funciones que se deben copiar y funciones que se deben evitar

### Adoptar

- creación y movimiento de tarjetas con muy baja fricción;
- backlog priorizado, sprint goal, capacidad y WIP visibles;
- jerarquía epic/story/task/bug y relaciones de bloqueo;
- vistas guardadas y “Mi trabajo”;
- automatizaciones legibles como trigger/condition/action;
- reportes ágiles con acceso al detalle que origina cada métrica;
- observadores, invitados y permisos por alcance;
- exportación completa y audit log.

### Evitar

- hacer administrador a todo usuario de un espacio gratuito;
- usar columnas como única fuente del estado histórico;
- anunciar “ilimitado” como ausencia de protecciones operativas;
- ocultar funciones básicas de seguridad detrás de una futura edición de pago;
- dashboards que solo muestran conteos sin permitir investigar tareas;
- permisos ligados a nombres concretos de personas;
- incorporar AI antes de completar autenticación, autorización, auditoría y recuperación.
