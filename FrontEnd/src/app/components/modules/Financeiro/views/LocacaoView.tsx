import React from 'react';
import { Save } from 'lucide-react';
import { FinCard, Toolbar, Field, Select, Textarea, Btn, DataTable, Th, Td, EmptyRow } from '../finUi';

const CHECKLIST = [
  ['1. Cadastro da locação', 'Quais campos são obrigatórios: cliente, OS, contrato/P.O, item locado, datas, valor, unidade de cobrança e responsável.'],
  ['2. Regra de cobrança', 'Se a cobrança é mensal, diária, por medição, antecipada, pós-paga, por período fechado ou proporcional.'],
  ['3. Integração com NFe', 'Definir se a locação gera solicitação de NFe, quando gera e qual documento aprova a emissão.'],
  ['4. Integração com Contas a Receber', 'Definir se cria recebíveis automaticamente ou somente depois da NFe emitida.'],
  ['5. Encerramento da locação', 'Como tratar devolução, avaria, multa, cobrança extra, cancelamento e encerramento parcial.'],
];

export function LocacaoView() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* Estudo */}
      <FinCard>
        <Toolbar title="Locação · Módulo em estudo" hint="Esta área não deve gerar cobranças automaticamente ainda. Primeiro é necessário levantar as regras de negócio." />
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Antes de criar o fluxo definitivo, precisamos entender como a empresa cobra, mede, renova, encerra e emite documentos para cada tipo de locação.
        </div>
        <form className="grid grid-cols-12 gap-4" onSubmit={(e) => e.preventDefault()}>
          <Field label="Empresa" span={3}>
            <Select><option>Linave</option><option>Servinave</option><option>Ambas</option></Select>
          </Field>
          <Field label="Tipo de locação" span={3}>
            <Select>
              <option>Equipamento</option><option>Mão de obra / equipe alocada</option>
              <option>Embarcação</option><option>Ferramenta</option><option>Serviço recorrente</option><option>Outro</option>
            </Select>
          </Field>
          <Field label="Unidade de cobrança" span={3}>
            <Select>
              <option>Diária</option><option>Semanal</option><option>Quinzenal</option>
              <option>Mensal</option><option>Por medição</option><option>Por evento</option>
            </Select>
          </Field>
          <Field label="Vincula OS?" span={3}>
            <Select><option>Sim</option><option>Não</option><option>Depende do caso</option></Select>
          </Field>

          <Field label="Como começa a locação?" span={6}>
            <Textarea placeholder="Ex.: contrato assinado, P.O aprovada, entrega do equipamento, mobilização da equipe..." />
          </Field>
          <Field label="Como termina a locação?" span={6}>
            <Textarea placeholder="Ex.: devolução, aceite do cliente, desmobilização, fim da OS, encerramento contratual..." />
          </Field>
          <Field label="Como é feita a medição?" span={6}>
            <Textarea placeholder="Ex.: dias corridos, dias úteis, horas, relatório mensal, boletim de medição aprovado..." />
          </Field>
          <Field label="Quando vira cobrança?" span={6}>
            <Textarea placeholder="Ex.: início do mês, fim do mês, após medição aprovada, após emissão de NFe..." />
          </Field>
          <Field label="Regras financeiras" span={6}>
            <Textarea placeholder="Ex.: vencimento, caução, multa, juros, reajuste, desconto, cobrança parcial, pró-rata..." />
          </Field>
          <Field label="Documentos necessários" span={6}>
            <Textarea placeholder="Ex.: contrato, P.O, termo de entrega, termo de devolução, relatório, NFe, comprovantes..." />
          </Field>

          <div className="col-span-12">
            <Btn variant="amber" type="submit"><Save size={15} /> Salvar estudo de locação</Btn>
          </div>
        </form>
      </FinCard>

      {/* Checklist + estudos salvos */}
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
        <DataTable
          minWidth={700}
          head={<><Th>Empresa</Th><Th>Tipo</Th><Th>Unidade</Th><Th>Vincula OS?</Th><Th>Resumo cobrança</Th></>}
        >
          <EmptyRow cols={5} text="Nenhum estudo salvo" />
        </DataTable>
      </FinCard>
    </div>
  );
}
