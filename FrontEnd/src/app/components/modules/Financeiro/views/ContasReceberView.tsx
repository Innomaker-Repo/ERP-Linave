import React, { useMemo, useState } from 'react';
import { Save, Download, FileText, Eye } from 'lucide-react';
import {
  FinCard, Toolbar, DataTable, Th, Td, Btn, StatusTag, CompanyTag, AlertBar, InfoBar, EmptyRow,
  FinModal, Field, Input, MoneyInput, Select, Textarea, ImpostosPanel, DeleteBtn,
} from '../finUi';
import {
  br, money, num, isOld, todayStr, download,
  IMPOSTOS_NFE, IMPOSTO_LABEL, impostosDoRegistro,
} from '../finData';
import { useFin, type FinRecord } from '../useFin';
import { useFinFilters } from '../finFilters';
import { useFinNavigate, FIN_SECTIONS } from '../finNav';

const status = (r: any) => (r.recebido ? 'Recebido' : isOld(r.vencimentoRecebimento) ? 'Vencido' : 'A receber');

// Dropdown de banco (hoisted: componente estável para não remontar os inputs do modal).
function BancoSelect({ value, onChange, bancos }: { value: string; onChange: (v: string) => void; bancos: string[] }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{bancos.length ? 'Selecione o banco...' : 'Nenhum banco cadastrado'}</option>
      {bancos.map((b) => <option key={b}>{b}</option>)}
    </Select>
  );
}

// Leitura/escrita reais: recebíveis em `financeiro` (tipo 'contaReceber').
//
// A CRIAÇÃO É SEMPRE PELA NFe. O lançamento manual foi removido de propósito: um recebível
// criado à mão nasce sem nota, sem impostos retidos e sem vínculo com a medição, e depois
// aparece em duplicidade quando a NFe daquele serviço é emitida de verdade. Quem precisa de
// um recebível novo solicita a NFe; ao emitir e arquivar, a conta a receber é criada com o
// valor original, os impostos e o líquido corretos.
export function ContasReceberView() {
  const { records, updateRecord, deleteRecord } = useFin();
  const { match } = useFinFilters();
  const navegar = useFinNavigate();
  const rows = records('contaReceber').filter(match);
  const bancos = records('banco').map((b) => b.nome).filter(Boolean) as string[];
  const vencidas = useMemo(() => rows.filter((r) => status(r) === 'Vencido'), [rows]);
  const [salvando, setSalvando] = useState(false);

  // Modal de detalhes (somente leitura, com o detalhamento dos impostos).
  const [detalhe, setDetalhe] = useState<FinRecord | null>(null);

  // Modal de edição do recebimento.
  const [editando, setEditando] = useState<FinRecord | null>(null);
  const [ed, setEd] = useState({ recebido: 'Não', dataRecebimento: '', valorRecebido: '', bancoRecebimento: '', vencimentoRecebimento: todayStr, observacao: '' });
  const setEdF = (k: string, v: string) => setEd((p) => ({ ...p, [k]: v }));

  const abrirEdicao = (r: FinRecord) => {
    setEditando(r);
    setEd({
      recebido: r.recebido ? 'Sim' : 'Não',
      dataRecebimento: r.dataRecebimento || '',
      valorRecebido: String(r.valorRecebido || r.valorLiquido || ''),
      bancoRecebimento: r.bancoRecebimento || '',
      vencimentoRecebimento: r.vencimentoRecebimento || todayStr,
      observacao: r.observacao || '',
    });
  };

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    setSalvando(true);
    try {
      const recebido = ed.recebido === 'Sim';
      await updateRecord(editando.id, {
        recebido,
        dataRecebimento: recebido ? ed.dataRecebimento : '',
        valorRecebido: recebido ? num(ed.valorRecebido) : 0,
        bancoRecebimento: ed.bancoRecebimento,
        vencimentoRecebimento: ed.vencimentoRecebimento,
        observacao: ed.observacao,
      });
      setEditando(null);
    } finally {
      setSalvando(false);
    }
  };

  // Texto da confirmação de exclusão. Recebível vindo de NFe merece um aviso mais forte:
  // a nota fiscal continua arquivada, então some o controle de recebimento mas não o
  // documento fiscal — e ele não é recriado sozinho.
  const descricaoExclusao = (r: FinRecord): string => {
    const base = `${r.id} — ${r.cliente || 'sem cliente'} — ${money(num(r.valorLiquido ?? r.valor))}`;
    const daNfe = String(r.origem || '').includes('NFe') || String(r.origem || '').includes('Recibo');
    return daNfe
      ? `${base}\n\nEste recebível veio de ${r.origem} (${r.referencia || 'sem referência'}). A nota fiscal continua arquivada na tela de NFe, mas o controle de recebimento será perdido e NÃO é recriado automaticamente.`
      : `${base}\n\nLançamento manual antigo. Será removido do controle de recebimentos.`;
  };

  // Resumo em CSV do que está na tela (respeita os filtros), com linha de TOTAL ao final.
  // Traz valor original, cada imposto retido e o total — é o que o contador precisa para
  // conferir a retenção sem abrir nota por nota.
  const exportarCsv = () => {
    const head = [
      'Origem', 'Empresa', 'Cliente', 'Referência', 'Valor original',
      ...IMPOSTOS_NFE.map((k) => `${IMPOSTO_LABEL[k]} (R$)`),
      'Total impostos', 'Valor líquido', 'Vencimento', 'Recebido?', 'Data receb.', 'Valor recebido', 'Banco', 'Status',
    ];
    const linhas: any[][] = rows.map((r) => {
      const imp = impostosDoRegistro(r);
      return [
        r.origem || 'Manual', r.empresa, r.cliente, r.referencia || '',
        num(r.valorOriginal ?? r.valor),
        ...IMPOSTOS_NFE.map((k) => num(imp?.valores?.[k])),
        num(imp?.total),
        num(r.valorLiquido ?? r.valor), r.vencimentoRecebimento || '',
        r.recebido ? 'Sim' : 'Não', r.dataRecebimento || '', num(r.valorRecebido), r.bancoRecebimento || '', status(r),
      ];
    });
    const soma = (fn: (r: any) => number) => rows.reduce((s, r) => s + fn(r), 0);
    linhas.push([
      'TOTAL', '', '', '',
      soma((r) => num(r.valorOriginal ?? r.valor)),
      ...IMPOSTOS_NFE.map((k) => soma((r) => num(impostosDoRegistro(r)?.valores?.[k]))),
      soma((r) => num(impostosDoRegistro(r)?.total)),
      soma((r) => num(r.valorLiquido ?? r.valor)),
      '', '', '', soma((r) => num(r.valorRecebido)), '', '',
    ]);
    const csv = [head, ...linhas].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    download(csv, 'contas_a_receber.csv', 'text/csv;charset=utf-8');
  };

  return (
    <FinCard>
      <Toolbar
        title="Contas a Receber"
        hint="Valores a receber dos clientes. O banco é definido aqui, no recebimento."
        actions={<>
          <Btn variant="secondary" onClick={exportarCsv}><Download size={15} /> Exportar CSV</Btn>
          <Btn variant="amber" onClick={() => navegar(FIN_SECTIONS.nfe)}><FileText size={15} /> Solicitar NFe</Btn>
        </>}
      />

      <InfoBar>
        <strong className="font-black">A conta a receber não é lançada aqui.</strong> Ela é criada
        automaticamente quando a NFe é emitida e arquivada — já com o valor original, os impostos
        retidos e o líquido corretos. Para gerar um novo recebível, solicite a nota fiscal em{' '}
        <button onClick={() => navegar(FIN_SECTIONS.nfe)} className="font-black text-amber-300 underline underline-offset-2 hover:text-amber-200">
          Solicitações e Emissão de NFe
        </button>.
      </InfoBar>

      {vencidas.length > 0 && (
        <AlertBar>⚠️ Existem {vencidas.length} conta(s) a receber vencida(s): vencimento anterior a hoje e ainda não recebido.</AlertBar>
      )}

      <DataTable
        minWidth={1600}
        head={<>
          <Th>Origem</Th><Th>Empresa</Th><Th>Cliente</Th><Th>Referência</Th><Th>Original</Th><Th>Impostos</Th><Th>Líquido</Th>
          <Th>Vencimento</Th><Th>Recebido?</Th><Th>Data receb.</Th><Th>Valor recebido</Th><Th>Banco</Th><Th>Status</Th><Th>Ação</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow cols={14} text="Nenhuma conta a receber no período (emita uma NFe para gerar)" />
        ) : rows.map((r) => {
          const st = status(r);
          const imp = impostosDoRegistro(r);
          return (
            <tr key={r.id} className={`transition-colors hover:bg-white/5 ${st === 'Vencido' ? 'bg-rose-500/[0.06]' : ''}`}>
              <Td>{r.origem || 'Manual'}</Td>
              <Td><CompanyTag empresa={String(r.empresa)} /></Td>
              <Td className="text-white">{r.cliente}</Td>
              <Td className="text-white/60">{r.referencia || '—'}</Td>
              <Td>{money(num(r.valorOriginal ?? r.valor))}</Td>
              <Td className={imp ? 'text-rose-300' : 'text-white/30'}>{imp ? `- ${money(imp.total)}` : '—'}</Td>
              <Td className="font-bold text-white">{money(num(r.valorLiquido ?? r.valor))}</Td>
              <Td className={st === 'Vencido' ? 'font-bold text-rose-300' : ''}>{br(r.vencimentoRecebimento)}</Td>
              <Td>{r.recebido ? 'Sim' : 'Não'}</Td>
              <Td>{r.dataRecebimento ? br(r.dataRecebimento) : '-'}</Td>
              <Td>{r.valorRecebido ? money(num(r.valorRecebido)) : '-'}</Td>
              <Td className="text-white/60">{r.bancoRecebimento || '—'}</Td>
              <Td><StatusTag status={st} /></Td>
              <Td>
                <div className="flex items-center gap-2">
                  <Btn small variant="secondary" onClick={() => setDetalhe(r)}><Eye size={13} /> Detalhes</Btn>
                  <Btn small variant="amber" onClick={() => abrirEdicao(r)}>Editar recebimento</Btn>
                  <DeleteBtn
                    titulo="Excluir conta a receber"
                    descricao={descricaoExclusao(r)}
                    onConfirm={() => deleteRecord(r.id)}
                  />
                </div>
              </Td>
            </tr>
          );
        })}
      </DataTable>

      {/* MODAL: detalhes (somente leitura) */}
      {detalhe && (
        <FinModal
          wide
          title={`Conta a receber — ${detalhe.id}`}
          hint="Dados completos do recebível e a retenção de impostos da nota que o originou."
          onClose={() => setDetalhe(null)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4">
              <Field label="Empresa" span={4}><Input value={String(detalhe.empresa || '')} disabled /></Field>
              <Field label="Cliente" span={8}><Input value={String(detalhe.cliente || '')} disabled /></Field>
              <Field label="Origem" span={4}><Input value={String(detalhe.origem || 'Manual')} disabled /></Field>
              <Field label="Referência" span={8}><Input value={String(detalhe.referencia || '—')} disabled /></Field>
              <Field label="Vencimento" span={4}><Input value={br(detalhe.vencimentoRecebimento)} disabled /></Field>
              <Field label="Recebido?" span={4}><Input value={detalhe.recebido ? 'Sim' : 'Não'} disabled /></Field>
              <Field label="Banco" span={4}><Input value={String(detalhe.bancoRecebimento || '—')} disabled /></Field>
            </div>

            <ImpostosPanel
              impostos={impostosDoRegistro(detalhe)}
              valorOriginal={num(detalhe.valorOriginal ?? detalhe.valor)}
              valorLiquido={num(detalhe.valorLiquido ?? detalhe.valor)}
            />

            {detalhe.observacao && (
              <div className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
                <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-white/40">Observação</p>
                <p className="text-sm text-white/75">{String(detalhe.observacao)}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Btn type="button" variant="ghost" onClick={() => setDetalhe(null)}>Fechar</Btn>
              <Btn type="button" variant="amber" onClick={() => { abrirEdicao(detalhe); setDetalhe(null); }}>Editar recebimento</Btn>
            </div>
          </div>
        </FinModal>
      )}

      {/* MODAL: editar recebimento */}
      {editando && (
        <FinModal wide title={`Editar recebimento — ${editando.id}`} hint="Informe se recebeu, quando, quanto, em qual banco e observações." onClose={() => setEditando(null)}>
          <form className="grid grid-cols-12 gap-4" onSubmit={salvarEdicao}>
            <Field label="Cliente" span={8}><Input value={String(editando.cliente || '')} disabled /></Field>
            <Field label="Líquido" span={4}><Input value={money(num(editando.valorLiquido ?? editando.valor))} disabled /></Field>

            <div className="col-span-12">
              <ImpostosPanel
                impostos={impostosDoRegistro(editando)}
                valorOriginal={num(editando.valorOriginal ?? editando.valor)}
                valorLiquido={num(editando.valorLiquido ?? editando.valor)}
              />
            </div>

            <Field label="Recebido?" span={4}>
              <Select value={ed.recebido} onChange={(e) => setEdF('recebido', e.target.value)}><option>Não</option><option>Sim</option></Select>
            </Field>
            <Field label="Data recebimento" span={4}><Input type="date" value={ed.dataRecebimento} onChange={(e) => setEdF('dataRecebimento', e.target.value)} disabled={ed.recebido !== 'Sim'} /></Field>
            <Field label="Valor recebido" span={4}><MoneyInput value={ed.valorRecebido} onChange={(v) => setEdF('valorRecebido', v)} disabled={ed.recebido !== 'Sim'} /></Field>

            <Field label="Banco" span={6}><BancoSelect value={ed.bancoRecebimento} onChange={(v) => setEdF('bancoRecebimento', v)} bancos={bancos} /></Field>
            <Field label="Vencimento" span={6}><Input type="date" value={ed.vencimentoRecebimento} onChange={(e) => setEdF('vencimentoRecebimento', e.target.value)} /></Field>

            <Field label="Observação" span={12}><Textarea value={ed.observacao} onChange={(e) => setEdF('observacao', e.target.value)} /></Field>
            <div className="col-span-12 flex justify-end gap-2">
              <Btn type="button" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Btn>
              <Btn type="submit" variant="green" disabled={salvando}><Save size={15} /> {salvando ? 'Salvando...' : 'Salvar recebimento'}</Btn>
            </div>
          </form>
        </FinModal>
      )}
    </FinCard>
  );
}
