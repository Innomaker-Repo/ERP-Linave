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
  upsertContaReceberPorMedicao, garantirOcorrenciasContasFixas, proximaOcorrenciaAposPagamento, CP_STATUS,
  type OS, type Empresa, type FinTipo, type NfeSolicitacao, type ImpostosNfe,
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
    // Anexos da NOTA emitida, por solicitação de origem. Depois que a NFe é arquivada é
    // este arquivo (o PDF/XML da nota) que interessa na linha — sem isso a coluna Anexos
    // continuava mostrando só o documento da medição, e a nota emitida ficava invisível.
    const anexosEmitidos = new Map<string, string[]>();
    financeiro
      .filter((r) => r.tipo === 'nfe' && r.sourceId)
      .forEach((r) => anexosEmitidos.set(String(r.sourceId), Array.isArray(r.anexos) ? r.anexos : []));

    // A medição aprovada NÃO gera mais solicitação de NFe automaticamente — a solicitação é
    // feita manualmente no popup da Medição (evita a duplicidade "automática + manual").
    // Aqui só deriva o fluxo antigo de obra finalizada/arquivada (sem medição própria).
    const derived: NfeSolicitacao[] = obras.filter((o: any) => obraFinalizada(o)).map((obra: any) => {
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
        // URL do documento (não o nome): é o que torna o anexo clicável/baixável na tela.
        anexos: [
          ...docsMediacao(obra).map((d: any) => d?.url || d?.conteudo || d?.nome).filter(Boolean),
          ...(anexosEmitidos.get(id) || []),
        ],
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
        anexos: [...(r.anexos || []), ...(anexosEmitidos.get(r.id) || [])],
        contrato: r.contrato || r.os || '',
        derived: false,
        medicaoId: r.medicaoId || '',
        medicaoNumero: r.medicaoNumero || '',
      }));

    return [...derived, ...manual];
  }, [ctx.obras, ctx.os, financeiro]);

  // ----- Escrita (infra pronta) -----
  // Acrescenta um registro à coleção `financeiro`.
  const addRecord = async (record: FinRecord) => {
    const next = [{ ...record, createdAt: new Date().toISOString() }, ...financeiro];
    await ctx.saveEntity('financeiro', next);
  };

  // Solicitação de pagamento: usa o endpoint append-only, aberto a TODO usuário logado
  // (o replace-all de addRecord exige permissão do módulo Financeiro e o colaborador
  // comum levaria 403 ao enviar a solicitação).
  const addSolicitacao = async (record: FinRecord) => {
    await ctx.criarSolicitacaoFinanceiro(record);
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

  // Exclui um registro financeiro. Só remove o que foi pedido: a checagem por `parentId`
  // existe porque apagar uma conta mãe sem as filhas deixaria parcelas órfãs, invisíveis
  // na tela e ainda somando no total. A confirmação é responsabilidade de quem chama
  // (todas as telas usam confirmDialog antes).
  const deleteRecord = async (id: string) => {
    const alvo = financeiro.find((r) => r.id === id);
    if (!alvo) return;
    const next = financeiro.filter((r) => r.id !== id && !(alvo.type === 'parent' && r.parentId === id));
    await ctx.saveEntity('financeiro', next);
  };

  // Quantas linhas somem junto com o registro (mãe leva as parcelas filhas).
  const contarDependentes = (id: string): number => {
    const alvo = financeiro.find((r) => r.id === id);
    if (!alvo || alvo.type !== 'parent') return 0;
    return financeiro.filter((r) => r.parentId === id).length;
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
      natureza: sol.natureza || '',
      documento: sol.documento,
      valor: sol.valor,
      vencimento: sol.vencimento,
      banco: '',
      forma: sol.forma,
      status: 'Aberto',
      // Os anexos da solicitação (URLs /media/... dos documentos já persistidos) precisam
      // seguir para a Conta a Pagar: é o mesmo documento que o solicitante enviou e que
      // quem paga precisa consultar. Sem isso a conta nasce sem anexo e `contaTemDocumento`
      // retorna false, afetando o status e a liberação no estoque.
      anexos: Array.isArray(sol.anexos) ? sol.anexos : [],
      descricao: sol.descricao || '',
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

  // Rótulo do recebível gerado pela nota. O número é opcional na emissão (nem sempre já
  // saiu do emissor), então a referência precisa continuar legível sem ele.
  const referenciaNfe = (numero?: string) => {
    const n = String(numero || '').trim();
    return n ? `NF ${n}` : 'NF sem número';
  };

  // Preenche/corrige o número (e a data) de uma NFe já emitida. Atualiza junto a
  // referência da Conta a Receber que ela gerou — sem isso o recebível ficaria marcado
  // como "NF sem número" para sempre, mesmo depois de o número ser informado.
  const atualizarNfeEmitida = async (nfeId: string, patch: { numero?: string; emissao?: string }) => {
    const numero = String(patch.numero ?? '').trim();
    const referencia = referenciaNfe(numero);
    const next = financeiro.map((r) => {
      if (r.id === nfeId && r.tipo === 'nfe') {
        return { ...r, numero, ...(patch.emissao ? { emissao: patch.emissao } : {}) };
      }
      // O recebível guarda uma "fonte" por origem (NF de serviço, recibo de locação);
      // só a fonte desta nota muda, e a referência do topo é recomposta a partir delas.
      if (r.tipo === 'contaReceber' && Array.isArray(r.fontes) && r.fontes.some((f: any) => f?.id === nfeId)) {
        const fontes = r.fontes.map((f: any) => (f?.id === nfeId ? { ...f, referencia } : f));
        return {
          ...r,
          fontes,
          referencia: fontes.map((f: any) => f.referencia).filter(Boolean).join(' · '),
        };
      }
      return r;
    });
    await ctx.saveEntity('financeiro', next);
  };

  // Emite e arquiva a NFe: registra a NFe e cria a Conta a Receber (uma única escrita).
  const emitirNfe = async (
    sol: NfeSolicitacao,
    payload: {
      numero: string; emissao: string; original: number; liquido: number; baixado: number;
      vencimento: string; contrato: string; cliente: string; anexos?: string[];
      impostos?: ImpostosNfe;
    },
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
      anexos: payload.anexos || [],
      // Detalhamento do que foi retido nesta nota (alíquota + valor por imposto).
      impostos: payload.impostos || null,
      createdAt: now,
    };
    // A conta a receber da parte de SERVIÇO é mesclada por medição: se o recibo de locação da
    // mesma medição já criou (ou criar depois) um recebível, os dois somam num só.
    const next = upsertContaReceberPorMedicao([nfe, ...financeiro], {
      medicaoId: sol.medicaoId || '',
      medicaoNumero: sol.medicaoNumero || '',
      ordemServicoNumero: sol.os || '',
      empresa: sol.empresa,
      cliente: payload.cliente,
      origem: 'NFe',
      fonteId: nfe.id,
      valorOriginal: payload.original,
      valorLiquido: payload.liquido,
      vencimento: payload.vencimento,
      referencia: referenciaNfe(payload.numero),
      baixado: payload.baixado,
      impostos: payload.impostos,
    });
    await ctx.saveEntity('financeiro', next);
  };

  // Parcela uma conta a pagar: cria a conta mãe (valor total) e as parcelas filhas
  // (cada uma com vencimento, valor e status próprios) — numa única escrita.
  const parcelarConta = async (id: string, nParcelas: number, intervaloDias: number, dataInicio?: string) => {
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
        vencimento: days(dataInicio || src.vencimento || todayStr, intervaloDias * (i - 1)),
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

    // Conta fixa: quitar a competência atual é o que faz nascer a próxima. É assim que a
    // lista vira o histórico progressivo — uma linha paga por mês/semana/dia, em sequência,
    // e sempre uma única conta em aberto à frente.
    const paga = next.find((r) => r.id === id);
    const proximas = paga ? proximaOcorrenciaAposPagamento(next, paga) : [];

    await ctx.saveEntity('financeiro', [...proximas, ...next]);
    return proximas[0] || null;
  };

  // ----- Contas fixas (recorrentes) -----
  // Garante que cada regra ativa tenha UMA conta em aberto. Não adianta competências
  // futuras: quem cria a próxima é o pagamento da atual. Serve para a regra recém-criada
  // e para retomar o encadeamento quando a última ocorrência sumiu (pausa, exclusão).
  // Só escreve quando há algo novo — chamada na abertura da tela de Contas a Pagar.
  const sincronizarContasFixas = async (): Promise<number> => {
    const novas = garantirOcorrenciasContasFixas(financeiro);
    if (novas.length === 0) return 0;
    await ctx.saveEntity('financeiro', [...novas, ...financeiro]);
    return novas.length;
  };

  // Cria ou atualiza a REGRA. Ao editar, os dados são propagados para as ocorrências
  // futuras ainda não pagas (mudou o valor da luz? o mês que vem já sai corrigido), mas
  // nunca para as pagas nem para as vencidas — isso reescreveria histórico financeiro.
  const salvarContaFixa = async (regra: FinRecord) => {
    const existe = financeiro.some((r) => r.id === regra.id);
    const base = existe
      ? financeiro.map((r) => (r.id === regra.id ? { ...r, ...regra } : r))
      : [{ ...regra, createdAt: new Date().toISOString() }, ...financeiro];

    const next = base.map((r) => {
      const alvo = r.tipo === 'contaPagar'
        && r.contaFixaId === regra.id
        && r.status !== CP_STATUS.pago
        && String(r.vencimento || '') >= todayStr;
      if (!alvo) return r;
      return {
        ...r,
        empresa: regra.empresa,
        fornecedor: regra.fornecedor || regra.descricao,
        tipoPagamento: regra.categoria,
        contaFixaCategoria: regra.categoria,
        contaFixaPeriodicidade: regra.periodicidade,
        contaFixaDescricao: regra.descricao,
        natureza: regra.natureza || '',
        valor: num(regra.valor),
        forma: regra.forma || '',
        banco: regra.banco || '',
      };
    });
    await ctx.saveEntity('financeiro', next);
  };

  // Exclui a regra e as ocorrências futuras não pagas que ela havia gerado. As ocorrências
  // já pagas (e as vencidas) permanecem: são histórico financeiro, não configuração.
  const excluirContaFixa = async (id: string) => {
    const next = financeiro.filter((r) => {
      if (r.id === id) return false;
      const futuraNaoPaga = r.tipo === 'contaPagar'
        && r.contaFixaId === id
        && r.status !== CP_STATUS.pago
        && String(r.vencimento || '') >= todayStr;
      return !futuraNaoPaga;
    });
    await ctx.saveEntity('financeiro', next);
  };

  // Quantas ocorrências futuras não pagas somem junto com a regra (para a confirmação).
  const ocorrenciasFuturasDaFixa = (id: string): number =>
    financeiro.filter((r) => r.tipo === 'contaPagar' && r.contaFixaId === id
      && r.status !== CP_STATUS.pago && String(r.vencimento || '') >= todayStr).length;

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
    addRecord, addSolicitacao, updateRecords, updateRecord, deleteRecord, contarDependentes,
    addDepartamento, approveSolicitacao, rejectSolicitacao, emitirNfe, atualizarNfeEmitida,
    parcelarConta, pagarConta,
    // contas fixas (recorrentes)
    sincronizarContasFixas, salvarContaFixa, excluirContaFixa, ocorrenciasFuturasDaFixa,
  };
}
