import { useEffect, useState } from 'react';
import { type PersonaConEstado } from '../../services/PersonaService';
import periodoService, { type MotivoBaja, type Periodo } from '../../services/periodoService';
import { mostrarError, mostrarExito, mostrarAdvertencia } from '../../lib/swal';

interface ModalBajaProps {
  open: boolean;
  alumno: PersonaConEstado | null;
  onClose: () => void;
  onBajaGuardada: () => void;
}

export default function ModalBaja({ open, alumno, onClose, onBajaGuardada }: ModalBajaProps) {
  const [ultimoPeriodo, setUltimoPeriodo] = useState<Periodo | null>(null);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [motivo, setMotivo] = useState<MotivoBaja>('otros');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    if (open && alumno) {
      setMotivo('otros');
      setObservaciones('');
      cargarUltimoPeriodo(alumno.id);
    } else {
      setUltimoPeriodo(null);
    }
  }, [open, alumno]);

  // Solo buscamos el último período para obtener su ID y asociar la baja
  const cargarUltimoPeriodo = async (personaId: number) => {
    setCargando(true);
    try {
      const ultimo = await periodoService.getUltimoPeriodo(personaId);
      setUltimoPeriodo(ultimo);
    } catch (error: any) {
      console.error('Error al obtener el último período:', error);
    } finally {
      setCargando(false);
    }
  };

  // El estado proviene directamente de persona_estados (pasado desde AlumnosPage)
  const esActivo = alumno?.estado === 'ACTIVO';
  const esBaja = alumno?.estado === 'BAJA';
  const puedeDarBaja = alumno?.estado === 'INACTIVO';

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!alumno) return;

    if (esActivo) {
      mostrarAdvertencia(
        'Alumno Activo',
        'El alumno figura como ACTIVO. Debe estar INACTIVO (período vencido) para poder registrar la baja.'
      );
      return;
    }

    if (esBaja) {
      mostrarAdvertencia('Alumno de Baja', 'Este alumno ya figura en estado BAJA.');
      return;
    }

    setEnviando(true);

    try {
      if (ultimoPeriodo) {
        await periodoService.registrarBaja(
          ultimoPeriodo.id,
          motivo,
          observaciones
        );
      } else {
        const hoy = new Date().toISOString().split('T')[0];
        await periodoService.create({
          persona_id: alumno.id,
          fecha_inicio: hoy,
          fecha_fin: hoy,
          motivo_baja: motivo,
          observaciones: observaciones,
        });
      }

      mostrarExito('Baja registrada correctamente');
      onBajaGuardada();
    } catch (error: any) {
      mostrarError('Error al registrar baja', error.message || 'Ocurrió un error inesperado');
    } finally {
      setEnviando(false);
    }
  };

  if (!open || !alumno) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Dar de Baja Alumno</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Card con el Estado exacto de AlumnosPage */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase">Alumno</p>
              <p className="text-base font-bold text-gray-900">
                {alumno.apellido}, {alumno.nombre}
              </p>
              <p className="text-xs text-gray-600">DNI: {alumno.dni}</p>
            </div>
            <div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                alumno.estado === 'ACTIVO' ? 'bg-green-100 text-green-800' :
                alumno.estado === 'BAJA' ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-800'
              }`}>
                {alumno.estado === 'ACTIVO' ? 'Activo' :
                 alumno.estado === 'BAJA' ? 'Baja' : 'Inactivo'}
              </span>
            </div>
          </div>

          {/* Mensajes según el estado de persona_estados */}
          {esActivo && (
            <div className="bg-yellow-50 p-3.5 rounded-lg border border-yellow-300 text-xs text-yellow-900">
              ⚠ <strong>Alumno Activo:</strong> El alumno actualmente está <strong>ACTIVO</strong>.
              No se puede procesar la baja mientras mantenga cobertura activa. Debe esperar a que pase a <strong>INACTIVO</strong>.
            </div>
          )}

          {esBaja && (
            <div className="bg-red-50 p-3.5 rounded-lg border border-red-300 text-xs text-red-900">
              ℹ <strong>Alumno en Baja:</strong> Este alumno ya figura en estado <strong>BAJA</strong> en el sistema.
            </div>
          )}

          {puedeDarBaja && (
            <div className="bg-blue-50 p-3.5 rounded-lg border border-blue-200 text-xs text-blue-900">
              ✓ El alumno está <strong>INACTIVO</strong>. Seleccione el motivo y complete las observaciones para registrar la baja.
            </div>
          )}

          {/* Formulario de Baja */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de la baja *</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as MotivoBaja)}
              required
              disabled={cargando || !puedeDarBaja}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-sm"
            >
              <option value="vacaciones">Vacaciones</option>
              <option value="lesion">Lesión / Salud</option>
              <option value="cuestiones_laborales">Cuestiones laborales</option>
              <option value="cambio_domicilio">Cambio de domicilio / Mudanza</option>
              <option value="problemas_financieros">Problemas financieros</option>
              <option value="disgusto_personal">Disgusto personal</option>
              <option value="disgusto_instalaciones">Disgusto con instalaciones</option>
              <option value="asistencia_intermitente">Asistencia intermitente</option>
              <option value="otros">Otros</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              disabled={cargando || !puedeDarBaja}
              placeholder="Detalles adicionales sobre la baja..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || cargando || !puedeDarBaja}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
            >
              {enviando ? 'Guardando...' : 'Confirmar Baja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}