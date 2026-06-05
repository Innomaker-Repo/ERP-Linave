import React, { useMemo, useState } from 'react';
import { Plus, FileCheck2 } from 'lucide-react';
import {
  FinCard, Toolbar, DataTable, Th, Td, Btn, StatusTag, CompanyTag, Pill, AlertBar, EmptyRow,
  FinModal, Field, Input, Select, Kpi, FileInput,
} from '../finUi';
import { br, money, num, todayStr, genFinId, TAX_DEFAULTS, calcNfeLiquido, type NfeSolicitacao } from '../finData';
import { useFin } from '../useFin';
import { useFinFilters } from '../finFilters';

const TIPOS_NFE = ['NFe Serviço', 'NFe Alocado', 'Nota de débito', 'Outro'];

// Estado inicial do formulário de emissão.
const emptyNf = () => ({
  cliente: '', numero: '', emissao: todayStr, original: '',
  cofins: String(TAX_DEFAULTS.cofins), csll: String(TAX_DEFAULTS.csll), inss: String(TAX_DEFAULTS.inss),
  ir: String(TAX_DEFAULTS.ir), pis: String(TAX_DEFAULTS.pis), iss: String(TAX_DEFAULTS.iss),
  baixado: '0', vencido: '0', vencimento: todayStr, contrato: '',
});

export function NfeView() {
  const { nfeSolicitacoes, empresas, oss, emitirNfe, addRecord } = useFin();
  const { match } = useFinFilters();
  const solicitacoes = nfeSolicitacoes.filter(match);

  const [emitindo, setEmitindo] = useState<NfeSolicitacao | null>(null);
  const [nf, setNf] = useState(emptyNf());
  const [nfeAnexos, setNfeAnexos] = useState<string[]>([]);
  const setNfField = (k: string, v: string) => setNf((p) => ({ ...p, [k]: v }));
  const [salvando, setSalvando] = useState(false);

  // Modal manual de solicitação.
  const [solicitando, setSolicitando] = useState(false);
  const [sf, setSf] = useState({ empresa: empresas[0] || 'Linave', os: '', cliente: '', valor: '', forma: '', dataEmitir: todayStr, tipoNfe: 'NFe Serviço' });
  const setSfField = (k: string, v: string) => setSf((p) => ({ ...p, [k]: v }));

  // Cálculo de impostos ao vivo.
  const original = num(nf.original);
  const liquido = useMemo(
    () => calcNfeLiquido(original, { cofins: num(nf.cofins), csll: num(nf.csll), inss: num(nf.inss), ir: num(nf.ir), pis: num(nf.pis), iss: num(nf.iss) }),
    [original, nf.cofins, nf.csll, nf.inss, nf.ir, nf.pis, nf.iss],
  );
  const impCofins = original * num(nf.cofins) / 100;
  const impCsll = original * num(nf.csll) / 100;
  const impOutros = original * (num(nf.inss) + num(nf.ir) + num(nf.pis) + num(nf.iss)) / 100;

  const abrirEmissao = (sol: NfeSolicitacao) => {
    setEmitindo(sol);
    setNfeAnexos([]);
    setNf({ ...emptyNf(), cliente: sol.cliente, original: String(sol.valor || ''), vencimento: sol.dataEmitir || todayStr, contrato: sol.contrato || sol.os });
  };

  const confirmarEmissao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emitindo || !nf.numero.trim() || nfeAnexos.length === 0) return; // anexo da NFe obrigatório
    setSalvando(true);
    try {
      await emitirNfe(emitindo, {
        numero: nf.numero, emissao: nf.emissao, original, liquido,
        baixado: num(nf.baixado), vencimento: nf.vencimento, contrato: nf.contrato, cliente: nf.cliente,
      });
      setEmitindo(null);
    } finally {
      setSalvando(false);
    }
  };

  const confirmarSolicitacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sf.cliente.trim() || !num(sf.valor)) return;
    setSalvando(true);
    try {
      await addRecord({
        id: genFinId('SNF'), tipo: 'nfeReq', status: 'Aguardando emissão',
        empresa: sf.empresa, os: sf.os, cliente: sf.cliente, valor: num(sf.valor),
        forma: sf.forma, dataEmitir: sf.dataEmitir, tipoNfe: sf.tipoNfe, anexos: [], contrato: sf.os,
      });
      setSolicitando(false);
      setSf({ empresa: empresas[0] || 'Linave', os: '', cliente: '', valor: '', forma: '', dataEmitir: todayStr, tipoNfe: 'NFe Serviço' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <FinCard>
      <Toolbar
        title="Solicitações e Emissão de NFe"
        hint="A medição aprovada (negócio finalizado) gera a solicitação automaticamente. Os cálculos de impostos abrem ao Emitir NFe."
        actions={<Btn variant="amber" onClick={() => setSolicitando(true)}><Plus size={15} /> Solicitar NFe</Btn>}
      />
      <AlertBar>Toda NFe emitida exige vencimento do recebimento e anexo da NFe. Ao arquivar, cria Conta a Receber.</AlertBar>
      <DataTable
        minWidth={1200}
        head={<>
          <Th>Solicitação</Th><Th>OS</Th><Th>Empresa</Th><Th>Cliente</Th><Th>Valor</Th>
          <Th>Origem</Th><Th>Data emitir</Th><Th>Tipo NFe</Th><Th>Status</Th><Th>Anexos</Th><Th>Ação</Th>
        </>}
      >
        {solicitacoes.length === 0 ? (
          <EmptyRow cols={11} text="Nenhuma solicitação de NFe (finalize um negócio com medição para gerar)" />
        ) : solicitacoes.map((r) => (
          <tr key={r.id} className="transition-colors hover:bg-white/5">
            <Td className="font-black text-white">{r.id}</Td>
            <Td>{r.os}</Td>
            <Td><CompanyTag empresa={String(r.empresa)} /></Td>
            <Td className="text-white">{r.cliente}</Td>
            <Td className="font-bold text-white">{money(num(r.valor))}</Td>
            <Td><Pill tone={r.derived ? 'info' : 'neutral'}>{r.derived ? 'Medição' : 'Manual'}</Pill></Td>
            <Td>{br(r.dataEmitir)}</Td>
            <Td>{r.tipoNfe}</Td>
            <Td><StatusTag status={r.status} /></Td>
            <Td>{r.anexos.length ? <Pill tone="info">{r.anexos.length}</Pill> : '-'}</Td>
            <Td>
              {r.status === 'Aguardando emissão'
                ? <Btn small variant="amber" onClick={() => abrirEmissao(r)}>Emitir NFe</Btn>
                : <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300"><FileCheck2 size={13} /> Arquivada</span>}
            </Td>
          </tr>
        ))}
      </DataTable>

      {/* MODAL: Emitir NFe */}
      {emitindo && (
        <FinModal wide title={`Emitir NFe — ${emitindo.os}`} hint="Preencha os dados da nota. Ao arquivar, cria a Conta a Receber." onClose={() => setEmitindo(null)}>
          <form className="grid grid-cols-12 gap-4" onSubmit={confirmarEmissao}>
            <Field label="Cliente" span={6}><Input value={nf.cliente} onChange={(e) => setNfField('cliente', e.target.value)} /></Field>
            <Field label="Nº da NFe" span={3}><Input value={nf.numero} onChange={(e) => setNfField('numero', e.target.value)} placeholder="Obrigatório" /></Field>
            <Field label="Emissão" span={3}><Input type="date" value={nf.emissao} onChange={(e) => setNfField('emissao', e.target.value)} /></Field>

            <Field label="Valor original" span={6}><Input type="number" step="0.01" value={nf.original} onChange={(e) => setNfField('original', e.target.value)} /></Field>
            <Field label="Baixado" span={3}><Input type="number" step="0.01" value={nf.baixado} onChange={(e) => setNfField('baixado', e.target.value)} /></Field>
            <Field label="Valor vencido" span={3}><Input type="number" step="0.01" value={nf.vencido} onChange={(e) => setNfField('vencido', e.target.value)} /></Field>

            <Field label="COFINS %" span={2}><Input type="number" step="0.0001" value={nf.cofins} onChange={(e) => setNfField('cofins', e.target.value)} /></Field>
            <Field label="CSLL %" span={2}><Input type="number" step="0.0001" value={nf.csll} onChange={(e) => setNfField('csll', e.target.value)} /></Field>
            <Field label="INSS %" span={2}><Input type="number" step="0.0001" value={nf.inss} onChange={(e) => setNfField('inss', e.target.value)} /></Field>
            <Field label="IR %" span={2}><Input type="number" step="0.0001" value={nf.ir} onChange={(e) => setNfField('ir', e.target.value)} /></Field>
            <Field label="PIS %" span={2}><Input type="number" step="0.0001" value={nf.pis} onChange={(e) => setNfField('pis', e.target.value)} /></Field>
            <Field label="ISS %" span={2}><Input type="number" step="0.0001" value={nf.iss} onChange={(e) => setNfField('iss', e.target.value)} /></Field>

            <Field label="Vencimento do recebimento" span={6}><Input type="date" value={nf.vencimento} onChange={(e) => setNfField('vencimento', e.target.value)} /></Field>
            <Field label="Contrato / OS / P.O" span={6}><Input value={nf.contrato} onChange={(e) => setNfField('contrato', e.target.value)} /></Field>

            <div className="col-span-12 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="COFINS" value={money(impCofins)} />
              <Kpi label="CSLL" value={money(impCsll)} />
              <Kpi label="Outros impostos" value={money(impOutros)} />
              <Kpi label="Líquido" value={money(liquido)} />
            </div>

            <Field label="NFe emitida (anexo obrigatório)" span={12}>
              <FileInput label="Anexar PDF / XML / imagem da NFe emitida" value={nfeAnexos} onChange={setNfeAnexos} />
            </Field>

            <div className="col-span-12 flex justify-end gap-2">
              <Btn type="button" variant="ghost" onClick={() => setEmitindo(null)}>Cancelar</Btn>
              <Btn type="submit" variant="green" disabled={salvando || !nf.numero.trim() || nfeAnexos.length === 0}>
                <FileCheck2 size={15} /> {salvando ? 'Arquivando...' : 'Emitir, anexar e arquivar'}
              </Btn>
            </div>
          </form>
        </FinModal>
      )}

      {/* MODAL: Solicitar NFe (manual) */}
      {solicitando && (
        <FinModal title="Solicitar NFe" hint="Lançamento manual de solicitação de NFe." onClose={() => setSolicitando(false)}>
          <form className="grid grid-cols-12 gap-4" onSubmit={confirmarSolicitacao}>
            <Field label="Empresa" span={4}>
              <Select value={sf.empresa} onChange={(e) => setSfField('empresa', e.target.value)}>{empresas.map((emp) => <option key={emp}>{emp}</option>)}</Select>
            </Field>
            <Field label="OS" span={4}>
              <Select value={sf.os} onChange={(e) => setSfField('os', e.target.value)}>
                <option value="">{oss.length ? 'Selecione...' : 'Nenhuma OS'}</option>
                {oss.map((o, i) => <option key={`${o.numero}-${i}`} value={o.numero}>{o.numero} - {o.cliente}</option>)}
              </Select>
            </Field>
            <Field label="Tipo NFe" span={4}>
              <Select value={sf.tipoNfe} onChange={(e) => setSfField('tipoNfe', e.target.value)}>{TIPOS_NFE.map((t) => <option key={t}>{t}</option>)}</Select>
            </Field>
            <Field label="Cliente" span={6}><Input value={sf.cliente} onChange={(e) => setSfField('cliente', e.target.value)} /></Field>
            <Field label="Valor NFe" span={3}><Input type="number" step="0.01" value={sf.valor} onChange={(e) => setSfField('valor', e.target.value)} /></Field>
            <Field label="Data para emitir" span={3}><Input type="date" value={sf.dataEmitir} onChange={(e) => setSfField('dataEmitir', e.target.value)} /></Field>
            <Field label="Forma de recebimento" span={12}><Input value={sf.forma} onChange={(e) => setSfField('forma', e.target.value)} placeholder="Ex.: Boleto 30 dias após emissão" /></Field>
            <div className="col-span-12 flex justify-end gap-2">
              <Btn type="button" variant="ghost" onClick={() => setSolicitando(false)}>Cancelar</Btn>
              <Btn type="submit" variant="amber" disabled={salvando}>Enviar para NFe</Btn>
            </div>
          </form>
        </FinModal>
      )}
    </FinCard>
  );
}
