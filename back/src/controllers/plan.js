import { pool } from '../config/database.js';

const plan = {
  // GET /api/planes
  getAllPlanes: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT * FROM planes WHERE activo = TRUE ORDER BY precio ASC
      `);
      res.json(rows);
    } catch (error) {
      console.error('Error en getAll:', error);
      res.status(500).json({ error: 'Error al obtener planes' });
    }
  }
};

export default plan;