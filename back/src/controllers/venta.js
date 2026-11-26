import { pool } from '../config/database.js';
import { obtenerFechaHoyArgentina, obtenerFechaHoraArgentina } from '../utils/dateUtils.js';
import {
  ErrorRegla, rollbackSeguro, round2, validarMetodo,
  exigirCajaAbierta, exigirMesAbierto, exigirMovimientoEditable
} from '../utils/blindajeDeCaja.js';

const venta = {

  getAll: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          v.id, v.fecha_venta, v.total, v.metodo_pago,
          CONCAT(p_comprador.nombre, ' ', p_comprador.apellido) AS comprador,
          CONCAT(p_vendedor.nombre, ' ', p_vendedor.apellido) AS vendedor
        FROM ventas v
        LEFT JOIN personas p_comprador ON v.persona_id = p_comprador.id
        JOIN personas p_vendedor ON v.vendedor_id = p_vendedor.id
        ORDER BY v.fecha_venta DESC
      `);
      return res.json(rows);
    } catch (error) {
      console.error('Error en getAll ventas:', error);
      return res.status(500).json({ mensaje: 'Error al obtener el historial de ventas' });
    }
  },

  getByIdWithDetails: async (req, res) => {
    try {
      const { id } = req.params;

      const [ventaHeader] = await pool.query(`
        SELECT v.*, CONCAT(p.nombre, ' ', p.apellido) AS comprador
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

      return res.json({ venta: ventaHeader[0], items: detalles });
    } catch (error) {
      console.error('Error en getByIdWithDetails:', error);
      return res.status(500).json({ mensaje: 'Error al obtener la venta' });
    }
  },

  // ==========================================================
  // CREATE — caja abierta + mes abierto + total calculado acá
  // ==========================================================
  create: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const { persona_id, metodo_pago, items } = req.body;
      const vendedor_id = req.usuario?.persona_id || req.usuario?.id;

      if (!vendedor_id) throw new ErrorRegla(401, 'No se pudo identificar al vendedor');
      if (!Array.isArray(items) || items.length === 0) {
        throw new ErrorRegla(400, 'La venta debe contener al menos un producto');
      }
      validarMetodo(metodo_pago || 'efectivo');

      const fechaVenta = obtenerFechaHoraArgentina();
      const periodo = obtenerFechaHoyArgentina().slice(0, 7);

      // 🔒 Cerraduras
      await exigirCajaAbierta(connection);
      await exigirMesAbierto(connection, periodo);

      // 1. Validar y cotizar cada ítem ANTES de insertar nada
      const itemsCalculados = [];
      let totalCalculado = 0;

      for (const item of items) {
        const productoId = Number(item.producto_id);
        const cantidad = Number(item.cantidad);
        const precio = round2(item.precio_unitario);

        if (!Number.isInteger(productoId) || productoId <= 0) {
          throw new ErrorRegla(400, 'Producto inválido en la venta');
        }
        if (!Number.isInteger(cantidad) || cantidad <= 0) {
          throw new ErrorRegla(400, 'La cantidad debe ser un entero mayor a cero');
        }
        if (!Number.isFinite(precio) || precio < 0) {
          throw new ErrorRegla(400, 'Precio unitario inválido');
        }

        // Bloqueo pesimista: evita vender dos veces el mismo stock
        const [prodRow] = await connection.query(
          `SELECT id, nombre, stock, activo FROM productos WHERE id = ? FOR UPDATE`,
          [productoId]
        );
        if (prodRow.length === 0) {
          throw new ErrorRegla(400, `El producto ID ${productoId} no existe`);
        }
        if (!prodRow[0].activo) {
          throw new ErrorRegla(400, `El producto "${prodRow[0].nombre}" está inactivo`);
        }
        if (prodRow[0].stock < cantidad) {
          throw new ErrorRegla(400, `Stock insuficiente de "${prodRow[0].nombre}". Disponible: ${prodRow[0].stock}`);
        }

        const subtotal = round2(cantidad * precio);
        totalCalculado = round2(totalCalculado + subtotal);
        itemsCalculados.push({ productoId, cantidad, precio, subtotal });
      }

      if (totalCalculado <= 0) {
        throw new ErrorRegla(400, 'El total de la venta debe ser mayor a cero');
      }

      // 2. Encabezado — el total NO viene del cliente, y fecha_venta en AR
      const [resultVenta] = await connection.query(
        `INSERT INTO ventas (persona_id, vendedor_id, total, metodo_pago, fecha_venta)
         VALUES (?, ?, ?, ?, ?)`,
        [persona_id || null, vendedor_id, totalCalculado, metodo_pago || 'efectivo', fechaVenta]
      );
      const ventaId = resultVenta.insertId;

      // 3. Detalle + descuento de stock
      for (const it of itemsCalculados) {
        await connection.query(
          `INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal)
           VALUES (?, ?, ?, ?, ?)`,
          [ventaId, it.productoId, it.cantidad, it.precio, it.subtotal]
        );
        await connection.query(
          `UPDATE productos SET stock = stock - ? WHERE id = ?`,
          [it.cantidad, it.productoId]
        );
      }

      await connection.commit();
      return res.status(201).json({
        mensaje: 'Venta registrada exitosamente',
        venta_id: ventaId,
        total: totalCalculado
      });
    } catch (error) {
      await rollbackSeguro(connection);
      if (error instanceof ErrorRegla) {
        return res.status(error.status).json({ mensaje: error.message });
      }
      console.error('Error en create venta:', error);
      return res.status(500).json({ mensaje: 'Error al procesar la venta' });
    } finally {
      if (connection) connection.release();
    }
  },

  // ==========================================================
  // ANULAR — solo con sesión abierta y mes abierto
  // ==========================================================
  anular: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const { id } = req.params;

      const [ventas] = await connection.query(
        `SELECT id,
                DATE_FORMAT(fecha_venta, '%Y-%m-%d %H:%i:%s') AS momento,
                DATE_FORMAT(fecha_venta, '%Y-%m') AS periodo
         FROM ventas WHERE id = ? FOR UPDATE`,
        [id]
      );
      if (ventas.length === 0) throw new ErrorRegla(404, 'Venta no encontrada');

      // 🔒 Cerraduras
      await exigirMovimientoEditable(connection, ventas[0].momento, ventas[0].periodo);

      const [items] = await connection.query(
        `SELECT producto_id, cantidad FROM venta_detalles WHERE venta_id = ?`,
        [id]
      );

      for (const item of items) {
        await connection.query(
          `UPDATE productos SET stock = stock + ? WHERE id = ?`,
          [item.cantidad, item.producto_id]
        );
      }

      // venta_detalles cae por ON DELETE CASCADE
      await connection.query(`DELETE FROM ventas WHERE id = ?`, [id]);

      await connection.commit();
      return res.json({ mensaje: 'Venta anulada y stock devuelto correctamente' });
    } catch (error) {
      await rollbackSeguro(connection);
      if (error instanceof ErrorRegla) {
        return res.status(error.status).json({ mensaje: error.message });
      }
      console.error('Error en anular venta:', error);
      return res.status(500).json({ mensaje: 'Error al anular la venta' });
    } finally {
      if (connection) connection.release();
    }
  }
};

export default venta;