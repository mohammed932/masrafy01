import { Module } from '@nestjs/common';
import { AdminSeederService } from './admin-seeder.service';

/**
 * Boot-time seeders. Runs after the DI graph is ready (OnApplicationBootstrap).
 * PrismaService is provided by the @Global InfraModule, so nothing extra to
 * import here.
 */
@Module({
  providers: [AdminSeederService],
})
export class BootstrapModule {}
