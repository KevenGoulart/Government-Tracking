import { Injectable, NotFoundException, type PipeTransform } from '@nestjs/common';

/** IDs gerados pelo Prisma (cuid). Formato inválido responde 404 sem consultar o banco. */
@Injectable()
export class IdParlamentarPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^[a-z0-9]{20,32}$/.test(value)) throw new NotFoundException('Parlamentar não encontrado');
    return value;
  }
}
