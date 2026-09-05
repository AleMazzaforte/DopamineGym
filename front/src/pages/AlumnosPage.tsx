import { useEffect, useState, useRef } from 'react';
import personaService, { type PersonaConEstado } from '../services/PersonaService';
import { mostrarError } from '../lib/swal';

import ModalAlumno from '../Componentes/alumnos/ModalAlumnos';
import ModalCobro from '../Componentes/cobros/ModalCobros';
import ModalBaja from '../Componentes/alumnos/ModalBaja';

export default function AlumnosPage() {
  const [alumnos, setAlumnos] = useState<PersonaConEstado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [verBajas, setVerBajas] = useState(false); // 👈 Nuevo estado para el checkbox

  const [modalAlumnoOpen, setModalAlumnoOpen] = useState(false);
  const [alumnoEditando, setAlumnoEditando] = useState<PersonaConEstado | null>(null);

  const [modalCobroOpen, setModalCobroOpen] = useState(false);
  const [alumnoCobrando, setAlumnoCobrando] = useState<PersonaConEstado | null>(null);

  const [modalBajaOpen, setModalBajaOpen] = useState(false);
  const [alumnoBaja, setAlumnoBaja] = useState<PersonaConEstado | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargarAlumnos = async (term: string = busqueda, soloBaja: boolean = verBajas) => {
    try {
      setLoading(true);
      const datos = await personaService.getAll(term, 'ALUMNO', soloBaja);     

      const datosNormalizados = datos.map(alumno => ({
        ...alumno,
        estado: alumno.estado?.toUpperCase() as 'ACTIVO' | 'INACTIVO' | 'BAJA'
      }));
      
      setAlumnos(datosNormalizados);
    } catch (error: any) {
      mostrarError('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAlumnos(busqueda, verBajas);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [verBajas]); // 👈 Se recarga automáticamente al tildar/destildar

  const handleBuscar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevoValor = e.target.value;
    setBusqueda(nuevoValor);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      cargarAlumnos(nuevoValor, verBajas);
    }, 1000);
  };

  const handleAbrirCobro = (alumno: PersonaConEstado) => {
    setAlumnoCobrando(alumno);
    setModalCobroOpen(true);
  };

  const handleEditar = (alumno: PersonaConEstado) => {
    setAlumnoEditando(alumno);
    setModalAlumnoOpen(true);
  };

  const handleAbrirBaja = (alumno: PersonaConEstado) => {
    setAlumnoBaja(alumno);
    setModalBajaOpen(true);
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

      <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-col sm:flex-row gap-4 ">
        <input
          type="text"
          placeholder="Buscar por DNI, nombre o apellido..."
          value={busqueda}
          onChange={handleBuscar}
          className="w-100 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />

        {/* 👈 Checkbox para alternar entre activos/inactivos y dados de baja */}
        <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap text-sm font-medium text-gray-700 select-none">
          <input
            type="checkbox"
            checked={verBajas}
            onChange={(e) => setVerBajas(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          Ver solo alumnos de baja
        </label>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : alumnos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {busqueda 
              ? 'No se encontraron alumnos' 
              : verBajas 
                ? 'No hay alumnos dados de baja' 
                : 'No hay alumnos activos o inactivos registrados'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">DNI</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Apellido</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
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
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      alumno.estado === 'ACTIVO' ? 'bg-green-100 text-green-800' :
                      alumno.estado === 'BAJA' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {alumno.estado === 'ACTIVO' ? 'Activo' :
                       alumno.estado === 'BAJA' ? 'Baja' : 'Inactivo'}
                    </span>
                  </td>
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
                    {/* 👈 Botón con disabled cuando está de baja */}
                    <button
                      onClick={() => handleAbrirBaja(alumno)}
                      disabled={alumno.estado === 'BAJA'}
                      className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
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
          cargarAlumnos(busqueda, verBajas);
        }}
      />

      <ModalCobro
        open={modalCobroOpen}
        cobro={null}
        alumnoPreseleccionado={alumnoCobrando}
        onClose={() => {
          setModalCobroOpen(false);
          setAlumnoCobrando(null);
        }}
        onCobroGuardado={() => {
          setModalCobroOpen(false);
          setAlumnoCobrando(null);
          cargarAlumnos(busqueda, verBajas);
        }}
      />

      <ModalBaja
        open={modalBajaOpen}
        alumno={alumnoBaja}
        onClose={() => {
          setModalBajaOpen(false);
          setAlumnoBaja(null);
        }}
        onBajaGuardada={() => {
          setModalBajaOpen(false);
          setAlumnoBaja(null);
          cargarAlumnos(busqueda, verBajas);
        }}
      />
    </div>
  );
}