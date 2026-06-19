// Extrai a lista de itens cadastrados no Estoque/Almoxarifado para popular os
// dropdowns de Equipamento da Alocação (CRM) e da Locação (Orçamento).
// O estado do almoxarifado vem do ErpContext (`almoxerifado`): tables[].rows[].values,
// onde cada row guarda os dados em `values` keyed por coluna (material, unidade/unid, qtd...).

export interface EstoqueItemOption {
  nome: string;
  unidade: string;
}

export const getEstoqueItens = (almoxerifado: any): EstoqueItemOption[] => {
  const tables = Array.isArray(almoxerifado?.tables) ? almoxerifado.tables : [];
  const out: EstoqueItemOption[] = [];
  const seen = new Set<string>();
  for (const table of tables) {
    const rows = Array.isArray(table?.rows) ? table.rows : [];
    for (const row of rows) {
      const v = (row && (row.values || row)) || {};
      const nome = String(v.material || v.item || v.nome || '').trim();
      if (!nome) continue;
      const chave = nome.toLowerCase();
      if (seen.has(chave)) continue;
      seen.add(chave);
      const unidade = String(v.unidade || v.unid || 'un').trim() || 'un';
      out.push({ nome, unidade });
    }
  }
  return out.sort((a, b) => a.nome.localeCompare(b.nome));
};
