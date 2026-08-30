import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> { return bcrypt.hash(password, 12); }
  verify(password: string, passwordHash: string): Promise<boolean> { return bcrypt.compare(password, passwordHash); }
}
