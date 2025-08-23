import redis from 'redis';
import env from 'dotenv';
env.config();
const client = redis.createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

client.on('error', (err) => console.log('Redis Client Error', err));

const connectRedis = async () => {
    try {
        await client.connect();
        console.log('Conectado a Redis');
    } catch (error) {
        console.error('Error al conectar a Redis:', error);
    }
};

connectRedis();

export default client;