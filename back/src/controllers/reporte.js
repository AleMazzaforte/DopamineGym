import { pool } from '../config/database.js';
import { obtenerFechaHoyArgentina } from '../utils/dateUtils.js';
import { ErrorRegla, rollbackSeguro, round2 } from '../utils/blindajeDeCaja.js';

const METODOS = ['efectivo', 'transferencia', 'tarjetas', 'QR', 'debito_automatico'];

const mapaVacio = () => Object.fromEntries(METODOS.map(m => [m, 0]));

const validarPeriodo = (periodo) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(periodo || ''))) {
    throw new ErrorRegla(400, 'Período inválido. Usá el formato YYYY-MM (ej: 2026-11)');
  }
  return periodo;
};

/**
 * Una sola query trae ingresos, egresos y extracciones agrupados.
 * Mes de cada movimiento: cobros=fecha_cobro, ventas=fecha_venta,
 * egresos=created_at, extracciones=periodo_contable.
 */
const SQL_MOVIMIENTOS_MES = `
  SELECT clase, origen, metodo_pago, SUM(monto) AS total, COUNT(*) AS cantidad
  FROM (
    SELECT 'INGRESO' AS clase, 'CUOTA' AS origen, c.metodo_cobro AS metodo_pago, c.monto
    FROM cobros c WHERE DATE_FORMAT(c.fecha_cobro, '%Y-%m') = ?

    UNION ALL

    SELECT 'INGRESO' AS clase, 'VENTA' AS origen, v.metodo_pago, v.total
    FROM ventas v WHERE DATE_FORMAT(v.fecha_venta, '%Y-%m') = ?

    UNION ALL

    SELECT 'COBRADO' AS clase, 'VENTA' AS origen, vp.metodo_pago, vp.monto
    FROM venta_pagos vp WHERE vp.periodo_contable = ?

    UNION ALL

    SELECT 'EGRESO' AS clase, 'GASTO' AS origen, e.metodo_pago, e.monto
    FROM egresos_caja e WHERE DATE_FORMAT(e.created_at, '%Y-%m') = ?

    UNION ALL

    SELECT 'RETIRO' AS clase, 'EXTRACCION' AS origen, 'efectivo' AS metodo_pago, x.monto
    FROM extracciones_caja x WHERE x.periodo_contable = ?
  ) t
  GROUP BY clase, origen, metodo_pago
`;

const SQL_SESIONES_MES = `
  SELECT
    COALESCE(SUM(CASE WHEN estado='CERRADA' AND DATE_FORMAT(fecha_cierre,'%Y-%m') = ? THEN diferencia ELSE 0 END), 0) AS diferencias_netas,
    COALESCE(SUM(CASE WHEN estado='CERRADA' AND DATE_FORMAT(fecha_cierre,'%Y-%m') = ? THEN 1 ELSE 0 END), 0) AS sesiones_cerradas,
    COALESCE(SUM(CASE WHEN estado='CERRADA' AND DATE_FORMAT(fecha_cierre,'%Y-%m') = ? AND efectivo_calculado IS NULL THEN 1 ELSE 0 END), 0) AS sesiones_sin_arqueo,
    COALESCE(SUM(CASE WHEN estado='CERRADA' AND DATE_FORMAT(fecha_cierre,'%Y-%m') = ? THEN monto_retirado ELSE 0 END), 0) AS retirado_sesiones,
    COALESCE(SUM(CASE WHEN DATE_FORMAT(fecha_apertura,'%Y-%m') = ? THEN aporte_cambio ELSE 0 END), 0) AS aportes_cambio,
    (SELECT efectivo_remanente FROM sesion_caja
      WHERE estado='CERRADA' AND DATE_FORMAT(fecha_cierre,'%Y-%m') = ?
      ORDER BY fecha_cierre DESC, id DESC LIMIT 1) AS remanente_fin_mes
  FROM sesion_caja
  WHERE DATE_FORMAT(fecha_cierre,'%Y-%m') = ?
     OR DATE_FORMAT(fecha_apertura,'%Y-%m') = ?
`;

/** 3 queries secuenciales (una conexión a la vez) */
const calcularReporte = async (executor, periodo, esAdmin) => {
  const [filas] = await executor.query(SQL_MOVIMIENTOS_MES, [periodo, periodo, periodo, periodo, periodo]);

  const ingresosPorMetodo = mapaVacio();
  const cobradoPorMetodo = mapaVacio();
  const egresosPorMetodo = mapaVacio();
  let extracciones = 0;
  let cantidadCobros = 0;
  let cantidadVentas = 0;

  const sumar = (mapa, metodo, monto) => {
    if (mapa[metodo] !== undefined) mapa[metodo] = round2(mapa[metodo] + monto);
  };

  for (const f of filas) {
    const monto = round2(f.total);
    const cantidad = Number(f.cantidad) || 0;

    if (f.clase === 'INGRESO') {
      sumar(ingresosPorMetodo, f.metodo_pago, monto);
      if (f.origen === 'CUOTA') {
        cantidadCobros += cantidad;
        sumar(cobradoPorMetodo, f.metodo_pago, monto); // la cuota siempre se cobra
      }
      if (f.origen === 'VENTA') cantidadVentas += cantidad;
    } else if (f.clase === 'COBRADO') {
      sumar(cobradoPorMetodo, f.metodo_pago, monto);   // cobros de ventas, incl. fiados saldados
    } else if (f.clase === 'EGRESO') {
      sumar(egresosPorMetodo, f.metodo_pago, monto);
    } else if (f.clase === 'RETIRO') {
      extracciones = round2(extracciones + monto);
    }
  }

  const totalFacturado = round2(Object.values(ingresosPorMetodo).reduce((a, b) => a + b, 0));
  const totalCobrado = round2(Object.values(cobradoPorMetodo).reduce((a, b) => a + b, 0));
  const totalEgresos = round2(Object.values(egresosPorMetodo).reduce((a, b) => a + b, 0));

  const [sesRows] = await executor.query(SQL_SESIONES_MES, [
    periodo, periodo, periodo, periodo, periodo, periodo, periodo, periodo
  ]);
  const s = sesRows[0] || {};
  const diferenciasNetas = round2(s.diferencias_netas);

  const [cierreRows] = await executor.query(
    `SELECT cm.periodo, cm.cerrado_at, CONCAT(p.nombre, ' ', p.apellido) AS cerrado_por
     FROM cierres_mensuales cm JOIN personas p ON p.id = cm.persona_id
     WHERE cm.periodo = ? LIMIT 1`,
    [periodo]
  );
  const cierre = cierreRows[0] || null;

  return {
    periodo,
    cerrado: Boolean(cierre),
    cierre: cierre ? { cerrado_at: cierre.cerrado_at, cerrado_por: cierre.cerrado_por } : null,
    es_admin: esAdmin,
    sesiones_cerradas: Number(s.sesiones_cerradas) || 0,
    sesiones_sin_arqueo: Number(s.sesiones_sin_arqueo) || 0,
    ingresos: {
      por_metodo: ingresosPorMetodo,
      total: totalFacturado,
      cantidad_cobros: cantidadCobros,
      cantidad_ventas: cantidadVentas
    },
    cobrado: {
      por_metodo: cobradoPorMetodo,
      total: totalCobrado
    },
    conciliacion: {
      facturado_efectivo: ingresosPorMetodo.efectivo,
      cobrado_efectivo: cobradoPorMetodo.efectivo,
      diferencias_netas: diferenciasNetas,
      efectivo_conciliado: round2(cobradoPorMetodo.efectivo + diferenciasNetas)
    },
    egresos: { por_metodo: egresosPorMetodo, total: totalEgresos },
    movimiento_efectivo: {
      extracciones,
      egresos_efectivo: egresosPorMetodo.efectivo,
      aportes_cambio: round2(s.aportes_cambio),
      remanente_fin_mes: round2(s.remanente_fin_mes)
    }
  };
};

const reporte = {

      // Panorama general de alumnos. Una query principal sobre v_estado_alumnos +
  // tres subconsultas de agregados (pagos, deudas vencidas, compras).
  getPanoramaAlumnos: async (req, res) => {
    try {
      const { buscar, solo_con_deuda, solo_provisorios, solo_inactivos } = req.query;

      let where = '1=1';
      const params = [];

      if (buscar && String(buscar).trim()) {
        where += ' AND (a.dni LIKE ? OR a.apellido LIKE ? OR a.nombre LIKE ?)';
        const term = `%${String(buscar).trim()}%`;
        params.push(term, term, term);
      }
      if (solo_provisorios === '1') where += " AND a.estado_efectivo = 'ACTIVO PROVISORIO'";
      if (solo_inactivos === '1') where += " AND a.estado_efectivo IN ('INACTIVO','BAJA','SIN ESTADO')";

      const sql = `
        SELECT
          a.persona_id, a.dni, a.nombre, a.apellido, a.telefono,
          a.estado_efectivo AS estado,
          a.plan_nombre,
          a.cobertura_fin,
          COALESCE(pag.total_pagado, 0) AS total_pagado,
          pag.ultimo_pago_fecha,
          pag.ultimo_pago_monto,
          COALESCE(dv.deuda_vencida, 0) AS deuda_vencida,
          dv.cantidad_coberturas_vencidas,
          COALESCE(dt.deuda_total, 0) AS deuda_total,
          dt.coberturas_con_deuda,
          dt.primera_deuda_vence,
          COALESCE(comp.cantidad_compras, 0) AS cantidad_compras,
          COALESCE(comp.total_compras, 0) AS total_compras
        FROM v_estado_alumnos a
        LEFT JOIN (
          SELECT c.persona_id,
                 SUM(c.monto) AS total_pagado,
                 MAX(c.fecha_cobro) AS ultimo_pago_fecha,
                 (SELECT c2.monto FROM cobros c2
                  WHERE c2.persona_id = c.persona_id
                  ORDER BY c2.fecha_cobro DESC, c2.id DESC LIMIT 1) AS ultimo_pago_monto
          FROM cobros c
          GROUP BY c.persona_id
        ) pag ON pag.persona_id = a.persona_id
        LEFT JOIN (
          SELECT pa.persona_id,
                 SUM(pc.saldo_pendiente) AS deuda_vencida,
                 COUNT(*) AS cantidad_coberturas_vencidas
          FROM periodos_cobertura pc
          INNER JOIN periodos_alumno pa ON pa.id = pc.periodo_alumno_id
          WHERE pc.saldo_pendiente > 0 AND pc.fecha_fin < CURDATE()
          GROUP BY pa.persona_id
        ) dv ON dv.persona_id = a.persona_id
        LEFT JOIN (
          SELECT pa.persona_id,
                 SUM(pc.saldo_pendiente) AS deuda_total,
                 COUNT(*) AS coberturas_con_deuda,
                 MIN(pc.fecha_fin) AS primera_deuda_vence
          FROM periodos_cobertura pc
          INNER JOIN periodos_alumno pa ON pa.id = pc.periodo_alumno_id
          WHERE pc.saldo_pendiente > 0
          GROUP BY pa.persona_id
        ) dt ON dt.persona_id = a.persona_id
        LEFT JOIN (
          SELECT v.persona_id,
                 COUNT(*) AS cantidad_compras,
                 SUM(v.total) AS total_compras
          FROM ventas v
          WHERE v.persona_id IS NOT NULL
          GROUP BY v.persona_id
        ) comp ON comp.persona_id = a.persona_id
        WHERE ${where}
        ORDER BY
          CASE WHEN COALESCE(dv.deuda_vencida, 0) > 0 THEN 0 ELSE 1 END,
          CASE WHEN COALESCE(dt.deuda_total, 0) > 0 THEN 0 ELSE 1 END,
          a.apellido ASC, a.nombre ASC
      `;

      const [rows] = await pool.query(sql, params);

      let resultado = rows;
      if (solo_con_deuda === '1') {
        resultado = rows.filter(r => Number(r.deuda_total) > 0 || Number(r.deuda_vencida) > 0);
      }

      return res.json(resultado);
    } catch (error) {
      console.error('Error en getPanoramaAlumnos:', error);
      return res.status(500).json({ mensaje: 'Error al obtener el panorama de alumnos' });
    }
  },

  getMensual: async (req, res) => {
    try {
      const periodo = validarPeriodo(req.query.periodo || obtenerFechaHoyArgentina().slice(0, 7));
      const data = await calcularReporte(pool, periodo, req.usuario?.rol === 'ADMIN');
      return res.json(data);
    } catch (error) {
      if (error instanceof ErrorRegla) {
        return res.status(error.status).json({ mensaje: error.message });
      }
      console.error('Error en getMensual:', error);
      return res.status(500).json({ mensaje: 'Error al generar el reporte mensual' });
    }
  },

  // Congela la foto del mes. Desde acá, cobros/ventas de ese mes quedan bloqueados.
  contabilizar: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const periodo = validarPeriodo(req.body.periodo);
      const mesActual = obtenerFechaHoyArgentina().slice(0, 7);

      if (periodo > mesActual) {
        throw new ErrorRegla(400, 'No se puede contabilizar un mes que todavía no terminó');
      }

      const [yaCerrado] = await connection.query(
        `SELECT periodo FROM cierres_mensuales WHERE periodo = ? LIMIT 1 FOR UPDATE`,
        [periodo]
      );
      if (yaCerrado.length > 0) {
        throw new ErrorRegla(409, `El mes ${periodo} ya está contabilizado`);
      }

      const [abiertas] = await connection.query(
        `SELECT id FROM sesion_caja
         WHERE estado = 'ABIERTA' AND DATE_FORMAT(fecha_apertura, '%Y-%m') <= ?
         LIMIT 1`,
        [periodo]
      );
      if (abiertas.length > 0) {
        throw new ErrorRegla(409, 'Hay una caja abierta. Cerrala antes de contabilizar el mes.');
      }

      const r = await calcularReporte(connection, periodo, true);

      await connection.query(
        `INSERT INTO cierres_mensuales
           (periodo, persona_id, total_facturado, total_efectivo_conciliado,
            total_extracciones, total_egresos_operativos, total_diferencias,
            total_aportes_cambio, detalle_por_medio)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          periodo,
          req.usuario?.persona_id || req.usuario?.id,
          r.ingresos.total,
          r.conciliacion.efectivo_conciliado,
          r.movimiento_efectivo.extracciones,
          r.egresos.total,
          r.conciliacion.diferencias_netas,
          r.movimiento_efectivo.aportes_cambio,
          JSON.stringify({ ingresos: r.ingresos.por_metodo, egresos: r.egresos.por_metodo })
        ]
      );

      await connection.commit();
      return res.status(201).json({
        mensaje: `Mes ${periodo} contabilizado. Sus movimientos ya no se pueden modificar.`,
        reporte: r
      });
    } catch (error) {
      await rollbackSeguro(connection);
      if (error instanceof ErrorRegla) {
        return res.status(error.status).json({ mensaje: error.message });
      }
      console.error('Error en contabilizar:', error);
      return res.status(500).json({ mensaje: 'Error al contabilizar el mes' });
    } finally {
      if (connection) connection.release();
    }
  },

  // Escape hatch: si cerraste un mes por error, esto lo reabre.
  reabrir: async (req, res) => {
    try {
      const periodo = validarPeriodo(req.params.periodo);
      const [result] = await pool.query(
        `DELETE FROM cierres_mensuales WHERE periodo = ?`,
        [periodo]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ mensaje: `El mes ${periodo} no estaba contabilizado` });
      }
      return res.json({ mensaje: `Mes ${periodo} reabierto. Sus movimientos vuelven a ser editables.` });
    } catch (error) {
      if (error instanceof ErrorRegla) {
        return res.status(error.status).json({ mensaje: error.message });
      }
      console.error('Error en reabrir:', error);
      return res.status(500).json({ mensaje: 'Error al reabrir el mes' });
    }
  },

    // Historial completo de un alumno: membresías + coberturas, pagos y estados.
  // 4 queries secuenciales sobre una conexión a la vez.
  getHistorialAlumno: async (req, res) => {
    try {
      const personaId = Number(req.params.personaId);
      if (!Number.isInteger(personaId) || personaId <= 0) {
        return res.status(400).json({ mensaje: 'Alumno inválido' });
      }

      const [alumnoRows] = await pool.query(
        `SELECT persona_id, dni, nombre, apellido, telefono,
                estado_efectivo AS estado, plan_nombre,
                DATE_FORMAT(cobertura_fin, '%Y-%m-%d') AS cobertura_fin,
                COALESCE(saldo_pendiente, 0) AS deuda_total, tiene_deuda
         FROM v_estado_alumnos
         WHERE persona_id = ? LIMIT 1`,
        [personaId]
      );
      if (alumnoRows.length === 0) {
        return res.status(404).json({ mensaje: 'Alumno no encontrado' });
      }

      const [periodoRows] = await pool.query(
        `SELECT pa.id AS periodo_id,
                DATE_FORMAT(pa.fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
                DATE_FORMAT(pa.fecha_cierre, '%Y-%m-%d') AS fecha_cierre,
                pa.motivo_cierre, pa.observaciones,
                pc.id AS cobertura_id, pc.plan_id,
                DATE_FORMAT(pc.fecha_inicio, '%Y-%m-%d') AS cobertura_inicio,
                DATE_FORMAT(pc.fecha_fin, '%Y-%m-%d') AS cobertura_fin,
                pc.precio_aplicado, pc.saldo_pendiente,
                pl.nombre AS plan_nombre, pl.precio AS precio_lista, pl.duracion_meses
         FROM periodos_alumno pa
         LEFT JOIN periodos_cobertura pc ON pc.periodo_alumno_id = pa.id
         LEFT JOIN planes pl ON pl.id = pc.plan_id
         WHERE pa.persona_id = ?
         ORDER BY pa.fecha_inicio DESC, pa.id DESC, pc.fecha_inicio ASC`,
        [personaId]
      );

      const mapa = new Map();
      for (const r of periodoRows) {
        if (!mapa.has(r.periodo_id)) {
          mapa.set(r.periodo_id, {
            periodo_id: r.periodo_id,
            fecha_inicio: r.fecha_inicio,
            fecha_cierre: r.fecha_cierre,
            motivo_cierre: r.motivo_cierre,
            observaciones: r.observaciones,
            coberturas: []
          });
        }
        if (r.cobertura_id) {
          mapa.get(r.periodo_id).coberturas.push({
            cobertura_id: r.cobertura_id,
            plan_id: r.plan_id,
            plan_nombre: r.plan_nombre,
            fecha_inicio: r.cobertura_inicio,
            fecha_fin: r.cobertura_fin,
            precio_aplicado: Number(r.precio_aplicado) || 0,
            saldo_pendiente: Number(r.saldo_pendiente) || 0,
            precio_lista: r.precio_lista !== null ? Number(r.precio_lista) : null,
            duracion_meses: r.duracion_meses
          });
        }
      }
      const periodos = Array.from(mapa.values());

      const [pagos] = await pool.query(
        `SELECT id,
                DATE_FORMAT(fecha_cobro, '%Y-%m-%d') AS fecha_cobro,
                monto, metodo_cobro, descripcion, periodo_alumno_id,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS registrado_at
         FROM cobros
         WHERE persona_id = ?
         ORDER BY fecha_cobro DESC, id DESC`,
        [personaId]
      );

      const [estados] = await pool.query(
        `SELECT id, estado,
                DATE_FORMAT(fecha_cambio, '%Y-%m-%d') AS fecha_cambio,
                motivo, observaciones,
                DATE_FORMAT(fecha_promesa_pago, '%Y-%m-%d') AS fecha_promesa_pago,
                periodo_alumno_id
         FROM persona_estados
         WHERE persona_id = ?
         ORDER BY id DESC`,
        [personaId]
      );

      // Compras: queda preparado para el módulo de productos.
      // Cuando exista venta con comprador, descomentar y devolver filas:
      // const [compras] = await pool.query(
      //   `SELECT v.id, DATE_FORMAT(v.fecha_venta,'%Y-%m-%d %H:%i') AS fecha, v.total, v.metodo_pago
      //    FROM ventas v WHERE v.persona_id = ? ORDER BY v.fecha_venta DESC`, [personaId]);
      const compras = [];

      return res.json({ alumno: alumnoRows[0], periodos, pagos, estados, compras });
    } catch (error) {
      console.error('Error en getHistorialAlumno:', error);
      return res.status(500).json({ mensaje: 'Error al obtener el historial del alumno' });
    }
  },
};

export default reporte;