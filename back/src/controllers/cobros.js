import { pool } from '../config/database.js';

const cobro = {
  // GET /api/cobros
  getAll: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          c.*,
          pa.persona_id,
          p.nombre,
          p.apellido,
          p.dni
        FROM cobros c
        INNER JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        INNER JOIN personas p ON pa.persona_id = p.id
        ORDER BY c.fecha_cobro DESC
      `);
      
      res.json(rows);
    } catch (error) {
      console.error('Error en getAll:', error);
      res.status(500).json({ error: 'Error al obtener cobros' });
    }
  },

  // GET /api/cobros/rango?fechaDesde=YYYY-MM-DD&fechaHasta=YYYY-MM-DD
  getByRangoFechas: async (req, res) => {
    try {
      const { fechaDesde, fechaHasta } = req.query;
      
      if (!fechaDesde || !fechaHasta) {
        return res.status(400).json({ error: 'fechaDesde y fechaHasta son requeridos' });
      }
      
      const [rows] = await pool.query(`
        SELECT 
          c.*,
          pa.persona_id,
          p.nombre,
          p.apellido,
          p.dni
        FROM cobros c
        INNER JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        INNER JOIN personas p ON pa.persona_id = p.id
        WHERE c.fecha_cobro BETWEEN ? AND ?
        ORDER BY c.fecha_cobro DESC
      `, [fechaDesde, fechaHasta]);
      
      res.json(rows);
    } catch (error) {
      console.error('Error en getByRangoFechas:', error);
      res.status(500).json({ error: 'Error al obtener cobros por rango' });
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
          pa.persona_id,
          p.nombre,
          p.apellido,
          p.dni
        FROM cobros c
        INNER JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        INNER JOIN personas p ON pa.persona_id = p.id
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
      
      // Ajuste de zona horaria (UTC-3) para evitar desfases de día
      const hoy = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)).toISOString().split('T')[0];
      
      // Usamos LEFT JOIN para que traiga el período sí o sí, aunque falte la cobertura
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
      // 1. Pedimos una conexión del pool
      connection = await pool.getConnection();
      await connection.beginTransaction();
      
      const { personaId, planId, monto, MetodoCobro, fechaCobro, fechaInicio, fechaFin, descripcion } = req.body;
      const hoy = new Date().toISOString().split('T')[0];
      
      // 2. Verificar período activo
      const [periodosActivos] = await connection.query(`
        SELECT id FROM periodos_alumno
        WHERE persona_id = ? AND (fecha_fin IS NULL OR fecha_fin >= ?)
        LIMIT 1
      `, [personaId, hoy]);
      
      let periodoAlumnoId = periodosActivos.length > 0 ? periodosActivos[0].id : null;
      const esExtension = !!periodoAlumnoId;
      
      // 3. Crear o extender período
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
      
      // 4. Manejar cobertura (UPDATE si es extensión, INSERT si es nuevo)
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
        `, [periodoAlumnoId, planId, fechaInicio, fechaFin, monto]);
      }
      
      // 5. Registrar el cobro
      const [cobroResult] = await connection.query(`
        INSERT INTO cobros (persona_id, periodo_alumno_id, fecha_cobro, monto, metodo_cobro, descripcion)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [personaId, periodoAlumnoId, fechaCobro, monto, MetodoCobro, descripcion || null]);
      
      // 👉 NUEVO (6): Insertar el estado ACTIVO y actualizar su vencimiento
      await connection.query(`
        INSERT INTO persona_estados (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo)
        VALUES (?, 'ACTIVO', ?, ?, ?, ?)
      `, [personaId, hoy, fechaFin, periodoAlumnoId, 'Cobro registrado']);
      
      // 7. Obtener el cobro creado
      const [cobros] = await connection.query(`
        SELECT c.*, pa.persona_id, p.nombre, p.apellido, p.dni
        FROM cobros c
        INNER JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        INNER JOIN personas p ON pa.persona_id = p.id
        WHERE c.id = ?
      `, [cobroResult.insertId]);
      
      await connection.commit();
      res.status(201).json(cobros[0]);
      
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Error en create:', error);
      res.status(500).json({ error: 'Error al crear cobro' });
    } finally {
      // 8. LIBERAR LA CONEXIÓN SIEMPRE
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
      
      // Obtener el cobro actualizado
      const [rows] = await pool.query(`
        SELECT 
          c.*,
          pa.persona_id,
          p.nombre,
          p.apellido,
          p.dni
        FROM cobros c
        INNER JOIN periodos_alumno pa ON c.periodo_alumno_id = pa.id
        INNER JOIN personas p ON pa.persona_id = p.id
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
    try {
      const { id } = req.params;
      
      await pool.query('DELETE FROM cobros WHERE id = ?', [id]);
      
      res.json({ message: 'Cobro eliminado' });
    } catch (error) {
      console.error('Error en delete:', error);
      res.status(500).json({ error: 'Error al eliminar cobro' });
    }
  }
};

export default cobro;