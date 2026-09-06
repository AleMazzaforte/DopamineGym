import { useState } from 'react';
import personaService, { type PersonaConEstado } from '../../services/PersonaService';
import { mostrarExito, mostrarError } from '../../lib/swal';

interface ModalProvisorioProps {
  open: boolean;
  alumno: PersonaConEstado | null;
  onClose: () => void;
  onProvisorioGuardado: () => void;
}

export default function ModalProvisorio({
  open,
  alumno,
  onClose,
  onProvisorioGuardado,
}: ModalProvisorioProps) {
  const [loading, setLoading] = useState(false);

  if (!open || !alumno) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const fechaPromesa = formData.get('fecha_promesa_pago') as string;
    const observaciones = formData.get('observaciones') as string;

    try {
      setLoading(true);

      // Invocación al servicio de persona
      await personaService.activarProvisorio(alumno.id, {
        fecha_promesa_pago: fechaPromesa || null,
        observaciones: observaciones?.trim() || null,
      });

      mostrarExito('¡Estado Provisorio activado correctamente!');
      onProvisorioGuardado();
    } catch (error: any) {
      mostrarError('Error', error.message || 'No se pudo cambiar el estado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏳</span>
            <h2 className="text-xl font-bold text-gray-800">
              Activar Estado Provisorio
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Ficha rápida del alumno */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
            <p className="font-semibold text-base mb-1">
              {alumno.apellido}, {alumno.nombre}
            </p>
            <p className="text-amber-800">
              DNI: <span className="font-medium">{alumno.dni}</span>
            </p>
            <p className="text-xs text-amber-700 mt-2">
              El alumno quedará habilitado temporalmente sin haber registrado un cobro.
            </p>
          </div>

          <div className="space-y-4">
            {/* FECHA PROMESA DE PAGO */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Promesa de Pago <span className="text-gray-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="date"
                name="fecha_promesa_pago"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Si se especifica, servirá para auditar vencimientos automáticos.
              </p>
            </div>

            {/* OBSERVACIONES */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones / Nota <span className="text-gray-400 font-normal">(Opcional)</span>
              </label>
              <textarea
                name="observaciones"
                rows={3}
                placeholder="Ej: Prometió pagar el jueves en efectivo cuando viene a entrenar..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Guardando...' : 'Confirmar Estado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}