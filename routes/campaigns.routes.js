import express from 'express';
import db from '../database/index.js';
import multer from 'multer';
import logger from '../utils/logger.js';
const upload = multer({ storage: multer.memoryStorage(), dest: '../uploads/' });
import { sendMessages } from '../utils/sendMessages.js'
import { templates } from '../utils/messageTemplates.js'
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

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
        const phoneNumbersToCheck = [];
        
        // Primera pasada: recolectar todos los números válidos
        for (const line of lines) {
            const [phoneNumber, statusFromFile] = line.split(',');

            // Validar el número de teléfono
            const trimmedPhoneNumber = phoneNumber?.trim();

            // Si hay un estado forzado, lo usamos, de lo contrario usamos el del archivo
            const statusToUse = isValidForcedStatus ? forcedStatus : statusFromFile?.trim();

            // Verificamos que los datos sean válidos según el modelo
            const isValidStatus = ['verificado', 'no verificado', 'por verificar'].includes(statusToUse);

            if (trimmedPhoneNumber && isValidStatus) {
                phoneNumbersToCheck.push(trimmedPhoneNumber);
                phoneNumbersToCreate.push({
                    phoneNumber: trimmedPhoneNumber,
                    status: statusToUse
                });
            } else {
                logger.warn(`Línea inválida ignorada: ${line}`);
            }
        }

        // Buscar números existentes en la base de datos
        const existingNumbers = await db.PhoneNumbers.findAll({
            where: {
                phoneNumber: phoneNumbersToCheck
            },
            raw: true
        });

        // Mapear números existentes para búsqueda rápida
        const existingNumbersMap = new Map();
        existingNumbers.forEach(num => {
            existingNumbersMap.set(num.phoneNumber, num);
        });

        // Actualizar los números que ya existen con sus datos de la base de datos
        for (let i = 0; i < phoneNumbersToCreate.length; i++) {
            const existingNumber = existingNumbersMap.get(phoneNumbersToCreate[i].phoneNumber);
            if (existingNumber) {
                // Si el número existe, usamos los datos de la base de datos
                phoneNumbersToCreate[i] = {
                    ...existingNumber,
                    // Mantenemos el estado del archivo a menos que se esté forzando uno
                    status: isValidForcedStatus ? forcedStatus : existingNumber.status,
                    // Aseguramos que estos campos estén presentes
                    id: existingNumber.id,
                    createdAt: existingNumber.createdAt,
                    updatedAt: existingNumber.updatedAt,
                    hasReceivedVerificationMessage: existingNumber.hasReceivedVerificationMessage || false
                };
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

router.post('/create-full-campaign', async (req, res) => {
    const { phoneNumbers } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        return res.status(400).json({ error: 'No se proporcionaron números de teléfono válidos' });
    }

    const t = await db.sequelize.transaction();

    try {
        // 1. Crear la campaña
        const campaign = await db.Campaigns.create({
            sentAt: new Date(),
            templateUsed: templates.verificationTemplate.id,
            createdByUser: 1 // Ajustar según la autenticación
        }, { transaction: t });
        logger.info('Campaña creada con ID:', campaign.id);
        const results = [];
        const batchSize = 100; // Procesar en lotes para mejor rendimiento

        for (let i = 0; i < phoneNumbers.length; i += batchSize) {
            const batch = phoneNumbers.slice(i, i + batchSize);
            // Extraer solo los números de teléfono del batch
            const batchPhoneNumbers = batch.map(item => item.phoneNumber);

            // Buscar números que ya existen
            const existingPhones = await db.PhoneNumbers.findAll({
                where: {
                    phoneNumber: batchPhoneNumbers
                },
                transaction: t,
                raw: true
            });
            // Obtener los números que ya existen
            const existingNumbers = new Set(existingPhones.map(p => p.phoneNumber));
            // Filtrar números que no existen
            const newNumbers = batch.filter(numObj => !existingNumbers.has(numObj.phoneNumber));
            // Crear números que no existen
            if (newNumbers.length > 0) {
                await db.PhoneNumbers.bulkCreate(
                    newNumbers.map(num => ({
                        phoneNumber: num.phoneNumber,
                        status: num.status || 'por verificar'
                    })),
                    { transaction: t, ignoreDuplicates: true }
                );
            }

            // Obtener todos los números del lote (tanto los existentes como los nuevos)
            const allPhones = await db.PhoneNumbers.findAll({
                where: {
                    phoneNumber: batchPhoneNumbers,
                    hasReceivedVerificationMessage: false
                },
                transaction: t
            });
            // Crear mensajes para todos los números
            const messages = await Promise.all(
                allPhones.map(async (phone) => {
                    const numeroSinEspacio = phone.phoneNumber.replace(/\s/g, "");

                    const messageResult = await sendMessages({
                        fromPhoneNumber: whatsappNumber,
                        contentSid: templates.verificationTemplate.id,
                        contentVariables: '',
                        toPhoneNumber: `whatsapp:${numeroSinEspacio}`,
                        client: client
                    });
                    logger.info('Mensaje enviado con SID:', messageResult.sid);
                    logger.info('Mensaje enviado a:', numeroSinEspacio);
                    try {
                        const message = await db.Messages.create({
                            phoneNumberId: phone.id,
                            sentAt: new Date(),
                            templateUsed: templates.verificationTemplate.id,
                            twilioSid: messageResult.sid,
                            campaignId: campaign.id,
                        }, { transaction: t });
                        logger.info('Mensaje creado con ID:', message.id);
                        if (!message) {
                            results.push({
                                phoneNumber: numeroSinEspacio,
                                status: 'error',
                                error: 'Error al crear el mensaje'
                            });
                            return null;
                        }

                        const updatePhone = await db.PhoneNumbers.update(
                            {
                                status: 'por verificar',
                                hasReceivedVerificationMessage: true
                            },
                            {
                                where: {
                                    id: phone.id
                                },
                                transaction: t
                            }
                        );

                        results.push({
                            phoneNumber: numeroSinEspacio,
                            status: 'success',
                            messageId: message.id
                        });

                        return message;
                    } catch (error) {
                        results.push({
                            phoneNumber: phone.phoneNumber,
                            status: 'error',
                            error: error.message
                        });
                        return null;
                    }
                })
            );
        }

        await t.commit();

        return res.status(201).json({
            status: 'success',
            campaign,
            totalMessages: results.filter(r => r.status === 'success').length,
            results,
            message: 'Campaña creada exitosamente'
        });

    } catch (error) {
        await t.rollback();
        console.error('Error al crear la campaña:', error);
        return res.status(500).json({
            status: 'error',
            error: 'Error al crear la campaña',
            details: error.message
        });
    }
});

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
