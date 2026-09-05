/**
 * Números de negócio/OS reservados para uso interno (café, papel, etc.):
 *   1000 -> USO INTERNO - LINAVE
 *   2000 -> USO INTERNO - SERVINAVE
 * (ver BackEnd/ComercialApp/management/commands/seed_os_interna.py)
 *
 * A numeração sequencial de um negócio real — e tudo que herda dela (OS, Orçamento,
 * Proposta usam o MESMO id base) — nunca pode produzir esses dois números: ao alcançá-los,
 * pula para o próximo e a contagem segue dali (mesma lógica de prédio sem 13º andar).
 * Usado em todo lugar que formata o id sequencial de um negócio a partir do id numérico
 * cru do backend (obrasMapper, ErpContext, CrmViewNew) — se só um desses pontos aplicar
 * o pulo, o mesmo negócio mostraria números diferentes em telas diferentes.
 */
export const NUMEROS_RESERVADOS_USO_INTERNO = [1000, 2000] as const;

export const pularNumerosReservados = (numero: number): number => {
  if (!Number.isFinite(numero)) return numero;
  let n = numero;
  for (const reservado of NUMEROS_RESERVADOS_USO_INTERNO) {
    if (n >= reservado) n += 1;
  }
  return n;
};

// Aplica o pulo em cima de um id cru (string ou número) e devolve já formatado com
// zero-padding de 4 dígitos, pronto para compor o id do negócio (PREFIXO-NUMERO/ANO).
export const formatarNumeroSequencial = (idBruto: unknown): string => {
  const idNum = Number(idBruto);
  if (!Number.isFinite(idNum)) return String(idBruto ?? '').padStart(4, '0');
  return String(pularNumerosReservados(idNum)).padStart(4, '0');
};
