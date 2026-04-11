import { Injectable } from '@nestjs/common';

@Injectable()
export class AdopterService {
  constructor() {
    console.log('AdopterService');
  }
}
