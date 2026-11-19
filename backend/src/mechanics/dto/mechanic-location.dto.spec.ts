import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { NearbyMechanicsQueryDto } from './nearby-mechanics-query.dto';
import { UpdateMechanicLocationDto } from './update-mechanic-location.dto';

describe('mechanic location DTOs', () => {
  it('accepts valid numeric body coordinates', async () => {
    const dto = plainToInstance(UpdateMechanicLocationDto, {
      latitude: 23.7525,
      longitude: 90.3742,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects coordinates outside their valid ranges', async () => {
    const dto = plainToInstance(UpdateMechanicLocationDto, {
      latitude: 91,
      longitude: 181,
    });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'latitude' }),
        expect.objectContaining({ property: 'longitude' }),
      ]),
    );
  });

  it('rejects an oversized nearby-search radius', async () => {
    const dto = plainToInstance(NearbyMechanicsQueryDto, {
      latitude: '23.7525',
      longitude: '90.3742',
      radiusMeters: '20001',
    });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'radiusMeters' })]),
    );
  });
});
