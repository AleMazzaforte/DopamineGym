import { useState, useEffect, useMemo, useCallback } from 'react';
import cajaService, {
  type MetodoPago,
  type TipoMovimiento,
  type MovimientoCaja,
  type EstadoCajaResponse,
  type SesionCaja,
  type ArqueoCaja,
  type CierreCajaPayload,
  type CierreCajaResponse
} from '../services/CajaService';
import { obtenerFechaHoyISO } from '../Componentes/utils/NormalizadorHorario';
import { mostrarError, mostrarExito } from '../lib/swal';

const ARQUEO_VACIO: ArqueoCaja = {
  ingresosEfectivo: 0, egresosEfectivo: 0, retirosEfectivo: 0,
  ingresosDigital: 0, egresosDigital: 0,
  efectivoCalculado: 0, totalDigital: 0, totalConsolidado: 0
};

const ESTADO_INICIAL: EstadoCajaResponse = {
  abierta: false, monto_inicial: 0, aporte_cambio: 0,
  monto_retirado: 0, remanente_anterior: 0, es_admin: false, fiados_total : 0, fiados_cantidad: 0
};

export function useCaja() {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [estadoCaja, setEstadoCaja] = useState<EstadoCajaResponse>(ESTADO_INICIAL);
  const [sesion, setSesion] = useState<SesionCaja | null>(null);
  const [arqueo, setArqueo] = useState<ArqueoCaja>(ARQUEO_VACIO);

  const [fechaFiltro, setFechaFiltro] = useState(() => obtenerFechaHoyISO());
  const [tipoFiltro, setTipoFiltro] = useState<TipoMovimiento | 'TODOS'>('TODOS');
  const [metodoFiltro, setMetodoFiltro] = useState<MetodoPago | 'TODOS'>('TODOS');

  const cargarDatos = useCallback(async (fecha: string) => {
    try {
      setLoading(true);
      const resumen = await cajaService.getResumenCaja(fecha);
      setEstadoCaja(resumen.estado);
      setSesion(resumen.sesion);
      setMovimientos(resumen.movimientos);
      setArqueo(resumen.arqueo ?? ARQUEO_VACIO);
    } catch (error: unknown) {
      mostrarError('Error de Conexión', error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos(fechaFiltro);
  }, [fechaFiltro, cargarDatos]);

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      if (tipoFiltro !== 'TODOS' && m.tipo !== tipoFiltro) return false;
      if (metodoFiltro !== 'TODOS' && m.metodo_pago !== metodoFiltro) return false;
      return true;
    });
  }, [movimientos, tipoFiltro, metodoFiltro]);

  const abrirCaja = async (aporte_cambio: number, observaciones?: string) => {
    setIsSubmitting(true);
    try {
      const r = await cajaService.abrirCaja(aporte_cambio, observaciones);
      mostrarExito('Caja Abierta', `Jornada iniciada con $${r.monto_inicial.toLocaleString('es-AR')}`);
      await cargarDatos(fechaFiltro);
      return true;
    } catch (error: unknown) {
      mostrarError('Error de Apertura', error instanceof Error ? error.message : 'Error al abrir');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const cerrarCaja = async (id: number, payload: CierreCajaPayload): Promise<CierreCajaResponse | null> => {
    setIsSubmitting(true);
    try {
      const r = await cajaService.cerrarCaja(id, payload);
      const detalle = r.diferencia === 0
        ? 'El arqueo cerró sin diferencias.'
        : `Diferencia registrada: $${r.diferencia.toLocaleString('es-AR')}`;
      mostrarExito('Caja Cerrada', `${detalle} Quedan $${r.efectivo_remanente.toLocaleString('es-AR')} para la próxima apertura.`);
      await cargarDatos(fechaFiltro);
      return r;
    } catch (error: unknown) {
      mostrarError('Error de Cierre', error instanceof Error ? error.message : 'Error al cerrar');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const registrarEgreso = async (concepto: string, monto: number, metodo: MetodoPago) => {
    setIsSubmitting(true);
    try {
      await cajaService.registrarEgreso(concepto, monto, metodo);
      mostrarExito('Éxito', 'Egreso registrado');
      await cargarDatos(fechaFiltro);
      return true;
    } catch (error: unknown) {
      mostrarError('Error', error instanceof Error ? error.message : 'Falló el registro');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const registrarRetiro = async (monto: number, motivo: string) => {
    setIsSubmitting(true);
    try {
      const r = await cajaService.registrarRetiro(monto, motivo);
      mostrarExito('Retiro registrado', `Quedan $${r.efectivo_disponible_restante.toLocaleString('es-AR')} en caja`);
      await cargarDatos(fechaFiltro);
      return true;
    } catch (error: unknown) {
      mostrarError('Error', error instanceof Error ? error.message : 'Falló el retiro');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    loading, isSubmitting,
    movimientosFiltrados, estadoCaja, sesion, arqueo,
    esAdmin: estadoCaja.es_admin,
    remanenteAnterior: estadoCaja.remanente_anterior,
    fechaFiltro, setFechaFiltro,
    tipoFiltro, setTipoFiltro,
    metodoFiltro, setMetodoFiltro,
    abrirCaja, cerrarCaja, registrarEgreso, registrarRetiro,
    refetch: () => cargarDatos(fechaFiltro)
  };
}