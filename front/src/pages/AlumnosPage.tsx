import { useEffect, useState, useCallback } from 'react';
import personaService, { type PersonaConEstado } from '../services/PersonaService';
import { mostrarError } from '../lib/swal';

import BuscadorAlumno from '../Componentes/utils/BuscadorAlumnos';
import ModalAlumno from '../Componentes/alumnos/ModalAlumnos';
import ModalCobro from '../Componentes/cobros/ModalCobros';
import ModalBaja from '../Componentes/alumnos/ModalBaja';
import ModalProvisorio from '../Componentes/alumnos/ModalProvisorio';
import ModalFichaAlumno from '../Componentes/alumnos/ModalFichaAlumno';

export default function AlumnosPage() {
  const [alumnos, setAlumnos] = useState<PersonaConEstado[]>([]);
  const [loading, setLoading] = useState(true);
  const [verBajas, setVerBajas] = useState(false);

  // Estados de modales
  const [modalAlumnoOpen, setModalAlumnoOpen] = useState(false);
  const [alumnoEditando, setAlumnoEditando] = useState<PersonaConEstado | null>(null);

  const [modalCobroOpen, setModalCobroOpen] = useState(false);
  const [alumnoCobrando, setAlumnoCobrando] = useState<PersonaConEstado | null>(null);

  const [modalProvisorioOpen, setModalProvisorioOpen] = useState(false);
  const [alumnoProvisorio, setAlumnoProvisorio] = useState<PersonaConEstado | null>(null);

  const [modalBajaOpen, setModalBajaOpen] = useState(false);
  const [alumnoBaja, setAlumnoBaja] = useState<PersonaConEstado | null>(null);

  const [modalFichaOpen, setModalFichaOpen] = useState(false);
  const [alumnoFicha, setAlumnoFicha] = useState<PersonaConEstado | null>(null);

  // Estados para controlar el filtro de búsqueda individual
  const [esBusquedaFiltrada, setEsBusquedaFiltrada] = useState(false);
  const [buscadorKey, setBuscadorKey] = useState(0);

  // ✅ MEJORA: useCallback evita recrear la función en cada render y previene closure traps con 'verBajas'
  const cargarAlumnos = useCallback(async (term: string = "", filtroBajas: boolean) => {
    try {
      setLoading(true);
      const datos = await personaService.getAll(term, 'ALUMNO', filtroBajas);

      // Normalizamos el estado para garantizar consistencia en la UI
      const datosNormalizados = datos.map(alumno => ({
        ...alumno,
        estado: (alumno.estado || 'INACTIVO').toUpperCase() as 'ACTIVO' | 'INACTIVO' | 'BAJA' | 'ACTIVO PROVISORIO'
      }));

      setAlumnos(datosNormalizados);
    } catch (error: any) {
      mostrarError('Error', error.message || 'No se pudieron cargar los alumnos');
    } finally {
      setLoading(false);
    }
  }, []);

  // Recarga la lista cada vez que cambia el interruptor de "Ver bajas"
  useEffect(() => {
    cargarAlumnos('', verBajas);
  }, [verBajas, cargarAlumnos]);

  const handleSeleccionarAlumno = (alumno: PersonaConEstado) => {
    setAlumnos([alumno]);
    setEsBusquedaFiltrada(true);
  };

  const handleMostrarTodos = () => {
    setBuscadorKey(prev => prev + 1); // Fuerza el remount del BuscadorAlumno para limpiar su input interno
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

  const handleAbrirProvisorio = (alumno: PersonaConEstado) => {
    setAlumnoProvisorio(alumno);
    setModalProvisorioOpen(true);
  };

  const handleAbrirBaja = (alumno: PersonaConEstado) => {
    setAlumnoBaja(alumno);
    setModalBajaOpen(true);
  };

  const handleAbrirFicha = (alumno: PersonaConEstado) => {
    setAlumnoFicha(alumno);
    setModalFichaOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Alumnos</h1>
        <button
          onClick={() => {
            setAlumnoEditando(null);
            setModalAlumnoOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + Nuevo Alumno
        </button>
      </div>

      {/* Barra de Búsqueda */}
      <div className="bg-white p-4 rounded-lg shadow">
        <BuscadorAlumno
          key={buscadorKey}
          onSeleccionar={handleSeleccionarAlumno}
          mostrarFiltroBajas={true}
          verBajas={verBajas}
          onVerBajasChange={(checked) => {
            setVerBajas(checked);
            if (esBusquedaFiltrada) handleMostrarTodos();
          }}
        />
      </div>

      {/* Aviso de Filtro Activo */}
      {esBusquedaFiltrada && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-sm text-blue-800">
          <span>🔍 Mostrando resultado individual de la búsqueda.</span>
          <button
            onClick={handleMostrarTodos}
            className="font-bold underline hover:text-blue-900 ml-2 transition-colors"
          >
            Volver a la lista completa
          </button>
        </div>
      )}

      {/* Tabla de Datos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 animate-pulse">Cargando alumnos...</div>
        ) : alumnos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {verBajas
              ? 'No hay alumnos dados de baja registrados.'
              : 'No se encontraron alumnos registrados con esos criterios.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">DNI</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apellido</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Teléfono</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {alumnos.map((alumno) => (
                  <tr key={alumno.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">{alumno.dni}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{alumno.apellido}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{alumno.nombre}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{alumno.telefono}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${alumno.estado === 'ACTIVO' ? 'bg-green-100 text-green-800' :
                          alumno.estado === 'ACTIVO PROVISORIO' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            alumno.estado === 'BAJA' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                        }`}>
                        {alumno.estado === 'ACTIVO' ? 'Activo' :
                          alumno.estado === 'ACTIVO PROVISORIO' ? 'Activo Provisorio' :
                            alumno.estado === 'BAJA' ? 'Baja' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right space-x-2">
                      {/* Cobrar siempre disponible si no está de baja */}
                      <button
                        onClick={() => handleAbrirCobro(alumno)}
                        disabled={alumno.estado === 'BAJA'}
                        className="text-green-600 hover:text-green-800 disabled:text-gray-400 disabled:cursor-not-allowed font-medium inline-flex items-center gap-1 transition-colors"
                        aria-label={`Registrar cobro a ${alumno.nombre} ${alumno.apellido}`}
                      >
                        💰 Cobrar
                      </button>

                      {/* Badge de deuda: clickeable para abrir el modal en modo completar deuda */}
                      {alumno.tiene_deuda && (
                        <button
                          onClick={() => handleAbrirCobro(alumno)}
                          className="text-red-600 hover:text-red-800 font-medium inline-flex items-center gap-1 transition-colors"
                          title={`Deuda pendiente: $${Number(alumno.saldo_pendiente).toLocaleString('es-AR')}`}
                        >
                          ⚠️ Deuda
                        </button>
                      )}

                      <button
                        onClick={() => handleEditar(alumno)}
                        className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        aria-label={`Editar datos de ${alumno.nombre} ${alumno.apellido}`}
                      >
                        Editar
                      </button>

                      {/* Provisorio y Baja se deshabilitan si ya está de baja o si ya es provisorio vigente */}
                      <button
                        onClick={() => handleAbrirProvisorio(alumno)}
                        disabled={alumno.estado === 'BAJA' || alumno.estado === 'ACTIVO PROVISORIO'}
                        className="text-amber-600 hover:text-amber-800 disabled:text-gray-400 disabled:cursor-not-allowed font-medium inline-flex items-center gap-1 transition-colors"
                        aria-label={`Activar modo provisorio a ${alumno.nombre} ${alumno.apellido}`}
                      >
                        ⏳ Provisorio
                      </button>

                      <button
                        onClick={() => handleAbrirBaja(alumno)}
                        disabled={alumno.estado === 'BAJA'}
                        className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
                        aria-label={`Registrar baja de ${alumno.nombre} ${alumno.apellido}`}
                      >
                        Baja
                      </button>

                      <button
                        onClick={() => handleAbrirFicha(alumno)}
                        className="text-gray-700 hover:text-black bg-gray-100 hover:bg-gray-200 p-1.5 rounded-md inline-flex items-center gap-1 transition-colors"
                        title="Ver Ficha Completa"
                        aria-label={`Ver ficha completa de ${alumno.nombre} ${alumno.apellido}`}
                      >
                        📄
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales */}
      <ModalFichaAlumno
        open={modalFichaOpen}
        alumno={alumnoFicha}
        onClose={() => {
          setModalFichaOpen(false);
          setAlumnoFicha(null);
        }}
      />

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
          cargarAlumnos('', verBajas);
        }}
      />

      {/* ✅ MEJORA: La prop 'key' fuerza a React a desmontar y remontar el modal, 
          limpiando su estado interno (fechas, planes) cada vez que cambiamos de alumno. */}
      <ModalCobro
        key={alumnoCobrando ? `cobro-${alumnoCobrando.id}` : 'cobro-nuevo'}
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
          cargarAlumnos('', verBajas);
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
          cargarAlumnos('', verBajas);
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
          cargarAlumnos('', verBajas);
        }}
      />
    </div>
  );
}