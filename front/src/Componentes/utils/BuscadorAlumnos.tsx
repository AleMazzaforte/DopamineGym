import { useState, useEffect } from 'react';
import personaService, { type PersonaConEstado } from '../../services/PersonaService';
import { useDebounce } from '../../hooks/debounce';

interface BuscadorAlumnoProps {
  onSeleccionar: (alumno: PersonaConEstado) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function BuscadorAlumno({
  onSeleccionar,
  placeholder = 'Buscar por DNI, Nombre o Apellido...',
  autoFocus = false,
}: BuscadorAlumnoProps) {
  const [termino, setTermino] = useState('');
  const [resultados, setResultados] = useState<PersonaConEstado[]>([]);
  const [cargando, setCargando] = useState(false);

  // Aplica el retardo de 400ms
  const terminoDebounced = useDebounce(termino, 400);

  useEffect(() => {
    const buscar = async () => {
      if (!terminoDebounced.trim()) {
        setResultados([]);
        return;
      }

      try {
        setCargando(true);
        const data = await personaService.getAll(terminoDebounced, 'ALUMNO');
        setResultados(data);
      } catch (error) {
        console.error('Error al buscar alumnos:', error);
      } finally {
        setCargando(false);
      }
    };

    buscar();
  }, [terminoDebounced]);

  const handleSelect = (alumno: PersonaConEstado) => {
    onSeleccionar(alumno);
    setTermino('');
    setResultados([]);
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
      />

      {/* Spinner de carga opcional */}
      {cargando && (
        <div className="absolute right-3 top-3.5 text-xs text-gray-400">
          Cargando...
        </div>
      )}

      {/* Lista flotante de resultados */}
      {resultados.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white mt-1 rounded-lg shadow-xl border border-gray-200 z-50 max-h-60 overflow-y-auto divide-y divide-gray-100">
          {resultados.map((alumno) => (
            <button
              key={alumno.id}
              type="button"
              onClick={() => handleSelect(alumno)}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center justify-between transition-colors"
            >
              <div>
                <span className="font-semibold text-gray-800">
                  {alumno.apellido}, {alumno.nombre}
                </span>
                <span className="text-sm text-gray-500 ml-3">DNI: {alumno.dni}</span>
              </div>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  alumno.estado === 'ACTIVO'
                    ? 'bg-green-100 text-green-800'
                    : alumno.estado === 'ACTIVO PROVISORIO'
                    ? 'bg-amber-100 text-amber-800'
                    : alumno.estado === 'BAJA'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {alumno.estado || 'INACTIVO'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}