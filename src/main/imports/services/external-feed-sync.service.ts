import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma';
import axios from 'axios';

@Injectable()
export class ExternalFeedSyncService {
  private readonly logger = new Logger(ExternalFeedSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cron job that runs every hour to sync all active external feeds
   */
  @Cron(CronExpression.EVERY_HOUR)
  async syncAllActiveFeeds() {
    this.logger.log('Starting scheduled external feed sync');

    const activeConfigs = await this.prisma.client.externalFeedConfig.findMany({
      where: { isActive: true },
    });

    for (const config of activeConfigs) {
      try {
        await this.syncFeed(config.id);
      } catch (error) {
        this.logger.error(
          `Failed to sync feed ${config.name}: ${error.message}`,
        );
      }
    }

    this.logger.log('Completed scheduled external feed sync');
  }

  @HandleError('Error syncing external feed')
  async syncFeed(configId: string) {
    const config = await this.prisma.client.externalFeedConfig.findUnique({
      where: { id: configId },
      include: { shelter: true },
    });

    if (!config) {
      throw new Error('Feed configuration not found');
    }

    if (!config.isActive) {
      throw new Error('Feed configuration is not active');
    }

    this.logger.log(
      `Syncing feed: ${config.name} for shelter: ${config.shelter.name}`,
    );

    try {
      // Fetch data from external API
      const response = await axios.get(config.apiUrl, {
        headers: config.apiKey
          ? { Authorization: `Bearer ${config.apiKey}` }
          : {},
        timeout: 30000, // 30 second timeout
      });

      const feedData = response.data;

      // Perform delta sync
      const syncResult = await this.performDeltaSync(
        feedData,
        config.shelterId,
        config.provider,
      );

      // Update last sync status
      await this.prisma.client.externalFeedConfig.update({
        where: { id: configId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: 'SUCCESS',
        },
      });

      this.logger.log(
        `Feed sync completed: ${syncResult.created} created, ${syncResult.updated} updated`,
      );

      return {
        success: true,
        message: 'Feed synced successfully',
        data: syncResult,
      };
    } catch (error) {
      // Update last sync status as failed
      await this.prisma.client.externalFeedConfig.update({
        where: { id: configId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: 'FAILED',
        },
      });

      throw error;
    }
  }

  private async performDeltaSync(
    feedData: any[],
    shelterId: string,
    provider: string,
  ) {
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
    };

    for (const item of feedData) {
      try {
        const normalizedData = this.normalizeFeedData(item, provider);

        if (!normalizedData.externalAnimalId) {
          results.skipped++;
          continue;
        }

        // Check if animal exists
        const existing = await this.prisma.client.animal.findUnique({
          where: { externalAnimalId: normalizedData.externalAnimalId },
        });

        if (existing) {
          // Update existing animal (delta sync - only update changed fields)
          await this.prisma.client.animal.update({
            where: { id: existing.id },
            data: {
              name: normalizedData.name || existing.name,
              breed: normalizedData.breed || existing.breed,
              species: normalizedData.species || existing.species,
              gender: normalizedData.gender || existing.gender,
              age: normalizedData.age ?? existing.age,
              weight: normalizedData.weight ?? existing.weight,
              color: normalizedData.color || existing.color,
              imageUrl: normalizedData.imageUrl || existing.imageUrl,
              medicalNotes:
                normalizedData.medicalNotes || existing.medicalNotes,
              behaviorNotes:
                normalizedData.behaviorNotes || existing.behaviorNotes,
            },
          });
          results.updated++;
        } else {
          // Create new animal
          await this.prisma.client.animal.create({
            data: {
              ...normalizedData,
              shelterId,
            } as unknown as Prisma.AnimalCreateInput,
          });
          results.created++;
        }
      } catch (error) {
        this.logger.error(`Error processing feed item: ${error.message}`);
        results.skipped++;
      }
    }

    return results;
  }

  /**
   * Normalize data from different providers to our internal format
   */
  private normalizeFeedData(item: any, provider: string): Partial<any> {
    switch (provider) {
      case '24PETCONNECT':
        return {
          externalAnimalId: item.animalId || item.id,
          name: item.name,
          breed: item.breed,
          species:
            item.species === 'Dog'
              ? 'DOG'
              : item.species === 'Cat'
                ? 'CAT'
                : 'DOG',
          gender: item.sex === 'Male' ? 'MALE' : 'FEMALE',
          age: parseInt(item.age) || 0,
          weight: parseFloat(item.weight) || 0,
          color: item.color,
          imageUrl: item.photos?.[0]?.url,
          medicalNotes: item.medicalInfo,
          behaviorNotes: item.behaviorInfo,
          intakeDate: item.intakeDate ? new Date(item.intakeDate) : undefined,
          intakeType: item.intakeType,
        };

      case 'ADOPT_A_PET':
        return {
          externalAnimalId: item.pet_id,
          name: item.pet_name,
          breed: item.primary_breed,
          species: item.species_name === 'Dog' ? 'DOG' : 'CAT',
          gender: item.sex === 'M' ? 'MALE' : 'FEMALE',
          age: this.convertAgeToYears(item.age),
          weight: parseFloat(item.size_lbs) || 0,
          color: item.color,
          imageUrl: item.large_results_photo_url,
          medicalNotes: item.special_needs,
          behaviorNotes: item.description,
        };

      default:
        // Generic normalization
        return {
          externalAnimalId: item.id || item.animalId,
          name: item.name,
          breed: item.breed,
          species: item.species,
          gender: item.gender,
          age: item.age,
          weight: item.weight,
          color: item.color,
          imageUrl: item.imageUrl || item.photoUrl,
        };
    }
  }

  private convertAgeToYears(ageString: string): number {
    // Convert age strings like "2 years", "6 months" to years
    if (!ageString) return 0;

    const match = ageString.match(/(\d+)\s*(year|month|week)/i);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit.startsWith('year')) return value;
    if (unit.startsWith('month')) return Math.round(value / 12);
    if (unit.startsWith('week')) return Math.round(value / 52);

    return 0;
  }

  @HandleError('Error updating photos')
  async updatePhotos(animalId: string, photoUrls: string[]) {
    if (!photoUrls || photoUrls.length === 0) {
      return;
    }

    // Update the primary photo URL (first photo)
    await this.prisma.client.animal.update({
      where: { id: animalId },
      data: {
        imageUrl: photoUrls[0],
      },
    });
  }
}
