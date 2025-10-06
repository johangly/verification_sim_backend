/**
 * Genera una lista de números de teléfono para buscar en la DB.
 * Maneja la excepción del '1' de Twilio para números mexicanos (+521...).
 * @param {string} twilioFrom - El número de teléfono recibido de Twilio (ej: +5215569884574).
 * @returns {string[]} Un array con 1 o 2 números a buscar.
 */
function getSearchablePhoneNumbers(twilioFrom) {
    // 1. Limpiar el número de espacios y asegurar que sea un string
    const originalNumber = String(twilioFrom).replace(/\s/g, '');
    // 2. Guardar el numero recibido
    let numbersToSearch = [originalNumber];
    // 3. Buscar el tipo de numero para saber que variante (+52 o +521) generar para la busqueda

    // 4. Si es +521 generar el +52
    if (originalNumber.startsWith('+521') && originalNumber.length === 14) {
        const normalizedNumber = '+52' + originalNumber.substring(4);
        numbersToSearch.push(normalizedNumber); 
    }
    
    // 5. Si es +52 generar el +521
    if (originalNumber.startsWith('+52') && originalNumber.length === 13) {
        const normalizedNumber = '+521' + originalNumber.substring(3);
        numbersToSearch.push(normalizedNumber); 
    }

    // 6. Retornar el array con las variantes del numero de telefono
    return numbersToSearch; 
}

export default getSearchablePhoneNumbers;