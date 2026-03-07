import { ENVEnum } from '@/common/enum/env.enum';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type FirebaseAdminLike = {
  apps: unknown[];
  app: () => unknown;
  credential: { cert: (arg: unknown) => unknown };
  initializeApp: (arg: unknown) => unknown;
  messaging: (app?: unknown) => {
    send: (message: unknown) => Promise<string>;
    sendEachForMulticast: (message: unknown) => Promise<unknown>;
  };
};

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private admin: FirebaseAdminLike | null = null;
  private firebaseApp: unknown | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const enabled = this.isEnabled();
    if (!enabled) {
      this.logger.log('Firebase push notification is disabled');
      return;
    }

    const projectId = this.configService.get<string>(
      ENVEnum.FIREBASE_PROJECT_ID,
    );
    const clientEmail = this.configService.get<string>(
      ENVEnum.FIREBASE_CLIENT_EMAIL,
    );
    const privateKeyRaw = this.configService.get<string>(
      ENVEnum.FIREBASE_PRIVATE_KEY,
    );

    if (!projectId || !clientEmail || !privateKeyRaw) {
      this.logger.warn(
        'Firebase is enabled but credentials are incomplete (project/client/private_key)',
      );
      return;
    }

    try {
      // Avoid hard compile dependency so project can boot even before package install.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const required = require('firebase-admin') as FirebaseAdminLike;
      this.admin = required;

      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

      this.firebaseApp =
        required.apps.length > 0
          ? required.app()
          : required.initializeApp({
              credential: required.credential.cert({
                projectId,
                clientEmail,
                privateKey,
              }),
            });

      this.logger.log('Firebase push notification configured successfully');
    } catch (error) {
      this.logger.error(
        'Failed to initialize Firebase Admin SDK. Install firebase-admin and verify credentials.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  isEnabled(): boolean {
    const value = this.configService.get<string>(ENVEnum.FIREBASE_ENABLED);
    return String(value).toLowerCase() === 'true';
  }

  isConfigured(): boolean {
    return !!this.admin && !!this.firebaseApp;
  }

  async sendToToken(
    token: string,
    payload: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<string | null> {
    if (!this.admin || !this.firebaseApp) {
      this.logger.warn('Firebase send skipped: Firebase is not configured');
      return null;
    }

    return this.admin.messaging(this.firebaseApp).send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
    });
  }

  async sendToTokens(
    tokens: string[],
    payload: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<unknown | null> {
    if (!tokens.length) return null;

    if (!this.admin || !this.firebaseApp) {
      this.logger.warn(
        'Firebase multicast skipped: Firebase is not configured',
      );
      return null;
    }

    return this.admin.messaging(this.firebaseApp).sendEachForMulticast({
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
    });
  }
}
