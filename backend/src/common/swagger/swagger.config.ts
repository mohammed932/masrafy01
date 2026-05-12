import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication, isProd: boolean): void {
  if (isProd) {
    // Per Principle XIV: restrict in production. Skip mounting.
    return;
  }
  const config = new DocumentBuilder()
    .setTitle('Masrafy Admin API')
    .setDescription('Authentication, sessions, and admin-user CRUD')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'BearerAuth',
    )
    .addServer('http://localhost:3000/api/admin', 'Local development')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
