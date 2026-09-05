import { pool } from '../config/database.js';

const periodo = {
  // GET /api/periodos/persona/:personaId
  getByPersona: async (req, res) => {
    try {
      const { personaId } = req.params;
      
      const [rows] = await pool.query(`
        SELECT 
          pa.*,
          pc.plan_id,
          pl.nombre AS plan_nombre,
          pl.precio AS plan_precio
        FROM periodos_alumno pa
        LEFT JOIN periodos_cobertura pc ON pa.id = pc.periodo_alumno_id
        LEFT JOIN planes pl ON pc.plan_id = pl.id
        WHERE pa.persona_id = ?
        ORDER BY pa.fecha_inicio DESC
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
          pa.*,
          pc.plan_id,
          pl.nombre AS plan_nombre,
          pl.precio AS plan_precio
        FROM periodos_alumno pa
        LEFT JOIN periodos_cobertura pc ON pa.id = pc.periodo_alumno_id
        LEFT JOIN planes pl ON pc.plan_id = pl.id
        WHERE pa.persona_id = ? AND pa.fecha_fin IS NULL
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
      
      const [rows] = await pool.query(`
        SELECT 
          pa.*,
          pc.plan_id,
          pl.nombre AS plan_nombre,
          pl.precio AS plan_precio
        FROM periodos_alumno pa
        LEFT JOIN periodos_cobertura pc ON pa.id = pc.periodo_alumno_id
        LEFT JOIN planes pl ON pc.plan_id = pl.id
        WHERE pa.persona_id = ?
        ORDER BY pa.fecha_inicio DESC
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
  // POST /api/periodos
  create: async (req, res) => {
    try {
      const { persona_id, fecha_inicio, fecha_fin, motivo_baja, observaciones } = req.body;
      
      const [result] = await pool.query(`
        INSERT INTO periodos_alumno (persona_id, fecha_inicio, fecha_fin, motivo_baja, observaciones)
        VALUES (?, ?, ?, ?, ?)
      `, [persona_id, fecha_inicio, fecha_fin || null, motivo_baja || null, observaciones || null]);
      
      const periodoId = result.insertId;

      // 👉 NUEVO: Pasa a ACTIVO y vinculamos el período y vencimiento
      await pool.query(`
        INSERT INTO persona_estados (persona_id, estado, fecha_cambio, valido_hasta, periodo_alumno_id)
        VALUES (?, 'ACTIVO', ?, ?, ?)
      `, [persona_id, fecha_inicio, fecha_fin || null, periodoId]);
      
      const [rows] = await pool.query(`
        SELECT * FROM periodos_alumno WHERE id = ?
      `, [periodoId]);
      
      res.status(201).json(rows[0]);
    } catch (error) {
      console.error('Error en create:', error);
      res.status(500).json({ error: 'Error al crear período' });
    }
  },

  // PUT /api/periodos/:id
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { fecha_inicio, fecha_fin, motivo_baja, observaciones } = req.body;
      
      await pool.query(`
        UPDATE periodos_alumno 
        SET fecha_inicio = ?, fecha_fin = ?, motivo_baja = ?, observaciones = ?
        WHERE id = ?
      `, [fecha_inicio, fecha_fin || null, motivo_baja || null, observaciones || null, id]);
      
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
  console.log("papa activado");
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params; // ID de periodos_alumno
    const { motivo_baja, observaciones } = req.body;
    const hoy = new Date().toISOString().split('T')[0];

    // 1. Obtener el persona_id asociado
    const [periodos] = await connection.query(`
      SELECT persona_id FROM periodos_alumno WHERE id = ?
    `, [id]);

    if (periodos.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Período no encontrado' });
    }

    const personaId = periodos[0].persona_id;

    // 2. Cerrar el período en periodos_alumno
    await connection.query(`
      UPDATE periodos_alumno 
      SET fecha_fin = ?, motivo_cierre = ?, observaciones = ?
      WHERE id = ?
    `, [hoy, motivo_baja, observaciones || null, id]);

    // 3. Insertar el nuevo estado 'BAJA' en el historial persona_estados
    await connection.query(`
      INSERT INTO persona_estados (persona_id, estado, motivo, periodo_alumno_id)
      VALUES (?, 'BAJA', ?, ?)
    `, [personaId, motivo_baja, id]);

    // Confirmar cambios
    await connection.commit();

    const [rows] = await pool.query(`
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