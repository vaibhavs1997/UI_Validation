import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScheduleRunner } from './ScheduleRunner.js';

dotenv.config({
  path: path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../.env',
  ),
});

void new ScheduleRunner().start();
