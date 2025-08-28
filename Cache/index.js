// import redis from 'redis';
import env from 'dotenv';
import { Redis } from '@upstash/redis'

env.config();

// configuración de Redis previa
// const client = redis.createClient({
//     url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
// });

// client.on('error', (err) => console.log('Redis Client Error', err));

// const connectRedis = async () => {
//     try {
//         await client.connect();
//         console.log('Conectado a Redis');
//     } catch (error) {
//         console.error('Error al conectar a Redis:', error);
//     }
// };

// configuracion de redis de upstash

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// connectRedis();

export default redis;