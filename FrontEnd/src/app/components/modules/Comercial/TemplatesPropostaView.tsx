import React, { useEffect, useMemo, useState } from 'react';
import { useErp } from '../../../context/ErpContext';
import { FileText, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '../../ui/feedback';
import {
  CAMPOS_TEMPLATE_PROPOSTA,
  ROTULOS_CAMPO_TEMPLATE,
  getPropostaTemplates,
  createPropostaTemplate,
  updatePropostaTemplate,
  deletePropostaTemplate,
  type CampoTemplateProposta,
  type PropostaTemplate,
} from '../../../../services/propostaTemplatesService';

const formatarData = (iso?: string) => {
  if (!iso) return '—';
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? iso : data.toLocaleString('pt-BR');
};

const formularioVazio = (): Partial<Record<CampoTemplateProposta, string>> => {
  const vazio: Partial<Record<CampoTemplateProposta, string>> = {};
  CAMPOS_TEMPLATE_PROPOSTA.forEach((campo) => { vazio[campo] = ''; });
  return vazio;
};

export function TemplatesPropostaView() {
  const { userSession } = useErp() as any;
  const [templates, setTemplates] = useState<PropostaTemplate[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [editando, setEditando] = useState<PropostaTemplate | null>(null); // null = form fechado; {id:''} = criando
  const [nome, setNome] = useState('');
  const [campos, setCampos] = useState<Partial<Record<CampoTemplateProposta, string>>>(formularioVazio());

  const autor = userSession?.nome || userSession?.username || userSession?.email || '';

  const recarregar = async () => {
    setCarregando(true);
    try {
      setTemplates(await getPropostaTemplates());
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { recarregar(); }, []);

  const templatesOrdenados = useMemo(
    () => [...templates].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [templates],
  );

  const abrirNovo = () => {
    setEditando({ id: '', nome: '', campos: {} });
    setNome('');
    setCampos(formularioVazio());
  };

  const abrirEdicao = (tpl: PropostaTemplate) => {
    setEditando(tpl);
    setNome(tpl.nome);
    setCampos({ ...formularioVazio(), ...tpl.campos });
  };

  const fechar = () => {
    if (salvando) return;
    setEditando(null);
    setNome('');
    setCampos(formularioVazio());
  };

  const salvar = async () => {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return toast.error('Dê um nome ao template.');

    const camposPreenchidos: Partial<Record<CampoTemplateProposta, string>> = {};
    CAMPOS_TEMPLATE_PROPOSTA.forEach((campo) => {
      const valor = String(campos[campo] ?? '').trim();
      if (valor) camposPreenchidos[campo] = valor;
    });
    if (Object.keys(camposPreenchidos).length === 0) {
      return toast.error('Preencha ao menos um campo antes de salvar.');
    }

    const criandoNovo = !editando?.id;
    if (criandoNovo) {
      const existente = templates.find((t) => t.nome.toLowerCase() === nomeLimpo.toLowerCase());
      if (existente && !(await confirmDialog(`Já existe um template "${existente.nome}". Substituir o conteúdo dele?`))) return;
    }

    setSalvando(true);
    try {
      const alvoId = criandoNovo
        ? templates.find((t) => t.nome.toLowerCase() === nomeLimpo.toLowerCase())?.id
        : editando!.id;

      if (alvoId) {
        await updatePropostaTemplate(alvoId, nomeLimpo, camposPreenchidos, autor);
      } else {
        await createPropostaTemplate(nomeLimpo, camposPreenchidos, autor);
      }
      await recarregar();
      toast.success(`Template "${nomeLimpo}" salvo com ${Object.keys(camposPreenchidos).length} campo(s).`);
      fechar();
    } catch (error) {
      console.error('Erro ao salvar template de proposta:', error);
      toast.error('Não foi possível salvar o template. Verifique a conexão com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (tpl: PropostaTemplate) => {
    if (!(await confirmDialog({ message: `Excluir o template "${tpl.nome}"? Essa ação não pode ser desfeita.`, danger: true, confirmText: 'Excluir' }))) return;
    try {
      await deletePropostaTemplate(tpl.id);
      await recarregar();
      toast.success(`Template "${tpl.nome}" excluído.`);
      if (editando?.id === tpl.id) fechar();
    } catch (error) {
      console.error('Erro ao excluir template de proposta:', error);
      toast.error('Não foi possível excluir o template.');
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl shadow-lg shadow-violet-500/20 text-white">
            <FileText size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Templates de Proposta</h1>
            <p className="text-white/50 text-sm mt-1">Crie, edite e exclua os modelos de texto usados em "Fazer Proposta" (Aplicar Template Salvo).</p>
          </div>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
        >
          <Plus size={16} /> Novo Template
        </button>
      </div>

      {carregando ? (
        <p className="text-white/40 text-sm">Carregando templates...</p>
      ) : templatesOrdenados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-white/40 text-sm">
          Nenhum template cadastrado ainda. Crie um aqui ou em "Fazer Proposta" → Salvar como Template.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templatesOrdenados.map((tpl) => {
            const qtdCampos = Object.keys(tpl.campos || {}).length;
            return (
              <article key={tpl.id} className="rounded-2xl border border-white/10 bg-[#0b1220]/80 p-5 space-y-3 shadow-lg shadow-black/10">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-white font-bold text-base leading-tight">{tpl.nome}</h3>
                  <span className="shrink-0 px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-200 text-[10px] font-bold uppercase">
                    {qtdCampos} campo{qtdCampos === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="text-white/40 text-xs space-y-0.5">
                  {tpl.criadoPor && <p>Criado por: <span className="text-white/60">{tpl.criadoPor}</span></p>}
                  <p>Atualizado em: <span className="text-white/60">{formatarData(tpl.atualizadoEm || tpl.criadoEm)}</span></p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => abrirEdicao(tpl)}
                    className="flex-1 flex items-center justify-center gap-2 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    <Pencil size={13} /> Editar
                  </button>
                  <button
                    onClick={() => excluir(tpl)}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    <Trash2 size={13} /> Excluir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-[32px] border border-white/10 bg-[#0b1220] shadow-2xl">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/35 font-black">Template de Proposta</p>
                <h2 className="text-2xl font-black text-white mt-2">{editando.id ? 'Editar template' : 'Novo template'}</h2>
              </div>
              <button onClick={fechar} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)] space-y-4">
              <div>
                <label className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1 block">Nome do template *</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Docagem preventiva"
                  className="w-full bg-[#101826] border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-violet-500"
                />
              </div>

              {CAMPOS_TEMPLATE_PROPOSTA.map((campo) => (
                <div key={campo}>
                  <label className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1 block">{ROTULOS_CAMPO_TEMPLATE[campo]}</label>
                  <textarea
                    value={campos[campo] ?? ''}
                    onChange={(e) => setCampos((prev) => ({ ...prev, [campo]: e.target.value }))}
                    rows={campo === 'saudacao' || campo === 'assunto' || campo === 'prazo' || campo === 'efetivoPrevisto' ? 1 : 3}
                    className="w-full bg-[#101826] border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-violet-500 resize-y"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 p-6 border-t border-white/5">
              <button onClick={fechar} className="px-6 py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-colors font-bold text-xs uppercase tracking-wider">
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2 justify-center disabled:opacity-50"
              >
                <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
