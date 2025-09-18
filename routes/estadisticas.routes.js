import express from 'express';
import { getPhonesStatsByUpdateDateRangeUTC } from '../utils/estadistics.functions.js';
const router = express.Router();

router.use(express.json());


router.get('/', async (req, res) => {
  try {
    let type = req.query.type;
    if(!type) {
      type = 'cached';
    }
    // Calcular la fecha de hoy
    const today = new Date();

    // Calcular la fecha de inicio del rango (hace 30 días)
    const startDate = new Date();
    startDate.setDate(today.getDate() - 30);

    // Formatear las fechas como strings YYYY-MM-DD para la función de caché
    const startDateString = startDate.toISOString().split('T')[0];
    const todayString = today.toISOString().split('T')[0];

    const estadisticas = await getPhonesStatsByUpdateDateRangeUTC(startDateString, todayString, type);
    res.json(estadisticas);
    
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Error al obtener las estadisticas' });
  }
});

router.get('/bydaterange', async (req, res) => {
  try {

    // el formato de las fechas debe ser en string y en formato UTC
    // startRange = '2025-05-18'
    // endRange = '2025-08-20'
    // const { startRange, endRange } = req.query;

    const startRange = '2025-05-18'
    const endRange = '2025-08-20'
    const estadisticas = await getPhonesStatsByUpdateDateRangeUTC(startRange, endRange);
    res.json(estadisticas);
    
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Error al obtener las estadisticas' });
  }
});


/*
Salida esperada (ejemplo):
Estadísticas por estado: {
  'verificado': '50',
  'no verificado': '20',
  'por verificar': '15'
}
*/

export default router;