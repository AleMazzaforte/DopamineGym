// controllers/plan.js
import { pool } from '../config/database.js';

const plan = {
  // GET /api/planes (Permite filtrar opcionalmente por ?soloActivos=true)
  getAllPlanes: async (req, res) => {
    try {
      const { soloActivos } = req.query;
      let query = 'SELECT * FROM planes';

      // Aplica el filtro si el cliente solicita únicamente los planes que están activos
      if (soloActivos === 'true') {
        query += ' WHERE activo = TRUE';
      }

      // Ordena el resultado mostrando primero los planes activos y luego por precio de menor a mayor
      query += ' ORDER BY activo DESC, precio ASC';

      const [rows] = await pool.query(query);
      res.json(rows);
    } catch (error) {
      console.error('Error en getAllPlanes:', error);
      res.status(500).json({ error: 'Error al obtener los planes' });
    }
  },

  // GET /api/planes/:id
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await pool.query('SELECT * FROM planes WHERE id = ?', [id]);

      // Verifica si la consulta devolvió algún resultado
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Plan no encontrado' });
      }

      res.json(rows[0]);
    } catch (error) {
      console.error('Error en getById:', error);
      res.status(500).json({ error: 'Error al obtener el plan' });
    }
  },

  // POST /api/planes
  create: async (req, res) => {
    try {
      const { nombre, descripcion, veces_por_semana, precio, activo, duracion_meses } = req.body;

      // Valida que los campos obligatorios para la creación estén presentes en el cuerpo de la petición
      if (!nombre || precio === undefined || precio === null) {
        return res.status(400).json({ error: 'El nombre y el precio son obligatorios' });
      }

      const [result] = await pool.query(
        `INSERT INTO planes (nombre, descripcion, veces_por_semana, precio, activo, duracion_meses) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          nombre,
          descripcion || null,
          veces_por_semana ? parseInt(veces_por_semana) : null, // Convierte a entero o asigna null
          parseFloat(precio), // Asegura que el precio se guarde como número decimal
          activo !== undefined ? activo : true, // Asigna true por defecto si el campo no se envía
          parseInt(duracion_meses) || 1, 
        ]
      );

      res.status(201).json({ id: result.insertId, message: 'Plan creado exitosamente' });
    } catch (error) {
      console.error('Error en create:', error);
      res.status(500).json({ error: 'Error al crear el plan' });
    }
  },

  // PUT /api/planes/:id
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, descripcion, veces_por_semana, precio, activo, duracion_meses } = req.body;

      const [result] = await pool.query(
        `UPDATE planes 
         SET nombre = ?, descripcion = ?, veces_por_semana = ?, precio = ?, activo = ?, duracion_meses = ?
         WHERE id = ?`,
        [
          nombre,
          descripcion || null,
          veces_por_semana ? parseInt(veces_por_semana) : null,
          parseFloat(precio),
          activo,
          parseInt(duracion_meses) || 1,
          id,
        ]
      );

      // Verifica si la actualización afectó alguna fila para confirmar que el ID existía en la base de datos
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Plan no encontrado' });
      }

      res.json({ message: 'Plan actualizado correctamente' });
    } catch (error) {
      console.error('Error en update:', error);
      res.status(500).json({ error: 'Error al actualizar el plan' });
    }
  },

  // PUT /api/planes/toggle-estado/:id
  toggleEstado: async (req, res) => {
    try {
      const { id } = req.params;

      // Invierte el valor booleano del campo 'activo' (de 1 a 0 o de 0 a 1) para el plan especificado
      const [result] = await pool.query(
        'UPDATE planes SET activo = NOT activo WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Plan no encontrado' });
      }

      res.json({ message: 'Estado del plan actualizado correctamente' });
    } catch (error) {
      console.error('Error en toggleEstado:', error);
      res.status(500).json({ error: 'Error al cambiar estado del plan' });
    }
  },
};

export default plan;