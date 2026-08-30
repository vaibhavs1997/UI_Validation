import { Module } from '@nestjs/common';
import { FirebaseAuthController } from './firebase-auth.controller.js';
import { FirebaseSessionGuard } from './firebase-session.guard.js';
import { FirebaseSessionService } from './firebase-session.service.js';

@Module({ controllers: [FirebaseAuthController], providers: [FirebaseSessionService, FirebaseSessionGuard], exports: [FirebaseSessionGuard, FirebaseSessionService] })
export class AuthModule {}
