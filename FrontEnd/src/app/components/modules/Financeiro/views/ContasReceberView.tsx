import React, { useMemo, useState } from 'react';
import { Plus, Save, Download } from 'lucide-react';
import {
  FinCard, Toolbar, DataTable, Th, Td, Btn, StatusTag, CompanyTag, AlertBar, EmptyRow,
  FinModal, Field, Input, Select, Textarea,
} from '../finUi';
import { br, money, num, isOld, todayStr, genFinId, download } from '../finData';
import { useFin, type FinRecord } from '../useFin';
import { useFinFilters } from '../finFilters';

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

// Leitura/escrita reais: recebíveis em `financeiro` (tipo 'contaReceber'). Criação manual
// e edição do recebimento (recebeu?/quando/quanto/banco/observação) persistem via saveEntity.
export function ContasReceberView() {
  const { records, empresas, addRecord, updateRecord } = useFin();
  const { match } = useFinFilters();
  const rows = records('contaReceber').filter(match);
  const bancos = records('banco').map((b) => b.nome).filter(Boolean) as string[];
  const vencidas = useMemo(() => rows.filter((r) => status(r) === 'Vencido'), [rows]);
  const [salvando, setSalvando] = useState(false);

  // Modal de criação manual.
  const [criando, setCriando] = useState(false);
  const novoVazio = () => ({
    empresa: empresas[0] || 'Linave', cliente: '', referencia: '', valorOriginal: '', valorLiquido: '',
    vencimentoRecebimento: todayStr, bancoRecebimento: '', recebido: 'Não', dataRecebimento: '', valorRecebido: '', observacao: '',
  });
  const [novo, setNovo] = useState(novoVazio());
  const setNovoF = (k: string, v: string) => setNovo((p) => ({ ...p, [k]: v }));

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

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novo.cliente.trim() || !num(novo.valorOriginal)) return;
    setSalvando(true);
    try {
      const recebido = novo.recebido === 'Sim';
      await addRecord({
        id: genFinId('CR'), tipo: 'contaReceber', origem: 'Manual',
        empresa: novo.empresa, cliente: novo.cliente, referencia: novo.referencia || 'Manual',
        valorOriginal: num(novo.valorOriginal), valorLiquido: num(novo.valorLiquido || novo.valorOriginal),
        vencimentoRecebimento: novo.vencimentoRecebimento, bancoRecebimento: novo.bancoRecebimento,
        recebido, dataRecebimento: recebido ? novo.dataRecebimento : '', valorRecebido: recebido ? num(novo.valorRecebido) : 0,
        observacao: novo.observacao,
      });
      setCriando(false);
      setNovo(novoVazio());
    } finally {
      setSalvando(false);
    }
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

  // Resumo em CSV do que está na tela (respeita os filtros), com linha de TOTAL ao final.
  const exportarCsv = () => {
    const head = ['Origem', 'Empresa', 'Cliente', 'Referência', 'Valor original', 'Valor líquido', 'Vencimento', 'Recebido?', 'Data receb.', 'Valor recebido', 'Banco', 'Status'];
    const linhas: any[][] = rows.map((r) => [
      r.origem || 'Manual', r.empresa, r.cliente, r.referencia || '',
      num(r.valorOriginal ?? r.valor), num(r.valorLiquido ?? r.valor), r.vencimentoRecebimento || '',
      r.recebido ? 'Sim' : 'Não', r.dataRecebimento || '', num(r.valorRecebido), r.bancoRecebimento || '', status(r),
    ]);
    const totOrig = rows.reduce((s, r) => s + num(r.valorOriginal ?? r.valor), 0);
    const totLiq = rows.reduce((s, r) => s + num(r.valorLiquido ?? r.valor), 0);
    const totReceb = rows.reduce((s, r) => s + num(r.valorRecebido), 0);
    linhas.push(['TOTAL', '', '', '', totOrig, totLiq, '', '', '', totReceb, '', '']);
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
          <Btn variant="amber" onClick={() => setCriando(true)}><Plus size={15} /> Conta a receber</Btn>
        </>}
      />
      {vencidas.length > 0 && (
        <AlertBar>⚠️ Existem {vencidas.length} conta(s) a receber vencida(s): vencimento anterior a hoje e ainda não recebido.</AlertBar>
      )}
      <DataTable
        minWidth={1400}
        head={<>
          <Th>Origem</Th><Th>Empresa</Th><Th>Cliente</Th><Th>Referência</Th><Th>Original</Th><Th>Líquido</Th>
          <Th>Vencimento</Th><Th>Recebido?</Th><Th>Data receb.</Th><Th>Valor recebido</Th><Th>Banco</Th><Th>Status</Th><Th>Ação</Th>
        </>}
      >
        {rows.length === 0 ? (
          <EmptyRow cols={13} text="Nenhuma conta a receber (emita uma NFe ou lance manualmente)" />
        ) : rows.map((r) => {
          const st = status(r);
          return (
            <tr key={r.id} className={`transition-colors hover:bg-white/5 ${st === 'Vencido' ? 'bg-rose-500/[0.06]' : ''}`}>
              <Td>{r.origem || 'Manual'}</Td>
              <Td><CompanyTag empresa={String(r.empresa)} /></Td>
              <Td className="text-white">{r.cliente}</Td>
              <Td className="text-white/60">{r.referencia || '—'}</Td>
              <Td>{money(num(r.valorOriginal ?? r.valor))}</Td>
              <Td className="font-bold text-white">{money(num(r.valorLiquido ?? r.valor))}</Td>
              <Td className={st === 'Vencido' ? 'font-bold text-rose-300' : ''}>{br(r.vencimentoRecebimento)}</Td>
              <Td>{r.recebido ? 'Sim' : 'Não'}</Td>
              <Td>{r.dataRecebimento ? br(r.dataRecebimento) : '-'}</Td>
              <Td>{r.valorRecebido ? money(num(r.valorRecebido)) : '-'}</Td>
              <Td className="text-white/60">{r.bancoRecebimento || '—'}</Td>
              <Td><StatusTag status={st} /></Td>
              <Td><Btn small variant="amber" onClick={() => abrirEdicao(r)}>Editar recebimento</Btn></Td>
            </tr>
          );
        })}
      </DataTable>

      {/* MODAL: criar conta a receber manual */}
      {criando && (
        <FinModal wide title="Adicionar Conta a Receber" hint="Lançamento manual de um recebível." onClose={() => setCriando(false)}>
          <form className="grid grid-cols-12 gap-4" onSubmit={criar}>
            <Field label="Empresa" span={3}>
              <Select value={novo.empresa} onChange={(e) => setNovoF('empresa', e.target.value)}>{empresas.map((emp) => <option key={emp}>{emp}</option>)}</Select>
            </Field>
            <Field label="Cliente" span={6}><Input value={novo.cliente} onChange={(e) => setNovoF('cliente', e.target.value)} /></Field>
            <Field label="Referência" span={3}><Input value={novo.referencia} onChange={(e) => setNovoF('referencia', e.target.value)} placeholder="Ex.: Rec.Loc. 001/26" /></Field>

            <Field label="Valor original" span={3}><Input type="number" step="0.01" value={novo.valorOriginal} onChange={(e) => setNovoF('valorOriginal', e.target.value)} /></Field>
            <Field label="Valor líquido" span={3}><Input type="number" step="0.01" value={novo.valorLiquido} onChange={(e) => setNovoF('valorLiquido', e.target.value)} placeholder="= original se vazio" /></Field>
            <Field label="Vencimento" span={3}><Input type="date" value={novo.vencimentoRecebimento} onChange={(e) => setNovoF('vencimentoRecebimento', e.target.value)} /></Field>
            <Field label="Banco" span={3}><BancoSelect value={novo.bancoRecebimento} onChange={(v) => setNovoF('bancoRecebimento', v)} bancos={bancos} /></Field>

            <Field label="Recebido?" span={3}>
              <Select value={novo.recebido} onChange={(e) => setNovoF('recebido', e.target.value)}><option>Não</option><option>Sim</option></Select>
            </Field>
            <Field label="Data recebimento" span={3}><Input type="date" value={novo.dataRecebimento} onChange={(e) => setNovoF('dataRecebimento', e.target.value)} disabled={novo.recebido !== 'Sim'} /></Field>
            <Field label="Valor recebido" span={3}><Input type="number" step="0.01" value={novo.valorRecebido} onChange={(e) => setNovoF('valorRecebido', e.target.value)} disabled={novo.recebido !== 'Sim'} /></Field>

            <Field label="Observação" span={12}><Textarea value={novo.observacao} onChange={(e) => setNovoF('observacao', e.target.value)} /></Field>
            <div className="col-span-12 flex justify-end gap-2">
              <Btn type="button" variant="ghost" onClick={() => setCriando(false)}>Cancelar</Btn>
              <Btn type="submit" variant="amber" disabled={salvando}><Save size={15} /> {salvando ? 'Salvando...' : 'Salvar conta a receber'}</Btn>
            </div>
          </form>
        </FinModal>
      )}

      {/* MODAL: editar recebimento */}
      {editando && (
        <FinModal title={`Editar recebimento — ${editando.id}`} hint="Informe se recebeu, quando, quanto, em qual banco e observações." onClose={() => setEditando(null)}>
          <form className="grid grid-cols-12 gap-4" onSubmit={salvarEdicao}>
            <Field label="Cliente" span={8}><Input value={String(editando.cliente || '')} disabled /></Field>
            <Field label="Líquido" span={4}><Input value={money(num(editando.valorLiquido ?? editando.valor))} disabled /></Field>

            <Field label="Recebido?" span={4}>
              <Select value={ed.recebido} onChange={(e) => setEdF('recebido', e.target.value)}><option>Não</option><option>Sim</option></Select>
            </Field>
            <Field label="Data recebimento" span={4}><Input type="date" value={ed.dataRecebimento} onChange={(e) => setEdF('dataRecebimento', e.target.value)} disabled={ed.recebido !== 'Sim'} /></Field>
            <Field label="Valor recebido" span={4}><Input type="number" step="0.01" value={ed.valorRecebido} onChange={(e) => setEdF('valorRecebido', e.target.value)} disabled={ed.recebido !== 'Sim'} /></Field>

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
