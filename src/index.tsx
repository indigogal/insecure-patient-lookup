import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { Login } from './Login'
import { Search } from './Search'
import { Patient, type PatientRecord } from './Patient'
import { Home } from './Home'
import { getCookie, setCookie } from 'hono/cookie'
import type { RowDataPacket } from 'mysql2'
import mysql from 'mysql2/promise'
import { getConnInfo } from '@hono/node-server/conninfo'

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'lab',
})

const app = new Hono()

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

app.get('/', (c) => {
  const auth = getCookie(c, 'auth')
  if (typeof auth === 'undefined' || auth === 'false') {
    return c.redirect('/login')
  } else {
    return c.redirect('/home')
  }
})

app.get('/login', (c) => {
  return c.render(<Login />)
})

app.post('/api/login', async (c) => {
  try {
    const contentType = c.req.header('content-type') || 'application/x-www-form-urlencoded'
    const body: any = contentType.includes('application/json')
      ? await c.req.json()
      : await c.req.parseBody()
    const uid = body.uid
    const pwd = body.pwd

    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT u.uid, u.name, p.pwd
       FROM Users u
       JOIN Passwords p ON u.uid = p.uid
       WHERE u.uid = '${uid}'`
    )

    const user = rows[0]

    if (!user) {
      const message = `Usuario ${uid} no encontrado`
      if (contentType.includes('application/json')) {
        c.status(404)
        return c.json({ auth: false, message })
      }
      return c.render(<Login error={message} uid={uid} />)
    }

    if (user.pwd !== pwd) {
      const message = 'Contraseña incorrecta'
      if (contentType.includes('application/json')) {
        c.status(401)
        return c.json({ auth: false, message })
      }
      return c.render(<Login error={message} uid={uid} />)
    }

    setCookie(c, 'auth', 'true')
    setCookie(c, 'uid', String(user.uid))

    console.log(`Login exitoso para ${user.name} (uid ${user.uid}) desde ${getConnInfo(c).remote.address}`)

    if (contentType.includes('application/json')) {
      return c.json({ auth: true, message: 'Login exitoso', user: { uid: user.uid, name: user.name } })
    }

    return c.redirect('/home')
  }
  catch (e) {
    console.log(`Error while serving request from client @ ${getConnInfo(c).remote.address} \n ${e}`)
    c.status(500)
    return c.json({ auth: false, message: `Internal server error: ${(e as Error).message}` })
  }
})

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

app.get('/search', (c) => {
  return c.render(<Search />)
})

app.get('/patient/lookup', (c) => {
  const id = c.req.query('id')
  return c.redirect(`/patient/${id}`)
})

app.get('/patient/:patientID', async (c) => {
  const patientID = c.req.param('patientID')
  try {
    const [rows] = await conn.query<PatientRecord[]>(
      `SELECT * FROM historiales_clinicos WHERE ID_Paciente = '${patientID}'`
    )
    const record = rows[0]
    if (!record) {
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