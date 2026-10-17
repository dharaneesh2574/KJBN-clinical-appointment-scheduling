import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects missing database configuration instead of using driver defaults', () => {
    jest.replaceProperty(process, 'env', { ...process.env, DATABASE_URL: '' });

    expect(() => new PrismaService()).toThrow('DATABASE_URL is required');
  });

  it('connects on startup and closes the client on shutdown', async () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    });
    const service = new PrismaService();
    const connect = jest.spyOn(service, '$connect').mockResolvedValue();
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('propagates connection failures during startup', async () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    });
    const service = new PrismaService();
    jest.spyOn(service, '$connect').mockRejectedValue(new Error('unavailable'));

    await expect(service.onModuleInit()).rejects.toThrow('unavailable');
  });
});
