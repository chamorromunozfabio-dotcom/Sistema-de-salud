import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Configuracion de Redis - equivalente a 'configuracion de redis.js' del ejemplo
 * const redis = require('redis');
 * const redisClient = redis.createClient({ url: process.env.REDIS_URL });
 * redisClient.on('error', ...) / on('connect')
 * (async () => { await redisClient.connect(); })();
 *
 * Implementado con ioredis (ya presente en proyecto) + manejo graceful shutdown
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const url = this.configService.get<string>('REDIS_URL');

    if (url) {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
      });
    } else {
      this.client = new Redis({
        host,
        port,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
      });
    }

    this.client.on('error', (err) => this.logger.error(`Redis Error: ${err.message}`, err.stack));
    this.client.on('connect', () => {
      this.logger.log('✅ Redis conectado');
      this.isConnected = true;
    });
    this.client.on('ready', () => this.logger.log('✅ Redis ready'));
    this.client.on('close', () => {
      this.logger.warn('Redis conexión cerrada');
      this.isConnected = false;
    });

    try {
      // ioredis se conecta automáticamente; esperar ready
      if (this.client.status !== 'ready') {
        await this.client.ping();
      }
    } catch (e) {
      this.logger.warn(`Redis ping falló (puede que no esté levantado): ${e.message} - modo memoria fallback activo`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => this.client.disconnect());
      this.logger.log('Redis desconectado (graceful shutdown)');
    }
  }

  getClient(): Redis {
    return this.client;
  }

  isReady(): boolean {
    return this.isConnected && this.client?.status === 'ready';
  }

  // Helpers wrappers para desacoplar ioredis directo (usa memoria fallback si redis down)
  private fallbackStore = new Map<string, { value: string; expireAt?: number }>();

  async setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
    if (this.isReady()) {
      try {
        await this.client.setex(key, ttlSeconds, value);
        return;
      } catch (e) {
        this.logger.warn(`Redis setEx fallback a memoria: ${e.message}`);
      }
    }
    this.fallbackStore.set(key, { value, expireAt: Date.now() + ttlSeconds * 1000 });
  }

  async get(key: string): Promise<string | null> {
    if (this.isReady()) {
      try {
        return await this.client.get(key);
      } catch (e) {
        this.logger.warn(`Redis get fallback: ${e.message}`);
      }
    }
    const entry = this.fallbackStore.get(key);
    if (!entry) return null;
    if (entry.expireAt && entry.expireAt < Date.now()) {
      this.fallbackStore.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<number> {
    if (this.isReady()) {
      try {
        return await this.client.del(key);
      } catch {}
    }
    return this.fallbackStore.delete(key) ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    if (this.isReady()) {
      try {
        return await this.client.keys(pattern);
      } catch {}
    }
    // fallback: filtrar keys en memoria
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.fallbackStore.keys()).filter((k) => regex.test(k));
  }

  async quit(): Promise<void> {
    if (this.client) await this.client.quit();
  }
}
