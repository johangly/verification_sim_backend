export const sendMessages = async ({
    fromPhoneNumber,
    contentSid,
    contentVariables = '',
    toPhoneNumber,
    client
}) => {
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
