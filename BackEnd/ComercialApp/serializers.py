import re
from decimal import Decimal
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password as django_validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import (
    Cliente, Negocio, Servico, User, ItemAlocacao,
    Levantamento, MDO, Ativ_prevista, Material,
    Servico_terceirizado, Orcamento, Resumo_orcamento,
    OrdemServico,
    Escopo, PropostaComercial, Fornecedor,
    Medicao, MedicaoItem, Documento, LogAtividade
)

# ----------------- Documentos ------------------

class DocumentoSerializer(serializers.ModelSerializer):
    # `arquivo` é o binário recebido no upload (write-only); na leitura expomos `url`.
    arquivo = serializers.FileField(write_only=True)
    # URL RELATIVA (/media/...). Mantida relativa de propósito: o frontend acessa
    # tudo via mesmo origem (proxy do Vite / túnel ngrok único), sem CORS. Não usar
    # build_absolute_uri (injetaria localhost:8000 e quebraria pelo túnel).
    url = serializers.SerializerMethodField()

    class Meta:
        model = Documento
        fields = [
            'id', 'arquivo', 'url', 'nome_original', 'tipo', 'tamanho',
            'categoria', 'vinculo_tipo', 'vinculo_id', 'uploaded_at',
        ]
        read_only_fields = ['url', 'tamanho', 'uploaded_at']

    def get_url(self, obj):
        try:
            return obj.arquivo.url if obj.arquivo else None
        except ValueError:
            return None


# ----------------- Core ------------------

class ServicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servico
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['cpf', 'nome', 'email', 'cargo', 'departamento',
                  'is_staff', 'is_superuser', 'is_active', 'password',
                  'role', 'permissoes']
        read_only_fields = ['is_superuser', 'is_staff']

    def validate_password(self, value):
        if value:
            try:
                django_validate_password(value)
            except DjangoValidationError as e:
                raise serializers.ValidationError(list(e.messages))
        return value

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        user.set_password(password or User.objects.make_random_password())
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance

class ClienteSerializer(serializers.ModelSerializer):
    negocios = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = Cliente
        fields = '__all__'

    def validate(self, attrs):
        # Removemos o documento se ele for vazio para não violar a unicidade
        if 'documento' in attrs and (attrs['documento'] is None or attrs['documento'] == ""):
            attrs.pop('documento', None)
        return attrs

    def create(self, validated_data):
        # Verifica se o documento já existe antes de salvar
        doc = validated_data.get('documento')
        if doc and Cliente.objects.filter(documento=doc).exists():
            # Retorna o cliente existente em vez de dar erro
            return Cliente.objects.get(documento=doc)
        return super().create(validated_data)

class FornecedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fornecedor
        fields = '__all__'


class NegocioResumoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Negocio
        fields = [
            'id', 'cliente', 'empresa_prestadora', 'nome_negocio',
            'solicitante', 'cargo', 'telefone', 'email',
            'categoria', 'status', 'orcamento_realizado',
            'requer_reorcamento', 'tipo_servico',
            'data_solicitacao'
        ]

class ItemAlocacaoSerializer(serializers.ModelSerializer):
    valor_total = serializers.ReadOnlyField()

    class Meta:
        model = ItemAlocacao
        fields = [
            'id', 'equipamento', 'estoque_ref', 'unidade', 'quantidade',
            'observacao', 'valor_indenizacao', 'valor_locacao', 'margem', 'oh', 'valor_total',
        ]


class NegocioSerializer(serializers.ModelSerializer):
    servicos = ServicoSerializer(many=True, required=False)
    itens_alocacao = ItemAlocacaoSerializer(many=True, required=False)
    cliente_detalhes = ClienteSerializer(source='cliente', read_only=True)
    orcamentos = serializers.SerializerMethodField()
    propostas = serializers.SerializerMethodField()
    documentos = serializers.SerializerMethodField()

    class Meta:
        model = Negocio
        fields = '__all__'

    def get_documentos(self, obj):
        docs = Documento.objects.filter(vinculo_tipo='negocio', vinculo_id=str(obj.id))
        return DocumentoSerializer(docs, many=True, context=self.context).data

    # No serializers.py, dentro da classe NegocioSerializer
    def get_orcamentos(self, obj):
        try:
            # Acessa o levantamento relacionado ao negócio
            levantamento = getattr(obj, 'negocio_orcamento', None)
            if not levantamento:
                return []
            
            # Acessa o orçamento relacionado ao levantamento
            orcamento = getattr(levantamento, 'orcamento_levantamento', None)
            if not orcamento:
                return []
                
            return [OrcamentoSerializer(orcamento).data]
        except Exception as e:
            # Isso força o erro a aparecer no seu console de qualquer jeito
            print(f"ERRO CRÍTICO NO GET_ORCAMENTOS: {str(e)}")
            return []

    def get_propostas(self, obj):
        propostas = obj.negocio_propostas.all()
        return PropostaComercialResumoSerializer(propostas, many=True).data

    # Ensina o Django a salvar os serviços + itens de alocação junto com o Negócio
    def create(self, validated_data):
        # 1. Tira as listas aninhadas do pacote principal
        servicos_data = validated_data.pop('servicos', [])
        itens_alocacao_data = validated_data.pop('itens_alocacao', [])

        # 2. Cria o Negócio no banco de dados primeiro
        negocio = Negocio.objects.create(**validated_data)

        # 3. Cria cada serviço e vincula ao negócio
        for servico_data in servicos_data:
            Servico.objects.create(negocio=negocio, **servico_data)

        # 4. Cria cada item de locação (sem precificação ainda — vem no Orçamento)
        for item_data in itens_alocacao_data:
            ItemAlocacao.objects.create(negocio=negocio, **item_data)

        return negocio

# ------------------ Orçamento Items -------------------

class MDOSerializer(serializers.ModelSerializer):
    valor_total = serializers.ReadOnlyField() 
    class Meta:
        model = MDO
        fields = '__all__'

class Ativ_previstaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ativ_prevista
        fields = '__all__'

class MaterialSerializer(serializers.ModelSerializer):
    valor_total = serializers.ReadOnlyField() # Note: valor_total é property no model, mantenha read_only
    class Meta:
        model = Material
        fields = '__all__'

class ServicosTerceirizadosSerializer(serializers.ModelSerializer):
    valor_tot = serializers.ReadOnlyField() # property no model
    class Meta:
        model = Servico_terceirizado
        fields = '__all__'

class EscopoSerializer(serializers.ModelSerializer):
    tipo_detalhes = ServicoSerializer(source='tipo', read_only=True)

    class Meta:
        model = Escopo
        fields = '__all__'

class PropostaComercialResumoSerializer(serializers.ModelSerializer):
    numeroProposta = serializers.CharField(source='numero_proposta', read_only=True)
    dataCriacao = serializers.DateField(source='data_criacao', read_only=True)
    status = serializers.CharField(read_only=True)
    motivoRecusaProposta = serializers.CharField(source='motivo_recusa', read_only=True)
    textoAbertura = serializers.CharField(source='texto_de_abertura', read_only=True)
    escopoA = serializers.SerializerMethodField()
    escopoBasicoServicos = serializers.SerializerMethodField()
    precoItens = serializers.SerializerMethodField()
    referencias = serializers.CharField(source='referencia', read_only=True)
    responsabilidadeContratada = serializers.CharField(source='responsabilidade_contratada', read_only=True)
    responsabilidadeContratante = serializers.CharField(source='responsabilidade_contratante', read_only=True)
    condicoesGerais = serializers.CharField(source='condicoes_gerais', read_only=True)
    condicoesPagamento = serializers.CharField(source='condicoes_pagamento', read_only=True)
    versao = serializers.SerializerMethodField()

    class Meta:
        model = PropostaComercial
        fields = [
            'id', 'numeroProposta', 'dataCriacao', 'status', 'motivoRecusaProposta',
            'cliente', 'negocio', 'referencias', 'saudacao', 'assunto', 'textoAbertura',
            'responsabilidadeContratada', 'responsabilidadeContratante', 'preco',
            'condicoesGerais', 'condicoesPagamento', 'prazo', 'encerramento',
            'escopoA', 'escopoBasicoServicos', 'precoItens', 'versao'
        ]

    def get_versao(self, obj):
        if obj.numero_proposta:
            match = re.search(r'-\d+([A-Z]+)/', obj.numero_proposta)
            if match:
                return match.group(1)
        return ''

    def get_escopoA(self, obj):
        first = obj.proposta_escopo.first()
        return first.descricao if first else ''

    def get_escopoBasicoServicos(self, obj):
        # Fonte FIEL: o JSON estruturado salvo na proposta (preserva colunas/linhas/tabelas).
        if isinstance(obj.escopos_estruturado, list) and obj.escopos_estruturado:
            return obj.escopos_estruturado
        # Fallback (propostas antigas sem o JSON): reconstrução flat dos Escopos relacionais.
        escopos = []
        for escopo in obj.proposta_escopo.all():
            escopos.append({
                'id': str(escopo.id),
                'servicoId': str(escopo.tipo_id) if escopo.tipo_id else '',
                'titulo': str(escopo.tipo.tipo_servico) if escopo.tipo else 'Serviço',
                'descricaoServico': escopo.descricao,
                'textosDepois': [],
                'colunas': ['Descrição'],
                'linhas': [{'id': f'linha-{escopo.id}-1', 'valores': {'Descrição': escopo.descricao or ''}}]
            })
        return escopos

    def get_precoItens(self, obj):
        return obj.preco_itens if isinstance(obj.preco_itens, list) else []

class PropostaComercialSerializer(serializers.ModelSerializer):
    cliente_detalhes = ClienteSerializer(source='cliente', read_only=True)
    negocio_detalhes = NegocioResumoSerializer(source='negocio', read_only=True)
    numeroProposta = serializers.CharField(source='numero_proposta', required=False, allow_blank=True)
    status = serializers.CharField(required=False, allow_blank=True)
    motivoRecusaProposta = serializers.CharField(source='motivo_recusa', required=False, allow_blank=True, allow_null=True)
    referencias = serializers.CharField(source='referencia', required=False, allow_blank=True, default='')
    saudacao = serializers.CharField(required=False, allow_blank=True, default='')
    assunto = serializers.CharField(required=False, allow_blank=True, default='')
    textoAbertura = serializers.CharField(source='texto_de_abertura', required=False, allow_blank=True, default='')
    responsabilidadeContratada = serializers.CharField(source='responsabilidade_contratada', required=False, allow_blank=True, default='')
    responsabilidadeContratante = serializers.CharField(source='responsabilidade_contratante', required=False, allow_blank=True, default='')
    preco = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, default=Decimal('0'))
    condicoesGerais = serializers.CharField(source='condicoes_gerais', required=False, allow_blank=True, default='')
    condicoesPagamento = serializers.CharField(source='condicoes_pagamento', required=False, allow_blank=True, default='')
    prazo = serializers.CharField(required=False, allow_blank=True, default='')
    efetivoPrevisto = serializers.CharField(source='efetivo_previsto', required=False, allow_blank=True, default='')
    encerramento = serializers.CharField(required=False, allow_blank=True, default='')
    proposta_escopo = EscopoSerializer(many=True, read_only=True)
    proposta_escopo_input = EscopoSerializer(source='proposta_escopo', many=True, write_only=True, required=False)
    # Estrutura rica (round-trip fiel via JSON)
    escopoBasicoServicos = serializers.JSONField(source='escopos_estruturado', required=False)
    precoItens = serializers.JSONField(source='preco_itens', required=False)

    class Meta:
        model = PropostaComercial
        fields = [
            'id', 'data_criacao', 'numeroProposta', 'status', 'motivoRecusaProposta',
            'cliente', 'cliente_detalhes', 'negocio', 'negocio_detalhes',
            'referencias', 'saudacao', 'assunto', 'textoAbertura',
            'responsabilidadeContratada', 'responsabilidadeContratante', 'preco',
            'condicoesGerais', 'condicoesPagamento', 'prazo', 'efetivoPrevisto', 'encerramento',
            'escopoBasicoServicos', 'precoItens',
            'proposta_escopo', 'proposta_escopo_input'
        ]

# ------------------  The Summary & Container  -------------------

class Resumo_orcamentoSerializer(serializers.ModelSerializer):
    total_mdo = serializers.ReadOnlyField()
    total_material = serializers.ReadOnlyField()
    total_serv_terceirizado = serializers.ReadOnlyField()
    custo_bruto = serializers.ReadOnlyField()
    custo_com_impostos = serializers.ReadOnlyField()
    custo_por_unidade = serializers.ReadOnlyField()

    class Meta:
        model = Resumo_orcamento
        fields = '__all__' 

class LevantamentoSerializer(serializers.ModelSerializer):
    responsavel_financeiro = serializers.ReadOnlyField()
    class Meta:
        model = Levantamento
        fields = '__all__'

class OrcamentoSerializer(serializers.ModelSerializer):
    levantamento = LevantamentoSerializer(read_only=True)
    resumo = Resumo_orcamentoSerializer(read_only=True)
    
    materiais = MaterialSerializer(many=True, read_only=True)
    mao_de_obra = MDOSerializer(many=True, read_only=True)
    terceirizados = ServicosTerceirizadosSerializer(many=True, read_only=True)
    atividades = Ativ_previstaSerializer(many=True, read_only=True)

    levantamento_id = serializers.PrimaryKeyRelatedField(
        queryset=Levantamento.objects.all(),
        source='levantamento',
        write_only=True
    )
    resumo_input = Resumo_orcamentoSerializer(source='resumo', write_only=True)
    numeroOrcamento = serializers.CharField(source='numero_orcamento', read_only=True)
    versao = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    dataCriacao = serializers.DateField(source='data_criacao', read_only=True)
    dataRecusa = serializers.DateField(source='data_recusa', read_only=True)
    data = serializers.SerializerMethodField()
    valores = serializers.SerializerMethodField()

    class Meta:
        model = Orcamento
        fields = [
            'id', 'levantamento', 'levantamento_id',
            'resumo', 'resumo_input', 'observacoes_setor_orcamento',
            'materiais', 'mao_de_obra', 'terceirizados', 'atividades',
            'numeroOrcamento', 'versao', 'status', 'dataCriacao', 'dataRecusa',
            'data', 'valores'
        ]

    def get_data(self, obj):
        dados_servicos = []
        if obj.levantamento and hasattr(obj.levantamento, 'dados_servicos'):
            dados_servicos = [ServicoSerializer(servico).data for servico in obj.levantamento.dados_servicos]

        # Itens de locação (camelCase para o frontend) — fonte é o Negócio
        negocio = obj.levantamento.negocio if obj.levantamento else None
        modalidade = negocio.modalidade if negocio else 'servico'
        itens_alocacao = [{
            'id': str(item.id),
            'equipamento': item.equipamento or '',
            'estoqueRef': item.estoque_ref or '',
            'unidade': item.unidade or '',
            'quantidade': float(item.quantidade or 0),
            'observacao': item.observacao or '',
            'valorIndenizacao': float(item.valor_indenizacao or 0),
            'valorLocacao': float(item.valor_locacao or 0),
            'valorTotal': float(item.valor_total or 0),
        } for item in (negocio.itens_alocacao.all() if negocio else [])]

        # IMPORTANTE: o frontend (CRM, Orçamentos, OS e PDFs) lê os itens em camelCase
        # com os nomes dos campos do formulário (funcao, descricao, custoUnit, valorTotal...).
        # Por isso mapeamos aqui os campos crus dos models para esse formato, já incluindo
        # os totais calculados pelas properties do model.
        mao_de_obra = [{
            'id': str(item.id),
            'funcao': item.fnc or '',
            'quantidade': float(item.qnt or 0),
            'dias': float(item.dias or 0),
            'custoUnitDia': float(item.custo_unit_dia or 0),
            'valorTotal': float(item.valor_total or 0),
            'observacao': item.observacao or '',
        } for item in obj.mao_de_obra.all()]

        materiais = [{
            'id': str(item.id),
            'descricao': item.item or '',
            'unidade': item.unidade or '',
            'quantidade': float(item.qnt or 0),
            'pesoFator': float(item.peso or 0),
            'custoUnit': float(item.custo_unit or 0),
            'valorTotal': float(item.valor_total or 0),
            'origemTerceiros': 'Sim' if item.terceirizado else 'Nao',
            'observacao': item.observacao or '',
        } for item in obj.materiais.all()]

        terceirizados = [{
            'id': str(item.id),
            'descricao': item.descricao or '',
            'unidade': item.unidade or '',
            'quantidade': float(item.qnt or 0),
            'pesoFator': float(item.peso or 0),
            'custoUnit': float(item.valor_unit or 0),
            'valorTotal': float(item.valor_tot or 0),
            'observacao': item.observacao or '',
        } for item in obj.terceirizados.all()]

        atividades = [{
            'id': str(item.id),
            'atividade': item.atividade or '',
            'dias': float(item.duracao or 0),
            'observacao': item.observacao or '',
        } for item in obj.atividades.all()]

        return {
            'numeroOrcamento': obj.numero_orcamento,
            'solicitante': obj.levantamento.negocio.solicitante if obj.levantamento and obj.levantamento.negocio else '',
            'responsavelComercial': obj.levantamento.cliente.razao_social if obj.levantamento else '',
            'escopoOrcamento': '',
            'documentosReferencia': str(obj.levantamento.arquivos_negocio) if obj.levantamento else '',
            'dadosServicos': dados_servicos,
            'modalidade': modalidade,
            'itensAlocacao': itens_alocacao,
            'maoDeObra': mao_de_obra,
            'materiais': materiais,
            'terceirizados': terceirizados,
            'atividades': atividades,
            'observacoes': obj.observacoes_setor_orcamento or '',
            'margem': float(obj.resumo.margem) if obj.resumo else 0,
            'oh': float(obj.resumo.OH) if obj.resumo else 0,
            'impostos': float(obj.resumo.impostos) if obj.resumo else 0,
            'impostosLocacao': float(obj.resumo.impostos_locacao) if obj.resumo else 0,
            'quantidadeItensProduzidos': float(obj.resumo.qnt) if obj.resumo else 0,
            'atividadesMacro': (obj.resumo.atividades_macro if obj.resumo and isinstance(obj.resumo.atividades_macro, list) else [])
        }

    def get_valores(self, obj):
        # Subtotal de locação BRUTO (Σ qtd × valor_locacao) — separado do preço de serviços.
        negocio = obj.levantamento.negocio if obj.levantamento else None
        subtotal_locacao_bruto = sum(
            (Decimal(item.valor_total or 0) for item in (negocio.itens_alocacao.all() if negocio else [])),
            Decimal(0),
        )
        # Imposto da locação é calculado À PARTE do imposto de serviço.
        impostos_locacao_pct = Decimal(getattr(obj.resumo, 'impostos_locacao', 0) or 0) if obj.resumo else Decimal(0)
        valor_impostos_locacao = (subtotal_locacao_bruto * impostos_locacao_pct) / Decimal(100)
        subtotal_locacao = subtotal_locacao_bruto + valor_impostos_locacao  # subtotal de locação COM imposto

        if not obj.resumo:
            return {
                'totalMaoDeObra': 0,
                'totalMateriais': 0,
                'totalTerceirizados': 0,
                'totalBruto': 0,
                'subtotal': 0,
                'margem': 0,
                'oh': 0,
                'impostos': 0,
                'valorMargem': 0,
                'valorOH': 0,
                'valorImpostos': 0,
                'totalSemImposto': 0,
                'precoFinal': 0,
                'subtotalLocacaoBruto': float(subtotal_locacao_bruto),
                'impostosLocacao': float(impostos_locacao_pct),
                'valorImpostosLocacao': float(valor_impostos_locacao),
                'subtotalLocacao': float(subtotal_locacao),
                'totalGeral': float(subtotal_locacao),
                'quantidadeItensProduzidos': 0,
                'valorPorUnidade': 0
            }

        # Normaliza valores para Decimal para evitar erros de tipo
        total_mdo = Decimal(obj.resumo.total_mdo or 0)
        total_material = Decimal(obj.resumo.total_material or 0)
        total_terceirizados = Decimal(obj.resumo.total_serv_terceirizado or 0)
        total_bruto = total_mdo + total_material + total_terceirizados

        margem_percentual = Decimal(obj.resumo.margem or 0)
        oh_percentual = Decimal(obj.resumo.OH or 0)
        impostos_percentual = Decimal(obj.resumo.impostos or 0)

        valor_margem = (total_bruto * margem_percentual) / Decimal(100)
        valor_oh = (total_bruto * oh_percentual) / Decimal(100)
        total_sem_imposto = total_bruto + valor_margem + valor_oh
        valor_impostos = (total_sem_imposto * impostos_percentual) / Decimal(100)
        preco_final = total_sem_imposto + valor_impostos

        qnt = Decimal(obj.resumo.qnt or 0)
        valor_por_unidade = (preco_final / qnt) if qnt > 0 else Decimal(0)

        # Converte para tipos nativos JSON-serializáveis (float/int)
        return {
            'totalMaoDeObra': float(total_mdo),
            'totalMateriais': float(total_material),
            'totalTerceirizados': float(total_terceirizados),
            'totalBruto': float(total_bruto),
            'subtotal': float(total_bruto),
            'margem': float(margem_percentual),
            'oh': float(oh_percentual),
            'impostos': float(impostos_percentual),
            'valorMargem': float(valor_margem),
            'valorOH': float(valor_oh),
            'valorImpostos': float(valor_impostos),
            'totalSemImposto': float(total_sem_imposto),
            'precoFinal': float(preco_final),
            'subtotalLocacaoBruto': float(subtotal_locacao_bruto),
            'impostosLocacao': float(impostos_locacao_pct),
            'valorImpostosLocacao': float(valor_impostos_locacao),
            'subtotalLocacao': float(subtotal_locacao),
            'totalGeral': float(preco_final + subtotal_locacao),
            'quantidadeItensProduzidos': float(qnt),
            'valorPorUnidade': float(valor_por_unidade)
        }

# --------------------- Ordem de Servico (OS) ---------------------

class OrdemServicoSerializer(serializers.ModelSerializer):
    cliente_detalhes = ClienteSerializer(source='cliente', read_only=True)
    negocio_detalhes = NegocioSerializer(source='negocio', read_only=True)
    numero_os = serializers.CharField(required=False, allow_blank=True)
    local = serializers.CharField(allow_blank=True, default='')
    supervisor_encarregado = serializers.CharField(allow_blank=True, default='')
    descricao_geral_servico = serializers.CharField(allow_blank=True, default='')

    cliente_id = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.all(),
        source='cliente',
        write_only=True
    )
    negocio_id = serializers.PrimaryKeyRelatedField(
        queryset=Negocio.objects.all(),
        source='negocio',
        write_only=True,
        required=False,
        allow_null=True
    )
    documentos = serializers.SerializerMethodField()

    class Meta:
        model = OrdemServico
        fields = [
            'id', 'numero_os', 'data_emissao',
            'cliente', 'cliente_id', 'cliente_detalhes',
            'negocio', 'negocio_id', 'negocio_detalhes',
            'projeto', 'equipamento', 'local', 'cc',
            'data_inicio_previsto', 'data_termino_previsto',
            'supervisor_encarregado', 'descricao_geral_servico',
            'a_ser_incluido', 'mao_obra', 'horas_trabalhadas_servico',
            'status_os', 'status_envio', 'status_aprovacao',
            'fechada', 'data_fechamento',
            'data_aprovacao', 'documento_assinatura_aprovacao',
            'documentos', 'created_at', 'updated_at'
        ]
        read_only_fields = ('id', 'data_emissao', 'created_at', 'updated_at', 'cliente', 'negocio')

    def get_documentos(self, obj):
        docs = Documento.objects.filter(vinculo_tipo='os', vinculo_id=str(obj.id))
        return DocumentoSerializer(docs, many=True, context=self.context).data
    
    def create(self, validated_data):
        from datetime import datetime

        def index_to_version(index: int) -> str:
            value = index
            output = ''
            while value >= 0:
                output = chr((value % 26) + 65) + output
                value = (value // 26) - 1
            return output

        def version_to_index(version: str) -> int:
            cleaned = ''.join(ch for ch in str(version or '').upper() if 'A' <= ch <= 'Z')
            if not cleaned:
                return -1

            value = 0
            for char in cleaned:
                value = (value * 26) + (ord(char) - 64)
            return value - 1

        numero_os = str(validated_data.pop('numero_os', '') or '').strip()
        if not numero_os:
            negocio = validated_data.get('negocio')
            if negocio:
                prefixo = 'VTS' if 'servinave' in str(getattr(negocio, 'empresa_prestadora', '')).lower() else 'LN'
                numero_os = f"{prefixo}-{str(negocio.id).zfill(4)}/{datetime.now().strftime('%y')}"

        if numero_os:
            import re

            match = re.match(r'^(?:(?P<prefix>[A-Z]+)-)?(?P<num>\d+)(?P<versao>[A-Z]+)?/(?P<ano>\d+)$', numero_os)
            if match:
                prefixo = f"{match.group('prefix')}-" if match.group('prefix') else ''
                numero_base = match.group('num')
                ano = match.group('ano')
                versao_inicial = match.group('versao') or ''

                def build_numero(versao: str = '') -> str:
                    return f"{prefixo}{numero_base}{versao}/{ano}"

                candidato = build_numero(versao_inicial)
                contador = 0 if not versao_inicial else version_to_index(versao_inicial) + 1
                while OrdemServico.objects.filter(numero_os=candidato).exists():
                    candidato = build_numero(index_to_version(contador))
                    contador += 1

                numero_os = candidato
        
        validated_data['numero_os'] = numero_os
        return super().create(validated_data)


# --------------------- Medição ---------------------

class MedicaoItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicaoItem
        exclude = ['medicao']


class MedicaoSerializer(serializers.ModelSerializer):
    itens = MedicaoItemSerializer(many=True, required=False)
    ordem_servico_numero = serializers.CharField(source='ordem_servico.numero_os', read_only=True, default='')
    cliente_negocio = serializers.CharField(source='negocio.cliente.razao_social', read_only=True, default='')

    class Meta:
        model = Medicao
        fields = '__all__'

    def create(self, validated_data):
        from django.utils import timezone
        itens = validated_data.pop('itens', [])
        medicao = Medicao(**validated_data)
        # Versionamento por OS: LN/VTS-<negocio>/<ano>-<NNN>. Cada nova medição da mesma OS
        # incrementa a versão (001, 002, 003...). Difere do A/B/C de orçamento/proposta/OS.
        negocio = medicao.negocio
        ordem = medicao.ordem_servico
        base_qs = Medicao.objects.filter(ordem_servico=ordem) if ordem else Medicao.objects.filter(negocio=negocio)
        versao = base_qs.count() + 1
        prefixo = 'VTS' if 'servinave' in str(getattr(negocio, 'empresa_prestadora', '')).lower() else 'LN'
        ano = timezone.now().strftime('%y')
        medicao.versao = versao
        medicao.numero_medicao = f"{prefixo}-{str(negocio.id).zfill(4)}/{ano}-{str(versao).zfill(3)}"
        medicao.save()
        for item in itens:
            MedicaoItem.objects.create(medicao=medicao, **item)
        return medicao

    def update(self, instance, validated_data):
        itens = validated_data.pop('itens', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if itens is not None:
            instance.itens.all().delete()
            for item in itens:
                MedicaoItem.objects.create(medicao=instance, **item)
        return instance


# --------------------- Log de Atividades ---------------------

class LogAtividadeSerializer(serializers.ModelSerializer):
    acao_display = serializers.CharField(source='get_acao_display', read_only=True)
    timestamp_fmt = serializers.SerializerMethodField()

    class Meta:
        model = LogAtividade
        fields = ['id', 'usuario_cpf', 'usuario_nome', 'acao', 'acao_display',
                  'modulo', 'descricao', 'timestamp', 'timestamp_fmt']

    def get_timestamp_fmt(self, obj):
        return obj.timestamp.strftime('%d/%m/%Y %H:%M:%S')
