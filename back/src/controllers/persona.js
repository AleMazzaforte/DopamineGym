import { pool } from '../config/database.js';


const persona = {
  // GET /api/personas

getAll: async (req, res) => {
  try {
    const { rol, term, soloBaja } = req.query; // 👈 Recibimos soloBaja
    
    let query = `
      SELECT 
        p.*,
        COALESCE(
          (SELECT estado FROM persona_estados pe 
           WHERE pe.persona_id = p.id 
           ORDER BY id DESC LIMIT 1), 
          'INACTIVO'
        ) AS estado
      FROM personas p
      WHERE 1=1
    `;
    
    const params = [];
    
    if (rol) {
      query += ' AND p.rol_actual = ?';
      params.push(rol);
    }
    
    if (term) {
      const searchTerm = `%${term}%`;
      query += ' AND (p.dni LIKE ? OR p.nombre LIKE ? OR p.apellido LIKE ?)';
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY p.apellido, p.nombre';
    
    const [rows] = await pool.query(query, params);
    
    // 👈 Filtrado según la opción del checkbox
    const esSoloBaja = soloBaja === 'true';
    const result = rol === 'ALUMNO' 
      ? rows.filter(p => esSoloBaja ? p.estado === 'BAJA' : p.estado !== 'BAJA') 
      : rows;
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error en getAll:', error);
    if (error.code === 'ECONNRESET') {
      return res.status(503).json({ 
        error: 'La conexión con la base de datos se perdió. Por favor, intenta de nuevo.'
      });
    }
    res.status(500).json({ error: 'Error al obtener personas' });
  }
},

  // GET /api/personas/search
  /*
  search: async (req, res) => {
    try {
      const { term, rol } = req.query;
      
      if (!term) {
        return res.status(400).json({ error: 'Término de búsqueda requerido' });
      }
      
      const searchTerm = `%${term}%`;
      
      let query = `${QUERY_PERSONA_CON_ESTADO}
        WHERE (p.dni LIKE ? OR p.nombre LIKE ? OR p.apellido LIKE ?)
      `;
      
      const params = [searchTerm, searchTerm, searchTerm];
      
      if (rol) {
        query += ' AND p.rol_actual = ?';
        params.push(rol);
      }
      
      query += ' ORDER BY p.apellido, p.nombre';
      
      // ✅ CORREGIDO: usar pool en lugar de connection
      const [rows] = await pool.query(query, params);
      
      res.json(rows);
    } catch (error) {
      console.error('❌ Error en search:', error);
      if (error.code === 'ECONNRESET') {
        return res.status(503).json({ 
          error: 'La conexión con la base de datos se perdió. Por favor, intenta de nuevo.'
        });
      }
      res.status(500).json({ error: 'Error al buscar personas' });
    }
  },*/

  // GET /api/personas/:id
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      
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
      
      // ✅ CORREGIDO: usar pool en lugar de connection
      const [rows] = await pool.query(query, [id]);
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Persona no encontrada' });
      }
      
      res.json(rows[0]);
    } catch (error) {
      console.error('❌ Error en getById:', error);
      if (error.code === 'ECONNRESET') {
        return res.status(503).json({ 
          error: 'La conexión con la base de datos se perdió. Por favor, intenta de nuevo.'
        });
      }
      res.status(500).json({ error: 'Error al obtener persona' });
    }
  },

// POST /api/personas
  create: async (req, res) => {
    try {
      const {
        dni, nombre, apellido, fecha_nacimiento, telefono, email,
        rol_actual, contacto_emergencia, telefono_familiar,
        antecedentes_entrenamiento, restricciones, certificado_medico,
        fecha_vencimiento_certificado
      } = req.body;
      
      const [result] = await pool.query(`
        INSERT INTO personas (
          dni, nombre, apellido, fecha_nacimiento, telefono, email,
          rol_actual, contacto_emergencia, telefono_familiar,
          antecedentes_entrenamiento, restricciones, certificado_medico,
          fecha_vencimiento_certificado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dni, nombre, apellido, fecha_nacimiento, telefono, email,
        rol_actual, contacto_emergencia || null, telefono_familiar || null,
        antecedentes_entrenamiento || null, restricciones || null,
        certificado_medico || null, fecha_vencimiento_certificado || null
      ]);
      
      const personaId = result.insertId;

      // 👉 NUEVO: Nace como INACTIVO por defecto al registrarse
      const hoy = new Date().toISOString().split('T')[0];
      await pool.query(`
        INSERT INTO persona_estados (persona_id, estado, fecha_cambio, motivo)
        VALUES (?, 'INACTIVO', ?, ?)
      `, [personaId, hoy, 'Registro inicial']);
      
      const [rows] = await pool.query(
        'SELECT * FROM personas WHERE id = ?',
        [personaId]
      );
      
      res.status(201).json(rows[0]);
    } catch (error) {
      console.error('❌ Error en create:', error);
      if (error.code === 'ECONNRESET') {
        return res.status(503).json({ 
          error: 'La conexión con la base de datos se perdió. Por favor, intenta de nuevo.'
        });
      }
      res.status(500).json({ error: 'Error al crear persona' });
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
        'fecha_vencimiento_certificado'
      ];
      
      const fields = Object.keys(updates).filter(key => camposValidos.includes(key));
      
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
      }
      
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = [...fields.map(field => updates[field]), id];
      
      // ✅ CORREGIDO: usar pool en lugar de connection
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
      
      // ✅ CORREGIDO: usar pool en lugar de connection
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
      
      // ✅ CORREGIDO: usar pool en lugar de connection
      const [rows] = await pool.query(`
        SELECT 
          pe.*,
          pa.fecha_inicio,
          pa.fecha_fin,
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

      // Verificar que la persona exista
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