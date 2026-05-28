import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication, isProd: boolean): void {
  if (isProd) {
    // Per Principle XIV: restrict in production. Skip mounting.
    return;
  }
  const config = new DocumentBuilder()
    .setTitle('Masrafy API')
    .setDescription(
      'Admin + mobile API. Constitution v3.0.0 / Principle XIII: both surfaces are JWT-only.',
    )
    .setVersion('3.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'BearerAuth',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'CustomerBearerAuth',
    )
    .addServer('http://localhost:3000/api/admin', 'Admin (local development)')
    .addServer('http://localhost:3000/api', 'Mobile (local development)')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
