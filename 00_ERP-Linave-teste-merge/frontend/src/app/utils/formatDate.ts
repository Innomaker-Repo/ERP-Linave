// Formata datas para exibição no padrão brasileiro (DD/MM/AAAA) sem o bug de fuso.
//
// O problema clássico: `new Date('2026-07-02')` (string SÓ-DATA, sem hora) é interpretada
// como meia-noite UTC; ao formatar em pt-BR (Brasil, UTC-3) recua 3h e cai no dia anterior
// (01/07/2026). Por isso datas só-data (DateField do Django -> 'AAAA-MM-DD') apareciam "um
// dia pra trás".
//
// Estratégia:
//  - String só-data ('AAAA-MM-DD', sem componente de hora) -> monta DD/MM/AAAA direto das
//    partes, sem nunca construir um Date (não há fuso envolvido -> impossível recuar o dia).
//  - String com hora (timestamp real, ex.: 'AAAA-MM-DDTHH:MM:SSZ'), Date ou number ->
//    usa Date normalmente, exibindo a data LOCAL correta daquele instante.
export const formatDateBR = (value?: string | number | Date | null): string => {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString('pt-BR');
  }

  const s = String(value).trim();
  if (!s) return '';

  // Só-data 'AAAA-MM-DD' (sem hora) -> formata pelas partes, sem fuso.
  const soData = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (soData) {
    return `${soData[3]}/${soData[2]}/${soData[1]}`;
  }

  // Timestamp real (com hora/'T'/'Z') ou outro formato -> Date normal (data local correta).
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('pt-BR');
};
