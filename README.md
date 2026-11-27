# Insecure Patient Lookup

Esta aplicación está creada para demostrar vulnerabilidades comunes en aplicaciones web. La rama `main` contiene la versión deliberadamente explotable; la rama `fixed` mantiene el mismo comportamiento visible pero aplica las correcciones, de modo que el contraste entre ambas es el material de estudio.

El caso que se examinará en este repositorio es el de una clínica que utiliza esta aplicación de Node como interfaz para su base de datos (consulta el CSV para ver un registro en texto plano). La aplicación puede buscar información de pacientes y mostrarla, algo sencillo. En `main` las vulnerabilidades presentes son:

- XSS
- SQLi
- Falta de SSL / sin HTTPS
- Cookies de login débiles y almacenadas en texto plano
- Autenticación débil por contraseña, sin MFA ni limitación de intentos (rate-limiting) en el servidor

En `fixed` están corregidas la inyección SQL del login y de la búsqueda de pacientes, el XSS reflejado de los mensajes de error y el XSS almacenado de los campos del paciente, además del almacenamiento de contraseñas y la gestión de sesión con JWT. Siguen pendientes HTTPS, MFA y rate-limiting.

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
| Número de empleado (`uid`) o usuario | `1` o `admin` |
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

## Correcciones aplicadas en `fixed`

### Inyección SQL en `/patient/:patientID`

En `main`, `GET /patient/:patientID` concatena el parámetro de la URL en el SQL. El siguiente ejemplo devuelve una fila fabricada sin existir en la base de datos:

```bash
curl -G 'http://localhost:8080/patient/0%27%20UNION%20SELECT%201,%27Nombre%27,%27Genero%27,%27Fecha%27,%27Sangre%27,%27Ingreso%27,%27Diagnostico%27,%27Tratamiento%27,%27Medico%27,%27Estado%27,%27Telefono%27,0,0%20--%20' \
  -b 'auth=true'
```

En `fixed` la consulta usa un placeholder (`WHERE ID_Paciente = ?` con `conn.execute`) y el ID debe ser numérico, así que el ejemplo responde `400` con un mensaje de error. Lo mismo aplica a `/patient/lookup`, que ya no redirige con un ID arbitrario.

### `/api/login`

En `main` la consulta se construye concatenando `uid`, los mensajes de error distinguen entre usuario inexistente y contraseña errónea, y las contraseñas están en texto plano. En `fixed`:

- La consulta usa un placeholder (`WHERE u.uid = ?`) con `conn.execute`, por lo que los bypass con `OR` y `UNION SELECT` ya no funcionan.
- Las contraseñas se guardan como hash bcrypt y se comparan con `bcrypt.compare`. Las filas que todavía tengan texto plano se actualizan a bcrypt en el primer login exitoso.
- El mensaje de error es siempre `Usuario o contraseña incorrectos`, sin distinguir entre usuario inexistente y contraseña errónea.
- El identificador puede ser el número de empleado (`uid`, solo dígitos) o el nombre de usuario (`name`, hasta 60 caracteres alfanuméricos con `_ . -`), y la contraseña entre 1 y 72 caracteres ASCII imprimibles, el límite de bcrypt.
- Los mensajes de error se renderizan como texto, no con `dangerouslySetInnerHTML`, así que ya no hay XSS reflejado en el formulario.
- La sesión es un JWT firmado en la cookie `token`, con `HttpOnly`, `SameSite=Lax` y expiración de 3 horas.
- `/home`, `/search` y `/patient/*` exigen un token válido; sin él o con el token expirado se redirige a `/login`.
- `GET /logout` borra la cookie de sesión.

Login correcto:

```bash
curl -i -X POST http://localhost:8080/api/login \
  -H 'Content-Type: application/json' \
  -d '{"uid":"admin","pwd":"admin"}'
```

Respuesta esperada: `200 {"auth":true,"message":"Login exitoso","user":{"uid":1,"name":"admin"}}` y la cookie `token` (JWT). Antes de desplegar, define `JWT_SECRET`; sin ella se usa el secreto de desarrollo `testing`.

### XSS almacenado en los campos del paciente

En `main`, `Home.tsx` y `Patient.tsx` renderizan `Nombre_Completo` con `dangerouslySetInnerHTML`, así que un registro con HTML en ese campo se ejecuta como XSS almacenado. En `fixed` ese campo se renderiza como texto, igual que el resto de la fila.

### Pendiente

HTTPS, MFA y rate-limiting en el login siguen sin implementarse.
