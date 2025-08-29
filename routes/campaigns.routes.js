import express from 'express';
import db from '../database/index.js';
const router = express.Router();

router.use(express.json());

router.get('/', async (req, res) => {
    const campaigns = await db.Campaigns.findAll({
        include: [
            {
                model: db.Messages,
                as: 'messages',
                attributes: { exclude: ['twilioSid','phoneNumberId','createdAt'] },
                include: [
                    {
                        model: db.PhoneNumbers,
                        as: 'phoneNumber',
                        attributes: { exclude: ['createdAt', 'updatedAt'] },
                    },
                ],
            },
        ],
    });

    console.log('campaigns', campaigns);
    res.json(campaigns);
});

export default router;
