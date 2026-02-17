import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateMedicalStatusDto {
  @IsOptional()
  @IsBoolean()
  medicalHoldFlag?: boolean;

  @IsOptional()
  @IsEnum(['CLEARED', 'QUARANTINE', 'OBSERVATION'])
  quarantineStatus?: 'CLEARED' | 'QUARANTINE' | 'OBSERVATION';

  @IsOptional()
  @IsBoolean()
  vaccinationsUpToDate?: boolean;

  @IsOptional()
  @IsDateString()
  rabiesExpiration?: string;

  @IsOptional()
  @IsEnum(['NEGATIVE', 'POSITIVE', 'TREATMENT', 'UNKNOWN'])
  heartwormStatus?: 'NEGATIVE' | 'POSITIVE' | 'TREATMENT' | 'UNKNOWN';

  @IsOptional()
  @IsBoolean()
  specialNeedsFlag?: boolean;

  @IsOptional()
  @IsString()
  medicalNotes?: string;
}

export class MedicalReadinessDto {
  clearedForTransport: boolean;
  reasons: string[];
  medicalHoldFlag: boolean;
  quarantineStatus: string;
  vaccinationsUpToDate: boolean;
  rabiesExpiration?: Date;
  heartwormStatus?: string;
  specialNeedsFlag: boolean;
}
