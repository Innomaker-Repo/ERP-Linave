import React, { useState } from 'react';
import { FinCard, Toolbar, DataTable, Th, Td, Btn, StatusTag, CompanyTag, Pill, EmptyRow, FinModal, Field, Textarea, Kpi, DeleteBtn } from '../finUi';
import { br, money, num } from '../finData';
import { useFin, type FinRecord } from '../useFin';
import { useFinFilters } from '../finFilters';

// Leitura real: solicitações guardadas na coleção `financeiro` (tipo 'solicitacao').
// Aprovar transforma a solicitação em Conta a Pagar (escrita via saveEntity).
export function AprovacoesView() {
  const { records, approveSolicitacao, rejectSolicitacao, deleteRecord } = useFin();
  const { match } = useFinFilters();
  const rows = records('solicitacao').filter(match);
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

  const abrirReprovar = (r: FinRecord) => { setMotivo(''); setReprovando(r); };

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
      <DataTable
        minWidth={1100}
        head={<>
          <Th>Solicitação</Th><Th>Empresa</Th><Th>Solicitante</Th><Th>Vínculo</Th>
          <Th>Fornecedor</Th><Th>Valor</Th><Th>Vencimento</Th><Th>Status</Th><Th>Ação</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow cols={9} text="Nenhuma solicitação enviada" />
        ) : rows.map((r) => (
          <tr key={r.id} className="transition-colors hover:bg-white/5">
            <Td className="font-black text-white">{r.id}</Td>
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
                {(r.status === 'Aguardando aprovação' || !r.status) && (
                  <>
                    <Btn small variant="green" disabled={busy === r.id} onClick={() => run(r.id, approveSolicitacao)}>Aprovar</Btn>
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

          {(detalhe.status === 'Aguardando aprovação' || !detalhe.status) && (
            <div className="mt-5 flex justify-end gap-2">
              <Btn variant="red" disabled={busy === detalhe.id} onClick={() => abrirReprovar(detalhe)}>Reprovar</Btn>
              <Btn variant="green" disabled={busy === detalhe.id} onClick={() => run(detalhe.id, approveSolicitacao).then(() => setDetalhe(null))}>Aprovar → Conta a Pagar</Btn>
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
