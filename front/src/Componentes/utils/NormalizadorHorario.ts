// src/Componentes/utils/NormalizadorHorario.ts

/**
 * Convierte la fecha que YA VIENE en hora Argentina desde el backend 
 * a un objeto Date seguro para extraer sus partes sin que el navegador 
 * la modifique por la zona horaria local del usuario.
 */
const parsearFechaSegura = (fechaString: string | Date | null | undefined): Date | null => {
  if (!fechaString) return null;
  
  if (fechaString instanceof Date) return fechaString;
  
  const str = String(fechaString).trim();
  
  // Si el backend envía "YYYY-MM-DD HH:mm:ss" (sin zona horaria),
  // le agregamos una 'Z' al final para forzar a JavaScript a leerla como UTC.
  // Así, al usar getUTCHours(), obtendremos exactamente la hora que guardó el backend (Argentina).
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(str)) {
    const formatoISO = str.replace(' ', 'T') + 'Z';
    const date = new Date(formatoISO);
    return isNaN(date.getTime()) ? null : date;
  }
  
  // Fallback por si viene en otro formato
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Formatea una fecha a formato argentino (dd/mm/yyyy)
 * Ej: "2026-09-13 05:21:32" → "13/09/2026"
 */
export const formatearFechaAR = (fechaString: string | Date | null | undefined): string => {
  const date = parsearFechaSegura(fechaString);
  if (!date) return 'S/F';
  
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  
  return `${day}/${month}/${year}`;
};

/**
 * Formatea una fecha a hora en formato 24hs (hh:mm)
 * Ej: "2026-09-13 05:21:32" → "05:21"
 */
export const formatearHoraAR = (fechaString: string | Date | null | undefined): string => {
  const date = parsearFechaSegura(fechaString);
  if (!date) return 'S/H';
  
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
};

/**
 * Formatea fecha y hora juntas
 * Ej: "2026-09-13 05:21:32" → "13/09/2026 05:21"
 */
export const formatearFechaHoraAR = (fechaString: string | Date | null | undefined): string => {
  const date = parsearFechaSegura(fechaString);
  if (!date) return 'S/F S/H';
  
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

/**
 * Obtiene la fecha actual en formato ISO (YYYY-MM-DD) para inputs del frontend
 */
export const obtenerFechaHoyISO = (): string => {
  const ahora = new Date();
  // Para el input de "hoy", sí necesitamos la fecha local del navegador del usuario
  const year = ahora.getFullYear();
  const month = String(ahora.getMonth() + 1).padStart(2, '0');
  const day = String(ahora.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};