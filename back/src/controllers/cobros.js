import { pool } from '../config/database.js';

const getFechaHoyLocal = () => {
  const date = new Date(new Date().getTime() - (3 * 60 * 60 * 1000));
  return date.toISOString().split('T')[0];
};

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
      if (!fechaDesde || !fechaHasta) return res.status(400).json({ error: 'fechaDesde y fechaHasta son requeridos' });
      
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
      `, [req.params.personaId, getFechaHoyLocal()]);
      
      res.json(rows.length > 0 ? rows[0] : null);
    } catch (error) {
      console.error('Error en getPeriodoActivoWithPlan:', error);
      res.status(500).json({ error: 'Error al obtener período activo' });
    }
  },

  // ✅ CORREGIDO: Ahora cierra el periodo anterior y abre uno nuevo explícitamente
  create: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const { personaId, planId, monto, metodo_cobro, fechaCobro, fechaInicio, fechaFin, descripcion, precio_acordado, es_pago_parcial } = req.body;
      const hoy = getFechaHoyLocal();
      const montoPagado = parseFloat(monto);
      const precioAcordado = parseFloat(precio_acordado || monto);
      const saldoPendiente = es_pago_parcial ? Math.max(0, precioAcordado - montoPagado) : 0;

      // 1. Buscar periodo abierto
      const [periodos] = await connection.query(
        `SELECT id FROM periodos_alumno WHERE persona_id = ? AND fecha_cierre IS NULL LIMIT 1`, 
        [personaId]
      );
      
      let periodoAlumnoId;
      
      if (periodos.length > 0) {
        // Cierra el periodo anterior marcando que fue por renovación
        const periodoAnteriorId = periodos[0].id;
        await connection.query(
          `UPDATE periodos_alumno SET fecha_cierre = ?, motivo_cierre = 'Renovación' WHERE id = ?`,
          [fechaInicio, periodoAnteriorId]
        );
        
        // Crea un nuevo periodo abierto
        const [result] = await connection.query(
          `INSERT INTO periodos_alumno (persona_id, fecha_inicio, fecha_cierre) VALUES (?, ?, NULL)`,
          [personaId, fechaInicio]
        );
        periodoAlumnoId = result.insertId;
      } else {
        // No tiene periodo abierto: crear uno nuevo desde cero
        const [result] = await connection.query(
          `INSERT INTO periodos_alumno (persona_id, fecha_inicio, fecha_cierre) VALUES (?, ?, NULL)`,
          [personaId, fechaInicio]
        );
        periodoAlumnoId = result.insertId;
      }

      // 2. Crear cobertura con lógica de deuda
      await connection.query(
        `INSERT INTO periodos_cobertura (periodo_alumno_id, plan_id, fecha_inicio, fecha_fin, precio_aplicado, saldo_pendiente) VALUES (?, ?, ?, ?, ?, ?)`, 
        [periodoAlumnoId, planId, fechaInicio, fechaFin, montoPagado, saldoPendiente]
      );

      // 3. Registrar cobro
      const [cobroResult] = await connection.query(
        `INSERT INTO cobros (persona_id, periodo_alumno_id, fecha_cobro, monto, metodo_cobro, descripcion) VALUES (?, ?, ?, ?, ?, ?)`, 
        [personaId, periodoAlumnoId, fechaCobro, montoPagado, metodo_cobro, descripcion || null]
      );

      // 4. Actualizar estado
      await connection.query(
        `INSERT INTO persona_estados (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo) VALUES (?, 'ACTIVO', ?, ?, ?, 'Cobro registrado')`, 
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
      if (connection) await connection.rollback();
      console.error('Error en create:', error);
      res.status(500).json({ error: 'Error al crear cobro' });
    } finally {
      if (connection) connection.release();
    }
  },

  completarDeuda: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const { coberturaId } = req.params;
      const { monto, metodo_cobro, descripcion, fecha_cobro } = req.body;
      const montoPagado = parseFloat(monto);
      const fechaPago = fecha_cobro || getFechaHoyLocal();

      const [coberturas] = await connection.query(`
        SELECT pc.id, pc.saldo_pendiente, pc.precio_aplicado, pc.periodo_alumno_id, pa.persona_id
        FROM periodos_cobertura pc INNER JOIN periodos_alumno pa ON pa.id = pc.periodo_alumno_id WHERE pc.id = ?
      `, [coberturaId]);

      if (coberturas.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Cobertura no encontrada' });
      }

      const cobertura = coberturas[0];
      const saldoActual = parseFloat(cobertura.saldo_pendiente);

      if (montoPagado > saldoActual) {
        await connection.rollback();
        return res.status(400).json({ error: `El monto supera la deuda. Saldo pendiente: $${saldoActual.toFixed(2)}` });
      }

      const nuevoPrecioAplicado = parseFloat(cobertura.precio_aplicado) + montoPagado;
      const nuevoSaldo = Math.max(0, saldoActual - montoPagado);

      await connection.query(`INSERT INTO cobros (persona_id, periodo_alumno_id, fecha_cobro, monto, metodo_cobro, descripcion) VALUES (?, ?, ?, ?, ?, ?)`, [cobertura.persona_id, cobertura.periodo_alumno_id, fechaPago, montoPagado, metodo_cobro, descripcion || `Completamiento de deuda de cobertura #${coberturaId}`]);

      await connection.query(`UPDATE periodos_cobertura SET precio_aplicado = ?, saldo_pendiente = ? WHERE id = ?`, [nuevoPrecioAplicado, nuevoSaldo, coberturaId]);

      if (nuevoSaldo === 0) {
        await connection.query(`INSERT INTO persona_estados (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo) VALUES (?, 'ACTIVO', ?, NULL, ?, 'Deuda saldada')`, [cobertura.persona_id, fechaPago, cobertura.periodo_alumno_id]);
      }

      await connection.commit();
      res.status(201).json({ message: nuevoSaldo === 0 ? 'Deuda saldada completamente' : `Pago registrado. Queda pendiente: $${nuevoSaldo.toFixed(2)}`, nuevo_saldo_pendiente: nuevoSaldo });

    } catch (error) {
      if (connection) await connection.rollback();
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
      const hoy = getFechaHoyLocal();

      // 1. Obtener los 2 periodos más recientes
      const [periodos] = await connection.query(`
        SELECT 
          pa.id AS periodo_id,
          pa.fecha_inicio,
          pa.fecha_cierre,
          pc.id AS cobertura_id,
          pc.plan_id,
          pc.fecha_fin AS cobertura_fin,
          pc.saldo_pendiente,
          pc.precio_aplicado,
          pl.nombre AS plan_nombre,
          pl.precio AS plan_precio,
          pl.duracion_meses AS plan_duracion_meses
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
        const estaActivo = p.fecha_cierre === null && p.cobertura_fin && p.cobertura_fin >= hoy;
        if (estaActivo && !periodoActivo) {
          periodoActivo = p;
        } else if (!estaActivo && !periodoVencido) {
          periodoVencido = p;
        }
      }

      // 2. Obtener deudas pendientes
      const [deudas] = await connection.query(`
        SELECT 
          pc.id AS cobertura_id,
          pc.periodo_alumno_id,
          pc.plan_id,
          pc.fecha_inicio,
          pc.fecha_fin,
          pc.precio_aplicado,
          pc.saldo_pendiente,
          (pc.precio_aplicado + pc.saldo_pendiente) AS total_plan,
          pl.nombre AS plan_nombre,
          pl.precio AS precio_lista
        FROM periodos_cobertura pc
        INNER JOIN periodos_alumno pa ON pa.id = pc.periodo_alumno_id
        LEFT JOIN planes pl ON pl.id = pc.plan_id
        WHERE pa.persona_id = ? AND pc.saldo_pendiente > 0
        ORDER BY pc.fecha_fin DESC
      `, [personaId]);

      // ✅ CORREGIDO: Se agregó 'duracion_meses' al SELECT (antes faltaba y rompía el frontend)
      const [planes] = await connection.query(`
        SELECT id, nombre, precio, veces_por_semana, duracion_meses 
        FROM planes 
        WHERE activo = TRUE 
        ORDER BY precio ASC
      `);

      res.json({
        periodoActivo,
        periodoVencido,
        deudasPendientes: deudas,
        planes: planes
      });

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
          pl.nombre AS plan_nombre, pl.precio AS precio_lista, pa.fecha_inicio AS membresia_desde, pa.fecha_cierre AS membresia_cierre
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

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { fecha_cobro, monto, metodo_cobro, descripcion } = req.body;
      await pool.query(`UPDATE cobros SET fecha_cobro = ?, monto = ?, metodo_cobro = ?, descripcion = ? WHERE id = ?`, [fecha_cobro, monto, metodo_cobro, descripcion || null, id]);
      res.json({ message: 'Cobro actualizado correctamente', id });
    } catch (error) {
      console.error('Error en update:', error);
      res.status(500).json({ error: 'Error al actualizar cobro' });
    }
  },

  delete: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const { id } = req.params;
      const hoy = getFechaHoyLocal();

      const [cobros] = await connection.query(`SELECT persona_id, periodo_alumno_id FROM cobros WHERE id = ?`, [id]);
      if (cobros.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Cobro no encontrado' });
      }

      const { persona_id: personaId, periodo_alumno_id: periodoAlumnoId } = cobros[0];
      await connection.query('DELETE FROM cobros WHERE id = ?', [id]);

      if (personaId) {
        const [coberturasVigentes] = await connection.query(`
          SELECT pc.fecha_fin FROM periodos_alumno pa
          INNER JOIN periodos_cobertura pc ON pa.id = pc.periodo_alumno_id
          WHERE pa.persona_id = ? AND pa.fecha_cierre IS NULL AND pc.fecha_fin >= ?
          ORDER BY pc.fecha_fin DESC LIMIT 1
        `, [personaId, hoy]);

        if (coberturasVigentes.length === 0) {
          await connection.query(`INSERT INTO persona_estados (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo) VALUES (?, 'INACTIVO', ?, NULL, NULL, 'Anulación de cobro sin cobertura vigente')`, [personaId, hoy]);
        } else {
          await connection.query(`INSERT INTO persona_estados (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo) VALUES (?, 'ACTIVO', ?, ?, ?, 'Reajuste por anulación de cobro')`, [personaId, hoy, coberturasVigentes[0].fecha_fin, periodoAlumnoId]);
        }
      }

      await connection.commit();
      res.json({ message: 'Cobro anulado y estado reevaluado correctamente' });

    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Error en delete:', error);
      res.status(500).json({ error: 'Error al anular el cobro' });
    } finally {
      if (connection) connection.release();
    }
  }
};

export default cobro;