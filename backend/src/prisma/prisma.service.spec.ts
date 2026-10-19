import { PrismaService } from './prisma.service';
import { AppConfig } from '../common/config/app-config';

const config = AppConfig.fromEnvironment({
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
});

describe('PrismaService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('connects on startup and closes the client on shutdown', async () => {
    const service = new PrismaService(config);
    const connect = jest.spyOn(service, '$connect').mockResolvedValue();
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('propagates connection failures during startup', async () => {
    const service = new PrismaService(config);
    jest.spyOn(service, '$connect').mockRejectedValue(new Error('unavailable'));

    await expect(service.onModuleInit()).rejects.toThrow('unavailable');
  });
});
