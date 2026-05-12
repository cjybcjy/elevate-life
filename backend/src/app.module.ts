import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EncryptionModule } from './modules/encryption/encryption.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { AssetsModule } from './modules/assets/assets.module';
import { LiabilitiesModule } from './modules/liabilities/liabilities.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { GoldModule } from './modules/gold/gold.module';
import { ForecastModule } from './modules/forecast/forecast.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_NAME', 'ledger'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    EncryptionModule,
    CategoriesModule,
    AssetsModule,
    LiabilitiesModule,
    TransactionsModule,
    GoldModule,
    ForecastModule,
  ],
})
export class AppModule {}
