import React, { useState } from 'react';
import { Plus, Pencil, X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { FinCard, Toolbar, Field, Input, Select, Btn, DataTable, Th, Td, CompanyTag, EmptyRow, DeleteBtn } from '../finUi';
import { genFinId } from '../finData';
import { useFin } from '../useFin';

const formVazio = (empresaPadrao: string) => ({ nome: '', empresa: empresaPadrao, tipo: 'Conta corrente', pix: '' });

// Leitura/escrita reais: bancos guardados em `financeiro` (tipo 'banco'); empresas vêm
// das empresas prestadoras configuradas no ERP.
export function BancosView() {
  const { empresas, records, addRecord, updateRecords, deleteRecord } = useFin();
  const bancos = records('banco');
  const [form, setForm] = useState(formVazio(empresas[0] || 'Linave'));
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeOriginal, setNomeOriginal] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const abrirEdicao = (b: any) => {
    setEditandoId(b.id);
    setNomeOriginal(b.nome || '');
    setForm({ nome: b.nome || '', empresa: b.empresa || empresas[0] || 'Linave', tipo: b.tipoConta || 'Conta corrente', pix: b.pix && b.pix !== '-' ? b.pix : '' });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setNomeOriginal('');
    setForm(formVazio(empresas[0] || 'Linave'));
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      if (editandoId) {
        const novoNome = form.nome.trim();
        const nomeAntigo = nomeOriginal.trim();
        // Nome do banco é copiado como texto em Contas a Pagar (`banco`) e Contas a
        // Receber (`bancoRecebimento`) no momento do pagamento/recebimento — não é uma
        // referência viva, então precisa ser reescrito aqui para acompanhar o rename.
        const propagar = !!nomeAntigo && !!novoNome && nomeAntigo !== novoNome;
        await updateRecords((r) => {
          if (r.id === editandoId) {
            return { ...r, nome: form.nome, empresa: form.empresa, tipoConta: form.tipo, pix: form.pix || '-' };
          }
          if (!propagar) return r;
          return {
            ...r,
            ...(r.banco === nomeAntigo ? { banco: novoNome } : {}),
            ...(r.bancoRecebimento === nomeAntigo ? { bancoRecebimento: novoNome } : {}),
          };
        });
        if (propagar) toast.info('Banco renomeado — contas a pagar e a receber já criadas foram atualizadas.');
        setEditandoId(null);
        setNomeOriginal('');
        setForm(formVazio(empresas[0] || 'Linave'));
      } else {
        await addRecord({
          id: genFinId('BNK'), tipo: 'banco',
          nome: form.nome, empresa: form.empresa, tipoConta: form.tipo, pix: form.pix || '-',
        });
        setForm((p) => ({ ...p, nome: '', pix: '' }));
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <FinCard>
        <Toolbar
          title={editandoId ? 'Editar Banco' : 'Cadastro de Bancos'}
          hint="O banco não é definido na solicitação; é escolhido aqui e usado ao pagar/receber."
        />
        <form className="grid grid-cols-12 gap-4" onSubmit={add}>
          <Field label="Banco" span={6}><Input value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Nome do banco" /></Field>
          <Field label="Empresa" span={3}>
            <Select value={form.empresa} onChange={(e) => set('empresa', e.target.value)}>
              {empresas.map((emp) => <option key={emp}>{emp}</option>)}
              <option>Ambas</option>
            </Select>
          </Field>
          <Field label="Tipo" span={3}>
            <Select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
              <option>Conta corrente</option><option>Conta pagamento</option><option>Caixa interno</option>
            </Select>
          </Field>
          <Field label="PIX" span={6}><Input value={form.pix} onChange={(e) => set('pix', e.target.value)} placeholder="Chave PIX" /></Field>
          <div className="col-span-12 flex gap-2">
            <Btn variant="amber" type="submit" disabled={salvando}>
              {editandoId ? <Save size={15} /> : <Plus size={15} />}
              {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Cadastrar banco'}
            </Btn>
            {editandoId && (
              <Btn variant="ghost" type="button" onClick={cancelarEdicao}><X size={15} /> Cancelar edição</Btn>
            )}
          </div>
        </form>
      </FinCard>

      <FinCard>
        <Toolbar title="Bancos cadastrados" />
        <DataTable head={<><Th>Banco</Th><Th>Empresa</Th><Th>Tipo</Th><Th>PIX</Th><Th>Ação</Th></>}>
          {bancos.length === 0 ? (
            <EmptyRow cols={5} text="Nenhum banco cadastrado" />
          ) : bancos.map((b) => (
            <tr key={b.id} className={`transition-colors hover:bg-white/5 ${editandoId === b.id ? 'bg-amber-500/[0.06]' : ''}`}>
              <Td className="font-bold text-white">{b.nome}</Td>
              <Td><CompanyTag empresa={String(b.empresa)} /></Td>
              <Td className="text-white/70">{b.tipoConta}</Td>
              <Td className="text-white/60">{b.pix || '-'}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <Btn small variant="secondary" onClick={() => abrirEdicao(b)}><Pencil size={13} /> Editar</Btn>
                  <DeleteBtn
                    titulo="Excluir banco"
                    descricao={`${b.nome} (${b.empresa})\n\nContas já pagas ou recebidas por este banco mantêm o nome registrado no histórico, mas ele deixa de aparecer para novas movimentações.`}
                    onConfirm={() => deleteRecord(b.id)}
                  />
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      </FinCard>
    </div>
  );
}
