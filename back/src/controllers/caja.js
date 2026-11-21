import { pool } from '../config/database.js';
import { obtenerFechaHoraArgentina } from '../utils/dateUtils.js';

const caja = {
getEstadoCaja: async (req, res) => {
  try {
    const [sesionAbierta] = await pool.query(
      `SELECT s.id, s.monto_inicial, s.fecha_apertura, CONCAT(p.nombre, ' ', p.apellido) AS usuario_apertura
       FROM sesion_caja s
       JOIN personas p ON s.persona_id = p.id
       WHERE s.estado = 'ABIERTA' 
       ORDER BY s.id DESC LIMIT 1`
    );

    if (sesionAbierta.length === 0) {
      return res.json({
        abierta: false,
        monto_inicial: 0
      });
    }

    const sesion = sesionAbierta[0];

    return res.json({
      id: sesion.id,
      abierta: true,
      monto_inicial: Number(sesion.monto_inicial) || 0,
      fecha_apertura: sesion.fecha_apertura,
      usuario_apertura: sesion.usuario_apertura
    });

  } catch (error) {
    console.error('Error en getEstadoCaja:', error);
    return res.status(500).json({ mensaje: 'Error al consultar estado de caja' });
  }
},

  getMovimientos: async (req, res) => {
  try {
    const [sesionAbierta] = await pool.query(
      `SELECT * FROM sesion_caja WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`
    );

    if (sesionAbierta.length === 0) {
      return res.json([]);
    }

    const fechaApertura = sesionAbierta[0].fecha_apertura;
    const sesionId = sesionAbierta[0].id;

    const query = `
      SELECT 
        c.id,
        c.created_at AS fecha,
        CONCAT('Cuota / Plan - Alumno: ', p.nombre, ' ', p.apellido) AS concepto,
        c.monto,
        'INGRESO' AS tipo,
        'CUOTA_ALUMNO' AS categoria,
        c.metodo_cobro AS metodo_pago
      FROM cobros c
      JOIN personas p ON c.persona_id = p.id
      WHERE c.created_at >= ?

      UNION ALL

      SELECT 
        v.id,
        v.fecha_venta AS fecha,
        CONCAT('Venta de insumos (Ticket #', v.id, ')') AS concepto,
        v.total AS monto,
        'INGRESO' AS tipo,
        'VENTA_PRODUCTO' AS categoria,
        v.metodo_pago
      FROM ventas v
      WHERE v.fecha_venta >= ?

      UNION ALL

      SELECT 
        e.id,
        e.created_at AS fecha,
        e.concepto,
        e.monto,
        'EGRESO' AS tipo,
        'GASTO_OPERATIVO' AS categoria,
        e.metodo_pago
      FROM egresos_caja e
      WHERE e.sesion_caja_id = ?

      ORDER BY fecha DESC
    `;

    const [movimientos] = await pool.query(query, [fechaApertura, fechaApertura, sesionId]);
    return res.json(movimientos);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ mensaje: 'Error al obtener movimientos de caja' });
  }
},

  abrirCaja: async (req, res) => {
    try {
      const { monto_inicial, observaciones } = req.body;
      const persona_id = req.usuario?.persona_id || req.usuario?.id;
      const fechaAperturaAR = obtenerFechaHoraArgentina();

      const [cajaExistente] = await pool.query(`SELECT id FROM sesion_caja WHERE estado = 'ABIERTA'`);
      if (cajaExistente.length > 0) {
        return res.status(400).json({ mensaje: 'Ya existe una caja abierta en este momento' });
      }

      const [result] = await pool.query(
        `INSERT INTO sesion_caja (persona_id, monto_inicial, observaciones, fecha_apertura) 
         VALUES (?, ?, ?, ?)`,
        [persona_id, monto_inicial || 0, observaciones || null, fechaAperturaAR]
      );

      return res.status(201).json({
        mensaje: 'Caja abierta con éxito',
        sesion_id: result.insertId
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: 'Error al abrir la caja' });
    }
  },

  cerrarCaja: async (req, res) => {
    try {
      const { id } = req.params;
      const { monto_cierre, observaciones } = req.body;
      const fechaCierreAR = obtenerFechaHoraArgentina();

      const [result] = await pool.query(
        `UPDATE sesion_caja 
         SET monto_cierre = ?, fecha_cierre = ?, estado = 'CERRADA', observaciones = COALESCE(?, observaciones)
         WHERE id = ? AND estado = 'ABIERTA'`,
        [monto_cierre, fechaCierreAR, observaciones || null, id]
      );

      if (result.affectedRows === 0) {
        return res.status(400).json({ mensaje: 'No se encontró la caja abierta o ya fue cerrada previamente' });
      }

      return res.json({ mensaje: 'Caja cerrada correctamente' });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: 'Error al cerrar la caja' });
    }
  },

  registrarEgreso: async (req, res) => {
    try {
      const { concepto, monto, metodo_pago } = req.body;
      const persona_id = req.usuario?.persona_id || req.usuario?.id;
      const fechaEgresoAR = obtenerFechaHoraArgentina();

      if (!concepto || !monto || monto <= 0) {
        return res.status(400).json({ mensaje: 'Concepto y monto válido son requeridos' });
      }

      const [sesion] = await pool.query(`SELECT id FROM sesion_caja WHERE estado = 'ABIERTA' LIMIT 1`);
      const sesion_caja_id = sesion.length > 0 ? sesion[0].id : null;

      const [result] = await pool.query(
        `INSERT INTO egresos_caja (sesion_caja_id, persona_id, concepto, monto, metodo_pago, created_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sesion_caja_id, persona_id, concepto, monto, metodo_pago || 'efectivo', fechaEgresoAR]
      );

      return res.status(201).json({
        mensaje: 'Egreso registrado correctamente',
        id: result.insertId
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: 'Error al registrar el egreso' });
    }
  }
};

export default caja;