export function Login({ error, uid }: { error?: string; uid?: string }) {
  return (
    <div className="flex flex-col w-dvw h-dvh items-center">
      <div className="basis-1/3" />
      <form
        method="post"
        action="/api/login"
        className="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4"
      >
        <legend className="fieldset-legend">Login</legend>

        {error ? (
          <div role="alert" className="alert alert-error mb-4" dangerouslySetInnerHTML={{ __html: error }} />
        ) : null}

        <label className="label">Numero de empleado</label>
        <input type="text" className="input" name="uid" id="uid" value={uid} />

        <label className="label">Contraseña</label>
        <input type="password" className="input" name="pwd" id="pwd" />

        <button type="submit" className="btn btn-neutral mt-4">Login</button>
      </form>
      <div className="basis-1/3" />
    </div>
  )
}