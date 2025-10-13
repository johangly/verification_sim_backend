import express from "express";
import db from "../database/index.js";
import multer from "multer";
import { Op } from "sequelize";
import { normalizeMexicanPhoneNumber } from "../utils/phoneValidator.js";
import logger from "../utils/logger.js";
// Configura Multer para guardar el archivo en memoria.
// Esto es ideal para archivos pequeños como el que describes.
const upload = multer({
	storage: multer.memoryStorage(),
	dest: "../uploads/",
});

const router = express.Router();

router.post("/file", upload.single("file"), async (req, res) => {
	try {
		// 1. Recibir el archivo
		if (!req.file) {
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
		for (const line of lines) {
			const [phoneNumber, statusFromFile] = line.split(",");

			// Validar el número de teléfono
			const trimmedPhoneNumber =
				normalizeMexicanPhoneNumber(phoneNumber);

			if (!trimmedPhoneNumber) {
				console.warn(
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
				console.log("Línea válida:", line);
				phoneNumbersToCreate.push({
					phoneNumber: trimmedPhoneNumber,
					status: statusToUse,
				});
			} else {
				console.warn(`Línea inválida ignorada: ${line}`);
			}
		}

		// 3. Crear los registros en la base de datos
		// Usamos bulkCreate para un mejor rendimiento
		if (phoneNumbersToCreate.length > 0) {
			const result = await db.PhoneNumbers.bulkCreate(
				phoneNumbersToCreate,
				{
					// ignoreDuplicates es una excelente opción para evitar errores si un número ya existe
					ignoreDuplicates: true,
				}
			);

			console.log(
				`Se crearon ${result.length} registros exitosamente.`
			);
			return res.status(200).json({
				message: "Teléfonos cargados con éxito.",
				totalCreated: result.length,
			});
		} else {
			return res
				.status(400)
				.send("El archivo CSV no contiene datos válidos.");
		}
	} catch (error) {
		console.error("Error al procesar el archivo CSV:", error);
		return res.status(500).send("Error interno del servidor.");
	}
});

router.use(express.json());

router.get("/getPaginationInfo", async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const offset = (page - 1) * limit;
		const { count, rows } = await req.app
			.get("models")
			.PhoneNumbers.findAndCountAll({
				limit,
				offset,
				order: [["id", "ASC"]],
			});

		// Calcular el total de páginas
		const totalPages = Math.ceil(count / limit);

		// Responder con los datos y la info de paginación
		res.json({
			data: rows,
			pagination: {
				totalItems: count,
				totalPages,
				currentPage: page,
				pageSize: limit,
			},
		});
	} catch (error) {
		console.log("error al obtener info de paginacion", error);
		res.status(500).json({
			message: "Error al obtener la información de paginación",
		});
	}
});

// Obtener todos los números de teléfono
router.get("/", async (req, res) => {
	const limit = parseInt(req.query.amount) || 10;
	const startString = req.query.start;
	const endString = req.query.end;
  const page = parseInt(req.query.page) || 1;
		const offset = (page - 1) * limit;
	try {
		// Convierte los strings a objetos Date
		const startDate = startString ? new Date(startString) : null;
		const endDate = endString ? new Date(endString) : null;

		// Objeto 'where' para construir la consulta dinámicamente
		const whereCondition = {};

		// 1. Validar y añadir la condición para la fecha de inicio
		//    Si la fecha es válida, se añade a la condición
		if (startDate && !isNaN(startDate.getTime())) {
			whereCondition.createdAt = {
				[Op.gte]: startDate,
			};
		}

		// 2. Validar y añadir la condición para la fecha de fin
		//    Si la fecha es válida, se añade a la condición.
		//    Si la fecha de inicio ya existe, se combina la condición.
		if (endDate && !isNaN(endDate.getTime())) {
			whereCondition.createdAt = {
				...(whereCondition.createdAt || {}), // Combina con la condición anterior
				[Op.lte]: endDate,
			};
		}

		const { count, rows } = await db.PhoneNumbers.findAndCountAll({
			limit,
      offset,
			where: whereCondition,
		});

		res.json({
			data: rows,
			pagination: {
				totalItems: count,
				totalPages: Math.ceil(count / limit),
				currentPage: page,
				pageSize: limit,
			},
		});
	} catch (error) {
		console.log(error);
		res.status(500).json({
			message: "Error al obtener los números de teléfono",
		});
	}
});

// Obtener un número de teléfono por ID
router.get("/:id", async (req, res) => {
	try {
		const phoneNumber = await db.PhoneNumbers.findByPk(
			req.params.id
		);
		if (!phoneNumber) {
			return res
				.status(404)
				.json({
					message: "Número de teléfono no encontrado",
				});
		}
		res.json(phoneNumber);
	} catch (error) {
		res.status(500).json({
			message: "Error al obtener el número de teléfono",
		});
	}
});

// Crear un nuevo número de teléfono
router.post("/", async (req, res) => {
	try {
		const { phoneNumber, status } = req.body;

		const numeroSinEspacio =
			normalizeMexicanPhoneNumber(phoneNumber);

		if (!numeroSinEspacio) {
			logger.error(`Número inválido ignorado: ${phoneNumber}`);
			return res
				.status(400)
				.json({ message: "Número de teléfono inválido" });
		}

		const newPhoneNumber = await db.PhoneNumbers.create({
			phoneNumber: numeroSinEspacio,
			status: status || "por verificar",
		});
		res.status(201).json(newPhoneNumber);
	} catch (error) {
		console.log("error al crear numero de telefono", error);
		res.status(500).json({
			message: "Error al crear el número de teléfono",
		});
	}
});

// Actualizar un número de teléfono
router.put("/:id", async (req, res) => {
	try {
		const phoneNumber = await db.PhoneNumbers.findByPk(
			req.params.id
		);
		if (!phoneNumber) {
			return res
				.status(404)
				.json({
					message: "Número de teléfono no encontrado",
				});
		}
		const { phoneNumber: newPhoneNumber, status } = req.body;
		const numeroSinEspacio =
			normalizeMexicanPhoneNumber(newPhoneNumber);

		if (!numeroSinEspacio) {
			logger.error(
				`Número inválido ignorado: ${newPhoneNumber}`
			);
			return res
				.status(400)
				.json({ message: "Número de teléfono inválido" });
		}

		await phoneNumber.update({
			phoneNumber: numeroSinEspacio,
			status: status || phoneNumber.status,
		});
		res.json(phoneNumber);
	} catch (error) {
		console.log("error al actualizar numero de telefono", error);
		res.status(500).json({
			message: "Error al actualizar el número de teléfono",
		});
	}
});

// Eliminar un número de teléfono
router.delete("/:id", async (req, res) => {
	try {
		const phoneNumber = await db.PhoneNumbers.findByPk(
			req.params.id
		);
		if (!phoneNumber) {
			return res
				.status(404)
				.json({
					message: "Número de teléfono no encontrado",
				});
		}
		await phoneNumber.destroy();
		res.json({
			message: "Número de teléfono eliminado exitosamente",
		});
	} catch (error) {
		console.log("error al eliminar numero de telefono", error);
		res.status(500).json({
			message: "Error al eliminar el número de teléfono",
		});
	}
});

export default router;
