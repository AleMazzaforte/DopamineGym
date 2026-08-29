import { useEffect, useState } from 'react';
import personaService, { type Persona } from '../services/PersonaService';
import Swal from 'sweetalert2';
import ModalProfesor from '../Componentes/profesores/ModalProfesor';

export default function ProfesoresPage() {
  const [profesores, setProfesores] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  
  const [modalOpen, setModalOpen] = useState(false);
  const [profesorEditando, setProfesorEditando] = useState<Persona | null>(null);

  const cargarProfesores = async (term: string = '') => {
    try {
      setLoading(true);
      const datos = term 
        ? await personaService.search(term, 'PROFESOR') 
        : await personaService.getAll('PROFESOR');
      setProfesores(datos);
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProfesores();
  }, []);

  const handleBuscar = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBusqueda(e.target.value);
    cargarProfesores(e.target.value);
  };

  const handleEditar = (profesor: Persona) => {
    setProfesorEditando(profesor);
    setModalOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Profesores</h1>
        <button 
          onClick={() => {
            setProfesorEditando(null);
            setModalOpen(true);
          }} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          + Nuevo Profesor
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
        ) : profesores.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {busqueda ? 'No se encontraron profesores' : 'No hay profesores registrados'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">DNI</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Apellido</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {profesores.map((profesor) => (
                <tr key={profesor.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-900">{profesor.dni}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{profesor.apellido}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{profesor.nombre}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{profesor.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{profesor.telefono}</td>
                  <td className="px-6 py-4 text-sm">
                    <button 
                      onClick={() => handleEditar(profesor)} 
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ModalProfesor
        open={modalOpen}
        profesor={profesorEditando}
        onClose={() => {
          setModalOpen(false);
          setProfesorEditando(null);
        }}
        onProfesorGuardado={() => {
          setModalOpen(false);
          setProfesorEditando(null);
          cargarProfesores(busqueda);
        }}
      />
    </div>
  );
}