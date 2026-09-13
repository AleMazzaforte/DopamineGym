// controllers/plan.js
import { pool } from '../config/database.js';

const plan = {
  // GET /api/planes (Permite filtrar opcionalmente por ?soloActivos=true)
  getAllPlanes: async (req, res) => {
    try {
      const { soloActivos } = req.query;
      let query = 'SELECT * FROM planes';
      
      if (soloActivos === 'true') {
        query += ' WHERE activo = TRUE';
      }
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
      const { nombre, descripcion, veces_por_semana, precio, activo } = req.body;

      if (!nombre || precio === undefined || precio === null) {
        return res.status(400).json({ error: 'El nombre y el precio son obligatorios' });
      }

      const [result] = await pool.query(
        `INSERT INTO planes (nombre, descripcion, veces_por_semana, precio, activo) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          nombre,
          descripcion || null,
          veces_por_semana ? parseInt(veces_por_semana) : null,
          parseFloat(precio),
          activo !== undefined ? activo : true,
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
      const { nombre, descripcion, veces_por_semana, precio, activo } = req.body;

      const [result] = await pool.query(
        `UPDATE planes 
         SET nombre = ?, descripcion = ?, veces_por_semana = ?, precio = ?, activo = ? 
         WHERE id = ?`,
        [
          nombre,
          descripcion || null,
          veces_por_semana ? parseInt(veces_por_semana) : null,
          parseFloat(precio),
          activo,
          id,
        ]
      );

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