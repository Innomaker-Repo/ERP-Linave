// src/app/types/erp.ts

export interface Funcionario {
  id: string;
  nome: string;
  cpf: string;
  valorHora: number;      // Base para Folha e Financeiro
  valorHoraExtra: number;
  cargo: string;
  equipeId?: string;      // Conexão com Equipes
  status: 'Ativo' | 'Férias' | 'Desligado';
}

export interface Obra {
  id: string;
  clienteId: string;      // Conexão com Clientes
  nome: string;
  orcamentoPrevisto: number;
  custoAtual: number;     // Soma de (Horas Trabalhadas + Gastos Financeiros)
  dataInicio: string;
  status: 'Planejamento' | 'Execução' | 'Finalizada';
  categoria: 'Planejamento' | 'Negociação' | 'Em Andamento' | 'Finalização';
}
export interface Servico {
  id: string;
  tipo: string;           // Tipo de Serviço
  categoria: string;      // Categoria
  embarcacao: string;     // Embarcação/Obra
  localExecucao: string;  // Local Execução
  porto: string;          // Porto
  urgencia: 'Baixa' | 'Normal' | 'Alta' | 'Crítica';
  prazoDes: string;       // Prazo Desejado (data)
  descricao: string;      // Descrição da Solicitação
  observacoes?: string;   // Observações Internas
}
export interface RegistroHora {
  id: string;
  funcionarioId: string;
  obraId: string;
  osId?: string;
  horas: number;
  tipo: 'Normal' | 'Extra' | 'Noturna';
  data: string;
}