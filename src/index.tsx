import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { Login } from './Login'
import { getCookie, setCookie } from 'hono/cookie';
import mysql from 'mysql2/promise'
import { getConnInfo } from '@hono/node-server/conninfo'

const conn = await mysql.createConnection("TBD")

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

app.get('/home', (c) => {
  return c.render(<Login />)
})

app.get('/patient/:patientID', (c) => {
  const patientID = c.req.param('patientID')
  return c.render(<div></div>)
})

app.get('/api/login', async (c) => {
  try {
    const reqBody = c.req.json()
    const [results, fields] = await conn.query('SELECT * ')
  }
  catch (e) {
    console.log(`Error while serving request from client @ ${getConnInfo(c).remote.address} \n ${e}`)
    c.status(500)
    return c.json({ auth: false, message: "Internal server error" })
  }
})

export default app
