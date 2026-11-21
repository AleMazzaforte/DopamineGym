import { useState, useEffect } from 'react';
import personaService, { type PersonaConEstado } from '../../services/PersonaService';
import { mostrarExito, mostrarError, confirmarCambio } from '../../lib/swal';
import { getFechaLocal } from '../utils/dateUtils';
import { useModalA11y } from '../../hooks/useModalA11y';

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
  const [hayCambiosSinGuardar, setHayCambiosSinGuardar] = useState(false);

  // Fecha de hoy calculada una sola vez por render para usarla en validación y atributo min
  const hoyLocal = getFechaLocal();

  // Hook que provee el ref del diálogo y el handler de clic en backdrop
  const { dialogRef, handleBackdropClick } = useModalA11y({ open, onClose });

  // Detecta si el alumno ya está en estado provisorio para pre-llenar el formulario
  const yaEsProvisorio = alumno?.estado === 'ACTIVO PROVISORIO';
  // Detecta si el alumno tiene un plan activo vigente para mostrar advertencia
  const tienePlanVigente = alumno?.estado === 'ACTIVO';

  // Resetea la bandera de cambios sin guardar cada vez que se abre el modal
  useEffect(() => {
    if (open) {
      setHayCambiosSinGuardar(false);
    }
  }, [open, alumno?.id]);

  if (!open || !alumno) return null;

  const handleClose = async () => {
    // Si hay texto escrito y el usuario intenta cerrar, pide confirmación
    if (hayCambiosSinGuardar) {
      const confirmado = await confirmarCambio(
        'Descartar cambios',
        'Tienes texto sin guardar. ¿Seguro que quieres cerrar?'
      );
      if (!confirmado) return;
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const fechaPromesa = formData.get('fecha_promesa_pago') as string;
    const observaciones = formData.get('observaciones') as string;

    // Bloquea el envío si la fecha de promesa es anterior a hoy
    if (fechaPromesa && fechaPromesa < hoyLocal) {
      mostrarError(
        'Fecha inválida',
        'La fecha de promesa de pago no puede ser anterior al día de hoy.'
      );
      return;
    }

    // Si el alumno tiene plan vigente, exige una nota justificando el cambio
    if (tienePlanVigente && !observaciones?.trim()) {
      mostrarError(
        'Observaciones requeridas',
        'El alumno tiene un plan activo. Debes justificar por qué se cambia a provisorio.'
      );
      return;
    }

    try {
      setLoading(true);

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
      setHayCambiosSinGuardar(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-provisorio-title"
        tabIndex={-1}
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto outline-none"
      >
        {/* Encabezado del modal */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">⏳</span>
            <h2 id="modal-provisorio-title" className="text-xl font-bold text-gray-800">
              Activar Estado Provisorio
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            aria-label="Cerrar modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Ficha del alumno con su estado actual */}
          <div className={`rounded-lg p-4 text-sm border ${
            tienePlanVigente
              ? 'bg-green-50 border-green-200 text-green-900'
              : yaEsProvisorio
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}>
            <p className="font-semibold text-base mb-1">
              {alumno.apellido}, {alumno.nombre}
            </p>
            <p className="opacity-90">
              DNI: <span className="font-medium">{alumno.dni}</span>
            </p>
            <p className="text-xs mt-2 opacity-80">
              Estado actual: <strong>{alumno.estado}</strong>
            </p>

            {/* Advertencia contextual según el estado del alumno */}
            {tienePlanVigente && (
              <p className="text-xs mt-2 pt-2 border-t border-green-200">
                ⚠️ Este alumno tiene un plan vigente. Al activar provisorio,
                el sistema registrará un nuevo estado que reemplazará al actual
                en la vista de estados. Debes justificar el cambio.
              </p>
            )}

            {yaEsProvisorio && (
              <p className="text-xs mt-2 pt-2 border-t border-amber-200">
                📝 El alumno ya está en provisorio. Esta acción actualizará
                la fecha de promesa y las observaciones.
              </p>
            )}

            {!tienePlanVigente && !yaEsProvisorio && (
              <p className="text-xs mt-2 opacity-80">
                El alumno quedará habilitado temporalmente sin haber registrado un cobro.
              </p>
            )}
          </div>

          <div className="space-y-4">
            {/* Fecha de promesa de pago */}
            <div>
              <label
                htmlFor="fecha_promesa_pago"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Fecha Promesa de Pago <span className="text-gray-400 font-normal">(Opcional)</span>
              </label>
              <input
                id="fecha_promesa_pago"
                type="date"
                name="fecha_promesa_pago"
                min={hoyLocal}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Si se especifica, la vista de estados marcará al alumno como
                INACTIVO automáticamente al vencer esa fecha.
              </p>
            </div>

            {/* Observaciones del operador */}
            <div>
              <label
                htmlFor="observaciones"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Observaciones / Nota{' '}
                {tienePlanVigente && <span className="text-red-600">*</span>}
              </label>
              <textarea
                id="observaciones"
                name="observaciones"
                rows={3}
                placeholder={
                  tienePlanVigente
                    ? 'Obligatorio: ej. "El alumno pidió cambio de plan y se activó provisorio mientras..." '
                    : 'Ej: Prometió pagar el jueves en efectivo cuando viene a entrenar...'
                }
                onChange={() => setHayCambiosSinGuardar(true)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={handleClose}
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