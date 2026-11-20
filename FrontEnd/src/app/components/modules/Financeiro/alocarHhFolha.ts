/* =========================================================================================
 * FINANCEIRO — Folha de ponto de H.H (dados puros, sem React) — usada por AlocarHhView.
 *
 * A folha de uma OS é UM registro `hhAlocacao` no Financeiro (dias × pessoas × horas). Várias
 * pessoas editam a mesma folha (RH lança as horas, admin/financeiro confere e põe o valor por
 * cargo). Por isso salvar NUNCA sobrescreve a folha inteira: `mesclarFolha` aplica sobre a
 * versão mais nova do servidor só o que este usuário mudou desde que abriu a folha — antes,
 * quem salvava por último apagava os dias/horas que o outro tinha lançado nesse meio-tempo.
 * =======================================================================================*/
import { num } from './finData';

export type Horas = { hn: number; he05: number; he10: number; he02: number };
export type Pessoa = { id: string; nome: string; cargo: string; horas: Record<string, Horas> };
export type Folha = { mes: string; escopo: string; dias: string[]; pessoas: Pessoa[]; rates: Record<string, string> };

export const CAMPOS_HORAS: Array<keyof Horas> = ['hn', 'he05', 'he10', 'he02'];
export const HORAS_ZERO: Horas = { hn: 0, he05: 0, he10: 0, he02: 0 };
export const FOLHA_VAZIA: Folha = { mes: '', escopo: '', dias: [], pessoas: [], rates: {} };

// Sugestões de cargo (o campo é livre — isto é só um datalist de conveniência).
export const CARGOS_HH = [
  'Supervisor de obra', 'Caldeireiro/encanador', 'Soldador', 'Ajudante de caldeiraria / firewatch',
  'Eletricista', 'Pintor', 'Maçariqueiro', '1/2 Oficial', 'TST', 'Esmerilhador', 'Mecânico',
];

const normHoras = (h: any): Horas => ({ hn: num(h?.hn), he05: num(h?.he05), he10: num(h?.he10), he02: num(h?.he02) });

// `indice` dá um id ESTÁVEL a pessoas antigas salvas sem id — com id aleatório, cada leitura
// do mesmo registro parecia uma folha diferente (e a tela acharia que alguém a alterou).
const normPessoa = (p: any, indice: number): Pessoa => ({
  id: String(p?.id || `hh-legado-${indice}`),
  nome: String(p?.nome || ''),
  // Padrão só para registros antigos SEM o campo — cargo vazio de propósito continua vazio.
  cargo: p?.cargo == null ? CARGOS_HH[0] : String(p.cargo),
  horas: p?.horas && typeof p.horas === 'object'
    ? Object.fromEntries(Object.entries(p.horas).map(([dia, h]) => [String(dia).slice(0, 10), normHoras(h)]))
    : {},
});

export const temHoras = (h?: Horas) => CAMPOS_HORAS.some((c) => num(h?.[c]) !== 0);
const mesmasHoras = (a?: Horas, b?: Horas) => CAMPOS_HORAS.every((c) => num(a?.[c]) === num(b?.[c]));
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Folha (formato da tela) a partir do registro `hhAlocacao` salvo. */
export const folhaDoRegistro = (reg: any): Folha => {
  if (!reg) return FOLHA_VAZIA;
  const dias = Array.isArray(reg.dias) ? reg.dias.map((d: any) => String(d).slice(0, 10)) : [];
  return {
    // mês: do registro; senão deriva do 1º dia ou do início da apuração legada.
    mes: String(reg.mes || (dias[0] || reg.periodo?.de || '').slice(0, 7) || ''),
    escopo: String(reg.escopo || ''),
    dias,
    pessoas: Array.isArray(reg.pessoas) ? reg.pessoas.map(normPessoa) : [],
    rates: reg.rates && typeof reg.rates === 'object'
      ? Object.fromEntries(Object.entries(reg.rates).map(([k, v]) => [k, String(v ?? '')]))
      : {},
  };
};

export const folhasIguais = (a: Folha, b: Folha) => igual(a, b);

/**
 * Datas que têm horas lançadas mas NÃO estão na lista de dias da folha — horas que existem no
 * registro e não aparecem em lugar nenhum (nem nos totais). Acontecia quando a data de uma
 * coluna já preenchida era trocada: as horas ficavam presas na data antiga.
 */
export const diasComHorasOcultas = (folha: Folha): string[] => {
  const visiveis = new Set(folha.dias);
  const ocultos = new Set<string>();
  folha.pessoas.forEach((p) => Object.entries(p.horas).forEach(([dia, h]) => {
    if (!visiveis.has(dia) && temHoras(h)) ocultos.add(dia);
  }));
  return Array.from(ocultos).sort();
};

/** Troca a data de uma coluna levando junto as horas de todas as pessoas daquele dia. */
export const moverDia = (folha: Folha, antigo: string, novo: string): Folha => ({
  ...folha,
  dias: folha.dias.map((d) => (d === antigo ? novo : d)),
  pessoas: folha.pessoas.map((p) => {
    if (!(antigo in p.horas)) return p;
    const { [antigo]: horasDoDia, ...resto } = p.horas;
    return { ...p, horas: { ...resto, [novo]: horasDoDia } };
  }),
});

/**
 * Aplica sobre `servidor` (versão mais nova salva) só o que mudou de `base` (a versão que este
 * usuário abriu) para `local` (o que está na tela dele). O que ele não tocou fica como está no
 * servidor — inclusive dias, pessoas e horas que outra pessoa lançou nesse meio-tempo.
 * Granularidade das horas: por campo de cada dia de cada pessoa.
 */
export const mesclarFolha = (base: Folha, local: Folha, servidor: Folha): Folha => {
  const escolher = <T,>(meu: T, original: T, deles: T): T => (igual(meu, original) ? deles : meu);

  // Dias: os do servidor, menos os que EU removi, mais os que EU adicionei.
  const diasLocais = new Set(local.dias);
  const diasBase = new Set(base.dias);
  const removidos = new Set(base.dias.filter((d) => !diasLocais.has(d)));
  const dias = servidor.dias.filter((d) => !removidos.has(d));
  local.dias.forEach((d) => { if (!diasBase.has(d) && !dias.includes(d)) dias.push(d); });

  // Pessoas: por id.
  const basePorId = new Map(base.pessoas.map((p) => [p.id, p]));
  const localPorId = new Map(local.pessoas.map((p) => [p.id, p]));
  const servidorIds = new Set(servidor.pessoas.map((p) => p.id));
  const pessoas: Pessoa[] = [];
  servidor.pessoas.forEach((deles) => {
    const original = basePorId.get(deles.id);
    const minha = localPorId.get(deles.id);
    if (original && !minha) return; // eu removi
    if (!minha) { pessoas.push(deles); return; } // outra pessoa adicionou
    const ref: Pessoa = original || { id: deles.id, nome: '', cargo: '', horas: {} };
    const horas: Record<string, Horas> = { ...deles.horas };
    new Set([...Object.keys(minha.horas), ...Object.keys(ref.horas)]).forEach((dia) => {
      const meu = minha.horas[dia];
      const antes = ref.horas[dia];
      if (mesmasHoras(meu, antes)) return;
      const resultado = { ...(horas[dia] || HORAS_ZERO) };
      CAMPOS_HORAS.forEach((c) => { if (num(meu?.[c]) !== num(antes?.[c])) resultado[c] = num(meu?.[c]); });
      horas[dia] = resultado;
    });
    pessoas.push({
      id: deles.id,
      nome: escolher(minha.nome, ref.nome, deles.nome),
      cargo: escolher(minha.cargo, ref.cargo, deles.cargo),
      horas,
    });
  });
  // Pessoas que EU adicionei (outra pessoa pode ter removido uma que eu tinha aberto: some).
  local.pessoas.forEach((minha) => {
    if (!basePorId.has(minha.id) && !servidorIds.has(minha.id)) pessoas.push(minha);
  });

  // Valor por cargo: o que eu mudei prevalece; o resto fica como está no servidor.
  const rates: Record<string, string> = { ...servidor.rates };
  new Set([...Object.keys(local.rates), ...Object.keys(base.rates)]).forEach((cargo) => {
    if (local.rates[cargo] === base.rates[cargo]) return;
    if (local.rates[cargo] === undefined) delete rates[cargo];
    else rates[cargo] = local.rates[cargo];
  });

  return {
    mes: escolher(local.mes, base.mes, servidor.mes),
    escopo: escolher(local.escopo, base.escopo, servidor.escopo),
    dias,
    pessoas,
    rates,
  };
};
