import { useEffect, useState, useRef } from 'react';
import { type Persona } from '../../services/PersonaService';
import { cobroService, type Cobro } from '../../services/CobroService';
import planService, { type Plan } from '../../services/PlanService';
import periodoService, { type MetodoCobro, type Periodo } from '../../services/periodoService';
import { mostrarExito, mostrarError, confirmarExtensionPeriodo } from '../../lib/swal';

interface ModalCobroProps {
  open: boolean;
  cobro: Cobro | null;
  onClose: () => void;
  onCobroGuardado: () => void;
  alumnoPreseleccionado?: Persona | null;
}

const getFechaLocal = (fecha?: Date) => {
  const d = fecha ? new Date(fecha) : new Date();
  return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

export default function ModalCobro({ open, cobro, onClose, onCobroGuardado, alumnoPreseleccionado }: ModalCobroProps) {
  const esEdicion = !!cobro;
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

      setFormData({
        personaId: 0,
        planId: 0,
        fecha_cobro: hoy,
        monto: '',
        metodo_cobro: 'efectivo',
        fechaInicio: hoy,
        fechaFin: unMes,
        descripcion: '',
        editarMonto: false,
        descuento: false,
        pagoACuenta: false,
        recargo: false,
      });

      if (!planesCargadosRef.current) {
        cargarPlanes();
        planesCargadosRef.current = true;
      }

      if (cobro) {
        setFormData(prev => ({
          ...prev,
          fecha_cobro: cobro.fecha_cobro ? cobro.fecha_cobro.split('T')[0] : hoy,
          monto: String(cobro.monto),
          metodo_cobro: cobro.metodo_cobro,
          descripcion: cobro.descripcion || '',
        }));
      } else if (alumnoPreseleccionado) {
        setFormData(prev => ({ ...prev, personaId: alumnoPreseleccionado.id }));
        verificarPeriodos(alumnoPreseleccionado.id); 
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
      // 1. Intentamos obtener el período activo
      let activo = await periodoService.getPeriodoActivo(personaId);
      let ultimo: Periodo | null = null;

      // 2. Si no trajo activo, buscamos el último registrado
      if (!activo) {
        ultimo = await periodoService.getUltimoPeriodo(personaId);
        
        // CORRECCIÓN CLAVE: Validar si la fecha del "último" es en realidad futura o actual
        if (ultimo && ultimo.fecha_fin) {
          const fechaFinStr = ultimo.fecha_fin.split('T')[0];
          if (fechaFinStr >= hoy) {
            // Si la fecha de fin es mayor o igual a hoy, ESTÁ ACTIVO
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
          planId,
          monto: String(precioPlan),
          fechaInicio: baseFecha,
          fechaFin: fechaFinCalculada,
        }));
        return; 
      }

      // CASO B: PERÍODO VENCIDO (fecha_fin < hoy)
      if (ultimo) {
        setPeriodoVencido(ultimo);
        setPeriodoActivo(null);
        
        const precioPlan = ultimo.plan_precio || 0;
        const planId = ultimo.plan_id || 0;
        
        setMontoOriginal(precioPlan);
        setFormData(prev => ({
          ...prev,
          planId,
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

  const handleSubmit = async (e: React.FormEvent) => {
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
        mostrarExito('¡Cobro actualizado!');
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
        });
        mostrarExito('¡Cobro registrado!');
      }
      onCobroGuardado();
    } catch (error: any) {
      mostrarError('Error', error.message || 'Error al guardar el cobro');
    } finally {
      setEnviando(false);
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!esEdicion && alumnoPreseleccionado && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900 font-medium">Alumno:</p>
              <p className="text-lg font-bold text-blue-900">
                {alumnoPreseleccionado.apellido}, {alumnoPreseleccionado.nombre}
              </p>
              <p className="text-sm text-blue-700">DNI: {alumnoPreseleccionado.dni}</p>
            </div>
          )}

          {periodoActivo && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-900 mb-2">✓ Período Activo - Extensión</p>
              <div className="text-xs text-green-800 space-y-1">
                <p><strong>Plan:</strong> {periodoActivo.plan_nombre || 'Sin plan'}</p>
                <p><strong>Vence:</strong> {periodoActivo.fecha_fin ? new Date(periodoActivo.fecha_fin.split('T')[0] + 'T00:00:00').toLocaleDateString('es-AR') : 'Indeterminado'}</p>
              </div>
            </div>
          )}

          {periodoVencido && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-sm font-medium text-yellow-900 mb-2">⚠ Período Vencido</p>
              <div className="text-xs text-yellow-800 space-y-1">
                <p><strong>Plan anterior:</strong> {periodoVencido.plan_nombre || 'Sin plan'}</p>
                <p><strong>Venció:</strong> {periodoVencido.fecha_fin ? new Date(periodoVencido.fecha_fin.split('T')[0] + 'T00:00:00').toLocaleDateString('es-AR') : '-'}</p>
              </div>
            </div>
          )}

          {!esEdicion && !periodoActivo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
              <select
                value={formData.planId || ''}
                onChange={handlePlanChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccione un plan...</option>
                {planes.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.nombre} - ${Number(plan.precio).toLocaleString('es-AR')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!esEdicion && formData.planId > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio *</label>
                <input type="date" name="fechaInicio" value={formData.fechaInicio} onChange={handleFechaInicioChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin *</label>
                <input type="date" name="fechaFin" value={formData.fechaFin} onChange={handleFechaFinChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de cobro *</label>
              <input type="date" name="fecha_cobro" value={formData.fecha_cobro} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto ($) *</label>
              <input type="number" step="0.01" name="monto" value={formData.monto} onChange={handleChange} required disabled={!formData.editarMonto} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${!formData.editarMonto ? 'bg-gray-100 cursor-not-allowed' : ''}`} />
            </div>
          </div>

          {!esEdicion && formData.planId > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Modificar monto:</p>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.descuento} onChange={() => handleCheckboxChange('descuento')} className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Descuento</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.pagoACuenta} onChange={() => handleCheckboxChange('pagoACuenta')} className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Pago a cuenta</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.recargo} onChange={() => handleCheckboxChange('recargo')} className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Recargo</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de cobro *</label>
            <select name="metodo_cobro" value={formData.metodo_cobro} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjetas">Tarjetas</option>
              <option value="QR">QR</option>
              <option value="debito_automatico">Débito Automático</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea name="descripcion" value={formData.descripcion} onChange={handleChange} rows={2} placeholder="Observaciones opcionales..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={enviando} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {enviando ? 'Guardando...' : esEdicion ? 'Actualizar' : 'Registrar Cobro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}