import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, type SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

function paraOpenApi(schema: z.ZodType, io: 'input' | 'output'): SchemaObject {
  // Transformações (ex.: coerção da query string) não têm equivalente em JSON Schema;
  // `unrepresentable: 'any'` mantém o restante do schema documentado.
  const { $schema: _ignorado, ...json } = z.toJSONSchema(schema, {
    io,
    unrepresentable: 'any',
    target: 'openapi-3.0',
  });
  return json as SchemaObject;
}

/** Documenta no Swagger cada campo de um schema Zod de query string. */
export function ApiZodQuery(schema: z.ZodObject): MethodDecorator {
  const json = paraOpenApi(schema, 'input');
  const obrigatorios = new Set(json.required ?? []);
  const decorators = Object.entries(json.properties ?? {}).map(([name, propriedade]) =>
    ApiQuery({ name, required: obrigatorios.has(name), schema: propriedade as SchemaObject }),
  );
  return applyDecorators(...decorators);
}

/** Documenta a resposta 200 a partir do schema Zod compartilhado com o front-end. */
export function ApiZodOk(schema: z.ZodType, description?: string): MethodDecorator {
  return applyDecorators(
    ApiOkResponse({ schema: paraOpenApi(schema, 'output'), ...(description && { description }) }),
  );
}
