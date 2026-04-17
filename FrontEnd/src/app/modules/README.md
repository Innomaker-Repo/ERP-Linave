# Estrutura do Módulo Consolidado

## Arquitetura

```
src/app/modules/
├── Gestao/
│   └── index.tsx              # Dashboard, CRM, Relatórios
├── Producao/
│   └── index.tsx              # Obras, Serviços
├── Comercial/
│   └── index.tsx              # OS, Clientes
├── Financeiro/
│   └── index.tsx              # Fluxo de Caixa
├── Compras/
│   └── index.tsx              # Compras, Fornecedores
├── Almoxerifado/
│   └── index.tsx              # Estoque
├── Configuracoes/
│   └── index.tsx              # Usuários, Listas, Templates
├── shared/
│   ├── ui/                    # Componentes de UI reutilizáveis
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   └── ... (40+ componentes)
│   └── figma/                 # Componentes Figma
│       └── ImageWithFallback.tsx
├── index.ts                   # Exports centralizados
└── README.md                  # Este arquivo
```

## Vantagens da Nova Estrutura

- **Menos arquivos para alterar** - Uma mudança em uma aba afeta apenas um arquivo
- **Melhor organização** - Componentes compartilhados em `shared/`
- **Imports simplificados** - Pode usar `from '@app/modules'` para tudo
- **Escalável** - Fácil adicionar novos itens a uma aba
- **Mantém visual idêntico** - Nenhuma mudança na aparência

## Como Adicionar Novo Item a uma Aba

Exemplo: Adicionar "Orçamento" à aba Financeiro

1. **Crie o componente** em `components/modules/Financeiro/OrcamentoView.tsx`
2. **Atualize** `modules/Financeiro/index.tsx`:
   ```tsx
   case 'orcamento':
     return <OrcamentoView searchQuery={searchQuery} />;
   ```
3. **Atualize Sidebar.tsx** para adicionar o item ao menu

## Como Usar Componentes Compartilhados

```tsx
// Em qualquer arquivo de aba
import { Button, Input, Card, Badge } from '../../shared/ui';
// ou
import { Button } from '../../shared/ui/button';
```

## Mapeamento de Abas

| Aba | ID | Items |
|-----|----|----|
| Gestão & Estratégia | `gestao` | dashboard, crm, relatorios |
| Produção | `producao` | obras, servicos |
| Comercial | `comercial` | os, clientes |
| Financeiro | `financeiro` | financeiro |
| Compras | `compras` | compras, fornecedores |
| Almoxerifado | `almoxerifado` | estoque |
| Configurações | `config` | usuarios, listas, templates |
