import React, { useState } from 'react';
import { FileCheck2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { FinModal, boldOS, FileInput } from '../finUi';
import { money, num, upsertContaReceberPorMedicao, isLinaveEmpresa, siglaTipoNfe, calcImpostosNfe } from '../finData';
import { useErp } from '../../../../context/ErpContext';
import { comFinanceiroAtual } from '../../../../../services/financeiroSeguro';
import { gerarReciboLocacaoPDF } from '../reciboLocacaoPdf';
import { uploadDocumento } from '../../../../../services/documentosService';

/* =========================================================================================
 * Formulário de Recibo de Locação — extraído de ReciboLocacaoView.tsx pra ser reaproveitado
 * também pelas linhas "R/L"/"N/D" da tabela de NFe (ver NfeView.tsx): o botão "Preencher/Editar"
 * de um recibo tem que abrir EXATAMENTE este mesmo fluxo, não importa de onde foi aberto.
 * A lista em cards de ReciboLocacaoView.tsx continua lá — só a parte de EDITAR virou modal
 * compartilhado (antes era um "swap" inteiro da tela, sem overlay).
 *
 * `ReciboLocacaoFormFields` (a seção de campos, sem o <FinModal> em volta e sem os botões de
 * rodapé) e `gerarEArquivarRecibo` (a lógica de "Gerar e arquivar", sem os side-effects de UI
 * como toast/onClose) são exportados separadamente pra dar pra embutir o MESMO formulário
 * dentro da modal combinada "Emitir NFe e Recibo" de uma OS mista (NfeView.tsx), que tem seu
 * próprio botão único cuidando de Serviço + Locação juntos.
 * =======================================================================================*/

// O emitente (razão social, CNPJ, inscrições, banco) E o logo do recibo dependem da EMPRESA
// PRESTADORA (Linave × Servinave), definida lá na criação do serviço/OS. Presets abaixo.
const PRESETS: Record<'Linave' | 'Servinave', any> = {
  Servinave: {
    emitenteNome: 'VTS REPAROS NAVAIS',
    emitenteEndereco: 'RUA MIGUEL DE LEMOS, N°44, FUNDOS PONTA D`AREIA',
    emitenteCep: '24040-260',
    emitenteCidadeUf: 'NITERÓI – RJ',
    emitenteCnpj: '33.189.684/0001-70',
    emitenteInscMunicipal: '3026559',
    emitenteInscEstadual: '11.399.584',
    atendimento: '(21) 9 9179-8282 - VINICIUS TINOCO',
    banco: 'Banco Itaú – Agência 6030 C/c 47280-4',
    formaPagamento: 'Depósito em C/C',
  },
  Linave: {
    emitenteNome: 'W.L.M LINAVE Serviços Navais e Offshore',
    emitenteEndereco: '',
    emitenteCep: '',
    emitenteCidadeUf: '',
    emitenteCnpj: '34.282.247/0001-60',
    emitenteInscMunicipal: '',
    emitenteInscEstadual: '',
    atendimento: '',
    banco: '',
    formaPagamento: 'Depósito em C/C',
  },
};

// Resolve o emitente pela empresa prestadora, priorizando o cadastro (config) quando preenchido.
export const resolveEmitente = (empresa: any, config: any) => {
  const linave = isLinaveEmpresa(empresa);
  const key: 'Linave' | 'Servinave' = linave ? 'Linave' : 'Servinave';
  const preset = PRESETS[key];
  const lista = Array.isArray(config?.empresasPrestadoras) ? config.empresasPrestadoras : [];
  const cfg = lista.find((e: any) => isLinaveEmpresa(e?.nome) === linave) || {};
  const ou = (a: any, b: any) => (String(a || '').trim() ? a : b);
  return {
    empresa: key,
    emitenteNome: preset.emitenteNome,
    emitenteEndereco: ou(cfg.endereco, preset.emitenteEndereco),
    emitenteCep: preset.emitenteCep,
    emitenteCidadeUf: preset.emitenteCidadeUf,
    emitenteCnpj: ou(cfg.cnpj, preset.emitenteCnpj),
    emitenteInscMunicipal: preset.emitenteInscMunicipal,
    emitenteInscEstadual: preset.emitenteInscEstadual,
    atendimento: ou(cfg.contato, preset.atendimento),
    banco: preset.banco,
    formaPagamento: preset.formaPagamento,
  };
};

export const linhaItem = () => ({ id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, item: '', qtd: '', descricao: '', valorUnitario: '', total: '' });

const hoje = () => new Date().toISOString().slice(0, 10);

const novoNumero = (recibos: any[]) => {
  const ano = String(new Date().getFullYear()).slice(-2);
  const doAno = recibos.filter((r) => String(r.numero || '').endsWith(`/${ano}`));
  const maior = doAno.reduce((m, r) => Math.max(m, parseInt(String(r.numero || '').split('/')[0], 10) || 0), 0);
  return `${String(maior + 1).padStart(3, '0')}/${ano}`;
};

export const formInicialRecibo = (recibos: any[], empresa: any, config: any) => ({
  id: `REC-${Date.now()}`,
  tipo: 'reciboLocacao' as const,
  status: 'pendente',
  numero: novoNumero(recibos),
  ...resolveEmitente(empresa, config),
  dataEmissao: hoje(),
  dataVencimento: hoje(),
  clienteNome: '', clienteLogradouro: '', clienteBairro: '', clienteMunicipio: '',
  clienteUf: '', clienteCep: '', clienteCnpj: '', clienteInscEst: '', clienteIncMun: '',
  itens: [linhaItem()],
  obs: '',
  createdAt: new Date().toISOString(),
});

const dadosPdf = (f: any) => ({
  ...f,
  itens: (f.itens || [])
    .filter((i: any) => String(i.descricao || '').trim())
    .map((i: any) => ({
      item: i.item, qtd: i.qtd, descricao: i.descricao,
      valorUnitario: parseFloat(String(i.valorUnitario).replace(',', '.')) || 0,
      total: parseFloat(String(i.total).replace(',', '.')) || 0,
    })),
});

export const totalDoRecibo = (form: any): number =>
  (form?.itens || []).reduce((s: number, i: any) => s + (parseFloat(String(i.total).replace(',', '.')) || 0), 0);

// Lógica pura de "Emitir, anexar e arquivar" — gera o PDF, sobe o(s) anexo(s), arquiva a
// solicitação de origem (se houver) e cria/atualiza a Conta a Receber já líquida dos impostos
// (se o usuário digitou algum % na modal "Emitir Recibo/Nota" antes de chegar aqui — ver
// rascunhoImpostos em NfeView.tsx/finData.ts; sem rascunho, os % ficam 0 e líquido = original,
// exatamente como sempre foi). Não mexe em toast/onClose/onSaved — isso fica por conta de quem
// chama (o modal solo aqui embaixo, ou a modal combinada de OS mista em NfeView.tsx), já que os
// dois precisam reagir de formas diferentes ao resultado.
export const gerarEArquivarRecibo = async (
  form: any,
  anexoManual: File[],
  saveEntity: (collection: string, data: any) => Promise<void>,
): Promise<{ ok: boolean; recEmitido?: any; total?: number; liquido?: number }> => {
  if (!form) return { ok: false };
  // 1) Gera o PDF (dispara o download local, como já fazia) e sobe o mesmo arquivo pro
  //    backend — é o documento que fica disponível depois em Contas a Receber. Documento(s)
  //    anexados manualmente (recibo já emitido fora do sistema) somam junto.
  const pdfFile = await gerarReciboLocacaoPDF(dadosPdf({ ...form, status: 'emitido' }));
  const uploads = await Promise.allSettled([
    uploadDocumento(pdfFile, { vinculoTipo: 'financeiro', vinculoId: form.id, categoria: 'fin_anexo' }),
    ...anexoManual.map((file) => uploadDocumento(file, { vinculoTipo: 'financeiro', vinculoId: form.id, categoria: 'fin_anexo' })),
  ]);
  const anexosUrls = uploads
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map((r) => r.value.url);
  const falhas = uploads.length - anexosUrls.length;
  if (falhas > 0) toast.error(`${falhas} documento(s) não puderam ser enviados — o recibo continua sendo emitido.`);

  const recEmitido = { ...form, status: 'emitido', anexos: anexosUrls };
  const total = totalDoRecibo(recEmitido);
  // % de imposto digitados na modal "Emitir Recibo/Nota" (ver rascunhoImpostos) e carregados
  // aqui pelo form (construirReciboParaSolicitacao, NfeView.tsx). Nunca preenchidos (recibo
  // direto de uma OS, sem passar por lá) → todos 0, líquido = original, como sempre foi.
  const impostosDetalhe = calcImpostosNfe(total, {
    cofins: num(form.cofins), csll: num(form.csll), inss: num(form.inss),
    ir: num(form.ir), pis: num(form.pis), iss: num(form.iss),
  });
  const liquido = Math.max(0, total - impostosDetalhe.total);
  const impostosParaSalvar = impostosDetalhe.total > 0 ? impostosDetalhe : null;
  // Recibo aberto a partir de uma linha "R/L"/"N/D" da tela de NFe (nfeReqId presente): além de
  // virar Conta a Receber, tem que arquivar a solicitação de origem — sem isso a linha na
  // aba NFe nunca sai de "Aguardando emissão" e o anexo não aparece lá. Um registro tipo
  // 'nfe' com sourceId = nfeReqId faz exatamente isso (mesmo mecanismo de emitirNfe em
  // useFin.ts); id estável (não randômico) para uma nova geração ATUALIZAR o mesmo registro
  // em vez de arquivar a solicitação duas vezes.
  const nfeArquivoId = form.nfeReqId ? `NFE-${form.nfeReqId}` : null;
  const resultado = await comFinanceiroAtual(async (base) => {
    const outros = base.filter((r: any) => r?.id !== recEmitido.id && (!nfeArquivoId || r?.id !== nfeArquivoId));
    let next: any[] = [recEmitido, ...outros];
    if (nfeArquivoId) {
      next = [{
        id: nfeArquivoId,
        tipo: 'nfe',
        sourceId: form.nfeReqId,
        empresa: recEmitido.empresa,
        tipoNfe: 'Nota de débito',
        cliente: recEmitido.clienteNome,
        numero: recEmitido.numero,
        emissao: recEmitido.dataEmissao,
        original: total,
        liquido,
        vencimento: recEmitido.dataVencimento,
        contrato: recEmitido.ordemServicoNumero || '',
        anexos: anexosUrls,
        impostos: impostosParaSalvar,
        createdAt: new Date().toISOString(),
      }, ...next];
    }
    // Todo recibo GERADO (com valor) precisa virar Conta a Receber, não só os que vieram de
    // uma medição — com medicaoId, mescla com a NFe da mesma medição (upsertContaReceberPorMedicao
    // já resolve isso); sem medicaoId (recibo direto de uma OS, ou bridge de uma solicitação de
    // NFe tipo Locação/N-D), vira um recebível avulso próprio, sem mesclar com mais nada.
    // fonteId continua o próprio id do recibo (estável) — não muda com o registro 'nfe'
    // acima, que só serve para arquivar a solicitação de origem.
    if (total > 0) {
      next = upsertContaReceberPorMedicao(next, {
        medicaoId: recEmitido.medicaoId,
        medicaoNumero: recEmitido.medicaoNumero || '',
        ordemServicoNumero: recEmitido.ordemServicoNumero || '',
        empresa: recEmitido.empresa,
        cliente: recEmitido.clienteNome,
        origem: 'Recibo',
        fonteId: recEmitido.id,
        valorOriginal: total,
        valorLiquido: liquido,
        vencimento: recEmitido.dataVencimento,
        // Este formulário só existe para Recibo de Locação — a sigla varia pela empresa
        // prestadora (Linave = N/D, Servinave = R/L; ver siglaTipoNfe em finData.ts).
        referencia: `${siglaTipoNfe('Nota de débito', recEmitido.empresa)} ${recEmitido.numero}`,
        impostos: impostosParaSalvar ?? undefined,
        anexos: anexosUrls,
      });
    }
    await saveEntity('financeiro', next);
    return true;
  });
  if (!resultado) return { ok: false }; // gravação falhou/abortou
  return { ok: true, recEmitido, total, liquido };
};

interface ReciboLocacaoFormFieldsProps {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  config: any;
  anexoManual: File[];
  setAnexoManual: React.Dispatch<React.SetStateAction<File[]>>;
}

// Só os campos (emitente/destinatário/itens/documento opcional) — sem o <FinModal> em volta
// e sem botões de rodapé, pra dar pra embutir dentro de outra modal (ver comentário no topo).
export function ReciboLocacaoFormFields({ form, setForm, config, anexoManual, setAnexoManual }: ReciboLocacaoFormFieldsProps) {
  const inp = 'w-full bg-[#0b1220] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30';
  const lbl = 'text-white/50 text-[10px] uppercase font-black tracking-widest mb-1 block';

  const set = (campo: string, valor: any) => setForm((f: any) => ({ ...f, [campo]: valor }));
  // Trocar a empresa prestadora reaplica o emitente (razão social, CNPJ, banco...) e o logo do PDF.
  const trocarEmpresa = (empresa: string) => setForm((f: any) => ({ ...f, ...resolveEmitente(empresa, config) }));
  const setItem = (id: string, campo: string, valor: any) => setForm((f: any) => ({
    ...f,
    itens: f.itens.map((i: any) => {
      if (i.id !== id) return i;
      const next = { ...i, [campo]: valor };
      if (campo === 'qtd' || campo === 'valorUnitario') {
        const q = parseFloat(String(next.qtd).replace(',', '.')) || 0;
        const u = parseFloat(String(next.valorUnitario).replace(',', '.')) || 0;
        next.total = q > 0 ? String(Math.round(q * u * 100) / 100) : String(u);
      }
      return next;
    }),
  }));
  const addItem = () => setForm((f: any) => ({ ...f, itens: [...f.itens, linhaItem()] }));
  const removeItem = (id: string) => setForm((f: any) => ({ ...f, itens: f.itens.filter((i: any) => i.id !== id) }));

  const totalRecibo = totalDoRecibo(form);

  if (!form) return null;

  return (
    <div className="space-y-6">
      {/* Dados do recibo */}
      <section className="bg-[#0b1220] rounded-xl border border-white/10 p-4">
        <p className="text-emerald-300 text-xs font-black uppercase mb-3">Dados do recibo</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className={lbl}>Empresa prestadora</label>
            <select className={inp} value={isLinaveEmpresa(form.empresa) ? 'Linave' : 'Servinave'} onChange={(e) => trocarEmpresa(e.target.value)}>
              <option value="Servinave">Servinave (VTS)</option>
              <option value="Linave">Linave</option>
            </select>
          </div>
          <div><label className={lbl}>Nº do recibo</label><input className={inp} value={form.numero} onChange={(e) => set('numero', e.target.value)} /></div>
          <div><label className={lbl}>{boldOS('OS vinculada')}</label><input className={`${inp} opacity-70`} value={form.ordemServicoNumero || '—'} readOnly title="Vínculo definido pela medição/OS de origem" /></div>
          <div><label className={lbl}>Data de emissão</label><input type="date" className={inp} value={form.dataEmissao} onChange={(e) => set('dataEmissao', e.target.value)} /></div>
          <div><label className={lbl}>Data de vencimento</label><input type="date" className={inp} value={form.dataVencimento} onChange={(e) => set('dataVencimento', e.target.value)} /></div>
          <div><label className={lbl}>Forma de pagamento</label><input className={inp} value={form.formaPagamento} onChange={(e) => set('formaPagamento', e.target.value)} /></div>
          <div className="md:col-span-4"><label className={lbl}>Banco</label><input className={inp} value={form.banco} onChange={(e) => set('banco', e.target.value)} /></div>
        </div>
      </section>

      {/* Emitente */}
      <section className="bg-[#0b1220] rounded-xl border border-white/10 p-4">
        <p className="text-emerald-300 text-xs font-black uppercase mb-3">Emitente (prestadora)</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="md:col-span-2"><label className={lbl}>Razão social</label><input className={inp} value={form.emitenteNome} onChange={(e) => set('emitenteNome', e.target.value)} /></div>
          <div><label className={lbl}>CNPJ</label><input className={inp} value={form.emitenteCnpj} onChange={(e) => set('emitenteCnpj', e.target.value)} /></div>
          <div><label className={lbl}>Atendimento</label><input className={inp} value={form.atendimento} onChange={(e) => set('atendimento', e.target.value)} /></div>
          <div className="md:col-span-2"><label className={lbl}>Endereço</label><input className={inp} value={form.emitenteEndereco} onChange={(e) => set('emitenteEndereco', e.target.value)} /></div>
          <div><label className={lbl}>CEP</label><input className={inp} value={form.emitenteCep} onChange={(e) => set('emitenteCep', e.target.value)} /></div>
          <div><label className={lbl}>Cidade / UF</label><input className={inp} value={form.emitenteCidadeUf} onChange={(e) => set('emitenteCidadeUf', e.target.value)} /></div>
          <div><label className={lbl}>Inscrição municipal</label><input className={inp} value={form.emitenteInscMunicipal} onChange={(e) => set('emitenteInscMunicipal', e.target.value)} /></div>
          <div><label className={lbl}>Inscrição estadual</label><input className={inp} value={form.emitenteInscEstadual} onChange={(e) => set('emitenteInscEstadual', e.target.value)} /></div>
        </div>
      </section>

      {/* Destinatário */}
      <section className="bg-[#0b1220] rounded-xl border border-white/10 p-4">
        <p className="text-emerald-300 text-xs font-black uppercase mb-3">Usuário final / Destinatário</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="md:col-span-4"><label className={lbl}>Nome / Razão social</label><input className={inp} value={form.clienteNome} onChange={(e) => set('clienteNome', e.target.value)} /></div>
          <div className="md:col-span-2"><label className={lbl}>Logradouro</label><input className={inp} value={form.clienteLogradouro} onChange={(e) => set('clienteLogradouro', e.target.value)} /></div>
          <div><label className={lbl}>Bairro</label><input className={inp} value={form.clienteBairro} onChange={(e) => set('clienteBairro', e.target.value)} /></div>
          <div><label className={lbl}>Município</label><input className={inp} value={form.clienteMunicipio} onChange={(e) => set('clienteMunicipio', e.target.value)} /></div>
          <div><label className={lbl}>UF</label><input className={inp} value={form.clienteUf} onChange={(e) => set('clienteUf', e.target.value)} /></div>
          <div><label className={lbl}>CEP</label><input className={inp} value={form.clienteCep} onChange={(e) => set('clienteCep', e.target.value)} /></div>
          <div><label className={lbl}>CNPJ</label><input className={inp} value={form.clienteCnpj} onChange={(e) => set('clienteCnpj', e.target.value)} /></div>
          <div><label className={lbl}>Inscrição estadual</label><input className={inp} value={form.clienteInscEst} onChange={(e) => set('clienteInscEst', e.target.value)} /></div>
          <div><label className={lbl}>Inscrição municipal</label><input className={inp} value={form.clienteIncMun} onChange={(e) => set('clienteIncMun', e.target.value)} /></div>
        </div>
      </section>

      {/* Itens */}
      <section className="bg-[#0b1220] rounded-xl border border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-emerald-300 text-xs font-black uppercase">Itens de locação</p>
          <button onClick={addItem} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-[11px] font-black uppercase">+ Item</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 text-white/70 uppercase tracking-wider">
                {['Item', 'Qtd', 'Descrição', 'Vl. Unit.', 'Total', ''].map((h) => <th key={h} className="border border-white/10 px-2 py-2 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(form.itens || []).map((i: any) => (
                <tr key={i.id} className="text-white">
                  <td className="border border-white/10 p-1"><input className={`w-14 ${inp}`} value={i.item} onChange={(e) => setItem(i.id, 'item', e.target.value)} placeholder="01" /></td>
                  <td className="border border-white/10 p-1"><input className={`w-16 ${inp}`} value={i.qtd} onChange={(e) => setItem(i.id, 'qtd', e.target.value)} /></td>
                  <td className="border border-white/10 p-1"><textarea rows={2} className={`w-full min-w-[240px] resize-y ${inp}`} value={i.descricao} onChange={(e) => setItem(i.id, 'descricao', e.target.value)} placeholder="Descrição (equipamento, período, P.O ...)" /></td>
                  <td className="border border-white/10 p-1"><input className={`w-24 ${inp}`} value={i.valorUnitario} onChange={(e) => setItem(i.id, 'valorUnitario', e.target.value)} placeholder="0,00" /></td>
                  <td className="border border-white/10 p-1"><input className={`w-24 ${inp}`} value={i.total} onChange={(e) => setItem(i.id, 'total', e.target.value)} placeholder="0,00" /></td>
                  <td className="border border-white/10 p-1 text-center"><button onClick={() => removeItem(i.id)} className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-right text-white/50 text-xs uppercase font-black tracking-widest mt-3">Valor total: <span className="text-emerald-300 text-lg">R$ {money(totalRecibo)}</span></p>
        <div className="mt-3"><label className={lbl}>Observação (OBS)</label><input className={inp} value={form.obs} onChange={(e) => set('obs', e.target.value)} /></div>
      </section>

      {/* Documento: opcional aqui — "Gerar recibo" já sobe o PDF que o sistema monta e o
          anexa em Contas a Receber sozinho. Só use isto se já tiver um recibo emitido fora
          do sistema (ex.: assinado à mão) que precise valer no lugar/junto do PDF gerado. */}
      <section className="bg-[#0b1220] rounded-xl border border-white/10 p-4">
        <p className="text-emerald-300 text-xs font-black uppercase mb-1 flex items-center gap-1.5"><UploadCloud size={14} /> Documento já emitido (opcional)</p>
        <p className="text-white/40 text-[11px] mb-3">Ao gerar, o sistema já anexa o PDF do recibo em Contas a Receber automaticamente. Anexe aqui só se já tiver um documento emitido fora do sistema pra somar junto.</p>
        <FileInput label="Anexar recibo/NF já emitido" value={anexoManual} onChange={setAnexoManual} />
      </section>
    </div>
  );
}

interface ReciboLocacaoFormModalProps {
  reciboInicial: any;
  onClose: () => void;
  // Avisa quem abriu o modal do resultado final salvo — usado pela linha "R/L"/"N/D" da tabela
  // de NFe pra manter valor/status daquela linha em dia com o que foi preenchido no recibo.
  onSaved?: (recibo: any) => void;
}

export function ReciboLocacaoFormModal({ reciboInicial, onClose, onSaved }: ReciboLocacaoFormModalProps) {
  const { saveEntity, config } = useErp() as any;
  const [form, setForm] = useState<any>(reciboInicial);
  const [salvando, setSalvando] = useState(false);
  // Documento já emitido fora do sistema (ex.: recibo assinado à mão, versão final revisada).
  // Se o usuário anexar algo aqui, ele soma ao PDF que o sistema gera automaticamente ao
  // "Gerar recibo" — não substitui, já que o PDF gerado é o que alimenta Contas a Receber
  // mesmo quando ninguém anexa nada.
  const [anexoManual, setAnexoManual] = useState<File[]>([]);

  const salvar = async () => {
    if (!form) return;
    setSalvando(true);
    try {
      await comFinanceiroAtual(async (base) => {
        const outros = base.filter((r: any) => r?.id !== form.id);
        await saveEntity('financeiro', [form, ...outros]);
      });
      onSaved?.(form);
      onClose();
    } finally {
      setSalvando(false);
    }
  };

  const gerar = async () => {
    setSalvando(true);
    try {
      const { ok, recEmitido, total } = await gerarEArquivarRecibo(form, anexoManual, saveEntity);
      if (!ok) return; // gravação falhou/abortou (ou form vazio)
      toast.success((total || 0) > 0 ? 'Recibo/nota arquivado(a) — Conta a Receber gerada.' : 'Recibo salvo.');
      onSaved?.(recEmitido);
      onClose();
    } finally {
      setSalvando(false);
    }
  };

  if (!form) return null;

  return (
    <FinModal wide title={`Recibo ${form.numero}`} onClose={onClose}>
      <div className="space-y-6">
        <ReciboLocacaoFormFields form={form} setForm={setForm} config={config} anexoManual={anexoManual} setAnexoManual={setAnexoManual} />

        <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
          <button onClick={onClose} disabled={salvando} className="px-6 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs font-black uppercase disabled:opacity-40">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase disabled:opacity-40">{salvando ? 'Salvando...' : 'Salvar'}</button>
          <button onClick={gerar} disabled={salvando} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white text-xs font-black uppercase flex items-center gap-2 disabled:opacity-40">
            <FileCheck2 size={15} /> {salvando ? 'Arquivando...' : 'Emitir, anexar e arquivar'}
          </button>
        </div>
      </div>
    </FinModal>
  );
}
