import express from 'express';
import db from '../database/index.js';
import twilio from 'twilio';
import logger from '../utils/logger.js';
import { Op } from 'sequelize';
import getSearchablePhoneNumbers from '../utils/getSearchablePhoneNumbers.js';
const router = express.Router();
router.use(express.json());

const templates = {
  // template de si o no, verificacion
  verificationTemplate: {
    id: "HX75e9c39ea1a499935189e07648e8ed36"
  }
}

const STATUS_PRECEDENCE = {
  'queued': 0,    // Mensaje en cola en Twilio
  'sending': 1,   // Twilio está intentando enviarlo
  'sent': 2,      // Operador aceptó el mensaje
  'delivered': 3, // Mensaje entregado al dispositivo del usuario
  'read': 4,      // Mensaje leído por el usuario (si está habilitado y lo capturas)
  'failed': 100,  // Falló el envío/entrega (estado terminal)
  'undelivered': 99, // No se pudo entregar (estado terminal, a veces antes de failed)
  // Añade otros estados de Twilio si los usas y necesitan una precedencia específica
};

// Configuración de Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

export const sendMessage = async (fromPhoneNumber, contentSid, contentVariables = '', toPhoneNumber) => {
  try {
    const message = await client.messages.create({
      from: fromPhoneNumber,
      contentSid: contentSid,
      // contentVariables: JSON.stringify(contentVariables),
      to: toPhoneNumber,
      contentApiLanguage: 'es',
    });

    console.log(`Mensaje enviado con SID: ${message.sid}`);
    return message;
  } catch (error) {
    console.error('Error al enviar el mensaje:', error);
  }
};

router.post('/', async (req, res) => {
  const { phoneNumbers } = req.body;

  if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
    return res.status(400).json({ error: 'phoneNumbers debe ser un array válido' });
  }

  const campaign = await db.Campaigns.create({
    sentAt: new Date(),
    templateUsed: templates.verificationTemplate.id,
    createdByUser: 1,
  });

  const campaignId = campaign.id;

  const results = [];
  const updatedNumbers = [];
  const t = await db.sequelize.transaction();

  try {
    await Promise.all(phoneNumbers.map(async (phoneNumber) => {
      const numeroSinEspacio = phoneNumber.replace(/\s/g, "");

      // Buscar el número de teléfono
      const phoneRecord = await db.PhoneNumbers.findOne({
        where: {
          phoneNumber: phoneNumber,
          hasReceivedVerificationMessage: false
        },
        transaction: t
      });

      if (!phoneRecord) {
        results.push({ phoneNumber, status: 'error', error: `Número no encontrado en la BD.` });
        return; // Salta al siguiente número del map
      }

      try {
        console.log("datos para enviar el mensaje:", whatsappNumber, templates.verificationTemplate.id, '', `whatsapp:${numeroSinEspacio}`);
        const messageResult = await sendMessage(
          whatsappNumber,
          templates.verificationTemplate.id,
          '',
          `whatsapp:${numeroSinEspacio}`
        );

        const messageSended = await db.Messages.create({
          phoneNumberId: phoneRecord.id,
          sentAt: new Date(),
          templateUsed: templates.verificationTemplate.id,
          twilioSid: messageResult.sid,
          campaignId: campaignId,
        }, { transaction: t });
        console.log("mensaje enviado:", messageSended);
        // Actualizar el estado del número de teléfono
        await phoneRecord.update({
          status: 'por verificar',
          hasReceivedVerificationMessage: true 
        }, { transaction: t });

        results.push({ phoneNumber, status: 'success', messageId: messageResult.sid });
        updatedNumbers.push(phoneRecord.toJSON());

      } catch (apiError) {
        // Si falla el envío del mensaje, lo registramos pero no rompemos la transacción
        results.push({ phoneNumber, status: 'error', error: apiError.message });
      }
    }));

    await t.commit();

    res.json({
      status: 'success',
      message: 'Proceso de envío completado',
      results,
      updatedNumbers
    });

  } catch (dbError) {
    // Si hubo un error en la transacción, revertir todo
    await t.rollback();
    console.error('Error en la transacción de envío de mensajes:', dbError);
    res.status(500).json({
      error: 'Error al procesar la solicitud en la base de datos',
      details: dbError.message
    });
  }
});


router.post('/response', async (req, res) => {
  logger.info('||||||||||||||||||||||||||||||||||||||||')
  logger.info(`Entrando al response`);
  logger.info('||||||||||||||||||||||||||||||||||||||||')
  const { ButtonText, From, OriginalRepliedMessageSid } = req.body;
  // si MessageType es 'text' no es un boton y si es interactive es un boton
  const { Body, MessageType } = req.body;
  logger.info(`Twilio Webhook Received:{
      body: ${Body},
      messageType: ${MessageType},
      buttonText: ${ButtonText},
      originalRepliedMessageSid: ${OriginalRepliedMessageSid},
      from: ${From}
    }`);
  logger.info('||||||||||||||||||||||||||||||||||||||||')
  if (MessageType === 'text') {
    logger.error(`Respuesta no es un boton`);
    logger.info('-------------------------------------')
    return res.status(200).json({ message: 'Respuesta no es un boton' });
  }

  const phoneNumber = From.replace('whatsapp:', '');
  const numbersToSearch = getSearchablePhoneNumbers(phoneNumber);

  logger.info(`Buscando número: ${phoneNumber}`);
  logger.info(`Números a buscar: ${numbersToSearch}`);
  const t = await db.sequelize.transaction();

  try {
    const phoneRecord = await db.PhoneNumbers.findOne({
      where: {
        phoneNumber: {
          [Op.in]: numbersToSearch
        }
      },
      transaction: t
    });

    if (!phoneRecord) {
      await t.rollback(); // Revertir por seguridad
      logger.error(`Número no encontrado: ${phoneNumber}`);
      logger.info('-------------------------------------')

      return res.status(404).json({ error: `Número no encontrado: ${phoneNumber}` });
    }

    const respondedMessage = await db.Messages.findOne({
      where: {
        twilioSid: OriginalRepliedMessageSid,
      },
      order: [['sentAt', 'DESC']],
      transaction: t
    });

    if (!respondedMessage) {
      await t.rollback(); // Revertir por seguridad
      logger.error(`Mensaje no encontrado: ${OriginalRepliedMessageSid}`);
      logger.info('-------------------------------------')
      return res.status(404).json({ error: `Mensaje no encontrado: ${OriginalRepliedMessageSid}` });
    }

    // actualiza el mensaje
    logger.info(`Actualizando el mensaje: ${JSON.stringify(respondedMessage, null, 2)}`);
    await respondedMessage.update({
      responseReceived: ButtonText,
      respondedAt: new Date(),
    }, { transaction: t });

    // actualiza el estado del cliente
    const newStatus = ButtonText === 'Si' ? 'verificado' : 'no verificado';
    logger.info(`Actualizando el estado del cliente: ${newStatus}`);
    await phoneRecord.update({ status: newStatus }, { transaction: t });

    await t.commit();

    logger.info('||||||||||||||||||||||||||||||||||||||||')
    logger.info('Respuesta registrada y estado actualizado');
    logger.info('||||||||||||||||||||||||||||||||||||||||')
    res.status(200).json({ message: 'Respuesta registrada y estado actualizado' });

  } catch (error) {
    await t.rollback();
    logger.info('----------------------------------------')
    logger.error(`Error al procesar la respuesta: ${error}`);
    logger.info('----------------------------------------')
    res.status(500).json({
      error: 'Error al procesar la respuesta',
      details: error.message
    });
  }
});

/**
 * Endpoint para manejar fallbacks de Twilio
 * Este endpoint recibe notificaciones cuando un mensaje no pudo ser entregado
 * o cuando ocurre algún error en el envío
 */
router.post('/fallback', async (req, res) => {
  logger.info('||||||||||||||||||||||||||||||||||||||||')
  logger.info('      Entrando al manejador de fallback');
  logger.info('Body recibido:', JSON.stringify(req.body, null, 2));
  logger.info('||||||||||||||||||||||||||||||||||||||||')

  const { MessageSid, ErrorCode, ErrorMessage, MessageStatus } = req.body;
  const t = await db.sequelize.transaction();

  try {
    if (!MessageSid) {
      logger.error('Falta el parámetro requerido: MessageSid');
      return res.status(400).json({ error: 'Falta el parámetro requerido: MessageSid' });
    }

    // Buscar el mensaje en la base de datos
    const message = await db.Messages.findOne({
      where: { twilioSid: MessageSid },
      transaction: t,
      include: [{
        model: db.PhoneNumbers,
        as: 'phoneNumber',
        required: true
      }]
    });

    if (!message) {
      logger.error(`Mensaje no encontrado para el SID: ${MessageSid}`);
      await t.rollback();
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }

    // Actualizar el estado del mensaje
    await message.update({
      messageStatus: MessageStatus || 'failed',
      errorCode: ErrorCode || null,
      errorMessage: ErrorMessage || null,
      updatedAt: new Date()
    }, { transaction: t });

    // Si hay un error y es un error de número inválido, marcar el número como inválido
    if (ErrorCode && [21211, 21612, 21614].includes(parseInt(ErrorCode))) {
      await message.phoneNumber.update({
        status: 'invalido',
        updatedAt: new Date()
      }, { transaction: t });
      logger.info(`Número marcado como inválido: ${message.phoneNumber.phoneNumber}`);
    }

    await t.commit();
    logger.info(`Fallback procesado correctamente para el mensaje: ${MessageSid}`);
    return res.sendStatus(200);

  } catch (error) {
    await t.rollback();
    logger.error('Error al procesar el fallback:', error);
    return res.status(500).json({
      error: 'Error al procesar el fallback',
      details: error.message
    });
  } finally {
    logger.info('----------------------------------------')
    logger.info('Finalizado el procesamiento del fallback');
    logger.info('----------------------------------------')
  }
});

router.post('/status-update', async (req, res) => {
  logger.info('||||||||||||||||||||||||||||||||||||||||')
  logger.info('      Entrando al status-update');
  logger.info('||||||||||||||||||||||||||||||||||||||||')
  const t = await db.sequelize.transaction();
  logger.info('Iniciando actualización de estado del mensaje');

  try {
    const { To, MessageStatus, MessageSid } = req.body;
    const MAX_RETRIES = 5;
    let messageRecord = null;

    // Búsqueda con reintentos
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        messageRecord = await db.Messages.findOne({
          where: { twilioSid: MessageSid },
          transaction: t
        });

        if (messageRecord) {
          logger.info(`Mensaje ${MessageSid} encontrado en el intento ${i + 1}`);
          break;
        }

        if (i === MAX_RETRIES - 1) {
          logger.error(`Mensaje no encontrado después de ${MAX_RETRIES} intentos`);
          await t.rollback();
          return res.sendStatus(404); // 200 para evitar reintentos de Twilio
        }

        const delayTime = (i + 1) * 300;
        logger.warn(`Reintentando en ${delayTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayTime));

      } catch (dbError) {
        logger.error(`Error en búsqueda (intento ${i + 1}):`, dbError);
        if (i === MAX_RETRIES - 1) {
          await t.rollback();
          return res.sendStatus(500);
        } else{
          await t.rollback();
          return res.sendStatus(404);
        }
      }
    }

    if(messageRecord){
      // Actualización del estado
      const currentStatus = messageRecord.messageStatus;
      const newStatus = MessageStatus;
      const currentPrecedence = STATUS_PRECEDENCE[currentStatus] || 0;
      const newPrecedence = STATUS_PRECEDENCE[newStatus] || 0;

      if (newPrecedence > currentPrecedence) {
        await messageRecord.update(
          { 
            messageStatus: newStatus,
            updatedAt: new Date() 
          }, 
          { transaction: t }
        );
        
        await t.commit();
        logger.info(`Estado actualizado a: ${newStatus}`);
        return res.sendStatus(200);
      } else {
        await t.rollback();
        logger.info('Estado no actualizado: precedencia menor o igual');
        return res.sendStatus(200);
      }
    } else {
      logger.info('Mensaje no encontrado');
      return res.sendStatus(404);
    }

  } catch (error) {
    await t.rollback();
    logger.error('Error en la actualización:', error);
    return res.sendStatus(500);
  }

  // Codigo viejo
  // try {

  //   const phoneNumberString = To.replace('whatsapp:', '');
  //   const numbersToSearch = getSearchablePhoneNumbers(phoneNumberString);
  //   const phoneRecord = await db.PhoneNumbers.findOne({
  //     where: { phoneNumber: { [Op.in]: numbersToSearch } },
  //     transaction: t
  //   });

  //   if (!phoneRecord) {
  //     await t.rollback();
  //     logger.info('----------------------------------------')
  //     logger.error(`Número de destino no encontrado: ${To}`);
  //     logger.info('----------------------------------------')
  //     return res.status(404).json({ error: `Número de destino no encontrado: ${To}` });
  //   }

  //   const existingMessage = await db.Messages.findOne({
  //     where: {
  //       phoneNumberId: phoneRecord.id,
  //       twilioSid: MessageSid
  //     },
  //     transaction: t
  //   });

  //   if (!existingMessage) {
  //     await t.rollback();
  //     logger.info('---------------------------------------')
  //     logger.error(`Mensaje no encontrado para actualizar: ${MessageSid}`);
  //     logger.info('---------------------------------------')
  //     return res.status(404).json({ error: 'Mensaje no encontrado para actualizar' });
  //   }

  //   const currentStatus = existingMessage.messageStatus;
  //   const newStatus = MessageStatus;

  //   const currentPrecedence = STATUS_PRECEDENCE[currentStatus] || 0;
  //   const newPrecedence = STATUS_PRECEDENCE[newStatus] || 0;

  //   if (newPrecedence > currentPrecedence) {
  //     logger.info('||||||||||||||||||||||||||||||||||||||||')
  //     logger.info(`Actualizando el estado del mensaje: ${existingMessage.id}`);
  //     logger.info('||||||||||||||||||||||||||||||||||||||||')
  //     await db.Messages.update(
  //       { messageStatus: newStatus, updatedAt: new Date() },
  //       {
  //         where: { id: existingMessage.id },
  //         transaction: t
  //       }
  //     );
  //     await t.commit();
  //     logger.info('||||||||||||||||||||||||||||||||||||||||')
  //     logger.info('Estado actualizado correctamente');
  //     logger.info('||||||||||||||||||||||||||||||||||||||||')
  //     res.status(200).json({ message: 'Estado actualizado correctamente' });
  //   } else {
  //     logger.info('---------------------------------------')
  //     logger.info('Estado no actualizado debido a precedencia');
  //     logger.info('||||||||||||||||||||||||||||||||||||||||')
  //     await t.commit();
  //     res.status(200).json({ message: 'Estado no actualizado debido a precedencia' });
  //   }

  // } catch (error) {
  //   await t.rollback();
  //   logger.info('---------------------------------------')
  //   logger.error('❌ Error crítico al manejar la actualización de estado del mensaje:', error);
  //   logger.info('||||||||||||||||||||||||||||||||||||||||')
  //   res.status(500).json({
  //     error: 'Error interno al actualizar el estado del mensaje',
  //     details: error.message
  //   });
  // }
});

export default router;
