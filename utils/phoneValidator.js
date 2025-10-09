import logger from "../utils/logger.js";

export function validatePhoneNumber(phoneNumber) {
    // Expresión regular para validar el formato de número de teléfono
    // La expresión busca:
    // ^              Inicio de la cadena
    // \+             Un signo más (+) literal
    // \d{1,3}        De 1 a 3 dígitos para el código de país
    // \s?            Un espacio opcional
    // \(?\d{2,4}\)?   Un grupo opcional de 2 a 4 dígitos entre paréntesis
    // [\s.-]?        Un espacio, guion o punto opcional
    // \d{3,4}        3 o 4 dígitos
    // [\s.-]?        Un espacio, guion o punto opcional
    // \d{4}          4 dígitos
    // $              Fin de la cadena
    const phoneRegex = /^\+\d{1,3}\d{2,4}\d{3,4}\d{4}$/;
  
    return phoneRegex.test(phoneNumber);
  }

/**
 * Valida y normaliza un número de teléfono mexicano.
 * Asegura que tenga el prefijo +52 o +521 y la longitud correcta.
 * @param {string} phoneNumber - Número de teléfono a validar
 * @returns {string} Número de teléfono normalizado
 */
export function normalizeMexicanPhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
      logger.error('El número de teléfono debe ser una cadena de texto');
      return null;
  }

  // 1. Eliminar todos los espacios en blanco
  const cleanNumber = phoneNumber.replace(/\s/g, '');

  // 2. Verificar si ya tiene el prefijo +52 o +521
  const hasPlus52 = cleanNumber.startsWith('+52');
  const hasPlus521 = cleanNumber.startsWith('+521');
  
  // 3. Validar la longitud según el prefijo
  if (hasPlus521) {
      // +521 + 10 dígitos = 14 caracteres
      if (cleanNumber.length !== 14 || cleanNumber.length !== 13) {
          logger.error('Número con formato +521 debe tener 14 dígitos en total');
          return null;
      }
      return cleanNumber;
  } else if (hasPlus52) {
      // +52 + 10 dígitos = 13 caracteres
      if (cleanNumber.length !== 13) {
          logger.error('Número con formato +52 debe tener 13 dígitos en total');
          return null;
      }
      return cleanNumber;
  } else {
      // No tiene prefijo, asumimos que es un número local
      // Eliminar cualquier otro carácter que no sea número
      const digitsOnly = cleanNumber.replace(/\D/g, '');
      
      // Verificar longitud
      if (digitsOnly.length === 10) {
          // Número local de 10 dígitos, agregar +52
          return `+52${digitsOnly}`;
      } else if (digitsOnly.length === 12 && digitsOnly.startsWith('52')) {
          // Número con 52 pero sin el +
          return `+${digitsOnly}`;
      } else if (digitsOnly.length === 13 && digitsOnly.startsWith('521')) {
          // Número con 521 pero sin el +
          return `+${digitsOnly}`;
      } else {
          logger.error(`Formato de número inválido: ${phoneNumber}. Se espera un número de 10 dígitos (local) o con prefijo +52/+521`);
          return null;
      }
  }
}