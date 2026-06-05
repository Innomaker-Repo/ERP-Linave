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
import { mapOsToFinanceiro, type OS, type Empresa, type FinTipo } from './finData';

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
  const oss: OS[] = useMemo(
    () => (Array.isArray(ctx.os) ? ctx.os.map(mapOsToFinanceiro) : []),
    [ctx.os],
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

  // Cadastra um departamento (lista real usada também em Usuários & Acessos).
  const addDepartamento = async (nome: string) => {
    const limpo = nome.trim();
    if (!limpo || departamentos.includes(limpo)) return;
    await ctx.saveListas({ ...(ctx.listas || {}), departamentos: [...departamentos, limpo] });
  };

  return {
    // leitura
    oss, empresas, departamentos, fornecedores, clientes, financeiro, records,
    // escrita
    addRecord, updateRecords, addDepartamento, approveSolicitacao, rejectSolicitacao,
  };
}
