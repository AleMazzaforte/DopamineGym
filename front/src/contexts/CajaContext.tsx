import {
  createContext, useContext, useState, useEffect, useCallback, useRef,
  type ReactNode
} from 'react';
import { api } from '../lib/api';
import type { EstadoCajaResponse } from '../services/CajaService';

// Caché a nivel de módulo: sobrevive a los remontajes del Provider.
// Evita una query por cada navegación entre páginas.
const TTL_MS = 60_000;
let cache: { data: EstadoCajaResponse | null; ts: number } = { data: null, ts: 0 };

const ESTADO_CERRADO: EstadoCajaResponse = {
  abierta: false,
  monto_inicial: 0,
  aporte_cambio: 0,
  monto_retirado: 0,
  remanente_anterior: 0,
    fiados_cantidad: 0,
  fiados_total: 0,
  es_admin: false
};

// Normaliza en la frontera con la API: si el back omite un campo,
// no queremos undefined circulando por la UI.
const normalizarEstado = (data: Partial<EstadoCajaResponse> | null | undefined): EstadoCajaResponse => ({
  id: data?.id,
  abierta: Boolean(data?.abierta),
  monto_inicial: Number(data?.monto_inicial) || 0,
  aporte_cambio: Number(data?.aporte_cambio) || 0,
  monto_retirado: Number(data?.monto_retirado) || 0,
  fecha_apertura: data?.fecha_apertura,
  usuario_apertura: data?.usuario_apertura,
  remanente_anterior: Number(data?.remanente_anterior) || 0,
    fiados_cantidad: Number(data?.fiados_cantidad) || 0,
  fiados_total: Number(data?.fiados_total) || 0,
  es_admin: Boolean(data?.es_admin)
});

interface CajaContextValue {
  estadoCaja: EstadoCajaResponse;
  isCajaAbierta: boolean;
  esAdmin: boolean;
  remanenteAnterior: number;
  cargandoEstado: boolean;
  refetchEstado: () => Promise<void>;
}

const CajaContext = createContext<CajaContextValue | null>(null);

export function CajaProvider({ children }: { children: ReactNode }) {
  const [estadoCaja, setEstadoCaja] = useState<EstadoCajaResponse>(cache.data ?? ESTADO_CERRADO);
  const [cargandoEstado, setCargandoEstado] = useState(cache.data === null);

  const enVuelo = useRef<Promise<void> | null>(null);
  const secuencia = useRef(0); // solo la última petición puede escribir el estado

  const fetchEstado = useCallback(async (forzar: boolean): Promise<void> => {
    // Caché fresca: no tocamos la BD
    if (!forzar && cache.data && Date.now() - cache.ts < TTL_MS) {
      setEstadoCaja(cache.data);
      setCargandoEstado(false);
      return;
    }

    // Deduplica pedidos simultáneos (solo en modo no forzado)
    if (!forzar && enVuelo.current) return enVuelo.current;

    const miTurno = ++secuencia.current;

    const pedido = (async () => {
      try {
        const crudo = await api.get<EstadoCajaResponse>('/caja/estado');
        // Si arrancó otra petición más nueva, descartamos esta respuesta
        if (miTurno !== secuencia.current) return;

        const data = normalizarEstado(crudo);
        cache = { data, ts: Date.now() };
        setEstadoCaja(data);
      } catch {
        // Si falla la red, conservamos el último estado conocido.
        // El backend sigue siendo la autoridad: rechaza la operación igual.
      } finally {
        if (miTurno === secuencia.current) {
          setCargandoEstado(false);
          enVuelo.current = null;
        }
      }
    })();

    enVuelo.current = pedido;
    return pedido;
  }, []);

  useEffect(() => {
    fetchEstado(false);

    // Revalida al volver a la pestaña (respeta el TTL, no hace polling)
    const alVolver = () => {
      if (document.visibilityState === 'visible') fetchEstado(false);
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [fetchEstado]);

  const refetchEstado = useCallback(() => fetchEstado(true), [fetchEstado]);

  return (
    <CajaContext.Provider
      value={{
        estadoCaja,
        isCajaAbierta: estadoCaja.abierta,
        esAdmin: estadoCaja.es_admin,
        remanenteAnterior: estadoCaja.remanente_anterior,
        cargandoEstado,
        refetchEstado
      }}
    >
      {children}
    </CajaContext.Provider>
  );
}

export function useCajaGlobal(): CajaContextValue {
  const ctx = useContext(CajaContext);
  if (!ctx) throw new Error('useCajaGlobal debe usarse dentro de <CajaProvider>');
  return ctx;
}