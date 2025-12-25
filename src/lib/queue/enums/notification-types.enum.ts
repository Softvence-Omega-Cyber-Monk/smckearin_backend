export enum NotificationType {
  // === User Registration ===
  SHELTER_REGISTERED = 'shelter_registered',
  VET_REGISTERED = 'vet_registered',
  DRIVER_REGISTERED = 'driver_registered',

  // === Team Management ===
  SHELTER_MEMBER_INVITED = 'shelter_member_invited',
  SHELTER_MEMBER_ROLE_CHANGED = 'shelter_member_role_changed',
  SHELTER_MEMBER_REMOVED = 'shelter_member_removed',
  ADMIN_INVITED = 'admin_invited',
  ADMIN_ROLE_CHANGED = 'admin_role_changed',
  ADMIN_DELETED = 'admin_deleted',

  // === Shelter Management ===
  SHELTER_APPROVED = 'shelter_approved',
  SHELTER_REJECTED = 'shelter_rejected',
  SHELTER_DELETED = 'shelter_deleted',
  SHELTER_DOCUMENT_UPLOADED = 'shelter_document_uploaded',
  SHELTER_DOCUMENT_APPROVED = 'shelter_document_approved',
  SHELTER_DOCUMENT_REJECTED = 'shelter_document_rejected',

  // === Driver Management ===
  DRIVER_APPROVED = 'driver_approved',
  DRIVER_REJECTED = 'driver_rejected',
  DRIVER_DELETED = 'driver_deleted',
  DRIVER_DOCUMENT_UPLOADED = 'driver_document_uploaded',
  DRIVER_DOCUMENT_APPROVED = 'driver_document_approved',
  DRIVER_DOCUMENT_REJECTED = 'driver_document_rejected',

  // === Veterinarian Management ===
  VET_APPROVED = 'vet_approved',
  VET_REJECTED = 'vet_rejected',
  VET_DELETED = 'vet_deleted',
  VET_DOCUMENT_UPLOADED = 'vet_document_uploaded',
  VET_DOCUMENT_APPROVED = 'vet_document_approved',
  VET_DOCUMENT_REJECTED = 'vet_document_rejected',

  // === Transport Management ===
  TRANSPORT_CREATED = 'transport_created',
  TRANSPORT_DELETED = 'transport_deleted',
  TRANSPORT_ACCEPTED = 'transport_accepted',
  TRANSPORT_REJECTED = 'transport_rejected',
  DRIVER_ASSIGNED = 'driver_assigned',
  TRANSPORT_STATUS_UPDATED = 'transport_status_updated',

  // === Vet Clearance ===
  VET_CLEARANCE_STATUS_CHANGED = 'vet_clearance_status_changed',
  ANIMAL_NOT_FIT_FOR_TRANSPORT = 'animal_not_fit_for_transport',

  // === Appointments ===
  VET_APPOINTMENT_SCHEDULED = 'vet_appointment_scheduled',
  VET_APPOINTMENT_STATUS_UPDATED = 'vet_appointment_status_updated',
  VET_APPOINTMENT_CANCELLED = 'vet_appointment_cancelled',
  VET_APPOINTMENT_COMPLETED = 'vet_appointment_completed',
  VET_APPOINTMENT_MISSED = 'vet_appointment_missed',

  // === Health Reports ===
  HEALTH_REPORT_APPROVED = 'health_report_approved',
  HEALTH_REPORT_REJECTED = 'health_report_rejected',
  HEALTH_REPORT_UPDATED = 'health_report_updated',
  HEALTH_REPORT_DELETED = 'health_report_deleted',
}
