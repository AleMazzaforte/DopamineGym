// utils/dateUtils.ts
// Helpers de fecha compartidos por todos los modales del sistema

// Devuelve la fecha de hoy en formato YYYY-MM-DD ajustada a la zona horaria local
export const getFechaLocal = (fecha?: Date): string => {
  const d = fecha ? new Date(fecha) : new Date();
  return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

// Suma N meses a una fecha en formato YYYY-MM-DD, ajustando días inválidos
// (ej: 31 de enero + 1 mes = 28 de febrero, no 2 de marzo)
export const sumarMeses = (fechaStr: string, meses: number): string => {
  if (!fechaStr || fechaStr === 'null' || fechaStr === 'undefined') {
    fechaStr = getFechaLocal();
  }
  const fechaDate = new Date(fechaStr + 'T00:00:00');
  if (isNaN(fechaDate.getTime())) {
    fechaDate.setTime(Date.now());
  }

  const diaOriginal = fechaDate.getDate();
  fechaDate.setMonth(fechaDate.getMonth() + meses);

  if (fechaDate.getDate() !== diaOriginal) {
    fechaDate.setDate(0);
  }

  return getFechaLocal(fechaDate);
};