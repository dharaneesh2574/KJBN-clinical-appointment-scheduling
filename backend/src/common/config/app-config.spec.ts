import { AppConfig } from './app-config';

const validEnvironment = {
  DATABASE_URL: 'postgresql://fictional:example@localhost:5432/test',
};

describe('AppConfig', () => {
  it('initializes validated defaults and parses explicit values', () => {
    const config = AppConfig.fromEnvironment({
      ...validEnvironment,
      PORT: '4000',
      NODE_ENV: 'test',
      CORS_ORIGINS: 'https://clinic.example,https://clinic.example',
      REVIEW_MODE: 'true',
    });
    expect(config.port).toBe(4000);
    expect(config.corsOrigins).toEqual(['https://clinic.example']);
    expect(config.reviewMode).toBe(true);
    expect(config.clinicTimezone).toBe('Asia/Kolkata');
    expect(AppConfig.fromEnvironment(validEnvironment).port).toBe(3000);
  });

  it.each([
    { DATABASE_URL: '' },
    { DATABASE_URL: 'mysql://secret:password@host/database' },
    { DATABASE_URL: 'postgresql://host' },
    { PORT: '0' },
    { PORT: '65536' },
    { PORT: '3e3' },
    { NODE_ENV: 'unknown' },
    { REVIEW_MODE: 'yes' },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: 'https://clinic.example/path' },
  ])(
    'rejects malformed configuration without exposing its values',
    (invalid) => {
      expect(() =>
        AppConfig.fromEnvironment({ ...validEnvironment, ...invalid }),
      ).toThrow();
      try {
        AppConfig.fromEnvironment({ ...validEnvironment, ...invalid });
      } catch (error) {
        expect(String(error)).not.toContain('secret:password');
      }
    },
  );
});
