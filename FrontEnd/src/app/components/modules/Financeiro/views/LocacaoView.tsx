import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { FinCard, Toolbar, Field, Select, Textarea, Btn, DataTable, Th, Td, CompanyTag, EmptyRow } from '../finUi';
import { genFinId } from '../finData';
import { useFin } from '../useFin';

const CHECKLIST = [
  ['1. Cadastro da locação', 'Quais campos são obrigatórios: cliente, OS, contrato/P.O, item locado, datas, valor, unidade de cobrança e responsável.'],
  ['2. Regra de cobrança', 'Se a cobrança é mensal, diária, por medição, antecipada, pós-paga, por período fechado ou proporcional.'],
  ['3. Integração com NFe', 'Definir se a locação gera solicitação de NFe, quando gera e qual documento aprova a emissão.'],
  ['4. Integração com Contas a Receber', 'Definir se cria recebíveis automaticamente ou somente depois da NFe emitida.'],
  ['5. Encerramento da locação', 'Como tratar devolução, avaria, multa, cobrança extra, cancelamento e encerramento parcial.'],
];

// Módulo em estudo: NÃO gera cobranças. Só registra o levantamento das regras de negócio.
export function LocacaoView() {
  const { empresas, records, addRecord } = useFin();
  const estudos = records('locEstudo');
  const [salvando, setSalvando] = useState(false);

  const salvar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSalvando(true);
    try {
      await addRecord({
        id: genFinId('LOC'),
        tipo: 'locEstudo',
        empresa: String(fd.get('empresa') || ''),
        tipoLocacao: String(fd.get('tipoLocacao') || ''),
        unidade: String(fd.get('unidade') || ''),
        vinculaOS: String(fd.get('vinculaOS') || ''),
        inicio: String(fd.get('inicio') || ''),
        termino: String(fd.get('termino') || ''),
        medicao: String(fd.get('medicao') || ''),
        cobranca: String(fd.get('cobranca') || ''),
        financeiroRegras: String(fd.get('financeiroRegras') || ''),
        documentos: String(fd.get('documentos') || ''),
      });
      e.currentTarget.reset();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <FinCard>
        <Toolbar title="Locação · Módulo em estudo" hint="Esta área não gera cobranças automaticamente ainda. Primeiro levantamos as regras de negócio." />
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Antes de criar o fluxo definitivo, precisamos entender como a empresa cobra, mede, renova, encerra e emite documentos para cada tipo de locação.
        </div>
        <form className="grid grid-cols-12 gap-4" onSubmit={salvar}>
          <Field label="Empresa" span={3}>
            <Select name="empresa">{empresas.map((e) => <option key={e}>{e}</option>)}<option>Ambas</option></Select>
          </Field>
          <Field label="Tipo de locação" span={3}>
            <Select name="tipoLocacao">
              <option>Equipamento</option><option>Mão de obra / equipe alocada</option>
              <option>Embarcação</option><option>Ferramenta</option><option>Serviço recorrente</option><option>Outro</option>
            </Select>
          </Field>
          <Field label="Unidade de cobrança" span={3}>
            <Select name="unidade">
              <option>Diária</option><option>Semanal</option><option>Quinzenal</option>
              <option>Mensal</option><option>Por medição</option><option>Por evento</option>
            </Select>
          </Field>
          <Field label="Vincula OS?" span={3}>
            <Select name="vinculaOS"><option>Sim</option><option>Não</option><option>Depende do caso</option></Select>
          </Field>

          <Field label="Como começa a locação?" span={6}><Textarea name="inicio" placeholder="Ex.: contrato assinado, P.O aprovada, entrega do equipamento..." /></Field>
          <Field label="Como termina a locação?" span={6}><Textarea name="termino" placeholder="Ex.: devolução, aceite do cliente, desmobilização, fim da OS..." /></Field>
          <Field label="Como é feita a medição?" span={6}><Textarea name="medicao" placeholder="Ex.: dias corridos, dias úteis, horas, boletim de medição aprovado..." /></Field>
          <Field label="Quando vira cobrança?" span={6}><Textarea name="cobranca" placeholder="Ex.: início do mês, fim do mês, após medição, após emissão de NFe..." /></Field>
          <Field label="Regras financeiras" span={6}><Textarea name="financeiroRegras" placeholder="Ex.: vencimento, caução, multa, juros, reajuste, pró-rata..." /></Field>
          <Field label="Documentos necessários" span={6}><Textarea name="documentos" placeholder="Ex.: contrato, P.O, termo de entrega/devolução, relatório, NFe..." /></Field>

          <div className="col-span-12">
            <Btn variant="amber" type="submit" disabled={salvando}><Save size={15} /> {salvando ? 'Salvando...' : 'Salvar estudo de locação'}</Btn>
          </div>
        </form>
      </FinCard>

      <FinCard>
        <Toolbar title="Pontos que precisam ser definidos" hint="Checklist de entendimento antes de desenvolver o módulo definitivo." />
        <div className="space-y-3">
          {CHECKLIST.map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-white/5 bg-[#0b1220] p-4">
              <strong className="text-white">{t}</strong>
              <p className="mt-1 text-sm text-white/45">{d}</p>
            </div>
          ))}
        </div>

        <h3 className="mb-3 mt-6 font-black text-white">Estudos salvos</h3>
        <DataTable minWidth={700} head={<><Th>Empresa</Th><Th>Tipo</Th><Th>Unidade</Th><Th>Vincula OS?</Th><Th>Cobrança</Th></>}>
          {estudos.length === 0 ? (
            <EmptyRow cols={5} text="Nenhum estudo salvo" />
          ) : estudos.map((s) => (
            <tr key={s.id} className="transition-colors hover:bg-white/5">
              <Td><CompanyTag empresa={String(s.empresa)} /></Td>
              <Td className="text-white">{s.tipoLocacao}</Td>
              <Td className="text-white/70">{s.unidade}</Td>
              <Td className="text-white/70">{s.vinculaOS}</Td>
              <Td className="max-w-[260px] truncate text-white/60">{s.cobranca || '—'}</Td>
            </tr>
          ))}
        </DataTable>
      </FinCard>
    </div>
  );
}
