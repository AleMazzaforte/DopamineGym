import { pool } from '../config/database.js';
import { obtenerFechaHoyArgentina, obtenerFechaHoraArgentina } from '../utils/dateUtils.js';
import {
  ErrorRegla, rollbackSeguro, round2, validarMetodo,
  exigirCajaAbierta, exigirMesAbierto, exigirMovimientoEditable
} from '../utils/blindajeDeCaja.js';

const cobro = {

  getAll: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT c.*, COALESCE(c.persona_id, pa.persona_id) AS persona_id,
          p.nombre, p.apellido, p.dni, pc.fecha_inicio AS cobertura_inicio,
          pc.fecha_fin AS cobertura_fin, pl.nombre AS plan_nombre, pl.precio AS plan_precio
        FROM cobros c
        LEFT JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        LEFT JOIN personas p ON p.id = COALESCE(c.persona_id, pa.persona_id)
        LEFT JOIN (
          SELECT periodo_alumno_id, plan_id, fecha_inicio, fecha_fin
          FROM periodos_cobertura pc1
          WHERE pc1.fecha_inicio = (SELECT MAX(fecha_inicio) FROM periodos_cobertura pc2 WHERE pc2.periodo_alumno_id = pc1.periodo_alumno_id)
        ) pc ON pc.periodo_alumno_id = c.periodo_alumno_id
        LEFT JOIN planes pl ON pl.id = pc.plan_id
        ORDER BY c.fecha_cobro DESC
      `);
      res.json(rows);
    } catch (error) {
      console.error('Error en getAll:', error);
      res.status(500).json({ error: 'Error al obtener cobros' });
    }
  },

  getByRangoFechas: async (req, res) => {
    try {
      const { fechaDesde, fechaHasta, personaId } = req.query;
      if (!fechaDesde || !fechaHasta) {
        return res.status(400).json({ error: 'fechaDesde y fechaHasta son requeridos' });
      }

      let sql = `SELECT c.*, COALESCE(c.persona_id, pa.persona_id) AS persona_id, p.nombre, p.apellido, p.dni
        FROM cobros c LEFT JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        LEFT JOIN personas p ON p.id = COALESCE(c.persona_id, pa.persona_id)
        WHERE c.fecha_cobro BETWEEN ? AND ?`;
      const params = [fechaDesde, fechaHasta];

      if (personaId) {
        sql += ` AND COALESCE(c.persona_id, pa.persona_id) = ?`;
        params.push(personaId);
      }
      sql += ` ORDER BY c.fecha_cobro DESC`;

      const [rows] = await pool.query(sql, params);
      res.json(rows);
    } catch (error) {
      console.error('Error en getByRangoFechas:', error);
      res.status(500).json({ error: 'Error al obtener cobros por rango' });
    }
  },

  getByPersona: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT c.*, COALESCE(c.persona_id, pa.persona_id) AS persona_id, p.nombre, p.apellido, p.dni
        FROM cobros c LEFT JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        LEFT JOIN personas p ON p.id = COALESCE(c.persona_id, pa.persona_id)
        WHERE COALESCE(c.persona_id, pa.persona_id) = ? ORDER BY c.fecha_cobro DESC
      `, [req.params.personaId]);
      res.json(rows);
    } catch (error) {
      console.error('Error en getByPersona:', error);
      res.status(500).json({ error: 'Error al obtener cobros del alumno' });
    }
  },

  getByMetodoPago: async (req, res) => {
    try {
      const { metodo } = req.query;
      if (!metodo) return res.status(400).json({ error: 'metodo es requerido' });

      const [rows] = await pool.query(`
        SELECT c.*, COALESCE(c.persona_id, pa.persona_id) AS persona_id, p.nombre, p.apellido, p.dni
        FROM cobros c LEFT JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        LEFT JOIN personas p ON p.id = COALESCE(c.persona_id, pa.persona_id)
        WHERE c.metodo_cobro = ? ORDER BY c.fecha_cobro DESC
      `, [metodo]);
      res.json(rows);
    } catch (error) {
      console.error('Error en getByMetodoPago:', error);
      res.status(500).json({ error: 'Error al obtener cobros por método' });
    }
  },

  getPeriodoActivoWithPlan: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT pa.id AS periodo_id, pa.fecha_inicio AS membresia_inicio, pc.id AS cobertura_id,
          pc.plan_id, pc.fecha_inicio AS cobertura_inicio, pc.fecha_fin AS cobertura_fin,
          pl.nombre AS plan_nombre, pl.precio AS plan_precio
        FROM periodos_alumno pa INNER JOIN periodos_cobertura pc ON pa.id = pc.periodo_alumno_id
        LEFT JOIN planes pl ON pc.plan_id = pl.id
        WHERE pa.persona_id = ? AND pa.fecha_cierre IS NULL AND ? BETWEEN pc.fecha_inicio AND pc.fecha_fin
        ORDER BY pc.fecha_fin DESC LIMIT 1
      `, [req.params.personaId, obtenerFechaHoyArgentina()]);

      res.json(rows.length > 0 ? rows[0] : null);
    } catch (error) {
      console.error('Error en getPeriodoActivoWithPlan:', error);
      res.status(500).json({ error: 'Error al obtener período activo' });
    }
  },

  // ==========================================================
  // CREATE — fecha del servidor + caja abierta + mes abierto
  // ==========================================================
  create: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const {
        personaId, planId, metodo_cobro, fechaInicio, fechaFin,
        descripcion, precio_acordado, es_pago_parcial
      } = req.body;

      // 🔒 La fecha NO viene del cliente
      const fechaCobro = obtenerFechaHoyArgentina();
      const ahoraAR = obtenerFechaHoraArgentina();
      const periodo = fechaCobro.slice(0, 7);

      const montoPagado = round2(req.body.monto);
      if (!Number.isFinite(montoPagado) || montoPagado <= 0) {
        throw new ErrorRegla(400, 'El monto del cobro debe ser mayor a cero');
      }
      if (!personaId || !planId) {
        throw new ErrorRegla(400, 'Alumno y plan son requeridos');
      }
      if (!fechaInicio || !fechaFin) {
        throw new ErrorRegla(400, 'Las fechas de cobertura son requeridas');
      }
      validarMetodo(metodo_cobro);

      // 🔒 Cerraduras
      await exigirCajaAbierta(connection);
      await exigirMesAbierto(connection, periodo);

      const precioAcordado = round2(precio_acordado || montoPagado);
      const saldoPendiente = es_pago_parcial ? Math.max(0, round2(precioAcordado - montoPagado)) : 0;
      const hoy = fechaCobro;

      // 1. Buscar periodo abierto
      const [periodos] = await connection.query(
        `SELECT id FROM periodos_alumno WHERE persona_id = ? AND fecha_cierre IS NULL LIMIT 1`,
        [personaId]
      );

      let periodoAlumnoId;

      if (periodos.length > 0) {
        const periodoAnteriorId = periodos[0].id;
        await connection.query(
          `UPDATE periodos_alumno SET fecha_cierre = ?, motivo_cierre = 'Renovación' WHERE id = ?`,
          [fechaInicio, periodoAnteriorId]
        );
        const [result] = await connection.query(
          `INSERT INTO periodos_alumno (persona_id, fecha_inicio, fecha_cierre) VALUES (?, ?, NULL)`,
          [personaId, fechaInicio]
        );
        periodoAlumnoId = result.insertId;
      } else {
        const [result] = await connection.query(
          `INSERT INTO periodos_alumno (persona_id, fecha_inicio, fecha_cierre) VALUES (?, ?, NULL)`,
          [personaId, fechaInicio]
        );
        periodoAlumnoId = result.insertId;
      }

      // 2. Cobertura con lógica de deuda
      await connection.query(
        `INSERT INTO periodos_cobertura
           (periodo_alumno_id, plan_id, fecha_inicio, fecha_fin, precio_aplicado, saldo_pendiente)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [periodoAlumnoId, planId, fechaInicio, fechaFin, montoPagado, saldoPendiente]
      );

      // 3. Cobro — created_at explícito en AR (no DEFAULT UTC)
      const [cobroResult] = await connection.query(
        `INSERT INTO cobros
           (persona_id, periodo_alumno_id, fecha_cobro, monto, metodo_cobro, descripcion, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [personaId, periodoAlumnoId, fechaCobro, montoPagado, metodo_cobro, descripcion || null, ahoraAR]
      );

      // 4. Estado del alumno
      await connection.query(
        `INSERT INTO persona_estados
           (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo)
         VALUES (?, 'ACTIVO', ?, ?, ?, 'Cobro registrado')`,
        [personaId, hoy, fechaFin, periodoAlumnoId]
      );

      await connection.commit();

      res.status(201).json({
        id: cobroResult.insertId,
        persona_id: personaId,
        periodo_alumno_id: periodoAlumnoId,
        fecha_cobro: fechaCobro,
        monto: montoPagado,
        metodo_cobro,
        descripcion: descripcion || null,
        mensaje: 'Cobro registrado exitosamente'
      });
    } catch (error) {
      await rollbackSeguro(connection);
      if (error instanceof ErrorRegla) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Error en create:', error);
      res.status(500).json({ error: 'Error al crear cobro' });
    } finally {
      if (connection) connection.release();
    }
  },

  // ==========================================================
  // COMPLETAR DEUDA — mismas cerraduras
  // ==========================================================
  completarDeuda: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const { coberturaId } = req.params;
      const { metodo_cobro, descripcion } = req.body;

      // 🔒 Fecha del servidor
      const fechaPago = obtenerFechaHoyArgentina();
      const ahoraAR = obtenerFechaHoraArgentina();
      const periodo = fechaPago.slice(0, 7);

      const montoPagado = round2(req.body.monto);
      if (!Number.isFinite(montoPagado) || montoPagado <= 0) {
        throw new ErrorRegla(400, 'El monto debe ser mayor a cero');
      }
      validarMetodo(metodo_cobro);

      // 🔒 Cerraduras
      await exigirCajaAbierta(connection);
      await exigirMesAbierto(connection, periodo);

      const [coberturas] = await connection.query(`
        SELECT pc.id, pc.saldo_pendiente, pc.precio_aplicado, pc.periodo_alumno_id, pa.persona_id
        FROM periodos_cobertura pc
        INNER JOIN periodos_alumno pa ON pa.id = pc.periodo_alumno_id
        WHERE pc.id = ?
        FOR UPDATE
      `, [coberturaId]);

      if (coberturas.length === 0) {
        throw new ErrorRegla(404, 'Cobertura no encontrada');
      }

      const cobertura = coberturas[0];
      const saldoActual = round2(cobertura.saldo_pendiente);

      if (saldoActual <= 0) {
        throw new ErrorRegla(400, 'Esta cobertura no tiene deuda pendiente');
      }
      if (montoPagado > saldoActual) {
        throw new ErrorRegla(400, `El monto supera la deuda. Saldo pendiente: $${saldoActual.toFixed(2)}`);
      }

      const nuevoPrecioAplicado = round2(Number(cobertura.precio_aplicado) + montoPagado);
      const nuevoSaldo = Math.max(0, round2(saldoActual - montoPagado));

      await connection.query(
        `INSERT INTO cobros
           (persona_id, periodo_alumno_id, fecha_cobro, monto, metodo_cobro, descripcion, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [cobertura.persona_id, cobertura.periodo_alumno_id, fechaPago, montoPagado, metodo_cobro,
         descripcion || `Completamiento de deuda de cobertura #${coberturaId}`, ahoraAR]
      );

      await connection.query(
        `UPDATE periodos_cobertura SET precio_aplicado = ?, saldo_pendiente = ? WHERE id = ?`,
        [nuevoPrecioAplicado, nuevoSaldo, coberturaId]
      );

      if (nuevoSaldo === 0) {
        await connection.query(
          `INSERT INTO persona_estados
             (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo)
           VALUES (?, 'ACTIVO', ?, NULL, ?, 'Deuda saldada')`,
          [cobertura.persona_id, fechaPago, cobertura.periodo_alumno_id]
        );
      }

      await connection.commit();
      res.status(201).json({
        message: nuevoSaldo === 0
          ? 'Deuda saldada completamente'
          : `Pago registrado. Queda pendiente: $${nuevoSaldo.toFixed(2)}`,
        nuevo_saldo_pendiente: nuevoSaldo
      });
    } catch (error) {
      await rollbackSeguro(connection);
      if (error instanceof ErrorRegla) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Error en completarDeuda:', error);
      res.status(500).json({ error: 'Error al completar la deuda' });
    } finally {
      if (connection) connection.release();
    }
  },

  getModalData: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      const { personaId } = req.params;
      const hoy = obtenerFechaHoyArgentina();

      const [periodos] = await connection.query(`
        SELECT 
          pa.id AS periodo_id, pa.fecha_inicio, pa.fecha_cierre,
          pc.id AS cobertura_id, pc.plan_id, pc.fecha_fin AS cobertura_fin,
          pc.saldo_pendiente, pc.precio_aplicado,
          pl.nombre AS plan_nombre, pl.precio AS plan_precio, pl.duracion_meses AS plan_duracion_meses
        FROM periodos_alumno pa
        LEFT JOIN periodos_cobertura pc ON pa.id = pc.periodo_alumno_id
        LEFT JOIN planes pl ON pc.plan_id = pl.id
        WHERE pa.persona_id = ?
        ORDER BY pa.fecha_inicio DESC, pa.id DESC
        LIMIT 2
      `, [personaId]);

      let periodoActivo = null;
      let periodoVencido = null;

      for (const p of periodos) {
        const coberturaFin = p.cobertura_fin instanceof Date
          ? p.cobertura_fin.toISOString().slice(0, 10)
          : p.cobertura_fin ? String(p.cobertura_fin).slice(0, 10) : null;
        const estaActivo = p.fecha_cierre === null && coberturaFin && coberturaFin >= hoy;
        if (estaActivo && !periodoActivo) periodoActivo = p;
        else if (!estaActivo && !periodoVencido) periodoVencido = p;
      }

      const [deudas] = await connection.query(`
        SELECT 
          pc.id AS cobertura_id, pc.periodo_alumno_id, pc.plan_id,
          pc.fecha_inicio, pc.fecha_fin, pc.precio_aplicado, pc.saldo_pendiente,
          (pc.precio_aplicado + pc.saldo_pendiente) AS total_plan,
          pl.nombre AS plan_nombre, pl.precio AS precio_lista
        FROM periodos_cobertura pc
        INNER JOIN periodos_alumno pa ON pa.id = pc.periodo_alumno_id
        LEFT JOIN planes pl ON pl.id = pc.plan_id
        WHERE pa.persona_id = ? AND pc.saldo_pendiente > 0
        ORDER BY pc.fecha_fin DESC
      `, [personaId]);

      const [planes] = await connection.query(`
        SELECT id, nombre, precio, veces_por_semana, duracion_meses 
        FROM planes WHERE activo = TRUE ORDER BY precio ASC
      `);

      res.json({ periodoActivo, periodoVencido, deudasPendientes: deudas, planes });
    } catch (error) {
      console.error('Error en getModalData:', error);
      res.status(500).json({ error: 'Error al obtener datos del modal' });
    } finally {
      if (connection) connection.release();
    }
  },

  getDeudasPendientes: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT pc.id AS cobertura_id, pc.periodo_alumno_id, pc.plan_id, pc.fecha_inicio, pc.fecha_fin,
          pc.precio_aplicado, pc.saldo_pendiente, (pc.precio_aplicado + pc.saldo_pendiente) AS total_plan,
          pl.nombre AS plan_nombre, pl.precio AS precio_lista,
          pa.fecha_inicio AS membresia_desde, pa.fecha_cierre AS membresia_cierre
        FROM periodos_cobertura pc
        INNER JOIN periodos_alumno pa ON pa.id = pc.periodo_alumno_id
        LEFT JOIN planes pl ON pl.id = pc.plan_id
        WHERE pa.persona_id = ? AND pc.saldo_pendiente > 0
        ORDER BY pc.fecha_fin DESC
      `, [req.params.personaId]);
      res.json(rows);
    } catch (error) {
      console.error('Error en getDeudasPendientes:', error);
      res.status(500).json({ error: 'Error al obtener deudas pendientes' });
    }
  },

  // ==========================================================
  // UPDATE — solo si la sesión sigue abierta y el mes también
  // ya NO se permite cambiar fecha_cobro
  // ==========================================================
  update: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const { id } = req.params;
      const { metodo_cobro, descripcion } = req.body;
      const monto = round2(req.body.monto);

      if (!Number.isFinite(monto) || monto <= 0) {
        throw new ErrorRegla(400, 'El monto debe ser mayor a cero');
      }
      validarMetodo(metodo_cobro);

      const [rows] = await connection.query(
        `SELECT id,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS momento,
                DATE_FORMAT(fecha_cobro, '%Y-%m') AS periodo
         FROM cobros WHERE id = ? FOR UPDATE`,
        [id]
      );
      if (rows.length === 0) throw new ErrorRegla(404, 'Cobro no encontrado');

      // 🔒 Cerraduras
      await exigirMovimientoEditable(connection, rows[0].momento, rows[0].periodo);

      await connection.query(
        `UPDATE cobros SET monto = ?, metodo_cobro = ?, descripcion = ? WHERE id = ?`,
        [monto, metodo_cobro, descripcion || null, id]
      );

      await connection.commit();
      res.json({ message: 'Cobro actualizado correctamente', id });
    } catch (error) {
      await rollbackSeguro(connection);
      if (error instanceof ErrorRegla) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Error en update:', error);
      res.status(500).json({ error: 'Error al actualizar cobro' });
    } finally {
      if (connection) connection.release();
    }
  },

  // ==========================================================
  // DELETE — mismas cerraduras + reevaluación de estado
  // ==========================================================
  delete: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const { id } = req.params;
      const hoy = obtenerFechaHoyArgentina();

      const [cobros] = await connection.query(
        `SELECT persona_id, periodo_alumno_id,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS momento,
                DATE_FORMAT(fecha_cobro, '%Y-%m') AS periodo
         FROM cobros WHERE id = ? FOR UPDATE`,
        [id]
      );
      if (cobros.length === 0) throw new ErrorRegla(404, 'Cobro no encontrado');

      const { persona_id: personaId, periodo_alumno_id: periodoAlumnoId, momento, periodo } = cobros[0];

      // 🔒 Cerraduras
      await exigirMovimientoEditable(connection, momento, periodo);

      await connection.query('DELETE FROM cobros WHERE id = ?', [id]);

      if (personaId) {
        const [coberturasVigentes] = await connection.query(`
          SELECT pc.fecha_fin FROM periodos_alumno pa
          INNER JOIN periodos_cobertura pc ON pa.id = pc.periodo_alumno_id
          WHERE pa.persona_id = ? AND pa.fecha_cierre IS NULL AND pc.fecha_fin >= ?
          ORDER BY pc.fecha_fin DESC LIMIT 1
        `, [personaId, hoy]);

        if (coberturasVigentes.length === 0) {
          await connection.query(
            `INSERT INTO persona_estados
               (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo)
             VALUES (?, 'INACTIVO', ?, NULL, NULL, 'Anulación de cobro sin cobertura vigente')`,
            [personaId, hoy]
          );
        } else {
          const fechaFin = coberturasVigentes[0].fecha_fin instanceof Date
            ? coberturasVigentes[0].fecha_fin.toISOString().slice(0, 10)
            : String(coberturasVigentes[0].fecha_fin).slice(0, 10);
          await connection.query(
            `INSERT INTO persona_estados
               (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo)
             VALUES (?, 'ACTIVO', ?, ?, ?, 'Reajuste por anulación de cobro')`,
            [personaId, hoy, fechaFin, periodoAlumnoId]
          );
        }
      }

      await connection.commit();
      res.json({ message: 'Cobro anulado y estado reevaluado correctamente' });
    } catch (error) {
      await rollbackSeguro(connection);
      if (error instanceof ErrorRegla) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Error en delete:', error);
      res.status(500).json({ error: 'Error al anular el cobro' });
    } finally {
      if (connection) connection.release();
    }
  }
};

export default cobro;