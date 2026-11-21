import { pool } from '../config/database.js';

const venta = {
  // Obtener historial de ventas
  getAll: async (req, res) => {
    try {
      const query = `
        SELECT 
          v.id,
          v.fecha_venta,
          v.total,
          v.metodo_pago,
          CONCAT(p_comprador.nombre, ' ', p_comprador.apellido) AS comprador,
          CONCAT(p_vendedor.nombre, ' ', p_vendedor.apellido) AS vendedor
        FROM ventas v
        LEFT JOIN personas p_comprador ON v.persona_id = p_comprador.id
        JOIN personas p_vendedor ON v.vendedor_id = p_vendedor.id
        ORDER BY v.fecha_venta DESC
      `;
      const [rows] = await pool.query(query);
      return res.json(rows);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: 'Error al obtener el historial de ventas' });
    }
  },

  // Obtener una venta con sus detalles/ítems
  getByIdWithDetails: async (req, res) => {
    try {
      const { id } = req.params;

      const [ventaHeader] = await pool.query(`
        SELECT v.*, 
               CONCAT(p.nombre, ' ', p.apellido) AS comprador
        FROM ventas v
        LEFT JOIN personas p ON v.persona_id = p.id
        WHERE v.id = ?
      `, [id]);

      if (ventaHeader.length === 0) {
        return res.status(404).json({ mensaje: 'Venta no encontrada' });
      }

      const [detalles] = await pool.query(`
        SELECT vd.*, prod.nombre AS producto_nombre
        FROM venta_detalles vd
        JOIN productos prod ON vd.producto_id = prod.id
        WHERE vd.venta_id = ?
      `, [id]);

      return res.json({
        venta: ventaHeader[0],
        items: detalles
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ mensaje: 'Error al obtener la venta' });
    }
  },

  // Registrar venta (transaccional)
 create: async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { persona_id, metodo_pago, total, items } = req.body;
    const vendedor_id = req.usuario?.persona_id || req.usuario?.id; 

    if (!items || items.length === 0) {
      return res.status(400).json({ mensaje: 'La venta debe contener al menos un producto' });
    }

      // Iniciar Transacción SQL
      await connection.beginTransaction();

      // 1. Insertar el encabezado de la venta
      const [resultVenta] = await connection.query(
        `INSERT INTO ventas (persona_id, vendedor_id, total, metodo_pago) 
         VALUES (?, ?, ?, ?)`,
        [persona_id || null, vendedor_id, total, metodo_pago || 'efectivo']
      );
      const ventaId = resultVenta.insertId;

      // 2. Procesar ítems, registrar detalle y descontar stock
      for (const item of items) {
        const { producto_id, cantidad, precio_unitario } = item;
        const subtotal = cantidad * precio_unitario;

        // Verificar stock suficiente
        const [prodRow] = await connection.query('SELECT stock, nombre FROM productos WHERE id = ?', [producto_id]);
        if (prodRow.length === 0) {
          throw new Error(`El producto ID ${producto_id} no existe`);
        }
        if (prodRow[0].stock < cantidad) {
          throw new Error(`Stock insuficiente para el producto: ${prodRow[0].nombre}`);
        }

        // Insertar renglón de detalle
        await connection.query(
          `INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal)
           VALUES (?, ?, ?, ?, ?)`,
          [ventaId, producto_id, cantidad, precio_unitario, subtotal]
        );

        // Descontar stock
        await connection.query(
          `UPDATE productos SET stock = stock - ? WHERE id = ?`,
          [cantidad, producto_id]
        );
      }

      // Confirmar transacción
      await connection.commit();

      return res.status(201).json({
        mensaje: 'Venta registrada exitosamente',
        venta_id: ventaId
      });

    } catch (error) {
      // Deshacer cambios ante cualquier fallo
      await connection.rollback();
      console.error(error);
      return res.status(400).json({ mensaje: error.message || 'Error al procesar la venta' });
    } finally {
      connection.release();
    }
  },

  // Anular venta (reponiendo stock)
  anular: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const { id } = req.params;

      await connection.beginTransaction();

      // Obtener los detalles para reponer stock
      const [items] = await connection.query('SELECT producto_id, cantidad FROM venta_detalles WHERE venta_id = ?', [id]);

      if (items.length === 0) {
        await connection.rollback();
        return res.status(404).json({ mensaje: 'Venta no encontrada o sin ítems' });
      }

      // Reponer stock de cada producto
      for (const item of items) {
        await connection.query('UPDATE productos SET stock = stock + ? WHERE id = ?', [item.cantidad, item.producto_id]);
      }

      // Eliminar registro de la venta (o marcar como anulada según preferencia)
      await connection.query('DELETE FROM ventas WHERE id = ?', [id]);

      await connection.commit();
      return res.json({ mensaje: 'Venta anulada y stock devuelto correctamente' });

    } catch (error) {
      await connection.rollback();
      console.error(error);
      return res.status(500).json({ mensaje: 'Error al anular la venta' });
    } finally {
      connection.release();
    }
  }
};

export default venta;