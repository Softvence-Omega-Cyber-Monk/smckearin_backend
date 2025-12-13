import { TResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthGetProfileService {
  constructor(private readonly authUtils: AuthUtilsService) {}

  @HandleError("Can't get user profile")
  async getProfile(userId: string): Promise<TResponse<any>> {
    return this.authUtils.findUserBy('id', userId);
  }

  @HandleError("Can't get user profile")
  async getProfileByEmail(email: string): Promise<TResponse<any>> {
    return this.authUtils.findUserBy('email', email);
  }
}
