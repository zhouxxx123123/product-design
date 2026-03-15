import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

// 生产环境由 docker-compose 注入 env，跳过 dotenv 加载
if (process.env.NODE_ENV !== 'production') {
  config({ path: ['../.env', '.env', '.env.local'] });
}

const isProd = process.env.NODE_ENV === 'production';
const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 5432),
  username: configService.get<string>('DB_USER', 'postgres'),
  password: configService.get<string>('DB_PASSWORD', 'password'),
  database: configService.get<string>('DB_NAME', 'liuguang'),
  entities: isProd
    ? ['dist/entities/**/*.entity.js', 'dist/modules/**/*.entity.js']
    : ['src/entities/**/*.entity{.ts,.js}', 'src/modules/**/*.entity{.ts,.js}'],
  migrations: isProd ? ['dist/migrations/*.js'] : ['src/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: true,
});
