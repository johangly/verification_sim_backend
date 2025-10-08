import { Op } from 'sequelize';
import db from '../database/index.js';
import client from '../Cache/index.js';

// Esta función cuenta el total de teléfonos en un rango de fechas
const getPhonesCountByDateRangeUTC = async (startDateString, endDateString) => {
    try {
        const startDate = new Date(startDateString);
        const endDate = new Date(endDateString);

        // Define el inicio y el fin del rango de fechas en UTC
        const startRangeUTC = new Date(Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            startDate.getUTCDate(),
            0, 0, 0
        ));

        const endRangeUTC = new Date(Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth(),
            endDate.getUTCDate(),
            23, 59, 59, 999
        ));

        // Realiza la consulta para contar todos los registros en el rango
        const count = await PhoneNumbers.count({
            where: {
                createdAt: {
                    [Op.between]: [startRangeUTC, endRangeUTC]
                }
            }
        });

        console.log(`Del ${startDateString} al ${endDateString} se ingresaron ${count} números de teléfono.`);
        return count;

    } catch (error) {
        console.error('Error al obtener el conteo:', error);
        return 0;
    }
};

// Función para obtener el conteo de teléfonos agrupados por estado
const getPhonesStatsByUpdateDateRangeUTC = async (startDateString, endDateString, type) => {
    try {
        const startDate = new Date(startDateString);
        const endDate = new Date(endDateString);

        const cacheKey = `stats:${startDateString}:${endDateString}`;

        const cachedData = await client.get(cacheKey);

        if (cachedData && typeof cachedData === 'string' && cachedData.trim() !== '' && type === 'cached') {
            console.log('Usando datos de la caché');
            try {
                return JSON.parse(cachedData);
            } catch (parseError) {
                console.error('Error al parsear datos de caché como JSON:', parseError);
                // Si el parseo falla, borra la clave de la caché para forzar un nuevo cálculo
                await client.del(cacheKey);
                // Y procede a recalcular
            }
        }

        const startRangeUTC = new Date(Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            startDate.getUTCDate(),
            0, 0, 0
        ));

        const endRangeUTC = new Date(Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth(),
            endDate.getUTCDate(),
            23, 59, 59, 999
        ));

        const results = await db.PhoneNumbers.findAll({
            attributes: [
                'status',
                [db.PhoneNumbers.sequelize.fn('COUNT', db.PhoneNumbers.sequelize.col('status')), 'count']
            ],
            where: {
                updatedAt: {
                    [Op.between]: [startRangeUTC, endRangeUTC]
                }
            },
            group: ['status'],
        });

        const stats = {};
        results.forEach(result => {
            stats[result.status] = result.get('count');
        });

        // Guardar los nuevos datos en la caché con un tiempo de vida (TTL) de 6 horas
        // 6 horas = 60 * 60 * 6 = 21600 segundos
        await client.set(cacheKey, JSON.stringify(stats), { EX: 21600 });

        console.log('Estadísticas recalculadas y guardadas en caché.');
        return stats;

    } catch (error) {
        console.error('Error al obtener las estadísticas:', error);
        return {};
    }
};
const getPhonesByRangeOfDays= async (startDateString, endDateString) => {
    try {
        const startDate = new Date(startDateString);
        const endDate = new Date(endDateString);

        const startRangeUTC = new Date(Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            startDate.getUTCDate(),
            0, 0, 0
        ));
        const endRangeUTC = new Date(Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth(),
            endDate.getUTCDate(),
            23, 59, 59, 999
        ));
        const phones = await db.PhoneNumbers.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startRangeUTC, endRangeUTC]
                }
            }
        });
        return phones;
    } catch (error) {
        console.error('Error al obtener los teléfonos:', error);
        return [];
    }
}

export {
    getPhonesCountByDateRangeUTC,
    getPhonesStatsByUpdateDateRangeUTC,
    getPhonesByRangeOfDays
}