import type { PatientRecord } from './Patient'

const COLUMNS: { key: keyof PatientRecord; label: string }[] = [
  { key: 'ID_Paciente', label: 'ID' },
  { key: 'Nombre_Completo', label: 'Nombre completo' },
  { key: 'Genero', label: 'Genero' },
  { key: 'Fecha_Nacimiento', label: 'Fecha de nacimiento' },
  { key: 'Tipo_Sangre', label: 'Tipo de sangre' },
  { key: 'Fecha_Ingreso', label: 'Fecha de ingreso' },
  { key: 'Diagnostico_Principal', label: 'Diagnostico principal' },
  { key: 'Tratamiento_Asignado', label: 'Tratamiento asignado' },
  { key: 'Medico_Tratante', label: 'Medico tratante' },
  { key: 'Estado_Paciente', label: 'Estado del paciente' },
  { key: 'Telefono_Emergencia', label: 'Telefono de emergencia' },
  { key: 'Costo_Atencion_USD', label: 'Costo atencion (USD)' },
  { key: 'Edad', label: 'Edad' },
]

export function Home({ records }: { records: PatientRecord[] }) {
  return (
    <div className="flex w-dvw h-dvh flex-col items-center p-8">
      <div className="flex w-full items-center justify-between mb-4">
        <h1 className="font-bold text-2xl">
          Historiales Clínicos <span className="badge badge-neutral">{records.length}</span>
        </h1>
        <a href="/search" className="btn btn-neutral">Buscar paciente</a>
      </div>
      <div className="overflow-x-auto w-full">
        <table className="table table-zebra">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.ID_Paciente}>
                {COLUMNS.map((col) =>
                  col.key === 'Nombre_Completo' ? (
                    <td key={col.key} dangerouslySetInnerHTML={{ __html: record.Nombre_Completo }} />
                  ) : (
                    <td key={col.key}>{String(record[col.key])}</td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}