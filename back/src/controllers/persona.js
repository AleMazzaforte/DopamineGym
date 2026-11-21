import { pool } from '../config/database.js';
import bcrypt from 'bcryptjs'; // 👈 Se agrega bcrypt para encriptar la clave inicial (DNI)

const persona = {
  // GET /api/personas
  getAll: async (req, res) => {
    try {
      const { term, rol, verBajas } = req.query;

      let sql = `
        SELECT 
          persona_id AS id,
          dni, nombre, apellido, telefono, rol_actual,
          estado_efectivo AS estado,
          tiene_deuda,
          plan_nombre,
          cobertura_fin,
          saldo_pendiente,
          periodo_id,
          fecha_promesa_pago
        FROM v_estado_alumnos
        WHERE 1=1
      `;
      const params = [];

      if (rol) {
        sql += ` AND rol_actual = ?`;
        params.push(rol);
      }

      if (term) {
        sql += ` AND (dni LIKE ? OR nombre LIKE ? OR apellido LIKE ?)`;
        const search = `%${term}%`;
        params.push(search, search, search);
      }

      // Sin el filtro de bajas, oculta los que tienen baja explícita
      if (verBajas !== 'true') {
        sql += ` AND estado_efectivo != 'BAJA'`;
      }

      sql += ` ORDER BY apellido, nombre`;

      const [rows] = await pool.query(sql, params);
      // Normalizar campos numéricos que la vista devuelve como tinyint
      const rowsNormalizadas = rows.map(row => ({
        ...row,
        tiene_deuda: Boolean(row.tiene_deuda),
        saldo_pendiente: row.saldo_pendiente ? Number(row.saldo_pendiente) : 0,
      }));

      res.json(rowsNormalizadas);
    } catch (error) {
      console.error('Error en getAll:', error);
      res.status(500).json({ error: 'Error al obtener las personas' });
    }
  },

  // GET /api/personas/:id
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await pool.query(
        `SELECT * FROM v_estado_alumnos WHERE persona_id = ?`,
        [id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Persona no encontrada' });
      }
      res.json(rows[0]);
    } catch (error) {
      console.error('Error en getById:', error);
      res.status(500).json({ error: 'Error al obtener la persona' });
    }
  },

  // POST /api/personas (ACTUALIZADO CON CREACIÓN AUTOMÁTICA DE USUARIO)
  create: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        dni, nombre, apellido, fecha_nacimiento, telefono, email,
        rol_actual, contacto_emergencia, telefono_familiar,
        antecedentes_entrenamiento, restricciones, certificado_medico,
        fecha_vencimiento_certificado, turno_preferido, dias_preferidos,
      } = req.body;

      // 1. Insertar Persona
      const [result] = await connection.query(`
        INSERT INTO personas (
          dni, nombre, apellido, fecha_nacimiento, telefono, email,
          rol_actual, contacto_emergencia, telefono_familiar,
          antecedentes_entrenamiento, restricciones, certificado_medico,
          fecha_vencimiento_certificado, turno_preferido, dias_preferidos
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dni, nombre, apellido, fecha_nacimiento, telefono, email,
        rol_actual, contacto_emergencia || null, telefono_familiar || null,
        antecedentes_entrenamiento || null, restricciones || null,
        certificado_medico || null, fecha_vencimiento_certificado || null, turno_preferido || null, dias_preferidos || null
      ]);

      const personaId = result.insertId;

      // 2. Estado inicial como INACTIVO
      const hoy = new Date().toISOString().split('T')[0];
      await connection.query(`
        INSERT INTO persona_estados (persona_id, estado, fecha_cambio, motivo)
        VALUES (?, 'INACTIVO', ?, ?)
      `, [personaId, hoy, 'Registro inicial']);

      // 3. 👉 NUEVO: Generar acceso a la app (Registro en la tabla usuarios)
      const passwordHash = await bcrypt.hash(String(dni), 10);
      await connection.query(`
        INSERT INTO usuarios (persona_id, username, password_hash, activo)
        VALUES (?, ?, ?, TRUE)
      `, [personaId, String(dni), passwordHash]);

      // Confirmar Transacción
      await connection.commit();

      const [rows] = await pool.query(
        'SELECT * FROM personas WHERE id = ?',
        [personaId]
      );

      res.status(201).json(rows[0]);
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error en create:', error);
      if (error.code === 'ECONNRESET') {
        return res.status(503).json({
          error: 'La conexión con la base de datos se perdió. Por favor, intenta de nuevo.'
        });
      }
      res.status(500).json({ error: 'Error al crear persona y usuario' });
    } finally {
      connection.release();
    }
  },

  // PUT /api/personas/:id
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const camposValidos = [
        'dni', 'nombre', 'apellido', 'fecha_nacimiento', 'telefono', 'email',
        'rol_actual', 'contacto_emergencia', 'telefono_familiar',
        'antecedentes_entrenamiento', 'restricciones', 'certificado_medico',
        'fecha_vencimiento_certificado', 'turno_preferido', 'dias_preferidos'
      ];

      const fields = Object.keys(updates).filter(key => camposValidos.includes(key));

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
      }

      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = [...fields.map(field => updates[field]), id];

      await pool.query(`UPDATE personas SET ${setClause} WHERE id = ?`, values);

      const query = `
        SELECT 
          p.*,
          pe.estado,
          pe.fecha_cambio AS ultimo_cambio_estado
        FROM personas p
        LEFT JOIN persona_estados pe ON p.id = pe.persona_id
        WHERE pe.id = (
          SELECT pe2.id 
          FROM persona_estados pe2 
          WHERE pe2.persona_id = p.id 
          ORDER BY pe2.fecha_cambio DESC 
          LIMIT 1
        )
        AND p.id = ?
      `;

      const [rows] = await pool.query(query, [id]);

      res.json(rows[0]);
    } catch (error) {
      console.error('❌ Error en update:', error);
      if (error.code === 'ECONNRESET') {
        return res.status(503).json({
          error: 'La conexión con la base de datos se perdió. Por favor, intenta de nuevo.'
        });
      }
      res.status(500).json({ error: 'Error al actualizar persona' });
    }
  },

  // GET /api/personas/:id/historial
  getHistorialEstados: async (req, res) => {
    try {
      const { id } = req.params;

      const [rows] = await pool.query(`
        SELECT 
          pe.*,
          pa.fecha_inicio,
          pa.fecha_cierre,
          pa.motivo_baja
        FROM persona_estados pe
        LEFT JOIN periodos_alumno pa ON pe.periodo_alumno_id = pa.id
        WHERE pe.persona_id = ?
        ORDER BY pe.fecha_cambio DESC
      `, [id]);

      res.json(rows);
    } catch (error) {
      console.error('❌ Error en getHistorialEstados:', error);
      if (error.code === 'ECONNRESET') {
        return res.status(503).json({
          error: 'La conexión con la base de datos se perdió. Por favor, intenta de nuevo.'
        });
      }
      res.status(500).json({ error: 'Error al obtener historial' });
    }
  },

  activarProvisorio: async (req, res) => {
    try {
      const { id } = req.params;
      const { fecha_promesa_pago, observaciones } = req.body;

      const [personas] = await pool.query('SELECT id FROM personas WHERE id = ?', [id]);
      if (personas.length === 0) {
        return res.status(404).json({ error: 'Persona no encontrada' });
      }

      const hoy = new Date().toISOString().split('T')[0];
      const fechaPromesa = fecha_promesa_pago || null;
      const obs = observaciones && observaciones.trim() !== '' ? observaciones.trim() : null;

      await pool.query(`
        INSERT INTO persona_estados 
          (persona_id, estado, fecha_cambio, motivo, observaciones, fecha_promesa_pago)
        VALUES (?, 'ACTIVO PROVISORIO', ?, 'Promesa de pago', ?, ?)
      `, [id, hoy, obs, fechaPromesa]);

      res.status(200).json({
        message: 'Estado provisorio activado con éxito',
        persona_id: Number(id),
        estado: 'ACTIVO PROVISORIO'
      });
    } catch (error) {
      console.error('❌ Error en activarProvisorio:', error);
      if (error.code === 'ECONNRESET') {
        return res.status(503).json({
          error: 'La conexión con la base de datos se perdió. Por favor, intenta de nuevo.'
        });
      }
      res.status(500).json({ error: 'Error al activar estado provisorio' });
    }
  }
};

export default persona;