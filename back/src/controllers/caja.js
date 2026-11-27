import { pool } from '../config/database.js';
import { obtenerFechaHoraArgentina, obtenerFechaHoyArgentina } from '../utils/dateUtils.js';

console.log('hoy AR:', obtenerFechaHoyArgentina());
console.log('ahora AR:', obtenerFechaHoraArgentina());
console.log('UTC server:', new Date().toISOString());

/* ============================================================
   Helpers
   ============================================================ */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const esAdmin = (req) => req.usuario?.rol === 'ADMIN';

const personaDeReq = (req) => req.usuario?.persona_id || req.usuario?.id;

/**
 * Arqueo a partir de los movimientos ya traídos de la BD.
 * Los retiros hechos durante la jornada bajan el calculado:
 * esa plata ya no está en el cajón cuando el cajero cuenta.
 */
const calcularArqueo = (movimientos, montoInicial) => {
  let ingEf = 0, egEf = 0, retiros = 0, ingDig = 0, egDig = 0;

  for (const m of movimientos) {
    const monto = Number(m.monto) || 0;
    if (m.tipo === 'RETIRO') { retiros += monto; continue; }
    const esEfectivo = m.metodo_pago === 'efectivo';
    if (m.tipo === 'INGRESO') { esEfectivo ? ingEf += monto : ingDig += monto; }
    else if (m.tipo === 'EGRESO') { esEfectivo ? egEf += monto : egDig += monto; }
  }

  const efectivoCalculado = round2(Number(montoInicial || 0) + ingEf - egEf - retiros);
  const totalDigital = round2(ingDig - egDig);

  return {
    ingresosEfectivo: round2(ingEf),
    egresosEfectivo: round2(egEf),
    retirosEfectivo: round2(retiros),
    ingresosDigital: round2(ingDig),
    egresosDigital: round2(egDig),
    efectivoCalculado,
    totalDigital,
    totalConsolidado: round2(efectivoCalculado + totalDigital)
  };
};

/**
 * Movimientos de UNA sesión (alcance por sesión, no por día calendario).
 * egresos y extracciones se filtran por FK cuando existe; cobros y ventas
 * por rango horario, porque no tienen sesion_caja_id.
 */
const SQL_MOVIMIENTOS = `
  SELECT c.id, c.created_at AS fecha,
         CONCAT('Cobro Alumno: ', p.apellido, ', ', p.nombre) AS concepto,
         c.monto, 'INGRESO' AS tipo, 'CUOTA_ALUMNO' AS categoria,
         c.metodo_cobro AS metodo_pago
  FROM cobros c JOIN personas p ON p.id = c.persona_id
  WHERE c.created_at >= ? AND c.created_at <= ?

  UNION ALL

    SELECT vp.id, vp.created_at AS fecha,
         CONCAT('Venta #', vp.venta_id,
                COALESCE(CONCAT(' - ', p.apellido, ', ', p.nombre), ''),
                CASE WHEN DATE(vp.fecha_pago) > DATE(v.fecha_venta) THEN ' (cobro posterior)' ELSE '' END) AS concepto,
         vp.monto, 'INGRESO' AS tipo, 'VENTA_PRODUCTO' AS categoria,
         vp.metodo_pago
  FROM venta_pagos vp
  JOIN ventas v ON v.id = vp.venta_id
  LEFT JOIN personas p ON p.id = v.persona_id
  WHERE vp.created_at >= ? AND vp.created_at <= ?

  UNION ALL

  SELECT e.id, e.created_at AS fecha,
         CONCAT('Gasto: ', e.concepto) AS concepto,
         e.monto, 'EGRESO' AS tipo, 'GASTO_OPERATIVO' AS categoria,
         e.metodo_pago
  FROM egresos_caja e
  WHERE e.sesion_caja_id = ?

  UNION ALL

  SELECT x.id, x.fecha_extraccion AS fecha,
         CONCAT('Retiro: ', COALESCE(x.motivo, 'Sin especificar')) AS concepto,
         x.monto, 'RETIRO' AS tipo, 'EXTRACCION' AS categoria,
         'efectivo' AS metodo_pago
  FROM extracciones_caja x
  WHERE x.sesion_caja_id = ?

  ORDER BY fecha DESC
`;

const traerMovimientos = (executor, sesionId, desde, hasta) =>
  executor.query(SQL_MOVIMIENTOS, [desde, hasta, desde, hasta, sesionId, sesionId]);

/**
 * Una sola fila siempre: sesión abierta (o NULL), remanente de la última
 * cerrada, y la sesión que corresponde a la fecha consultada.
 * Todo con subconsultas por índice => 1 round trip.
 */
const SQL_CONTEXTO = `
  SELECT
    a.id AS abierta_id,
    a.monto_inicial AS abierta_monto_inicial,
    a.aporte_cambio AS abierta_aporte,
    a.fecha_apertura AS abierta_fecha_apertura,
    a.monto_retirado AS abierta_monto_retirado,
    CONCAT(p.nombre, ' ', p.apellido) AS usuario_apertura,
    (SELECT c.efectivo_remanente FROM sesion_caja c
      WHERE c.estado = 'CERRADA' AND c.efectivo_remanente IS NOT NULL
      ORDER BY c.fecha_cierre DESC, c.id DESC LIMIT 1) AS remanente_anterior,
    (SELECT d.id FROM sesion_caja d
      WHERE DATE(d.fecha_apertura) <= ?
        AND (d.fecha_cierre IS NULL OR DATE(d.fecha_cierre) >= ?)
      ORDER BY d.id DESC LIMIT 1) AS dia_sesion_id,
    (SELECT d.fecha_apertura FROM sesion_caja d
      WHERE DATE(d.fecha_apertura) <= ?
        AND (d.fecha_cierre IS NULL OR DATE(d.fecha_cierre) >= ?)
      ORDER BY d.id DESC LIMIT 1) AS dia_apertura,
    (SELECT COALESCE(d.fecha_cierre, ?) FROM sesion_caja d
      WHERE DATE(d.fecha_apertura) <= ?
        AND (d.fecha_cierre IS NULL OR DATE(d.fecha_cierre) >= ?)
      ORDER BY d.id DESC LIMIT 1) AS dia_hasta,
    (SELECT d.estado FROM sesion_caja d
      WHERE DATE(d.fecha_apertura) <= ?
        AND (d.fecha_cierre IS NULL OR DATE(d.fecha_cierre) >= ?)
      ORDER BY d.id DESC LIMIT 1) AS dia_estado,
    (SELECT d.efectivo_calculado FROM sesion_caja d
      WHERE DATE(d.fecha_apertura) <= ?
        AND (d.fecha_cierre IS NULL OR DATE(d.fecha_cierre) >= ?)
      ORDER BY d.id DESC LIMIT 1) AS dia_calculado,
    (SELECT d.efectivo_contado FROM sesion_caja d
      WHERE DATE(d.fecha_apertura) <= ?
        AND (d.fecha_cierre IS NULL OR DATE(d.fecha_cierre) >= ?)
      ORDER BY d.id DESC LIMIT 1) AS dia_contado,
    (SELECT d.diferencia FROM sesion_caja d
      WHERE DATE(d.fecha_apertura) <= ?
        AND (d.fecha_cierre IS NULL OR DATE(d.fecha_cierre) >= ?)
      ORDER BY d.id DESC LIMIT 1) AS dia_diferencia,
    (SELECT d.monto_retirado FROM sesion_caja d
      WHERE DATE(d.fecha_apertura) <= ?
        AND (d.fecha_cierre IS NULL OR DATE(d.fecha_cierre) >= ?)
      ORDER BY d.id DESC LIMIT 1) AS dia_retirado,
    (SELECT d.efectivo_remanente FROM sesion_caja d
      WHERE DATE(d.fecha_apertura) <= ?
        AND (d.fecha_cierre IS NULL OR DATE(d.fecha_cierre) >= ?)
      ORDER BY d.id DESC LIMIT 1) AS dia_remanente,
        (SELECT d.monto_inicial FROM sesion_caja d
      WHERE DATE(d.fecha_apertura) <= ?
        AND (d.fecha_cierre IS NULL OR DATE(d.fecha_cierre) >= ?)
      ORDER BY d.id DESC LIMIT 1) AS dia_monto_inicial,
    (SELECT COUNT(*) FROM ventas WHERE saldo_pendiente > 0) AS fiados_cantidad,
    (SELECT COALESCE(SUM(saldo_pendiente), 0) FROM ventas WHERE saldo_pendiente > 0) AS fiados_total
  FROM (SELECT 1) x
  LEFT JOIN sesion_caja a ON a.estado = 'ABIERTA'
  LEFT JOIN personas p ON p.id = a.persona_id
  ORDER BY a.id DESC
  LIMIT 1
`;

const paramsContexto = (fecha, ahoraAR) => [
  fecha, fecha,           // dia_sesion_id
  fecha, fecha,           // dia_apertura
  ahoraAR, fecha, fecha,  // dia_hasta
  fecha, fecha,           // dia_estado
  fecha, fecha,           // dia_calculado
  fecha, fecha,           // dia_contado
  fecha, fecha,           // dia_diferencia
  fecha, fecha,           // dia_retirado
  fecha, fecha,           // dia_remanente
  fecha, fecha            // dia_monto_inicial
];

/* ============================================================
   Controlador
   ============================================================ */

const caja = {

  // 1 query. Para el guardián global y para precargar la apertura.
  getEstadoCaja: async (req, res) => {
    try {
      const fecha = obtenerFechaHoyArgentina();
      const ahoraAR = obtenerFechaHoraArgentina();
      const [rows] = await pool.query(SQL_CONTEXTO, paramsContexto(fecha, ahoraAR));
      const r = rows[0] || {};

      return res.json({
        id: r.abierta_id ?? undefined,
        abierta: Boolean(r.abierta_id),
        monto_inicial: Number(r.abierta_monto_inicial) || 0,
        aporte_cambio: Number(r.abierta_aporte) || 0,
        monto_retirado: Number(r.abierta_monto_retirado) || 0,
        fecha_apertura: r.abierta_fecha_apertura ?? undefined,
        usuario_apertura: r.usuario_apertura ?? undefined,
        remanente_anterior: Number(r.remanente_anterior) || 0,
                fiados_cantidad: Number(r.fiados_cantidad) || 0,
        fiados_total: Number(r.fiados_total) || 0,
        es_admin: esAdmin(req)
      });
    } catch (error) {
      console.error('Error en getEstadoCaja:', error);
      return res.status(500).json({ mensaje: 'Error al consultar el estado de caja' });
    }
  },

  // 2 queries secuenciales (una conexión a la vez). Arqueo calculado acá.
  getResumenCaja: async (req, res) => {
    try {
      const fecha = req.query.fecha || obtenerFechaHoyArgentina();
      const ahoraAR = obtenerFechaHoraArgentina();

      const [ctxRows] = await pool.query(SQL_CONTEXTO, paramsContexto(fecha, ahoraAR));
      const c = ctxRows[0] || {};

      const estado = {
        id: c.abierta_id ?? undefined,
        abierta: Boolean(c.abierta_id),
        monto_inicial: Number(c.abierta_monto_inicial) || 0,
        aporte_cambio: Number(c.abierta_aporte) || 0,
        monto_retirado: Number(c.abierta_monto_retirado) || 0,
        fecha_apertura: c.abierta_fecha_apertura ?? undefined,
        usuario_apertura: c.usuario_apertura ?? undefined,
        remanente_anterior: Number(c.remanente_anterior) || 0,
                fiados_cantidad: Number(c.fiados_cantidad) || 0,
        fiados_total: Number(c.fiados_total) || 0,
        es_admin: esAdmin(req)
      };

      if (!c.dia_sesion_id) {
        return res.json({
          estado,
          sesion: null,
          movimientos: [],
          arqueo: calcularArqueo([], 0)
        });
      }

      const [movimientos] = await traerMovimientos(pool, c.dia_sesion_id, c.dia_apertura, c.dia_hasta);
      const arqueo = calcularArqueo(movimientos, c.dia_monto_inicial);

      return res.json({
        estado,
        sesion: {
          id: c.dia_sesion_id,
          estado: c.dia_estado,
          monto_inicial: Number(c.dia_monto_inicial) || 0,
          fecha_apertura: c.dia_apertura,
          fecha_cierre: c.dia_estado === 'CERRADA' ? c.dia_hasta : null,
          efectivo_calculado: c.dia_calculado !== null ? Number(c.dia_calculado) : null,
          efectivo_contado: c.dia_contado !== null ? Number(c.dia_contado) : null,
          diferencia: c.dia_diferencia !== null ? Number(c.dia_diferencia) : null,
          monto_retirado: Number(c.dia_retirado) || 0,
          efectivo_remanente: c.dia_remanente !== null ? Number(c.dia_remanente) : null
        },
        movimientos,
        arqueo
      });
    } catch (error) {
      console.error('Error en getResumenCaja:', error);
      return res.status(500).json({ mensaje: 'Error al obtener el resumen de caja' });
    }
  },

  // monto_inicial = remanente anterior + aporte. NO se acepta monto del cliente.
  abrirCaja: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      if (req.body.monto_inicial !== undefined && req.body.aporte_cambio === undefined) {
        await connection.rollback();
        return res.status(400).json({
          mensaje: 'El monto inicial ya no se envía. Mandá "aporte_cambio"; el inicial se calcula como remanente anterior + aporte.'
        });
      }

      await connection.beginTransaction();

      const aporte = round2(req.body.aporte_cambio);
      if (!Number.isFinite(aporte) || aporte < 0) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'El cambio a agregar debe ser un número positivo o cero' });
      }

      const [abierta] = await connection.query(
        `SELECT id FROM sesion_caja WHERE estado = 'ABIERTA' LIMIT 1 FOR UPDATE`
      );
      if (abierta.length > 0) {
        await connection.rollback();
        return res.status(409).json({ mensaje: 'Ya existe una caja abierta' });
      }

      const [ultima] = await connection.query(
        `SELECT efectivo_remanente FROM sesion_caja
         WHERE estado = 'CERRADA' AND efectivo_remanente IS NOT NULL
         ORDER BY fecha_cierre DESC, id DESC LIMIT 1`
      );
      const remanente = round2(ultima[0]?.efectivo_remanente ?? 0);
      const montoInicial = round2(remanente + aporte);

      const [result] = await connection.query(
        `INSERT INTO sesion_caja
           (persona_id, monto_inicial, aporte_cambio, observaciones, fecha_apertura, estado)
         VALUES (?, ?, ?, ?, ?, 'ABIERTA')`,
        [personaDeReq(req), montoInicial, aporte, req.body.observaciones || null, obtenerFechaHoraArgentina()]
      );

      await connection.commit();
      return res.status(201).json({
        mensaje: 'Caja abierta con éxito',
        sesion_id: result.insertId,
        remanente_anterior: remanente,
        aporte_cambio: aporte,
        monto_inicial: montoInicial
      });
    } catch (error) {
      await connection.rollback();
      console.error('Error en abrirCaja:', error);
      return res.status(500).json({ mensaje: 'Error al abrir la caja' });
    } finally {
      connection.release();
    }
  },

  // Retiro durante la jornada. Solo ADMIN. Baja el efectivo calculado.
  registrarRetiro: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const monto = round2(req.body.monto);
      const motivo = (req.body.motivo || '').trim();

      if (!Number.isFinite(monto) || monto <= 0) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'El monto del retiro debe ser mayor a cero' });
      }
      if (!motivo) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'Indicá el motivo del retiro' });
      }

      const [sesiones] = await connection.query(
        `SELECT id, monto_inicial, fecha_apertura, monto_retirado
         FROM sesion_caja WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1 FOR UPDATE`
      );
      if (sesiones.length === 0) {
        await connection.rollback();
        return res.status(409).json({ mensaje: 'La caja está cerrada. No se pueden registrar retiros.' });
      }
      const s = sesiones[0];

      const [movimientos] = await traerMovimientos(
        connection, s.id, s.fecha_apertura, obtenerFechaHoraArgentina()
      );
      const disponible = calcularArqueo(movimientos, s.monto_inicial).efectivoCalculado;

      if (monto > disponible) {
        await connection.rollback();
        return res.status(400).json({
          mensaje: `No hay tanto efectivo en caja. Disponible según sistema: $${disponible.toFixed(2)}`
        });
      }

      await connection.query(
        `INSERT INTO extracciones_caja
           (sesion_caja_id, persona_id, monto, motivo, fecha_extraccion, origen)
         VALUES (?, ?, ?, ?, ?, 'DURANTE_JORNADA')`,
        [s.id, personaDeReq(req), monto, motivo, obtenerFechaHoraArgentina()]
      );

      await connection.query(
        `UPDATE sesion_caja SET monto_retirado = monto_retirado + ? WHERE id = ?`,
        [monto, s.id]
      );

      await connection.commit();
      return res.status(201).json({
        mensaje: 'Retiro registrado',
        monto,
        efectivo_disponible_restante: round2(disponible - monto)
      });
    } catch (error) {
      await connection.rollback();
      console.error('Error en registrarRetiro:', error);
      return res.status(500).json({ mensaje: 'Error al registrar el retiro' });
    } finally {
      connection.release();
    }
  },

  cerrarCaja: async (req, res) => {
    console.log('papa');

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { id } = req.params;
      const bodyContado = req.body.efectivo_contado;
      const bodyRetiro = req.body.monto_retirado;
      const obsDif = (req.body.observaciones_diferencia || '').trim();
      const motivoRetiro = (req.body.motivo_retiro || '').trim();

      // Campo obligatorio: si falta, error explícito (NO se convierte en 0)
      if (bodyContado === undefined || bodyContado === null || bodyContado === '') {
        await connection.rollback();
        return res.status(400).json({
          mensaje: 'Falta el efectivo contado. Se esperaba el campo "efectivo_contado".'
        });
      }

      const contado = Number(bodyContado);
      if (!Number.isFinite(contado) || contado < 0) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'El efectivo contado debe ser un número positivo o cero' });
      }

      const retiro = (bodyRetiro === undefined || bodyRetiro === null || bodyRetiro === '')
        ? 0
        : Number(bodyRetiro);

      if (!Number.isFinite(retiro) || retiro < 0) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'El retiro debe ser un número positivo o cero' });
      }
      if (retiro > 0 && !esAdmin(req)) {
        await connection.rollback();
        return res.status(403).json({ mensaje: 'Solo un administrador puede retirar efectivo de la caja' });
      }
      if (retiro > contado) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'No podés retirar más de lo que contaste en el cajón' });
      }
      if (retiro > 0 && !motivoRetiro) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'Indicá el motivo del retiro' });
      }
      if (retiro > 0 && !motivoRetiro) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'Indicá el motivo del retiro' });
      } console.log('despues del suwtvh');


      const [sesiones] = await connection.query(
        `SELECT id, monto_inicial, fecha_apertura, monto_retirado
         FROM sesion_caja WHERE id = ? AND estado = 'ABIERTA' LIMIT 1 FOR UPDATE`,
        [id]
      );
      if (sesiones.length === 0) {
        await connection.rollback();
        return res.status(409).json({ mensaje: 'La sesión no existe o ya fue cerrada' });
      }
      const s = sesiones[0];
      const ahoraAR = obtenerFechaHoraArgentina();

      // El esperado se recalcula acá, no se confía en el navegador
      const [movimientos] = await traerMovimientos(connection, s.id, s.fecha_apertura, ahoraAR);
      const calculado = calcularArqueo(movimientos, s.monto_inicial).efectivoCalculado;
      const diferencia = round2(contado - calculado);
      const remanente = round2(contado - retiro);

      if (diferencia !== 0 && !obsDif) {
        await connection.rollback();
        return res.status(400).json({
          mensaje: `Hay una diferencia de $${diferencia.toFixed(2)}. Explicala en observaciones antes de cerrar.`
        });
      }

      if (retiro > 0) {
        await connection.query(
          `INSERT INTO extracciones_caja
             (sesion_caja_id, persona_id, monto, motivo, fecha_extraccion, origen)
           VALUES (?, ?, ?, ?, ?, 'CIERRE')`,
          [s.id, personaDeReq(req), retiro, motivoRetiro, ahoraAR]
        );
      }

      await connection.query(
        `UPDATE sesion_caja SET
           estado = 'CERRADA',
           fecha_cierre = ?,
           efectivo_calculado = ?,
           efectivo_contado = ?,
           monto_cierre = ?,
           diferencia = ?,
           monto_retirado = monto_retirado + ?,
           efectivo_remanente = ?,
           persona_cierre_id = ?,
           observaciones_diferencia = ?,
           observaciones = COALESCE(?, observaciones)
         WHERE id = ?`,
        [
          ahoraAR, calculado, contado, contado, diferencia, retiro, remanente,
          personaDeReq(req), obsDif || null, req.body.observaciones || null, s.id
        ]
      );

      await connection.commit();
      return res.json({
        mensaje: 'Caja cerrada correctamente',
        efectivo_calculado: calculado,
        efectivo_contado: contado,
        diferencia,
        monto_retirado: retiro,
        efectivo_remanente: remanente
      });
    } catch (error) {
      await connection.rollback();
      console.error('Error en cerrarCaja:', error);
      return res.status(500).json({ mensaje: 'Error al cerrar la caja' });
    } finally {
      connection.release();
    }
  },

  registrarEgreso: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { concepto, metodo_pago } = req.body;
      const monto = round2(req.body.monto);

      if (!concepto || !concepto.trim() || !Number.isFinite(monto) || monto <= 0) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'Concepto y monto válido son requeridos' });
      }

      const [sesion] = await connection.query(
        `SELECT id FROM sesion_caja WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1 FOR UPDATE`
      );
      if (sesion.length === 0) {
        await connection.rollback();
        return res.status(409).json({ mensaje: 'La caja está cerrada. Abrí la caja para registrar egresos.' });
      }

      const [result] = await connection.query(
        `INSERT INTO egresos_caja
           (sesion_caja_id, persona_id, concepto, monto, metodo_pago, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sesion[0].id, personaDeReq(req), concepto.trim(), monto,
        metodo_pago || 'efectivo', obtenerFechaHoraArgentina()]
      );

      await connection.commit();
      return res.status(201).json({ mensaje: 'Egreso registrado correctamente', id: result.insertId });
    } catch (error) {
      await connection.rollback();
      console.error('Error en registrarEgreso:', error);
      return res.status(500).json({ mensaje: 'Error al registrar el egreso' });
    } finally {
      connection.release();
    }
  }
};

export default caja;