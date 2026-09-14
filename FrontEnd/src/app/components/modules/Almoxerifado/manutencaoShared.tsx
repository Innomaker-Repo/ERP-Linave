import React, { useState } from 'react';
import { CheckCircle2, ImagePlus, Wrench, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadDocumento } from '../../../../services/documentosService';

/* =========================================================================================
 * MANUTENÇÃO — tipos, helpers puros e os dois modais (Entrada/Saída) compartilhados entre
 * EstoqueView.tsx (gatilho ao editar o Status de um item) e ManutencaoView.tsx (tela
 * dedicada). Mantém a lógica de negócio (montar o registro, decidir quando permitir) num
 * único lugar; cada tela decide sozinha ONDE esse registro é gravado (EstoqueView guarda em
 * estado local com auto-save; ManutencaoView e HistoricoRomaneioView gravam direto no
 * contexto via saveEntity) — ver comentário no topo de cada uma.
 * =======================================================================================*/

export interface ManutencaoRow {
  id: string;
  tableName: string;
  values: Record<string, string>;
}

export interface ManutencaoHistoricoItem {
  id: string;
  tableName: string;
  rowId: string;
  itemLabel: string;
  entradaData: string;
  entradaMotivo: string;
  entradaResponsavel: string;
  entradaObs?: string;
  entradaFotoUrl?: string;
  entradaFotoBackendId?: number;
  // 'edicaoItem': status trocado pra "Em manutenção" editando o item no Estoque.
  // 'telaManutencao': criado pelo botão "Registrar Manutenção" na própria tela de Manutenção.
  // 'romaneio': item voltou de um Romaneio marcado para manutenção (sem foto obrigatória).
  origem: 'edicaoItem' | 'telaManutencao' | 'romaneio';
  status: 'aberta' | 'concluida';
  saidaData?: string;
  saidaResponsavel?: string;
  saidaLiberadoPor?: string;
  saidaServico?: string;
  saidaPecas?: string;
  saidaCusto?: string;
  saidaObs?: string;
  saidaFotoUrl?: string;
  saidaFotoBackendId?: number;
}

const normalizeKeyLocal = (value: string): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

// Item só pode entrar em manutenção se foi cadastrado com a caixinha marcada.
export const itemPossuiManutencao = (row: ManutencaoRow): boolean =>
  normalizeKeyLocal(row.values?.possuiManutencao || '') === 'sim';

// Mesma regra usada em EstoqueView (isNegativeStatus): qualquer status contendo "manut".
export const itemEstaEmManutencao = (row: ManutencaoRow): boolean =>
  normalizeKeyLocal(row.values?.status || '').includes('manut');

// Nome de exibição do item — os nomes de campo variam por tabela (equipamento/material/
// fornecedor/modelo), então tenta na ordem mais específica pra mais genérica.
export const nomeDoItemManutencao = (row: ManutencaoRow): string =>
  row.values?.equipamento || row.values?.material || row.values?.modelo ||
  row.values?.fornecedor || row.values?.descricao || row.id;

export const patrimonioDoItem = (row: ManutencaoRow): string =>
  row.values?.patrimonio || row.values?.numeroSerial || row.values?.tag || '';

export const gerarIdManutencao = (): string =>
  `MAN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6)}`;

export function criarEntradaManutencao(params: {
  row: ManutencaoRow;
  data: string;
  motivo: string;
  responsavel: string;
  observacao?: string;
  fotoUrl?: string;
  fotoBackendId?: number;
  origem: ManutencaoHistoricoItem['origem'];
}): ManutencaoHistoricoItem {
  return {
    id: gerarIdManutencao(),
    tableName: params.row.tableName,
    rowId: params.row.id,
    itemLabel: nomeDoItemManutencao(params.row),
    entradaData: params.data,
    entradaMotivo: params.motivo,
    entradaResponsavel: params.responsavel,
    entradaObs: params.observacao || '',
    entradaFotoUrl: params.fotoUrl,
    entradaFotoBackendId: params.fotoBackendId,
    origem: params.origem,
    status: 'aberta',
  };
}

export function fecharSaidaManutencao(
  entrada: ManutencaoHistoricoItem,
  params: {
    data: string;
    responsavel: string;
    liberadoPor: string;
    servico: string;
    pecas?: string;
    custo?: string;
    observacao?: string;
    fotoUrl: string;
    fotoBackendId?: number;
  },
): ManutencaoHistoricoItem {
  return {
    ...entrada,
    status: 'concluida',
    saidaData: params.data,
    saidaResponsavel: params.responsavel,
    saidaLiberadoPor: params.liberadoPor,
    saidaServico: params.servico,
    saidaPecas: params.pecas || '',
    saidaCusto: params.custo || '',
    saidaObs: params.observacao || '',
    saidaFotoUrl: params.fotoUrl,
    saidaFotoBackendId: params.fotoBackendId,
  };
}

const hoje = () => new Date().toISOString().slice(0, 10);

const fieldCls = 'w-full rounded-xl border border-white/10 bg-[#0b1220]/80 px-4 py-2.5 text-sm text-white outline-none shadow-sm transition placeholder:text-white/30 focus:border-amber-400 focus:ring-1 focus:ring-amber-400';
const labelCls = 'mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/50';
const reqCls = "after:content-['_*'] after:text-red-400";

/* -----------------------------------------------------------------------------------------
 * MODAL: Entrada em Manutenção
 * --------------------------------------------------------------------------------------- */
interface EntradaManutencaoModalProps {
  row: ManutencaoRow;
  categoriaLabel: string;
  numeroManutencao: string;
  responsavelPadrao?: string;
  onClose: () => void;
  onConfirm: (dados: {
    data: string;
    motivo: string;
    responsavel: string;
    observacao: string;
    fotoUrl: string;
    fotoBackendId?: number;
  }) => Promise<void> | void;
}

export function EntradaManutencaoModal({ row, categoriaLabel, numeroManutencao, responsavelPadrao, onClose, onConfirm }: EntradaManutencaoModalProps) {
  const [data, setData] = useState(hoje());
  const [responsavel, setResponsavel] = useState(responsavelPadrao || '');
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [enviando, setEnviando] = useState(false);

  const escolherFoto = (file: File | null) => {
    setFoto(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : '');
  };

  const confirmar = async () => {
    if (!data || !responsavel.trim() || !motivo.trim() || !foto) {
      toast.error('Preencha data, responsável, motivo e adicione uma foto de entrada.');
      return;
    }
    setEnviando(true);
    try {
      const documento = await uploadDocumento(foto, {
        vinculoTipo: 'almoxarifado',
        vinculoId: row.id,
        categoria: 'almoxarifado_manutencao_entrada',
      });
      await onConfirm({
        data, responsavel: responsavel.trim(), motivo: motivo.trim(), observacao: observacao.trim(),
        fotoUrl: documento.url, fotoBackendId: documento.backendId,
      });
    } catch (error) {
      console.error('Erro ao registrar entrada em manutenção:', error);
      toast.error('Não foi possível enviar a foto. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#0d1830] shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between border-b border-white/5 bg-[#101f3d] p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
              <Wrench size={18} />
            </div>
            <div>
              <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">Entrada em Manutenção</p>
              <h2 className="text-lg font-black uppercase tracking-wide text-white">{nomeDoItemManutencao(row)}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/5 p-2.5 text-white/70 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-6">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-[11px] leading-relaxed text-amber-100">
            O status deste item vai mudar para <strong>Em manutenção</strong>. Preencha os dados de entrada e
            adicione uma foto para documentar a condição atual do equipamento.
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Patrimônio</label>
              <input readOnly value={patrimonioDoItem(row) || '—'} className={`${fieldCls} opacity-70`} />
            </div>
            <div>
              <label className={labelCls}>Categoria</label>
              <input readOnly value={categoriaLabel} className={`${fieldCls} opacity-70`} />
            </div>
            <div>
              <label className={labelCls}>Nº da Manutenção</label>
              <input readOnly value={numeroManutencao} className={`${fieldCls} opacity-70`} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`${labelCls} ${reqCls}`}>Data de Entrada</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={`${labelCls} ${reqCls}`}>Responsável pelo Registro</label>
              <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome do responsável" className={fieldCls} />
            </div>
          </div>

          <div>
            <label className={`${labelCls} ${reqCls}`}>Motivo da Manutenção</label>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva o motivo da entrada em manutenção..." className={`${fieldCls} min-h-[80px] resize-y`} />
          </div>
          <div>
            <label className={labelCls}>Observações da Entrada</label>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Condição aparente, defeito identificado..." className={`${fieldCls} min-h-[70px] resize-y`} />
          </div>

          <div className="rounded-xl border border-dashed border-amber-500/40 bg-[#0b1220]/50 p-4">
            <p className={`${labelCls} ${reqCls} mb-2`}>Foto de Entrada</p>
            <p className="mb-3 text-[11px] text-white/40">Registre o estado físico do item antes do serviço.</p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => escolherFoto(e.target.files?.[0] || null)}
              className="block w-full text-xs text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500/20 file:px-3 file:py-2 file:text-[11px] file:font-bold file:uppercase file:text-amber-200"
            />
            {previewUrl && (
              <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
                <img src={previewUrl} alt="Prévia da foto de entrada" className="h-32 w-full object-cover" />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/5 bg-[#131f37] p-6">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/5 bg-[#0b1220]/80 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10">Cancelar</button>
          <button
            type="button"
            onClick={confirmar}
            disabled={enviando}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#0b1220] shadow-lg transition hover:bg-amber-400 disabled:opacity-50"
          >
            <CheckCircle2 size={15} /> {enviando ? 'Enviando...' : 'Confirmar Entrada'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------------------
 * MODAL: Saída da Manutenção
 * --------------------------------------------------------------------------------------- */
interface SaidaManutencaoModalProps {
  itemLabel: string;
  onClose: () => void;
  onConfirm: (dados: {
    data: string;
    responsavel: string;
    liberadoPor: string;
    servico: string;
    pecas: string;
    custo: string;
    observacao: string;
    fotoUrl: string;
    fotoBackendId?: number;
  }) => Promise<void> | void;
  uploadVinculoId: string;
}

export function SaidaManutencaoModal({ itemLabel, onClose, onConfirm, uploadVinculoId }: SaidaManutencaoModalProps) {
  const [data, setData] = useState(hoje());
  const [responsavel, setResponsavel] = useState('');
  const [liberadoPor, setLiberadoPor] = useState('');
  const [servico, setServico] = useState('');
  const [pecas, setPecas] = useState('');
  const [custo, setCusto] = useState('');
  const [observacao, setObservacao] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [enviando, setEnviando] = useState(false);

  const escolherFoto = (file: File | null) => {
    setFoto(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : '');
  };

  const confirmar = async () => {
    if (!data || !responsavel.trim() || !liberadoPor.trim() || !servico.trim() || !foto) {
      toast.error('Preencha data, responsáveis, serviço realizado e adicione uma foto de saída.');
      return;
    }
    setEnviando(true);
    try {
      const documento = await uploadDocumento(foto, {
        vinculoTipo: 'almoxarifado',
        vinculoId: uploadVinculoId,
        categoria: 'almoxarifado_manutencao_saida',
      });
      await onConfirm({
        data, responsavel: responsavel.trim(), liberadoPor: liberadoPor.trim(), servico: servico.trim(),
        pecas: pecas.trim(), custo: custo.trim(), observacao: observacao.trim(),
        fotoUrl: documento.url, fotoBackendId: documento.backendId,
      });
    } catch (error) {
      console.error('Erro ao registrar saída da manutenção:', error);
      toast.error('Não foi possível enviar a foto. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#0d1830] shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between border-b border-white/5 bg-[#101f3d] p-6">
          <div>
            <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">Saída da Manutenção</p>
            <h2 className="text-lg font-black uppercase tracking-wide text-white">{itemLabel}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/5 p-2.5 text-white/70 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-6">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-[11px] leading-relaxed text-emerald-100">
            Para retirar o item da manutenção, registre o serviço executado e uma foto obrigatória da condição do
            equipamento na saída.
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={`${labelCls} ${reqCls}`}>Data de Saída</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={`${labelCls} ${reqCls}`}>Responsável pela Manutenção</label>
              <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome" className={fieldCls} />
            </div>
            <div>
              <label className={`${labelCls} ${reqCls}`}>Responsável pela Liberação</label>
              <input value={liberadoPor} onChange={(e) => setLiberadoPor(e.target.value)} placeholder="Nome" className={fieldCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`${labelCls} ${reqCls}`}>Serviço Realizado</label>
              <textarea value={servico} onChange={(e) => setServico(e.target.value)} placeholder="Descreva o serviço executado..." className={`${fieldCls} min-h-[80px] resize-y`} />
            </div>
            <div>
              <label className={labelCls}>Peças / Materiais Utilizados</label>
              <textarea value={pecas} onChange={(e) => setPecas(e.target.value)} placeholder="Peças substituídas ou materiais utilizados..." className={`${fieldCls} min-h-[80px] resize-y`} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Custo da Manutenção</label>
              <input type="number" min="0" step="0.01" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,00" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Observações Finais</label>
              <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Observações sobre a saída" className={fieldCls} />
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-emerald-500/40 bg-[#0b1220]/50 p-4">
            <p className={`${labelCls} ${reqCls} mb-2`}>Foto de Saída</p>
            <p className="mb-3 text-[11px] text-white/40">Registre a condição final do item após o serviço.</p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => escolherFoto(e.target.files?.[0] || null)}
              className="block w-full text-xs text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500/20 file:px-3 file:py-2 file:text-[11px] file:font-bold file:uppercase file:text-emerald-200"
            />
            {previewUrl && (
              <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
                <img src={previewUrl} alt="Prévia da foto de saída" className="h-32 w-full object-cover" />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/5 bg-[#131f37] p-6">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/5 bg-[#0b1220]/80 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10">Cancelar</button>
          <button
            type="button"
            onClick={confirmar}
            disabled={enviando}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition hover:bg-emerald-500 disabled:opacity-50"
          >
            <ImagePlus size={15} /> {enviando ? 'Enviando...' : 'Finalizar Manutenção'}
          </button>
        </div>
      </div>
    </div>
  );
}
