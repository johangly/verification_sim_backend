import express from "express";
import db from "../database/index.js";
import multer from "multer";
import logger from "../utils/logger.js";
import { Op } from "sequelize";
const upload = multer({ storage: multer.memoryStorage(), dest: "../uploads/" });
import { sendMessages } from "../utils/sendMessages.js";
import { templates } from "../utils/messageTemplates.js";
import twilio from "twilio";
import { normalizeMexicanPhoneNumber } from "../utils/phoneValidator.js";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);
const BATCH_SIZE = process.env.CAMPAIGN_BATCH_SIZE || 100;
const MAX_RETRIES = process.env.MAX_MESSAGE_RETRIES || 3;
const router = express.Router();

router.post("/file", upload.single("file"), async (req, res) => {
	try {
		// 1. Recibir el archivo
		if (!req.file) {
			logger.warn("No se ha subido ningún archivo.");
			return res
				.status(400)
				.send("No se ha subido ningún archivo.");
		}

		const { status: forcedStatus } = req.body;
		const isValidForcedStatus = [
			"verificado",
			"no verificado",
			"por verificar",
		].includes(forcedStatus);

		// 3. Leer y parsear el contenido del archivo
		const csvContent = req.file.buffer.toString("utf8");
		const lines = csvContent
			.split("\n")
			.filter((line) => line.trim() !== "");

		// Ignoramos la primera línea si contiene los encabezados
		lines.shift();

		const phoneNumbersToCreate = [];
		const phoneNumbersToCheck = [];

		// Primera pasada: recolectar todos los números válidos
		for (const line of lines) {
			const [phoneNumber, statusFromFile] = line.split(",");

			// Validar el número de teléfono
			const trimmedPhoneNumber =
				normalizeMexicanPhoneNumber(phoneNumber);

			if (!trimmedPhoneNumber) {
				logger.error(
					`Número inválido ignorado: ${phoneNumber}`
				);
				continue;
			}

			// Si hay un estado forzado, lo usamos, de lo contrario usamos el del archivo
			const statusToUse = isValidForcedStatus
				? forcedStatus
				: statusFromFile?.trim();

			// Verificamos que los datos sean válidos según el modelo
			const isValidStatus = [
				"verificado",
				"no verificado",
				"por verificar",
			].includes(statusToUse);

			if (isValidStatus) {
				phoneNumbersToCheck.push(trimmedPhoneNumber);
				phoneNumbersToCreate.push({
					phoneNumber: trimmedPhoneNumber,
					status: statusToUse,
				});
			} else {
				logger.warn(`Línea inválida ignorada: ${line}`);
			}
		}

		// Buscar números existentes en la base de datos
		const existingNumbers = await db.PhoneNumbers.findAll({
			where: {
				phoneNumber: phoneNumbersToCheck,
			},
			raw: true,
		});

		// Mapear números existentes para búsqueda rápida
		const existingNumbersMap = new Map();
		existingNumbers.forEach((num) => {
			existingNumbersMap.set(num.phoneNumber, num);
		});

		// Actualizar los números que ya existen con sus datos de la base de datos
		for (let i = 0; i < phoneNumbersToCreate.length; i++) {
			const existingNumber = existingNumbersMap.get(
				phoneNumbersToCreate[i].phoneNumber
			);
			if (existingNumber) {
				// Si el número existe, usamos los datos de la base de datos
				phoneNumbersToCreate[i] = {
					...existingNumber,
					// Mantenemos el estado del archivo a menos que se esté forzando uno
					status: isValidForcedStatus
						? forcedStatus
						: existingNumber.status,
					// Aseguramos que estos campos estén presentes
					id: existingNumber.id,
					createdAt: existingNumber.createdAt,
					updatedAt: existingNumber.updatedAt,
					hasReceivedVerificationMessage:
						existingNumber.hasReceivedVerificationMessage ||
						false,
				};
			}
		}

		// 3. Enviar los registros al frontend
		if (phoneNumbersToCreate.length > 0) {
			logger.info(
				`Se obtuvieron ${phoneNumbersToCreate.length} clientes del archivo.`
			);
			return res.status(200).json({
				phoneNumbersToCreate: phoneNumbersToCreate,
			});
		} else {
			logger.warn(
				"El archivo CSV no contiene datos válidos."
			);
			return res
				.status(400)
				.send(
					"El archivo CSV no contiene datos válidos."
				);
		}
	} catch (error) {
		logger.error("Error al procesar el archivo CSV:", error);
		return res.status(500).send("Error interno del servidor.");
	}
});

router.use(express.json());

router.post("/create-full-campaign", async (req, res) => {
	const { phoneNumbers } = req.body;

    if (!phoneNumbers.every(p => p.phoneNumber && typeof p.phoneNumber === "string")) {
        logger.info("Formato de números de teléfono inválido");
		return res.status(400).json({
			error: "Formato de números de teléfono inválido",
		});
	}

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        logger.info("No se proporcionaron números de teléfono");
		return res.status(400).json({
			error: "No se proporcionaron números de teléfono válidos",
		});
	}

	if (!templates.verificationTemplate) {
		logger.info("Plantilla de verificación no configurada");
		return res.status(500).json({
			error: "Plantilla de verificación no configurada",
		});
	}

    // Validar y normalizar números
    const invalidNumbers = [];
    const validatedBatch = [];

    for (const item of phoneNumbers) {
        const normalizedNumber = normalizeMexicanPhoneNumber(item.phoneNumber);
        if (!normalizedNumber) {
            invalidNumbers.push(item.phoneNumber);
            continue;
        }
        if (item.status === "verificado") {
            invalidNumbers.push(item.phoneNumber);
            continue;
        }
        validatedBatch.push({
            ...item,
            phoneNumber: normalizedNumber
        });
    }

	if (invalidNumbers.length > 0) {
        logger.warn(`Números inválidos detectados: ${invalidNumbers.join(", ")}`);
	}

	if (validatedBatch.length === 0) {
		logger.info("No hay números válidos en el lote");
        return res.status(400).json({ 
            error: "No hay números válidos en el lote" 
        });
	}

	let t = await db.sequelize.transaction();
    const results = [];
    const proccessTimer = [];
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    try {
        // Crear números que no existen
	await db.PhoneNumbers.bulkCreate(
            validatedBatch.map(num => ({
			phoneNumber: num.phoneNumber,
			status: "por verificar",
		})),
		{
			ignoreDuplicates: true,
			transaction: t,
		}
	);

        // Buscar números válidos para enviar mensajes
	const validPhoneNumbers = await db.PhoneNumbers.findAll({
		where: {
                phoneNumber: validatedBatch.map(item => item.phoneNumber),
			hasReceivedVerificationMessage: false,
			[Op.or]: [
				{ status: "por verificar" },
				{ status: "no verificado" },
			],
		},
		transaction: t,
		raw: true,
	});

	if (validPhoneNumbers.length === 0) {
            logger.info("No hay números válidos para enviar mensajes");
            await t.rollback();
            return res.status(400).json({ 
                error: "No hay números válidos para enviar mensajes" 
            });
	}

        // Crear la campaña
		const campaign = await db.Campaigns.create(
			{
				sentAt: new Date(),
				templateUsed: templates.verificationTemplate.id,
                createdByUser: 1,
			},
			{ transaction: t }
		);

        logger.info(`Campaña creada con ID: ${campaign.id}`);

        // Procesar números en lotes
        const BATCH_SIZE = 10; // Tamaño de lote reducido para mejor manejo

        for (let i = 0; i < validPhoneNumbers.length; i += BATCH_SIZE) {
            const batch = validPhoneNumbers.slice(i, i + BATCH_SIZE);
            const batchStartTime = Date.now();
            const batchResults = [];

            // Procesar cada número del lote con un retraso
            for (const phone of batch) {
				const startTime = Date.now();
                const numeroSinEspacio = phone.phoneNumber.replace(/\s/g, "");

                try {
                    // Esperar al menos 1.1 segundos entre mensajes
                    if (i > 0 || batch.indexOf(phone) > 0) {
						await delay(200);
						logger.info(`Esperando 1.1 segundos entre mensajes`);
                    }

                    logger.info(`Enviando mensaje a: ${numeroSinEspacio}`);

                    const messageResult = await sendMessages({
                        fromPhoneNumber: whatsappNumber,
                        contentSid: templates.verificationTemplate.id,
                        contentVariables: "",
								toPhoneNumber: `whatsapp:${numeroSinEspacio}`,
								client: client,
							});
					
					logger.info(
						`Informacion del mensaje enviado: ${JSON.stringify(
							messageResult,
							null,
							2
						)}`
					);

					logger.info(
						`Mensaje enviado con SID: ${messageResult.sid ? messageResult.sid : "No se envio"}`
					);
					logger.info(
						`Mensaje enviado a: ${numeroSinEspacio}`
					);
                    // Crear registro del mensaje
                    const message = await db.Messages.create({
                        phoneNumberId: phone.id,
										sentAt: new Date(),
                        templateUsed: templates.verificationTemplate.id,
										twilioSid: messageResult.sid,
										campaignId: campaign.id,
                        success: true,
                    }, { transaction: t });

                    // Actualizar estado del teléfono
                    await db.PhoneNumbers.update(
                        { hasReceivedVerificationMessage: true },
                        { where: { id: phone.id }, transaction: t }
                    );

                    // Confirmar la transacción para el mensaje actual
                    await t.commit();
                    
                    // Iniciar nueva transacción para el siguiente mensaje
                    t = await db.sequelize.transaction();

                    const result = {
                        phoneNumber: numeroSinEspacio,
								status: "success",
								messageId: message.id,
                        twilioSid: messageResult.sid,
                        duration: (Date.now() - startTime) / 1000
                    };

                    batchResults.push(result);
                    results.push(result);
                    logger.info(`Mensaje enviado correctamente a ${numeroSinEspacio}`);

					} catch (error) {
                    logger.error(`Error al enviar a ${numeroSinEspacio}:`, error);
                    
                    // Registrar el error en la base de datos
                    try {
                        await db.Messages.create({
                            phoneNumberId: phone.id,
                            sentAt: new Date(),
                            templateUsed: templates.verificationTemplate.id,
                            campaignId: campaign.id,
                            messageStatus: "failed",
                        }, { transaction: t });
                    } catch (dbError) {
                        logger.error("Error al guardar mensaje fallido:", dbError);
                    }

                    // Hacer rollback de la transacción fallida
                    try {
                        await t.rollback();
                        // Iniciar nueva transacción para el siguiente mensaje
                        t = await db.sequelize.transaction();
                    } catch (rollbackError) {
                        logger.error("Error al hacer rollback o reiniciar transacción:", rollbackError);
                        // Intentar continuar con una nueva transacción incluso si falla el rollback
                        t = await db.sequelize.transaction();
                    }

                    const errorResult = {
                        phoneNumber: numeroSinEspacio,
                        status: "failed",
                        error: error.message,
                        duration: (Date.now() - startTime) / 1000
                    };
                    
                    batchResults.push(errorResult);
                    results.push(errorResult);
						}
            }

            // Estadísticas del lote
            const batchDuration = (Date.now() - batchStartTime) / 1000;
            const successCount = batchResults.filter(r => r.status === "success").length;
            const errorCount = batchResults.length - successCount;
            
            const batchStats = `Lote de ${batch.length} números: ${successCount} exitosos, ${errorCount} fallidos en ${batchDuration.toFixed(2)}s`;
            proccessTimer.push(batchStats);
            logger.info(batchStats);
		}

        // Estadísticas finales
        const successCount = results.filter(r => r.status === "success").length;
        const errorCount = results.filter(r => r.status === "failed").length;
        
		// Log detallado de la campaña completada
		try {
			logger.info(`
				============================================
				RESUMEN DE CAMPAÑA
				============================================
				ID Campaña: ${campaign?.id || 'NULL'}
				Estado: Completada
				Mensajes: ${successCount} enviados, ${errorCount} fallidos
				Total: ${results.length}
				Números inválidos: ${invalidNumbers?.length || 0}
				Tiempo total: ${JSON.stringify(proccessTimer, null, 2) || 'NULL'}
				============================================
				`);
		} catch (error) {
			logger.error("Error al registrar el resumen de la campaña:", error);
		}

		return res.status(200).json({
			success: true,
            message: `Campaña completada: ${successCount} mensajes enviados, ${errorCount} fallidos`,
			campaignId: campaign.id,
			invalidNumbers: invalidNumbers,
			stats: {
				total: results.length,
                success: successCount,
                errors: errorCount,
			},
            timer: proccessTimer,
            results: results,
		});

	} catch (error) {
        try {
            await t.rollback();
        } catch (rollbackError) {
            logger.error("Error al hacer rollback:", rollbackError);
        }
        
        logger.error("Error en la campaña:", error);
		return res.status(500).json({
			success: false,
            message: "Error al procesar la campaña",
            error: error.message,
            processedResults: results,
		});
	}
});

router.get("/export", async (req, res) => {
	try {
		const { campaignId } = req.query;

		if (!campaignId) {
			return res
				.status(400)
				.send("Se requiere el ID de la campaña");
		}

		const campaign = await db.Campaigns.findOne({
			where: { id: campaignId },
			include: [
				{
					model: db.Messages,
					as: "messages",
					attributes: {
						exclude: [
							"twilioSid",
							"phoneNumberId",
							"createdAt",
						],
					},
					include: [
						{
							model: db.PhoneNumbers,
							as: "phoneNumber",
							attributes: [
								"id",
								"phoneNumber",
								"status",
								"hasReceivedVerificationMessage",
								"updatedAt",
							],
						},
					],
				},
			],
		});

		if (!campaign) {
			return res.status(404).send("Campaña no encontrada");
		}

		// Crear el contenido CSV
		let csvContent = "Teléfono,Estado\n";

		campaign.messages.forEach((message) => {
			if (message.phoneNumber) {
				const phoneNumber =
					message.phoneNumber.phoneNumber || "";
				const status =
					message.phoneNumber.status ||
					"por verificar";
				csvContent += `"${phoneNumber}","${status}"\n`;
			}
		});

		// Configurar los headers para la descarga
		const date = new Date().toISOString().replace(/[:.]/g, "-");
		const filename = `campaña-${campaignId}-${date}.csv`;

		res.setHeader("Content-Type", "text/csv");
		res.setHeader(
			"Content-Disposition",
			`attachment; filename="${filename}"`
		);

		// Enviar el archivo
		res.send(csvContent);
	} catch (error) {
		console.error("Error al exportar la campaña:", error);
		res.status(500).send("Error al exportar la campaña");
	}
});

router.get("/", async (req, res) => {
	const campaigns = await db.Campaigns.findAll({
		include: [
			{
				model: db.Messages,
				as: "messages",
				attributes: {
					exclude: [
						"twilioSid",
						"phoneNumberId",
						"createdAt",
					],
				},
				include: [
					{
						model: db.PhoneNumbers,
						as: "phoneNumber",
						attributes: {
							exclude: [
								"createdAt",
								"updatedAt",
							],
						},
					},
				],
			},
		],
	});

	res.json(campaigns);
});

router.get("/:id", async (req, res) => {
	const { id } = req.params;
	const campaign = await db.Campaigns.findByPk(id, {
		include: [
			{
				model: db.Messages,
				as: "messages",
				attributes: {
					exclude: [
						"twilioSid",
						"phoneNumberId",
						"createdAt",
					],
				},
				include: [
					{
						model: db.PhoneNumbers,
						as: "phoneNumber",
						attributes: {
							exclude: [
								"createdAt",
								"updatedAt",
							],
						},
					},
				],
			},
		],
	});

	res.json(campaign);
});

export default router;