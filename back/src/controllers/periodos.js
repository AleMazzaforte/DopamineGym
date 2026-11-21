import { pool } from '../config/database.js';

const periodo = {
  // GET /api/periodos/persona/:personaId
  getByPersona: async (req, res) => {
    try {
      const { personaId } = req.params;
      
      const [rows] = await pool.query(`
        SELECT 
          pa.id AS periodo_id,
          pa.persona_id,
          pa.fecha_inicio,
          pa.fecha_cierre,
          pa.motivo_cierre,
          pa.observaciones,
          pa.created_at,
          pc.id AS cobertura_id,
          pc.plan_id,
          pl.nombre AS plan_nombre,
          pl.precio AS plan_precio,
          pc.fecha_inicio AS cobertura_inicio,
          pc.fecha_fin AS cobertura_fin
        FROM periodos_alumno pa
        LEFT JOIN periodos_cobertura pc ON pa.id = pc.periodo_alumno_id
        LEFT JOIN planes pl ON pc.plan_id = pl.id
        WHERE pa.persona_id = ?
        ORDER BY pa.fecha_inicio DESC, pc.fecha_inicio DESC
      `, [personaId]);
      
      res.json(rows);
    } catch (error) {
      console.error('Error en getByPersona:', error);
      res.status(500).json({ error: 'Error al obtener períodos' });
    }
  },

  // GET /api/periodos/activo/:personaId
  getActivo: async (req, res) => {
    try {
      const { personaId } = req.params;
      
      const [rows] = await pool.query(`
        SELECT 
          pa.id AS periodo_id,
          pa.persona_id,
          pa.fecha_inicio,
          pc.id AS cobertura_id,
          pc.plan_id,
          pl.nombre AS plan_nombre,
          pl.precio AS plan_precio,
          pc.fecha_fin AS cobertura_fecha_fin
        FROM periodos_alumno pa
        LEFT JOIN periodos_cobertura pc 
          ON pa.id = pc.periodo_alumno_id 
          AND CURDATE() BETWEEN pc.fecha_inicio AND pc.fecha_fin
        LEFT JOIN planes pl ON pc.plan_id = pl.id
        WHERE pa.persona_id = ? 
          AND pa.fecha_cierre IS NULL
        LIMIT 1
      `, [personaId]);
      
      if (rows.length === 0) {
        return res.json(null);
      }
      
      res.json(rows[0]);
    } catch (error) {
      console.error('Error en getActivo:', error);
      res.status(500).json({ error: 'Error al obtener período activo' });
    }
  },

  // GET /api/periodos/ultimo/:personaId
  getUltimo: async (req, res) => {
    try {
      const { personaId } = req.params;
      
      // Obtiene el período de membresía más reciente del alumno, independientemente de si está cerrado o activo
      const [rows] = await pool.query(`
        SELECT 
          pa.id AS periodo_id,
          pa.persona_id,
          pa.fecha_inicio,
          pa.fecha_cierre,
          pa.motivo_cierre,
          pa.observaciones,
          pc.id AS cobertura_id,
          pc.plan_id,
          pl.nombre AS plan_nombre,
          pl.precio AS plan_precio,
          pc.fecha_inicio AS cobertura_inicio,
          pc.fecha_fin AS cobertura_fin
        FROM periodos_alumno pa
        LEFT JOIN periodos_cobertura pc ON pa.id = pc.periodo_alumno_id
        LEFT JOIN planes pl ON pc.plan_id = pl.id
        WHERE pa.persona_id = ?
        ORDER BY pa.fecha_inicio DESC, pc.fecha_inicio DESC
        LIMIT 1
      `, [personaId]);
      
      if (rows.length === 0) {
        return res.json(null);
      }
      
      res.json(rows[0]);
    } catch (error) {
      console.error('Error en getUltimo:', error);
      res.status(500).json({ error: 'Error al obtener último período' });
    }
  },

  // POST /api/periodos
  create: async (req, res) => {
    try {
      const { persona_id, fecha_inicio, observaciones, plan_id, precio_aplicado, cobertura_fecha_fin } = req.body;
      
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const [resultPeriodo] = await connection.query(`
          INSERT INTO periodos_alumno (persona_id, fecha_inicio, observaciones)
          VALUES (?, ?, ?)
        `, [persona_id, fecha_inicio, observaciones || null]);
        
        const periodoId = resultPeriodo.insertId;

        if (plan_id && cobertura_fecha_fin) {
          await connection.query(`
            INSERT INTO periodos_cobertura (periodo_alumno_id, plan_id, fecha_inicio, fecha_fin, precio_aplicado)
            VALUES (?, ?, ?, ?, ?)
          `, [periodoId, plan_id, fecha_inicio, cobertura_fecha_fin, precio_aplicado]);
        }

        await connection.query(`
          INSERT INTO persona_estados (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id, motivo)
          VALUES (?, 'ACTIVO', ?, ?, ?, 'Ingreso / Renovación')
        `, [persona_id, fecha_inicio, cobertura_fecha_fin || null, periodoId]);
        
        await connection.commit();

        const [rows] = await connection.query(`
          SELECT * FROM periodos_alumno WHERE id = ?
        `, [periodoId]);
        
        res.status(201).json(rows[0]);
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }

    } catch (error) {
      console.error('Error en create:', error);
      res.status(500).json({ error: 'Error al crear período' });
    }
  },

  // PUT /api/periodos/:id
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { fecha_inicio, fecha_cierre, motivo_cierre, observaciones } = req.body;
      
      await pool.query(`
        UPDATE periodos_alumno 
        SET fecha_inicio = COALESCE(?, fecha_inicio),
            fecha_cierre = ?,
            motivo_cierre = ?,
            observaciones = COALESCE(?, observaciones)
        WHERE id = ?
      `, [fecha_inicio, fecha_cierre || null, motivo_cierre || null, observaciones, id]);
      
      const [rows] = await pool.query(`
        SELECT * FROM periodos_alumno WHERE id = ?
      `, [id]);
      
      res.json(rows[0]);
    } catch (error) {
      console.error('Error en update:', error);
      res.status(500).json({ error: 'Error al actualizar período' });
    }
  },

  // PUT /api/periodos/:id/baja
  registrarBaja: async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const { id } = req.params;
      const { motivo_cierre, motivo_baja, observaciones } = req.body;
      const motivoFinal = motivo_cierre || motivo_baja || 'Sin especificar';
      const hoy = new Date().toISOString().split('T')[0];

      const [periodos] = await connection.query(`
        SELECT persona_id FROM periodos_alumno WHERE id = ?
      `, [id]);

      if (periodos.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Período no encontrado' });
      }

      const personaId = periodos[0].persona_id;

      await connection.query(`
        UPDATE periodos_alumno 
        SET fecha_cierre = ?, motivo_cierre = ?, observaciones = ?
        WHERE id = ?
      `, [hoy, motivoFinal, observaciones || null, id]);

      await connection.query(`
        UPDATE periodos_cobertura 
        SET fecha_fin = ? 
        WHERE periodo_alumno_id = ? AND fecha_fin > ?
      `, [hoy, id, hoy]);

      await connection.query(`
        INSERT INTO persona_estados (persona_id, estado, motivo, periodo_alumno_id, fecha_cambio)
        VALUES (?, 'BAJA', ?, ?, ?)
      `, [personaId, motivoFinal, id, hoy]);

      await connection.commit();

      const [rows] = await connection.query(`
        SELECT * FROM periodos_alumno WHERE id = ?
      `, [id]);

      res.json(rows[0]);

    } catch (error) {
      await connection.rollback();
      console.error('Error en registrarBaja:', error);
      res.status(500).json({ error: 'Error al registrar la baja' });
    } finally {
      connection.release();
    }
  },

  // DELETE /api/periodos/:id
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      await pool.query('DELETE FROM periodos_alumno WHERE id = ?', [id]);
      
      res.json({ message: 'Período eliminado' });
    } catch (error) {
      console.error('Error en delete:', error);
      res.status(500).json({ error: 'Error al eliminar período' });
    }
  }
};

export default periodo;