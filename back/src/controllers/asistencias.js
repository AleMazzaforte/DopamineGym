import { pool } from '../config/database.js';

const asistencia = {
  // GET /api/asistencias/persona/:personaId
  getByPersona: async (req, res) => {
    try {
      const { personaId } = req.params;

      const [rows] = await pool.query(
        `SELECT id, persona_id, fecha_hora 
         FROM asistencias 
         WHERE persona_id = ? 
         ORDER BY fecha_hora DESC 
         LIMIT 30`,
        [personaId]
      );

      res.json(rows);
    } catch (error) {
      console.error('❌ Error en getByPersona (asistencias):', error);
      if (error.code === 'ECONNRESET') {
        return res.status(503).json({ 
          error: 'La conexión con la base de datos se perdió. Por favor, intenta de nuevo.'
        });
      }
      res.status(500).json({ error: 'Error al obtener asistencias' });
    }
  },

  // POST /api/asistencias
  create: async (req, res) => {
    try {
      const { persona_id } = req.body;

      if (!persona_id) {
        return res.status(400).json({ error: 'El ID de la persona es obligatorio' });
      }

      // 1. Verificar si la persona existe y su estado actual
      const [personas] = await pool.query(
        `SELECT p.id, 
                COALESCE(
                  (SELECT estado FROM persona_estados pe 
                   WHERE pe.persona_id = p.id 
                   ORDER BY id DESC LIMIT 1), 
                  'INACTIVO'
                ) AS estado
         FROM personas p 
         WHERE p.id = ?`,
        [persona_id]
      );

      if (personas.length === 0) {
        return res.status(404).json({ error: 'Persona no encontrada' });
      }

      if (personas[0].estado === 'BAJA') {
        return res.status(400).json({ error: 'No se puede registrar asistencia a una persona dada de baja' });
      }

      // 2. Controlar duplicados (evitar registrar más de un ingreso en el mismo día)
      const [asistenciaHoy] = await pool.query(
        `SELECT id FROM asistencias 
         WHERE persona_id = ? 
         AND DATE(fecha_hora) = CURDATE()`,
        [persona_id]
      );

      if (asistenciaHoy.length > 0) {
        return res.status(400).json({ error: 'La persona ya registró la asistencia el día de hoy' });
      }

      // 3. Registrar la asistencia
      const [result] = await pool.query(
        `INSERT INTO asistencias (persona_id, fecha_hora) VALUES (?, NOW())`,
        [persona_id]
      );

      const [nuevaAsistencia] = await pool.query(
        `SELECT * FROM asistencias WHERE id = ?`,
        [result.insertId]
      );

      res.status(201).json(nuevaAsistencia[0]);
    } catch (error) {
      console.error('❌ Error en create (asistencia):', error);
      if (error.code === 'ECONNRESET') {
        return res.status(503).json({ 
          error: 'La conexión con la base de datos se perdió. Por favor, intenta de nuevo.'
        });
      }
      res.status(500).json({ error: 'Error al registrar la asistencia' });
    }
  }
};

export default asistencia;