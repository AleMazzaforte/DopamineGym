import { pool } from '../config/database.js';

// Helper para obtener la fecha de hoy en formato YYYY-MM-DD ajustada a zona horaria local (UTC-3)
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
        pl.nombre AS plan_nombre
      FROM cobros c
      LEFT JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
      LEFT JOIN personas p ON p.id = COALESCE(c.persona_id, pa.persona_id)
      LEFT JOIN periodos_cobertura pc ON pc.periodo_alumno_id = c.periodo_alumno_id
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
          pa.fecha_inicio,
          pa.fecha_fin,
          pc.id AS cobertura_id,
          pc.plan_id,
          pc.fecha_inicio AS cobertura_inicio,
          pc.fecha_fin AS cobertura_fin,
          pl.nombre AS plan_nombre,
          pl.precio AS plan_precio
        FROM periodos_alumno pa
        LEFT JOIN periodos_cobertura pc ON pa.id = pc.periodo_alumno_id
        LEFT JOIN planes pl ON pc.plan_id = pl.id
        WHERE pa.persona_id = ? 
          AND (pa.fecha_fin IS NULL OR pa.fecha_fin >= ?)
        ORDER BY pa.fecha_fin DESC
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
      
      const { personaId, planId, monto, MetodoCobro, fechaCobro, fechaInicio, fechaFin, descripcion, precio_aplicado } = req.body;
      const hoy = getFechaHoyLocal();
      
      // 1. Verificar período activo
      const [periodosActivos] = await connection.query(`
        SELECT id FROM periodos_alumno
        WHERE persona_id = ? AND (fecha_fin IS NULL OR fecha_fin >= ?)
        LIMIT 1
      `, [personaId, hoy]);
      
      let periodoAlumnoId = periodosActivos.length > 0 ? periodosActivos[0].id : null;
      const esExtension = !!periodoAlumnoId;
      
      // 2. Crear o extender período
      if (!periodoAlumnoId) {
        const [result] = await connection.query(`
          INSERT INTO periodos_alumno (persona_id, fecha_inicio, fecha_fin)
          VALUES (?, ?, ?)
        `, [personaId, fechaInicio, fechaFin]);
        periodoAlumnoId = result.insertId;
      } else {
        await connection.query(`
          UPDATE periodos_alumno SET fecha_fin = ? WHERE id = ?
        `, [fechaFin, periodoAlumnoId]);
      }
      
      // 3. Manejar cobertura (UPDATE si es extensión, INSERT si es nuevo)
      if (esExtension) {
        await connection.query(`
          UPDATE periodos_cobertura 
          SET fecha_fin = ?, plan_id = ?
          WHERE periodo_alumno_id = ?
          ORDER BY id DESC
          LIMIT 1
        `, [fechaFin, planId, periodoAlumnoId]);
      } else {
        await connection.query(`
          INSERT INTO periodos_cobertura (periodo_alumno_id, plan_id, fecha_inicio, fecha_fin, precio_aplicado)
          VALUES (?, ?, ?, ?, ?)
        `, [periodoAlumnoId, planId, fechaInicio, fechaFin, precio_aplicado]);
      }
      
      // 4. Registrar el cobro
      const [cobroResult] = await connection.query(`
        INSERT INTO cobros (persona_id, periodo_alumno_id, fecha_cobro, monto, metodo_cobro, descripcion)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [personaId, periodoAlumnoId, fechaCobro, monto, MetodoCobro, descripcion || null]);
      
      // 5. Insertar estado ACTIVO y actualizar vencimiento
      await connection.query(`
        INSERT INTO persona_estados (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo)
        VALUES (?, 'ACTIVO', ?, ?, ?, ?)
      `, [personaId, hoy, fechaFin, periodoAlumnoId, 'Cobro registrado']);
      
      // 6. Obtener el cobro creado
      const [cobros] = await connection.query(`
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
      `, [cobroResult.insertId]);
      
      await connection.commit();
      res.status(201).json(cobros[0]);
      
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Error en create:', error);
      res.status(500).json({ error: 'Error al crear cobro' });
    } finally {
      if (connection) connection.release();
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

      // 1. Buscar los datos del cobro a eliminar
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

      // 2. Eliminar el cobro
      await connection.query('DELETE FROM cobros WHERE id = ?', [id]);

      // 3. Si el cobro estaba asociado a un período, verificar si quedan otros cobros vinculados
      if (periodoAlumnoId) {
        const [otrosCobros] = await connection.query(`
          SELECT id FROM cobros WHERE periodo_alumno_id = ?
        `, [periodoAlumnoId]);

        // Si NO quedan más cobros vinculados a este período, lo limpiamos por completo
        if (otrosCobros.length === 0) {
          await connection.query('DELETE FROM periodos_cobertura WHERE periodo_alumno_id = ?', [periodoAlumnoId]);
          await connection.query('DELETE FROM persona_estados WHERE periodo_alumno_id = ?', [periodoAlumnoId]);
          await connection.query('DELETE FROM periodos_alumno WHERE id = ?', [periodoAlumnoId]);
        }
      }

      // 4. Reevaluar si el alumno aún posee algún período activo
      if (personaId) {
        const [periodosActivos] = await connection.query(`
          SELECT id FROM periodos_alumno
          WHERE persona_id = ? AND (fecha_fin IS NULL OR fecha_fin >= ?)
          LIMIT 1
        `, [personaId, hoy]);

        // Si ya no tiene ningún período activo, volvemos a registrar su estado a INACTIVO
        if (periodosActivos.length === 0) {
          await connection.query(`
            INSERT INTO persona_estados (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo)
            VALUES (?, 'INACTIVO', ?, NULL, NULL, ?)
          `, [personaId, hoy, 'Anulación de cobro']);
        }
      }

      await connection.commit();
      res.json({ message: 'Cobro anulado y registros/estados actualizados correctamente' });

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