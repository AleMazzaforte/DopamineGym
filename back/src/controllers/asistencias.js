// controllers/asistencias.js
import { pool } from '../config/database.js';
import { obtenerFechaHoraArgentina, obtenerFechaHoyArgentina } from '../utils/dateUtils.js';

const asistencia = {
  // POST /api/asistencias (Registrar ingreso)
  create: async (req, res) => {
    try {
      const { persona_id, dni } = req.body;
      let targetPersonaId = persona_id;

      // Busca el ID de la persona en la base de datos si el frontend solo envía el DNI
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

      // Obtiene el período de membresía más reciente del alumno.
      // El LEFT JOIN con periodos_cobertura verifica si existe un plan vigente en la fecha de hoy.
      const [periodos] = await pool.query(
        `SELECT 
           pa.id AS periodo_id, 
           pc.id AS cobertura_id,
           pc.fecha_fin AS cobertura_fin
         FROM periodos_alumno pa
         LEFT JOIN periodos_cobertura pc 
           ON pa.id = pc.periodo_alumno_id 
           AND CURDATE() BETWEEN pc.fecha_inicio AND pc.fecha_fin
         WHERE pa.persona_id = ?
         ORDER BY pa.fecha_inicio DESC 
         LIMIT 1`,
        [targetPersonaId]
      );

      // Asigna el ID del período para vincular la asistencia (puede ser null si el alumno nunca tuvo un período)
      const periodoAlumnoId = periodos.length > 0 ? periodos[0].periodo_id : null;

      // Determina si el alumno tiene un plan activo en la fecha de hoy para que el frontend pueda mostrar advertencias
      const tieneCoberturaActiva = periodos.length > 0 && periodos[0].cobertura_id !== null;

      // Obtiene el último estado registrado de la persona en la tabla de historial de estados
      const [estados] = await pool.query(
        `SELECT estado, valido_hasta 
         FROM persona_estados 
         WHERE persona_id = ? 
         ORDER BY id DESC LIMIT 1`,
        [targetPersonaId]
      );

      const estadoActual = estados.length > 0 ? estados[0].estado : 'SIN ESTADO';
      const fechaHoraAR = obtenerFechaHoraArgentina();

      // Inserta el registro de asistencia vinculándolo al período de membresía identificado
      const [result] = await pool.query(
        `INSERT INTO asistencias (persona_id, periodo_alumno_id, fecha_hora) 
         VALUES (?, ?, ?)`,
        [targetPersonaId, periodoAlumnoId, fechaHoraAR]
      );

      // Retorna la confirmación incluyendo el estado de cobertura para la lógica de interfaz de usuario
      res.status(201).json({
        id: result.insertId,
        message: 'Asistencia registrada correctamente',
        persona_id: targetPersonaId,
        estado_alumno: estadoActual,
        tiene_cobertura_activa: tieneCoberturaActiva,
        fecha_hora: fechaHoraAR,
      });
    } catch (error) {
      console.error('Error en registrar asistencia:', error);
      res.status(500).json({ error: 'Error al registrar la asistencia' });
    }
  },

  // GET /api/asistencias/hoy (Lista de ingresos del día actual)
  getHoy: async (req, res) => {
    try {
      // Calcula la fecha actual en la zona horaria de Argentina para usarla como filtro
      const fechaHoyAR = obtenerFechaHoyArgentina();

      // Obtiene las asistencias del día junto con los datos demográficos del alumno y su estado actual
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
        WHERE DATE(a.fecha_hora) = ?
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

      // Obtiene el historial de asistencias vinculando las fechas de la cobertura del plan que estaba vigente en ese momento
      const [rows] = await pool.query(
        `SELECT 
           a.id,
           a.fecha_hora,
           a.periodo_alumno_id,
           pa.fecha_inicio AS membresia_inicio,
           pa.fecha_cierre AS membresia_cierre,
           pc.fecha_inicio AS cobertura_inicio,
           pc.fecha_fin AS cobertura_fin,
           pl.nombre AS plan_nombre
         FROM asistencias a
         LEFT JOIN periodos_alumno pa ON a.periodo_alumno_id = pa.id
         LEFT JOIN periodos_cobertura pc 
           ON a.periodo_alumno_id = pc.periodo_alumno_id 
           AND DATE(a.fecha_hora) BETWEEN pc.fecha_inicio AND pc.fecha_fin
         LEFT JOIN planes pl ON pc.plan_id = pl.id
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

      // Elimina el registro de asistencia de la base de datos utilizando su ID primario
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