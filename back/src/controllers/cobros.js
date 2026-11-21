import { pool } from '../config/database.js';

// Calcula la fecha actual en formato YYYY-MM-DD ajustada a la zona horaria local (UTC-3)
const getFechaHoyLocal = () => {
  const date = new Date(new Date().getTime() - (3 * 60 * 60 * 1000));
  return date.toISOString().split('T')[0];
};

const cobro = {
  // GET /api/cobros
  getAll: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          c.*,
          COALESCE(c.persona_id, pa.persona_id) AS persona_id,
          p.nombre,
          p.apellido,
          p.dni,
          pc.fecha_inicio AS cobertura_inicio,
          pc.fecha_fin AS cobertura_fin,
          pl.nombre AS plan_nombre,
          pl.precio AS plan_precio
        FROM cobros c
        LEFT JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        LEFT JOIN personas p ON p.id = COALESCE(c.persona_id, pa.persona_id)
        LEFT JOIN (
          SELECT periodo_alumno_id, plan_id, fecha_inicio, fecha_fin
          FROM periodos_cobertura pc1
          WHERE pc1.fecha_inicio = (
            SELECT MAX(fecha_inicio) 
            FROM periodos_cobertura pc2 
            WHERE pc2.periodo_alumno_id = pc1.periodo_alumno_id
          )
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

  // GET /api/cobros/rango?fechaDesde=YYYY-MM-DD&fechaHasta=YYYY-MM-DD&personaId=123
  getByRangoFechas: async (req, res) => {
    try {
      const { fechaDesde, fechaHasta, personaId } = req.query;

      if (!fechaDesde || !fechaHasta) {
        return res.status(400).json({ error: 'fechaDesde y fechaHasta son requeridos' });
      }

      let sql = `
        SELECT 
          c.*,
          COALESCE(c.persona_id, pa.persona_id) AS persona_id,
          p.nombre,
          p.apellido,
          p.dni
        FROM cobros c
        LEFT JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        LEFT JOIN personas p ON p.id = COALESCE(c.persona_id, pa.persona_id)
        WHERE c.fecha_cobro BETWEEN ? AND ?
      `;
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

  // GET /api/cobros/persona/:personaId
  getByPersona: async (req, res) => {
    try {
      const { personaId } = req.params;

      const [rows] = await pool.query(`
        SELECT 
          c.*,
          COALESCE(c.persona_id, pa.persona_id) AS persona_id,
          p.nombre,
          p.apellido,
          p.dni
        FROM cobros c
        LEFT JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        LEFT JOIN personas p ON p.id = COALESCE(c.persona_id, pa.persona_id)
        WHERE COALESCE(c.persona_id, pa.persona_id) = ?
        ORDER BY c.fecha_cobro DESC
      `, [personaId]);

      res.json(rows);
    } catch (error) {
      console.error('Error en getByPersona:', error);
      res.status(500).json({ error: 'Error al obtener cobros del alumno' });
    }
  },

  // GET /api/cobros/metodo?metodo=efectivo
  getByMetodoPago: async (req, res) => {
    try {
      const { metodo } = req.query;

      if (!metodo) {
        return res.status(400).json({ error: 'metodo es requerido' });
      }

      const [rows] = await pool.query(`
        SELECT 
          c.*,
          COALESCE(c.persona_id, pa.persona_id) AS persona_id,
          p.nombre,
          p.apellido,
          p.dni
        FROM cobros c
        LEFT JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        LEFT JOIN personas p ON p.id = COALESCE(c.persona_id, pa.persona_id)
        WHERE c.metodo_cobro = ?
        ORDER BY c.fecha_cobro DESC
      `, [metodo]);

      res.json(rows);
    } catch (error) {
      console.error('Error en getByMetodoPago:', error);
      res.status(500).json({ error: 'Error al obtener cobros por método' });
    }
  },

  // GET /api/cobros/periodo-activo/:personaId
  getPeriodoActivoWithPlan: async (req, res) => {
    try {
      const { personaId } = req.params;
      const hoy = getFechaHoyLocal();

      const [rows] = await pool.query(`
        SELECT 
          pa.id AS periodo_id,
          pa.fecha_inicio AS membresia_inicio,
          pc.id AS cobertura_id,
          pc.plan_id,
          pc.fecha_inicio AS cobertura_inicio,
          pc.fecha_fin AS cobertura_fin,
          pl.nombre AS plan_nombre,
          pl.precio AS plan_precio
        FROM periodos_alumno pa
        INNER JOIN periodos_cobertura pc ON pa.id = pc.periodo_alumno_id
        LEFT JOIN planes pl ON pc.plan_id = pl.id
        WHERE pa.persona_id = ? 
          AND pa.fecha_cierre IS NULL
          AND ? BETWEEN pc.fecha_inicio AND pc.fecha_fin
        ORDER BY pc.fecha_fin DESC
        LIMIT 1
      `, [personaId, hoy]);

      if (rows.length === 0) {
        return res.json(null);
      }

      res.json(rows[0]);
    } catch (error) {
      console.error('Error en getPeriodoActivoWithPlan:', error);
      res.status(500).json({ error: 'Error al obtener período activo' });
    }
  },

  // POST /api/cobros
  create: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // ✅ NUEVO: Se agregan precio_acordado y es_pago_parcial al body
      const {
        personaId, planId, monto, metodo_cobro, fechaCobro, fechaInicio, fechaFin,
        descripcion, precio_acordado, es_pago_parcial
      } = req.body;

      const hoy = getFechaHoyLocal();
      const montoPagado = parseFloat(monto);
      const precioAcordado = parseFloat(precio_acordado || monto);

      // Cálculo de deuda: Si es pago parcial, la deuda es la diferencia. Si no, es 0.
      const saldoPendiente = es_pago_parcial ? Math.max(0, precioAcordado - montoPagado) : 0;

      const [periodos] = await connection.query(`
        SELECT id FROM periodos_alumno
        WHERE persona_id = ? AND fecha_cierre IS NULL
        LIMIT 1
      `, [personaId]);

      let periodoAlumnoId;

      if (periodos.length > 0) {
        periodoAlumnoId = periodos[0].id;
      } else {
        const [result] = await connection.query(`
          INSERT INTO periodos_alumno (persona_id, fecha_inicio, fecha_cierre)
          VALUES (?, ?, NULL)
        `, [personaId, fechaInicio]);
        periodoAlumnoId = result.insertId;
      }

      // ✅ LÓGICA DE DEUDA: precio_aplicado guarda SOLO lo pagado hoy. saldo_pendiente guarda la diferencia.
      await connection.query(`
        INSERT INTO periodos_cobertura (periodo_alumno_id, plan_id, fecha_inicio, fecha_fin, precio_aplicado, saldo_pendiente)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [periodoAlumnoId, planId, fechaInicio, fechaFin, montoPagado, saldoPendiente]);

      const [cobroResult] = await connection.query(`
        INSERT INTO cobros (persona_id, periodo_alumno_id, fecha_cobro, monto, metodo_cobro, descripcion)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [personaId, periodoAlumnoId, fechaCobro, montoPagado, metodo_cobro, descripcion || null]);

      await connection.query(`
        INSERT INTO persona_estados (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo)
        VALUES (?, 'ACTIVO', ?, ?, ?, 'Cobro registrado')
      `, [personaId, hoy, fechaFin, periodoAlumnoId]);

      await connection.commit();

      const [cobros] = await connection.query(`
        SELECT 
          c.*, 
          COALESCE(c.persona_id, pa.persona_id) AS persona_id, 
          p.nombre, p.apellido, p.dni, pl.nombre AS plan_nombre
        FROM cobros c
        LEFT JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        LEFT JOIN personas p ON p.id = COALESCE(c.persona_id, pa.persona_id)
        LEFT JOIN periodos_cobertura pc ON pc.periodo_alumno_id = c.periodo_alumno_id 
          AND c.fecha_cobro BETWEEN pc.fecha_inicio AND pc.fecha_fin
        LEFT JOIN planes pl ON pl.id = pc.plan_id
        WHERE c.id = ?
      `, [cobroResult.insertId]);

      res.status(201).json(cobros[0]);

    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Error en create:', error);
      res.status(500).json({ error: 'Error al crear cobro' });
    } finally {
      if (connection) connection.release();
    }
  },

  // POST /api/cobros/completar-deuda/:coberturaId
  // Registra un pago adicional sobre una cobertura que tiene saldo pendiente.
  // Actualiza precio_aplicado (suma) y saldo_pendiente (resta) sin crear cobertura nueva.
  completarDeuda: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const { coberturaId } = req.params;
      const { monto, metodo_cobro, descripcion, fecha_cobro } = req.body;
      const montoPagado = parseFloat(monto);
      const hoy = getFechaHoyLocal();
      const fechaPago = fecha_cobro || hoy;

      // 1. Obtener la cobertura con su saldo actual y el alumno asociado
      const [coberturas] = await connection.query(`
        SELECT pc.id, pc.saldo_pendiente, pc.precio_aplicado, 
               pc.periodo_alumno_id, pa.persona_id
        FROM periodos_cobertura pc
        INNER JOIN periodos_alumno pa ON pa.id = pc.periodo_alumno_id
        WHERE pc.id = ?
      `, [coberturaId]);

      if (coberturas.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Cobertura no encontrada' });
      }

      const cobertura = coberturas[0];
      const saldoActual = parseFloat(cobertura.saldo_pendiente);

      // 2. Validar que el monto no exceda la deuda
      if (montoPagado > saldoActual) {
        await connection.rollback();
        return res.status(400).json({
          error: `El monto supera la deuda. Saldo pendiente: $${saldoActual.toFixed(2)}`
        });
      }

      // 3. Calcular los nuevos valores de la cobertura
      const nuevoPrecioAplicado = parseFloat(cobertura.precio_aplicado) + montoPagado;
      const nuevoSaldo = Math.max(0, saldoActual - montoPagado);

      // 4. Insertar el cobro vinculado al mismo periodo
      const [cobroResult] = await connection.query(`
        INSERT INTO cobros (persona_id, periodo_alumno_id, fecha_cobro, monto, metodo_cobro, descripcion)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        cobertura.persona_id,
        cobertura.periodo_alumno_id,
        fechaPago,
        montoPagado,
        metodo_cobro,
        descripcion || `Completamiento de deuda de cobertura #${coberturaId}`
      ]);

      // 5. Actualizar la cobertura: precio_aplicado crece, saldo_pendiente baja
      await connection.query(`
        UPDATE periodos_cobertura 
        SET precio_aplicado = ?, saldo_pendiente = ?
        WHERE id = ?
      `, [nuevoPrecioAplicado, nuevoSaldo, coberturaId]);

      // 6. Si la deuda quedó en 0, registrar motivo de cierre de deuda en estados
      if (nuevoSaldo === 0) {
        await connection.query(`
          INSERT INTO persona_estados (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo)
          VALUES (?, 'ACTIVO', ?, NULL, ?, 'Deuda saldada')
        `, [cobertura.persona_id, fechaPago, cobertura.periodo_alumno_id]);
      }

      await connection.commit();

      res.status(201).json({
        message: nuevoSaldo === 0
          ? 'Deuda saldada completamente'
          : `Pago registrado. Queda pendiente: $${nuevoSaldo.toFixed(2)}`,
        cobro_id: cobroResult.insertId,
        nuevo_precio_aplicado: nuevoPrecioAplicado,
        nuevo_saldo_pendiente: nuevoSaldo
      });

    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Error en completarDeuda:', error);
      res.status(500).json({ error: 'Error al completar la deuda' });
    } finally {
      if (connection) connection.release();
    }
  },

  // GET /api/cobros/deudas-pendientes/:personaId
  // Devuelve las coberturas con saldo pendiente para un alumno
  getDeudasPendientes: async (req, res) => {
    try {
      const { personaId } = req.params;

      const [rows] = await pool.query(`
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
          pl.precio AS precio_lista,
          pa.fecha_inicio AS membresia_desde,
          pa.fecha_cierre AS membresia_cierre
        FROM periodos_cobertura pc
        INNER JOIN periodos_alumno pa ON pa.id = pc.periodo_alumno_id
        LEFT JOIN planes pl ON pl.id = pc.plan_id
        WHERE pa.persona_id = ? 
          AND pc.saldo_pendiente > 0
        ORDER BY pc.fecha_fin DESC
      `, [personaId]);

      res.json(rows);
    } catch (error) {
      console.error('Error en getDeudasPendientes:', error);
      res.status(500).json({ error: 'Error al obtener deudas pendientes' });
    }
  },

  // PUT /api/cobros/:id
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { fecha_cobro, monto, metodo_cobro, descripcion } = req.body;

      await pool.query(`
        UPDATE cobros 
        SET fecha_cobro = ?, monto = ?, metodo_cobro = ?, descripcion = ?
        WHERE id = ?
      `, [fecha_cobro, monto, metodo_cobro, descripcion || null, id]);

      const [rows] = await pool.query(`
        SELECT 
          c.*,
          COALESCE(c.persona_id, pa.persona_id) AS persona_id,
          p.nombre,
          p.apellido,
          p.dni
        FROM cobros c
        LEFT JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        LEFT JOIN personas p ON p.id = COALESCE(c.persona_id, pa.persona_id)
        WHERE c.id = ?
      `, [id]);

      res.json(rows[0]);
    } catch (error) {
      console.error('Error en update:', error);
      res.status(500).json({ error: 'Error al actualizar cobro' });
    }
  },

  // DELETE /api/cobros/:id
  delete: async (req, res) => {
    let connection;
    try {
      const { id } = req.params;
      const hoy = getFechaHoyLocal();

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [cobros] = await connection.query(`
        SELECT c.id, c.persona_id, c.periodo_alumno_id, pa.persona_id AS pa_persona_id
        FROM cobros c
        LEFT JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        WHERE c.id = ?
      `, [id]);

      if (cobros.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Cobro no encontrado' });
      }

      const cobroTarget = cobros[0];
      const personaId = cobroTarget.persona_id || cobroTarget.pa_persona_id;
      const periodoAlumnoId = cobroTarget.periodo_alumno_id;

      await connection.query('DELETE FROM cobros WHERE id = ?', [id]);

      if (personaId) {
        const [coberturasVigentes] = await connection.query(`
          SELECT pc.fecha_fin 
          FROM periodos_alumno pa
          INNER JOIN periodos_cobertura pc ON pa.id = pc.periodo_alumno_id
          WHERE pa.persona_id = ? 
            AND pa.fecha_cierre IS NULL
            AND pc.fecha_fin >= ?
          ORDER BY pc.fecha_fin DESC
          LIMIT 1
        `, [personaId, hoy]);

        if (coberturasVigentes.length === 0) {
          await connection.query(`
            INSERT INTO persona_estados (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo)
            VALUES (?, 'INACTIVO', ?, NULL, NULL, 'Anulación de cobro sin cobertura vigente')
          `, [personaId, hoy]);
        } else {
          const nuevoVencimiento = coberturasVigentes[0].fecha_fin;
          await connection.query(`
            INSERT INTO persona_estados (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo)
            VALUES (?, 'ACTIVO', ?, ?, ?, 'Reajuste por anulación de cobro')
          `, [personaId, hoy, nuevoVencimiento, periodoAlumnoId]);
        }
      }

      await connection.commit();
      res.json({ message: 'Cobro anulado y estado del alumno reevaluado correctamente' });

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