/**
 * Local mirrors of Prisma's `SupportChannel` + `SupportStatus` enums.
 *
 * Constitution Principle X / Clean Code Structure: only repositories import
 * from `@prisma/client`. Controllers, services, and DTOs use these local
 * enums. Members match Prisma's schema exactly (same string values) so the
 * wire format is unchanged.
 */

export enum SupportChannel {
  chat = 'chat',
  call = 'call',
  whatsapp = 'whatsapp',
  email = 'email',
}

export enum SupportStatus {
  open = 'open',
  in_progress = 'in_progress',
  resolved = 'resolved',
}
