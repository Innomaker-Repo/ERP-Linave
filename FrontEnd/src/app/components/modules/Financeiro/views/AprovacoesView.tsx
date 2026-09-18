import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { FinCard, Toolbar, DataTable, Th, Td, Btn, StatusTag, CompanyTag, Pill, EmptyRow, FinModal, Field, Textarea, Kpi, DeleteBtn } from '../finUi';
import { br, money, num } from '../finData';
import { useFin, type FinRecord } from '../useFin';
import { useFinFilters } from '../finFilters';
import { promptDialog } from '../../../ui/feedback';
import { toast } from 'sonner';

// Sem acento/maiúscula — pra "atlantic" achar "Atlantic Náutica Ltda.".
const normalizar = (v: any): string =>
  String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const STATUS_FILTROS_APROVACAO = ['Todos', 'Aguardando aprovação', 'Aprovado', 'Reprovado'] as const;
type StatusFiltroAprovacao = typeof STATUS_FILTROS_APROVACAO[number];

// Leitura real: solicitações guardadas na coleção `financeiro` (tipo 'solicitacao').
// Aprovar transforma a solicitação em Conta a Pagar (escrita via saveEntity).
export function AprovacoesView() {
  const { records, approveSolicitacao, rejectSolicitacao, deleteRecord, updateRecord, userSession } = useFin();
  const { match } = useFinFilters();
  // Busca por fornecedor: um campo próprio desta tela, à parte dos filtros globais (Empresa/
  // Banco/Período) — funciona em cima do que já passou por eles, então acha a solicitação do
  // fornecedor não importa qual empresa esteja selecionada lá em cima (ou nenhuma).
  const [buscaFornecedor, setBuscaFornecedor] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltroAprovacao>('Todos');
  const rows = useMemo(() => {
    const termo = normalizar(buscaFornecedor);
    return records('solicitacao')
      .filter(match)
      .filter((r) => !termo || normalizar(r.fornecedor).includes(termo))
      .filter((r) => statusFiltro === 'Todos' || (r.status || 'Aguardando aprovação') === statusFiltro);
  }, [records, match, buscaFornecedor, statusFiltro]);
  // Autorizar (aprovar/reprovar) é ato de gerência — usuário comum só solicita.
  const isGerencia = ['ADMIN', 'GERENTE'].includes(String(userSession?.role || '').toUpperCase());
  const [busy, setBusy] = useState('');
  const [detalhe, setDetalhe] = useState<FinRecord | null>(null);
  // Reprovação pede um motivo (opcional) antes de confirmar — o solicitante vê esse texto
  // quando for corrigir e reenviar a solicitação.
  const [reprovando, setReprovando] = useState<FinRecord | null>(null);
  const [motivo, setMotivo] = useState('');

  const run = async (id: string, fn: (id: string) => Promise<void>) => {
    setBusy(id);
    try { await fn(id); } finally { setBusy(''); }
  };

  // Regra: aprovar ou reprovar uma solicitação sem nº de boleto/NF pede o número na hora —
  // só segue (e persiste na solicitação) se o usuário informar; cancelar aborta em silêncio.
  const garantirDocumento = async (r: FinRecord): Promise<boolean> => {
    const docAtual = String(r.documento || '').trim();
    if (docAtual) return true;
    const digitado = await promptDialog({
      title: 'Nº do boleto/Nota Fiscal obrigatório',
      message: 'Esta solicitação ainda não tem nº de boleto/Nota Fiscal. Informe antes de continuar.',
      placeholder: 'Nº do boleto/NF',
      confirmText: 'Confirmar',
    });
    const doc = (digitado || '').trim();
    if (!doc) {
      toast.error('É obrigatório informar o nº do boleto/Nota Fiscal.');
      return false;
    }
    await updateRecord(r.id, { documento: doc });
    return true;
  };

  const abrirReprovar = async (r: FinRecord) => {
    if (!(await garantirDocumento(r))) return;
    setMotivo('');
    setReprovando(r);
  };

  const aprovar = async (r: FinRecord): Promise<boolean> => {
    if (!(await garantirDocumento(r))) return false;
    await run(r.id, approveSolicitacao);
    return true;
  };

  const confirmarReprovar = async () => {
    if (!reprovando) return;
    setBusy(reprovando.id);
    try {
      await rejectSolicitacao(reprovando.id, motivo.trim());
      setReprovando(null);
      setDetalhe(null);
    } finally {
      setBusy('');
    }
  };

  return (
    <FinCard>
      <Toolbar title="Aprovações" hint="Aprovar transforma a solicitação em Conta a Pagar." />

      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" size={16} />
        <input
          type="text"
          value={buscaFornecedor}
          onChange={(e) => setBuscaFornecedor(e.target.value)}
          placeholder="Buscar por fornecedor..."
          className="w-full rounded-xl border border-white/10 bg-[#0b1220] py-2.5 pl-10 pr-9 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-amber-500/50"
        />
        {buscaFornecedor && (
          <button
            onClick={() => setBuscaFornecedor('')}
            title="Limpar busca"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/30 transition-colors hover:bg-white/10 hover:text-white/70"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-white/30">Status</span>
        {STATUS_FILTROS_APROVACAO.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFiltro(s)}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all active:scale-95 ${
              statusFiltro === s
                ? 'border-amber-400/60 bg-amber-500/20 text-amber-200 shadow-sm shadow-amber-500/10'
                : 'border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <DataTable
        minWidth={1100}
        head={<>
          <Th>Empresa</Th><Th>Solicitante</Th><Th>Vínculo</Th>
          <Th>Fornecedor</Th><Th>Valor</Th><Th>Vencimento</Th><Th>Status</Th><Th>Ação</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow
            cols={8}
            text={
              buscaFornecedor
                ? `Nenhuma solicitação encontrada para "${buscaFornecedor}"`
                : statusFiltro !== 'Todos'
                  ? `Nenhuma solicitação com status "${statusFiltro}"`
                  : 'Nenhuma solicitação enviada'
            }
          />
        ) : rows.map((r) => (
          <tr key={r.id} className="transition-colors hover:bg-white/5">
            <Td><CompanyTag empresa={String(r.empresa)} /></Td>
            <Td className="text-white">{r.solicitante}</Td>
            <Td className="text-white/60">{r.vinculoTipo}: {r.vinculoValor || '—'}</Td>
            <Td className="text-white">{r.fornecedor}</Td>
            <Td className="font-bold text-white">{money(num(r.valor))}</Td>
            <Td>{br(r.vencimento)}</Td>
            <Td><StatusTag status={r.status || 'Aguardando aprovação'} /></Td>
            <Td>
              <div className="flex gap-2">
                <Btn small variant="secondary" onClick={() => setDetalhe(r)}>Ver mais</Btn>
                {(r.status === 'Aguardando aprovação' || !r.status) && isGerencia && (
                  <>
                    <Btn small variant="green" disabled={busy === r.id} onClick={() => aprovar(r)}>Aprovar</Btn>
                    <Btn small variant="red" disabled={busy === r.id} onClick={() => abrirReprovar(r)}>Reprovar</Btn>
                  </>
                )}
                <DeleteBtn
                  titulo="Excluir solicitação de pagamento"
                  descricao={
                    `${r.id} — ${r.solicitante || 'sem solicitante'} — ${r.fornecedor || 'sem fornecedor'} — ${money(num(r.valor))}`
                    + (r.status === 'Aprovado'
                      ? '\n\nATENÇÃO: esta solicitação já foi APROVADA. A Conta a Pagar gerada por ela NÃO é excluída junto — remova-a na tela de Contas a Pagar, se for o caso.'
                      : '\n\nOs documentos anexados continuam guardados, mas deixam de ser acessíveis por esta solicitação.')
                  }
                  onConfirm={() => deleteRecord(r.id)}
                />
              </div>
            </Td>
          </tr>
        ))}
      </DataTable>

      {/* MODAL: Ver mais (dados completos, anexos e observações) */}
      {detalhe && (
        <FinModal title={`Solicitação ${detalhe.id}`} hint="Dados completos da solicitação." onClose={() => setDetalhe(null)}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Kpi label="Empresa" value={String(detalhe.empresa)} />
            <Kpi label="Solicitante" value={detalhe.solicitante || '—'} />
            <Kpi label="Tipo" value={detalhe.tipoPagamento || '—'} />
            <Kpi label="Valor" value={money(num(detalhe.valor))} />
            <Kpi label="Vencimento" value={br(detalhe.vencimento)} />
            <Kpi label="Data compra" value={br(detalhe.compra)} />
          </div>

          <div className="mt-4 space-y-2 rounded-2xl border border-white/5 bg-[#0b1220] p-4 text-sm">
            <p><span className="text-white/40">Vínculo:</span> <span className="text-white/85">{detalhe.vinculoTipo}: {detalhe.vinculoValor || '—'}</span></p>
            <p><span className="text-white/40">Fornecedor / beneficiário:</span> <span className="text-white/85">{detalhe.fornecedor || '—'}</span></p>
            <p><span className="text-white/40">Documento:</span> <span className="text-white/85">{detalhe.documento || '—'}</span></p>
            <p><span className="text-white/40">Forma solicitada:</span> <span className="text-white/85">{detalhe.forma || '—'}</span></p>
            <p><span className="text-white/40">Status:</span> <span className="text-white/85">{detalhe.status || 'Aguardando aprovação'}</span></p>
            {detalhe.status === 'Reprovado' && detalhe.motivoReprovacao && (
              <p><span className="text-white/40">Motivo da reprovação:</span> <span className="text-rose-200">{detalhe.motivoReprovacao}</span></p>
            )}
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-white/40">Anexos</p>
            {(detalhe.anexos || []).length ? (
              <div className="flex flex-wrap gap-2">
                {(detalhe.anexos as string[]).map((a, i) => {
                  const ehUrl = /^(https?:|\/media\/)/.test(String(a));
                  const nome = ehUrl ? decodeURIComponent(String(a).split('/').pop() || 'documento') : String(a);
                  return ehUrl ? (
                    <a key={i} href={a} target="_blank" rel="noopener noreferrer" className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/20">📄 {nome}</a>
                  ) : (
                    <span key={i} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/70">📄 {nome}</span>
                  );
                })}
              </div>
            ) : <p className="text-sm text-white/40">Nenhum anexo.</p>}
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-white/40">Descrição / Observações</p>
            <p className="rounded-2xl border border-white/5 bg-[#0b1220] p-4 text-sm text-white/75">{detalhe.descricao || '—'}</p>
          </div>

          {(detalhe.status === 'Aguardando aprovação' || !detalhe.status) && isGerencia && (
            <div className="mt-5 flex justify-end gap-2">
              <Btn variant="red" disabled={busy === detalhe.id} onClick={() => abrirReprovar(detalhe)}>Reprovar</Btn>
              <Btn variant="green" disabled={busy === detalhe.id} onClick={() => aprovar(detalhe).then((ok) => { if (ok) setDetalhe(null); })}>Aprovar → Conta a Pagar</Btn>
            </div>
          )}
        </FinModal>
      )}

      {/* MODAL: Reprovar (motivo opcional, visível pro solicitante ao reeditar) */}
      {reprovando && (
        <FinModal title={`Reprovar ${reprovando.id}`} hint="O motivo é opcional, mas ajuda o solicitante a corrigir e reenviar." onClose={() => setReprovando(null)}>
          <Field label="Motivo da reprovação (opcional)" span={12}>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: faltou anexar a nota fiscal, valor divergente..." />
          </Field>
          <div className="mt-5 flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setReprovando(null)}>Cancelar</Btn>
            <Btn variant="red" disabled={busy === reprovando.id} onClick={confirmarReprovar}>Confirmar reprovação</Btn>
          </div>
        </FinModal>
      )}
    </FinCard>
  );
}
