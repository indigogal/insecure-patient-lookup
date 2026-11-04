export function Login() {
  return (
    <div className="flex flex-col w-dvw h-dvh items-center">
      <div className="basis-1/3" />
      <fieldset className="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4 ">
        <legend className="fieldset-legend">Login</legend>

        <label className="label">Numero de empleado</label>
        <input type="email" className="input" id="uid" />

        <label className="label">Contraseña</label>
        <input type="password" className="input" id="pwd" />

        <button onClick={sendLoginInfo} className="btn btn-neutral mt-4">Login</button>
      </fieldset>
      <div className="basis-1/3" />
    </div>
  )
}

function sendLoginInfo() {
  const uid = document.getElementById('uid')?.value
  const pwd = document.getElementById('pwd')?.value

  const req = new Request('/login')
}
