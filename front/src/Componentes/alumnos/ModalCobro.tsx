import { useEffect, useState } from 'react';
import planService, { type Plan } from '../../services/PlanService';
import { periodoService, type MetodoPago } from '../../services/periodoService';
import { type Persona } from '../../services/PersonaService';
import Swal from 'sweetalert2';

interface ModalCobroProps {
  open: boolean;
  alumno: Persona | null;
  onClose: () => void;
  onCobroRegistrado: () => void;
}

export default function ModalCobro({ open, alumno, onClose, onCobroRegistrado }: ModalCobroProps) {
  const [planes, setPlanes] = useState<Plan[]>([]);

  useEffect(() => {
    if (open) {
      const cargarPlanes = async () => {
        try {
          const datos = await planService.getAllActivos();
          setPlanes(datos);
        } catch (error: any) {
          console.error('Error cargando planes:', error);
        }
      };
      cargarPlanes();
    }
  }, [open]);

  if (!open || !alumno) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const planId = formData.get('planId') as string;
    const monto = parseFloat(formData.get('monto') as string);
    const metodoPago = formData.get('metodoPago') as MetodoPago;
    const fechaInicio = formData.get('fechaInicio') as string;
    const fechaFin = formData.get('fechaFin') as string;

    try {
      await periodoService.registrarCobro({
        personaId: alumno.id,
        planId,
        monto,
        metodoPago,
        fechaInicio,
        fechaFin,
      });

      Swal.fire({ icon: 'success', title: '¡Cobro registrado!', timer: 1500, showConfirmButton: false });
      onCobroRegistrado();
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Registrar Cobro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg mb-4">
            <p className="font-semibold text-blue-900">{alumno.apellido}, {alumno.nombre}</p>
            <p className="text-sm text-blue-700">DNI: {alumno.dni}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
            <select name="planId" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="">Seleccione un plan...</option>
              {planes.map(plan => (
                <option key={plan.id} value={plan.id} data-precio={plan.precio}>
                  {plan.nombre} - ${Number(plan.precio).toLocaleString('es-AR')}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio *</label>
              <input 
                type="date" 
                name="fechaInicio" 
                required 
                defaultValue={new Date().toISOString().split('T')[0]} 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin *</label>
              <input 
                type="date" 
                name="fechaFin" 
                required 
                defaultValue={new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]} 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto ($) *</label>
              <input 
                type="number" 
                step="0.01" 
                name="monto" 
                required 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" 
              />
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
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Confirmar Cobro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}