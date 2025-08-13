# API de Números de Teléfono

Esta documentación describe los endpoints disponibles para la gestión de números de teléfono.

## Endpoints

### 1. Obtener todos los números de teléfono

- **Endpoint**: `GET /api/phoneNumbers`
- **Descripción**: Obtiene una lista de todos los números de teléfono registrados.
- **Respuesta**:
  - **200 OK**: Lista de números de teléfono
  - **500 Error**: Error al obtener los números de teléfono

### 2. Obtener un número de teléfono por ID

- **Endpoint**: `GET /api/phoneNumbers/:id`
- **Descripción**: Obtiene un número de teléfono específico por su ID.
- **Parámetros de URL**:
  - `id`: ID del número de teléfono
- **Respuesta**:
  - **200 OK**: Detalles del número de teléfono
  - **404 Not Found**: Número de teléfono no encontrado
  - **500 Error**: Error al obtener el número de teléfono

### 3. Crear un nuevo número de teléfono

- **Endpoint**: `POST /api/phoneNumbers`
- **Descripción**: Crea un nuevo número de teléfono.
- **Body (JSON)**:
  ```json
  {
    "phoneNumber": "string", // Obligatorio
    "status": "no verificado" | "verificado" | "por verificar" // Opcional, default: "por verificar"
  }
  ```
- **Respuesta**:
  - **201 Created**: Número de teléfono creado exitosamente
  - **400 Bad Request**: Datos inválidos
  - **500 Error**: Error al crear el número de teléfono

### 4. Actualizar un número de teléfono

- **Endpoint**: `PUT /api/phoneNumbers/:id`
- **Descripción**: Actualiza un número de teléfono existente.
- **Parámetros de URL**:
  - `id`: ID del número de teléfono
- **Body (JSON)**:
  ```json
  {
    "phoneNumber": "string", // Opcional
    "status": "no verificado" | "verificado" | "por verificar" // Opcional
  }
  ```
- **Respuesta**:
  - **200 OK**: Número de teléfono actualizado exitosamente
  - **404 Not Found**: Número de teléfono no encontrado
  - **400 Bad Request**: Datos inválidos
  - **500 Error**: Error al actualizar el número de teléfono

### 5. Eliminar un número de teléfono

- **Endpoint**: `DELETE /api/phoneNumbers/:id`
- **Descripción**: Elimina un número de teléfono existente.
- **Parámetros de URL**:
  - `id`: ID del número de teléfono
- **Respuesta**:
  - **200 OK**: Número de teléfono eliminado exitosamente
  - **404 Not Found**: Número de teléfono no encontrado
  - **500 Error**: Error al eliminar el número de teléfono

## Ejemplos de uso

### Ejemplo de creación
```bash
# Crear un nuevo número de teléfono
POST /api/phoneNumbers
Content-Type: application/json

{
  "phoneNumber": "+573123456789",
  "status": "por verificar"
}
```

### Ejemplo de actualización
```bash
# Actualizar el estado de un número
PUT /api/phoneNumbers/1
Content-Type: application/json

{
  "status": "verificado"
}
```
