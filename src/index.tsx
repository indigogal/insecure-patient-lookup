import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { Login } from './Login'
import { Search } from './Search'
import { Patient, type PatientRecord } from './Patient'
import { Home } from './Home'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { RowDataPacket } from 'mysql2'
import mysql from 'mysql2/promise'
import { getConnInfo } from '@hono/node-server/conninfo'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import { sign, verify, jwt } from 'hono/jwt'
import { timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcrypt'
import { rateLimiter } from 'hono-rate-limiter'

const SECRET = process.env.JWT_SECRET
if (!SECRET) {
  console.warn('JWT_SECRET no está definido: se usa un secreto de desarrollo. Configúralo antes de desplegar.')
}
const JWT_SECRET = SECRET ?? 'testing'
const TOKEN_COOKIE = 'token'
const TOKEN_TTL_SECONDS = 60 * 60 * 3 // 3 horas

const UID_PATTERN = /^\d{1,10}$/
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_.-]{1,60}$/
const PATIENT_ID_PATTERN = /^\d{1,10}$/
const PASSWORD_PATTERN = /^[\x20-\x7E]{1,72}$/
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/

const LOGIN_BY_UID_SQL = `SELECT u.uid, u.name, p.pwd
  FROM Users u
  JOIN Passwords p ON u.uid = p.uid
  WHERE u.uid = ?`
const LOGIN_BY_NAME_SQL = `SELECT u.uid, u.name, p.pwd
  FROM Users u
  JOIN Passwords p ON u.uid = p.uid
  WHERE u.name = ?`

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'lab',
})

const app = new Hono()
app.use(rateLimiter({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'anonymous',
}))

const auth = jwt({ secret: JWT_SECRET, alg: 'HS256', cookie: TOKEN_COOKIE })

async function passwordMatches(input: string, stored: string) {
  if (BCRYPT_HASH_PATTERN.test(stored)) {
    return bcrypt.compare(input, stored)
  }
  const given = Buffer.from(input)
  const expected = Buffer.from(stored)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

app.onError((err, c) => {
  if (err instanceof HTTPException && err.status === 401) {
    deleteCookie(c, TOKEN_COOKIE)
    return c.redirect('/login')
  }
  console.error(`Unhandled error on ${c.req.method} ${c.req.path}`, err)
  return c.text('Internal server error', 500)
})

app.use(logger())
app.use(
  jsxRenderer(({ children }) => {
    return (
      <html>
        <head>
          <link href="/src/styles.css" rel="stylesheet" />
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body>
          {children}
        </body>
      </html>
    )
  })
)

app.get('/', async (c) => {
  const token = getCookie(c, TOKEN_COOKIE)
  if (!token) {
    return c.redirect('/login')
  }
  try {
    await verify(token, JWT_SECRET, 'HS256')
  } catch {
    deleteCookie(c, TOKEN_COOKIE)
    return c.redirect('/login')
  }
  return c.redirect('/home')
})

app.get('/login', (c) => {
  return c.render(<Login />)
})

app.get('/logout', (c) => {
  deleteCookie(c, TOKEN_COOKIE)
  return c.redirect('/login')
})

app.post('/api/login', async (c) => {
  try {
    const contentType = c.req.header('content-type') || 'application/x-www-form-urlencoded'
    const body: any = contentType.includes('application/json')
      ? await c.req.json()
      : await c.req.parseBody()
    const identifier = String(body.uid ?? '').trim()
    const pwd = typeof body.pwd === 'string' ? body.pwd : ''

    const wantsJson = contentType.includes('application/json')
    const invalid = (status: 400 | 401) => {
      const message = 'Usuario o contraseña incorrectos, intente de nuevo'
      console.log(`Login rechazado para ${JSON.stringify(identifier)} desde ${getConnInfo(c).remote.address}`)
      if (wantsJson) {
        c.status(status)
        return c.json({ auth: false, message })
      }
      return c.render(<Login error={message} />)
    }

    if (!IDENTIFIER_PATTERN.test(identifier) || !PASSWORD_PATTERN.test(pwd)) {
      return invalid(400)
    }

    const [rows] = await conn.execute<RowDataPacket[]>(
      UID_PATTERN.test(identifier) ? LOGIN_BY_UID_SQL : LOGIN_BY_NAME_SQL,
      [identifier]
    )

    const user = rows[0]
    const passwordOk = user ? await passwordMatches(pwd, user.pwd) : false

    if (!user || !passwordOk) {
      return invalid(401)
    }

    if (!BCRYPT_HASH_PATTERN.test(user.pwd)) {
      const upgraded = await bcrypt.hash(pwd, 12)
      await conn.execute('UPDATE Passwords SET pwd = ? WHERE uid = ?', [upgraded, user.uid])
      console.log(`Contraseña de ${user.name} migrada a hash bcrypt`)
    }

    const payload = {
      uid: user.uid,
      user: user.name,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
    }

    const token = await sign(payload, JWT_SECRET, 'HS256')
    setCookie(c, TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: TOKEN_TTL_SECONDS,
      secure: process.env.NODE_ENV === 'production',
    })

    console.log(`Login exitoso para ${user.name} (uid ${user.uid}) desde ${getConnInfo(c).remote.address}`)

    if (contentType.includes('application/json')) {
      return c.json({ auth: true, message: 'Login exitoso', user: { uid: user.uid, name: user.name } })
    }

    return c.redirect('/home')
  }
  catch (e) {
    console.log(`Error while serving request from client @ ${getConnInfo(c).remote.address} \n ${e}`)
    c.status(500)
    return c.json({ message: `Internal server error: ${(e as Error).message}` })
  }
})

app.use('/home', auth)
app.get('/home', async (c) => {
  try {
    const [rows] = await conn.query<PatientRecord[]>('SELECT * FROM historiales_clinicos')
    return c.render(<Home records={rows} />)
  }
  catch (e) {
    console.log(`Error while serving request from client @ ${getConnInfo(c).remote.address} \n ${e}`)
    c.status(500)
    return c.json({ auth: false, message: `Internal server error: ${(e as Error).message}` })
  }
})

app.use('/search', auth)
app.get('/search', (c) => {
  return c.render(<Search />)
})

app.use('/patient/*', auth)
app.get('/patient/lookup', (c) => {
  const id = (c.req.query('id') ?? '').trim()
  if (!PATIENT_ID_PATTERN.test(id)) {
    return c.render(<Search error="El ID del paciente debe ser numérico" />)
  }
  return c.redirect(`/patient/${id}`)
})

app.get('/patient/:patientID', async (c) => {
  const patientID = c.req.param('patientID')
  if (!PATIENT_ID_PATTERN.test(patientID)) {
    c.status(400)
    return c.render(<Search error="El ID del paciente debe ser numérico" />)
  }
  try {
    const [rows] = await conn.execute<PatientRecord[]>(
      'SELECT * FROM historiales_clinicos WHERE ID_Paciente = ?',
      [patientID]
    )
    const record = rows[0]
    if (!record) {
      c.status(404)
      return c.render(<Search error={`No se encontró el paciente ${patientID}`} />)
    }
    return c.render(<Patient record={record} />)
  }
  catch (e) {
    console.log(`Error while serving request from client @ ${getConnInfo(c).remote.address} \n ${e}`)
    c.status(500)
    return c.json({ auth: false, message: `Internal server error: ${(e as Error).message}` })
  }
})

export default app
