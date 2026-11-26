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

/**
 * Inclui em `dias` toda data que tem horas. O RH costuma lançar um dia, trocar a data da mesma
 * coluna e lançar o seguinte: as horas do anterior continuam salvas, mas a data saía de `dias`
 * e o dia sumia da tela, do resumo e do custo (só contava o último).
 */
export const comTodosOsDias = (folha: Folha): Folha => {
  const dias = new Set(folha.dias.filter(Boolean));
  folha.pessoas.forEach((p) => Object.entries(p.horas).forEach(([dia, h]) => { if (temHoras(h)) dias.add(dia); }));
  return { ...folha, dias: Array.from(dias).sort() };
};

/** Folha (formato da tela) a partir do registro `hhAlocacao` salvo. */
export const folhaDoRegistro = (reg: any): Folha => {
  if (!reg) return FOLHA_VAZIA;
  const dias = Array.isArray(reg.dias) ? reg.dias.map((d: any) => String(d).slice(0, 10)) : [];
  return comTodosOsDias({
    // mês: do registro; senão deriva do 1º dia ou do início da apuração legada.
    mes: String(reg.mes || (dias[0] || reg.periodo?.de || '').slice(0, 7) || ''),
    escopo: String(reg.escopo || ''),
    dias,
    pessoas: Array.isArray(reg.pessoas) ? reg.pessoas.map(normPessoa) : [],
    rates: reg.rates && typeof reg.rates === 'object'
      ? Object.fromEntries(Object.entries(reg.rates).map(([k, v]) => [k, String(v ?? '')]))
      : {},
  });
};

export const folhasIguais = (a: Folha, b: Folha) => igual(a, b);

/**
 * Troca a data de uma coluna. NUNCA mexe em horas já lançadas: se a coluna tem horas, ela fica
 * e a data nova entra como outro dia; se está vazia, só muda a data.
 */
export const trocarDataDaColuna = (folha: Folha, antigo: string, novo: string): Folha => {
  const preenchida = folha.pessoas.some((p) => temHoras(p.horas[antigo]));
  const dias = preenchida ? folha.dias : folha.dias.filter((d) => d !== antigo);
  return comTodosOsDias({ ...folha, dias: [...dias, novo] });
};

/** Remove o dia E as horas dele (senão o dia voltaria, por ter horas). */
export const removerDia = (folha: Folha, dia: string): Folha => ({
  ...folha,
  dias: folha.dias.filter((d) => d !== dia),
  pessoas: folha.pessoas.map((p) => {
    const { [dia]: _removidas, ...horas } = p.horas;
    return { ...p, horas };
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

  return comTodosOsDias({
    mes: escolher(local.mes, base.mes, servidor.mes),
    escopo: escolher(local.escopo, base.escopo, servidor.escopo),
    dias,
    pessoas,
    rates,
  });
};

// ---- Totais e custo (sempre sobre TODOS os dias da folha) ----
const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Chave de agrupamento do cargo (campo LIVRE): mesma string (ignorando espaços/caixa) soma junto.
const normCargoKey = (c: string) => String(c || '').trim().replace(/\s+/g, ' ').toLowerCase();

export const totaisPessoa = (p: Pessoa, dias: string[]): Horas => {
  let hn = 0, he05 = 0, he10 = 0, he02 = 0;
  dias.forEach((dia) => { const h = p.horas[dia]; if (h) { hn += num(h.hn); he05 += num(h.he05); he10 += num(h.he10); he02 += num(h.he02); } });
  return { hn: round2(hn), he05: round2(he05), he10: round2(he10), he02: round2(he02) };
};

// Resumo por cargo (campo LIVRE: agrupa por string igual, ignorando espaços/caixa).
export const resumoDaFolha = (pessoas: Pessoa[], dias: string[]) => {
  const map = new Map<string, { label: string; hn: number; he05: number; he10: number; he02: number }>();
  pessoas.forEach((p) => {
    const label = (p.cargo || '').trim() || '(sem cargo)';
    const key = normCargoKey(label);
    const t = totaisPessoa(p, dias);
    const cur = map.get(key) || { label, hn: 0, he05: 0, he10: 0, he02: 0 };
    map.set(key, { label: cur.label, hn: round2(cur.hn + t.hn), he05: round2(cur.he05 + t.he05), he10: round2(cur.he10 + t.he10), he02: round2(cur.he02 + t.he02) });
  });
  return Array.from(map.values()).map((v) => ({ cargo: v.label, hn: v.hn, he05: v.he05, he10: v.he10, he02: v.he02 }));
};

// Valor/hora do cargo. O resumo junta "SOLDADOR" e "Soldador" sob o rótulo de quem vem primeiro,
// então o valor gravado com a outra grafia também vale.
export const taxaDoCargo = (rates: Record<string, string>, cargo: string): string | undefined =>
  rates[cargo] ?? Object.entries(rates).find(([k]) => normCargoKey(k) === normCargoKey(cargo))?.[1];

// Custo por cargo (HN×v ; HE1,0×v×2 ; HE0,5×v×1,5 ; HE0,2×v×1,2 — adicional noturno, +20%).
export const custosDoResumo = (resumo: ReturnType<typeof resumoDaFolha>, rates: Record<string, string>) => resumo.map((r) => {
  const rate = num(taxaDoCargo(rates, r.cargo));
  const custoHN = round2(r.hn * rate);
  const custoHE10 = round2(r.he10 * rate * 2);
  const custoHE05 = round2(r.he05 * rate * 1.5);
  const custoHE02 = round2(r.he02 * rate * 1.2);
  return { ...r, rate, custoHN, custoHE10, custoHE05, custoHE02, total: round2(custoHN + custoHE10 + custoHE05 + custoHE02) };
});

export const totalDaFolha = (f: Folha) => round2(custosDoResumo(resumoDaFolha(f.pessoas, f.dias), f.rates).reduce((s, c) => s + c.total, 0));
