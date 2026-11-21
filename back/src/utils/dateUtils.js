// Helpers para forzar la zona horaria de Argentina (UTC-3)
export const obtenerFechaHoraArgentina = () => {
  const now = new Date();
  const fechaAR = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  
  const year = fechaAR.getFullYear();
  const month = String(fechaAR.getMonth() + 1).padStart(2, '0');
  const day = String(fechaAR.getDate()).padStart(2, '0');
  const hours = String(fechaAR.getHours()).padStart(2, '0');
  const minutes = String(fechaAR.getMinutes()).padStart(2, '0');
  const seconds = String(fechaAR.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const obtenerFechaHoyArgentina = () => {
  const now = new Date();
  const fechaAR = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  
  const year = fechaAR.getFullYear();
  const month = String(fechaAR.getMonth() + 1).padStart(2, '0');
  const day = String(fechaAR.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};