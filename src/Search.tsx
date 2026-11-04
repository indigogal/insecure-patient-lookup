export function Search({ error }: { error?: string }) {
  return (
    <div className="flex flex-col w-dvw h-dvh items-center gap-4">
      <div className="basis-1/4" />
      <div className="flex w-sm items-center justify-between">
        <h1 className="font-bold text-2xl">Buscar paciente</h1>
        <a href="/home" className="btn btn-outline">Inicio</a>
      </div>

      {error ? (
        <div role="alert" className="alert alert-error w-sm">
          <span dangerouslySetInnerHTML={{ __html: error }} />
        </div>
      ) : null}

      <form
        method="get"
        action="/patient/lookup"
        className="fieldset bg-base-200 border-base-300 rounded-box w-sm border p-4"
      >
        <legend className="fieldset-legend">Buscar paciente</legend>

        <label className="label">ID del paciente</label>
        <input type="text" className="input" name="id" />

        <button type="submit" className="btn btn-neutral mt-4">Buscar</button>
      </form>
    </div>
  )
}