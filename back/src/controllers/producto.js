import { pool } from '../config/database.js';

const producto = {
  // Obtener todos los productos (opcionalmente filtrar activos)
  getAll: async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM productos ORDER BY nombre ASC');
      return res.json(rows);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: 'Error al obtener productos' });
    }
  },

  // Obtener producto por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await pool.query('SELECT * FROM productos WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ mensaje: 'Producto no encontrado' });
      }
      return res.json(rows[0]);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: 'Error al obtener el producto' });
    }
  },

  // Crear nuevo producto
  create: async (req, res) => {
    try {
      const { codigo_barras, nombre, descripcion, precio_unitario, stock } = req.body;
      
      if (!nombre || precio_unitario === undefined) {
        return res.status(400).json({ mensaje: 'Nombre y precio unitario son requeridos' });
      }

      const [result] = await pool.query(
        `INSERT INTO productos (codigo_barras, nombre, descripcion, precio_unitario, stock) 
         VALUES (?, ?, ?, ?, ?)`,
        [codigo_barras || null, nombre, descripcion || null, precio_unitario, stock || 0]
      );

      return res.status(201).json({
        mensaje: 'Producto creado exitosamente',
        id: result.insertId
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: 'Error al crear el producto' });
    }
  },

  // Actualizar datos del producto
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { codigo_barras, nombre, descripcion, precio_unitario, stock } = req.body;

      const [result] = await pool.query(
        `UPDATE productos 
         SET codigo_barras = ?, nombre = ?, descripcion = ?, precio_unitario = ?, stock = ? 
         WHERE id = ?`,
        [codigo_barras || null, nombre, descripcion || null, precio_unitario, stock, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ mensaje: 'Producto no encontrado' });
      }

      return res.json({ mensaje: 'Producto actualizado correctamente' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: 'Error al actualizar el producto' });
    }
  },

  // Ajustar stock manualmente
  updateStock: async (req, res) => {
    try {
      const { id } = req.params;
      const { stock } = req.body;

      if (stock === undefined || stock < 0) {
        return res.status(400).json({ mensaje: 'Stock no válido' });
      }

      const [result] = await pool.query('UPDATE productos SET stock = ? WHERE id = ?', [stock, id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ mensaje: 'Producto no encontrado' });
      }

      return res.json({ mensaje: 'Stock actualizado correctamente' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: 'Error al actualizar el stock' });
    }
  },

  // Activar/Desactivar producto
  toggleEstado: async (req, res) => {
    try {
      const { id } = req.params;
      const [result] = await pool.query('UPDATE productos SET activo = NOT activo WHERE id = ?', [id]);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ mensaje: 'Producto no encontrado' });
      }

      return res.json({ mensaje: 'Estado del producto modificado' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: 'Error al cambiar estado' });
    }
  }
};

export default producto;