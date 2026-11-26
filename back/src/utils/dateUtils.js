// src/utils/dateUtils.js

/**
 * Partes de "ahora" en hora argentina.
 * Usa Intl.formatToParts: no depende del huso del servidor ni de
 * re-parsear cadenas localizadas.
 */
const partesArgentina = () => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const p = Object.fromEntries(
    fmt.formatToParts(new Date()).map(x => [x.type, x.value])
  );

  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    hora: `${p.hour}:${p.minute}:${p.second}`
  };
};

/** 'YYYY-MM-DD' en hora argentina */
export const obtenerFechaHoyArgentina = () => partesArgentina().fecha;

/** 'YYYY-MM-DD HH:mm:ss' en hora argentina */
export const obtenerFechaHoraArgentina = () => {
  const { fecha, hora } = partesArgentina();
  return `${fecha} ${hora}`;
};