import express from 'express';
import db from '../database/index.js';
import validatePhoneNumber from '../utils/phoneValidator.js';
import twilio from 'twilio';

const router = express.Router();

const templates = {
    // template de si o no, verificacion
    verificationTemplate:{
        id:"HX35da09b6a1522c5240c35055eea40bde"
    }
}

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
    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
    }
};
const client = twilio(accountSid, authToken);

router.post('/', async (req, res) => {
  try {
    const { phoneNumbers } = req.body;
    console.log('phoneNumbers', phoneNumbers);

    if (!phoneNumbers) {
      return res.status(400).json({ error: 'phoneNumbers son requeridos' });
    }

    if (!Array.isArray(phoneNumbers)) {
      return res.status(400).json({ error: 'phoneNumbers debe ser un array' });
    }
    // res.status(200).json({ 
    //     message: 'Mensajes enviados',
    //     status: 'success',
    //     results:[],
    //     updatedNumbers:[]
    // });
    // return;
    const results = [];
    const updatedNumbers = [];

    // Enviar mensajes a todos los números
    for (const phoneNumber of phoneNumbers) {
        const numeroSinEspacio = phoneNumber.replace(" ", "");
        try {
            const messageResult = await sendMessage(
                whatsappNumber,
                templates.verificationTemplate.id,
                '',
                `whatsapp:${numeroSinEspacio}`
            );
            
            results.push({
            phoneNumber,
            status: 'success',
            messageId: messageResult.sid
            });
            console.log(`mensaje enviado a ${phoneNumber}`);
            // Buscar y actualizar el número de teléfono en la base de datos
            const phone = await db.PhoneNumbers.findOne({
            where: { phoneNumber }
            });

            if (phone) {
            await phone.update({
                status: 'por verificar'
            });
            updatedNumbers.push({
                ...phone.toJSON(),
                status: 'por verificar'
            });
            }
        } catch (error) {
            results.push({
            phoneNumber,
            status: 'error',
            error: error.message
            });
        }
    }

    res.json({
      status: 'success',
      message: 'Mensajes enviados',
      results,
      updatedNumbers
    });
  } catch (error) {
    console.error('Error al enviar mensajes:', error);
    res.status(500).json({
      error: 'Error al enviar mensajes',
      details: error.message
    });
  }
});


router.post('/response', async (req, res) => {
    try {
        console.log('|||||||||||||||||||||||||||||||||||||||')
        console.log("Llegando a response, hubo una respuesta del usuario")
        console.log('req.body', req.body)
        console.log('|||||||||||||||||||||||||||||||||||||||')

        const { ButtonText, From } = req.body;
        
        // Extraer el número de teléfono sin el prefijo whatsapp:
        const phoneNumber = From.replace('whatsapp:', '');
        
        // Determinar el nuevo estado basado en la respuesta
        const newStatus = ButtonText === 'Si' ? 'verificado' : 'no verificado';
        
        // Buscar y actualizar el número de teléfono
        const phone = await db.PhoneNumbers.findOne({
            where: { phoneNumber }
        });

        if (phone) {
            await phone.update({
                status: newStatus
            });
            console.log(`Estado actualizado para ${phoneNumber}: ${newStatus}`);
        } else {
            console.log(`Número no encontrado: ${phoneNumber}`);
        }

        res.status(200).json({ message: 'Estado actualizado' });
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({
            error: 'Error al actualizar estado',
            details: error.message
        });
    }
});

router.post('/status-update', async (req, res) => {
    try {
        console.log('xxxxxxxxxxxxxxxXXXXXXXXXXXXXXXXXxxxxxxxxxxxxx')
        console.log("Llegando a status-update")
        console.log("Hubo un cambio en el estado de un mensaje!")
        console.log('req.body', req.body)
        console.log('xxxxxxxxxxxxxxxXXXXXXXXXXXXXXXXXxxxxxxxxxxxxx')
        const data = req.body;

  

    } catch (error) {
      console.error('Error al enviar mensajes:', error);
      res.status(500).json({
        error: 'Error al enviar mensajes',
        details: error.message
      });
    }
});
export default router;
