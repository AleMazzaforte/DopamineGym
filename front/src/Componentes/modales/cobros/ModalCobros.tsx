import { useEffect, useState } from 'react';
import { type Persona } from '../../../services/PersonaService';
import cobroService, { type Cobro } from '../../../services/CobroService';
import { type MetodoCobro, type Periodo } from '../../../services/periodoService';
import { mostrarExito, mostrarError, confirmarExtensionPeriodo } from '../../../lib/swal';
import { getFechaLocal, sumarMeses } from '../../utils/dateUtils';
import { useModalA11y } from '../../../Hooks/useModalA11y';

interface ModalCobroProps {
  open: boolean;
  cobro: Cobro | any | null;
  onClose: () => void;
  onCobroGuardado: () => void;
  alumnoPreseleccionado?: Persona | null;
}

interface DeudaPendiente {
  cobertura_id: number;
  plan_nombre: string;
  fecha_fin: string;
  saldo_pendiente: number;
  precio_aplicado: number;
  total_plan: number;
}

// Valores exactos del ENUM de la BD. Ojo: 'QR' va en mayúsculas.
const METODOS_VALIDOS: MetodoCobro[] = [
  'efectivo', 'transferencia', 'tarjetas', 'QR', 'debito_automatico'
];

const normalizarMetodo = (valor: unknown): MetodoCobro => {
  const v = String(valor ?? '').trim().toLowerCase();
  return METODOS_VALIDOS.find(m => m.toLowerCase() === v) ?? 'efectivo';
};

export default function ModalCobro({
  open,
  cobro,
  onClose,
  onCobroGuardado,
  alumnoPreseleccionado
}: ModalCobroProps) {
  const esEdicion = !!cobro;

  const { dialogRef, handleBackdropClick } = useModalA11y({ open, onClose });

  const [planes, setPlanes] = useState<any[]>([]);
  const [periodoActivo, setPeriodoActivo] = useState<Periodo | null>(null);
  const [periodoVencido, setPeriodoVencido] = useState<Periodo | null>(null);
  const [preguntaMostrada, setPreguntaMostrada] = useState(false);
  const [deudasPendientes, setDeudasPendientes] = useState<DeudaPendiente[]>([]);
  const [deudaSeleccionada, setDeudaSeleccionada] = useState<DeudaPendiente | null>(null);
  const [modoCobro, setModoCobro] = useState<'nuevo' | 'completar_deuda'>('nuevo');

  // ✅ Sin fecha_cobro: la fija el servidor
  const [formData, setFormData] = useState({
    personaId: 0,
    planId: 0,
    monto: '',
    metodo_cobro: 'efectivo' as MetodoCobro,
    fechaInicio: getFechaLocal(),
    fechaFin: getFechaLocal(),
    descripcion: '',
    editarMonto: false,
    descuento: false,
    pagoACuenta: false,
    recargo: false,
  });

  const [enviando, setEnviando] = useState(false);
  const [montoOriginal, setMontoOriginal] = useState<number>(0);

  useEffect(() => {
    if (!open) return;

    setPreguntaMostrada(false);
    setPeriodoActivo(null);
    setPeriodoVencido(null);
    setMontoOriginal(0);
    setDeudasPendientes([]);
    setDeudaSeleccionada(null);
    setModoCobro('nuevo');

    const hoy = getFechaLocal();

    if (cobro) {
      // Modo Edición
      setFormData({
        personaId: cobro.persona_id || 0,
        planId: 0,
        monto: String(cobro.monto || ''),
        metodo_cobro: normalizarMetodo(cobro.metodo_cobro), // ✅ antes .toLowerCase() rompía 'QR'
        fechaInicio: hoy,
        fechaFin: sumarMeses(hoy, 1),
        descripcion: cobro.descripcion || '',
        editarMonto: true,
        descuento: false,
        pagoACuenta: false,
        recargo: false,
      });
    } else {
      // Modo Nuevo Cobro
      setFormData({
        personaId: alumnoPreseleccionado?.id || 0,
        planId: 0,
        monto: '',
        metodo_cobro: 'efectivo',
        fechaInicio: hoy,
        fechaFin: sumarMeses(hoy, 1),
        descripcion: '',
        editarMonto: false,
        descuento: false,
        pagoACuenta: false,
        recargo: false,
      });

      if (alumnoPreseleccionado) {
        cargarDatosModal(alumnoPreseleccionado.id);
      } else {
        cargarPlanesFallback();
      }
    }
  }, [open, cobro, alumnoPreseleccionado]);

  const cargarPlanesFallback = async () => {
    try {
      const datos = await cobroService.getModalData(0);
      setPlanes(datos.planes || []);
    } catch (error) {
      console.error('Error cargando planes:', error);
    }
  };

  const cargarDatosModal = async (personaId: number) => {
    try {
      const data = await cobroService.getModalData(personaId);

      setPlanes(data.planes || []);
      setDeudasPendientes(data.deudasPendientes || []);
      const hoy = getFechaLocal();

      if (data.periodoActivo) {
        setPeriodoActivo(data.periodoActivo);
        setPeriodoVencido(null);
        setMontoOriginal(data.periodoActivo.plan_precio || 0);

        const duracion = data.periodoActivo.plan_duracion_meses || 1;
        const baseFecha = data.periodoActivo.cobertura_fin
          ? data.periodoActivo.cobertura_fin.split('T')[0]
          : hoy;

        setFormData(prev => ({
          ...prev,
          planId: data.periodoActivo.plan_id || 0,
          monto: String(data.periodoActivo.plan_precio || 0),
          fechaInicio: baseFecha,
          fechaFin: sumarMeses(baseFecha, duracion),
        }));
      } else if (data.periodoVencido) {
        setPeriodoVencido(data.periodoVencido);
        setPeriodoActivo(null);
        setMontoOriginal(data.periodoVencido.plan_precio || 0);

        const duracion = data.periodoVencido.plan_duracion_meses || 1;

        setFormData(prev => ({
          ...prev,
          planId: 0,
          monto: String(data.periodoVencido.plan_precio || 0),
          fechaInicio: hoy,
          fechaFin: sumarMeses(hoy, duracion),
        }));
      } else {
        setPeriodoActivo(null);
        setPeriodoVencido(null);
        setFormData(prev => ({ ...prev, planId: 0, monto: '', fechaFin: sumarMeses(hoy, 1) }));
      }
    } catch (error) {
      console.error('Error cargando datos del modal:', error);
      mostrarError('Error', 'No se pudieron cargar los datos del alumno');
    }
  };

  const handlePlanChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const planIdNum = Number(e.target.value);
    const plan = planes.find(p => p.id === planIdNum);
    if (!plan) return;

    const duracion = plan.duracion_meses || 1;
    const nuevaFechaFin = sumarMeses(formData.fechaInicio, duracion);

    setMontoOriginal(plan.precio);
    setFormData(prev => ({
      ...prev,
      planId: planIdNum,
      monto: String(plan.precio),
      fechaFin: nuevaFechaFin,
      editarMonto: false,
      descuento: false,
      pagoACuenta: false,
      recargo: false,
    }));

    if (periodoVencido && !preguntaMostrada && !esEdicion) {
      const { value: respuesta } = await confirmarExtensionPeriodo(periodoVencido.cobertura_fin || '');
      setPreguntaMostrada(true);

      if (respuesta) {
        const nuevaFechaInicio = periodoVencido.cobertura_fin
          ? periodoVencido.cobertura_fin.split('T')[0]
          : getFechaLocal();
        setFormData(prev => ({
          ...prev,
          fechaInicio: nuevaFechaInicio,
          fechaFin: sumarMeses(nuevaFechaInicio, duracion)
        }));
      } else {
        const hoy = getFechaLocal();
        setFormData(prev => ({
          ...prev,
          fechaInicio: hoy,
          fechaFin: sumarMeses(hoy, duracion)
        }));
      }
    }
  };

  const handleDeudaSelect = (deuda: DeudaPendiente) => {
    setDeudaSeleccionada(deuda);
    setModoCobro('completar_deuda');
    setFormData(prev => ({
      ...prev,
      monto: String(deuda.saldo_pendiente),
      descripcion: `Completamiento de deuda - ${deuda.plan_nombre} (vence ${new Date(deuda.fecha_fin).toLocaleDateString('es-AR')})`,
    }));
  };

  const handleVolverANuevoCobro = () => {
    setModoCobro('nuevo');
    setDeudaSeleccionada(null);
    setFormData(prev => ({
      ...prev,
      monto: '',
      descripcion: '',
    }));
  };

  const handleFechaInicioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevaFechaInicio = e.target.value;
    const planActual = planes.find(p => p.id === formData.planId);
    const duracion = planActual ? (planActual.duracion_meses || 1) : 1;

    setFormData(prev => ({
      ...prev,
      fechaInicio: nuevaFechaInicio,
      fechaFin: sumarMeses(nuevaFechaInicio, duracion),
    }));
  };

  const handleFechaFinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, fechaFin: e.target.value }));
  };

  const handleCheckboxChange = (tipo: 'descuento' | 'pagoACuenta' | 'recargo') => {
    setFormData(prev => {
      if (prev[tipo]) {
        return { ...prev, [tipo]: false, editarMonto: false, monto: String(montoOriginal) };
      }
      return {
        ...prev,
        descuento: tipo === 'descuento',
        pagoACuenta: tipo === 'pagoACuenta',
        recargo: tipo === 'recargo',
        editarMonto: true
      };
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true);

    try {
      if (esEdicion) {
        if (!cobro) return;
        await cobroService.update(cobro.id, {
          monto: parseFloat(formData.monto),
          metodo_cobro: formData.metodo_cobro,
          descripcion: formData.descripcion || undefined,
        });
        mostrarExito('¡Cobro actualizado!', 'El registro fue modificado correctamente.');
      } else if (modoCobro === 'completar_deuda' && deudaSeleccionada) {
        await cobroService.completarDeuda(deudaSeleccionada.cobertura_id, {
          monto: parseFloat(formData.monto),
          metodo_cobro: formData.metodo_cobro,
          descripcion: formData.descripcion || undefined,
        });
        mostrarExito('¡Deuda completada!', 'El pago se registró correctamente.');
      } else {
        const montoPagado = parseFloat(formData.monto);
        const esPagoParcial = formData.pagoACuenta && montoPagado < montoOriginal;
        const precioAcordado = (formData.descuento || formData.recargo) ? montoPagado : montoOriginal;

        let descripcionFinal = formData.descripcion || '';
        if (esPagoParcial) {
          const resta = precioAcordado - montoPagado;
          const textoDeuda = `PAGO PARCIAL. Resta abonar: $${resta.toLocaleString('es-AR')}`;
          descripcionFinal = descripcionFinal ? `${descripcionFinal} | ${textoDeuda}` : textoDeuda;
        }

        await cobroService.create({
          personaId: formData.personaId,
          planId: formData.planId,
          monto: montoPagado,
          metodo_cobro: formData.metodo_cobro,
          fechaInicio: formData.fechaInicio,
          fechaFin: formData.fechaFin,
          descripcion: descripcionFinal.trim(),
          precio_acordado: precioAcordado,
          es_pago_parcial: esPagoParcial,
        });

        mostrarExito('¡Cobro registrado!', 'El cobro y pase fueron creados exitosamente.');
      }
      onCobroGuardado();
      onClose();
    } catch (error: any) {
      mostrarError('Error', error.message || 'Error al guardar el cobro');
    } finally {
      setEnviando(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto outline-none"
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 id="modal-title" className="text-xl font-bold text-gray-800">
            {esEdicion ? 'Editar Cobro' : modoCobro === 'completar_deuda' ? 'Completar Deuda' : 'Registrar Cobro'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            aria-label="Cerrar modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!esEdicion && alumnoPreseleccionado && (
            <div className={`p-4 rounded-lg border ${periodoActivo ? 'bg-green-50 border-green-200' : periodoVencido ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
              <p className={`text-sm font-medium mb-2 flex items-center gap-2 ${periodoActivo ? 'text-green-900' : periodoVencido ? 'text-amber-900' : 'text-blue-900'}`}>
                {periodoActivo ? <><span>✓</span> Período Activo - Extensión</> : periodoVencido ? <><span>⚠</span> Período Vencido</> : <><span>👤</span> Alumno Nuevo / Sin Período Activo</>}
              </p>

              <div className={`text-sm space-y-1 ${periodoActivo ? 'text-green-800' : periodoVencido ? 'text-amber-800' : 'text-blue-800'}`}>
                <p><strong>Alumno:</strong> {alumnoPreseleccionado.apellido}, {alumnoPreseleccionado.nombre} (DNI: {alumnoPreseleccionado.dni})</p>

                {periodoActivo && (
                  <>
                    <p><strong>Plan vigente:</strong> {periodoActivo.plan_nombre || 'Sin plan'}</p>
                    <p><strong>Vence:</strong> {periodoActivo.cobertura_fin ? new Date(periodoActivo.cobertura_fin.split('T')[0] + 'T00:00:00').toLocaleDateString('es-AR') : 'Indeterminado'}</p>
                  </>
                )}

                {periodoVencido && (
                  <>
                    <p><strong>Plan anterior:</strong> {periodoVencido.plan_nombre || 'Sin plan'}</p>
                    <p><strong>Venció:</strong> {periodoVencido.cobertura_fin ? new Date(periodoVencido.cobertura_fin.split('T')[0] + 'T00:00:00').toLocaleDateString('es-AR') : '-'}</p>
                  </>
                )}

                {!periodoActivo && !periodoVencido && (
                  <p className="text-xs mt-2 border-t border-blue-200 pt-2">Selecciona un plan para continuar.</p>
                )}
              </div>
            </div>
          )}

          {!esEdicion && deudasPendientes?.length > 0 && modoCobro === 'nuevo' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-900 mb-2 flex items-center gap-2"><span>⚠️</span> Deudas pendientes detectadas</h3>
              <div className="space-y-2">
                {deudasPendientes.map((deuda) => (
                  <div key={deuda.cobertura_id} className="bg-white p-3 rounded border border-red-100">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{deuda.plan_nombre}</p>
                        <p className="text-xs text-gray-500">Vence: {new Date(deuda.fecha_fin).toLocaleDateString('es-AR')}</p>
                      </div>
                      <span className="text-sm font-bold text-red-600">${parseFloat(`${deuda.saldo_pendiente}`).toLocaleString('es-AR')}</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => handleDeudaSelect(deuda)}
                        className="flex-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                      >
                        Completar esta deuda
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!esEdicion && modoCobro === 'completar_deuda' && deudaSeleccionada && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-amber-900">Completando deuda</h3>
                  <p className="text-xs text-amber-700">{deudaSeleccionada.plan_nombre}</p>
                  <p className="text-xs text-amber-700">Vence: {new Date(deudaSeleccionada.fecha_fin).toLocaleDateString('es-AR')}</p>
                </div>
                <button
                  type="button"
                  onClick={handleVolverANuevoCobro}
                  className="text-xs text-amber-600 hover:text-amber-800 underline"
                >
                  Volver a nuevo cobro
                </button>
              </div>
              <div className="mt-3 pt-3 border-t border-amber-200 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-amber-800">Total del plan:</span><span className="font-medium">${deudaSeleccionada.total_plan.toLocaleString('es-AR')}</span></div>
                <div className="flex justify-between"><span className="text-amber-800">Ya pagado:</span><span className="font-medium">${deudaSeleccionada.precio_aplicado.toLocaleString('es-AR')}</span></div>
                <div className="flex justify-between text-amber-900 font-bold"><span>Saldo pendiente:</span><span>${deudaSeleccionada.saldo_pendiente.toLocaleString('es-AR')}</span></div>
              </div>
            </div>
          )}

          {!esEdicion && modoCobro === 'nuevo' && (
            <div>
              <label htmlFor="plan-select" className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
              <select
                id="plan-select"
                value={formData.planId || ''}
                onChange={handlePlanChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Seleccione un plan...</option>
                {planes.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.nombre} ({plan.duracion_meses === 1 ? '1 mes' : `${plan.duracion_meses} meses`}) - ${Number(plan.precio).toLocaleString('es-AR')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!esEdicion && modoCobro === 'nuevo' && formData.planId > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="fechaInicio" className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio *</label>
                <input
                  id="fechaInicio"
                  type="date"
                  name="fechaInicio"
                  value={formData.fechaInicio}
                  onChange={handleFechaInicioChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="fechaFin" className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin *</label>
                <input
                  id="fechaFin"
                  type="date"
                  name="fechaFin"
                  value={formData.fechaFin}
                  onChange={handleFechaFinChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  title="Calculada automáticamente según la duración del plan"
                />
              </div>
            </div>
          )}

          {/* ✅ Solo el monto. La fecha de cobro la fija el servidor. */}
          <div>
            <label htmlFor="monto" className="block text-sm font-medium text-gray-700 mb-1">Monto ($) *</label>
            <input
              id="monto"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              name="monto"
              value={formData.monto}
              onChange={handleChange}
              required
              disabled={modoCobro === 'completar_deuda'}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${modoCobro === 'completar_deuda' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
          </div>

          {!esEdicion && modoCobro === 'nuevo' && formData.planId > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Modificar monto:</p>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.descuento}
                    onChange={() => handleCheckboxChange('descuento')}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Aplicar precio especial</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.pagoACuenta}
                    onChange={() => handleCheckboxChange('pagoACuenta')}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Pago a cuenta (genera deuda)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.recargo}
                    onChange={() => handleCheckboxChange('recargo')}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Incluye recargo</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formData.descuento && 'Se registrará como precio final acordado (sin deuda).'}
                {formData.pagoACuenta && parseFloat(formData.monto) < montoOriginal && 'Se registrará el saldo pendiente para futuros pagos.'}
                {formData.recargo && 'Se registrará como precio final acordado (sin deuda).'}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="metodo_cobro" className="block text-sm font-medium text-gray-700 mb-1">Método de cobro *</label>
            <select
              id="metodo_cobro"
              name="metodo_cobro"
              value={formData.metodo_cobro || 'efectivo'}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjetas">Tarjetas (Débito/Crédito)</option>
              <option value="QR">QR / MercadoPago</option>
              <option value="debito_automatico">Débito Automático</option>
            </select>
          </div>

          <div>
            <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 mb-1">Descripción / Observaciones</label>
            <textarea
              id="descripcion"
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows={2}
              placeholder={modoCobro === 'completar_deuda' ? 'Descripción automática del completamiento' : 'Ej: Cambio de plan, pago de cuota mensual...'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors"
            >
              {enviando ? 'Guardando...' : esEdicion ? 'Actualizar Cobro' : modoCobro === 'completar_deuda' ? 'Completar Deuda' : 'Registrar Cobro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}