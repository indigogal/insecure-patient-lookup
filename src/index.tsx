import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { Login } from './Login'

const app = new Hono()

app.use(
  jsxRenderer(({ children }) => {
    return (
      <html>
        <body>
          <div>{children}</div>
        </body>
      </html>
    )
  })
)

app.get('/', (c) => {
  // TODO: Check user cookies to see if logged in, if !logged in, route to login, else display a lookup menu
  return c.render(<div></div>)
})


app.get('/login', (c) => {
  return c.render(<Login />)
})

app.get('/patient/:patientID', (c) => {
  return c.render(<div></div>)
})

export default app
