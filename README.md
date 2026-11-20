# Klazia FilmScore

Aplicación académica Full Stack desarrollada por **Hassan
Esteban Cervantes Arango**. Permite buscar películas en TMDB, consultar sus
detalles y administrar favoritos y aportes personales mediante una interfaz
React, una API Express y una base de datos SQLite.

El proyecto está configurado para ejecutarse localmente. **No está desplegado
en internet.**

## Tabla de contenido

- [Descripción](#descripción)
- [Funcionalidades implementadas](#funcionalidades-implementadas)
- [Limitaciones actuales](#limitaciones-actuales)
- [Tecnologías](#tecnologías)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Variables de entorno](#variables-de-entorno)
- [Base de datos](#base-de-datos)
- [Ejecución local](#ejecución-local)
- [Rutas de la API](#rutas-de-la-api)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Pruebas y controles](#pruebas-y-controles)
- [Capturas](#capturas)
- [Seguridad y privacidad](#seguridad-y-privacidad)
- [Mejoras futuras](#mejoras-futuras)
- [Atribución de TMDB](#atribución-de-tmdb)
- [Autor](#autor)

## Descripción

Klazia FilmScore es un proyecto académico que integra un frontend
React, un backend Node.js/Express y almacenamiento local SQLite. El backend
consulta TMDB y entrega al frontend los datos de películas; las credenciales
de TMDB no se envían al navegador.

La aplicación se ejecuta en el computador local del usuario.

## Funcionalidades implementadas

- Registro de cuenta, inicio y cierre de sesión.
- Búsqueda de películas por título y consulta del detalle, incluida la
  calificación que entrega TMDB.
- Favoritos privados: guardar, listar, consultar y retirar películas de la
  lista de la cuenta autenticada.
- Aportes personales: crear un aporte por usuario y película, asignar una
  calificación entera de 1 a 5 y escribir una reseña de 10 a 1.000 caracteres.
- Los aportes se crean privados por defecto. Su autor puede consultarlos,
  editarlos, cambiar su visibilidad y eliminarlos.
- La vista de detalle puede mostrar aportes públicos. La vista «Mis aportes»
  presenta los aportes de la sesión actual.
- Estados de carga, listas vacías, errores y reintentos explícitos en los
  flujos principales.
- CSS con ajustes responsive para navegación, formularios, tarjetas y detalle.
  La existencia de esos estilos no implica una certificación de accesibilidad
  ni una validación formal en todos los tamaños de pantalla.

## Limitaciones actuales

- Solo está configurado para uso local; no hay despliegue en internet.
- El catálogo requiere una configuración válida de `TMDB_ACCESS_TOKEN`. Si
  falta o TMDB no está disponible, las consultas pueden fallar.
- Las sesiones usan el almacén en memoria predeterminado de `express-session`;
  se pierden al reiniciar el backend.
- No hay roles de administrador, moderación ni reportes.
- No hay recuperación ni eliminación de cuentas.
- La búsqueda es por título y no incluye filtros adicionales.

## Tecnologías

Las versiones indicadas provienen de los manifiestos del proyecto o del
entorno local verificado durante la preparación de este README.

| Área                 | Tecnología                                                                         |
| -------------------- | ---------------------------------------------------------------------------------- |
| Interfaz             | React 19.3.1 y Vite 8.3.8                                                          |
| Lenguaje             | JavaScript con módulos ECMAScript                                                  |
| Marcado y estilos    | JSX con HTML semántico y CSS                                                       |
| Backend              | Node.js 24.13.0 y Express 5.3.0                                                    |
| Persistencia         | SQLite mediante `better-sqlite3` 13.2.0                                            |
| Catálogo externo     | TMDB, consultado desde el backend                                                  |
| Sesiones y seguridad | `express-session` 1.19.0, `bcryptjs` 3.0.3, `csrf-sync` 4.2.1 y `cors` 2.8.6       |
| Pruebas              | Vitest 5.1.0; Supertest 7.3.2 en backend; React Testing Library 16.3.3 en frontend |

## Requisitos previos

- Windows 11 de 64 bits, el entorno local usado para esta documentación.
  Otros sistemas operativos no se verificaron aquí.
- Node.js 24.13.0 y npm 11.8.0 se detectaron en el entorno de trabajo.
- Git para clonar el repositorio cuando se publique su URL.
- Una cuenta de TMDB y su **Read Access Token** para habilitar las consultas
  del catálogo.
- Google Chrome o Microsoft Edge para la demostración local.

## Instalación

En PowerShell:

```powershell
git clone https://github.com/hassancer/klazia-filmscore.git
Set-Location FilmScore
Set-Location backend
npm install
Copy-Item .env.example .env
```

Edita `backend/.env` con valores locales seguros como se explica en
[Variables de entorno](#variables-de-entorno). Después instala las dependencias
del frontend:

```powershell
Set-Location ..\frontend
npm install
```

La base de datos y su esquema se preparan con el comando documentado en
[Base de datos](#base-de-datos).

## Variables de entorno

`backend/.env.example` contiene estas variables. Los siguientes valores son
ejemplos o marcadores; reemplaza los marcadores localmente y nunca pegues un
secreto real en el README:

```dotenv
SESSION_SECRET=REEMPLAZAR_POR_UN_SECRETO_ALEATORIO_DE_AL_MENOS_32_BYTES
SESSION_IDLE_TIMEOUT_MS=1800000
TMDB_ACCESS_TOKEN=REEMPLAZAR_POR_TU_READ_ACCESS_TOKEN
TMDB_BASE_URL=https://api.themoviedb.org/3
TMDB_TIMEOUT_MS=4000
FRONTEND_ORIGIN=http://localhost:5173
PORT=3000
DATABASE_PATH=backend/data/klazia.db
```

| Variable                  | Uso en la configuración                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`          | Secreto requerido para firmar las sesiones. El backend rechaza valores ausentes o menores de 32 bytes.                                               |
| `SESSION_IDLE_TIMEOUT_MS` | Duración de inactividad de la cookie de sesión en milisegundos; el valor de ejemplo equivale a 30 minutos.                                           |
| `TMDB_ACCESS_TOKEN`       | Read Access Token usado por el backend para consultar TMDB. Se puede dejar vacío, pero las consultas al catálogo no estarán disponibles.             |
| `TMDB_BASE_URL`           | Dirección base del API de TMDB; el valor de ejemplo coincide con el predeterminado del código.                                                       |
| `TMDB_TIMEOUT_MS`         | Tiempo máximo de espera de las solicitudes a TMDB, expresado en milisegundos. Debe ser un entero positivo; si falta o es inválido, se usan 4.000 ms. |
| `FRONTEND_ORIGIN`         | Origen exacto permitido por CORS y por la comprobación de origen en mutaciones.                                                                      |
| `PORT`                    | Puerto del backend; el valor predeterminado es 3000.                                                                                                 |
| `DATABASE_PATH`           | Ruta de SQLite relativa a la raíz del proyecto (o absoluta si se configura así). El valor de ejemplo es `backend/data/klazia.db`.                    |

El archivo `.env` está excluido por `.gitignore`; no lo subas a GitHub.
`backend/.env.example` sí se conserva como plantilla sin secretos.

## Base de datos

- Motor: SQLite mediante `better-sqlite3`.
- Ruta predeterminada: `backend/data/klazia.db`, relativa a la raíz del
  proyecto.
- Tablas creadas por las migraciones actuales:
  - `users`: cuentas y hash de contraseña.
  - `favorites`: favoritos asociados a una cuenta.
  - `contributions`: calificaciones y reseñas propias.
  - `schema_migrations`: control de migraciones aplicadas.
- Los archivos `.db`, `.sqlite` y sus variantes están excluidos por
  `.gitignore`; no se versionan.

En un equipo nuevo, configura `backend/.env` y ejecuta la migración desde
`backend/`. El script crea el directorio de datos si no existe, crea la base
SQLite y aplica las migraciones versionadas:

```powershell
npm run db:migrate
```

No se requiere copiar una base de datos local ni se debe subir una al
repositorio.

## Ejecución local

Primero, desde `backend/`, crea o actualiza el esquema:

```powershell
npm run db:migrate
```

Inicia cada servicio en una terminal separada.

Terminal del backend:

```powershell
Set-Location backend
npm start
```

Terminal del frontend:

```powershell
Set-Location frontend
npm run dev
```

- Aplicación: `http://localhost:5173`
- API: `http://localhost:3000`
- Comprobación del backend: `GET http://localhost:3000/api/status`

El servidor backend escucha en loopback (`127.0.0.1`); la configuración actual
no lo publica en una interfaz de red externa.

## Rutas de la API

Las respuestas indicadas son las principales definidas por los controladores y
el middleware. Las lecturas (`GET`) no requieren token CSRF. Las mutaciones
requieren un token CSRF válido y el origen configurado; primero se obtiene el
token mediante `GET /api/csrf-token`.

| Método   | Ruta                             | Acceso                     | CSRF | Propósito                                                    | Respuestas HTTP principales              |
| -------- | -------------------------------- | -------------------------- | ---- | ------------------------------------------------------------ | ---------------------------------------- |
| `GET`    | `/api/status`                    | Público                    | No   | Comprueba que la API responde.                               | `200`                                    |
| `GET`    | `/api/csrf-token`                | Público                    | No   | Obtiene el token para solicitudes que modifican estado.      | `200`                                    |
| `POST`   | `/api/cuentas`                   | Público, sin sesión previa | Sí   | Registra una cuenta.                                         | `201`, `400`, `403`, `409`, `500`        |
| `POST`   | `/api/sesiones`                  | Público, sin sesión previa | Sí   | Inicia sesión y entrega la identidad visible.                | `200`, `400`, `401`, `403`, `500`        |
| `DELETE` | `/api/sesiones`                  | Sesión opcional            | Sí   | Cierra la sesión si existe.                                  | `204`, `403`, `500`                      |
| `GET`    | `/api/peliculas?titulo=...`      | Público                    | No   | Busca películas por título en TMDB.                          | `200`, `400`, `503`, `504`               |
| `GET`    | `/api/peliculas/:tmdbId`         | Público                    | No   | Consulta el detalle de una película.                         | `200`, `404`, `503`, `504`               |
| `GET`    | `/api/peliculas/:tmdbId/aportes` | Público                    | No   | Lee los aportes públicos de una película.                    | `200`, `400`, `500`                      |
| `GET`    | `/api/favoritos`                 | Sesión autenticada         | No   | Lista los favoritos de la cuenta actual.                     | `200`, `401`, `500`                      |
| `GET`    | `/api/favoritos/:id`             | Sesión autenticada         | No   | Consulta un favorito propio; `:id` es el ID externo de TMDB. | `200`, `401`, `404`, `500`               |
| `POST`   | `/api/favoritos`                 | Sesión autenticada         | Sí   | Guarda un favorito de la cuenta actual.                      | `201`, `400`, `401`, `403`, `409`, `500` |
| `DELETE` | `/api/favoritos/:id`             | Sesión autenticada         | Sí   | Retira un favorito propio usando el ID externo de TMDB.      | `204`, `400`, `401`, `403`, `404`, `500` |
| `GET`    | `/api/aportes/propios`           | Sesión autenticada         | No   | Lista los aportes del usuario actual.                        | `200`, `401`, `500`                      |
| `POST`   | `/api/aportes`                   | Sesión autenticada         | Sí   | Crea un aporte propio, privado por defecto.                  | `201`, `400`, `401`, `403`, `409`, `500` |
| `PATCH`  | `/api/aportes/:id`               | Sesión autenticada         | Sí   | Edita parcialmente un aporte propio.                         | `200`, `400`, `401`, `403`, `404`, `500` |
| `DELETE` | `/api/aportes/:id`               | Sesión autenticada         | Sí   | Elimina un aporte propio.                                    | `204`, `401`, `403`, `404`, `500`        |

Los errores `503` y `504` del catálogo indican indisponibilidad o timeout de
TMDB. En las mutaciones, `403` puede indicar origen/token CSRF no válido o,
para aportes, falta de propiedad del recurso. Los errores internos se
responden con mensajes saneados.

## Estructura del proyecto

```text
FilmScore/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── database/
│   │   │   └── migrations/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── security/
│   │   └── services/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── styles/
│   │   └── test/
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Pruebas y controles

Los manifiestos definen Vitest en backend y frontend, Supertest en backend y
React Testing Library en frontend. Desde cada carpeta, los comandos
disponibles son:

```powershell
npm test
npm run lint
npm run format:check
npm run format
```

El frontend también define el build:

```powershell
npm run build
```

Ejecuta estos comandos desde `backend/` o `frontend/`, según corresponda. Este
README documenta los comandos disponibles y no declara cantidades de pruebas
aprobadas ni resultados de ejecución.

## Capturas

No se encontraron capturas de la aplicación actual fuera de los artefactos de
prototipo; por eso no se presentan imágenes del prototipo como si fueran
evidencia de la aplicación funcionando. Se deben agregar capturas reales,
tomadas con datos de prueba y sin información personal, de estas vistas:

- Inicio.
- Búsqueda con resultados.
- Detalle de película con su calificación TMDB.
- Favoritos de una cuenta de demostración.
- «Mis aportes» con estados público y privado.
- Detalle de película con un aporte público.

## Seguridad y privacidad

- Las contraseñas se guardan como hashes bcrypt mediante `bcryptjs`; no se
  devuelven en las respuestas.
- `express-session` administra sesiones en memoria. La cookie `klazia.sid`
  está configurada como `HttpOnly` y `SameSite=Lax`. `Secure` está desactivado
  en la configuración local HTTP actual; no se debe interpretar como una
  configuración lista para producción.
- CORS permite el origen indicado por `FRONTEND_ORIGIN` y habilita credenciales.
  Las mutaciones también validan el origen y el token CSRF.
- El token de TMDB se configura solo en el backend. Los errores públicos no
  exponen consultas SQL, credenciales ni detalles internos.
- No subas `.env`, tokens, contraseñas, cookies de sesión ni archivos SQLite.
  Usa solo datos sintéticos en capturas o demostraciones compartidas.

## Mejoras futuras

Estas ideas no están implementadas actualmente:

- Agregar filtros o paginación al catálogo.
- Incorporar almacenamiento persistente de sesiones y recuperación o
  eliminación de cuentas mediante decisiones de producto.
- Evaluar si el proyecto necesita administración o moderación.
- Completar verificaciones formales de responsive y rendimiento antes de
  afirmar resultados para esos requisitos.
- Verificar y completar la atribución oficial de TMDB antes de publicar.

## Atribución de TMDB

La aplicación utiliza TMDB como fuente de información sobre películas y
calificaciones. La interfaz incluye el aviso: **«Las películas y calificaciones
se consultan en TMDB.»** No se afirma que TMDB respalde ni certifique este
proyecto.

## Autor

**Hassan Esteban Cervantes Arango**  
Proyecto académico.
