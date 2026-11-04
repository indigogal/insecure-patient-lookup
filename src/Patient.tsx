import type { RowDataPacket } from 'mysql2'

export interface PatientRecord extends RowDataPacket {
  ID_Paciente: number
  Nombre_Completo: string
  Genero: string
  Fecha_Nacimiento: string
  Tipo_Sangre: string
  Fecha_Ingreso: string | Date
  Diagnostico_Principal: string
  Tratamiento_Asignado: string
  Medico_Tratante: string
  Estado_Paciente: string
  Telefono_Emergencia: string
  Costo_Atencion_USD: number
  Edad: number
}

const FIELDS: { key: keyof PatientRecord; label: string }[] = [
  { key: 'ID_Paciente', label: 'ID' },
  { key: 'Genero', label: 'Genero' },
  { key: 'Fecha_Nacimiento', label: 'Fecha de nacimiento' },
  { key: 'Tipo_Sangre', label: 'Tipo de sangre' },
  { key: 'Fecha_Ingreso', label: 'Fecha de ingreso' },
  { key: 'Diagnostico_Principal', label: 'Diagnostico principal' },
  { key: 'Tratamiento_Asignado', label: 'Tratamiento asignado' },
  { key: 'Medico_Tratante', label: 'Medico tratante' },
  { key: 'Estado_Paciente', label: 'Estado del paciente' },
  { key: 'Telefono_Emergencia', label: 'Telefono de emergencia' },
  { key: 'Costo_Atencion_USD', label: 'Costo de atencion (USD)' },
  { key: 'Edad', label: 'Edad' },
]

export function Patient({ record }: { record: PatientRecord }) {
  return (
    <div className="flex w-dvw h-dvh flex-col items-center p-8">
      <div className="card w-2xl bg-base-200 border-base-300 rounded-box border shadow-sm">
        <div className="card-body">
          <h1 className="card-title text-3xl">
            <span dangerouslySetInnerHTML={{ __html: record.Nombre_Completo }} />
          </h1>
          <table className="table">
            <tbody>
              {FIELDS.map((field) => (
                <tr key={field.key}>
                  <th className="w-1/3">{field.label}</th>
                  <td>{String(record[field.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}