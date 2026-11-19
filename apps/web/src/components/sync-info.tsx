import { connection } from 'next/server';
import { api } from '@/lib/api';
import { formatarDataHora } from '@/lib/format';

/**
 * Data da última sincronização com a fonte oficial, exibida no rodapé de todas as páginas.
 *
 * `connection()` adia a renderização para o momento da requisição: sem isso, páginas
 * estáticas (como a home) seriam pré-renderizadas no build, quando a API pode não estar
 * acessível, e ficariam sem a data. A resposta da API continua em cache por 5 minutos.
 */
export async function SyncInfo() {
  await connection();
  let atualizadoEm: string | null = null;
  try {
    ({ atualizadoEm } = await api.syncStatus());
  } catch {
    // API indisponível: o rodapé continua mostrando a fonte, só omite a data.
  }
  if (!atualizadoEm) return null;
  return (
    <p>
      Dados sincronizados em <time dateTime={atualizadoEm}>{formatarDataHora(atualizadoEm)}</time>{' '}
      (horário de Brasília).
    </p>
  );
}
