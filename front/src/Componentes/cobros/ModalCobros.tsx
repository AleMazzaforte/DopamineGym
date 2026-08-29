import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import personaService, { type Persona } from '../../services/PersonaService';
import { cobroService, type Cobro } from '../../services/CobroService';
import planService, { type Plan } from '../../services/PlanService';
import { type MetodoCobro } from '../../services/periodoService';
import Swal from 'sweetalert2';

interface ModalCobroProps {
  open: boolean;
  cobro: Cobro | null;
  onClose: () => void;
  onCobroGuardado: () => void;
  alumnoPreseleccionado?: Persona | null;
}

export default function ModalCobro({ open, cobro, onClose, onCobroGuardado, alumnoPreseleccionado }: ModalCobroProps) {
  const esEdicion = !!cobro;
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [periodoActivo, setPeriodoActivo] = useState<any>(null);
  const [periodoVencido, setPeriodoVencido] = useState<any>(null);
  const [preguntaMostrada, setPreguntaMostrada] = useState(false);
  
  const [formData, setFormData] = useState({
    personaId: '',
    planId: '',
    fecha_cobro: new Date().toISOString().split('T')[0],
    monto: '',
    metodo_cobro: 'efectivo' as MetodoCobro,
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFin: new Date(new Date().setMonth(new Date().getMonth())).toISOString().split('T')[0],
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
      cargarPlanes();
      setPreguntaMostrada(false);

      if (alumnoPreseleccionado) {
        setFormData(prev => ({ 
          ...prev, 
          personaId: alumnoPreseleccionado.id,
          fecha_cobro: new Date().toISOString().split('T')[0],
        }));
        verificarPeriodos(alumnoPreseleccionado.id);
      }

      if (cobro) {
        setFormData({
          personaId: '',
          planId: '',
          fecha_cobro: cobro.fecha_cobro,
          monto: String(cobro.monto),
          metodo_cobro: cobro.metodo_cobro,
          fechaInicio: new Date().toISOString().split('T')[0],
          fechaFin: new Date(new Date().setMonth(new Date().getMonth())).toISOString().split('T')[0],
          descripcion: cobro.descripcion || '',
          editarMonto: false,
          descuento: false,
          pagoACuenta: false,
          recargo: false,
        });
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

const verificarPeriodos = async (personaId: string) => {
  const hoy = new Date().toISOString().split('T')[0];
  
  try {
    // 1. Buscar período ACTIVO (fecha_fin es null O fecha_fin >= hoy)
    const { data: periodoActivoData } = await (supabase as any)
      .from('periodos_alumno')
      .select(`
        id, fecha_inicio, fecha_fin,
        periodos_cobertura!inner(id, plan:planes(id, nombre, precio))
      `)
      .eq('persona_id', personaId)
      .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
      .order('fecha_fin', { ascending: false, nullsFirst: true })
      .limit(1)
      .maybeSingle();

    if (periodoActivoData) {
      setPeriodoActivo(periodoActivoData);
      setPeriodoVencido(null);
      const precioPlan = periodoActivoData.periodos_cobertura?.[0]?.plan?.precio || 0;
      const planId = periodoActivoData.periodos_cobertura?.[0]?.plan?.id || '';
      
      // Si tiene fecha_fin, usarla como base; si es null, usar hoy
      const baseFecha = periodoActivoData.fecha_fin || hoy;
      const fechaFinCalculada = calcularFechaMasMes(baseFecha);
      
      setMontoOriginal(precioPlan);
      setFormData(prev => ({
        ...prev,
        personaId,
        planId,
        monto: String(precioPlan),
        fechaInicio: baseFecha,
        fechaFin: fechaFinCalculada,
      }));
      return;
    }

    // 2. Buscar período VENCIDO (fecha_fin < hoy)
    const { data: periodoVencidoData } = await (supabase as any)
      .from('periodos_alumno')
      .select(`
        id, fecha_inicio, fecha_fin,
        periodos_cobertura!inner(id, plan:planes(id, nombre, precio))
      `)
      .eq('persona_id', personaId)
      .lt('fecha_fin', hoy)  // 👈 CORRECCIÓN: Solo períodos con fecha_fin < hoy
      .order('fecha_fin', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (periodoVencidoData) {
      setPeriodoVencido(periodoVencidoData);
      setPeriodoActivo(null);
      const precioPlan = periodoVencidoData.periodos_cobertura?.[0]?.plan?.precio || 0;
      const planId = periodoVencidoData.periodos_cobertura?.[0]?.plan?.id || '';
      
      const fechaFinCalculada = calcularFechaMasMes(hoy);
      setMontoOriginal(precioPlan);
      setFormData(prev => ({
        ...prev,
        personaId,
        planId,
        monto: String(precioPlan),
        fechaInicio: hoy,
        fechaFin: fechaFinCalculada,
      }));
    } else {
      setPeriodoActivo(null);
      setPeriodoVencido(null);
      setFormData(prev => ({
        ...prev,
        personaId,
        planId: '',
        monto: '',
        fechaInicio: hoy,
        fechaFin: calcularFechaMasMes(hoy),
      }));
    }
  } catch (error: any) {
    Swal.fire({ icon: 'error', title: 'Error', text: error.message });
  }
};

  const calcularFechaMasMes = (fecha: string): string => {
    if (!fecha || fecha === 'null' || fecha === 'undefined') {
      fecha = new Date().toISOString().split('T')[0];
    }
    const fechaDate = new Date(fecha + 'T00:00:00');
    if (isNaN(fechaDate.getTime())) {
      fechaDate.setTime(Date.now());
    }
    fechaDate.setMonth(fechaDate.getMonth());
    return fechaDate.toISOString().split('T')[0];
  };

  // 👇 NUEVO: Cuando se selecciona un plan y hay período vencido, preguntar
  const handlePlanChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const planId = e.target.value;
    const plan = planes.find(p => p.id === planId);
    if (!plan) return;

    setMontoOriginal(plan.precio);
    setFormData(prev => ({
      ...prev,
      planId,
      monto: String(plan.precio),
      editarMonto: false,
      descuento: false,
      pagoACuenta: false,
      recargo: false,
    }));

    // Si hay período vencido y aún no se mostró la pregunta
    if (periodoVencido && !preguntaMostrada && !esEdicion) {
      const { value: respuesta } = await Swal.fire({
        title: '¿Continuar con el período anterior?',
        html: `
          <div class="text-left">
            <p class="mb-2">El último período venció el <strong>${new Date(periodoVencido.fecha_fin).toLocaleDateString('es-AR')}</strong>.</p>
            <p class="text-sm text-gray-600 mb-4">¿Querés extender ese período o comenzar uno nuevo desde hoy?</p>
            <div class="bg-yellow-50 p-3 rounded text-sm">
              <p><strong>Opción 1 - Continuar:</strong> La fecha de inicio será ${new Date(periodoVencido.fecha_fin).toLocaleDateString('es-AR')} (fecha de vencimiento)</p>
              <p><strong>Opción 2 - Nuevo:</strong> La fecha de inicio será hoy (${new Date().toLocaleDateString('es-AR')})</p>
            </div>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Continuar período anterior',
        cancelButtonText: 'Comenzar nuevo período',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#10b981',
      });

      setPreguntaMostrada(true);

      if (respuesta) {
        // Continuar período anterior: fecha_inicio = fecha_fin del vencido
        const nuevaFechaInicio = periodoVencido.fecha_fin;
        const nuevaFechaFin = calcularFechaMasMes(nuevaFechaInicio);
        setFormData(prev => ({
          ...prev,
          fechaInicio: nuevaFechaInicio,
          fechaFin: nuevaFechaFin,
        }));
      } else {
        // Nuevo período: fecha_inicio = hoy
        const hoy = new Date().toISOString().split('T')[0];
        const nuevaFechaFin = calcularFechaMasMes(hoy);
        setFormData(prev => ({
          ...prev,
          fechaInicio: hoy,
          fechaFin: nuevaFechaFin,
        }));
      }
    }
  };

  // 👇 NUEVO: Cuando el usuario edita manualmente la fecha de inicio, recalcular fecha fin
  const handleFechaInicioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevaFechaInicio = e.target.value;
    const nuevaFechaFin = calcularFechaMasMes(nuevaFechaInicio);
    setFormData(prev => ({
      ...prev,
      fechaInicio: nuevaFechaInicio,
      fechaFin: nuevaFechaFin,
    }));
  };

  const handleFechaFinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      fechaFin: e.target.value,
    }));
  };

  const handleCheckboxChange = (tipo: 'descuento' | 'pagoACuenta' | 'recargo') => {
    setFormData(prev => {
      const nuevoEstado = {
        ...prev,
        [tipo]: !prev[tipo],
        editarMonto: true,
      };
      if (!nuevoEstado.descuento && !nuevoEstado.pagoACuenta && !nuevoEstado.recargo) {
        return {
          ...nuevoEstado,
          editarMonto: false,
          monto: String(montoOriginal),
        };
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

    console.log('=== DATOS A ENVIAR ===');
    console.log('personaId:', formData.personaId);
    console.log('planId:', formData.planId);
    console.log('monto:', formData.monto);
    console.log('metodo_cobro:', formData.metodo_cobro);
    console.log('fecha_cobro:', formData.fecha_cobro);
    console.log('fechaInicio:', formData.fechaInicio);
    console.log('fechaFin:', formData.fechaFin);

    try {
      if (esEdicion) {
        await cobroService.update(cobro.id, {
          fecha_cobro: formData.fecha_cobro,
          monto: parseFloat(formData.monto),
          metodo_cobro: formData.metodo_cobro,
          descripcion: formData.descripcion || null,
        });
        Swal.fire({ icon: 'success', title: '¡Cobro actualizado!', timer: 1500, showConfirmButton: false });
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
        Swal.fire({ icon: 'success', title: '¡Cobro registrado!', timer: 1500, showConfirmButton: false });
      }
      onCobroGuardado();
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
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
                <p><strong>Plan:</strong> {periodoActivo.periodos_cobertura?.[0]?.plan?.nombre}</p>
                <p><strong>Vence:</strong> {new Date(periodoActivo.fecha_fin).toLocaleDateString('es-AR')}</p>
              </div>
            </div>
          )}

          {periodoVencido && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-sm font-medium text-yellow-900 mb-2">⚠ Período Vencido</p>
              <div className="text-xs text-yellow-800 space-y-1">
                <p><strong>Plan anterior:</strong> {periodoVencido.periodos_cobertura?.[0]?.plan?.nombre}</p>
                <p><strong>Venció:</strong> {new Date(periodoVencido.fecha_fin).toLocaleDateString('es-AR')}</p>
              </div>
            </div>
          )}

          {!esEdicion && !periodoActivo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
              <select
                
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

          {!esEdicion && formData.planId && (
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
                <p className="text-xs text-gray-500 mt-1">
                  {periodoActivo ? 'Extiende desde el vencimiento' : 'Editable (la fecha fin se recalcula)'}
                </p>
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
                <p className="text-xs text-gray-500 mt-1">Editable manualmente</p>
              </div>
            </div>
          )}

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
                disabled={!formData.editarMonto}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  !formData.editarMonto ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
            </div>
          </div>

          {!esEdicion && (
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de cobro *</label>
            <select
              name="metodo_cobro"
              value={formData.metodo_cobro}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjetas">Tarjetas</option>
              <option value="QR">QR</option>
              <option value="debito_automatico">Débito Automático</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows={2}
              placeholder="Observaciones opcionales..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {enviando ? 'Guardando...' : esEdicion ? 'Actualizar' : 'Registrar Cobro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}