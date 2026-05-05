import type { Cliente } from '../types/erp';

export const CLIENTES_MOCK: Cliente[] = [
  {
    id: 'CLI-1',
    tipoPessoa: 'PJ',
    razaoSocial: 'Subsea 7 Brasil LTDA',
    nomeFantasia: 'Subsea 7',
    cpfCnpj: '12.345.678/0001-90',
    inscricaoEstadual: 'ISENTO',
    status: 'Ativo',
    contato: '(27) 4000-2001 / contato@subsea7.com',
    endereco: 'Base UBU, Anchieta - ES',
    dataCadastro: '2026-02-01',
    usuarioResponsavel: 'admin@modo-teste.com'
  },
  {
    id: 'CLI-2',
    tipoPessoa: 'PJ',
    razaoSocial: 'Seven Ocean Operacoes Maritimas S.A.',
    nomeFantasia: 'Seven Ocean',
    cpfCnpj: '23.456.789/0001-01',
    inscricaoEstadual: 'ISENTO',
    status: 'Ativo',
    contato: '(21) 4000-2002 / projetos@sevenocean.com',
    endereco: 'Ilha da Conceicao, Niteroi - RJ',
    dataCadastro: '2026-02-02',
    usuarioResponsavel: 'admin@modo-teste.com'
  },
  {
    id: 'CLI-3',
    tipoPessoa: 'PJ',
    razaoSocial: 'Porto Sul Logistica e Engenharia LTDA',
    nomeFantasia: 'Porto Sul',
    cpfCnpj: '34.567.890/0001-12',
    inscricaoEstadual: '123456789',
    status: 'Ativo',
    contato: '(41) 4000-2003 / comercial@portosul.com.br',
    endereco: 'Av. do Cais, 850, Paranagua - PR',
    dataCadastro: '2026-02-03',
    usuarioResponsavel: 'admin@modo-teste.com'
  },
  {
    id: 'CLI-4',
    tipoPessoa: 'PJ',
    razaoSocial: 'Mar Azul Offshore LTDA',
    nomeFantasia: 'Mar Azul Offshore',
    cpfCnpj: '45.678.901/0001-23',
    inscricaoEstadual: 'ISENTO',
    status: 'Prospeccao',
    contato: '(21) 4000-2004 / compras@marazul.com',
    endereco: 'Rua das Docas, 120, Rio de Janeiro - RJ',
    dataCadastro: '2026-02-05',
    usuarioResponsavel: 'admin@modo-teste.com'
  },
  {
    id: 'CLI-5',
    tipoPessoa: 'PJ',
    razaoSocial: 'Navega Engenharia Industrial LTDA',
    nomeFantasia: 'Navega Engenharia',
    cpfCnpj: '56.789.012/0001-34',
    inscricaoEstadual: '987654321',
    status: 'Ativo',
    contato: '(31) 4000-2005 / engenharia@navega.com.br',
    endereco: 'Rua Industrial, 455, Belo Horizonte - MG',
    dataCadastro: '2026-02-07',
    usuarioResponsavel: 'admin@modo-teste.com'
  },
  {
    id: 'CLI-SEVEN-OCEAN',
    tipoPessoa: 'PJ',
    razaoSocial: 'Subsea 7',
    nomeFantasia: 'Seven Ocean - UBU',
    cpfCnpj: '67.890.123/0001-45',
    inscricaoEstadual: 'ISENTO',
    status: 'Ativo',
    contato: '(27) 4000-2006 / operations@subsea7.com',
    endereco: 'Base de UBU, Anchieta - ES',
    dataCadastro: '2026-02-01',
    usuarioResponsavel: 'admin@modo-teste.com'
  }
];