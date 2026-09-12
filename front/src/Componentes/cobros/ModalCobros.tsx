import { useEffect, useState, useRef } from 'react';
import { type Persona } from '../../services/PersonaService';
import cobroService, { type Cobro } from '../../services/CobroService';
import planService, { type Plan } from '../../services/PlanService';
import periodoService, { type MetodoCobro, type Periodo } from '../../services/periodoService';
import { mostrarExito, mostrarError, confirmarExtensionPeriodo } from '../../lib/swal';

interface ModalCobroProps {
  open: boolean;
  cobro: Cobro | any | null;
  onClose: () => void;
  onCobroGuardado: () => void;
  alumnoPreseleccionado?: Persona | null;
}

const getFechaLocal = (fecha?: Date) => {
  const d = fecha ? new Date(fecha) : new Date();
  return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

export default function ModalCobro({ open, cobro, onClose, onCobroGuardado, alumnoPreseleccionado }: ModalCobroProps) {
  let esEdicion = !!cobro;
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [periodoActivo, setPeriodoActivo] = useState<Periodo | null>(null);
  const [periodoVencido, setPeriodoVencido] = useState<Periodo | null>(null);
  const [preguntaMostrada, setPreguntaMostrada] = useState(false);
  
  const planesCargadosRef = useRef(false);

  const [formData, setFormData] = useState({
    personaId: 0,
    planId: 0,
    fecha_cobro: getFechaLocal(),
    monto: '',
    metodo_cobro: 'efectivo' as MetodoCobro,
    fechaInicio: getFechaLocal(),
    fechaFin: getFechaLocal(new Date(new Date().setMonth(new Date().getMonth() + 1))),
    descripcion: '',
    editarMonto: false,
    descuento: false,
    pagoACuenta: false,
    recargo: false,
  });
  
  const [enviando, setEnviando] = useState(false);
  const [montoOriginal, setMontoOriginal] = useState<number>(0);

  useEffect(() => {
    if (open) {
      setPreguntaMostrada(false);
      setPeriodoActivo(null);
      setPeriodoVencido(null);
      setMontoOriginal(0);
      
      const hoy = getFechaLocal();
      const unMesDate = new Date();
      unMesDate.setMonth(unMesDate.getMonth() + 1);
      const unMes = getFechaLocal(unMesDate);

      if (cobro) {
        // MODO EDICIÓN
        const metodoNormalizado = (cobro.metodo_cobro || 'efectivo').toLowerCase() as MetodoCobro;
        setFormData({
          personaId: cobro.persona_id || 0,
          planId: 0,
          fecha_cobro: cobro.fecha_cobro ? cobro.fecha_cobro.split('T')[0] : hoy,
          monto: String(cobro.monto || ''),
          metodo_cobro: metodoNormalizado as MetodoCobro,
          fechaInicio: hoy,
          fechaFin: unMes,
          descripcion: cobro.descripcion || '',
          editarMonto: true,
          descuento: false,
          pagoACuenta: false,
          recargo: false,
        });
      } else {
        // MODO NUEVO COBRO
        setFormData({
          personaId: alumnoPreseleccionado ? alumnoPreseleccionado.id : 0,
          planId: 0,
          fecha_cobro: hoy,
          monto: '',
          metodo_cobro: 'efectivo' as MetodoCobro,
          fechaInicio: hoy,
          fechaFin: unMes,
          descripcion: '',
          editarMonto: false,
          descuento: false,
          pagoACuenta: false,
          recargo: false,
        });

        if (alumnoPreseleccionado) {
          verificarPeriodos(alumnoPreseleccionado.id);
        }
      }

      if (!planesCargadosRef.current) {
        cargarPlanes();
        planesCargadosRef.current = true;
      }
    }
  }, [open, cobro, alumnoPreseleccionado]);

  const cargarPlanes = async () => {
    try {
      const datos = await planService.getAllActivos();
      setPlanes(datos);
    } catch (error) {
      console.error('Error cargando planes:', error);
    }
  };

  const calcularFechaMasMes = (fecha: string): string => {
    if (!fecha || fecha === 'null' || fecha === 'undefined') {
      fecha = getFechaLocal();
    }
    const fechaDate = new Date(fecha + 'T00:00:00'); 
    if (isNaN(fechaDate.getTime())) {
      fechaDate.setTime(Date.now());
    }
    
    const diaOriginal = fechaDate.getDate();
    fechaDate.setMonth(fechaDate.getMonth() + 1);
    
    if (fechaDate.getDate() !== diaOriginal) {
      fechaDate.setDate(0); 
    }
    
    return getFechaLocal(fechaDate);
  };

  const verificarPeriodos = async (personaId: number) => {
    const hoy = getFechaLocal();
    
    try {
      let activo = await periodoService.getPeriodoActivo(personaId);
      let ultimo: Periodo | null = null;

      if (!activo) {
        ultimo = await periodoService.getUltimoPeriodo(personaId);
        
        if (ultimo && ultimo.fecha_fin) {
          const fechaFinStr = ultimo.fecha_fin.split('T')[0];
          if (fechaFinStr >= hoy) {
            activo = ultimo;
            ultimo = null;
          }
        }
      }

      // CASO A: PERÍODO ACTIVO
      if (activo) {
        setPeriodoActivo(activo);
        setPeriodoVencido(null);
        
        const precioPlan = activo.plan_precio || 0;
        const planId = activo.plan_id || 0;
        const baseFecha = activo.fecha_fin ? activo.fecha_fin.split('T')[0] : hoy;
        const fechaFinCalculada = calcularFechaMasMes(baseFecha);
        
        setMontoOriginal(precioPlan);
        setFormData(prev => ({
          ...prev,
          planId, // 👈 Pre-selecciona el plan en el select
          monto: String(precioPlan),
          fechaInicio: baseFecha,
          fechaFin: fechaFinCalculada,
        }));
        return; 
      }

      // CASO B: PERÍODO VENCIDO
      if (ultimo) {
        setPeriodoVencido(ultimo);
        setPeriodoActivo(null);
        
        const precioPlan = ultimo.plan_precio || 0;
        
        setMontoOriginal(precioPlan);
        setFormData(prev => ({
          ...prev,
          planId: 0, // 👈 Select vacío para que elija de nuevo
          monto: String(precioPlan),
          fechaInicio: hoy,
          fechaFin: calcularFechaMasMes(hoy),
        }));
      } else {
        // CASO C: ALUMNO NUEVO
        setPeriodoActivo(null);
        setPeriodoVencido(null);
        setFormData(prev => ({
          ...prev,
          planId: 0,
          monto: '',
          fechaInicio: hoy,
          fechaFin: calcularFechaMasMes(hoy),
        }));
      }
    } catch (error: any) {
      mostrarError('Error', error.message || 'Error al verificar períodos');
    }
  };

  const handlePlanChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const planIdNum = Number(e.target.value);
    const plan = planes.find(p => p.id === planIdNum);
    if (!plan) return;

    setMontoOriginal(plan.precio);
    setFormData(prev => ({
      ...prev,
      planId: planIdNum,
      monto: String(plan.precio),
      editarMonto: false,
      descuento: false,
      pagoACuenta: false,
      recargo: false,
    }));

    if (periodoVencido && !preguntaMostrada && !esEdicion) {
      const { value: respuesta } = await confirmarExtensionPeriodo(periodoVencido.fecha_fin || '');
      setPreguntaMostrada(true);

      if (respuesta) {
        const nuevaFechaInicio = periodoVencido.fecha_fin ? periodoVencido.fecha_fin.split('T')[0] : getFechaLocal();
        setFormData(prev => ({ ...prev, fechaInicio: nuevaFechaInicio, fechaFin: calcularFechaMasMes(nuevaFechaInicio) }));
      } else {
        const hoy = getFechaLocal();
        setFormData(prev => ({ ...prev, fechaInicio: hoy, fechaFin: calcularFechaMasMes(hoy) }));
      }
    }
  };

  const handleFechaInicioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevaFechaInicio = e.target.value;
    setFormData(prev => ({
      ...prev,
      fechaInicio: nuevaFechaInicio,
      fechaFin: calcularFechaMasMes(nuevaFechaInicio),
    }));
  };

  const handleFechaFinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, fechaFin: e.target.value }));
  };

  const handleCheckboxChange = (tipo: 'descuento' | 'pagoACuenta' | 'recargo') => {
    setFormData(prev => {
      const nuevoEstado = { ...prev, [tipo]: !prev[tipo], editarMonto: true };
      if (!nuevoEstado.descuento && !nuevoEstado.pagoACuenta && !nuevoEstado.recargo) {
        return { ...nuevoEstado, editarMonto: false, monto: String(montoOriginal) };
      }
      return nuevoEstado;
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
          fecha_cobro: formData.fecha_cobro,
          monto: parseFloat(formData.monto),
          metodo_cobro: formData.metodo_cobro,
          descripcion: formData.descripcion || null,
        });

        mostrarExito('¡Cobro actualizado!', 'El registro fue modificado correctamente.');
      } else {
        await cobroService.create({
          personaId: formData.personaId,
          planId: formData.planId,
          monto: parseFloat(formData.monto),
          MetodoCobro: formData.metodo_cobro,
          fechaCobro: formData.fecha_cobro,
          fechaInicio: formData.fechaInicio,
          fechaFin: formData.fechaFin,
          descripcion: formData.descripcion,
          precio_aplicado: montoOriginal,
        });
        mostrarExito('¡Cobro registrado!', 'El cobro y pase fueron creados exitosamente.');
      }
      onCobroGuardado();
    } catch (error: any) {
      mostrarError('Error', error.message || 'Error al guardar el cobro');
    } finally {
      setEnviando(false);
      esEdicion = cobro;
    }
  };

  if (!open) return null;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-800">
            {esEdicion ? 'Editar Cobro' : 'Registrar Cobro'}
          </h2>
          <button onClick={() => {
                onClose();
                esEdicion = cobro;
              }
              } className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 👈 TARJETA UNIFICADA DE ALUMNO (cambia de color según el estado) */}
{!esEdicion && alumnoPreseleccionado && (
  <div
    className={`p-4 rounded-lg border ${
      periodoActivo
        ? 'bg-green-50 border-green-200'
        : periodoVencido
        ? 'bg-amber-50 border-amber-200'
        : 'bg-blue-50 border-blue-200'
    }`}
  >
    {/* Cabecera según estado */}
    <p
      className={`text-sm font-medium mb-2 flex items-center gap-2 ${
        periodoActivo
          ? 'text-green-900'
          : periodoVencido
          ? 'text-amber-900'
          : 'text-blue-900'
      }`}
    >
      {periodoActivo ? (
        <>
          <span>✓</span> Período Activo - Extensión
        </>
      ) : periodoVencido ? (
        <>
          <span>⚠</span> Período Vencido
        </>
      ) : (
        <>
          <span>👤</span> Alumno Nuevo / Sin Período Activo
        </>
      )}
    </p>

    {/* Datos del alumno (siempre visibles) */}
    <div
      className={`text-sm space-y-1 ${
        periodoActivo
          ? 'text-green-800'
          : periodoVencido
          ? 'text-amber-800'
          : 'text-blue-800'
      }`}
    >
      <p>
        <strong>Alumno:</strong> {alumnoPreseleccionado.apellido},{' '}
        {alumnoPreseleccionado.nombre} (DNI: {alumnoPreseleccionado.dni})
      </p>

      {/* Info del período activo */}
      {periodoActivo && (
        <>
          <p>
            <strong>Plan vigente:</strong> {periodoActivo.plan_nombre || 'Sin plan'}
          </p>
          <p>
            <strong>Vence:</strong>{' '}
            {periodoActivo.fecha_fin
              ? new Date(
                  periodoActivo.fecha_fin.split('T')[0] + 'T00:00:00'
                ).toLocaleDateString('es-AR')
              : 'Indeterminado'}
          </p>
          <p className="text-xs mt-2  border-t border-green-200 pt-2">
            ℹ️ El plan está pre-seleccionado abajo. Puedes cambiarlo si el
            alumno desea actualizar su plan.
          </p>
        </>
      )}

      {/* Info del período vencido */}
      {periodoVencido && (
        <>
          <p>
            <strong>Plan anterior:</strong>{' '}
            {periodoVencido.plan_nombre || 'Sin plan'}
          </p>
          <p>
            <strong>Venció:</strong>{' '}
            {periodoVencido.fecha_fin
              ? new Date(
                  periodoVencido.fecha_fin.split('T')[0] + 'T00:00:00'
                ).toLocaleDateString('es-AR')
              : '-'}
          </p>
        </>
      )}

      {/* Mensaje para alumno sin período */}
      {!periodoActivo && !periodoVencido && (
        <p className="text-xs mt-2 border-t border-blue-200 pt-2">
          ️ Selecciona un plan abajo para comenzar su cobertura.
        </p>
      )}
    </div>
  </div>
)}

          {/* 👈 SELECT DE PLAN */}
          {!esEdicion && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
              <select
                value={formData.planId || ''}
                onChange={handlePlanChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Seleccione un plan...</option>
                {planes.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.nombre} - ${Number(plan.precio).toLocaleString('es-AR')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* FECHAS DE COBERTURA DEL PLAN (SÓLO CREACIÓN) */}
          {!esEdicion && formData.planId > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio *</label>
                <input
                  type="date"
                  name="fechaInicio"
                  value={formData.fechaInicio}
                  onChange={handleFechaInicioChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin *</label>
                <input
                  type="date"
                  name="fechaFin"
                  value={formData.fechaFin}
                  onChange={handleFechaFinChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* FECHA Y MONTO */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de cobro *</label>
              <input
                type="date"
                name="fecha_cobro"
                value={formData.fecha_cobro}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto ($) *</label>
              <input
                type="number"
                step="0.01"
                name="monto"
                value={formData.monto}
                onChange={handleChange}
                required
                disabled={!esEdicion && !formData.editarMonto}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  !esEdicion && !formData.editarMonto ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
            </div>
          </div>

          {/* OPCIONES DE MODIFICACIÓN DE MONTO (SÓLO CREACIÓN) */}
          {!esEdicion && formData.planId > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Modificar monto:</p>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.descuento}
                    onChange={() => handleCheckboxChange('descuento')}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Descuento</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.pagoACuenta}
                    onChange={() => handleCheckboxChange('pagoACuenta')}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Pago a cuenta</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.recargo}
                    onChange={() => handleCheckboxChange('recargo')}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Recargo</span>
                </label>
              </div>
            </div>
          )}

          {/* MÉTODO DE PAGO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de cobro *</label>
            <select
              name="metodo_cobro"
              value={formData.metodo_cobro || 'efectivo'}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="DEBITO">Débito</option>
              <option value="CREDITO">Crédito</option>
              <option value="QR">QR / MercadoPago</option>
            </select>
          </div>

          {/* DESCRIPCIÓN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Observaciones</label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows={2}
              placeholder="Ej: Cambio de plan, pago de cuota mensual..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* BOTONES */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={() => {
                onClose();
                esEdicion = cobro;
              }
              }
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors"
            >
              {enviando ? 'Guardando...' : esEdicion ? 'Actualizar Cobro' : 'Registrar Cobro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}