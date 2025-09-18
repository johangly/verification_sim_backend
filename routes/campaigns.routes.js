import express from 'express';
import db from '../database/index.js';
import multer from 'multer';
import logger from '../utils/logger.js';
const upload = multer({ storage: multer.memoryStorage(), dest: '../uploads/' });

const router = express.Router();

router.post('/file', upload.single('file'), async (req, res) => {
    try {
        // 1. Recibir el archivo
        if (!req.file) {
            logger.warn('No se ha subido ningún archivo.');
            return res.status(400).send('No se ha subido ningún archivo.');
        }

        const { status: forcedStatus } = req.body;
        const isValidForcedStatus = ['verificado', 'no verificado', 'por verificar'].includes(forcedStatus);

        // 3. Leer y parsear el contenido del archivo
        const csvContent = req.file.buffer.toString('utf8');
        const lines = csvContent.split('\n').filter(line => line.trim() !== '');

        // Ignoramos la primera línea si contiene los encabezados
        lines.shift();

        const phoneNumbersToCreate = [];
        for (const line of lines) {
            const [phoneNumber, statusFromFile] = line.split(',');

            // Validar el número de teléfono
            const trimmedPhoneNumber = phoneNumber?.trim();

            // Si hay un estado forzado, lo usamos, de lo contrario usamos el del archivo
            const statusToUse = isValidForcedStatus ? forcedStatus : statusFromFile?.trim();

            // Verificamos que los datos sean válidos según el modelo
            const isValidStatus = ['verificado', 'no verificado', 'por verificar'].includes(statusToUse);

            if (trimmedPhoneNumber && isValidStatus) {
                phoneNumbersToCreate.push({
                    phoneNumber: trimmedPhoneNumber,
                    status: statusToUse
                });
            } else {
                logger.warn(`Línea inválida ignorada: ${line}`);
            }
        }

        // 3. Enviar los registros al frontend
        if (phoneNumbersToCreate.length > 0) {
            logger.info(`Se obtuvieron ${phoneNumbersToCreate.length} clientes del archivo.`);
            return res.status(200).json({ phoneNumbersToCreate: phoneNumbersToCreate });
        } else {
            logger.warn('El archivo CSV no contiene datos válidos.');
            return res.status(400).send('El archivo CSV no contiene datos válidos.');
        }

    } catch (error) {
        logger.error('Error al procesar el archivo CSV:', error);
        return res.status(500).send('Error interno del servidor.');
    }
});

router.use(express.json());

router.get('/', async (req, res) => {
    const campaigns = await db.Campaigns.findAll({
        include: [
            {
                model: db.Messages,
                as: 'messages',
                attributes: { exclude: ['twilioSid', 'phoneNumberId', 'createdAt'] },
                include: [
                    {
                        model: db.PhoneNumbers,
                        as: 'phoneNumber',
                        attributes: { exclude: ['createdAt', 'updatedAt'] },
                    },
                ],
            },
        ],
    });

    console.log('campaigns', campaigns);
    res.json(campaigns);
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const campaign = await db.Campaigns.findByPk(id, {
        include: [
            {
                model: db.Messages,
                as: 'messages',
                attributes: { exclude: ['twilioSid', 'phoneNumberId', 'createdAt'] },
                include: [
                    {
                        model: db.PhoneNumbers,
                        as: 'phoneNumber',
                        attributes: { exclude: ['createdAt', 'updatedAt'] },
                    },
                ],
            },
        ],
    });

    res.json(campaign);
});

export default router;
