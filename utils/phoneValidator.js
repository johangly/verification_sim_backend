export default function validatePhoneNumber(phoneNumber) {
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
    const phoneRegex = /^\+\d{1,3}\s?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}$/;
  
    return phoneRegex.test(phoneNumber);
  }

