import { pool } from '../config/database.js';
import { obtenerFechaHoyArgentina, obtenerFechaHoraArgentina } from '../utils/dateUtils.js';
import {
  ErrorRegla, rollbackSeguro, round2, validarMetodo,
  exigirCajaAbierta, exigirMesAbierto, exigirMovimientoEditable
} from '../utils/blindajeDeCaja.js';

const personaDeReq = (req) => req.usuario?.persona_id || req.usuario?.id;

const venta = {

  getAll: async (req, res) => {
    try {
      const { solo_con_deuda } = req.query;
      let where = '1=1';
      if (solo_con_deuda === '1') where += ' AND v.saldo_pendiente > 0';

      const [rows] = await pool.query(`
        SELECT v.id,
               DATE_FORMAT(v.fecha_venta, '%Y-%m-%d %H:%i') AS fecha_venta,
               v.total, v.monto_pagado, v.saldo_pendiente, v.metodo_pago,
               v.persona_id,
               CONCAT(pc.nombre, ' ', pc.apellido) AS comprador,
               CONCAT(pv.nombre, ' ', pv.apellido) AS vendedor,
               (SELECT COUNT(*) FROM venta_detalles vd WHERE vd.venta_id = v.id) AS items
        FROM ventas v
        LEFT JOIN personas pc ON pc.id = v.persona_id
        JOIN personas pv ON pv.id = v.vendedor_id
        WHERE ${where}
        ORDER BY v.fecha_venta DESC, v.id DESC
        LIMIT 300
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

      const [header] = await pool.query(`
        SELECT v.*,
               DATE_FORMAT(v.fecha_venta, '%Y-%m-%d %H:%i') AS fecha_venta_fmt,
               CONCAT(pc.nombre, ' ', pc.apellido) AS comprador,
               CONCAT(pv.nombre, ' ', pv.apellido) AS vendedor
        FROM ventas v
        LEFT JOIN personas pc ON pc.id = v.persona_id
        JOIN personas pv ON pv.id = v.vendedor_id
        WHERE v.id = ? LIMIT 1
      `, [id]);

      if (header.length === 0) return res.status(404).json({ mensaje: 'Venta no encontrada' });

      const [items] = await pool.query(`
        SELECT vd.*, p.nombre AS producto_nombre, p.sku
        FROM venta_detalles vd
        JOIN productos p ON p.id = vd.producto_id
        WHERE vd.venta_id = ?
      `, [id]);

      const [pagos] = await pool.query(`
        SELECT vp.id, vp.monto, vp.metodo_pago,
               DATE_FORMAT(vp.fecha_pago, '%Y-%m-%d') AS fecha_pago,
               CONCAT(pe.nombre, ' ', pe.apellido) AS cobrador
        FROM venta_pagos vp
        JOIN personas pe ON pe.id = vp.persona_id
        WHERE vp.venta_id = ?
        ORDER BY vp.fecha_pago ASC, vp.id ASC
      `, [id]);

      return res.json({ venta: header[0], items, pagos });
    } catch (error) {
      console.error('Error en getByIdWithDetails:', error);
      return res.status(500).json({ mensaje: 'Error al obtener la venta' });
    }
  },

  /* ============================================================
     CREATE — precio de catálogo, fiado, pagos y movimientos
     ============================================================ */
  create: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const { persona_id, metodo_pago, items } = req.body;
      const vendedorId = personaDeReq(req);
      const compradorId = persona_id ? Number(persona_id) : null;

      if (!vendedorId) throw new ErrorRegla(401, 'No se pudo identificar al vendedor');
      if (!Array.isArray(items) || items.length === 0) {
        throw new ErrorRegla(400, 'La venta debe contener al menos un producto');
      }

      const fechaVenta = obtenerFechaHoraArgentina();
      const fechaHoy = obtenerFechaHoyArgentina();
      const periodo = fechaHoy.slice(0, 7);

      const sesion = await exigirCajaAbierta(connection);
      await exigirMesAbierto(connection, periodo);

      // 1. Cotizar con precios de CATÁLOGO (el cliente no manda precios)
      const lineas = [];
      let total = 0;

      for (const item of items) {
        const productoId = Number(item.producto_id);
        const cantidad = Number(item.cantidad);

        if (!Number.isInteger(productoId) || productoId <= 0) {
          throw new ErrorRegla(400, 'Producto inválido en la venta');
        }
        if (!Number.isInteger(cantidad) || cantidad <= 0) {
          throw new ErrorRegla(400, 'La cantidad debe ser un entero mayor a cero');
        }

        const [prod] = await connection.query(
          `SELECT id, nombre, stock, activo, precio_unitario FROM productos WHERE id = ? FOR UPDATE`,
          [productoId]
        );
        if (prod.length === 0) throw new ErrorRegla(400, `El producto ID ${productoId} no existe`);
        if (!prod[0].activo) throw new ErrorRegla(400, `"${prod[0].nombre}" está inactivo`);
        if (prod[0].stock < cantidad) {
          throw new ErrorRegla(400, `Stock insuficiente de "${prod[0].nombre}". Disponible: ${prod[0].stock}`);
        }

        const precio = round2(prod[0].precio_unitario);
        const subtotal = round2(precio * cantidad);
        total = round2(total + subtotal);

        lineas.push({
          productoId, cantidad, precio, subtotal,
          nombre: prod[0].nombre, stockResultante: prod[0].stock - cantidad
        });
      }

      if (total <= 0) throw new ErrorRegla(400, 'El total de la venta debe ser mayor a cero');

      // 2. Cuánto se cobra ahora. Sin dato = pago total.
      const pagado = req.body.monto_pagado === undefined || req.body.monto_pagado === null
        ? total
        : round2(req.body.monto_pagado);

      if (!Number.isFinite(pagado) || pagado < 0) {
        throw new ErrorRegla(400, 'El monto cobrado debe ser cero o positivo');
      }
      if (pagado > total) {
        throw new ErrorRegla(400, `No podés cobrar más que el total ($${total.toFixed(2)})`);
      }

      const saldo = round2(total - pagado);

      // No se fía a un comprador anónimo
      if (saldo > 0 && !compradorId) {
        throw new ErrorRegla(400, 'Para dejar saldo pendiente hay que identificar al alumno comprador');
      }
      if (pagado > 0) validarMetodo(metodo_pago);

      // 3. Encabezado
      const [rVenta] = await connection.query(
        `INSERT INTO ventas
           (persona_id, vendedor_id, fecha_venta, total, monto_pagado, saldo_pendiente, metodo_pago)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [compradorId, vendedorId, fechaVenta, total, pagado, saldo, metodo_pago || 'efectivo']
      );
      const ventaId = rVenta.insertId;

      // 4. Detalle + stock + movimiento auditado
      for (const l of lineas) {
        await connection.query(
          `INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal)
           VALUES (?, ?, ?, ?, ?)`,
          [ventaId, l.productoId, l.cantidad, l.precio, l.subtotal]
        );
        await connection.query(
          `UPDATE productos SET stock = ? WHERE id = ?`,
          [l.stockResultante, l.productoId]
        );
        await connection.query(
          `INSERT INTO movimientos_stock
             (producto_id, tipo, cantidad, stock_resultante, motivo, persona_id,
              referencia_tipo, referencia_id, fecha_movimiento)
           VALUES (?, 'SALIDA', ?, ?, ?, ?, 'VENTA', ?, ?)`,
          [l.productoId, -l.cantidad, l.stockResultante,
           `Venta #${ventaId} - ${l.nombre}`, vendedorId, ventaId, fechaVenta]
        );
      }

      // 5. El cobro inicial va a venta_pagos: de acá lo lee el arqueo
      if (pagado > 0) {
        await connection.query(
          `INSERT INTO venta_pagos
             (venta_id, sesion_caja_id, persona_id, monto, metodo_pago, fecha_pago, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ventaId, sesion.id, vendedorId, pagado, metodo_pago, fechaHoy, fechaVenta]
        );
      }

      await connection.commit();
      return res.status(201).json({
        mensaje: saldo > 0 ? 'Venta registrada con saldo pendiente' : 'Venta registrada',
        venta_id: ventaId,
        total, monto_pagado: pagado, saldo_pendiente: saldo
      });
    } catch (error) {
      await rollbackSeguro(connection);
      if (error instanceof ErrorRegla) return res.status(error.status).json({ mensaje: error.message });
      console.error('Error en create venta:', error);
      return res.status(500).json({ mensaje: 'Error al procesar la venta' });
    } finally {
      if (connection) connection.release();
    }
  },

  /* ============================================================
     Cobro posterior de una venta fiada
     ============================================================ */
  registrarPago: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const ventaId = Number(req.params.id);
      const monto = round2(req.body.monto);
      const metodo = req.body.metodo_pago;

      if (!Number.isFinite(monto) || monto <= 0) {
        throw new ErrorRegla(400, 'El monto debe ser mayor a cero');
      }
      validarMetodo(metodo);

      const fechaHoy = obtenerFechaHoyArgentina();
      const ahoraAR = obtenerFechaHoraArgentina();

      const sesion = await exigirCajaAbierta(connection);
      await exigirMesAbierto(connection, fechaHoy.slice(0, 7));

      const [rows] = await connection.query(
        `SELECT id, total, monto_pagado, saldo_pendiente FROM ventas WHERE id = ? FOR UPDATE`,
        [ventaId]
      );
      if (rows.length === 0) throw new ErrorRegla(404, 'Venta no encontrada');

      const saldoActual = round2(rows[0].saldo_pendiente);
      if (saldoActual <= 0) throw new ErrorRegla(400, 'Esta venta no tiene saldo pendiente');
      if (monto > saldoActual) {
        throw new ErrorRegla(400, `El monto supera la deuda. Saldo: $${saldoActual.toFixed(2)}`);
      }

      await connection.query(
        `INSERT INTO venta_pagos
           (venta_id, sesion_caja_id, persona_id, monto, metodo_pago, fecha_pago, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ventaId, sesion.id, personaDeReq(req), monto, metodo, fechaHoy, ahoraAR]
      );

      const nuevoSaldo = round2(saldoActual - monto);
      await connection.query(
        `UPDATE ventas SET monto_pagado = monto_pagado + ?, saldo_pendiente = ? WHERE id = ?`,
        [monto, nuevoSaldo, ventaId]
      );

      await connection.commit();
      return res.json({
        mensaje: nuevoSaldo === 0 ? 'Deuda saldada' : `Pago registrado. Queda $${nuevoSaldo.toFixed(2)}`,
        saldo_pendiente: nuevoSaldo
      });
    } catch (error) {
      await rollbackSeguro(connection);
      if (error instanceof ErrorRegla) return res.status(error.status).json({ mensaje: error.message });
      console.error('Error en registrarPago:', error);
      return res.status(500).json({ mensaje: 'Error al registrar el pago' });
    } finally {
      if (connection) connection.release();
    }
  },

  /* ============================================================
     ANULAR — repone stock, bloqueada si algún cobro ya se arqueó
     ============================================================ */
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

      await exigirMovimientoEditable(connection, ventas[0].momento, ventas[0].periodo);

      // Ningún cobro de esta venta puede pertenecer a una caja ya cerrada
      const [pagosCerrados] = await connection.query(
        `SELECT vp.id FROM venta_pagos vp
         JOIN sesion_caja s ON s.id = vp.sesion_caja_id
         WHERE vp.venta_id = ? AND s.estado = 'CERRADA' LIMIT 1`,
        [id]
      );
      if (pagosCerrados.length > 0) {
        throw new ErrorRegla(409, 'Esta venta tiene cobros en una caja ya cerrada. No se puede anular.');
      }

      const [items] = await connection.query(
        `SELECT vd.producto_id, vd.cantidad, p.nombre, p.stock
         FROM venta_detalles vd JOIN productos p ON p.id = vd.producto_id
         WHERE vd.venta_id = ?`,
        [id]
      );

      const ahoraAR = obtenerFechaHoraArgentina();
      for (const it of items) {
        const nuevoStock = Number(it.stock) + Number(it.cantidad);
        await connection.query(`UPDATE productos SET stock = ? WHERE id = ?`, [nuevoStock, it.producto_id]);
        await connection.query(
          `INSERT INTO movimientos_stock
             (producto_id, tipo, cantidad, stock_resultante, motivo, persona_id,
              referencia_tipo, referencia_id, fecha_movimiento)
           VALUES (?, 'ENTRADA', ?, ?, ?, ?, 'VENTA', ?, ?)`,
          [it.producto_id, it.cantidad, nuevoStock,
           `Anulación de venta #${id} - ${it.nombre}`, personaDeReq(req), id, ahoraAR]
        );
      }

      // venta_detalles y venta_pagos caen por CASCADE
      await connection.query(`DELETE FROM ventas WHERE id = ?`, [id]);

      await connection.commit();
      return res.json({ mensaje: 'Venta anulada, stock repuesto y cobros revertidos' });
    } catch (error) {
      await rollbackSeguro(connection);
      if (error instanceof ErrorRegla) return res.status(error.status).json({ mensaje: error.message });
      console.error('Error en anular venta:', error);
      return res.status(500).json({ mensaje: 'Error al anular la venta' });
    } finally {
      if (connection) connection.release();
    }
  }
};

export default venta;