import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Pencil, Trash2, X, Check, Shield, ShieldOff, Loader2,
  ChevronDown, ChevronRight, UserCog,
} from 'lucide-react';
import { useErp } from '../../../context/ErpContext';
import { fetchUsuarios, createUsuario, updateUsuario, deleteUsuario } from '../../../../services/authService';
import { PasswordStrength, senhaValida } from '../../PasswordStrength';
import { boldOS } from '../../../utils/osHighlight';
import { toast } from 'sonner';
import { confirmDialog } from '../../ui/feedback';

// ─── Mapa de permissões por departamento ───────────────────────────────────
const PERMISSAO_GRUPOS = [
  {
    id: 'gestao',
    label: 'Gestão & Estratégia',
    itens: [
      { id: 'dashboard', label: 'Dashboard Geral' },
      { id: 'relatorios', label: 'Relatórios BI' },
    ],
  },
  {
    id: 'producao',
    label: 'Produção',
    itens: [
      { id: 'obras', label: 'Serviços (Produção)' },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    itens: [
      { id: 'crm', label: 'Negócios (CRM)' },
      { id: 'orcamentos', label: 'Orçar Negócios' },
      { id: 'proposta', label: 'Fazer Proposta' },
      { id: 'fazerOs', label: boldOS('Fazer OS') },
      { id: 'medicao', label: 'Medição' },
      { id: 'finalizadosComercial', label: 'Finalizados' },
      { id: 'clientes', label: 'Base de Clientes' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    // "Solicitação de Pagamento" é liberada a todos os usuários (todo colaborador pode
    // solicitar; a aprovação continua controlada), por isso não entra aqui.
    itens: [
      { id: 'finDashboard', label: 'Dashboard Financeiro' },
      { id: 'finAprovacoes', label: 'Aprovações' },
      { id: 'finPagar', label: 'Contas a Pagar' },
      { id: 'finNfe', label: 'NFe' },
      { id: 'finReceber', label: 'Contas a Receber' },
      { id: 'finPrevisao', label: 'Previsão de Receita' },
      { id: 'finBancos', label: 'Bancos' },
      { id: 'finHistorico', label: 'Histórico' },
      { id: 'finCustoOs', label: boldOS('Custo por OS') },
      { id: 'finReciboLocacao', label: 'Fazer Recibo de Locação' },
    ],
  },
  {
    id: 'compras',
    label: 'Compras',
    // "Compras / Requisições" e "Minhas Compras" são liberadas a todos os usuários
    // (todo colaborador pode solicitar e ver o próprio histórico), por isso não entram aqui.
    itens: [
      { id: 'kanbanCompras', label: 'Kanban de Compras' },
      { id: 'aprovacoesCompras', label: 'Aprovações' },
      { id: 'historicoCompras', label: 'Histórico de Compras' },
      { id: 'fornecedores', label: 'Fornecedores' },
    ],
  },
  {
    id: 'almoxerifado',
    label: 'Suprimentos',
    itens: [
      { id: 'estoquePublico', label: 'Estoque View' },
      { id: 'estoque', label: 'Almoxarifado' },
      { id: 'itensAdicionar', label: 'Itens para adicionar' },
      { id: 'historicoBaixa', label: 'Histórico de Baixa' },
      { id: 'historicoRomaneio', label: 'Histórico de Romaneio' },
      { id: 'alocadosPorOS', label: boldOS('Alocados por OS') },
    ],
  },
];

type RoleKey = 'admin' | 'gerente' | 'usuario';

interface Usuario {
  cpf: string;
  nome: string;
  email: string;
  cargo: string;
  departamento: string;
  is_superuser: boolean;
  is_active: boolean;
  role: RoleKey;
  permissoes: Record<string, boolean>;
}

interface FormState {
  cpf: string;
  nome: string;
  email: string;
  cargo: string;
  departamento: string;
  password: string;
  role: RoleKey;
  permissoes: Record<string, boolean>;
}

const EMPTY_FORM: FormState = {
  cpf: '', nome: '', email: '', cargo: '', departamento: '',
  password: '', role: 'usuario', permissoes: {},
};

const ROLE_CONFIG: Record<RoleKey, { label: string; cor: string; icone: React.ReactNode }> = {
  admin: {
    label: 'Admin',
    cor: 'bg-amber-500/15 text-amber-400',
    icone: <Shield size={10} />,
  },
  gerente: {
    label: 'Gerente',
    cor: 'bg-purple-500/15 text-purple-400',
    icone: <UserCog size={10} />,
  },
  usuario: {
    label: 'Usuário',
    cor: 'bg-blue-500/10 text-blue-400',
    icone: <ShieldOff size={10} />,
  },
};

// ─── Painel de Permissões ──────────────────────────────────────────────────
function PainelPermissoes({
  permissoes,
  onChange,
}: {
  permissoes: Record<string, boolean>;
  onChange: (p: Record<string, boolean>) => void;
}) {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setAbertos((p) => ({ ...p, [id]: !p[id] }));

  const toggleItem = (itemId: string, val: boolean) => {
    onChange({ ...permissoes, [itemId]: val });
  };

  const toggleGrupo = (grupo: (typeof PERMISSAO_GRUPOS)[0]) => {
    const todosAtivos = grupo.itens.every((i) => permissoes[i.id]);
    const update = { ...permissoes };
    grupo.itens.forEach((i) => { update[i.id] = !todosAtivos; });
    onChange(update);
  };

  return (
    <div className="space-y-2">
      {PERMISSAO_GRUPOS.map((grupo) => {
        const ativos = grupo.itens.filter((i) => permissoes[i.id]).length;
        const total = grupo.itens.length;
        const estaAberto = !!abertos[grupo.id];

        return (
          <div key={grupo.id} className="rounded-xl border border-white/10 overflow-hidden">
            {/* Cabeçalho do grupo */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white/3 hover:bg-white/5 transition-colors">
              <input
                type="checkbox"
                checked={ativos === total}
                ref={(el) => { if (el) el.indeterminate = ativos > 0 && ativos < total; }}
                onChange={() => toggleGrupo(grupo)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => toggle(grupo.id)}
                className="flex-1 flex items-center justify-between text-left"
              >
                <span className="text-white/80 text-xs font-black uppercase tracking-widest">
                  {grupo.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-white/30 text-[10px]">{ativos}/{total}</span>
                  {estaAberto ? <ChevronDown size={12} className="text-white/40" /> : <ChevronRight size={12} className="text-white/40" />}
                </div>
              </button>
            </div>

            {/* Itens do grupo */}
            {estaAberto && (
              <div className="divide-y divide-white/5">
                {grupo.itens.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 px-6 py-2.5 hover:bg-white/3 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={!!permissoes[item.id]}
                      onChange={(e) => toggleItem(item.id, e.target.checked)}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span className="text-white/60 text-xs">{item.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente Principal ──────────────────────────────────────────────────
export function UsuariosView() {
  const { userSession } = useErp();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });

  const isAdmin = userSession?.role === 'ADMIN';

  const carregarUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const lista = await fetchUsuarios();
      setUsuarios(lista);
    } catch {
      setErro('Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarUsuarios(); }, [carregarUsuarios]);

  const abrirCriar = () => {
    setEditando(null);
    setForm({ ...EMPTY_FORM });
    setErro('');
    setModalAberto(true);
  };

  const abrirEditar = (u: Usuario) => {
    setEditando(u);
    setForm({
      cpf: u.cpf,
      nome: u.nome,
      email: u.email,
      cargo: u.cargo || '',
      departamento: u.departamento || '',
      password: '',
      role: u.role || (u.is_superuser ? 'admin' : 'usuario'),
      permissoes: u.permissoes || {},
    });
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => { setModalAberto(false); setEditando(null); setErro(''); };

  const handleSalvar = async () => {
    if (!form.cpf.trim()) { setErro('CPF é obrigatório.'); return; }
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return; }
    if (!editando && !form.password) { setErro('Senha é obrigatória para novo usuário.'); return; }
    if (form.password && !senhaValida(form.password)) {
      setErro('A senha não atende aos requisitos de segurança.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      const payload: any = {
        cpf: form.cpf.trim(),
        nome: form.nome.trim(),
        email: form.email.trim(),
        cargo: form.cargo.trim(),
        departamento: form.departamento.trim(),
        role: form.role,
        permissoes: form.role === 'usuario' ? form.permissoes : {},
      };
      if (form.password) payload.password = form.password;

      if (editando) {
        const atualizado = await updateUsuario(editando.cpf, payload);
        setUsuarios((prev) => prev.map((u) => (u.cpf === editando.cpf ? atualizado : u)));
      } else {
        const criado = await createUsuario(payload);
        setUsuarios((prev) => [...prev, criado]);
      }
      fecharModal();
    } catch (e: any) {
      const detail = e?.response?.data;
      if (typeof detail === 'object') {
        const msgs = Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        setErro(msgs.join(' | '));
      } else {
        setErro('Erro ao salvar usuário.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (u: Usuario) => {
    if (u.role === 'admin' || u.is_superuser) {
      toast.error('Não é possível excluir o administrador.');
      return;
    }
    if (!(await confirmDialog({ message: `Excluir usuário "${u.nome}" (${u.cpf})?`, danger: true, confirmText: 'Excluir' }))) return;
    try {
      await deleteUsuario(u.cpf);
      setUsuarios((prev) => prev.filter((x) => x.cpf !== u.cpf));
    } catch {
      toast.error('Erro ao excluir usuário.');
    }
  };

  const inputCls = "w-full bg-[#0b1220] border border-white/10 p-3 rounded-xl text-white text-sm outline-none focus:border-amber-500 transition-all placeholder:text-white/20";
  const labelCls = "block text-white/50 text-[10px] font-bold uppercase tracking-widest mb-1.5";

  if (!isAdmin) {
    return (
      <div className="p-12 text-center">
        <p className="text-red-400 font-black uppercase tracking-widest">Acesso restrito</p>
        <p className="text-white/20 text-xs mt-2">Apenas administradores podem gerenciar usuários.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-white font-black text-lg">Usuários do Sistema</h2>
            <p className="text-white/30 text-xs mt-0.5">{usuarios.length} cadastrado{usuarios.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={abrirCriar}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#0b1220] px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
        >
          <Plus size={15} /> Novo Usuário
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-[#101f3d] rounded-[28px] border border-white/5 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-white/40">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-bold uppercase tracking-widest">Carregando...</span>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-white/30">
            <Users size={32} />
            <p className="text-sm font-bold uppercase tracking-widest">Nenhum usuário cadastrado</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/5 text-[9px] font-black text-white/30 uppercase tracking-widest border-b border-white/5">
              <tr>
                <th className="p-4">Nome</th>
                <th className="p-4">CPF</th>
                <th className="p-4">Cargo</th>
                <th className="p-4">Email</th>
                <th className="p-4 text-center">Nível</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {usuarios.map((u) => {
                const roleKey: RoleKey = u.role || (u.is_superuser ? 'admin' : 'usuario');
                const cfg = ROLE_CONFIG[roleKey] || ROLE_CONFIG.usuario;
                return (
                  <tr key={u.cpf} className="hover:bg-white/3 transition-colors">
                    <td className="p-4">
                      <p className="text-white font-bold text-sm">{u.nome}</p>
                    </td>
                    <td className="p-4 text-white/50 text-xs font-mono">{u.cpf}</td>
                    <td className="p-4 text-white/50 text-xs">{u.cargo || '—'}</td>
                    <td className="p-4 text-white/50 text-xs">{u.email || '—'}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${cfg.cor}`}>
                        {cfg.icone} {cfg.label}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => abrirEditar(u)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-amber-500/20 text-white/40 hover:text-amber-400 transition-all"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        {roleKey !== 'admin' && (
                          <button
                            onClick={() => handleExcluir(u)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-[#101f3d] border border-white/10 rounded-[28px] w-full max-w-xl shadow-2xl my-6">

            {/* Header modal */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
                  <Users size={16} />
                </div>
                <h3 className="text-white font-black text-base">
                  {editando ? 'Editar Usuário' : 'Novo Usuário'}
                </h3>
              </div>
              <button onClick={fecharModal} className="p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Body modal */}
            <div className="p-6 space-y-5">
              {erro && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <p className="text-red-400 text-xs font-bold">{erro}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>CPF *</label>
                  <input
                    className={inputCls}
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
                    disabled={!!editando}
                  />
                </div>

                <div className="col-span-2">
                  <label className={labelCls}>Nome *</label>
                  <input
                    className={inputCls}
                    placeholder="Nome completo"
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  />
                </div>

                <div>
                  <label className={labelCls}>Cargo</label>
                  <input
                    className={inputCls}
                    placeholder="Ex.: Analista"
                    value={form.cargo}
                    onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                  />
                </div>

                <div>
                  <label className={labelCls}>Departamento</label>
                  <input
                    className={inputCls}
                    placeholder="Ex.: Comercial"
                    value={form.departamento}
                    onChange={(e) => setForm((f) => ({ ...f, departamento: e.target.value }))}
                  />
                </div>

                <div className="col-span-2">
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="email@empresa.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div className="col-span-2">
                  <label className={labelCls}>
                    {editando ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha *'}
                  </label>
                  <input
                    type="password"
                    className={inputCls}
                    placeholder={editando ? 'Nova senha (opcional)' : 'Senha inicial'}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                  <PasswordStrength senha={form.password} />
                </div>

                {/* Seletor de Nível */}
                <div className="col-span-2">
                  <label className={labelCls}>Nível de Acesso *</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(Object.entries(ROLE_CONFIG) as [RoleKey, typeof ROLE_CONFIG[RoleKey]][]).map(([key, cfg]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, role: key }))}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                          form.role === key
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-white/10 bg-white/3 hover:border-white/20'
                        }`}
                      >
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${cfg.cor}`}>
                          {cfg.icone} {cfg.label}
                        </span>
                        <span className="text-white/30 text-[10px] text-center leading-snug">
                          {key === 'admin' && 'Acesso total'}
                          {key === 'gerente' && 'Todo o sistema'}
                          {key === 'usuario' && 'Acesso limitado'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Painel de permissões — apenas para role 'usuario' */}
              {form.role === 'usuario' && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-white/40 text-[10px] font-black uppercase tracking-widest px-2">
                      Permissões de Acesso
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <PainelPermissoes
                    permissoes={form.permissoes}
                    onChange={(p) => setForm((f) => ({ ...f, permissoes: p }))}
                  />
                </div>
              )}

              {form.role === 'gerente' && (
                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                  <p className="text-purple-300 text-xs font-bold">
                    O Gerente tem acesso a todo o sistema, exceto o gerenciamento de usuários.
                    Dentro de Configurações, poderá alterar apenas seu e-mail e senha.
                  </p>
                </div>
              )}

              {form.role === 'admin' && (
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <p className="text-amber-300 text-xs font-bold">
                    O Admin tem acesso irrestrito a todo o sistema, incluindo criação e edição de usuários.
                  </p>
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5">
              <button
                onClick={fecharModal}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-black uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0b1220] text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {editando ? 'Salvar' : 'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
