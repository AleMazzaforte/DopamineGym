
import personaService, { type Persona, type PersonaInsert } from '../../services/PersonaService';
import Swal from 'sweetalert2';


interface ModalAlumnoProps {
  open: boolean;
  alumno: Persona | null;
  onClose: () => void;
  onAlumnoGuardado: () => void;
}

export default function ModalAlumno({ open, alumno, onClose, onAlumnoGuardado }: ModalAlumnoProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-800">
            {alumno ? 'Editar Alumno' : 'Nuevo Alumno'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>

        <form 
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            
            try {
              const data: PersonaInsert = {
                dni: formData.get('dni') as string,
                nombre: formData.get('nombre') as string,
                apellido: formData.get('apellido') as string,
                email: formData.get('email') as string,
                telefono: formData.get('telefono') as string,
                fecha_nacimiento: formData.get('fecha_nacimiento') as string,
                rol_actual: 'ALUMNO' as const,
                contacto_emergencia: (formData.get('contacto_emergencia') as string) || undefined,
                telefono_familiar: (formData.get('telefono_familiar') as string) || undefined,
                antecedentes_entrenamiento: (formData.get('antecedentes_entrenamiento') as string) || undefined,
                restricciones: (formData.get('restricciones') as string) || undefined,
                certificado_medico: (formData.get('certificado_medico') as string) || undefined,
                fecha_vencimiento_certificado: (formData.get('fecha_vencimiento_certificado') as string) || undefined,
              };

              if (alumno) {
                await personaService.update(alumno.id, data);
                Swal.fire({ icon: 'success', title: '¡Alumno actualizado!', timer: 1500, showConfirmButton: false });
              } else {
                await personaService.create(data);
                Swal.fire({ icon: 'success', title: '¡Alumno creado!', timer: 1500, showConfirmButton: false });
              }

              onAlumnoGuardado();
            } catch (error: any) {
              Swal.fire({ icon: 'error', title: 'Error', text: error.message });
            }
          }} 
          className="p-6 space-y-6"
        >
          {/* SECCIÓN 1: DATOS PERSONALES */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Datos Personales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DNI *</label>
                <input
                  type="text"
                  name="dni"
                  defaultValue={alumno?.dni || ''}
                  required
                  readOnly={!!alumno}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento *</label>
                <input
                  type="date"
                  name="fecha_nacimiento"
                  defaultValue={alumno?.fecha_nacimiento?.split('T')[0] || ''}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  name="nombre"
                  defaultValue={alumno?.nombre || ''}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
                <input
                  type="text"
                  name="apellido"
                  defaultValue={alumno?.apellido || ''}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={alumno?.email || ''}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
                <input
                  type="tel"
                  name="telefono"
                  defaultValue={alumno?.telefono || ''}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: CONTACTOS DE EMERGENCIA */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Contactos de Emergencia</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del contacto</label>
                <input
                  type="text"
                  name="contacto_emergencia"
                  defaultValue={alumno?.contacto_emergencia || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono familiar / emergencia</label>
                <input
                  type="tel"
                  name="telefono_familiar"
                  defaultValue={alumno?.telefono_familiar || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: DATOS MÉDICOS Y DE ENTRENAMIENTO */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Datos Médicos y de Entrenamiento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Antecedentes de entrenamiento</label>
                <textarea
                  name="antecedentes_entrenamiento"
                  defaultValue={alumno?.antecedentes_entrenamiento || ''}
                  rows={2}
                  placeholder="Ej: Entrena hace 2 años, nivel intermedio..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-red-600">Restricciones médicas / Lesiones</label>
                <textarea
                  name="restricciones"
                  defaultValue={alumno?.restricciones || ''}
                  rows={2}
                  placeholder="Ej: Hernia discal L5, no puede hacer peso muerto..."
                  className="w-full px-3 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 bg-red-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Certificado médico (URL o nombre de archivo)</label>
                <input
                  type="text"
                  name="certificado_medico"
                  defaultValue={alumno?.certificado_medico || ''}
                  placeholder="Ej: certificado_juan_perez.pdf"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento del certificado</label>
                <input
                  type="date"
                  name="fecha_vencimiento_certificado"
                  defaultValue={alumno?.fecha_vencimiento_certificado?.split('T')[0] || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {alumno ? 'Actualizar Alumno' : 'Crear Alumno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}