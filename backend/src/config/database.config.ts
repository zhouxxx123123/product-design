import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      username: this.configService.get<string>('DB_USER', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD', 'password'),
      database: this.configService.get<string>('DB_NAME', 'liuguang'),
      entities: [
        __dirname + '/../entities/*.entity{.ts,.js}',
        __dirname + '/../modules/**/*.entity{.ts,.js}',
      ],
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      migrationsTableName: 'migrations',
      migrationsRun: false,
      synchronize: false, // Never true in production
      logging: this.configService.get<string>('NODE_ENV') === 'development',
      ssl:
        this.configService.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
    };
  }
}
