import {pool} from '../config/database.js';

const saldo = {
    getSaldoAlumno: async (req, res) => {
        try {
            const { personaId } = req.params;

            // 1. Total pagado por el alumno (Suma de todos sus cobros)
            const [cobrosResult] = await pool.query(
                `SELECT COALESCE(SUM(c.monto), 0) AS total_cobrado
       FROM periodos_alumno pa
       INNER JOIN cobros c ON c.periodo_alumno_id = pa.id
       WHERE pa.persona_id = ?`,
                [personaId]
            );

            // 2. Total contratado (Suma del snapshot 'precio_aplicado' de periodos_cobertura)
            const [coberturasResult] = await pool.query(
                `SELECT COALESCE(SUM(pc.precio_aplicado + pc.saldo_pendiente), 0) AS total_contratado
FROM periodos_alumno pa
INNER JOIN periodos_cobertura pc ON pc.periodo_alumno_id = pa.id
WHERE pa.persona_id = ?`,
                [personaId]
            );

            const totalCobrado = parseFloat(cobrosResult[0].total_cobrado || 0);
            const totalContratado = parseFloat(coberturasResult[0].total_contratado || 0);

            // Saldo = Total Pagado - Total Contratado
            const saldo = totalCobrado - totalContratado;

            let estadoSaldo = 'AL_DIA';
            if (saldo < 0) estadoSaldo = 'DEUDA';
            else if (saldo > 0) estadoSaldo = 'A_FAVOR';

            return res.json({
                persona_id: Number(personaId),
                totalCobrado,
                totalContratado,
                saldo,
                estadoSaldo,
            });
        } catch (error) {
            console.error('❌ Error al calcular saldo del alumno:', error);
            return res.status(500).json({ error: 'Error interno al calcular el saldo' });
        }
    }
}

export default saldo;