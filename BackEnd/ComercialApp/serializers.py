import re
from decimal import Decimal
from rest_framework import serializers
from .models import (
    Cliente, Negocio, Servico, User,
    Levantamento, MDO, Ativ_prevista, Material, 
    Servico_terceirizado, Orcamento, Resumo_orcamento,
    OrdemServico, Workspace, normalize_workspace_data,
    Escopo, PropostaComercial
)

# ----------------- Core ------------------

class ServicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servico
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

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

class NegocioSerializer(serializers.ModelSerializer):
    servicos = ServicoSerializer(many=True, required=False)
    cliente_detalhes = ClienteSerializer(source='cliente', read_only=True)
    orcamentos = serializers.SerializerMethodField()
    propostas = serializers.SerializerMethodField()

    class Meta:
        model = Negocio
        fields = '__all__'

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

    # Ensina o Django a salvar os serviços junto com o Negócio
    def create(self, validated_data):
        # 1. Tira a lista de serviços do pacote principal
        servicos_data = validated_data.pop('servicos', [])
        
        # 2. Cria o Negócio no banco de dados primeiro
        negocio = Negocio.objects.create(**validated_data)
        
        # 3. Cria cada serviço e vincula ao negócio
        for servico_data in servicos_data:
            Servico.objects.create(negocio=negocio, **servico_data)
            
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
            'escopoA', 'escopoBasicoServicos', 'versao'
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
    encerramento = serializers.CharField(required=False, allow_blank=True, default='')
    proposta_escopo = EscopoSerializer(many=True, read_only=True)
    proposta_escopo_input = EscopoSerializer(source='proposta_escopo', many=True, write_only=True, required=False)

    class Meta:
        model = PropostaComercial
        fields = [
            'id', 'data_criacao', 'numeroProposta', 'status', 'motivoRecusaProposta',
            'cliente', 'cliente_detalhes', 'negocio', 'negocio_detalhes',
            'referencias', 'saudacao', 'assunto', 'textoAbertura',
            'responsabilidadeContratada', 'responsabilidadeContratante', 'preco',
            'condicoesGerais', 'condicoesPagamento', 'prazo', 'encerramento',
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

        return {
            'numeroOrcamento': obj.numero_orcamento,
            'solicitante': obj.levantamento.negocio.solicitante if obj.levantamento and obj.levantamento.negocio else '',
            'responsavelComercial': obj.levantamento.cliente.razao_social if obj.levantamento else '',
            'escopoOrcamento': '',
            'documentosReferencia': str(obj.levantamento.arquivos_negocio) if obj.levantamento else '',
            'dadosServicos': dados_servicos,
            'maoDeObra': MDOSerializer(obj.mao_de_obra.all(), many=True).data,
            'materiais': MaterialSerializer(obj.materiais.all(), many=True).data,
            'terceirizados': ServicosTerceirizadosSerializer(obj.terceirizados.all(), many=True).data,
            'atividades': Ativ_previstaSerializer(obj.atividades.all(), many=True).data,
            'observacoes': obj.observacoes_setor_orcamento or '',
            'margem': float(obj.resumo.margem) if obj.resumo else 0,
            'oh': float(obj.resumo.OH) if obj.resumo else 0,
            'impostos': float(obj.resumo.impostos) if obj.resumo else 0,
            'quantidadeItensProduzidos': obj.resumo.qnt if obj.resumo else 0
        }

    def get_valores(self, obj):
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
            'quantidadeItensProduzidos': int(qnt),
            'valorPorUnidade': float(valor_por_unidade)
        }

    def create(self, validated_data):
        data = self.initial_data
        # ... (código anterior de criação de levantamento e resumo)

        # Crie o orçamento garantindo que observacoes não seja None
        orcamento = Orcamento.objects.create(
            levantamento=levantamento,
            resumo=resumo,
            observacoes_setor_orcamento=data.get('observacoes', '') or '',
            numero_orcamento=data.get('numeroOrcamento', '') or '',
            **validated_data
        )

        # Salva itens filhos com conversão de tipos explícita
        for mdo in data.get('mao_de_obra', []):
            MDO.objects.create(
                orcamento=orcamento, 
                fnc=mdo.get('fnc'),
                qnt=int(mdo.get('qnt') or 0),
                dias=int(mdo.get('dias') or 0),
                custo_unit_dia=Decimal(str(mdo.get('custo_unit_dia') or 0)),
                observacao=mdo.get('observacao', '')
            )
            
        # ... Repita essa lógica de conversão Decimal(str()) para Materiais e Terceirizados
        return orcamento

# --------------------- Ordem de Servico (OS) ---------------------

class OrdemServicoSerializer(serializers.ModelSerializer):
    cliente_detalhes = ClienteSerializer(source='cliente', read_only=True)
    negocio_detalhes = NegocioSerializer(source='negocio', read_only=True)
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
            'data_aprovacao', 'documento_assinatura_aprovacao',
            'created_at', 'updated_at'
        ]
        read_only_fields = ('id', 'numero_os', 'data_emissao', 'created_at', 'updated_at', 'cliente', 'negocio')
    
    def create(self, validated_data):
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        numero_os = timestamp
        
        contador = 1
        numero_original = numero_os
        while OrdemServico.objects.filter(numero_os=numero_os).exists():
            numero_os = f"{numero_original}{contador}"
            contador += 1
        
        validated_data['numero_os'] = numero_os
        return super().create(validated_data)

class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

    def validate_data(self, value):
        return normalize_workspace_data(value)

    def create(self, validated_data):
        validated_data['data'] = normalize_workspace_data(
            validated_data.get('data', {})
        )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'data' in validated_data:
            instance.data = normalize_workspace_data(
                validated_data['data']
            )
            validated_data.pop('data', None)

        return super().update(instance, validated_data)