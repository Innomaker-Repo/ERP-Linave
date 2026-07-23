import React, { useMemo, useState } from 'react';
import { Archive, FileCheck2, FileWarning, History, Package, Search } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';
import {
  formatCurrency,
  purchaseStateLabel,
  toItemRecords,
  type CompraHistoricoRegistro,
} from './comprasLocal';
import { FinModal, Field, Input, FileInput, Btn } from '../Financeiro/finUi';
import { uploadDocumento } from '../../../../services/documentosService';
import { toast } from 'sonner';

interface HistoricoComprasViewProps {
  searchQuery: string;
}

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

const purchaseStateTone = (state: string) => {
  switch (state) {
    case 'comprado':
    case 'contratado':
      return 'border-sky-500/30 bg-sky-500/15 text-sky-200';
    case 'estoque':
      return 'border-violet-500/30 bg-violet-500/15 text-violet-200';
    default:
      return 'border-amber-500/30 bg-amber-500/15 text-amber-200';
  }
};

export function HistoricoComprasView({ searchQuery }: HistoricoComprasViewProps) {
  const { comprasHistorico, saveEntity, userSession } = useErp() as any;
  const [filtro, setFiltro] = useState(searchQuery || '');
  const [osFiltro, setOsFiltro] = useState('');

  // Modal "Lançar NFe" (registrar a nota do fornecedor / nota de entrada).
  const [nfeModal, setNfeModal] = useState<CompraHistoricoRegistro | null>(null);
  const [nfeNumero, setNfeNumero] = useState('');
  const [nfeAnexosUrls, setNfeAnexosUrls] = useState<string[]>([]); // anexos já salvos (URLs)
  const [nfeArquivosNovos, setNfeArquivosNovos] = useState<File[]>([]); // novos a subir
  const [salvando, setSalvando] = useState(false);

  const registros = useMemo<CompraHistoricoRegistro[]>(
    () => toItemRecords(Array.isArray(comprasHistorico) ? comprasHistorico : []),
    [comprasHistorico],
  );

  const opcoesOS = useMemo(() => {
    const set = new Set<string>();
    registros.forEach((r) => {
      const os = (r.centroCusto || '').trim();
      if (os) set.add(os);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [registros]);

  const registrosFiltrados = useMemo(() => {
    const termo = (filtro || '').toLowerCase().trim();
    return registros.filter((r) => {
      if (osFiltro && (r.centroCusto || '').trim() !== osFiltro) return false;
      if (!termo) return true;
      return [
        r.centroCusto, r.solicitante, r.departamento, r.itemDescricao, r.itemNome,
        r.fornecedor, r.condicaoPagamento, r.prazoEntrega, r.nfeNumero,
        purchaseStateLabel[r.purchaseState],
        r.valor != null ? String(r.valor) : '',
      ].filter(Boolean).join(' ').toLowerCase().includes(termo);
    });
  }, [registros, filtro, osFiltro]);

  // Agrupa por pedido (OS / centro de custo) só para exibição.
  const grupos = useMemo(() => {
    const map = new Map<string, { pedidoId: string; centroCusto: string; solicitante: string; departamento: string; itens: CompraHistoricoRegistro[] }>();
    registrosFiltrados.forEach((r) => {
      const key = r.pedidoId || r.id;
      if (!map.has(key)) {
        map.set(key, { pedidoId: key, centroCusto: r.centroCusto, solicitante: r.solicitante, departamento: r.departamento, itens: [] });
      }
      map.get(key)!.itens.push(r);
    });
    return Array.from(map.values());
  }, [registrosFiltrados]);

  const totalItens = registrosFiltrados.length;
  const nfePendentes = registrosFiltrados.filter((r) => r.nfeStatus !== 'lancada').length;

  const abrirNfe = (registro: CompraHistoricoRegistro) => {
    setNfeNumero(registro.nfeNumero || '');
    setNfeAnexosUrls(registro.nfeAnexos || []);
    setNfeArquivosNovos([]);
    setNfeModal(registro);
  };

  const confirmarNfe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nfeModal || !nfeNumero.trim()) return;
    setSalvando(true);
    try {
      // Sobe os novos anexos para a tabela Documento (vinculados ao registro de compra)
      // e mescla as URLs resultantes com as já salvas.
      let novasUrls: string[] = [];
      if (nfeArquivosNovos.length) {
        const resultados = await Promise.allSettled(
          nfeArquivosNovos.map((file) => uploadDocumento(file, { vinculoTipo: 'compras', vinculoId: nfeModal.id, categoria: 'outro' }))
        );
        novasUrls = resultados
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map((r) => r.value.url);
        const falhas = resultados.length - novasUrls.length;
        if (falhas > 0) toast.error(`${falhas} anexo(s) não puderam ser enviados.`);
      }
      const nfeAnexos = [...nfeAnexosUrls, ...novasUrls];
      const all = Array.isArray(comprasHistorico) ? comprasHistorico : [];
      const updated = all.map((r: any) =>
        r?.id === nfeModal.id
          ? {
              ...r,
              nfeStatus: 'lancada',
              nfeNumero: nfeNumero.trim(),
              nfeAnexos,
              nfeLancadaEm: new Date().toISOString(),
              nfeLancadaPor: userSession?.nome || userSession?.email || 'sistema',
            }
          : r,
      );
      await saveEntity?.('comprasHistorico', updated);
      setNfeModal(null);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 p-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-amber-300 text-[10px] font-black uppercase tracking-widest">
          <History size={14} /> Histórico de Compras
        </div>
        <h1 className="text-3xl font-black text-white">Compras concluídas</h1>
        <p className="text-white/50 text-sm">
          Cada item comprado/contratado entra aqui com fornecedor, valor e estado. A NF do fornecedor começa <strong className="text-white/80">pendente</strong> — use "Lançar NFe" para registrá-la.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_240px_150px_150px_150px]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-3.5 text-white/40" />
          <input
            value={filtro}
            onChange={(event) => setFiltro(event.target.value)}
            placeholder="Buscar por item, fornecedor, solicitante..."
            className="h-14 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white text-sm outline-none focus:border-amber-500 placeholder:text-white/40"
          />
        </div>

        <div className="relative">
          <select
            value={osFiltro}
            onChange={(event) => setOsFiltro(event.target.value)}
            className="h-14 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 text-white text-sm outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="">Todas as OS</option>
            {opcoesOS.map((os) => (
              <option key={os} value={os}>{os}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/30">▼</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Pedidos</p>
          <p className="mt-1 text-2xl font-black text-white">{grupos.length}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Itens</p>
          <p className="mt-1 text-2xl font-black text-white">{totalItens}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#101f3d] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">NFe pendentes</p>
          <p className="mt-1 text-2xl font-black text-amber-300">{nfePendentes}</p>
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-white/10 bg-[#101f3d] p-12 text-center text-white/40 shadow-2xl shadow-black/20">
          <Archive size={42} className="text-white/20" />
          <p className="text-sm font-bold">Nenhuma compra no histórico</p>
          <p className="text-xs text-white/30">
            {osFiltro || filtro ? 'Ajuste os filtros para ver mais resultados.' : 'Marque um item como comprado/contratado no kanban para registrá-lo aqui.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 overflow-auto pb-4">
          {grupos.map((grupo) => {
            const total = grupo.itens.reduce((sum, it) => sum + (it.valor || 0), 0);
            return (
              <article key={grupo.pedidoId} className="overflow-hidden rounded-[28px] border border-white/10 bg-[#101f3d] shadow-2xl shadow-black/20">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200">
                        OS: {grupo.centroCusto || '—'}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                        {grupo.itens.length} item(ns)
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-white/60">
                      Solicitante: <span className="text-white/85">{grupo.solicitante || '—'}</span>
                      {grupo.departamento ? ` • ${grupo.departamento}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Total</p>
                    <p className="text-xl font-black text-emerald-300">{total ? formatCurrency(total) : '—'}</p>
                  </div>
                </div>

                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white/[0.03]">
                      <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40">
                        <th className="px-6 py-3 text-left">Item</th>
                        <th className="px-6 py-3 text-left">Natureza</th>
                        <th className="px-6 py-3 text-left">Qtd</th>
                        <th className="px-6 py-3 text-left">Fornecedor</th>
                        <th className="px-6 py-3 text-left">Valor</th>
                        <th className="px-6 py-3 text-left">Estado</th>
                        <th className="px-6 py-3 text-left">NFe</th>
                        <th className="px-6 py-3 text-left">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {grupo.itens.map((item) => (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white">{item.itemDescricao || item.itemNome || '—'}</div>
                            <div className="text-xs text-white/35">Comprado em {formatDateTime(item.compradoEm)}{item.compradoPor ? ` por ${item.compradoPor}` : ''}</div>
                          </td>
                          <td className="px-6 py-4 text-white/70">{item.naturezaFornecimento === 'ITEM' ? 'Item' : 'Serviço'}</td>
                          <td className="px-6 py-4 text-white/70">{item.qtd} {item.un}</td>
                          <td className="px-6 py-4 text-white/80">{item.fornecedor || '—'}</td>
                          <td className="px-6 py-4 text-white/80">{item.valor != null ? formatCurrency(item.valor) : '—'}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold ${purchaseStateTone(item.purchaseState)}`}>
                              <Package size={12} /> {purchaseStateLabel[item.purchaseState]}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {item.nfeStatus === 'lancada' ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-200">
                                <FileCheck2 size={12} /> NFe {item.nfeNumero || 'lançada'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-200">
                                <FileWarning size={12} /> NFe pendente
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {item.nfeStatus === 'lancada' ? (
                              <span className="text-xs text-white/35">{item.nfeLancadaEm ? formatDateTime(item.nfeLancadaEm) : 'Lançada'}</span>
                            ) : (item as any)._legacy ? (
                              <span className="text-xs text-white/30">Registro antigo</span>
                            ) : (
                              <Btn small variant="amber" onClick={() => abrirNfe(item)}><FileCheck2 size={13} /> Lançar NFe</Btn>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {nfeModal && (
        <FinModal
          title={`Lançar NFe — ${nfeModal.itemDescricao || nfeModal.itemNome}`}
          hint="Registre a nota fiscal do fornecedor (nota de entrada) desta compra."
          onClose={() => setNfeModal(null)}
        >
          <form className="grid grid-cols-12 gap-4" onSubmit={confirmarNfe}>
            <Field label="Fornecedor" span={6}><Input value={nfeModal.fornecedor || ''} disabled /></Field>
            <Field label="Nº da NF *" span={6}><Input value={nfeNumero} onChange={(e) => setNfeNumero(e.target.value)} placeholder="Obrigatório" /></Field>
            <Field label="Anexo da NF (PDF / XML / imagem)" span={12}>
              {nfeAnexosUrls.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {nfeAnexosUrls.map((a, i) => {
                    const ehUrl = /^(https?:|\/media\/)/.test(String(a));
                    const nome = ehUrl ? decodeURIComponent(String(a).split('/').pop() || 'documento') : String(a);
                    return ehUrl ? (
                      <a key={i} href={a} target="_blank" rel="noopener noreferrer" className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/20">📄 {nome}</a>
                    ) : (
                      <span key={i} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/70">📄 {nome}</span>
                    );
                  })}
                </div>
              )}
              <FileInput label="Anexar nota fiscal do fornecedor" value={nfeArquivosNovos} onChange={setNfeArquivosNovos} />
            </Field>
            <div className="col-span-12 flex justify-end gap-2">
              <Btn type="button" variant="ghost" onClick={() => setNfeModal(null)}>Cancelar</Btn>
              <Btn type="submit" variant="green" disabled={salvando || !nfeNumero.trim()}>
                <FileCheck2 size={15} /> {salvando ? 'Lançando...' : 'Lançar NFe'}
              </Btn>
            </div>
          </form>
        </FinModal>
      )}
    </div>
  );
}
