import { pool } from '../config/database.js';
import { obtenerFechaHoraArgentina } from '../utils/dateUtils.js';
import { ErrorRegla, rollbackSeguro, round2 } from '../utils/blindajeDeCaja.js';

const personaDeReq = (req) => req.usuario?.persona_id || req.usuario?.id;

// '' y espacios → NULL. Crítico: sku y codigo_barras son UNIQUE y
// MySQL no permite dos '' aunque sí permite muchos NULL.
const codigoONull = (v) => {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
};

const traducirDuplicado = (error) => {
  if (error?.code === 'ER_DUP_ENTRY') {
    const msg = String(error.message || '');
    if (msg.includes('codigo_sku')) return new ErrorRegla(409, 'Ya existe un producto con ese SKU');
    if (msg.includes('codigo_barras')) return new ErrorRegla(409, 'Ya existe un producto con ese código de barras');
    return new ErrorRegla(409, 'Ese código ya está en uso');
  }
  return error;
};

const SELECT_BASE = `
  SELECT id, sku, codigo_barras, nombre, descripcion,
    precio_unitario, costo_unitario, stock, stock_minimo, activo,
    (stock > 0 AND stock <= stock_minimo) AS stock_bajo
  FROM productos
`;

const producto = {

  /* ---------- Catálogo ---------- */
  getAll: async (req, res) => {
    try {
      const { buscar, solo_activos, solo_stock_bajo } = req.query;

      let where = '1=1';
      const params = [];

      if (buscar && String(buscar).trim()) {
        where += ' AND (nombre LIKE ? OR sku LIKE ? OR codigo_barras LIKE ?)';
        const t = `%${String(buscar).trim()}%`;
        params.push(t, t, t);
      }
      if (solo_activos === '1') where += ' AND activo = 1';
      if (solo_stock_bajo === '1') where += ' AND stock > 0 AND stock <= stock_minimo';

      const [rows] = await pool.query(
        `${SELECT_BASE} WHERE ${where} ORDER BY activo DESC, nombre ASC`,
        params
      );
      return res.json(rows);
    } catch (error) {
      console.error('Error en getAll productos:', error);
      return res.status(500).json({ mensaje: 'Error al obtener el catálogo' });
    }
  },

  getById: async (req, res) => {
    try {
      const [rows] = await pool.query(`${SELECT_BASE} WHERE id = ? LIMIT 1`, [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ mensaje: 'Producto no encontrado' });
      return res.json(rows[0]);
    } catch (error) {
      console.error('Error en getById producto:', error);
      return res.status(500).json({ mensaje: 'Error al obtener el producto' });
    }
  },

  /* ---------- Búsqueda para el POS (scanner-friendly) ----------
     exacto=1 → match exacto por sku o codigo_barras (1 fila o nada).
     Sin exacto → LIKE por nombre/sku/código, máx 15.
     Una sola query en ambos casos. */
  buscar: async (req, res) => {
    try {
      const q = String(req.query.q ?? '').trim();
      if (!q) return res.json([]);

      if (req.query.exacto === '1') {
        const [rows] = await pool.query(
          `${SELECT_BASE} WHERE activo = 1 AND (sku = ? OR codigo_barras = ?) LIMIT 1`,
          [q, q]
        );
        return res.json(rows);
      }

      const t = `%${q}%`;
      const [rows] = await pool.query(
        `${SELECT_BASE} WHERE activo = 1 AND (nombre LIKE ? OR sku LIKE ? OR codigo_barras LIKE ?)
         ORDER BY nombre ASC LIMIT 15`,
        [t, t, t]
      );
      return res.json(rows);
    } catch (error) {
      console.error('Error en buscar productos:', error);
      return res.status(500).json({ mensaje: 'Error al buscar productos' });
    }
  },

  /* ---------- Alta ---------- */
  create: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const nombre = String(req.body.nombre ?? '').trim();
      const sku = codigoONull(req.body.sku);
      const codigoBarras = codigoONull(req.body.codigo_barras);
      const descripcion = String(req.body.descripcion ?? '').trim() || null;
      const precio = round2(req.body.precio_unitario);
      const costo = round2(req.body.costo_unitario ?? 0);
      const stockInicial = Number(req.body.stock ?? 0);
      const stockMinimo = Number(req.body.stock_minimo ?? 0);

      if (!nombre) throw new ErrorRegla(400, 'El nombre es obligatorio');
      if (nombre.length > 100) throw new ErrorRegla(400, 'El nombre no puede superar 100 caracteres');
      if (sku && sku.length > 15) throw new ErrorRegla(400, 'El SKU no puede superar 15 caracteres');
      if (codigoBarras && codigoBarras.length > 50) throw new ErrorRegla(400, 'El código de barras no puede superar 50 caracteres');
      if (!Number.isFinite(precio) || precio <= 0) throw new ErrorRegla(400, 'El precio de venta debe ser mayor a cero');
      if (!Number.isFinite(costo) || costo < 0) throw new ErrorRegla(400, 'El costo debe ser cero o positivo');
      if (!Number.isInteger(stockInicial) || stockInicial < 0) throw new ErrorRegla(400, 'El stock inicial debe ser un entero cero o positivo');
      if (!Number.isInteger(stockMinimo) || stockMinimo < 0) throw new ErrorRegla(400, 'El stock mínimo debe ser un entero cero o positivo');

      const [result] = await connection.query(
        `INSERT INTO productos
           (sku, codigo_barras, nombre, descripcion, precio_unitario, costo_unitario,
            stock, stock_minimo, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [sku, codigoBarras, nombre, descripcion, precio, costo, stockInicial, stockMinimo]
      );
      const productoId = result.insertId;

      if (stockInicial > 0) {
        await connection.query(
          `INSERT INTO movimientos_stock
             (producto_id, tipo, cantidad, stock_resultante, motivo, persona_id,
              referencia_tipo, fecha_movimiento)
           VALUES (?, 'ENTRADA', ?, ?, 'Stock inicial al crear el producto', ?, 'MANUAL', ?)`,
          [productoId, stockInicial, stockInicial, personaDeReq(req), obtenerFechaHoraArgentina()]
        );
      }

      await connection.commit();
      return res.status(201).json({ mensaje: 'Producto creado', id: productoId });
    } catch (error) {
      await rollbackSeguro(connection);
      const e = traducirDuplicado(error);
      if (e instanceof ErrorRegla) return res.status(e.status).json({ mensaje: e.message });
      console.error('Error en create producto:', error);
      return res.status(500).json({ mensaje: 'Error al crear el producto' });
    } finally {
      if (connection) connection.release();
    }
  },

  /* ---------- Edición (NO toca stock) ---------- */
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const nombre = String(req.body.nombre ?? '').trim();
      const sku = codigoONull(req.body.sku);
      const codigoBarras = codigoONull(req.body.codigo_barras);
      const descripcion = String(req.body.descripcion ?? '').trim() || null;
      const precio = round2(req.body.precio_unitario);
      const costo = round2(req.body.costo_unitario ?? 0);
      const stockMinimo = Number(req.body.stock_minimo ?? 0);

      if (!nombre) throw new ErrorRegla(400, 'El nombre es obligatorio');
      if (sku && sku.length > 15) throw new ErrorRegla(400, 'El SKU no puede superar 15 caracteres');
      if (!Number.isFinite(precio) || precio <= 0) throw new ErrorRegla(400, 'El precio de venta debe ser mayor a cero');
      if (!Number.isFinite(costo) || costo < 0) throw new ErrorRegla(400, 'El costo debe ser cero o positivo');
      if (!Number.isInteger(stockMinimo) || stockMinimo < 0) throw new ErrorRegla(400, 'El stock mínimo debe ser un entero cero o positivo');

      const [result] = await pool.query(
        `UPDATE productos SET
           sku = ?, codigo_barras = ?, nombre = ?, descripcion = ?,
           precio_unitario = ?, costo_unitario = ?, stock_minimo = ?
         WHERE id = ?`,
        [sku, codigoBarras, nombre, descripcion, precio, costo, stockMinimo, id]
      );
      if (result.affectedRows === 0) return res.status(404).json({ mensaje: 'Producto no encontrado' });

      return res.json({ mensaje: 'Producto actualizado. El stock se modifica desde Ajustar stock.' });
    } catch (error) {
      const e = traducirDuplicado(error);
      if (e instanceof ErrorRegla) return res.status(e.status).json({ mensaje: e.message });
      console.error('Error en update producto:', error);
      return res.status(500).json({ mensaje: 'Error al actualizar el producto' });
    }
  },

  /* ---------- Ajuste de inventario (solo ADMIN, auditado) ----------
     Recibe el stock REAL contado; el delta lo calcula el sistema. */
  ajustarStock: async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const { id } = req.params;
      const stockNuevo = Number(req.body.stock_nuevo);
      const motivo = String(req.body.motivo ?? '').trim();

      if (!Number.isInteger(stockNuevo) || stockNuevo < 0) {
        throw new ErrorRegla(400, 'El stock contado debe ser un entero cero o positivo');
      }
      if (!motivo) throw new ErrorRegla(400, 'Indicá el motivo del ajuste');

      const [rows] = await connection.query(
        `SELECT id, nombre, stock FROM productos WHERE id = ? FOR UPDATE`,
        [id]
      );
      if (rows.length === 0) throw new ErrorRegla(404, 'Producto no encontrado');

      const anterior = Number(rows[0].stock);
      const delta = stockNuevo - anterior;

      if (delta === 0) {
        await connection.rollback();
        return res.status(400).json({ mensaje: 'El stock contado es igual al actual. No hay nada que ajustar.' });
      }

      await connection.query(`UPDATE productos SET stock = ? WHERE id = ?`, [stockNuevo, id]);

      await connection.query(
        `INSERT INTO movimientos_stock
           (producto_id, tipo, cantidad, stock_resultante, motivo, persona_id,
            referencia_tipo, fecha_movimiento)
         VALUES (?, 'AJUSTE', ?, ?, ?, ?, 'MANUAL', ?)`,
        [id, delta, stockNuevo, motivo, personaDeReq(req), obtenerFechaHoraArgentina()]
      );

      await connection.commit();
      return res.json({
        mensaje: `Stock ajustado de ${anterior} a ${stockNuevo}`,
        delta,
        stock_resultante: stockNuevo
      });
    } catch (error) {
      await rollbackSeguro(connection);
      if (error instanceof ErrorRegla) return res.status(error.status).json({ mensaje: error.message });
      console.error('Error en ajustarStock:', error);
      return res.status(500).json({ mensaje: 'Error al ajustar el stock' });
    } finally {
      if (connection) connection.release();
    }
  },

  /* ---------- Baja lógica (nunca DELETE: FK RESTRICT) ---------- */
  toggleEstado: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await pool.query(`SELECT id, activo FROM productos WHERE id = ? LIMIT 1`, [id]);
      if (rows.length === 0) return res.status(404).json({ mensaje: 'Producto no encontrado' });

      const nuevo = rows[0].activo ? 0 : 1;
      await pool.query(`UPDATE productos SET activo = ? WHERE id = ?`, [nuevo, id]);

      return res.json({
        mensaje: nuevo ? 'Producto reactivado' : 'Producto desactivado. No aparecerá en las ventas.',
        activo: nuevo
      });
    } catch (error) {
      console.error('Error en toggleEstado:', error);
      return res.status(500).json({ mensaje: 'Error al cambiar el estado del producto' });
    }
  },

  /* ---------- Auditoría de un producto ---------- */
  getMovimientos: async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT m.id, m.tipo, m.cantidad, m.stock_resultante, m.motivo,
                m.referencia_tipo, m.referencia_id,
                DATE_FORMAT(m.fecha_movimiento, '%Y-%m-%d %H:%i') AS fecha,
                CONCAT(p.nombre, ' ', p.apellido) AS usuario
         FROM movimientos_stock m
         JOIN personas p ON p.id = m.persona_id
         WHERE m.producto_id = ?
         ORDER BY m.fecha_movimiento DESC, m.id DESC
         LIMIT 200`,
        [req.params.id]
      );
      return res.json(rows);
    } catch (error) {
      console.error('Error en getMovimientos:', error);
      return res.status(500).json({ mensaje: 'Error al obtener los movimientos' });
    }
  }
};

export default producto;