import Swal from 'sweetalert2';

// ==========================================
// ALERTAS GENÉRICAS (Reutilizables en toda la app)
// ==========================================

export const mostrarExito = (titulo: string, mensaje?: string) => {
  return Swal.fire({
    icon: 'success',
    title: titulo,
    text: mensaje,
    timer: 1500,
    showConfirmButton: false,
  });
};

export const mostrarError = (titulo: string, mensaje: string) => {
  return Swal.fire({
    icon: 'error',
    title: titulo,
    text: mensaje,
  });
};

export const mostrarAdvertencia = (titulo: string, mensaje: string) => {
  return Swal.fire({
    icon: 'warning',
    title: titulo,
    text: mensaje,
  });
};

export const confirmarEliminacion = async (itemNombre: string) => {
  return await Swal.fire({
    title: `¿Eliminar ${itemNombre}?`,
    text: 'Esta acción no se puede deshacer',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
  });
};

// ==========================================
// ALERTAS ESPECÍFICAS (Lógica compleja)
// ==========================================

export const confirmarBajaAlumno = async (alumno: { nombre: string; apellido: string }) => {
  return await Swal.fire({
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
      if (!motivo) { 
        Swal.showValidationMessage('Debe seleccionar un motivo'); 
        return false; 
      }
      return { motivo, observaciones };
      },
  });
};

// ==========================================
// Modal cobro
// ==========================================

// ... (tus funciones mostrarExito, mostrarError, etc. ya existentes)

export const confirmarExtensionPeriodo = async (fechaVencimiento: string) => {
  // Usamos 'T00:00:00' para evitar el bug de que reste un día por zona horaria
  const fechaFormateada = new Date(fechaVencimiento + 'T00:00:00').toLocaleDateString('es-AR');
  const fechaHoy = new Date().toLocaleDateString('es-AR');

  return await Swal.fire({
    title: '¿Continuar con el período anterior?',
    html: `
      <div class="text-left">
        <p class="mb-2">El último período venció el <strong>${fechaFormateada}</strong>.</p>
        <p class="text-sm text-gray-600 mb-4">¿Querés extender ese período o comenzar uno nuevo desde hoy?</p>
        <div class="bg-yellow-50 p-3 rounded text-sm">
          <p><strong>Opción 1 - Continuar:</strong> La fecha de inicio será ${fechaFormateada} (fecha de vencimiento)</p>
          <p><strong>Opción 2 - Nuevo:</strong> La fecha de inicio será hoy (${fechaHoy})</p>
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
};