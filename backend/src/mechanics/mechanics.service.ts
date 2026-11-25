import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import type { NearbyMechanicsQueryDto } from './dto/nearby-mechanics-query.dto';
import type { NearbyMechanicResponse } from './dto/nearby-mechanic.response';
import type { LocationUpdateResponse } from './dto/location-update.response';
import type { MechanicProfileResponse } from './dto/mechanic-profile.response';
import type { UpdateMechanicAvailabilityDto } from './dto/update-mechanic-availability.dto';
import type { UpdateMechanicLocationDto } from './dto/update-mechanic-location.dto';
import type { UpsertMechanicProfileDto } from './dto/upsert-mechanic-profile.dto';
import { MechanicProfile } from './mechanic-profile.entity';

const DEFAULT_NEARBY_RADIUS_METERS = 5_000;
const NEARBY_RESULTS_LIMIT = 20;
const MINIMUM_LOCATION_UPDATE_INTERVAL_SECONDS = 15;
const MINIMUM_LOCATION_UPDATE_DISTANCE_METERS = 50;
const STALE_LOCATION_MAX_AGE_MINUTES = 15;

interface NearbyMechanicRow {
  user_id: string;
  display_name: string;
  bio: string | null;
  service_types: string[];
  distance_meters: number | string;
  location_updated_at: Date | string;
}

interface LocationUpdateRow {
  location_updated_at: Date | string;
}

@Injectable()
export class MechanicsService {
  constructor(
    @InjectRepository(MechanicProfile)
    private readonly mechanicsRepository: Repository<MechanicProfile>,
  ) {}

  async upsertProfile(
    userId: string,
    dto: UpsertMechanicProfileDto,
  ): Promise<MechanicProfileResponse> {
    const existingProfile = await this.mechanicsRepository.findOneBy({ userId });
    const profile = existingProfile
      ? Object.assign(existingProfile, {
          displayName: dto.displayName,
          bio: dto.bio ?? null,
          serviceTypes: dto.serviceTypes,
        })
      : this.mechanicsRepository.create({
          userId,
          displayName: dto.displayName,
          bio: dto.bio ?? null,
          serviceTypes: dto.serviceTypes,
        });

    return this.toProfileResponse(await this.mechanicsRepository.save(profile));
  }

  async getOwnProfile(userId: string): Promise<MechanicProfileResponse> {
    return this.toProfileResponse(await this.getProfileOrThrow(userId));
  }

  async updateAvailability(
    userId: string,
    dto: UpdateMechanicAvailabilityDto,
  ): Promise<MechanicProfileResponse> {
    const profile = await this.getProfileOrThrow(userId);
    profile.isOnline = dto.isOnline;

    if (!dto.isOnline) {
      // Do not retain a mechanic's whereabouts once they stop offering service.
      profile.currentLocation = null;
      profile.locationUpdatedAt = null;
    }

    return this.toProfileResponse(await this.mechanicsRepository.save(profile));
  }

  async updateLocation(
    userId: string,
    dto: UpdateMechanicLocationDto,
  ): Promise<LocationUpdateResponse> {
    const profile = await this.getProfileOrThrow(userId);
    if (!profile.isOnline) {
      throw new BadRequestException('Go online before sharing a location.');
    }

    const rows = await this.mechanicsRepository.query<LocationUpdateRow[]>(
      `
        UPDATE "mechanics"
        SET
          "current_location" = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          "location_updated_at" = NOW(),
          "updated_at" = NOW()
        WHERE "user_id" = $3
          AND "is_online" = true
          AND (
            "current_location" IS NULL
            OR (
              "location_updated_at" <= NOW() - ($4 * INTERVAL '1 second')
              AND ST_Distance(
                "current_location",
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
              ) >= $5
            )
          )
        RETURNING "location_updated_at"
      `,
      [
        dto.longitude,
        dto.latitude,
        userId,
        MINIMUM_LOCATION_UPDATE_INTERVAL_SECONDS,
        MINIMUM_LOCATION_UPDATE_DISTANCE_METERS,
      ],
    );

    const locationUpdate = rows[0];
    if (!locationUpdate) {
      throw new BadRequestException(
        'Location updates require at least 15 seconds and 50 metres of movement.',
      );
    }

    return { locationUpdatedAt: this.toIsoString(locationUpdate.location_updated_at) };
  }

  async findNearby(query: NearbyMechanicsQueryDto): Promise<NearbyMechanicResponse[]> {
    const rows = await this.mechanicsRepository.query<NearbyMechanicRow[]>(
      `
        WITH search_point AS (
          SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS "location"
        )
        SELECT
          m."user_id",
          m."display_name",
          m."bio",
          m."service_types",
          ST_Distance(m."current_location", search_point."location") AS "distance_meters",
          m."location_updated_at"
        FROM "mechanics" m
        CROSS JOIN search_point
        WHERE m."is_online" = true
          AND m."current_location" IS NOT NULL
          AND m."location_updated_at" >= NOW() - ($4 * INTERVAL '1 minute')
          AND ST_DWithin(m."current_location", search_point."location", $3)
        ORDER BY "distance_meters" ASC, m."location_updated_at" DESC
        LIMIT $5
      `,
      [
        query.longitude,
        query.latitude,
        query.radiusMeters ?? DEFAULT_NEARBY_RADIUS_METERS,
        STALE_LOCATION_MAX_AGE_MINUTES,
        NEARBY_RESULTS_LIMIT,
      ],
    );

    return rows.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      bio: row.bio,
      serviceTypes: row.service_types,
      distanceMeters: Math.round(Number(row.distance_meters)),
      locationUpdatedAt: this.toIsoString(row.location_updated_at),
    }));
  }

  private async getProfileOrThrow(userId: string): Promise<MechanicProfile> {
    const profile = await this.mechanicsRepository.findOneBy({ userId });
    if (!profile) {
      throw new NotFoundException('Create a mechanic profile before using this feature.');
    }

    return profile;
  }

  private toProfileResponse(profile: MechanicProfile): MechanicProfileResponse {
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      bio: profile.bio,
      serviceTypes: profile.serviceTypes,
      isOnline: profile.isOnline,
      locationUpdatedAt: profile.locationUpdatedAt?.toISOString() ?? null,
    };
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}
