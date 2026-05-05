import React, { useEffect, useState } from 'react';
import { Building2, Edit2, Plus, Save, Trash2, X } from 'lucide-react';
import { useErp } from '../../../context/ErpContext';

interface EmpresaPrestadora {
  id: string;
  nome: string;
  cnpj: string;
  endereco: string;
  contato: string;
  email: string;
  ativa: boolean;
}

const EMPTY_FORM = {
  nome: '',
  cnpj: '',
  endereco: '',
  contato: '',
  email: ''
};

const criarIdEmpresa = (nome: string) => {
  const slug = nome
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `EMP-${slug || Date.now()}`;
};

const normalizarEmpresasPrestadoras = (config: any): EmpresaPrestadora[] => {
  const empresasCadastradas = Array.isArray(config?.empresasPrestadoras)
    ? config.empresasPrestadoras
    : [];

  const fallbackNome = config?.empresaNome && config.empresaNome !== 'Linave ERP Demo'
    ? config.empresaNome
    : 'Linave';

  const origem = empresasCadastradas.length > 0
    ? empresasCadastradas
    : [{
        id: 'EMP-LINAVE',
        nome: fallbackNome,
        cnpj: config?.empresaCnpj || '',
        endereco: config?.empresaEnd || '',
        contato: '',
        email: '',
        ativa: true
      }];

  const empresasUnicas = new Map<string, EmpresaPrestadora>();

  origem.forEach((empresa: any, index: number) => {
    const nomeBase = typeof empresa === 'string'
      ? empresa
      : empresa?.nome || empresa?.razaoSocial || empresa?.empresaNome || '';
    const nome = String(nomeBase).trim();

    if (!nome) return;

    const chave = nome.toLowerCase();
    if (empresasUnicas.has(chave)) return;

    empresasUnicas.set(chave, {
      id: typeof empresa === 'object' && empresa?.id ? empresa.id : `${criarIdEmpresa(nome)}-${index}`,
      nome,
      cnpj: typeof empresa === 'object' ? empresa?.cnpj || empresa?.empresaCnpj || '' : '',
      endereco: typeof empresa === 'object' ? empresa?.endereco || empresa?.empresaEnd || '' : '',
      contato: typeof empresa === 'object' ? empresa?.contato || '' : '',
      email: typeof empresa === 'object' ? empresa?.email || '' : '',
      ativa: typeof empresa === 'object' && empresa?.ativa === false ? false : true
    });
  });

  const empresasNormalizadas = Array.from(empresasUnicas.values());

  return empresasNormalizadas.length > 0
    ? empresasNormalizadas
    : [{
        id: 'EMP-LINAVE',
        nome: fallbackNome || 'Linave',
        cnpj: '',
        endereco: '',
        contato: '',
        email: '',
        ativa: true
      }];
};

export function EmpresasPrestadorasView() {
  const { config, saveConfig } = useErp();
  const [empresas, setEmpresas] = useState<EmpresaPrestadora[]>(() => normalizarEmpresasPrestadoras(config));
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmpresas(normalizarEmpresasPrestadoras(config));
  }, [config?.empresasPrestadoras, config?.empresaNome, config?.empresaCnpj, config?.empresaEnd]);

  const labelClass = 'text-[10px] font-black text-white/40 uppercase tracking-widest ml-1 mb-2 block';
  const inputClass = 'w-full bg-[#0b1220] border border-white/10 p-4 rounded-xl text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20';

  const limparFormulario = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmitEmpresa = (e: React.FormEvent) => {
    e.preventDefault();

    const nome = formData.nome.trim();
    if (!nome) {
      alert('Informe o nome da empresa prestadora.');
      return;
    }

    const nomeJaExiste = empresas.some((empresa) =>
      empresa.nome.trim().toLowerCase() === nome.toLowerCase() && empresa.id !== editingId
    );

    if (nomeJaExiste) {
      alert('Já existe uma empresa prestadora com esse nome.');
      return;
    }

    const empresaAtualizada: EmpresaPrestadora = {
      id: editingId || criarIdEmpresa(nome),
      nome,
      cnpj: formData.cnpj.trim(),
      endereco: formData.endereco.trim(),
      contato: formData.contato.trim(),
      email: formData.email.trim(),
      ativa: true
    };

    setEmpresas((atuais) => (
      editingId
        ? atuais.map((empresa) => empresa.id === editingId ? empresaAtualizada : empresa)
        : [...atuais, empresaAtualizada]
    ));
    limparFormulario();
  };

  const handleEditar = (empresa: EmpresaPrestadora) => {
    setEditingId(empresa.id);
    setFormData({
      nome: empresa.nome,
      cnpj: empresa.cnpj,
      endereco: empresa.endereco,
      contato: empresa.contato,
      email: empresa.email
    });
  };

  const handleRemover = (id: string) => {
    if (empresas.length <= 1) {
      alert('Mantenha pelo menos uma empresa prestadora cadastrada.');
      return;
    }

    setEmpresas((atuais) => atuais.filter((empresa) => empresa.id !== id));
    if (editingId === id) limparFormulario();
  };

  const handleSalvarAlteracoes = async () => {
    setSaving(true);
    try {
      await saveConfig({
        ...config,
        empresasPrestadoras: empresas
      });
      alert('Empresas prestadoras salvas com sucesso.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-amber-500 rounded-2xl text-[#0b1220]">
            <Building2 size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Empresas Prestadoras</h1>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">
              Cadastro usado no novo negócio
            </p>
          </div>
        </div>
        <button
          onClick={handleSalvarAlteracoes}
          disabled={saving}
          className="bg-amber-500 text-[#0b1220] px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:scale-100"
        >
          <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-8">
        <form onSubmit={handleSubmitEmpresa} className="bg-[#101f3d] p-6 rounded-[32px] border border-white/5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-black uppercase text-sm tracking-widest">
              {editingId ? 'Editar Empresa' : 'Nova Empresa'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={limparFormulario}
                className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div>
            <label className={labelClass}>Nome / Razão Social *</label>
            <input
              className={inputClass}
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Linave"
            />
          </div>

          <div>
            <label className={labelClass}>CNPJ</label>
            <input
              className={inputClass}
              value={formData.cnpj}
              onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div>
            <label className={labelClass}>Endereço</label>
            <input
              className={inputClass}
              value={formData.endereco}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              placeholder="Cidade / UF"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
            <div>
              <label className={labelClass}>Contato</label>
              <input
                className={inputClass}
                value={formData.contato}
                onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                placeholder="Telefone"
              />
            </div>

            <div>
              <label className={labelClass}>E-mail</label>
              <input
                className={inputClass}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="comercial@empresa.com"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#0b1220] px-6 py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus size={18} /> {editingId ? 'Atualizar Empresa' : 'Adicionar Empresa'}
          </button>
        </form>

        <div className="bg-[#101f3d] p-6 rounded-[32px] border border-white/5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-black uppercase text-sm tracking-widest">Empresas Cadastradas</h2>
            <span className="text-[10px] text-amber-400 font-black uppercase tracking-widest">
              {empresas.length} registro(s)
            </span>
          </div>

          <div className="space-y-3">
            {empresas.map((empresa) => (
              <div key={empresa.id} className="bg-[#0b1220] border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/10 rounded-xl text-amber-400 flex items-center justify-center border border-amber-500/20">
                      <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-black truncate">{empresa.nome}</p>
                      <p className="text-white/40 text-xs truncate">
                        {empresa.cnpj || 'CNPJ não informado'} {empresa.endereco ? `• ${empresa.endereco}` : ''}
                      </p>
                    </div>
                  </div>
                  {(empresa.contato || empresa.email) && (
                    <p className="text-white/40 text-xs mt-3 ml-[52px]">
                      {[empresa.contato, empresa.email].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleEditar(empresa)}
                    className="p-3 rounded-xl bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleRemover(empresa.id)}
                    className="p-3 rounded-xl bg-red-500/10 text-red-300 hover:bg-red-500/20 transition"
                    title="Remover"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
