from django.db import models
from django.utils import timezone
from decimal import Decimal


def build_default_workspace_data():
    return {
        'empresa': None,
        'users': [],
        'pendingUsers': [],
        'clientes': [],
        'funcionarios': [],
        'equipes': [],
        'obras': [],
        'os': [],
        'alocacoes': [],
        'registrosHoras': [],
        'folhaPagamento': [],
        'financeiro': [],
        'compras': [],
        'fornecedores': [],
        'horas': [],
        'usuarios': [],
        'config': {
            'empresaNome': 'Linave ERP Demo',
            'empresasPrestadoras': [
                {
                    'id': 'EMP-LINAVE',
                    'nome': 'Linave',
                    'cnpj': '',
                    'endereco': '',
                    'contato': '',
                    'email': '',
                    'ativa': True,
                },
                {
                    'id': 'EMP-SERVINAVE',
                    'nome': 'Servinave',
                    'cnpj': '',
                    'endereco': 'Rua Miguel de Lemos, 44 Fundos - Ponta D\'areia',
                    'contato': '+55 (21) 2620-1850',
                    'email': 'comercial@servinave.com.br',
                    'ativa': True,
                },
            ],
        },
        'listas': {
            'departamentos': [],
            'categorias': [],
            'prioridades': [],
        },
        '_counters': {},
        '_osCounters': {},
    }


def normalize_workspace_data(data):
    defaults = build_default_workspace_data()

    if not isinstance(data, dict):
        return defaults

    normalized = {**defaults, **data}

    for key in (
        'users',
        'pendingUsers',
        'clientes',
        'funcionarios',
        'equipes',
        'obras',
        'os',
        'alocacoes',
        'registrosHoras',
        'folhaPagamento',
        'financeiro',
        'compras',
        'fornecedores',
        'horas',
        'usuarios',
    ):
        normalized[key] = data.get(key, defaults[key]) if isinstance(data.get(key, defaults[key]), list) else []

    for key in ('config', 'listas', '_counters', '_osCounters'):
        source = data.get(key, {}) if isinstance(data.get(key, {}), dict) else {}
        normalized[key] = {**defaults[key], **source}

    normalized_os = []
    for item in normalized.get('os', []):
        if not isinstance(item, dict):
            continue
        horas = item.get('horasTrabalhadasPorServico', [])
        if not isinstance(horas, list):
            horas = []
        normalized_os.append({
            **item,
            'horasTrabalhadasPorServico': horas,
        })
    normalized['os'] = normalized_os

    normalized['empresa'] = data.get('empresa', defaults['empresa'])

    # Comercial clients must be managed directly by the SQL backend.
    # Do not persist workspace-local client collections.
    normalized['clientes'] = []

    return normalized

class Cliente(models.Model):
    TIPO_CHOICES = [('Fisica', 'Pessoa Física'), ('Juridica', 'Pessoa Jurídica')]
    STATUS_CHOICES = [('Ativo', 'Ativo'), ('Inativo', 'Inativo')]

    id = models.BigAutoField(primary_key=True)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES, default='Fisica')
    razao_social = models.CharField(max_length=150) # "Razão Social / Nome Completo"
    nome_fantasia = models.CharField(max_length=150, null=True, blank=True)
    documento = models.CharField(max_length=20, unique=True, null=True, blank=True) # CPF ou CNPJ
    inscricao_estadual = models.CharField(max_length=20, null=True, blank=True)
    status = models.CharField(choices=STATUS_CHOICES, max_length=10, default='Ativo')
    contato_geral = models.CharField(max_length=255, null=True, blank=True) 
    endereco_completo = models.TextField(null=True, blank=True)
    data_cadastro = models.DateField(auto_now_add=True)
    usuario_responsavel = models.ForeignKey('User', on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f'Razão Social: {self.razao_social}'


class Negocio(models.Model):
    CATEGORIA_CHOICES = [
        ('Planejamento', 'Planejamento'),
        ('Negociação', 'Negociação'),
        ('Em Andamento', 'Em Andamento'),
        ('Finalização', 'Finalização'),
    ]

    id = models.BigAutoField(primary_key=True)
    cliente = models.ForeignKey('Cliente', on_delete=models.CASCADE, related_name='negocios')
    empresa_prestadora = models.CharField(max_length=100) 
    nome_negocio = models.CharField(max_length=200) 
    solicitante = models.CharField(max_length=150)
    cargo = models.CharField(max_length=100, null=True, blank=True)
    telefone = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField(max_length=254)
    
    categoria = models.CharField(
        max_length=30, 
        choices=CATEGORIA_CHOICES, 
        default='Planejamento'
    )
    
    # CAMPOS ESSENCIAIS PARA O FLUXO DO KANBAN:
    status = models.CharField(max_length=50, default='Aguardando orçamento')
    orcamento_realizado = models.BooleanField(default=False)
    requer_reorcamento = models.BooleanField(default=True)
    tipo_servico = models.CharField(max_length=100, null=True, blank=True) # Recebe o tipo principal do form

    data_solicitacao = models.DateField(auto_now_add=True)
    data_prevista_inicio = models.DateField(null=True, blank=True)
    data_prevista_final = models.DateField(null=True, blank=True)
    arquivo_documento = models.FileField(upload_to='documentos_negocios/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nome_negocio} - {self.cliente.razao_social}"
    
class Servico(models.Model):
    id = models.BigAutoField(primary_key=True)
    negocio = models.ForeignKey(Negocio, on_delete=models.CASCADE, related_name='servicos')
    tipo_servico = models.CharField(max_length=100) 
    categoria = models.CharField(max_length=100)    
    local_execucao = models.CharField(max_length=150) 
    descricao = models.TextField()                 
    embarcacao = models.CharField(max_length=100)
    porto = models.CharField(max_length=100, null=True, blank=True)
    observacoes = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.tipo_servico} - {self.embarcacao}"
    
class User(models.Model):
    user_email = models.CharField(max_length=150, primary_key=True)
    user_name = models.CharField(max_length=200)
    user_funcao = models.CharField(max_length=100)
    user_setor = models.CharField(max_length=100)
    user_data_nascimento = models.DateField()
    
    def __str__(self):
        return f"E-mail: {self.user_email} - Nome: {self.user_name} - Função: {self.user_funcao} - Setor: {self.user_setor}"

#--------------------- Orçamento ------------------

class Levantamento(models.Model):
    #External not displayed attributes:
    id_orcamento = models.BigAutoField(primary_key=True) # This entry id, auto-generated by the system
    #Structure
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='cliente_orcamentos') # client id listed on selected negocio entry , auto-filled from negocio data
    negocio = models.OneToOneField(Negocio, on_delete=models.CASCADE, related_name='negocio_orcamento') # negocio id which this orcamento is about, to be selected from a dropdown list of existing negocio entries
    #doc de referencia??
    #escopo???
    #---------------------------------------------------------------------------
    @property
    def responsavel_financeiro(self):
        """
        Returns the soliciter from the associated Business.
        """
        return self.negocio.solicitante
    @property
    def dados_servicos(self):
        """
        Pulls all services linked to the specific business deal.
        """
        # This uses the 'servicos' related_name you defined in your Servico model
        return self.negocio.servicos.all()

    @property
    def arquivos_negocio(self):
        """
        Accesses the file attached to the business deal.
        """
        return self.negocio.arquivo_documento
    #----------------------------------------------------------------------------
    def __str__(self):
        return f"Orçamento {self.id_orcamento} - Negócio {self.negocio.id} - Solicitante: {self.negocio.solicitante}"

class MDO(models.Model): #Mão de obra
    #External not displayed attributes:
    id = models.BigAutoField(primary_key=True) # This entry id, auto-generated by the system
    #Structure
    fnc = models.CharField(max_length=100) # free text field to specify the role or function of the labor
    qnt = models.IntegerField(null=True, blank=True)
    dias = models.IntegerField(null=True, blank=True)
    custo_unit_dia = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    observacao = models.TextField(blank=True, null=True) # free text field for any additional notes or comments about the labor
    
    orcamento = models.ForeignKey('Orcamento', on_delete=models.CASCADE, related_name="mao_de_obra") # link to the orcamento entry that this MDO entry is part of, N:1 N MDO to 1 Resumo_orcamento   
    
    @property
    def valor_total(self):
        return self.qnt * self.dias * self.custo_unit_dia
    
    def __str__(self):
        return f"Mão de Obra {self.id} - Custo: {self.valor_total}"

class Ativ_prevista(models.Model): 
    #External not displayed attributes:
    id = models.BigAutoField(primary_key=True) # This entry id, auto-generated by the system
    #Structure
    atividade = models.CharField(max_length=200) 
    duracao = models.IntegerField() 
    observacao = models.TextField(blank=True, null=True) 
    orcamento = models.ForeignKey('Orcamento', on_delete=models.CASCADE, related_name='atividades')
    
    def __str__(self):
        return f"Atividade Prevista {self.id} - Descrição: {self.atividade} - Duração: {self.duracao} dias"

class Material(models.Model):
    #External not displayed attributes:
    id = models.BigAutoField(primary_key=True) # This entry id, auto-generated by the system
    #Structure
    item = models.CharField(max_length=100) # free text field to specify the name of the material
    unidade = models.CharField(max_length=10) # field to specify the unit of measurement for the material
    qnt = models.IntegerField(null=True, blank=True) 
    peso = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True) 
    custo_unit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    terceirizado = models.BooleanField(default=False) # field to specify whether the material is outsourced or not
    observacao = models.TextField(blank=True, null=True) # free text field for any additional notes or comments about the material
    
    @property
    def valor_total(self):
        return self.quantidade * self.custo_unitario

    orcamento = models.ForeignKey('Orcamento', on_delete=models.CASCADE, related_name="materiais")
    def __str__(self):
        return f"Material {self.id} - Custo: {self.valor_total}"

class Servico_terceirizado(models.Model):
    #External not displayed attributes:
    id = models.BigAutoField(primary_key=True) # This entry id, auto-generated by the system
    #Structure
    descricao = models.CharField(max_length=100) # nome; identificacao do servico recebido
    unidade = models.CharField(max_length=10)  
    qnt = models.IntegerField(null=True, blank=True)
    peso = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    valor_unit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True) 
    observacao = models.CharField(max_length=250)

    @property
    def valor_tot(self):
        return self.quantidade * self.custo_unit

    orcamento = models.ForeignKey('Orcamento', on_delete=models.CASCADE, related_name="terceirizados")
    def __str__(self):
        return f'Descrição: {self.descricao} - Custo total: {self.valor_tot}'

class Resumo_orcamento(models.Model):
    id = models.BigAutoField(primary_key=True) # This entry id, auto-generated by the system 
    #fields:
    margem = models.DecimalField(max_digits = 5, decimal_places = 2) #validators=[MinValueValidator(0),MaxValueValidator(100)]
    OH = models.DecimalField(max_digits=10, decimal_places = 2)
    impostos = models.DecimalField(max_digits=5, decimal_places = 2)
    qnt = models.IntegerField() #how many units of the final product or service are expected to be delivered, to be filled in the "Quantidade" field of the orçamento form, used to calculate the cost per unit in the Resumo_orcamento model and displayed in the "Custo por Unidade" field of the orçamento form.
    #---------------------------------------------------------------------------------
    # Calculation properties reach back through the Orcamento link
    @property
    def total_mdo(self):
        # self.orcamento_resumo is the related_name from the Orcamento model
        return sum(item.valor_total for item in self.orcamento_resumo.mao_de_obra.all())

    @property
    def total_material(self):
        return sum(item.valor_total for item in self.orcamento_resumo.materiais.all())

    @property
    def total_serv_terceirizado(self):
        return sum(item.valor_tot for item in self.orcamento_resumo.terceirizados.all())

    @property
    def custo_bruto(self):
        return self.total_mdo + self.total_material + self.total_serv_terceirizado

    @property
    def custo_com_impostos(self):
        # Simplified example math
        tax_multiplier = Decimal('1') + (self.impostos / Decimal('100'))
        return self.custo_bruto * tax_multiplier

    @property
    def custo_por_unidade(self):
        if self.qnt > 0:
            return self.custo_com_impostos / self.qnt
        return 0
   
   
    def __str__(self):
        return f'Custo Total: {self.custo_com_impostos} - Custo por Unidade: {self.custo_por_unidade}'
 #---------------------------------------------------------------------------------
 
class Orcamento(models.Model):
    id = models.BigAutoField(primary_key=True)
    levantamento = models.OneToOneField(Levantamento, on_delete=models.CASCADE, related_name='orcamento_levantamento')
    observacoes_setor_orcamento = models.TextField(blank=True, null=True)
    resumo = models.OneToOneField(Resumo_orcamento, on_delete=models.CASCADE, related_name='orcamento_resumo')
    numero_orcamento = models.CharField(max_length=100, blank=True)
    versao = models.CharField(max_length=10, default='A', blank=True)
    status = models.CharField(max_length=50, default='pendente')
    data_criacao = models.DateField(default=timezone.now)
    data_recusa = models.DateField(null=True, blank=True)

    def __str__(self):
        return f'Orçamento {self.id} - Levantamento {self.levantamento.id_orcamento} - Resumo {self.resumo.id}'


#--------------------- Ordem de Serviço (OS) ------------------

class OrdenServico(models.Model):
    STATUS_OS_CHOICES = [
        ('rascunho', 'Rascunho'),
        ('emproducao', 'Em Produção'),
        ('concluida', 'Concluída'),
    ]
    
    STATUS_ENVIO_CHOICES = [
        ('pendente', 'Pendente'),
        ('enviada', 'Enviada'),
    ]
    
    STATUS_APROVACAO_CHOICES = [
        ('pendente', 'Pendente'),
        ('aprovada', 'Aprovada'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='ordens_servico')
    negocio = models.ForeignKey(Negocio, on_delete=models.SET_NULL, null=True, blank=True, related_name='ordens_servico')
    
    # Identificação
    numero_os = models.CharField(max_length=50, unique=True)  # Número único da OS
    data_emissao = models.DateField(auto_now_add=True)
    
    # Dados gerais
    projeto = models.CharField(max_length=200, blank=True)
    equipamento = models.CharField(max_length=200, blank=True)
    local = models.CharField(max_length=200)
    cc = models.CharField(max_length=50, blank=True)  # Centro de Custo
    
    # Datas
    data_inicio_previsto = models.DateField()
    data_termino_previsto = models.DateField()
    
    # Responsáveis
    supervisor_encarregado = models.CharField(max_length=150)
    
    # Descrição
    descricao_geral_servico = models.TextField()
    
    # Itens a serem incluídos (JSONField com booleanos)
    a_ser_incluido = models.JSONField(default=dict, blank=True)  # ex: {certificado_gas: True, ventilacao: False, ...}
    
    # Mão de Obra (JSONField com números)
    mao_obra = models.JSONField(default=dict, blank=True)  # ex: {estrutura: 10, tubulacao: 5, ...}

    # Horas trabalhadas por serviço (lista de pares Serviço/Hora)
    horas_trabalhadas_servico = models.JSONField(default=list, blank=True)
    
    # Status
    status_os = models.CharField(max_length=20, choices=STATUS_OS_CHOICES, default='rascunho')
    status_envio = models.CharField(max_length=20, choices=STATUS_ENVIO_CHOICES, default='pendente')
    status_aprovacao = models.CharField(max_length=20, choices=STATUS_APROVACAO_CHOICES, default='pendente')
    
    # Aprovação
    data_aprovacao = models.DateField(null=True, blank=True)
    documento_assinatura_aprovacao = models.FileField(
        upload_to='documentos_os_assinatura/',
        null=True,
        blank=True
    )
    
    # Auditoria
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"OS {self.numero_os} - {self.cliente.razao_social} - {self.get_status_os_display()}"
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Ordem de Serviço"
        verbose_name_plural = "Ordens de Serviço"


class Workspace(models.Model):
    admin_email = models.CharField(max_length=150, unique=True)
    data = models.JSONField(default=build_default_workspace_data, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Workspace {self.admin_email}"
    
#--------------------- Proposta Comercial ------------------
class Planilhas(models.Model):
    id = models.BigAutoField(primary_key=True)
    escopo_link = models.ForeignKey('Escopo', on_delete=models.SET_NULL, null=True, blank=True, related_name='escopo_planilhas')
    colunas = models.CharField(max_length=255) # field to specify the columns or headers of the spreadsheet, can be a comma-separated string or a JSON string depending on how you want to structure it
    linhas = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"Planilha {self.id}"

class Escopo(models.Model):
    id = models.BigAutoField(primary_key=True)
    proposta_link = models.ForeignKey('PropostaComercial', on_delete=models.SET_NULL, null=True, blank=True, related_name='proposta_escopo')
    tipo = models.ForeignKey(Servico, on_delete=models.CASCADE, related_name='escopo_servico') # link to the Servico entry that this scope of services is about, to be selected from a dropdown list of existing Servico entries
    descricao = models.TextField() # free text field to specify the description of the scope of services
    

    def __str__(self):
        return f"Escopo {self.id} - Descrição: {self.descricao[:50]}..."  # Show first 50 chars of description

class PropostaComercial(models.Model):
    id = models.BigAutoField(primary_key=True)
    data_criacao = models.DateField(auto_now_add=True)
    numero_proposta = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=50, default='pendente')
    motivo_recusa = models.TextField(blank=True, null=True)
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='cliente_propostas')
    negocio = models.ForeignKey(Negocio, on_delete=models.SET_NULL, null=True, blank=True, related_name='negocio_propostas')
    referencia = models.CharField(max_length=200) # free text field to specify the reference or title of the commercial proposal
    saudacao = models.CharField(max_length=200) # free text field for the greeting or introduction of the proposal
    assunto = models.CharField(max_length=200) # free text field for the subject or main topic of the proposal
    texto_de_abertura = models.TextField() # free text field for the opening text or executive summary of the proposal
    responsabilidade_contratada = models.CharField(max_length=150) # free text field to specify the person responsible for the proposal
    responsabilidade_contratante = models.CharField(max_length=150) # free text field to specify the person responsible on the client's side
    preco = models.DecimalField(max_digits=10, decimal_places=2) # field to specify the total price or value of the proposal
    condicoes_gerais = models.TextField() # free text field for the general terms and conditions of the proposal
    condicoes_pagamento = models.TextField() # free text field for the payment terms and conditions of the proposal
    prazo = models.CharField(max_length=100) # free text field to specify the delivery time or deadline for the proposal
    encerramento = models.TextField() # free text field for the closing remarks or conclusion of the proposal
   
    def __str__(self):
        return f"Proposta Comercial {self.id} - {self.cliente.razao_social} - Valor: {self.preco}"
    
#--------------------- Fim Proposta Comercial ------------------
