import express from 'express';
import db from '../database/index.js';
import multer from 'multer';
import logger from '../utils/logger.js';
const upload = multer({ storage: multer.memoryStorage(), dest: '../uploads/' });
import { sendMessages } from '../utils/sendMessages.js'
import { templates } from '../utils/messageTemplates.js'
import twilio from 'twilio';
import { normalizeMexicanPhoneNumber } from '../utils/phoneValidator.js';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);
const BATCH_SIZE = process.env.CAMPAIGN_BATCH_SIZE || 100;
const MAX_RETRIES = process.env.MAX_MESSAGE_RETRIES || 3;
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
            const trimmedPhoneNumber = normalizeMexicanPhoneNumber(phoneNumber);

            if (!trimmedPhoneNumber) {
                logger.error(`Número inválido ignorado: ${phoneNumber}`);
                continue;
            }

            // Si hay un estado forzado, lo usamos, de lo contrario usamos el del archivo
            const statusToUse = isValidForcedStatus ? forcedStatus : statusFromFile?.trim();

            // Verificamos que los datos sean válidos según el modelo
            const isValidStatus = ['verificado', 'no verificado', 'por verificar'].includes(statusToUse);

            if (isValidStatus) {
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

    if (!phoneNumbers.every(p => p.phoneNumber && typeof p.phoneNumber === 'string')) {
        logger.info('Formato de números de teléfono inválido 1');
        return res.status(400).json({ error: 'Formato de números de teléfono inválido' });
    }

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        logger.info('Formato de números de teléfono inválido 2');
        return res.status(400).json({ error: 'No se proporcionaron números de teléfono válidos' });
    }

    if (!templates.verificationTemplate) {
        logger.info('Plantilla de verificación no configurada');
        return res.status(500).json({ error: 'Plantilla de verificación no configurada' });
    }

    const invalidNumbers = phoneNumbers
    .filter(p => !normalizeMexicanPhoneNumber(p.phoneNumber) || p.status === 'verificado')
    .map(p => p.phoneNumber);
    if (invalidNumbers.length > 0) {
        logger.warn(`Números inválidos detectados: ${invalidNumbers.join(', ')}`);
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
        const batchSize = BATCH_SIZE; // Procesar en lotes para mejor rendimiento

        for (let i = 0; i < phoneNumbers.length; i += batchSize) {
            const startTime = Date.now();
            const batch = phoneNumbers.slice(i, i + batchSize);

            // Normalizar y validar los números del lote
            const validatedBatch = batch
                .map(item => {
                    const normalizedNumber = normalizeMexicanPhoneNumber(item.phoneNumber);
                    return normalizedNumber ? { ...item, phoneNumber: normalizedNumber } : null;
                })
                .filter(item => item !== null);

            if (validatedBatch.length === 0) {
                continue; // Si no hay números válidos en el lote, pasamos al siguiente
            }

            await db.PhoneNumbers.bulkCreate(
                validatedBatch.map(num => ({
                    phoneNumber: num.phoneNumber,
                    status: 'por verificar'
                })),
                {
                    updateOnDuplicate: ['status', 'updatedAt'],
                    transaction: t
                }
            );

            const batchPhoneNumbers = validatedBatch.map(item => item.phoneNumber);
            // Buscar números que ya existen
            // const existingPhones = await db.PhoneNumbers.findAll({
            //     where: {
            //         phoneNumber: batchPhoneNumbers
            //     },
            //     transaction: t,
            //     raw: true
            // });
            // Filtrar números que ya existen
            // const existingNumbers = new Set(existingPhones.map(p => p.phoneNumber));
            // const newNumbers = validatedBatch.filter(numObj => !existingNumbers.has(numObj.phoneNumber));

            // Crear números que no existen
            // if (newNumbers.length > 0) {
            //     await db.PhoneNumbers.bulkCreate(
            //         newNumbers.map(num => ({
            //             phoneNumber: num.phoneNumber,
            //             status: 'por verificar'
            //         })),
            //         { transaction: t, ignoreDuplicates: true }
            //     );
            // }

            // Actualizar solo los números existentes a "por verificar"
            // if (existingPhones.length > 0) {
            //     await db.PhoneNumbers.update(
            //         {
            //             status: 'por verificar',
            //             updatedAt: new Date()
            //         },
            //         {
            //             where: {
            //                 phoneNumber: existingPhones.map(p => p.phoneNumber)
            //             },
            //             transaction: t
            //         }
            //     );
            // }

            // 3. Obtener TODOS los números (nuevos + actualizados) que no han recibido mensaje
            const allPhones = await db.PhoneNumbers.findAll({
                where: {
                    phoneNumber: batchPhoneNumbers,
                    hasReceivedVerificationMessage: false,
                    [Op.or]: { status: 'por verificar' }
                },
                transaction: t
            });

            if (allPhones.length > 0) {
                // Crear mensajes para todos los números
                await Promise.all(
                    allPhones.map(async (phone) => {
                        const numeroSinEspacio = phone.phoneNumber.replace(/\s/g, "");

                        const messageResult = await sendMessages({
                            fromPhoneNumber: whatsappNumber,
                            contentSid: templates.verificationTemplate.id,
                            contentVariables: '',
                            toPhoneNumber: `whatsapp:${numeroSinEspacio}`,
                            client: client
                        });
                        logger.info(`Informacion del mensaje enviado: ${JSON.stringify(messageResult, null, 2)}`)

                        logger.info(`Mensaje enviado con SID: ${messageResult.sid}`);
                        logger.info(`Mensaje enviado a: ${numeroSinEspacio}`);
                        try {
                            const message = await db.Messages.create({
                                phoneNumberId: phone.id,
                                sentAt: new Date(),
                                templateUsed: templates.verificationTemplate.id,
                                twilioSid: messageResult.sid,
                                campaignId: campaign.id,
                            }, { transaction: t });
                            logger.info(`Mensaje creado con ID: ${message.id}`);
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
                                    // status: 'por verificar',
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
            logger.info(`Procesado lote de ${batch.length} números en ${((Date.now() - startTime) / 1000).toFixed(2)} segundos`);
        }

        await t.commit();

        return res.status(200).json({
            success: true,
            message: 'Campaña creada exitosamente',
            campaignId: campaign.id,
            stats: {
                total: results.length,
                success: results.filter(r => r.status === 'success').length,
                errors: results.filter(r => r.status === 'error').length
            },
            results
        });

    } catch (error) {
        await t.rollback();
        console.error('Error al crear la campaña:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al crear la campaña',
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
