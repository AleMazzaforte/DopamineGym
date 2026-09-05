/*import { useEffect, useState } from 'react';
import { periodoService, type MotivoBaja, type MetodoPago } from '../services/periodoService';
//import planService, { type Plan } from '../services/planService';



export default function PlanesPage() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [planEditando, setPlanEditando] = useState<Plan | null>(null);

  const cargarPlanes = async () => {
    try {
      setLoading(true);
      const datos = await planService.getAll();
      setPlanes(datos);
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPlanes();
  }, []);

  const handleEditar = (plan: Plan) => {
    setPlanEditando(plan);
    setModalOpen(true);
  };

  const handleToggleActivo = async (plan: Plan) => {
    try {
      if (plan.activo) {
        await planService.desactivar(plan.id);
        Swal.fire({ icon: 'success', title: 'Plan desactivado', timer: 1500, showConfirmButton: false });
      } else {
        await planService.activar(plan.id);
        Swal.fire({ icon: 'success', title: 'Plan activado', timer: 1500, showConfirmButton: false });
      }
      cargarPlanes();
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
  };

  const handlePlanGuardado = () => {
    setModalOpen(false);
    setPlanEditando(null);
    cargarPlanes();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Planes</h1>
        <button
          onClick={() => {
            setPlanEditando(null);
            setModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          + Nuevo Plan
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : planes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No hay planes registrados</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Veces/Semana</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {planes.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{plan.nombre}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{plan.descripcion || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {plan.veces_por_semana ? `${plan.veces_por_semana} veces` : 'Pase libre'}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    ${Number(plan.precio).toLocaleString('es-AR')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        plan.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {plan.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button
                      onClick={() => handleEditar(plan)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleActivo(plan)}
                      className={`font-medium ${
                        plan.activo ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'
                      }`}
                    >
                      {plan.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    
      {modalOpen && (
        <ModalPlan
          plan={planEditando}
          onClose={() => {
            setModalOpen(false);
            setPlanEditando(null);
          }}
          onPlanGuardado={handlePlanGuardado}
        />
      )}
    </div>
  );
}

// Componente Modal
function ModalPlan({
  plan,
  onClose,
  onPlanGuardado,
}: {
  plan: Plan | null;
  onClose: () => void;
  onPlanGuardado: () => void;
}) {
  const esEdicion = !!plan;
  const [formData, setFormData] = useState<PlanInsert>({
    nombre: '',
    descripcion: '',
    veces_por_semana: null,
    precio: 0,
    activo: true,
  });
  const [enviando, setEnviando] = useState(false);
  const [esPaseLibre, setEsPaseLibre] = useState(false);

  useEffect(() => {
    if (plan) {
      setFormData({
        nombre: plan.nombre,
        descripcion: plan.descripcion || '',
        veces_por_semana: plan.veces_por_semana,
        precio: plan.precio,
        activo: plan.activo,
      });
      setEsPaseLibre(!plan.veces_por_semana);
    }
  }, [plan]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
      setFormData({ ...formData, [name]: parseFloat(value) || 0 });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handlePaseLibreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setEsPaseLibre(checked);
    if (checked) {
      setFormData({ ...formData, veces_por_semana: null });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);

    try {
      if (esEdicion && plan) {
        await planService.update(plan.id, formData);
        Swal.fire({ icon: 'success', title: '¡Plan actualizado!', timer: 1500, showConfirmButton: false });
      } else {
        await planService.create(formData);
        Swal.fire({ icon: 'success', title: '¡Plan creado!', timer: 1500, showConfirmButton: false });
      }
      onPlanGuardado();
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo guardar el plan' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">
            {esEdicion ? 'Editar Plan' : 'Nuevo Plan'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del plan *</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              required
              placeholder="Ej: Pase Libre, 3 veces por semana"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows={3}
              placeholder="Detalles del plan..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={esPaseLibre}
                onChange={handlePaseLibreChange}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Es Pase Libre (sin límite de veces)</span>
            </label>
          </div>

          {!esPaseLibre && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Veces por semana *</label>
              <input
                type="number"
                name="veces_por_semana"
                value={formData.veces_por_semana || ''}
                onChange={handleChange}
                required={!esPaseLibre}
                min={1}
                max={7}
                placeholder="Ej: 3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio ($) *</label>
            <input
              type="number"
              name="precio"
              value={formData.precio || ''}
              onChange={handleChange}
              required
              min={0}
              step={0.01}
              placeholder="Ej: 15000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {enviando ? 'Guardando...' : esEdicion ? 'Actualizar' : 'Crear Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
   */