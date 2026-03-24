import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { diskStorage } from 'multer';
import type { FileFilterCallback } from 'multer';
import * as fs from 'fs';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

const uploadDestination = './uploads/documents';

if (!fs.existsSync(uploadDestination)) {
  fs.mkdirSync(uploadDestination, { recursive: true });
}

export const documentUploadConfig = {
  storage: diskStorage({
    destination: uploadDestination,
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) => {
      const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.mimetype)) {
      return cb(
        new BadRequestException('Only PDF, JPG, and PNG files are allowed') as any,
        false,
      );
    }
    cb(null, true);
  },
};
