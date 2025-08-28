import express from 'express';
import db from '../database/index.js';
import twilio from 'twilio';

const router = express.Router();
router.use(express.json());

const templates = {
    // template de si o no, verificacion
    verificationTemplate:{
        id:"HX35da09b6a1522c5240c35055eea40bde"
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

const sendMessage = async (fromPhoneNumber, contentSid, contentVariables = '', toPhoneNumber) => {
    try {
        const message = await client.messages.create({
            from: fromPhoneNumber,
            contentSid: contentSid,
            // contentVariables: JSON.stringify(contentVariables),
            to: toPhoneNumber,
        });

        console.log(`Mensaje enviado con SID: ${message.sid}`);
        return message;
    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
    }
};
const client = twilio(accountSid, authToken);

router.post('/', async (req, res) => {
    const { phoneNumbers } = req.body;
  
    if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
      return res.status(400).json({ error: 'phoneNumbers debe ser un array válido' });
    }
  
    const results = [];
    const updatedNumbers = [];
    const t = await db.sequelize.transaction();
  
    try {
      await Promise.all(phoneNumbers.map(async (phoneNumber) => {
        const numeroSinEspacio = phoneNumber.replace(/\s/g, "");
        
        // Buscar el número de teléfono
        const phoneRecord = await db.PhoneNumbers.findOne({
          where: { phoneNumber },
          transaction: t
        });
  
        if (!phoneRecord) {
          results.push({ phoneNumber, status: 'error', error: `Número no encontrado en la BD.` });
          return; // Salta al siguiente número del map
        }
  
        try {
          const messageResult = await sendMessage(
            whatsappNumber,
            templates.verificationTemplate.id,
            '',
            `whatsapp:${numeroSinEspacio}`
          );
  
          await db.Messages.create({
            phoneNumberId: phoneRecord.id,
            sentAt: new Date(),
            templateUsed: String(templates.verificationTemplate.id), // Guardamos el ID de la plantilla
            twilioSid: messageResult.sid,
          }, { transaction: t });
  
          // Actualizar el estado del número de teléfono
          await phoneRecord.update({ status: 'por verificar' }, { transaction: t });
          
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
    const { ButtonText, From, OriginalRepliedMessageSid } = req.body;
    // si MessageType es 'text' no es un boton y si es interactive es un boton
    const { Body, MessageType } = req.body;

    if(MessageType === 'text'){
      return res.status(200).json({ message: 'Respuesta no es un boton' });
    }

    const phoneNumber = From.replace('whatsapp:', '');
    console.log('xxxxxxxxxxxxxxxXXXXXXXXXXXXXXXXXxxxxxxxxxxxxx');
    console.log('req.body', req.body);
    console.log("Respondiendo mensaje:", { phoneNumber, ButtonText, OriginalRepliedMessageSid });
    console.log('xxxxxxxxxxxxxxxXXXXXXXXXXXXXXXXXxxxxxxxxxxxxx');
    const t = await db.sequelize.transaction();
  
    try {
      const phoneRecord = await db.PhoneNumbers.findOne({ 
        where: { phoneNumber },
        transaction: t
      });
  
      if (!phoneRecord) {
        await t.rollback(); // Revertir por seguridad
        return res.status(404).json({ error: `Número no encontrado: ${phoneNumber}` });
      }
  
      const respondedMessage = await db.Messages.findOne({
        where: {
          twilioSid: OriginalRepliedMessageSid,
        },
        order: [['sentAt', 'DESC']], 
        transaction: t
      });
  
      if (respondedMessage) {
        await respondedMessage.update({
          responseReceived: ButtonText,
          respondedAt: new Date(),
        }, { transaction: t });
      }
  
      const newStatus = ButtonText === 'Si' ? 'verificado' : 'no verificado';
      await phoneRecord.update({ status: newStatus }, { transaction: t });
  
      await t.commit();
  
      console.log(`Respuesta de ${phoneNumber} registrada. Nuevo estado: ${newStatus}`);
      res.status(200).json({ message: 'Respuesta registrada y estado actualizado' });
  
    } catch (error) {
      await t.rollback();
      console.error('Error al procesar la respuesta:', error);
      res.status(500).json({
        error: 'Error al procesar la respuesta',
        details: error.message
      });
    }
});

router.post('/status-update', async (req, res) => {
  const t = await db.sequelize.transaction(); // Inicia una transacción
  
  try {
      const { To, MessageStatus, MessageSid } = req.body;
      
      console.log('--- Webhook Entrante (Estado Mensaje Twilio) ---');
      console.log("Datos:", { To, MessageStatus, MessageSid });

      const phoneNumberString = To.replace('whatsapp:', '');

      const phoneRecord = await db.PhoneNumbers.findOne({ 
          where: { phoneNumber: phoneNumberString },
          transaction: t
      });

      if (!phoneRecord) {
          await t.rollback();
          return res.status(404).json({ error: `Número de destino no encontrado: ${To}` });
      }

      const existingMessage = await db.Messages.findOne({
          where: {
              phoneNumberId: phoneRecord.id,
              twilioSid: MessageSid
          },
          transaction: t
      });

      if (!existingMessage) {
          await t.rollback();
          return res.status(404).json({ error: 'Mensaje no encontrado para actualizar' });
      }

      const currentStatus = existingMessage.messageStatus;
      const newStatus = MessageStatus;

      const currentPrecedence = STATUS_PRECEDENCE[currentStatus] || 0;
      const newPrecedence = STATUS_PRECEDENCE[newStatus] || 0;

      if (newPrecedence > currentPrecedence) {
          await db.Messages.update(
              { messageStatus: newStatus, updatedAt: new Date() },
              { 
                  where: { id: existingMessage.id },
                  transaction: t
              }
          );
          await t.commit();
          res.status(200).json({ message: 'Estado actualizado correctamente' });
      } else {
          await t.commit(); 
          res.status(200).json({ message: 'Estado no actualizado debido a precedencia' });
      }

  } catch (error) {
      await t.rollback();
      console.error('❌ Error crítico al manejar la actualización de estado del mensaje:', error);
      res.status(500).json({
          error: 'Error interno al actualizar el estado del mensaje',
          details: error.message
      });
  }
});

router.get('/test', async (req, res) => {
    try {
        const messageResult = await sendMessage(
            whatsappNumber,
            templates.verificationTemplate.id,
            '',
            `whatsapp:+584121902326`
          );
        console.log(messageResult)
        return res.json(messageResult)
    } catch (error) {
        console.error('Error al enviar mensajes:', error);
        res.status(500).json({
          error: 'Error al enviar mensajes',
          details: error.message
        });
      }
})
export default router;
