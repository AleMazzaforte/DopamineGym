// paginas/PlanesPage.tsx
import { useEffect, useState } from 'react';
import planService, { type Plan, type CreatePlanDTO } from '../services/PlanService';
import { mostrarExito, mostrarError } from '../lib/swal';

export default function PlanesPage() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [planEditando, setPlanEditando] = useState<Plan | null>(null);

  const [formData, setFormData] = useState<CreatePlanDTO>({
    nombre: '',
    descripcion: '',
    veces_por_semana: null,
    precio: 0,
    activo: true,
  });

  const [enviando, setEnviando] = useState(false);

  const cargarPlanes = async () => {
    try {
      setCargando(true);
      const datos = await planService.getAll();
      setPlanes(datos);
    } catch (error: any) {
      mostrarError('Error', error.message || 'Error al cargar los planes');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPlanes();
  }, []);

  const handleNuevoPlan = () => {
    setPlanEditando(null);
    setFormData({
      nombre: '',
      descripcion: '',
      veces_por_semana: null,
      precio: 0,
      activo: true,
    });
    setModalOpen(true);
  };

  const handleEditarPlan = (plan: Plan) => {
    setPlanEditando(plan);
    setFormData({
      nombre: plan.nombre,
      descripcion: plan.descripcion || '',
      veces_por_semana: plan.veces_por_semana,
      precio: plan.precio,
      activo: plan.activo,
    });
    setModalOpen(true);
  };

  const handleToggleEstado = async (id: number) => {
    try {
      await planService.toggleEstado(id);
      mostrarExito('¡Actualizado!', 'El estado del plan ha sido modificado.');
      cargarPlanes();
    } catch (error: any) {
      mostrarError('Error', error.message || 'No se pudo modificar el estado del plan');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);

    try {
      if (planEditando) {
        await planService.update(planEditando.id, formData);
        mostrarExito('¡Plan Actualizado!', 'Los datos del plan fueron guardados con éxito.');
      } else {
        await planService.create(formData);
        mostrarExito('¡Plan Creado!', 'El nuevo plan fue registrado exitosamente.');
      }
      setModalOpen(false);
      cargarPlanes();
    } catch (error: any) {
      mostrarError('Error', error.message || 'Ocurrió un problema al guardar el plan');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Planes</h1>
          <p className="text-sm text-gray-500">Administra las membresías y tarifas del gimnasio</p>
        </div>
        <button
          onClick={handleNuevoPlan}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          + Nuevo Plan
        </button>
      </div>

      {/* TABLA DE PLANES */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-gray-500">Cargando planes...</div>
        ) : planes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No hay planes registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Nombre</th>
                  <th className="px-6 py-3">Descripción</th>
                  <th className="px-6 py-3">Frecuencia</th>
                  <th className="px-6 py-3">Precio</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {planes.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900">{p.nombre}</td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                      {p.descripcion || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {p.veces_por_semana
                        ? `${p.veces_por_semana} veces / sem`
                        : 'Pase Libre'}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-800">
                      ${Number(p.precio).toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                          p.activo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleEditarPlan(p)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggleEstado(p.id)}
                        className={`text-xs px-2 py-1 rounded border font-medium ${
                          p.activo
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {p.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL CREAR / EDITAR */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">
                {planEditando ? 'Editar Plan' : 'Nuevo Plan'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Plan *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Mensual Full, 3 veces por semana"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  value={formData.descripcion || ''}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Ej: Acceso a musculación y cardio libre..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.precio}
                    onChange={(e) =>
                      setFormData({ ...formData, precio: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Veces x Semana
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={formData.veces_por_semana || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        veces_por_semana: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    placeholder="Vacío = Libre"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="activo" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Plan Activo (disponible para cobro)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {enviando ? 'Guardando...' : planEditando ? 'Guardar Cambios' : 'Crear Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}