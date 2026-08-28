import { useEffect, useState } from 'react';
import personaService, { type Persona } from '../services/PersonaService';
import { periodoService, type MotivoBaja } from '../services/periodoService';
import Swal from 'sweetalert2';
import ModalAlumno from '../Componentes/alumnos/ModalAlumnos';
import ModalCobro from '../Componentes/alumnos/ModalCobro';

export default function AlumnosPage() {
  const [alumnos, setAlumnos] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  
  // Estados de modales
  const [modalAlumnoOpen, setModalAlumnoOpen] = useState(false);
  const [alumnoEditando, setAlumnoEditando] = useState<Persona | null>(null);
  const [modalCobroOpen, setModalCobroOpen] = useState(false);
  const [alumnoCobrando, setAlumnoCobrando] = useState<Persona | null>(null);

  const cargarAlumnos = async (term: string = '') => {
    try {
      setLoading(true);
      const datos = term 
        ? await personaService.search(term, 'ALUMNO') 
        : await personaService.getAll('ALUMNO');
      setAlumnos(datos);
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAlumnos();
  }, []);

  const handleBuscar = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBusqueda(e.target.value);
    cargarAlumnos(e.target.value);
  };

  const handleAbrirCobro = (alumno: Persona) => {
    setAlumnoCobrando(alumno);
    setModalCobroOpen(true);
  };

  const handleEditar = (alumno: Persona) => {
    setAlumnoEditando(alumno);
    setModalAlumnoOpen(true);
  };

  const handleDarDeBaja = async (alumno: Persona) => {
    const periodoActivo = await periodoService.getPeriodoActivo(alumno.id);
    
    if (periodoActivo) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Alumno activo', 
        text: 'Este alumno tiene un período vigente. La baja solo se registra cuando el período está vencido.' 
      });
      return;
    }

    const ultimoPeriodo = await periodoService.getUltimoPeriodo(alumno.id);
    if (!ultimoPeriodo) {
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: 'No se encontró ningún período registrado para este alumno.' 
      });
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
        if (!motivo) { 
          Swal.showValidationMessage('Debe seleccionar un motivo'); 
          return false; 
        }
        return { motivo, observaciones };
      },
    });

    if (formData) {
      try {
        await periodoService.registrarBaja(
          ultimoPeriodo.id, 
          formData.motivo as MotivoBaja, 
          formData.observaciones
        );
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
        <button 
          onClick={() => {
            setAlumnoEditando(null);
            setModalAlumnoOpen(true);
          }} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          + Nuevo Alumno
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <input 
          type="text" 
          placeholder="Buscar por DNI, nombre o apellido..." 
          value={busqueda} 
          onChange={handleBuscar} 
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : alumnos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {busqueda ? 'No se encontraron alumnos' : 'No hay alumnos registrados'}
          </div>
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
                    <button 
                      onClick={() => handleAbrirCobro(alumno)} 
                      className="text-green-600 hover:text-green-800 font-medium flex items-center gap-1 inline-flex"
                    >
                      💰 Cobrar
                    </button>
                    <button 
                      onClick={() => handleEditar(alumno)} 
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDarDeBaja(alumno)} 
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Baja
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modales */}
      <ModalAlumno
        open={modalAlumnoOpen}
        alumno={alumnoEditando}
        onClose={() => {
          setModalAlumnoOpen(false);
          setAlumnoEditando(null);
        }}
        onAlumnoGuardado={() => {
          setModalAlumnoOpen(false);
          setAlumnoEditando(null);
          cargarAlumnos(busqueda);
        }}
      />

      <ModalCobro
        open={modalCobroOpen}
        alumno={alumnoCobrando}
        onClose={() => {
          setModalCobroOpen(false);
          setAlumnoCobrando(null);
        }}
        onCobroRegistrado={() => {
          setModalCobroOpen(false);
          setAlumnoCobrando(null);
        }}
      />
    </div>
  );
}