import { useState, useEffect } from 'react';
import personaService, { type PersonaConEstado } from '../../services/PersonaService';
import { useDebounce } from '../../hooks/debounce';
import NavegadorFlechas from './NavegadorFlechas';

interface BuscadorAlumnoProps {
  onSeleccionar: (alumno: PersonaConEstado) => void;
  placeholder?: string;
  autoFocus?: boolean;
  mostrarFiltroBajas?: boolean;
  verBajas?: boolean;
  onVerBajasChange?: (verBajas: boolean) => void;
}

export default function BuscadorAlumno({
  onSeleccionar,
  placeholder = 'Buscar por DNI, Nombre o Apellido...',
  autoFocus = false,
  mostrarFiltroBajas = false,
  verBajas: verBajasProp,
  onVerBajasChange,
}: BuscadorAlumnoProps) {
  const [termino, setTermino] = useState('');
  const [resultados, setResultados] = useState<PersonaConEstado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [verBajasInterno, setVerBajasInterno] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const verBajas = verBajasProp !== undefined ? verBajasProp : verBajasInterno;
  const terminoDebounced = useDebounce(termino, 400);

  // 🔹 Si termino !== terminoDebounced, significa que el usuario está tipeando durante el debounce.
  const estaBuscando = cargando || termino.trim() !== terminoDebounced.trim();

  useEffect(() => {
    const buscar = async () => {
      if (!terminoDebounced.trim()) {
        setResultados([]);
        setCargando(false);
        return;
      }

      try {
        setCargando(true);
        const data = await personaService.getAll(terminoDebounced, 'ALUMNO', verBajas);
        setResultados(data);
      } catch (error) {
        console.error('Error al buscar alumnos:', error);
      } finally {
        setCargando(false);
      }
    };

    buscar();
  }, [terminoDebounced, verBajas]);

  const handleToggleBajas = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (verBajasProp === undefined) {
      setVerBajasInterno(checked);
    }
    onVerBajasChange?.(checked);
  };

  const handleSelect = (alumno: PersonaConEstado) => {
    onSeleccionar(alumno);
    setTermino('');
    setResultados([]);
    setIsFocused(false);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
      <div className="relative w-full flex-1">
        <input
          type="text"
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
        />

        <NavegadorFlechas
          items={resultados}
          isOpen={isFocused && termino.trim().length > 0}
          cargando={estaBuscando}
          keyExtractor={(alumno) => alumno.id}
          onSelect={handleSelect}
          onClose={() => setIsFocused(false)}
          emptyMessage="No hay coincidencia con su búsqueda"
          renderItem={(alumno) => (
            <div className="w-full px-4 py-3 text-left flex items-center justify-between">
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
            </div>
          )}
        />
      </div>

      {mostrarFiltroBajas && (
        <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap text-sm font-medium text-gray-700 select-none">
          <input
            type="checkbox"
            checked={verBajas}
            onChange={handleToggleBajas}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          Ver solo alumnos de baja
        </label>
      )}
    </div>
  );
}