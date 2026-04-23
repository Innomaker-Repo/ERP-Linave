import React, { createContext, useContext, useState, useEffect } from 'react';
import { CLIENTES_MOCK } from '../mocks/clientesMock';

const FORNECEDORES_MOCK = [
  {
    id: 'FOR-DEMO-1',
    razaoSocial: 'Aco Forte Naval LTDA',
    cnpj: '61.234.567/0001-10',
    contato: '(41) 4000-1001 / comercial@acoforte.com.br',
    endereco: 'Av. Industrial, 1001, Paranagua - PR',
    status: 'Ativo'
  },
  {
    id: 'FOR-DEMO-2',
    razaoSocial: 'Servicos Maritimos Atlantico S.A.',
    cnpj: '62.345.678/0001-20',
    contato: '(41) 4000-1002 / contato@atlantico.com.br',
    endereco: 'Porto Seguro, 220, Paranagua - PR',
    status: 'Ativo'
  },
  {
    id: 'FOR-DEMO-3',
    razaoSocial: 'Integra Engenharia e Montagem LTDA',
    cnpj: '63.456.789/0001-30',
    contato: '(41) 4000-1003 / vendas@integraeng.com.br',
    endereco: 'Rua Tecnica, 330, Curitiba - PR',
    status: 'Ativo'
  }
];

const FUNCIONARIOS_MOCK = [
  {
    id: 'FUN-DEMO-1',
    nome: 'Marcos Vieira',
    cargo: 'Engenheiro de Projetos',
    departamento: 'Engenharia',
    status: 'Ativo'
  },
  {
    id: 'FUN-DEMO-2',
    nome: 'Juliana Alves',
    cargo: 'Analista Comercial',
    departamento: 'Comercial',
    status: 'Ativo'
  },
  {
    id: 'FUN-DEMO-3',
    nome: 'Rafael Souza',
    cargo: 'Supervisor de Campo',
    departamento: 'Operacao',
    status: 'Ativo'
  },
  {
    id: 'FUN-DEMO-4',
    nome: 'Camila Rocha',
    cargo: 'Orcamentista',
    departamento: 'Orcamentos',
    status: 'Ativo'
  }
];

const MOCK_FINANCEIRO = [
  {
    id: 'FIN-SEVEN-001',
    tipo: 'despesa',
    descricao: 'Mao de obra direta - LN-0731A/26',
    valor: 16916,
    entidadeId: 'CLI-SEVEN-OCEAN',
    obraId: 'SEVEN-OCEAN-FINALIZACAO',
    categoria: 'Mao de Obra',
    dataPrevista: '2026-01-29',
    dataRealizada: '2026-01-29',
    status: 'Confirmado'
  },
  {
    id: 'FIN-SEVEN-002',
    tipo: 'despesa',
    descricao: 'Materiais e consumiveis - LN-0731A/26',
    valor: 21597.96,
    entidadeId: 'CLI-SEVEN-OCEAN',
    obraId: 'SEVEN-OCEAN-FINALIZACAO',
    categoria: 'Materiais',
    dataPrevista: '2026-01-29',
    dataRealizada: '2026-01-29',
    status: 'Confirmado'
  },
  {
    id: 'FIN-SEVEN-003',
    tipo: 'despesa',
    descricao: 'Terceirizacoes e fretes - LN-0731A/26',
    valor: 11280,
    entidadeId: 'CLI-SEVEN-OCEAN',
    obraId: 'SEVEN-OCEAN-FINALIZACAO',
    categoria: 'Terceiros',
    dataPrevista: '2026-02-02',
    dataRealizada: '2026-02-02',
    status: 'Confirmado'
  },
  {
    id: 'FIN-SEVEN-004',
    tipo: 'receita',
    descricao: 'Valor total do servico - LN-0731A/26',
    valor: 135333.95,
    entidadeId: 'CLI-SEVEN-OCEAN',
    obraId: 'SEVEN-OCEAN-FINALIZACAO',
    categoria: 'Receita',
    dataPrevista: '2026-02-01',
    dataRealizada: '2026-02-01',
    status: 'Previsto'
  }
];

const cloneDeep = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const buildTextDataUrl = (text: string) => `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;

const SEVEN_OCEAN_MAO_DE_OBRA = [
  { funcao: 'Encarregado', quantidade: '0,5', dias: '10', valorTotal: '1640.00' },
  { funcao: 'Encanador', quantidade: '2', dias: '10', valorTotal: '5380.00' },
  { funcao: 'Ajudante', quantidade: '2', dias: '10', valorTotal: '3440.00' },
  { funcao: 'Soldador', quantidade: '2', dias: '10', valorTotal: '6456.00' }
];

const SEVEN_OCEAN_MATERIAIS = [
  { descricao: 'Tubo diam. 2" a/c sch. 40 x 6000mm', unidade: 'metro', quantidade: '42', valorTotal: '10832.51' },
  { descricao: 'curva diam. 2" sch 40', unidade: 'unid', quantidade: '30', valorTotal: '1287.00' },
  { descricao: 'Flange diam. 2"', unidade: 'unid', quantidade: '33', valorTotal: '3775.20' },
  { descricao: 'Luvas roscada 1"', unidade: 'und', quantidade: '4', valorTotal: '156.00' },
  { descricao: 'bujão roscado 1"', unidade: 'unid', quantidade: '4', valorTotal: '156.00' },
  { descricao: 'consumiveis de solda', unidade: 'kg', quantidade: '25.1784', valorTotal: '881.24400' },
  { descricao: 'parafusos bi-cromotizado 5/8 x 65mm', unidade: 'unid', quantidade: '132', valorTotal: '1320.0000' },
  { descricao: 'Acabamento - hard top xp n2677 std (11m2/litro)', unidade: 'gal', quantidade: '2', valorTotal: '1200.0000' },
  { descricao: 'consumiveis de pintura', unidade: 'vb', quantidade: '1', valorTotal: '1000.00' },
  { descricao: 'juntas', unidade: 'unid', quantidade: '66', valorTotal: '990.00' }
];

const SEVEN_OCEAN_TERCEIRIZADOS = [
  { descricao: 'Jato granalha e pintura na cabine jato', unidade: 'kg', quantidade: '450', valorUnitario: '2,40', valorTotal: '1080.00' },
  { descricao: 'Galvanização', unidade: 'kg', quantidade: '450', valorUnitario: '8,00', valorTotal: '3600.00' },
  { descricao: 'Inspetor de pintura', unidade: 'Diaria', quantidade: '1', valorUnitario: '1.000,00', valorTotal: '1000.00' },
  { descricao: 'Transporte para resendo Galvanização', unidade: 'frete', quantidade: '2', valorUnitario: '2.000,00', valorTotal: '4000.00' },
  { descricao: 'transporte cabine jato', unidade: 'frete', quantidade: '2', valorUnitario: '800,00', valorTotal: '1600.00' }
];

const SEVEN_OCEAN_ORCAMENTO_PREVIEW = `ORCAMENTO LN-0731A/26
Cliente: SUBSEA 7
Projeto / Navio: SEVEN OCEAN
Escopo: SUBSTITUICAO LINHA SEWAGE
Solicitante: Subsea 7 / Seven Ocean - UBU
Referencias: Request SOS26M0047 | Request SOS26M0046

Totais
- Mao de obra direta: R$ 16.916,00
- Materiais e consumiveis: R$ 21.597,96
- Terceirizacoes e fretes: R$ 11.280,00
- Custo direto: R$ 49.793,96
- O.H: R$ 2.489,70
- Margem: R$ 17.427,89
- PV s/ imposto: R$ 69.711,54
- Imposto: R$ 11.502,40
- PV FINAL: R$ 81.213,95
- Valor total do servico: R$ 135.333,95

Mao de obra
${SEVEN_OCEAN_MAO_DE_OBRA.map((item) => `- ${item.funcao}: ${item.quantidade} x ${item.dias} dias = R$ ${item.valorTotal}`).join('\n')}

Materiais
${SEVEN_OCEAN_MATERIAIS.map((item) => `- ${item.descricao} (${item.quantidade} ${item.unidade}) = R$ ${item.valorTotal}`).join('\n')}

Terceirizados
${SEVEN_OCEAN_TERCEIRIZADOS.map((item) => `- ${item.descricao} (${item.quantidade} ${item.unidade}) = R$ ${item.valorTotal}`).join('\n')}`;

const SEVEN_OCEAN_PROPOSTA_PREVIEW = `PROPOSTA LN-0731A/26
Niteroi, 01 de fevereiro de 2026
Ref.: Seven Ocean - UBU
Solicitacoes: Request SOS26M0047 | Request SOS26M0046
Assunto: Proposta tecnica-comercial para servico SEVEN OCEANS - fabricacao e substituicao das linhas de Sewage

Escopo basico
1- Fabricacao e fornecimento dos spools das linhas de Sewage de bordo, considerando todo fornecimento de todo material.
a. Fabricacao dos spools em aco carbono ASTM A106 Gr. B Sch 40, da linha de sewage de bordo do Seven Ocean na Base de UBU.
b. Providenciar transporte dos spools removidos de UBU-ES para base da Contratada em Niteroi - RJ.
c. Fabricar novos spools usando como base os spools removidos de bordo.
d. Apos fabricacao na oficina, efetuar a galvanizacao a quente dos spools para posterior entrega.
e. Efetuar o transporte dos novos spools para base da Subsea na Ilha da Conceicao - Niteroi.

Condicoes comerciais
- Todos as taxas e impostos estao incluidos no preco.
- Impostos e encargos: ISS, PIS, Confins.
- Estamos considerando 100% mao de obra.
- Local da obra: Base da Contratada.
- Pagamento: 100% na conclusao da fabricacao e entrega na base do Cliente, com pagamento a 45 dias da emissao da NF.
- Mobilizacao: 24hrs apos aprovacao da proposta.
- Prazo previsto remocao: 01 dia de servico.
- Prazo para fabricacao e galvanizacao: 22 dias.

Assinatura
- Nome: XXXX
- Cargo: Diretoria Comercial`;

const SEVEN_OCEAN_OS_PREVIEW = `OS 0731A
Data emissao: 02/02/2026
Cliente: SUBSEA7
Projeto: SEVEN OCEAN
CC: LN-0731A/26
Data termino previsto: 24/02/2026
HH total: 624

Descricao geral do servico
Fabricacao e fornecimento dos spools das linhas de Sewage de bordo, considerando todo fornecimento de todo material. Fabricacao dos spools em aco carbono ASTM A106 Gr. B Sch 40, da linha de sewage de bordo do Seven Ocean na Base de UBU.

Inclui
- certificadoGas
- ventilacao
- limpezaAntes
- limpezaApos
- apoioGuindastes
- transporteExterno
- testePressao
- pintura
- lpPm
- inspecaoDimensional
- visualSolda
- soldadorCertificado
- procedimentoSolda
- certificacaoMaterial
- vigiaFogo`;

const SEVEN_OCEAN_SERVICOS = [
  {
    id: 'srv-001',
    tipo: 'Fabricação e fornecimento',
    categoria: 'Sewage',
    embarcacao: 'Seven Ocean',
    localExecucao: 'Base da Contratada',
    porto: 'UBU-ES / Niterói-RJ',
    prazoDes: '2026-02-24',
    descricao: 'Fabricação e fornecimento dos spools das linhas de Sewage de bordo, considerando todo fornecimento de todo material.',
    observacoes: 'Escopo técnico-comercial da proposta LN-0731A/26.'
  },
  {
    id: 'srv-002',
    tipo: 'Transporte',
    categoria: 'Logistica',
    embarcacao: 'Seven Ocean',
    localExecucao: 'UBU-ES -> Base da Contratada',
    porto: 'Niterói-RJ',
    prazoDes: '2026-02-24',
    descricao: 'Providenciar transporte dos spools removidos de UBU-ES para base da Contratada em Niterói – RJ.',
    observacoes: 'Baseado no escopo da proposta.'
  },
  {
    id: 'srv-003',
    tipo: 'Galvanizacao e pintura',
    categoria: 'Acabamento',
    embarcacao: 'Seven Ocean',
    localExecucao: 'Oficina',
    porto: 'Niterói-RJ',
    prazoDes: '2026-02-24',
    descricao: 'Efetuar a galvanização a quente dos spools e a pintura com tinta PU na cor branca.',
    observacoes: 'Inclui galvanização e pintura após a fabricação.'
  },
  {
    id: 'srv-004',
    tipo: 'Inspeção e documentação',
    categoria: 'Qualidade',
    embarcacao: 'Seven Ocean',
    localExecucao: 'Base do cliente',
    porto: 'Ilha da Conceição - Niterói',
    prazoDes: '2026-02-24',
    descricao: 'Enviar equipe técnica para levantamento das tubulações a serem fabricadas e realizar inspeções dimensionais, visuais e certificações de material.',
    observacoes: 'Conforme proposta e OS.'
  },
  {
    id: 'srv-005',
    tipo: 'Entrega final',
    categoria: 'Logistica',
    embarcacao: 'Seven Ocean',
    localExecucao: 'Subsea 7 / Ilha da Conceição',
    porto: 'Niterói-RJ',
    prazoDes: '2026-02-24',
    descricao: 'Efetuar o transporte dos novos spools para base da Subsea na Ilha da Conceição – Niteroi.',
    observacoes: 'Etapa de entrega final do projeto.'
  }
];

const buildOrcamentoValores = (precoFinal: number) => ({
  totalMaoDeObra: 16916,
  totalMateriais: 21597.96,
  totalTerceirizados: 11280,
  totalBruto: 49793.96,
  totalSemImposto: 69711.54,
  subtotal: 49793.96,
  margem: 35,
  oh: 5,
  impostos: 16.5,
  valorMargem: 17427.89,
  valorOH: 2489.7,
  valorImpostos: 11502.4,
  precoFinal,
  valorTotalServico: 135333.95
});

const buildOrcamentoData = (
  numeroOrcamento: string,
  solicitante: string,
  responsavelComercial: string,
  escopoOrcamento: string,
  dadosServicos: any[],
  precoFinal: number,
  dataCriacao: string,
) => ({
  versao: 'A',
  dataCriacao,
  status: 'pendente',
  numeroOrcamento,
  data: {
    numeroOrcamento,
    solicitante,
    responsavelComercial,
    documentosReferencia: 'Request SOS26M0047 | Request SOS26M0046',
    escopoOrcamento,
    dadosServicos,
    maoDeObra: cloneDeep(SEVEN_OCEAN_MAO_DE_OBRA),
    atividades: [
      { atividade: 'Levantamento tecnico e delineamento', dias: '1', observacao: 'Conforme proposta e OS.' },
      { atividade: 'Fabricacao dos spools', dias: '22', observacao: 'Aco carbono ASTM A106 Gr. B Sch 40.' },
      { atividade: 'Galvanizacao e pintura', dias: '22', observacao: 'Pintura PU branca apos galvanizacao.' },
      { atividade: 'Transporte e entrega', dias: '1', observacao: 'Base do cliente na Ilha da Conceicao.' }
    ],
    materiais: cloneDeep(SEVEN_OCEAN_MATERIAIS),
    terceirizados: cloneDeep(SEVEN_OCEAN_TERCEIRIZADOS),
    observacoes: 'Projeto LN-0731A/26 com base nos documentos orçamento, proposta e OS.'
  },
  valores: buildOrcamentoValores(precoFinal)
});

const buildProposta = (
  numeroProposta: string,
  cliente: string,
  atribuidoA: string,
  cargoContato: string,
  assunto: string,
  preco: string,
  status: 'pendente' | 'aceita' = 'pendente',
) => ({
  versao: 'A',
  dataCriacao: '2026-02-01',
  status,
  numeroProposta,
  dataProposta: '2026-02-01',
  cliente,
  atribuidoA,
  cargoContato,
  referencia: 'Seven Ocean - UBU',
  saudacao: 'Prezado XXXXX,',
  assunto,
  textoAbertura: 'Vimos através desta apresentar nossa Proposta Técnica-Comercial revisada nº LN-0731A/26, para serviços de fabricação e fornecimento dos spools da linha de sewage do Seven Ocean, conforme escopo e delineamento realizado a bordo, conforme solicitado para vossa avaliação e aprovação.',
  escopoA: 'A – ESCOPO BASICO DE SERVIÇOS',
  escopoBasicoServicos: '1- Fabricação e fornecimento dos spools das linhas de Sewage de bordo, considerando todo fornecimento de todo material.\na. Fabricação dos spools em aço carbono ASTM A106 Gr. B Sch 40, da linha de sewage de bordo do Seven Ocean na Base de UBU.\nb. Providenciar transporte dos spools removidos de UBU-ES para base da Contratada em Niterói – RJ.\nc. Fabricar novos spools usando como base os spools removidos de bordo.\nd. Após fabricação na oficina, efetuar a galvanização a quente dos spools para posterior entrega.\ne. Efetuar o transporte dos novos spools para base da Subsea na Ilha da Conceição – Niteroi.',
  responsabilidadeContratada: 'Fornecimento de toda mão de obra qualificada\nMobilização da equipe até a Base de UBU – ES para inspeção\nFornecimento de todo material, tubos, conexões\nDescarte da sucata metálica\nGalvanização a quente de todos os spools',
  escopoC: 'Disponibilizar os spools removidos para recolhimento Cais na Base UBU-ES\nColeta dos spools fabricados na base da Subsea 7 (Ilha Conceição – Niteroi-RJ)\nRemoção e reinstalação dos spools a bordo',
  referencias: 'Request SOS26M0047\nRequest SOS26M0046',
  condicoesGerais: 'Todos as taxas e impostos estão incluídos no preço.\nImpostos: Os seguintes impostos e encargos estão inclusos: ISS, PIS, Confins.\nEstamos de acordo com as devidas retenções na fonte, inclusive do INSS, quando aplicável.\nEstamos considerando 100% mão de obra.\nLocal da obra – Base da Contratada',
  condicoesPagamento: '100% na conclusão da fabricação e entrega na base do Cliente, com pagamento a 45 dias da emissão da NF.',
  prazo: 'Mobilização: 24hrs após aprovação da proposta\nPrazo previsto remoção: 01 dia de serviço\nPrazo para fabricação e galvanização: 22 dias',
  encerramento: 'Atenciosamente,',
  assinaturaNome: 'XXXX',
  assinaturaCargo: 'Diretoria Comercial',
  preco
});

const buildDemoObra = (
  id: string,
  nome: string,
  clienteId: string,
  categoria: 'Planejamento' | 'Negociação' | 'Em Andamento' | 'Finalização',
  tipo: string,
  responsavelTecnico: string,
  responsavelComercial: string,
  solicitante: string,
  telefone: string,
  email: string,
  dataSolicitacao: string,
  dataPrevistaInicio: string,
  dataPrevistaFinal: string,
  servicos: any[],
  orcamentoFinal: number,
  numeroOrcamento: string,
  numeroProposta: string,
  propostaStatus: 'pendente' | 'aceita',
  temOS: boolean,
  osAprovada: boolean,
) => ({
  id,
  nome,
  clienteId,
  status: categoria,
  categoria,
  tipo,
  responsavelTecnico,
  responsavelComercial,
  solicitante,
  telefone,
  email,
  dataCadastro: dataSolicitacao,
  dataSolicitacao,
  dataPrevistaInicio,
  dataPrevistaFinal,
  inicioPrevisto: dataPrevistaInicio,
  fimPrevisto: dataPrevistaFinal,
  origemOS: true,
  orcamento: orcamentoFinal,
  orcamentoRealizado: true,
  orcamentoData: buildOrcamentoData(
    numeroOrcamento,
    solicitante,
    responsavelComercial,
    'Substituição da linha Sewage do Seven Ocean',
    servicos,
    orcamentoFinal,
    dataSolicitacao,
  ).data,
  orcamentoValores: buildOrcamentoValores(orcamentoFinal),
  orcamentos: [
    {
      versao: 'A',
      dataCriacao: dataSolicitacao,
      status: 'aceito',
      numeroOrcamento,
      data: buildOrcamentoData(
        numeroOrcamento,
        solicitante,
        responsavelComercial,
        'Substituição da linha Sewage do Seven Ocean',
        servicos,
        orcamentoFinal,
        dataSolicitacao,
      ).data,
      valores: buildOrcamentoValores(orcamentoFinal)
    }
  ],
  documentosNegocio: [
    {
      id: `${id}-doc-orcamento`,
      nome: 'orçamento.pdf',
      tipo: 'application/pdf',
      tamanho: 512000,
      dataUpload: `${dataSolicitacao}T09:00:00.000Z`,
      conteudo: buildTextDataUrl(SEVEN_OCEAN_ORCAMENTO_PREVIEW)
    },
    ...(categoria === 'Negociação' || categoria === 'Em Andamento' || categoria === 'Finalização'
      ? [
          {
            id: `${id}-doc-proposta`,
            nome: 'proposta.pdf',
            tipo: 'application/pdf',
            tamanho: 640000,
            dataUpload: '2026-02-01T09:00:00.000Z',
            conteudo: buildTextDataUrl(SEVEN_OCEAN_PROPOSTA_PREVIEW)
          }
        ]
      : []),
    ...(temOS
      ? [
          {
            id: `${id}-doc-os`,
            nome: 'OS.pdf',
            tipo: 'application/pdf',
            tamanho: 720000,
            dataUpload: '2026-02-02T09:00:00.000Z',
            conteudo: buildTextDataUrl(SEVEN_OCEAN_OS_PREVIEW)
          }
        ]
      : [])
  ],
  documentoClienteAssinado: categoria === 'Finalização'
    ? {
        id: `${id}-assinatura`,
        nome: 'cliente-assinatura.pdf',
        tipo: 'application/pdf',
        tamanho: 120000,
        dataUpload: '2026-02-24T12:00:00.000Z',
        conteudo: buildTextDataUrl('Assinatura do cliente LN-0731A/26')
      }
    : null,
  propostas: categoria === 'Planejamento' ? [] : [buildProposta(
    numeroProposta,
    'Subsea 7',
    'XXXX',
    'Diretoria Comercial',
    'Proposta Técnica-comercial para serviço SEVEN OCEANS – Fabricação e substituição das linhas de Sewage',
    'R$ 135.333,95',
    propostaStatus,
  )],
  os: temOS ? [
    {
      id: `${id}-os-1`,
      obraId: id,
      clienteId: 'CLI-SEVEN-OCEAN',
      cliente: 'SUBSEA7',
      projeto: 'SEVEN OCEAN',
      equipamento: 'Fabricação de spools linha de Sewage',
      local: 'Base da Contratada',
      dataEmissao: '2026-02-02',
      cc: 'LN-0731A/26',
      dataInicioPrevisto: '2026-02-02',
      dataTerminoPrevisto: '2026-02-24',
      ordemServicoNumero: '0731A',
      supervisorEncarregado: 'Equipe Linave',
      descricaoGeralServico: 'Fabricação e fornecimento dos spools das linhas de Sewage de bordo, considerando todo fornecimento de todo material. Fabricação dos spools em aço carbono ASTM A106 Gr. B Sch 40, da linha de sewage de bordo do Seven Ocean na Base de UBU.',
      aSerIncluido: {
        certificadoGas: true,
        ventilacao: true,
        limpezaAntes: true,
        limpezaApos: true,
        andaimes: false,
        apoioGuindastes: true,
        transporteExterno: true,
        testePressao: true,
        pintura: true,
        lpPm: true,
        testeUltrassom: false,
        inspecaoDimensional: true,
        visualSolda: true,
        soldadorCertificado: true,
        procedimentoSolda: true,
        certificacaoMaterial: true,
        vigiaFogo: true
      },
      maoObra: { estrutura: 0, tubulacao: 570, andaimes: 0, mecanica: 0, pintura: 36, eletrica: 0, cq: 9, sms: 9 },
      statusOs: osAprovada ? 'concluida' : 'emproducao',
      tipoDocumento: 'consolidada',
      statusEnvio: 'enviada',
      statusAprovacao: osAprovada ? 'aprovada' : 'pendente',
      dataAprovacao: osAprovada ? '2026-02-24' : undefined,
      documentoAssinaturaAprovacao: osAprovada
        ? {
            id: `${id}-os-assinada`,
            nome: 'OS_0731A_26_assinada.pdf',
            tipo: 'application/pdf',
            tamanho: 120000,
            dataUpload: '2026-02-24T12:00:00.000Z',
            conteudo: 'data:text/plain;charset=utf-8,OS%20assinada%20do%20projeto%20LN-0731A/26'
          }
        : null,
      resumoConsolidado: 'OS do projeto Seven Ocean / LN-0731A/26'
    }
  ] : [],
});

const MOCK_OBRAS = [
  buildDemoObra(
    'SEVEN-OCEAN-PLANEJAMENTO',
    'Seven Ocean - LN-0731A/26',
    'CLI-SEVEN-OCEAN',
    'Planejamento',
    'Fabricação de tubulações Sewage',
    'Linave Engenharia & Serv. Navais',
    'Diretoria Comercial',
    'Subsea 7',
    '',
    '',
    '2026-01-29',
    '2026-02-02',
    '2026-02-24',
    cloneDeep(SEVEN_OCEAN_SERVICOS),
    81213.95,
    'LN-0731A/26',
    'LN-0731A/26',
    'pendente',
    false,
    false
  ),
  buildDemoObra(
    'SEVEN-OCEAN-NEGOCIACAO',
    'Seven Ocean - LN-0731A/26',
    'CLI-SEVEN-OCEAN',
    'Negociação',
    'Fabricação de tubulações Sewage',
    'Linave Engenharia & Serv. Navais',
    'Diretoria Comercial',
    'Subsea 7',
    '',
    '',
    '2026-02-01',
    '2026-02-02',
    '2026-02-24',
    cloneDeep(SEVEN_OCEAN_SERVICOS),
    81213.95,
    'LN-0731A/26',
    'LN-0731A/26',
    'pendente',
    false,
    false
  ),
  buildDemoObra(
    'SEVEN-OCEAN-ANDAMENTO',
    'Seven Ocean - LN-0731A/26',
    'CLI-SEVEN-OCEAN',
    'Em Andamento',
    'Fabricação de tubulações Sewage',
    'Linave Engenharia & Serv. Navais',
    'Diretoria Comercial',
    'Subsea 7',
    '',
    '',
    '2026-02-02',
    '2026-02-02',
    '2026-02-24',
    cloneDeep(SEVEN_OCEAN_SERVICOS),
    81213.95,
    'LN-0731A/26',
    'LN-0731A/26',
    'aceita',
    true,
    false
  ),
  buildDemoObra(
    'SEVEN-OCEAN-FINALIZACAO',
    'Seven Ocean - LN-0731A/26',
    'CLI-SEVEN-OCEAN',
    'Finalização',
    'Fabricação de tubulações Sewage',
    'Linave Engenharia & Serv. Navais',
    'Diretoria Comercial',
    'Subsea 7',
    '',
    '',
    '2026-02-24',
    '2026-02-02',
    '2026-02-24',
    cloneDeep(SEVEN_OCEAN_SERVICOS),
    81213.95,
    'LN-0731A/26',
    'LN-0731A/26',
    'aceita',
    true,
    true
  )
];

const SEVEN_OCEAN_OS_BASE = {
  clienteId: 'CLI-SEVEN-OCEAN',
  cliente: 'SUBSEA7',
  projeto: 'SEVEN OCEAN',
  tipo: 'Fabricação e fornecimento',
  embarcacao: 'Seven Ocean',
  equipamento: 'Fabricação de spools linha de Sewage',
  local: 'Base da Contratada',
  porto: 'Base UBU - ES / Ilha da Conceicao - Niteroi - RJ',
  dataEmissao: '2026-02-02',
  dataCriacao: '2026-02-02',
  cc: 'LN-0731A/26',
  dataInicioPrevisto: '2026-02-02',
  dataTerminoPrevisto: '2026-02-24',
  ordemServicoNumero: '0731A',
  supervisorEncarregado: 'Equipe Linave',
  solicitante: 'Subsea 7',
  telefone: '-',
  email: '-',
  descricao: 'Fabricação e fornecimento dos spools das linhas de Sewage de bordo, considerando todo fornecimento de todo material. Fabricação dos spools em aço carbono ASTM A106 Gr. B Sch 40, da linha de sewage de bordo do Seven Ocean na Base de UBU.',
  descricaoGeralServico: 'Fabricação e fornecimento dos spools das linhas de Sewage de bordo, considerando todo fornecimento de todo material. Fabricação dos spools em aço carbono ASTM A106 Gr. B Sch 40, da linha de sewage de bordo do Seven Ocean na Base de UBU.',
  observacoes: 'Resumo da OS do projeto Seven Ocean / LN-0731A/26.',
  aSerIncluido: {
    certificadoGas: true,
    ventilacao: true,
    limpezaAntes: true,
    limpezaApos: true,
    andaimes: false,
    apoioGuindastes: true,
    transporteExterno: true,
    testesPressao: true,
    pintura: true,
    lpPm: true,
    testeUltrassom: false,
    inspecaoDimensional: true,
    visualSolda: true,
    soldadorCertificado: true,
    procedimentoSolda: true,
    certificacaoMaterial: true,
    vigiaFogo: true
  },
  maoObra: { estrutura: 0, tubulacao: 570, andaimes: 0, mecanica: 0, pintura: 36, eletrica: 0, cq: 9, sms: 9 },
  statusEnvio: 'enviada',
  tipoDocumento: 'consolidada',
  resumoConsolidado: 'OS do projeto Seven Ocean / LN-0731A/26'
};

const SEVEN_OCEAN_OS_ORCAMENTO = {
  versao: 'A',
  dataCriacao: '2026-01-29',
  status: 'aceito',
  numeroOrcamento: 'LN-0731A/26',
  data: buildOrcamentoData(
    'LN-0731A/26',
    'Subsea 7',
    'Diretoria Comercial',
    'Substituição da linha Sewage do Seven Ocean',
    cloneDeep(SEVEN_OCEAN_SERVICOS),
    81213.95,
    '2026-01-29',
  ).data,
  valores: buildOrcamentoValores(81213.95)
};

const SEVEN_OCEAN_OS_PROPOSTA = buildProposta(
  'LN-0731A/26',
  'Subsea 7',
  'XXXX',
  'Diretoria Comercial',
  'Proposta Técnica-comercial para serviço SEVEN OCEANS – Fabricação e substituição das linhas de Sewage',
  'R$ 135.333,95',
  'aceita',
);

const buildSevenOceanOS = (id: string, obraId: string, statusOs: 'emproducao' | 'concluida', statusAprovacao: 'pendente' | 'aprovada', dataAprovacao?: string) => ({
  id,
  obraId,
  ...SEVEN_OCEAN_OS_BASE,
  orcamentoRealizado: true,
  orcamentoData: SEVEN_OCEAN_OS_ORCAMENTO.data,
  orcamentoValores: SEVEN_OCEAN_OS_ORCAMENTO.valores,
  orcamentos: [SEVEN_OCEAN_OS_ORCAMENTO],
  propostas: [SEVEN_OCEAN_OS_PROPOSTA],
  documentosNegocio: [
    {
      id: `${id}-doc-orcamento`,
      nome: 'orçamento.pdf',
      tipo: 'application/pdf',
      tamanho: 512000,
      dataUpload: '2026-01-29T09:00:00.000Z',
      conteudo: buildTextDataUrl(SEVEN_OCEAN_ORCAMENTO_PREVIEW)
    },
    {
      id: `${id}-doc-proposta`,
      nome: 'proposta.pdf',
      tipo: 'application/pdf',
      tamanho: 640000,
      dataUpload: '2026-02-01T09:00:00.000Z',
      conteudo: buildTextDataUrl(SEVEN_OCEAN_PROPOSTA_PREVIEW)
    },
    {
      id: `${id}-doc-os`,
      nome: 'OS.pdf',
      tipo: 'application/pdf',
      tamanho: 720000,
      dataUpload: '2026-02-02T09:00:00.000Z',
      conteudo: buildTextDataUrl(SEVEN_OCEAN_OS_PREVIEW)
    }
  ],
  statusOs,
  statusAprovacao,
  dataAprovacao,
  documentoAssinaturaAprovacao: statusAprovacao === 'aprovada'
    ? {
        id: `${id}-assinada`,
        nome: 'OS_0731A_26_assinada.pdf',
        tipo: 'application/pdf',
        tamanho: 120000,
        dataUpload: '2026-02-24T12:00:00.000Z',
        conteudo: buildTextDataUrl('OS assinada do projeto LN-0731A/26')
      }
    : null
});

const MOCK_OS = [
  buildSevenOceanOS('OS-SEVEN-OCEAN-ANDAMENTO', 'SEVEN-OCEAN-ANDAMENTO', 'emproducao', 'pendente'),
  buildSevenOceanOS('OS-SEVEN-OCEAN-FINALIZACAO', 'SEVEN-OCEAN-FINALIZACAO', 'concluida', 'aprovada', '2026-02-24')
];

const mergeRecordsById = (base: any[] = [], demo: any[] = []) => {
  const merged = [...base];
  const ids = new Set(base.map((item) => item?.id).filter(Boolean));

  demo.forEach((item) => {
    if (!item?.id || !ids.has(item.id)) {
      merged.push(item);
      if (item?.id) {
        ids.add(item.id);
      }
    }
  });

  return merged;
};

const createInitialData = (savedData: any) => {
  const baseData = {
    clientes: CLIENTES_MOCK,
    funcionarios: [],
    obras: [],
    financeiro: [],
    compras: [],
    os: [],
    usuarios: [],
    equipes: [],
    fornecedores: [],
    horas: [],
    config: { empresaNome: 'Linave ERP Demo' },
    listas: { departamentos: [], categorias: [], prioridades: [] }
  };

  const isDemoRecord = (collection: string, item: any) => {
    const id = item?.id || '';
    const clienteId = item?.clienteId || '';
    const obraId = item?.obraId || '';

    switch (collection) {
      case 'clientes':
        return ['CLI-1', 'CLI-2', 'CLI-3', 'CLI-4', 'CLI-5', 'CLI-SEVEN-OCEAN'].includes(id);
      case 'fornecedores':
        return /^FOR-DEMO-/.test(id);
      case 'funcionarios':
        return /^FUN-DEMO-/.test(id);
      case 'financeiro':
        return /^FIN-SEVEN-/.test(id) || clienteId === 'CLI-SEVEN-OCEAN' || /SEVEN-OCEAN/.test(obraId);
      case 'obras':
        return /SEVEN-OCEAN/.test(id) || clienteId === 'CLI-SEVEN-OCEAN';
      case 'os':
        return /SEVEN-OCEAN/.test(id) || clienteId === 'CLI-SEVEN-OCEAN' || /SEVEN-OCEAN/.test(obraId);
      default:
        return false;
    }
  };

  const sanitizeCollection = (collection: string, items: any[] = []) => {
    if (!Array.isArray(items)) return [];
    return items.filter((item) => !isDemoRecord(collection, item));
  };

  if (!savedData) {
    return baseData;
  }

  const sanitizedData = {
    ...baseData,
    clientes: mergeRecordsById(baseData.clientes, sanitizeCollection('clientes', savedData.clientes)),
    funcionarios: sanitizeCollection('funcionarios', savedData.funcionarios),
    obras: sanitizeCollection('obras', savedData.obras),
    financeiro: sanitizeCollection('financeiro', savedData.financeiro),
    compras: Array.isArray(savedData.compras) ? savedData.compras : [],
    os: sanitizeCollection('os', savedData.os),
    usuarios: Array.isArray(savedData.usuarios) ? savedData.usuarios : [],
    equipes: Array.isArray(savedData.equipes) ? savedData.equipes : [],
    fornecedores: sanitizeCollection('fornecedores', savedData.fornecedores),
    horas: Array.isArray(savedData.horas) ? savedData.horas : [],
    config: savedData.config ? { ...baseData.config, ...savedData.config } : baseData.config,
    listas: savedData.listas ? { ...baseData.listas, ...savedData.listas } : baseData.listas
  };

  const hasUserData = [
    sanitizedData.clientes,
    sanitizedData.funcionarios,
    sanitizedData.obras,
    sanitizedData.financeiro,
    sanitizedData.compras,
    sanitizedData.os,
    sanitizedData.usuarios,
    sanitizedData.equipes,
    sanitizedData.fornecedores,
    sanitizedData.horas
  ].some((collection) => collection.length > 0);

  if (!hasUserData && (!sanitizedData.config?.empresaNome || sanitizedData.config.empresaNome === 'Linave ERP' || sanitizedData.config.empresaNome === 'Nova Empresa')) {
    return baseData;
  }

  return sanitizedData;
};

interface ErpContextData {
  userSession: any;
  setUserSession: (s: any) => void;
  loading: boolean;
  clientes: any[];
  funcionarios: any[];
  obras: any[];
  financeiro: any[];
  compras: any[];
  os: any[];
  usuarios: any[];
  equipes: any[];
  fornecedores: any[];
  horas: any[];
  config: any;
  listas: any;
  loginComGoogle: (token: string, email: string) => Promise<void>;
  loginDireto: (user: any) => void;
  logout: () => void;
  saveEntity: (collection: string, data: any) => Promise<void>;
  saveListas: (novasListas: any) => Promise<void>;
  saveConfig: (novaConfig: any) => Promise<void>;
  uploadFileToDrive: (file: File) => Promise<string | null>;
}

const ErpContext = createContext<ErpContextData>({} as ErpContextData);

export function ErpProvider({ children }: { children: React.ReactNode }) {
  // DEBUG: Injetar ADMIN imediatamente
  const [userSession, setUserSession] = useState<any>({
    email: 'admin@modo-teste.com',
    role: 'ADMIN',
    nome: 'Administrador (Teste)',
    permissoes: {}
  });
  const [loading, setLoading] = useState(false);
  
  const [data, setData] = useState(() => {
    // Tentar carregar do localStorage na inicialização
    try {
      const saved = localStorage.getItem('@ERP:data');
      if (saved) {
        const loadedData = JSON.parse(saved);
        // Migrar OS para adicionar statusEnvio se não existir
        if (loadedData.os && Array.isArray(loadedData.os)) {
          loadedData.os = loadedData.os.map((o: any) => ({
            ...o,
            statusEnvio: o.statusEnvio || 'pendente'
          }));
        }
        return createInitialData(loadedData);
      }
    } catch (e) {
      console.error('Erro ao carregar dados do localStorage', e);
    }
    // Se não conseguir, usar dados padrão
    return createInitialData(null);
  });

  // Salvar dados no localStorage sempre que mudam
  useEffect(() => {
    try {
      localStorage.setItem('@ERP:data', JSON.stringify(data));
    } catch (e) {
      console.error('Erro ao salvar dados no localStorage', e);
    }
  }, [data]);

  const showTestAlert = (operacao: string) => {
    alert(`VERSÃO DE TESTE\n\nOperação "${operacao}" requer conexão com backend.\n\nEsta é uma versão demonstrativa apenas com frontend.`);
  };

  // Função simulada - não faz requisição real
  const refreshData = async (session: any) => {
    // Apenas mantém os dados padrão - sem requisição ao backend
    console.log('refreshData chamado (sem backend)');
  };

  // Removed: loginComGoogle - agora apenas simula
  const loginComGoogle = async (token: string, email: string) => {
    showTestAlert('Google Login');
  };

  // Login direto simples - apenas local
  const loginDireto = (user: any) => {
    const session = { ...user, token: null };
    setUserSession(session);
    // localStorage.setItem('@Linave:session', JSON.stringify(session));  // COMENTADO PARA DEBUG
  };

  // Simula salvar - agora realmente salva no estado e localStorage
  const saveEntity = async (collection: string, newData: any) => {
    // Atualiza estado local com os dados
    setData(prev => ({ ...prev, [collection]: newData }));
    console.log(`${collection} atualizado:`, newData.length || Object.keys(newData).length, 'itens');
  };

  // Simula upload de arquivo - sem enviar para nenhum lugar
  const uploadFileToDrive = async (file: File): Promise<string | null> => {
    showTestAlert('Upload de Arquivo');
    return null;
  };

  const saveListas = async (l: any) => saveEntity('listas', l);
  const saveConfig = async (c: any) => saveEntity('config', c);

  const logout = () => {
    setUserSession(null);
    // localStorage.removeItem('@Linave:session');  // COMENTADO PARA DEBUG
    window.location.href = '/';
  };

 
  return (
    <ErpContext.Provider value={{ userSession, setUserSession, loading, loginComGoogle, loginDireto, logout, saveEntity, saveListas, saveConfig, uploadFileToDrive, ...data }}>
      {children}
    </ErpContext.Provider>
  );
}

export const useErp = () => useContext(ErpContext);
