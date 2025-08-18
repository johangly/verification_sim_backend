import express from 'express';
import db from '../database/index.js';

const router = express.Router();

// Obtener todos los números de teléfono
router.get('/', async (req, res) => {
  try {
    const phoneNumbers = await db.PhoneNumbers.findAll();
    res.json(phoneNumbers);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Error al obtener los números de teléfono' });
  }
});

// Obtener un número de teléfono por ID
router.get('/:id', async (req, res) => {
  try {
    const phoneNumber = await db.PhoneNumbers.findByPk(req.params.id);
    if (!phoneNumber) {
      return res.status(404).json({ message: 'Número de teléfono no encontrado' });
    }
    res.json(phoneNumber);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el número de teléfono' });
  }
});

// Crear un nuevo número de teléfono
router.post('/', async (req, res) => {
  try {
    const { phoneNumber, status } = req.body;

    const newPhoneNumber = await db.PhoneNumbers.create({
      phoneNumber,
      status: status || 'por verificar'
    });
    res.status(201).json(newPhoneNumber);
  } catch (error) {
    console.log('error al crear numero de telefono', error);
    res.status(500).json({ message: 'Error al crear el número de teléfono' });
  }
});

// Actualizar un número de teléfono
router.put('/:id', async (req, res) => {
  try {
    const phoneNumber = await db.PhoneNumbers.findByPk(req.params.id);
    if (!phoneNumber) {
      return res.status(404).json({ message: 'Número de teléfono no encontrado' });
    }

    const { phoneNumber: newPhoneNumber, status } = req.body;
    await phoneNumber.update({
      phoneNumber: newPhoneNumber,
      status: status || phoneNumber.status
    });
    res.json(phoneNumber);
  } catch (error) {
    console.log('error al actualizar numero de telefono', error);
    res.status(500).json({ message: 'Error al actualizar el número de teléfono' });
  }
});

// Eliminar un número de teléfono
router.delete('/:id', async (req, res) => {
  try {
    const phoneNumber = await db.PhoneNumbers.findByPk(req.params.id);
    if (!phoneNumber) {
      return res.status(404).json({ message: 'Número de teléfono no encontrado' });
    }
    await phoneNumber.destroy();
    res.json({ message: 'Número de teléfono eliminado exitosamente' });
  } catch (error) {
    console.log('error al eliminar numero de telefono', error);
    res.status(500).json({ message: 'Error al eliminar el número de teléfono' });
  }
});

export default router;
