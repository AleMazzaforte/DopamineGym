import { obtenerFechaHoyArgentina } from './dateUtils.js';

/** Error con status HTTP para cortar la transacción con un mensaje claro */
export class ErrorRegla extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

export const METODOS_PAGO = ['efectivo', 'transferencia', 'tarjetas', 'QR', 'debito_automatico'];

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const validarMetodo = (metodo) => {
  if (!METODOS_PAGO.includes(metodo)) {
    throw new ErrorRegla(400, `Método de pago inválido: ${metodo}`);
  }
  return metodo;
};

/** Rollback que nunca tapa el error original ni deja la petición colgada */
export const rollbackSeguro = async (connection) => {
  if (!connection) return;
  try {
    await connection.rollback();
  } catch (e) {
    console.error('Rollback falló:', e.message);
  }
};

/**
 * Exige una sesión de caja ABIERTA. Usa la MISMA conexión de la transacción
 * y bloquea la fila para serializar cobros/ventas concurrentes.
 */
export const exigirCajaAbierta = async (connection) => {
  const [rows] = await connection.query(
    `SELECT id, monto_inicial, fecha_apertura
     FROM sesion_caja
     WHERE estado = 'ABIERTA'
     ORDER BY id DESC LIMIT 1
     FOR UPDATE`
  );
  if (rows.length === 0) {
    throw new ErrorRegla(409, 'La caja está cerrada. Abrí la caja para registrar la operación.');
  }
  return rows[0];
};

/** Exige que el mes no esté contabilizado */
export const exigirMesAbierto = async (connection, periodo) => {
  const [rows] = await connection.query(
    `SELECT periodo FROM cierres_mensuales WHERE periodo = ? LIMIT 1`,
    [periodo]
  );
  if (rows.length > 0) {
    throw new ErrorRegla(423, `El mes ${periodo} ya fue contabilizado. Sus movimientos no se pueden modificar.`);
  }
};

/**
 * Para editar o anular: el mes no debe estar cerrado y la sesión de caja
 * a la que pertenece el movimiento debe seguir ABIERTA.
 * `momento` y `periodo` vienen como STRING desde DATE_FORMAT en el SELECT.
 */
export const exigirMovimientoEditable = async (connection, momento, periodo) => {
  await exigirMesAbierto(connection, periodo);

  const [sesiones] = await connection.query(
    `SELECT id, estado FROM sesion_caja
     WHERE fecha_apertura <= ?
       AND (fecha_cierre IS NULL OR fecha_cierre >= ?)
     ORDER BY id DESC LIMIT 1`,
    [momento, momento]
  );

  if (sesiones.length > 0 && sesiones[0].estado === 'CERRADA') {
    throw new ErrorRegla(409, 'Este movimiento pertenece a una caja ya cerrada. No se puede modificar ni anular.');
  }
};

export { obtenerFechaHoyArgentina };