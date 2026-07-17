import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { observeHttpRequest } from '../../shared/telemetry/metrics';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    return next.handle().pipe(
      tap(() => {
        const durationSec = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path || 'unknown';
        observeHttpRequest(req.method, route, res.statusCode, durationSec);
      }),
    );
  }
}
