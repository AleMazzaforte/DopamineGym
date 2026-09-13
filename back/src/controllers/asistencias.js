// controllers/asistencias.js
import { pool } from '../config/database.js';

// ==========================================
// HELPERS PARA ZONA HORARIA ARGENTINA (UTC-3)
// ==========================================
const obtenerFechaHoraArgentina = () => {
  const now = new Date();
  // Forzamos la interpretación de la fecha actual en la zona horaria de Argentina
  const fechaAR = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  
  const year = fechaAR.getFullYear();
  const month = String(fechaAR.getMonth() + 1).padStart(2, '0');
  const day = String(fechaAR.getDate()).padStart(2, '0');
  const hours = String(fechaAR.getHours()).padStart(2, '0');
  const minutes = String(fechaAR.getMinutes()).padStart(2, '0');
  const seconds = String(fechaAR.getSeconds()).padStart(2, '0');
  
  // Formato compatible con MySQL DATETIME: "YYYY-MM-DD HH:mm:ss"
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const obtenerFechaHoyArgentina = () => {
  const now = new Date();
  const fechaAR = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  
  const year = fechaAR.getFullYear();
  const month = String(fechaAR.getMonth() + 1).padStart(2, '0');
  const day = String(fechaAR.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

const asistencia = {
  // POST /api/asistencias (Registrar ingreso)
  create: async (req, res) => {
    try {
      const { persona_id, dni } = req.body;

      let targetPersonaId = persona_id;

      // Si envían DNI en lugar de ID (útil para ingreso rápido por teclado en recepción)
      if (!targetPersonaId && dni) {
        const [personas] = await pool.query('SELECT id FROM personas WHERE dni = ?', [dni]);
        if (personas.length === 0) {
          return res.status(404).json({ error: 'Alumno no encontrado con ese DNI' });
        }
        targetPersonaId = personas[0].id;
      }

      if (!targetPersonaId) {
        return res.status(400).json({ error: 'Se requiere persona_id o dni' });
      }

      // 1. Verificar estado actual y obtener período activo (si existe)
      const [periodos] = await pool.query(
        `SELECT id FROM periodos_alumno 
         WHERE persona_id = ? AND (fecha_fin IS NULL OR fecha_fin >= CURDATE())
         ORDER BY id DESC LIMIT 1`,
        [targetPersonaId]
      );

      const periodoAlumnoId = periodos.length > 0 ? periodos[0].id : null;

      // 2. Obtener el estado de la persona para información del frontend
      const [estados] = await pool.query(
        `SELECT estado, valido_hasta FROM persona_estados 
         WHERE persona_id = ? 
         ORDER BY id DESC LIMIT 1`,
        [targetPersonaId]
      );

      const estadoActual = estados.length > 0 ? estados[0].estado : 'SIN ESTADO';

      // 3. Insertar la asistencia con la hora de Argentina forzada
      const fechaHoraAR = obtenerFechaHoraArgentina();
      
      const [result] = await pool.query(
        `INSERT INTO asistencias (persona_id, periodo_alumno_id, fecha_hora) 
         VALUES (?, ?, ?)`,
        [targetPersonaId, periodoAlumnoId, fechaHoraAR] // 👈 Reemplazamos NOW() por la variable
      );

      // 4. Retornar respuesta enriquecida
      res.status(201).json({
        id: result.insertId,
        message: 'Asistencia registrada correctamente',
        persona_id: targetPersonaId,
        estado_alumno: estadoActual,
        tiene_periodo_activo: !!periodoAlumnoId,
        fecha_hora: fechaHoraAR, // Opcional: devolver la fecha exacta que se guardó
      });
    } catch (error) {
      console.error('Error en registrar asistencia:', error);
      res.status(500).json({ error: 'Error al registrar la asistencia' });
    }
  },

  // GET /api/asistencias/hoy (Lista de ingresos del día actual)
  getHoy: async (req, res) => {
    try {
      // Obtenemos la fecha de hoy en Argentina para comparar, evitando que el servidor UTC 
      // muestre el día equivocado cerca de la medianoche.
      const fechaHoyAR = obtenerFechaHoyArgentina();

      const [rows] = await pool.query(`
        SELECT 
          a.id,
          a.persona_id,
          a.fecha_hora,
          p.nombre,
          p.apellido,
          p.dni,
          p.turno_preferido,
          pe.estado AS estado_actual
        FROM asistencias a
        INNER JOIN personas p ON a.persona_id = p.id
        LEFT JOIN (
          SELECT pe1.*
          FROM persona_estados pe1
          INNER JOIN (
            SELECT persona_id, MAX(id) as max_id 
            FROM persona_estados 
            GROUP BY persona_id
          ) pe2 ON pe1.id = pe2.max_id
        ) pe ON pe.persona_id = p.id
        WHERE DATE(a.fecha_hora) = ?  -- 👈 Reemplazamos CURDATE() por el parámetro
        ORDER BY a.fecha_hora DESC
      `, [fechaHoyAR]);

      res.json(rows);
    } catch (error) {
      console.error('Error en getHoy:', error);
      res.status(500).json({ error: 'Error al obtener asistencias del día' });
    }
  },

  // GET /api/asistencias/persona/:personaId (Historial de un alumno)
  getByPersona: async (req, res) => {
    try {
      const { personaId } = req.params;

      const [rows] = await pool.query(
        `SELECT 
           a.id,
           a.fecha_hora,
           a.periodo_alumno_id,
           pa.fecha_inicio AS periodo_inicio,
           pa.fecha_fin AS periodo_fin
         FROM asistencias a
         LEFT JOIN periodos_alumno pa ON a.periodo_alumno_id = pa.id
         WHERE a.persona_id = ?
         ORDER BY a.fecha_hora DESC`,
        [personaId]
      );

      res.json(rows);
    } catch (error) {
      console.error('Error en getByPersona:', error);
      res.status(500).json({ error: 'Error al obtener historial de asistencias' });
    }
  },

  // DELETE /api/asistencias/:id (Eliminar asistencia marcada por error)
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const [result] = await pool.query('DELETE FROM asistencias WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Registro de asistencia no encontrado' });
      }

      res.json({ message: 'Asistencia eliminada correctamente' });
    } catch (error) {
      console.error('Error en delete asistencia:', error);
      res.status(500).json({ error: 'Error al eliminar la asistencia' });
    }
  },
};

export default asistencia;