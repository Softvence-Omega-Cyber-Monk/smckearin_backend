import { Injectable } from '@nestjs/common';

@Injectable()
export class GetShelterService {
  async GetAllShelters() {
    return [];
  }

  async getApprovedShelters() {
    return [];
  }

  async getSingleShelter() {
    return {};
  }
}
