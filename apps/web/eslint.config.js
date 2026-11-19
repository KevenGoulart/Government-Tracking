import { next } from '@raio-x/eslint-config/next';

export default [...next(import.meta.dirname), { ignores: ['next-env.d.ts'] }];
