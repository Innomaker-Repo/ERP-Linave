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
import { comFinanceiroAtual } from '../../../../services/financeiroSeguro';
import {
  mapOsToFinanceiro, todayStr, days, num,
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

  // ----- NFe: solicitações (leitura real, só registros de verdade) -----
  // A medição aprovada NÃO gera solicitação de NFe automaticamente — a solicitação é
  // feita manualmente no popup da Medição ou pelo botão "Solicitar NFe" (evita a
  // duplicidade "automática + manual"). Existia aqui também um fallback que DERIVAVA uma
  // solicitação "fantasma" (id `SNF-<id do negócio>`, nunca gravada em `financeiro`) para
  // todo negócio finalizado/arquivado sem medição própria — removido: além de duplicar a
  // linha de negócios que já tinham pedido manual, o id derivado (ex.: "SNF-LN-0002/26")
  // não existe no banco, então não dava pra rastrear, editar ou excluir feito registro de
  // verdade. Negócio antigo finalizado que ainda precise de NFe deve ser solicitado pelo
  // botão "Solicitar NFe" (cria um registro real, com id e histórico).
  const nfeSolicitacoes: NfeSolicitacao[] = useMemo(() => {
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

    return financeiro
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
        medicaoId: r.medicaoId || '',
        medicaoNumero: r.medicaoNumero || '',
      }));
  }, [financeiro]);

  // ----- Escrita (infra pronta) -----
  // Toda escrita aqui é replace-all: o array final substitui a tabela inteira no servidor.
  // `comFinanceiroAtual` (services/financeiroSeguro.ts, compartilhada com outras telas que
  // também escrevem em `financeiro` fora deste hook) busca o estado mais recente do servidor
  // primeiro — nunca usa o `financeiro` do contexto (carregado no login) como base — e aborta
  // com aviso ao usuário se a busca ou a gravação falharem, em vez de seguir com dado
  // incompleto (a causa raiz de um apagão real de dados que já aconteceu).

  // Acrescenta um registro à coleção `financeiro`.
  const addRecord = async (record: FinRecord) => {
    await comFinanceiroAtual(async (base) => {
      const next = [{ ...record, createdAt: new Date().toISOString() }, ...base];
      await ctx.saveEntity('financeiro', next);
    });
  };

  // Solicitação de pagamento: usa o endpoint append-only, aberto a TODO usuário logado
  // (o replace-all de addRecord exige permissão do módulo Financeiro e o colaborador
  // comum levaria 403 ao enviar a solicitação).
  const addSolicitacao = async (record: FinRecord) => {
    await ctx.criarSolicitacaoFinanceiro(record);
  };

  // Atualiza registros financeiros por função de mapeamento. Devolve se a gravação
  // realmente aconteceu — comFinanceiroAtual engole erro (403 de permissão, rede caída
  // etc.) e só avisa por toast, então quem chama precisa saber que falhou pra não seguir
  // como se tivesse dado certo (ex.: fechar um formulário de edição que não foi salvo).
  const updateRecords = async (mapFn: (r: FinRecord) => FinRecord): Promise<boolean> => {
    const resultado = await comFinanceiroAtual(async (base) => {
      const next = base.map(mapFn);
      await ctx.saveEntity('financeiro', next);
      return true;
    });
    return resultado === true;
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
    await comFinanceiroAtual(async (base) => {
      const alvo = base.find((r) => r.id === id);
      if (!alvo) return;
      const next = base.filter((r) => r.id !== id && !(alvo.type === 'parent' && r.parentId === id));
      await ctx.saveEntity('financeiro', next);
    });
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
    await comFinanceiroAtual(async (base) => {
      const sol = base.find((r) => r.id === id);
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
      const next = base.map((r) => (r.id === id ? { ...r, status: 'Aprovado' } : r));
      await ctx.saveEntity('financeiro', [contaPagar, ...next]);
    });
  };

  const rejectSolicitacao = async (id: string, motivo?: string) => {
    await updateRecords((r) => (r.id === id ? { ...r, status: 'Reprovado', motivoReprovacao: motivo || '' } : r));
  };

  // Reenvia uma solicitação reprovada: o próprio solicitante corrige os dados e ela volta
  // para a fila de aprovação, como se fosse enviada agora — sem precisar criar um registro novo
  // (mantém o mesmo id e o anexo já enviado, a menos que troque).
  const reenviarSolicitacao = async (id: string, patch: Partial<FinRecord>): Promise<boolean> =>
    updateRecords((r) => (r.id === id
      ? { ...r, ...patch, status: 'Aguardando aprovação', motivoReprovacao: '' }
      : r));

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
    await comFinanceiroAtual(async (base) => {
      const next = base.map((r) => {
        if (r.id === nfeId && r.tipo === 'nfe') {
          return { ...r, numero, ...(patch.emissao ? { emissao: patch.emissao } : {}) };
        }
        // O recebível guarda uma "fonte" por origem (NF de serviço, recibo de locação);
        // só a fonte desta nota muda, e a referência/emissão do topo são recompostas a partir delas.
        if (r.tipo === 'contaReceber' && Array.isArray(r.fontes) && r.fontes.some((f: any) => f?.id === nfeId)) {
          const fontes = r.fontes.map((f: any) =>
            (f?.id === nfeId ? { ...f, referencia, ...(patch.emissao ? { emissao: patch.emissao } : {}) } : f));
          return {
            ...r,
            fontes,
            referencia: fontes.map((f: any) => f.referencia).filter(Boolean).join(' · '),
            emissaoNfe: fontes.find((f: any) => f.origem === 'NFe')?.emissao || r.emissaoNfe || '',
          };
        }
        return r;
      });
      await ctx.saveEntity('financeiro', next);
    });
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
    await comFinanceiroAtual(async (base) => {
      const next = upsertContaReceberPorMedicao([nfe, ...base], {
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
        emissao: payload.emissao,
      });
      await ctx.saveEntity('financeiro', next);
    });
  };

  // Parcela uma conta a pagar: cria a conta mãe (valor total) e as parcelas filhas
  // (cada uma com vencimento, valor e status próprios) — numa única escrita.
  const parcelarConta = async (id: string, nParcelas: number, intervaloDias: number, dataInicio?: string) => {
    await comFinanceiroAtual(async (listaAtual) => {
      const src = listaAtual.find((r) => r.id === id);
      if (!src) return;
      const n = Math.max(2, Math.floor(nParcelas));
      const parentId = src.id;
      const resto = listaAtual.filter((r) => r.id !== parentId && r.parentId !== parentId);
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
    });
  };

  // Paga uma conta (data real, banco, juros e comprovante). Se for parcela filha,
  // recalcula a conta mãe — quando todas as filhas estão pagas, a mãe vira "Pago".
  const pagarConta = async (
    id: string,
    p: { dataPagamento: string; valorPago: number; banco: string; houveJuros: boolean; jurosPago: number; motivoJuros: string; comprovantes: string[] },
  ) => {
    return comFinanceiroAtual(async (listaAtual) => {
      let parentId: string | null = null;
      let next = listaAtual.map((r) => {
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
    });
  };

  // ----- Contas fixas (recorrentes) -----
  // Garante que cada regra ativa tenha UMA conta em aberto. Não adianta competências
  // futuras: quem cria a próxima é o pagamento da atual. Serve para a regra recém-criada
  // e para retomar o encadeamento quando a última ocorrência sumiu (pausa, exclusão).
  // Só escreve quando há algo novo — chamada na abertura da tela de Contas a Pagar.
  const sincronizarContasFixas = async (): Promise<number> => {
    const resultado = await comFinanceiroAtual(async (listaAtual) => {
      const novas = garantirOcorrenciasContasFixas(listaAtual);
      if (novas.length === 0) return 0;
      await ctx.saveEntity('financeiro', [...novas, ...listaAtual]);
      return novas.length;
    });
    return resultado ?? 0;
  };

  // Cria ou atualiza a REGRA. Ao editar, os dados são propagados para as ocorrências
  // futuras ainda não pagas (mudou o valor da luz? o mês que vem já sai corrigido), mas
  // nunca para as pagas nem para as vencidas — isso reescreveria histórico financeiro.
  const salvarContaFixa = async (regra: FinRecord) => {
    await comFinanceiroAtual(async (listaAtual) => {
      const existe = listaAtual.some((r) => r.id === regra.id);
      const base = existe
        ? listaAtual.map((r) => (r.id === regra.id ? { ...r, ...regra } : r))
        : [{ ...regra, createdAt: new Date().toISOString() }, ...listaAtual];

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
    });
  };

  // Exclui a regra e as ocorrências futuras não pagas que ela havia gerado. As ocorrências
  // já pagas (e as vencidas) permanecem: são histórico financeiro, não configuração.
  const excluirContaFixa = async (id: string) => {
    await comFinanceiroAtual(async (listaAtual) => {
      const next = listaAtual.filter((r) => {
        if (r.id === id) return false;
        const futuraNaoPaga = r.tipo === 'contaPagar'
          && r.contaFixaId === id
          && r.status !== CP_STATUS.pago
          && String(r.vencimento || '') >= todayStr;
        return !futuraNaoPaga;
      });
      await ctx.saveEntity('financeiro', next);
    });
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
    userSession: ctx.userSession,
    pendingEditSolicitacaoId: ctx.pendingEditSolicitacaoId,
    setPendingEditSolicitacaoId: ctx.setPendingEditSolicitacaoId,
    // escrita
    addRecord, addSolicitacao, updateRecords, updateRecord, deleteRecord, contarDependentes,
    addDepartamento, approveSolicitacao, rejectSolicitacao, reenviarSolicitacao, emitirNfe, atualizarNfeEmitida,
    parcelarConta, pagarConta,
    // contas fixas (recorrentes)
    sincronizarContasFixas, salvarContaFixa, excluirContaFixa, ocorrenciasFuturasDaFixa,
  };
}
