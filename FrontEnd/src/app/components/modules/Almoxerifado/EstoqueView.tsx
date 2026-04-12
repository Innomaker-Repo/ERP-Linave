import React, { useMemo, useState } from 'react';
import { Search, AlertTriangle, TrendingUp, Package } from 'lucide-react';
import { Badge } from '../../../modules/shared/ui/badge';
import { Input } from '../../../modules/shared/ui/input';

interface Produto {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  quantidadeMinima: number;
  fornecedor: string;
  ultimaCompra: string;
  frequenciaCompra: string;
  preco: number;
  localizacao: string;
}

// Produtos representativos de compras frequentes
const PRODUTOS_EXEMPLO: Produto[] = [
  {
    id: 'P001',
    nome: 'Chapa de Aço Carbono 3/8" x 2m',
    categoria: 'Chapas de Aço',
    quantidade: 85,
    quantidadeMinima: 30,
    fornecedor: 'Usiminas',
    ultimaCompra: '2026-03-28',
    frequenciaCompra: 'Semanal',
    preco: 1250.00,
    localizacao: 'Galpão Principal A1'
  },
  {
    id: 'P002',
    nome: 'Aço Inoxidável ASTM 316L Redondo 50mm',
    categoria: 'Barras de Aço',
    quantidade: 42,
    quantidadeMinima: 15,
    fornecedor: 'Villares Metals',
    ultimaCompra: '2026-03-25',
    frequenciaCompra: 'Quinzenal',
    preco: 850.00,
    localizacao: 'Galpão de Matéria Prima'
  },
  {
    id: 'P003',
    nome: 'Tubo de Aço Galvanizado 2" DN50',
    categoria: 'Tubulações',
    quantidade: 180,
    quantidadeMinima: 60,
    fornecedor: 'Confab Industrial',
    ultimaCompra: '2026-03-20',
    frequenciaCompra: 'Quinzenal',
    preco: 280.00,
    localizacao: 'Galpão B2'
  },
  {
    id: 'P004',
    nome: 'Parafuso Inoxidável M16 - Classe 8.8',
    categoria: 'Ferragens Navais',
    quantidade: 520,
    quantidadeMinima: 200,
    fornecedor: 'Metais Brasil Ltda',
    ultimaCompra: '2026-03-22',
    frequenciaCompra: 'Semanal',
    preco: 18.50,
    localizacao: 'Prateleira C1'
  },
  {
    id: 'P005',
    nome: 'Válvula de Gaveta DN80 - Aço Carbono',
    categoria: 'Válvulas',
    quantidade: 12,
    quantidadeMinima: 5,
    fornecedor: 'Apex Válvulas',
    ultimaCompra: '2026-03-18',
    frequenciaCompra: 'Conforme Necessário',
    preco: 2350.00,
    localizacao: 'Almoxarifado de Válvulas'
  },
  {
    id: 'P006',
    nome: 'Solda de Aço Especial ER70S-6 1,2mm',
    categoria: 'Consumíveis de Solda',
    quantidade: 95,
    quantidadeMinima: 40,
    fornecedor: 'ESAB Brasil',
    ultimaCompra: '2026-03-19',
    frequenciaCompra: 'Semanal',
    preco: 65.00,
    localizacao: 'Almoxarifado de Solda'
  },
  {
    id: 'P007',
    nome: 'Isolamento Térmico Marítimo 50mm',
    categoria: 'Isolamento',
    quantidade: 28,
    quantidadeMinima: 10,
    fornecedor: 'Rockwool Brasil',
    ultimaCompra: '2026-03-26',
    frequenciaCompra: 'Mensal',
    preco: 450.00,
    localizacao: 'Galpão B1'
  },
  {
    id: 'P008',
    nome: 'Cordoalha de Aço Galvanizado 1/2"',
    categoria: 'Cabos e Cordoalhas',
    quantidade: 250,
    quantidadeMinima: 100,
    fornecedor: 'Cear Cabos',
    ultimaCompra: '2026-03-27',
    frequenciaCompra: 'Irregular',
    preco: 125.00,
    localizacao: 'Galpão A2'
  },
  {
    id: 'P009',
    nome: 'Placa de Revestimento Antissepticida',
    categoria: 'Revestimentos',
    quantidade: 35,
    quantidadeMinima: 15,
    fornecedor: 'International Paint',
    ultimaCompra: '2026-03-24',
    frequenciaCompra: 'Mensal',
    preco: 880.00,
    localizacao: 'Almoxarifado Principal'
  },
  {
    id: 'P010',
    nome: 'Flange de Aço Inoxidável DN100 Class 150',
    categoria: 'Flanges',
    quantidade: 22,
    quantidadeMinima: 8,
    fornecedor: 'Serene Flanges',
    ultimaCompra: '2026-03-21',
    frequenciaCompra: 'Conforme Necessário',
    preco: 1680.00,
    localizacao: 'Prateleira D2'
  }
];

interface EstoqueViewProps {
  searchQuery: string;
}

export function EstoqueView({ searchQuery }: EstoqueViewProps) {
  const [filtro, setFiltro] = useState<string>(searchQuery || '');

  // Filtra produtos baseado na busca
  const produtosFiltrados = useMemo(() => {
    return PRODUTOS_EXEMPLO.filter(produto => {
      const busca = filtro.toLowerCase();
      return (
        produto.nome.toLowerCase().includes(busca) ||
        produto.categoria.toLowerCase().includes(busca) ||
        produto.fornecedor.toLowerCase().includes(busca) ||
        produto.localizacao.toLowerCase().includes(busca)
      );
    });
  }, [filtro]);

  // Calcula estatísticas
  const stats = useMemo(() => {
    const totalProdutos = PRODUTOS_EXEMPLO.length;
    const produtosBaixoEstoque = PRODUTOS_EXEMPLO.filter(
      p => p.quantidade <= p.quantidadeMinima
    ).length;
    const valorTotalEstoque = PRODUTOS_EXEMPLO.reduce(
      (acc, p) => acc + (p.quantidade * p.preco),
      0
    );

    return { totalProdutos, produtosBaixoEstoque, valorTotalEstoque };
  }, []);

  const getStatusEstoque = (quantidade: number, minima: number) => {
    if (quantidade <= minima) {
      return { label: 'Crítico', color: 'bg-red-500', textColor: 'text-red-500' };
    }
    if (quantidade <= minima * 1.5) {
      return { label: 'Baixo', color: 'bg-yellow-500', textColor: 'text-yellow-500' };
    }
    return { label: 'Normal', color: 'bg-green-500', textColor: 'text-green-500' };
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-[#101f3d] to-[#0b1220] overflow-hidden">
      {/* Cabeçalho */}
      <div className="p-8 border-b border-white/5">
        <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-wide">
          <Package className="inline-block mr-3 text-amber-500" size={32} />
          Controle de Estoque
        </h1>
        <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
          Gerenciamento de produtos e materiais do almoxerifado
        </p>
      </div>

      {/* Cartões de Estatísticas */}
      <div className="grid grid-cols-3 gap-4 px-8 pt-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
          <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-2">
            Total de Produtos
          </p>
          <p className="text-white text-3xl font-black">{stats.totalProdutos}</p>
          <div className="flex items-center gap-2 mt-2">
            <TrendingUp size={14} className="text-blue-400" />
            <span className="text-[10px] text-blue-400 font-bold">Monitorados</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
          <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-2">
            Estoque Crítico
          </p>
          <p className="text-white text-3xl font-black">{stats.produtosBaixoEstoque}</p>
          <div className="flex items-center gap-2 mt-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-[10px] text-red-400 font-bold">Reposição Necessária</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
          <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-2">
            Valor Total
          </p>
          <p className="text-white text-3xl font-black">
            R$ {(stats.valorTotalEstoque / 1000).toFixed(1)}k
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-amber-400 font-bold">Inventário Completo</span>
          </div>
        </div>
      </div>

      {/* Barra de Busca e Filtro */}
      <div className="px-8 pt-8">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-3.5 text-white/40" />
          <Input
            placeholder="Buscar por produto, categoria, fornecedor ou localização..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="pl-12 bg-white/5 border-white/10 text-white placeholder:text-white/40 text-sm"
          />
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="flex-1 px-8 py-6 overflow-auto">
        {produtosFiltrados.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Package size={48} className="mx-auto text-white/20 mb-4" />
              <p className="text-white/40 font-bold">Nenhum produto encontrado</p>
              <p className="text-white/20 text-sm mt-2">
                Tente ajustar seus filtros de busca
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-6 py-4 text-left text-white/40 font-black uppercase text-[10px] tracking-widest">
                    Produto
                  </th>
                  <th className="px-6 py-4 text-left text-white/40 font-black uppercase text-[10px] tracking-widest">
                    Categoria
                  </th>
                  <th className="px-6 py-4 text-center text-white/40 font-black uppercase text-[10px] tracking-widest">
                    Quantidade
                  </th>
                  <th className="px-6 py-4 text-center text-white/40 font-black uppercase text-[10px] tracking-widest">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-white/40 font-black uppercase text-[10px] tracking-widest">
                    Fornecedor
                  </th>
                  <th className="px-6 py-4 text-left text-white/40 font-black uppercase text-[10px] tracking-widest">
                    Localização
                  </th>
                  <th className="px-6 py-4 text-center text-white/40 font-black uppercase text-[10px] tracking-widest">
                    Frequência de Compra
                  </th>
                  <th className="px-6 py-4 text-right text-white/40 font-black uppercase text-[10px] tracking-widest">
                    Preço Unit.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {produtosFiltrados.map((produto) => {
                  const status = getStatusEstoque(produto.quantidade, produto.quantidadeMinima);
                  return (
                    <tr key={produto.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-white font-bold text-xs">{produto.nome}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white/60 text-xs">{produto.categoria}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-white font-bold text-xs">
                            {produto.quantidade}
                          </span>
                          <span className="text-white/40 text-[9px]">mín: {produto.quantidadeMinima}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant="outline" className={`${status.color} border-0`}>
                          <span className="text-white text-[10px] font-bold">{status.label}</span>
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white/60 text-xs">{produto.fornecedor}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white/60 text-xs">{produto.localizacao}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-white/60 text-xs">{produto.frequenciaCompra}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-amber-400 font-bold text-xs">
                          R$ {produto.preco.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rodapé com contagem de resultados */}
      <div className="px-8 py-4 border-t border-white/5 bg-white/[0.02]">
        <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
          Exibindo {produtosFiltrados.length} de {PRODUTOS_EXEMPLO.length} produtos
        </p>
      </div>
    </div>
  );
}
