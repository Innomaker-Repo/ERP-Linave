/* =========================================================================================
 * FINANCEIRO — Hook de dados
 * Leitura prioritária dos dados REAIS do ERP (useErp): OS, clientes, fornecedores,
 * departamentos, empresas prestadoras. Escrita apenas com a infra já pronta:
 *   - registros financeiros (solicitação, contas, NFe, bancos) na coleção `financeiro`
 *     do workspace, via saveEntity (não altera o schema do banco);
 *   - departamentos via saveListas.
 * =======================================================================================*/
import { useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import {
  mapOsToFinanceiro, obraFinalizada, docsMediacao, negocioValor, empresaFromCC, todayStr, days, num,
  type OS, type Empresa, type FinTipo, type NfeSolicitacao,
} from './finData';

export interface FinRecord {
  id: string;
  tipo: FinTipo;
  empresa?: Empresa | string;
  status?: string;
  createdAt?: string;
  [key: string]: any;
}

export function useFin() {
  const ctx = useErp() as any;

  // ----- Leitura (dados reais) -----
  // Mapa de negócios/obras por id, para resolver o valor do orçamento de cada OS
  // (a OS consolidada não carrega os valores; eles ficam no negócio vinculado).
  const obrasById = useMemo(() => {
    const map = new Map<string, any>();
    (Array.isArray(ctx.obras) ? ctx.obras : []).forEach((o: any) => {
      if (o?.id != null) map.set(String(o.id), o);
    });
    return map;
  }, [ctx.obras]);

  const oss: OS[] = useMemo(
    () => (Array.isArray(ctx.os) ? ctx.os.map((o: any) => mapOsToFinanceiro(o, obrasById.get(String(o?.obraId)))) : []),
    [ctx.os, obrasById],
  );

  const empresas: string[] = useMemo(() => {
    const lista = (ctx.config?.empresasPrestadoras || [])
      .filter((e: any) => e?.ativa !== false)
      .map((e: any) => e?.nome)
      .filter(Boolean);
    return lista.length ? lista : ['Linave', 'Servinave'];
  }, [ctx.config]);

  const departamentos: string[] = useMemo(
    () => (Array.isArray(ctx.listas?.departamentos) ? ctx.listas.departamentos : []),
    [ctx.listas],
  );

  const fornecedores: any[] = useMemo(
    () => (Array.isArray(ctx.fornecedores) ? ctx.fornecedores : []),
    [ctx.fornecedores],
  );

  const clientes: any[] = useMemo(
    () => (Array.isArray(ctx.clientes) ? ctx.clientes : []),
    [ctx.clientes],
  );

  // Registros financeiros guardados no workspace (discriminados por `tipo`).
  const financeiro: FinRecord[] = useMemo(
    () => (Array.isArray(ctx.financeiro) ? ctx.financeiro : []),
    [ctx.financeiro],
  );

  const records = (tipo: FinTipo): FinRecord[] => financeiro.filter((r) => r.tipo === tipo);

  // ----- NFe: solicitações (medição aprovada → solicitação de NFe) -----
  // Deriva, a partir dos negócios finalizados/medidos, as solicitações de NFe "Aguardando
  // emissão" (leitura real). Some quando a NFe correspondente já foi emitida e arquivada.
  const nfeSolicitacoes: NfeSolicitacao[] = useMemo(() => {
    const obras = Array.isArray(ctx.obras) ? ctx.obras : [];
    const osList = Array.isArray(ctx.os) ? ctx.os : [];
    const emitidasSources = new Set(
      financeiro.filter((r) => r.tipo === 'nfe').map((r) => r.sourceId).filter(Boolean),
    );

    const derived: NfeSolicitacao[] = obras.filter(obraFinalizada).map((obra: any) => {
      const osLinked = osList.find((o: any) => String(o?.obraId) === String(obra?.id));
      const osVm = osLinked ? mapOsToFinanceiro(osLinked, obra) : null;
      const id = `SNF-${obra?.id}`;
      const numeroOs = osVm?.numero || String(obra?.cc || obra?.id || '—');
      return {
        id,
        os: numeroOs,
        empresa: osVm?.empresa || empresaFromCC(numeroOs),
        cliente: osVm?.cliente || obra?.cliente || 'Cliente não informado',
        valor: osVm?.valor || negocioValor(obra),
        forma: '',
        dataEmitir: String(obra?.dataArquivamento || '').slice(0, 10) || todayStr,
        tipoNfe: 'NFe Serviço',
        status: emitidasSources.has(id) ? 'Emitida e arquivada' : 'Aguardando emissão',
        anexos: docsMediacao(obra).map((d: any) => d?.nome).filter(Boolean),
        contrato: numeroOs,
        derived: true,
      };
    });

    const manual: NfeSolicitacao[] = financeiro
      .filter((r) => r.tipo === 'nfeReq')
      .map((r) => ({
        id: r.id,
        os: r.os || '',
        empresa: (r.empresa as Empresa) || 'Linave',
        cliente: r.cliente || '',
        valor: r.valor || 0,
        forma: r.forma || '',
        dataEmitir: r.dataEmitir || todayStr,
        tipoNfe: r.tipoNfe || 'NFe Serviço',
        status: emitidasSources.has(r.id) ? 'Emitida e arquivada' : (r.status || 'Aguardando emissão'),
        anexos: r.anexos || [],
        contrato: r.contrato || r.os || '',
        derived: false,
      }));

    return [...derived, ...manual];
  }, [ctx.obras, ctx.os, financeiro]);

  // ----- Escrita (infra pronta) -----
  // Acrescenta um registro à coleção `financeiro`.
  const addRecord = async (record: FinRecord) => {
    const next = [{ ...record, createdAt: new Date().toISOString() }, ...financeiro];
    await ctx.saveEntity('financeiro', next);
  };

  // Atualiza registros financeiros por função de mapeamento.
  const updateRecords = async (mapFn: (r: FinRecord) => FinRecord) => {
    const next = financeiro.map(mapFn);
    await ctx.saveEntity('financeiro', next);
  };

  // Atualiza um registro específico por id (merge de campos).
  const updateRecord = async (id: string, patch: Partial<FinRecord>) => {
    await updateRecords((r) => (r.id === id ? { ...r, ...patch } : r));
  };

  // Aprova uma solicitação: marca como aprovada e cria a Conta a Pagar correspondente
  // (numa única escrita, para o estado ficar consistente).
  const approveSolicitacao = async (id: string) => {
    const sol = financeiro.find((r) => r.id === id);
    if (!sol) return;
    const now = new Date().toISOString();
    const contaPagar: FinRecord = {
      id: `CP-${Date.now().toString(36).toUpperCase()}`,
      tipo: 'contaPagar',
      origemSolicitacao: sol.id,
      type: 'single',
      empresa: sol.empresa,
      vinculoTipo: sol.vinculoTipo,
      vinculoValor: sol.vinculoValor,
      fornecedor: sol.fornecedor,
      tipoPagamento: sol.tipoPagamento,
      documento: sol.documento,
      valor: sol.valor,
      vencimento: sol.vencimento,
      banco: '',
      forma: sol.forma,
      status: 'Aberto',
      valorPago: 0,
      jurosPago: 0,
      comprovantes: [],
      createdAt: now,
    };
    const next = financeiro.map((r) => (r.id === id ? { ...r, status: 'Aprovado' } : r));
    await ctx.saveEntity('financeiro', [contaPagar, ...next]);
  };

  const rejectSolicitacao = async (id: string) => {
    await updateRecords((r) => (r.id === id ? { ...r, status: 'Reprovado' } : r));
  };

  // Emite e arquiva a NFe: registra a NFe e cria a Conta a Receber (uma única escrita).
  const emitirNfe = async (
    sol: NfeSolicitacao,
    payload: { numero: string; emissao: string; original: number; liquido: number; baixado: number; vencimento: string; contrato: string; cliente: string },
  ) => {
    const ts = Date.now().toString(36).toUpperCase();
    const now = new Date().toISOString();
    const nfe: FinRecord = {
      id: `NFE-${ts}`,
      tipo: 'nfe',
      sourceId: sol.id,
      empresa: sol.empresa,
      cliente: payload.cliente,
      numero: payload.numero,
      emissao: payload.emissao,
      original: payload.original,
      liquido: payload.liquido,
      vencimento: payload.vencimento,
      contrato: payload.contrato,
      createdAt: now,
    };
    const receber: FinRecord = {
      id: `CR-${ts}`,
      tipo: 'contaReceber',
      origem: 'NFe',
      empresa: sol.empresa,
      cliente: payload.cliente,
      referencia: payload.numero,
      valorOriginal: payload.original,
      valorLiquido: payload.liquido,
      vencimentoRecebimento: payload.vencimento,
      recebido: payload.baixado >= payload.liquido && payload.liquido > 0,
      dataRecebimento: '',
      valorRecebido: payload.baixado || 0,
      bancoRecebimento: '',
      createdAt: now,
    };
    await ctx.saveEntity('financeiro', [nfe, receber, ...financeiro]);
  };

  // Parcela uma conta a pagar: cria a conta mãe (valor total) e as parcelas filhas
  // (cada uma com vencimento, valor e status próprios) — numa única escrita.
  const parcelarConta = async (id: string, nParcelas: number, intervaloDias: number) => {
    const src = financeiro.find((r) => r.id === id);
    if (!src) return;
    const n = Math.max(2, Math.floor(nParcelas));
    const parentId = src.id;
    const resto = financeiro.filter((r) => r.id !== parentId && r.parentId !== parentId);
    const total = num(src.valor);
    const base = Math.floor((total / n) * 100) / 100;
    const sobra = Math.round((total - base * n) * 100) / 100;

    const mae: FinRecord = { ...src, type: 'parent', parentId: null, parcela: 'Mãe', totalParcelas: n, status: 'Parcelado', valorPago: 0, jurosPago: 0, comprovantes: [], dataPagamento: '' };
    const filhas: FinRecord[] = [];
    for (let i = 1; i <= n; i++) {
      filhas.push({
        ...src,
        id: `${parentId}-${String(i).padStart(2, '0')}`,
        type: 'child',
        parentId,
        parcela: `${i}/${n}`,
        totalParcelas: n,
        valor: i === n ? Math.round((base + sobra) * 100) / 100 : base,
        vencimento: days(src.vencimento || todayStr, intervaloDias * (i - 1)),
        status: 'Aberto',
        valorPago: 0,
        jurosPago: 0,
        comprovantes: [],
        dataPagamento: '',
      });
    }
    await ctx.saveEntity('financeiro', [mae, ...filhas, ...resto]);
  };

  // Paga uma conta (data real, banco, juros e comprovante). Se for parcela filha,
  // recalcula a conta mãe — quando todas as filhas estão pagas, a mãe vira "Pago".
  const pagarConta = async (
    id: string,
    p: { dataPagamento: string; valorPago: number; banco: string; houveJuros: boolean; jurosPago: number; motivoJuros: string; comprovantes: string[] },
  ) => {
    let parentId: string | null = null;
    let next = financeiro.map((r) => {
      if (r.id !== id) return r;
      parentId = r.parentId || null;
      return {
        ...r,
        status: 'Pago',
        dataPagamento: p.dataPagamento,
        valorPago: p.valorPago,
        banco: p.banco,
        houveJuros: p.houveJuros,
        jurosPago: p.jurosPago,
        motivoJuros: p.motivoJuros,
        comprovantes: p.comprovantes,
      };
    });

    if (parentId) {
      const kids = next.filter((r) => r.parentId === parentId);
      const todasPagas = kids.length > 0 && kids.every((k) => k.status === 'Pago');
      next = next.map((r) => {
        if (r.id !== parentId) return r;
        return {
          ...r,
          valorPago: kids.reduce((s, k) => s + num(k.valorPago), 0),
          jurosPago: kids.reduce((s, k) => s + num(k.jurosPago), 0),
          comprovantes: kids.flatMap((k) => k.comprovantes || []),
          status: todasPagas ? 'Pago' : 'Parcelado',
          dataPagamento: todasPagas ? p.dataPagamento : '',
        };
      });
    }
    await ctx.saveEntity('financeiro', next);
  };

  // Cadastra um departamento (lista real usada também em Usuários & Acessos).
  const addDepartamento = async (nome: string) => {
    const limpo = nome.trim();
    if (!limpo || departamentos.includes(limpo)) return;
    await ctx.saveListas({ ...(ctx.listas || {}), departamentos: [...departamentos, limpo] });
  };

  return {
    // leitura
    oss, empresas, departamentos, fornecedores, clientes, financeiro, records, nfeSolicitacoes,
    // escrita
    addRecord, updateRecords, updateRecord, addDepartamento, approveSolicitacao, rejectSolicitacao, emitirNfe,
    parcelarConta, pagarConta,
  };
}
