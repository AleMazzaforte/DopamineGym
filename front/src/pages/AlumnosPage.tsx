import { useEffect, useState } from 'react';
import personaService, { type Persona } from '../services/PersonaService';
import { periodoService, type MotivoBaja, type MetodoPago } from '../services/periodoService';
import planService, { type Plan } from '../services/planService';
import Swal from 'sweetalert2';

export default function AlumnosPage() {
  const [alumnos, setAlumnos] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  
  // Modales
  const [modalAlumno, setModalAlumno] = useState<{ open: boolean; alumno: Persona | null }>({ open: false, alumno: null });
  const [modalCobro, setModalCobro] = useState<{ open: boolean; alumno: Persona | null }>({ open: false, alumno: null });
  
  const [planes, setPlanes] = useState<Plan[]>([]);

  const cargarAlumnos = async (term: string = '') => {
    try {
      setLoading(true);
      const datos = term ? await personaService.search(term, 'ALUMNO') : await personaService.getAll('ALUMNO');
      setAlumnos(datos);
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAlumnos();
    cargarPlanes();
  }, []);

  const cargarPlanes = async () => {
    try {
      const datos = await planService.getAllActivos();
      setPlanes(datos);
    } catch (error: any) {
      console.error('Error cargando planes:', error);
    }
  };

  const handleBuscar = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBusqueda(e.target.value);
    cargarAlumnos(e.target.value);
  };

  // --- LÓGICA DE COBRO ---
  const handleAbrirCobro = (alumno: Persona) => {
    setModalCobro({ open: true, alumno });
  };

  const handleRegistrarCobro = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const planId = formData.get('planId') as string;
    const monto = parseFloat(formData.get('monto') as string);
    const metodoPago = formData.get('metodoPago') as MetodoPago;
    const fechaInicio = formData.get('fechaInicio') as string;
    const fechaFin = formData.get('fechaFin') as string;

    if (!modalCobro.alumno) return;

    try {
      await periodoService.registrarCobro({
        personaId: modalCobro.alumno.id,
        planId,
        monto,
        metodoPago,
        fechaInicio,
        fechaFin,
      });

      Swal.fire({ icon: 'success', title: '¡Cobro registrado!', timer: 1500, showConfirmButton: false });
      setModalCobro({ open: false, alumno: null });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
  };

  // --- LÓGICA DE BAJA ---
  const handleDarDeBaja = async (alumno: Persona) => {
    const periodoActivo = await periodoService.getPeriodoActivo(alumno.id);
    
    if (periodoActivo) {
      Swal.fire({ icon: 'warning', title: 'Alumno activo', text: 'Este alumno tiene un período vigente. La baja solo se registra cuando el período está vencido.' });
      return;
    }

    const ultimoPeriodo = await periodoService.getUltimoPeriodo(alumno.id);
    if (!ultimoPeriodo) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró ningún período registrado para este alumno.' });
      return;
    }

    const { value: formData } = await Swal.fire({
      title: 'Registrar baja del alumno',
      html: `
        <div class="text-left">
          <p class="mb-2"><strong>Alumno:</strong> ${alumno.apellido}, ${alumno.nombre}</p>
          <p class="mb-4 text-orange-600"><strong>Estado:</strong> Inactivo</p>
          <label class="block text-sm font-medium text-gray-700 mb-2">Motivo de baja *</label>
          <select id="motivoBaja" class="swal2-select w-full p-2 border rounded">
            <option value="">Seleccione...</option>
            <option value="vacaciones">Vacaciones</option>
            <option value="lesion">Lesión</option>
            <option value="cuestiones_laborales">Cuestiones laborales</option>
            <option value="cambio_domicilio">Cambio de domicilio</option>
            <option value="problemas_financieros">Problemas financieros</option>
            <option value="disgusto_personal">Disgusto personal</option>
            <option value="disgusto_instalaciones">Disgusto instalaciones</option>
            <option value="asistencia_intermitente">Asistencia intermitente</option>
            <option value="otros">Otros</option>
          </select>
          <label class="block text-sm font-medium text-gray-700 mt-4 mb-2">Observaciones</label>
          <textarea id="observaciones" class="swal2-textarea w-full p-2 border rounded" rows="3"></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Registrar baja',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      preConfirm: () => {
        const motivo = (document.getElementById('motivoBaja') as HTMLSelectElement)?.value;
        const observaciones = (document.getElementById('observaciones') as HTMLTextAreaElement)?.value;
        if (!motivo) { Swal.showValidationMessage('Debe seleccionar un motivo'); return false; }
        return { motivo, observaciones };
      },
    });

    if (formData) {
      try {
        await periodoService.registrarBaja(ultimoPeriodo.id, formData.motivo as MotivoBaja, formData.observaciones);
        Swal.fire({ icon: 'success', title: 'Baja registrada', timer: 1500, showConfirmButton: false });
        cargarAlumnos(busqueda);
      } catch (error: any) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
      }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Alumnos</h1>
        <button onClick={() => setModalAlumno({ open: true, alumno: null })} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
          + Nuevo Alumno
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <input type="text" placeholder="Buscar por DNI, nombre o apellido..." value={busqueda} onChange={handleBuscar} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500">Cargando...</div> : alumnos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{busqueda ? 'No se encontraron alumnos' : 'No hay alumnos registrados'}</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">DNI</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Apellido</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {alumnos.map((alumno) => (
                <tr key={alumno.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-900">{alumno.dni}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{alumno.apellido}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{alumno.nombre}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{alumno.telefono}</td>
                  <td className="px-6 py-4 text-sm space-x-3">
                    <button onClick={() => handleAbrirCobro(alumno)} className="text-green-600 hover:text-green-800 font-medium flex items-center gap-1 inline-flex">
                      💰 Cobrar
                    </button>
                    <button onClick={() => setModalAlumno({ open: true, alumno })} className="text-blue-600 hover:text-blue-800 font-medium">Editar</button>
                    <button onClick={() => handleDarDeBaja(alumno)} className="text-red-600 hover:text-red-800 font-medium">Baja</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL DE COBRO */}
      {modalCobro.open && modalCobro.alumno && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Registrar Cobro</h2>
              <button onClick={() => setModalCobro({ open: false, alumno: null })} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <form onSubmit={handleRegistrarCobro} className="p-6 space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg mb-4">
                <p className="font-semibold text-blue-900">{modalCobro.alumno.apellido}, {modalCobro.alumno.nombre}</p>
                <p className="text-sm text-blue-700">DNI: {modalCobro.alumno.dni}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
                <select name="planId" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Seleccione un plan...</option>
                  {planes.map(plan => (
                    <option key={plan.id} value={plan.id} data-precio={plan.precio}>
                      {plan.nombre} - ${plan.precio}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio *</label>
                  <input type="date" name="fechaInicio" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin *</label>
                  <input type="date" name="fechaFin" required defaultValue={new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto ($) *</label>
                  <input type="number" step="0.01" name="monto" required className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago *</label>
                  <select name="metodoPago" required className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjetas">Tarjetas</option>
                    <option value="QR">QR</option>
                    <option value="debito_automatico">Débito Automático</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setModalCobro({ open: false, alumno: null })} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Confirmar Cobro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ALUMNO (Alta/Edición) - (Mantené el que ya tenías, o avisame si querés que te lo pase completo de nuevo) */}
      {modalAlumno.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h2 className="text-xl font-bold mb-4">{modalAlumno.alumno ? 'Editar Alumno' : 'Nuevo Alumno'}</h2>
              <p className="text-gray-500">Acá va el formulario de alumno que ya tenías funcionando.</p>
              <button onClick={() => setModalAlumno({ open: false, alumno: null })} className="mt-4 px-4 py-2 bg-gray-200 rounded">Cerrar</button>
           </div>
        </div>
      )}
    </div>
  );
}