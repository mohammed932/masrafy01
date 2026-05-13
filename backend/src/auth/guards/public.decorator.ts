import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE_KEY = 'public_route';

/**
 * Skip JwtAuthGuard on a specific route (login, refresh, logout — endpoints
 * that consume the refresh cookie or no auth at all).
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_ROUTE_KEY, true);
