import { useEffect, useState } from 'react';
import type { PersonaConEstado } from '../../services/PersonaService';
import saldoService, { type ResumenSaldo } from '../../services/SaldoService';

export interface PersonaConFicha extends PersonaConEstado {
  saldo?: number;
}

interface Props {
  open: boolean;
  alumno: PersonaConFicha | null;
  onClose: () => void;
}

export default function ModalFichaAlumno({ open, alumno, onClose }: Props) {
  const [saldoInfo, setSaldoInfo] = useState<ResumenSaldo | null>(null);
  const [cargandoSaldo, setCargandoSaldo] = useState<boolean>(false);

  // Consulta el saldo dinámico del backend al abrir el modal
  useEffect(() => {
    if (open && alumno) {
      setCargandoSaldo(true);
      saldoService
        .getSaldoByPersonaId(alumno.id)
        .then((data) => setSaldoInfo(data))
        .catch((err) => console.error('Error al obtener el saldo del alumno:', err))
        .finally(() => setCargandoSaldo(false));
    } else {
      setSaldoInfo(null);
    }
  }, [open, alumno]);

  if (!open || !alumno) return null;

  // Helper para formatear fechas YYYY-MM-DD a DD/MM/YYYY
  const formatearFecha = (fechaStr?: string | null) => {
    if (!fechaStr) return 'No registrada';
    const [year, month, day] = fechaStr.substring(0, 10).split('-');
    return `${day}/${month}/${year}`;
  };

  // Helper para formatear montos en pesos argentinos
  const formatearMonto = (monto?: number) => {
    if (monto === undefined || monto === null) return '$ 0,00';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto);
  };

  // Estado del certificado médico
  const evaluarCertificado = (fechaVencimiento?: string | null) => {
    if (!fechaVencimiento) {
      return { estado: 'SIN_PRESENTAR', texto: 'Sin presentar', color: 'bg-gray-100 text-gray-700 border-gray-300' };
    }
    const hoy = new Date().toISOString().split('T')[0];
    if (fechaVencimiento < hoy) {
      return { estado: 'VENCIDO', texto: `Vencido el ${formatearFecha(fechaVencimiento)}`, color: 'bg-red-100 text-red-800 border-red-300' };
    }
    return { estado: 'VIGENTE', texto: `Vigente hasta ${formatearFecha(fechaVencimiento)}`, color: 'bg-green-100 text-green-800 border-green-300' };
  };

  const certInfo = evaluarCertificado(alumno.fecha_vencimiento_certificado);
  
  // Prioriza el saldo real del endpoint; si no cargó, usa el opcional de la prop
  const saldoActual = saldoInfo ? saldoInfo.saldo : (alumno.saldo ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* CABECERA */}
        <div className="bg-gray-700 text-white p-5 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">
              {alumno.apellido}, {alumno.nombre}
            </h2>
            <p className="text-sm text-gray-300 mt-0.5">DNI: {alumno.dni}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold leading-none"
            title="Cerrar"
          >
            &times;
          </button>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-700">

          {/* INSIGNIAS DE RESUMEN (ESTADO / CERTIFICADO / SALDO) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Estado */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col justify-center">
              <span className="text-xs text-gray-500 font-semibold uppercase">Estado Alumno</span>
              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit border ${
                alumno.estado === 'ACTIVO' ? 'bg-green-100 text-green-800 border-green-300' :
                alumno.estado === 'ACTIVO PROVISORIO' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                alumno.estado === 'BAJA' ? 'bg-red-100 text-red-800 border-red-300' :
                'bg-gray-100 text-gray-800 border-gray-300'
              }`}>
                {alumno.estado || 'INACTIVO'}
              </span>
            </div>

            {/* Certificado Médico */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col justify-center">
              <span className="text-xs text-gray-500 font-semibold uppercase">Certificado Médico</span>
              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border w-fit ${certInfo.color}`}>
                📋 {certInfo.texto}
              </span>
            </div>

            {/* Saldo de Cuenta Corriente */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col justify-center">
              <span className="text-xs text-gray-500 font-semibold uppercase">Saldo</span>
              {cargandoSaldo ? (
                <span className="text-xs text-gray-400 italic mt-1">Calculando...</span>
              ) : (
                <span className={`text-base font-bold mt-0.5 ${
                  saldoActual < 0 ? 'text-red-600' :
                  saldoActual > 0 ? 'text-green-600' : 'text-gray-800'
                }`}>
                  {formatearMonto(saldoActual)}
                  {saldoActual < 0 && <span className="text-xs text-red-500 font-normal ml-1">(Deuda)</span>}
                  {saldoActual > 0 && <span className="text-xs text-green-500 font-normal ml-1">(A favor)</span>}
                </span>
              )}
            </div>

          </div>

          {/* DESGLOSE DEL SALDO (SÓLO CUANDO YA SE CARGÓ EL SALDO) */}
          {saldoInfo && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 flex justify-between items-center">
              <div>
                <span>Total Contratado: <strong className="text-gray-800">{formatearMonto(saldoInfo.totalContratado)}</strong></span>
              </div>
              <div>
                <span>Total Pagado: <strong className="text-gray-800">{formatearMonto(saldoInfo.totalCobrado)}</strong></span>
              </div>
            </div>
          )}

          {/* TARJETA 1: DATOS PERSONALES Y CONTACTO */}
          <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-3 text-base flex items-center gap-2">
              👤 Datos Personales y Contacto
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
              <div>
                <span className="text-gray-500 text-xs block">Fecha de Nacimiento:</span>
                <span className="font-medium">{formatearFecha(alumno.fecha_nacimiento)}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Email:</span>
                <span className="font-medium">{alumno.email || 'No registrado'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Teléfono:</span>
                <span className="font-medium">{alumno.telefono || 'No registrado'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Teléfono Familiar:</span>
                <span className="font-medium">{alumno.telefono_familiar || 'No registrado'}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-gray-500 text-xs block">Contacto de Emergencia:</span>
                <span className="font-medium">{alumno.contacto_emergencia || 'No registrado'}</span>
              </div>
            </div>
          </div>

          {/* TARJETA 2: SALUD Y ENTRENAMIENTO */}
          <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-3 text-base flex items-center gap-2">
              🩺 Ficha Médica y Entrenamiento
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-gray-500 text-xs block">Antecedentes de Entrenamiento:</span>
                <p className="font-medium mt-0.5 bg-gray-50 p-2 rounded border border-gray-100">
                  {alumno.antecedentes_entrenamiento || 'Sin antecedentes informados'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Restricciones / Lesiones / Observaciones:</span>
                <p className="font-medium mt-0.5 bg-gray-50 p-2 rounded border border-gray-100 text-amber-900">
                  {alumno.restricciones || 'Sin restricciones registradas'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Detalle del Certificado Médico:</span>
                <p className="font-medium mt-0.5">
                  {alumno.certificado_medico || 'Sin observaciones de certificado'}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* PIE DEL MODAL */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}