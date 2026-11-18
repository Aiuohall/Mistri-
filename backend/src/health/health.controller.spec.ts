import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns the API liveness payload', () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual({
      status: 'ok',
      service: 'mistri-api',
      timestamp: expect.any(String),
    });
  });
});
