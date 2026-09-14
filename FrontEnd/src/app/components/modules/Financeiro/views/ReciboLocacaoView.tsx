import React, { useMemo, useState } from 'react';
import { Plus, Download, Trash2, Pencil } from 'lucide-react';
import { FinCard, Toolbar, boldOS } from '../finUi';
import { money, construirReciboDeMedicao, ultimoReciboLocacaoDaOs, proximoNumeroReciboLocacao } from '../finData';
import { useErp } from '../../../../context/ErpContext';
import { comFinanceiroAtual } from '../../../../../services/financeiroSeguro';
import { gerarReciboLocacaoPDF } from '../reciboLocacaoPdf';
import { confirmDialog } from '../../../ui/feedback';
import { ReciboLocacaoFormModal, formInicialRecibo, linhaItem } from './ReciboLocacaoFormModal';

/* =========================================================================================
 * Lista (em cards) dos Recibos de Locação. A edição em si — os campos de emitente/destinatário/
 * itens, Salvar e Gerar PDF — mora em `ReciboLocacaoFormModal.tsx`, reaproveitado também pelo
 * botão "Preencher/Editar" das linhas "R/L" na tabela de NFe (ver NfeView.tsx).
 * =======================================================================================*/

const STATUS_FILTROS_RECIBO = ['Todos', 'Pendente', 'Emitido'] as const;
type StatusFiltroRecibo = typeof STATUS_FILTROS_RECIBO[number];

export function ReciboLocacaoView() {
  const { financeiro, saveEntity, config, os, medicoes } = useErp() as any;
  const [form, setForm] = useState<any>(null);
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltroRecibo>('Todos');

  const todosOsRecibos = useMemo(
    () => (Array.isArray(financeiro) ? financeiro : []).filter((r: any) => r?.tipo === 'reciboLocacao'),
    [financeiro],
  );
  const recibos = useMemo(() => {
    if (statusFiltro === 'Todos') return todosOsRecibos;
    const alvo = statusFiltro === 'Emitido' ? 'emitido' : 'pendente';
    return todosOsRecibos.filter((r: any) => (r.status === 'emitido' ? 'emitido' : 'pendente') === alvo);
  }, [todosOsRecibos, statusFiltro]);

  // OS que já receberam medição APROVADA — origem do dropdown de "Novo recibo".
  const osComMedicaoAprovada = useMemo(() => {
    const meds = Array.isArray(medicoes) ? medicoes : [];
    const aprovadas = new Set(
      meds.filter((m: any) => String(m.status).toLowerCase() === 'aprovada').map((m: any) => String(m.ordemServicoBackendId)),
    );
    return (Array.isArray(os) ? os : []).filter((o: any) => aprovadas.has(String(o.backendId)));
  }, [os, medicoes]);

  const editar = (r: any) => setForm({ ...formInicialRecibo(todosOsRecibos, r.empresa, config), ...r, itens: (Array.isArray(r.itens) && r.itens.length ? r.itens : [linhaItem()]).map((i: any) => ({ ...linhaItem(), ...i })) });

  // "Novo recibo" a partir de uma OS: se a OS já tem recibo (criado pela medição), abre o existente
  // (não duplica — o número só incrementa com nova medição). Senão, monta a partir da última medição
  // aprovada daquela OS. Fallback: OS sem locação → form em branco já vinculado à OS.
  const abrirParaOs = (osBackendId: string) => {
    if (!osBackendId) return;
    const fin = Array.isArray(financeiro) ? financeiro : [];
    const existente = ultimoReciboLocacaoDaOs(fin, osBackendId);
    if (existente) { editar(existente); return; }

    const osObj = (Array.isArray(os) ? os : []).find((o: any) => String(o.backendId) === String(osBackendId));
    const medsDaOs = (Array.isArray(medicoes) ? medicoes : []).filter(
      (m: any) => String(m.ordemServicoBackendId) === String(osBackendId) && String(m.status).toLowerCase() === 'aprovada',
    );
    const ultimaMed = medsDaOs.length ? medsDaOs[medsDaOs.length - 1] : null;
    const rec = ultimaMed ? construirReciboDeMedicao(fin, ultimaMed) : null;

    if (rec) {
      setForm({ ...formInicialRecibo(todosOsRecibos, rec.empresa, config), ...rec, itens: (Array.isArray(rec.itens) && rec.itens.length ? rec.itens : [linhaItem()]).map((i: any) => ({ ...linhaItem(), ...i })) });
    } else {
      setForm({
        ...formInicialRecibo(todosOsRecibos, osObj?.empresaPrestadora || 'Servinave', config),
        ordemServicoBackendId: osBackendId,
        ordemServicoNumero: osObj?.ordemServicoNumero || '',
        numero: proximoNumeroReciboLocacao(fin, osBackendId),
      });
    }
  };

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

  const excluir = async (r: any) => {
    if (!(await confirmDialog({ message: `Excluir o recibo ${r.numero}?`, danger: true, confirmText: 'Excluir' }))) return;
    await comFinanceiroAtual(async (base) => {
      await saveEntity('financeiro', base.filter((x: any) => x?.id !== r.id));
    });
  };

  return (
    <FinCard>
      <Toolbar
        title="Fazer Recibo de Locação"
        hint="Recibo de locação (não sujeito a NFS-e). As solicitações vindas da Medição aparecem aqui pré-preenchidas."
      />

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <span className="text-white/50 text-[11px] uppercase font-black tracking-widest flex items-center gap-1"><Plus size={14} /> {boldOS('Novo recibo a partir da OS')}</span>
        <select
          value=""
          onChange={(e) => { if (e.target.value) abrirParaOs(e.target.value); }}
          className="bg-[#0b1220] border border-white/10 rounded-lg px-3 py-2 text-white text-xs min-w-[260px]"
        >
          <option value="">{osComMedicaoAprovada.length ? 'Selecione uma OS com medição…' : 'Nenhuma OS com medição aprovada'}</option>
          {osComMedicaoAprovada.map((o: any) => (
            <option key={o.backendId} value={o.backendId}>{o.ordemServicoNumero || o.id} — {o.cliente || ''}</option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-white/30">Status</span>
        {STATUS_FILTROS_RECIBO.map((s) => (
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

      {recibos.length === 0 ? (
        <p className="text-white/40 text-sm bg-[#0b1220] rounded-xl border border-white/5 p-6">
          {statusFiltro === 'Todos' ? 'Nenhum recibo. Crie um novo ou aprove uma medição de locação.' : `Nenhum recibo com status "${statusFiltro}".`}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {recibos.map((r: any) => (
            <div key={r.id} className="bg-[#101f3d] rounded-2xl border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-black">Recibo {r.numero} {r.ordemServicoNumero ? <span className="text-sky-300/80 text-xs">· {r.ordemServicoNumero}</span> : null} {r.medicaoNumero ? <span className="text-cyan-300/70 text-xs">· da medição {r.medicaoNumero}</span> : null}</p>
                  <p className="text-white/50 text-xs truncate">{r.clienteNome || 'Cliente não informado'}</p>
                  <p className="text-emerald-300 text-sm font-black mt-1">R$ {money((r.itens || []).reduce((s: number, i: any) => s + (Number(i.total) || 0), 0))}</p>
                </div>
                <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-black uppercase border ${r.status === 'emitido' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>{r.status === 'emitido' ? 'Emitido' : 'Pendente'}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => editar(r)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-black uppercase flex items-center gap-1"><Pencil size={12} /> Preencher / editar</button>
                <button onClick={() => gerarReciboLocacaoPDF(dadosPdf({ ...formInicialRecibo(todosOsRecibos, r.empresa, config), ...r }))} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-[11px] font-black uppercase flex items-center gap-1"><Download size={12} /> PDF</button>
                <button onClick={() => excluir(r)} className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-[11px] font-black uppercase flex items-center gap-1"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && <ReciboLocacaoFormModal reciboInicial={form} onClose={() => setForm(null)} />}
    </FinCard>
  );
}
