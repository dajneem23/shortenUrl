import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

import { getMetrics } from './metrics';

@Controller()
export class MetricsController {
  @Get('metrics')
  async metrics(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(HttpStatus.OK).send(await getMetrics());
  }

  @Get('health')
  health() {
    return { status: 'ok', uptime: process.uptime() };
  }
}
