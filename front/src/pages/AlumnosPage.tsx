import { useEffect, useState, useRef } from 'react';
import personaService, { type PersonaConEstado } from '../services/PersonaService';
import { mostrarError } from '../lib/swal';
import BuscadorAlumno from '../Componentes/utils/BuscadorAlumnos';

import ModalAlumno from '../Componentes/alumnos/ModalAlumnos';
import ModalCobro from '../Componentes/cobros/ModalCobros';
import ModalBaja from '../Componentes/alumnos/ModalBaja';

import ModalProvisorio from '../Componentes/alumnos/ModalProvisorio';

export default function AlumnosPage() {
  const [alumnos, setAlumnos] = useState<PersonaConEstado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [verBajas, setVerBajas] = useState(false);

  const [modalAlumnoOpen, setModalAlumnoOpen] = useState(false);
  const [alumnoEditando, setAlumnoEditando] = useState<PersonaConEstado | null>(null);

  const [modalCobroOpen, setModalCobroOpen] = useState(false);
  const [alumnoCobrando, setAlumnoCobrando] = useState<PersonaConEstado | null>(null);

  const [modalProvisorioOpen, setModalProvisorioOpen] = useState(false);
  const [alumnoProvisorio, setAlumnoProvisorio] = useState<PersonaConEstado | null>(null);

  const [modalBajaOpen, setModalBajaOpen] = useState(false);
  const [alumnoBaja, setAlumnoBaja] = useState<PersonaConEstado | null>(null);

  // Estados para controlar el filtro individual y el reseteo del buscador
  const [esBusquedaFiltrada, setEsBusquedaFiltrada] = useState(false);
  const [buscadorKey, setBuscadorKey] = useState(0);

  const cargarAlumnos = async (term: string = busqueda, soloBaja: boolean = verBajas) => {
    try {
      setLoading(true);
      const datos = await personaService.getAll(term, 'ALUMNO', soloBaja);

      const datosNormalizados = datos.map(alumno => ({
        ...alumno,
        estado: alumno.estado?.toUpperCase() as 'ACTIVO' | 'INACTIVO' | 'BAJA' | 'ACTIVO PROVISORIO'
      }));

      setAlumnos(datosNormalizados);
    } catch (error: any) {
      mostrarError('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAlumnos('', verBajas);
  }, [verBajas]);

  // Handler al seleccionar un alumno desde el buscador reutilizable
  const handleSeleccionarAlumno = (alumno: PersonaConEstado) => {
    setAlumnos([alumno]);
    setEsBusquedaFiltrada(true);
  };

  // Restablecer la lista completa
  const handleMostrarTodos = () => {
    setBuscadorKey(prev => prev + 1); // 👈 Al cambiar la key, React limpia el input del BuscadorAlumno
    setEsBusquedaFiltrada(false);
    cargarAlumnos('', verBajas);
  };



  const handleAbrirCobro = (alumno: PersonaConEstado) => {
    setAlumnoCobrando(alumno);
    setModalCobroOpen(true);
  };

  const handleEditar = (alumno: PersonaConEstado) => {
    setAlumnoEditando(alumno);
    setModalAlumnoOpen(true);
  };

  // 👈 Handler para abrir activación provisoria
  const handleAbrirProvisorio = (alumno: PersonaConEstado) => {
    setAlumnoProvisorio(alumno);
    setModalProvisorioOpen(true);
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
        <div className="w-full md:w-2/3">
          <BuscadorAlumno
            onSeleccionar={handleSeleccionarAlumno}
          />

        </div>
        {/* 👈 Checkbox para alternar entre activos/inactivos y dados de baja */}
        <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap text-sm font-medium text-gray-700 select-none">
          <input
            type="checkbox"
            checked={verBajas}
            onChange={(e) => {
              setVerBajas(e.target.checked);
              if (esBusquedaFiltrada) handleMostrarTodos();
            }}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          Ver solo alumnos de baja
        </label>
      </div>

      {/* AVISO DE FILTRO ACTIVO */}
      {esBusquedaFiltrada && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-sm text-blue-800">
          <span>🔍 Mostrando resultado individual de la búsqueda.</span>
          <button
            onClick={handleMostrarTodos}
            className="font-bold underline hover:text-blue-900 ml-2"
          >
            Volver a la lista completa
          </button>
        </div>
      )}
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
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${alumno.estado === 'ACTIVO' ? 'bg-green-100 text-green-800' :
                        alumno.estado === 'ACTIVO PROVISORIO' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          alumno.estado === 'BAJA' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                      {alumno.estado === 'ACTIVO' ? 'Activo' :
                        alumno.estado === 'ACTIVO PROVISORIO' ? 'Activo Provisorio' :
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
                    {/* Botón con disabled cuando está de baja */}
                    <button
                      onClick={() => handleAbrirProvisorio(alumno)}
                      disabled={alumno.estado === 'BAJA'}
                      className="text-amber-600 hover:text-amber-800 disabled:text-gray-400 disabled:cursor-not-allowed font-medium items-center gap-1 inline-flex"
                    >
                      ⏳ Provisorio
                    </button>
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

      <ModalProvisorio
        open={modalProvisorioOpen}
        alumno={alumnoProvisorio}
        onClose={() => {
          setModalProvisorioOpen(false);
          setAlumnoProvisorio(null);
        }}
        onProvisorioGuardado={() => {
          setModalProvisorioOpen(false);
          setAlumnoProvisorio(null);
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