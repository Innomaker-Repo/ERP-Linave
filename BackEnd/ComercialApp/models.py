from django.db import models
from django.utils import timezone
from decimal import Decimal
from django.contrib.auth.models import AbstractUser
from django.conf import settings


class Cliente(models.Model):
    
    TIPO_CHOICES = [('Fisica', 'Pessoa Física'), ('Juridica', 'Pessoa Jurídica')]
    STATUS_CHOICES = [('Ativo', 'Ativo'), ('Inativo', 'Inativo')]

    id = models.BigAutoField(primary_key=True)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES, default='Fisica')
    razao_social = models.CharField(max_length=150) # "Razão Social / Nome Completo"
    nome_fantasia = models.CharField(max_length=150, null=True, blank=True)
    documento = models.CharField(max_length=20, unique=True, blank=True, null=True) # CPF ou CNPJ
    inscricao_estadual = models.CharField(max_length=20, null=True, blank=True)
    status = models.CharField(choices=STATUS_CHOICES, max_length=10, default='Ativo')
    contato_geral = models.CharField(max_length=255, null=True, blank=True) 
    endereco_completo = models.TextField(null=True, blank=True)
    data_cadastro = models.DateField(auto_now_add=True)
    criado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f'Razão Social: {self.razao_social}'


class Fornecedor(models.Model):
    """Cadastro de fornecedores (parceiros/suprimentos).

    Espelha o padrão de Cliente. Os nomes camelCase usados no frontend
    (razaoSocial, cnpj, descricaoEstadual, naturezaFornecimento, criadoPor/criadoEm)
    são traduzidos no serviço do frontend (fornecedoresService.ts).
    """

    TIPO_CHOICES = [('Serviços', 'Serviços'), ('Empresas', 'Empresas')]
    STATUS_CHOICES = [('Ativo', 'Ativo'), ('Inativo', 'Inativo')]
    NATUREZA_CHOICES = [('ITEM', 'Item'), ('SERVICO', 'Serviço')]

    id = models.BigAutoField(primary_key=True)
    workspace = models.ForeignKey(
        'Workspace', on_delete=models.SET_NULL, null=True, blank=True, related_name='fornecedores'
    )
    razao_social = models.CharField(max_length=200)
    documento = models.CharField(max_length=20, null=True, blank=True)  # CNPJ/CPF (não-único: dados legados podem repetir/vazio)
    contato = models.CharField(max_length=255, null=True, blank=True)
    endereco = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Ativo')
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='Serviços')
    descricao_estadual = models.CharField(max_length=100, null=True, blank=True)
    natureza_fornecimento = models.CharField(max_length=10, choices=NATUREZA_CHOICES, default='SERVICO')
    criado_por_nome = models.CharField(max_length=150, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['razao_social']
        verbose_name = 'Fornecedor'
        verbose_name_plural = 'Fornecedores'

    def __str__(self):
        return self.razao_social


class Negocio(models.Model):
    workspace = models.ForeignKey(
    'Workspace',
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='negocios'
)
    CATEGORIA_CHOICES = [
        ('Planejamento', 'Planejamento'),
        ('Negociação', 'Negociação'),
        ('Em Andamento', 'Em Andamento'),
        ('Finalização', 'Finalização'),
        ('Arquivado', 'Arquivado'),
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
    # Negócio "fake" de uso interno (café, papel, etc.): aparece como centro de custo em
    # Compras/Almoxarifado/Alocação, mas fica fora do CRM/Orçamento/Proposta/Medição.
    uso_interno = models.BooleanField(default=False)
    tipo_servico = models.CharField(max_length=100, null=True, blank=True) # Recebe o tipo principal do form

    data_solicitacao = models.DateField(null=True, blank=True)
    arquivo_documento = models.FileField(upload_to='documentos_negocios/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        cliente = self.cliente.razao_social if self.cliente else "Sem cliente"
        return f"{self.nome_negocio} - {cliente}"
    
class Servico(models.Model):
    id = models.BigAutoField(primary_key=True)
    negocio = models.ForeignKey(Negocio, on_delete=models.CASCADE, related_name='servicos')
    tipo_servico = models.CharField(max_length=100) 
    categoria = models.CharField(max_length=100, null=True, blank=True)    
    local_execucao = models.CharField(max_length=150, null=True, blank=True) 
    descricao = models.TextField()                 
    embarcacao = models.CharField(max_length=100, null=True, blank=True)
    porto = models.CharField(max_length=100, null=True, blank=True)
    observacoes = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.tipo_servico} - {self.embarcacao}"
    
#--------------------- User ------------------
class User(AbstractUser):
    workspace = models.ForeignKey(
    'Workspace',
    on_delete=models.CASCADE,
    related_name='users'
)

    # remove o username padrão
    username = None

    # email será o login
    email = models.EmailField(
        unique=True
    )

    # campos customizados
    user_funcao = models.CharField(
        max_length=100
    )

    user_setor = models.CharField(
        max_length=100
    )

    user_data_nascimento = models.DateField()

    # define email como login principal
    USERNAME_FIELD = 'email'

    # campos obrigatórios no createsuperuser
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email

#--------------------- Orçamento ------------------

class Levantamento(models.Model):
    workspace = models.ForeignKey(
    'Workspace',
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='levantamentos'
)
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
    qnt = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True) # permite quantidades fracionárias (ex.: 0.5)
    dias = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True) # permite dias fracionários (ex.: 0.5)
    custo_unit_dia = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    observacao = models.TextField(blank=True, null=True) # free text field for any additional notes or comments about the labor
    
    orcamento = models.ForeignKey('Orcamento', on_delete=models.CASCADE, related_name="mao_de_obra") # link to the orcamento entry that this MDO entry is part of, N:1 N MDO to 1 Resumo_orcamento   
    
    @property
    def valor_total(self):
        return  (
            (self.qnt or 0)*(self.dias or 0)*(self.custo_unit_dia or Decimal('0'))
    )
    
    def __str__(self):
        return f"Mão de Obra {self.id} - Custo: {self.valor_total}"

class Ativ_prevista(models.Model): 
    #External not displayed attributes:
    id = models.BigAutoField(primary_key=True) # This entry id, auto-generated by the system
    #Structure
    atividade = models.CharField(max_length=200)
    duracao = models.DecimalField(max_digits=12, decimal_places=2) # permite dias fracionários (ex.: 0.5)
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
    qnt = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True) # permite quantidades fracionárias (ex.: 25.1784 kg)
    peso = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True) # peso/fator multiplicador
    custo_unit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    terceirizado = models.BooleanField(default=False) # field to specify whether the material is outsourced or not
    observacao = models.TextField(blank=True, null=True) # free text field for any additional notes or comments about the material

    @property
    def valor_total(self):
        # Espelha o cálculo do frontend: quantidade * peso/fator * custo unitário
        return (self.qnt or Decimal('0')) * (self.peso or Decimal('0')) * (self.custo_unit or Decimal('0'))

    orcamento = models.ForeignKey('Orcamento', on_delete=models.CASCADE, related_name="materiais")
    def __str__(self):
        return f"Material {self.id} - Custo: {self.valor_total}"

class Servico_terceirizado(models.Model):
    #External not displayed attributes:
    id = models.BigAutoField(primary_key=True) # This entry id, auto-generated by the system
    #Structure
    descricao = models.CharField(max_length=100) # nome; identificacao do servico recebido
    unidade = models.CharField(max_length=10)
    qnt = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True) # permite quantidades fracionárias
    peso = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True) # peso/fator multiplicador
    valor_unit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    observacao = models.CharField(max_length=250)

    @property
    def valor_tot(self):
        # Espelha o frontend: quantidade * (peso/fator, default 1) * valor unitário
        fator = self.peso if (self.peso and self.peso > 0) else Decimal('1')
        return (self.qnt or Decimal('0')) * fator * (self.valor_unit or Decimal('0'))

    orcamento = models.ForeignKey('Orcamento', on_delete=models.CASCADE, related_name="terceirizados")
    def __str__(self):
        return f'Descrição: {self.descricao} - Custo total: {self.valor_tot}'

class Resumo_orcamento(models.Model):
    orcamento = models.OneToOneField(
        'Orcamento',
        on_delete=models.CASCADE,
        related_name='resumo'
    )
    id = models.BigAutoField(primary_key=True) # This entry id, auto-generated by the system 
    #fields:
    margem = models.DecimalField(max_digits = 5, decimal_places = 2) #validators=[MinValueValidator(0),MaxValueValidator(100)]
    OH = models.DecimalField(max_digits=10, decimal_places = 2)
    impostos = models.DecimalField(max_digits=5, decimal_places = 2)
    qnt = models.DecimalField(max_digits=12, decimal_places=2) #how many units of the final product or service are expected to be delivered, to be filled in the "Quantidade" field of the orçamento form, used to calculate the cost per unit in the Resumo_orcamento model and displayed in the "Custo por Unidade" field of the orçamento form.
    #---------------------------------------------------------------------------------
    # Calculation properties reach back through the Orcamento link
    @property
    def total_mdo(self):
        # self.orcamento is the related_name from the Orcamento model
        return sum(
    (item.valor_total or Decimal('0'))
    for item in self.orcamento.mao_de_obra.all()
)

    @property
    def total_material(self):
        return sum(
            (item.valor_total or Decimal('0'))
            for item in self.orcamento.materiais.all()
        )

    @property
    def total_serv_terceirizado(self):
        return sum(
            (item.valor_tot or Decimal('0'))
            for item in self.orcamento.terceirizados.all()
        )

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
        if (self.qnt or 0) > 0: 
            return self.custo_com_impostos / self.qnt
        return 0
   
   
    def __str__(self):
        return f'Custo Total: {self.custo_com_impostos} - Custo por Unidade: {self.custo_por_unidade}'
 #---------------------------------------------------------------------------------
 
class Orcamento(models.Model):
    workspace = models.ForeignKey(
    'Workspace',
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='orcamentos'
)
    id = models.BigAutoField(primary_key=True)
    levantamento = models.OneToOneField(Levantamento, on_delete=models.CASCADE, related_name='orcamento_levantamento')
    observacoes_setor_orcamento = models.TextField(blank=True, null=True)
    #resumo = models.OneToOneField(Resumo_orcamento, on_delete=models.CASCADE, related_name='orcamento')
    numero_orcamento = models.CharField(max_length=100, blank=True)
    versao = models.CharField(max_length=10, default='', blank=True)
    status = models.CharField(max_length=50, default='pendente')
    data_criacao = models.DateField(default=timezone.now)
    data_recusa = models.DateField(null=True, blank=True)

    def __str__(self):
         return f'Orçamento {self.id} - Levantamento {self.levantamento_id}'


#--------------------- Ordem de Serviço (OS) ------------------

class OrdemServico(models.Model):
    workspace = models.ForeignKey(
    'Workspace',
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='OS'
)
      
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

#--------------------- Workspace ------------------
class Workspace(models.Model):
    admin_email = models.EmailField(unique=True)
    empresa_nome = models.CharField(max_length=150, default="Linave ERP")
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
    referencia = models.TextField(blank=True, default='') # free text field to specify the reference or title of the commercial proposal
    saudacao = models.TextField(blank=True, default='') # free text field for the greeting or introduction of the proposal
    assunto = models.TextField(blank=True, default='') # free text field for the subject or main topic of the proposal
    texto_de_abertura = models.TextField(blank=True, default='') # free text field for the opening text or executive summary of the proposal
    responsabilidade_contratada = models.TextField(blank=True, default='') # texto livre de responsabilidades da contratada
    responsabilidade_contratante = models.TextField(blank=True, default='') # texto livre de responsabilidades da contratante
    preco = models.DecimalField(max_digits=15, decimal_places=2, default=0) # field to specify the total price or value of the proposal
    condicoes_gerais = models.TextField(blank=True, default='') # free text field for the general terms and conditions of the proposal
    condicoes_pagamento = models.TextField(blank=True, default='') # free text field for the payment terms and conditions of the proposal
    prazo = models.TextField(blank=True, default='') # free text field to specify the delivery time or deadline for the proposal
    encerramento = models.TextField() # free text field for the closing remarks or conclusion of the proposal
   
    def __str__(self):
        return f"Proposta Comercial {self.id} - {self.cliente.razao_social} - Valor: {self.preco}"
    
#--------------------- Fim Proposta Comercial ------------------

#--------------------- Medição ------------------
# A medição é feita por OS (uma OS/negócio pode ter várias medições — histórico por BM/período).
# Só uma medição APROVADA libera a finalização do serviço. Substitui a medição que antes era
# feita no card de Finalização do CRM.

class Medicao(models.Model):
    STATUS_CHOICES = [('pendente', 'Pendente'), ('aprovada', 'Aprovada'), ('recusada', 'Recusada')]

    id = models.BigAutoField(primary_key=True)
    negocio = models.ForeignKey(Negocio, on_delete=models.CASCADE, related_name='medicoes')
    ordem_servico = models.ForeignKey(OrdemServico, on_delete=models.SET_NULL, null=True, blank=True, related_name='medicoes')
    numero_medicao = models.CharField(max_length=40, blank=True, default='')  # ex.: LN-0001/26-001 (versionado)
    versao = models.IntegerField(default=1)
    numero_bm = models.CharField(max_length=50, blank=True, default='')
    empresa = models.CharField(max_length=100, blank=True, default='')
    cliente = models.CharField(max_length=200, blank=True, default='')
    cnpj = models.CharField(max_length=30, blank=True, default='')
    data_emissao = models.CharField(max_length=20, blank=True, default='')
    embarcacao = models.CharField(max_length=150, blank=True, default='')
    periodo = models.CharField(max_length=120, blank=True, default='')
    representante_cliente = models.CharField(max_length=200, blank=True, default='')
    representante_prestadora = models.CharField(max_length=200, blank=True, default='')
    valor_total = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendente')
    motivo_recusa = models.TextField(blank=True, default='')
    data_aprovacao = models.CharField(max_length=20, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Medição'
        verbose_name_plural = 'Medições'

    def __str__(self):
        return f'Medição {self.id} - BM {self.numero_bm} ({self.status})'


class MedicaoItem(models.Model):
    id = models.BigAutoField(primary_key=True)
    medicao = models.ForeignKey(Medicao, on_delete=models.CASCADE, related_name='itens')
    item = models.CharField(max_length=20, blank=True, default='')
    descricao = models.TextField(blank=True, default='')
    unidade = models.CharField(max_length=20, blank=True, default='')
    quantidade_produzida = models.DecimalField(max_digits=15, decimal_places=4, default=0)
    valor_unitario = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    observacoes = models.TextField(blank=True, default='')

    def __str__(self):
        return f'Item {self.item} - {self.descricao[:30]}'
#--------------------- Fim Medição ------------------

#--------------------- Financeiro ------------------
# Os registros financeiros vêm de um "FinRecord" discriminado por `tipo` no frontend
# (useFin.ts/finData.ts). Cada tipo ganha sua própria tabela com colunas tipadas para os
# campos consultáveis + um campo `extra` (JSON) que preserva qualquer campo adicional do
# frontend sem risco de perda de dado. O `record_id` guarda o id-string gerado no frontend
# (ex.: "CP-ABC", "SP-001"), que a UI usa para referências (parentId, seleção etc.).

class FinanceiroBase(models.Model):
    record_id = models.CharField(max_length=80, unique=True)
    empresa = models.CharField(max_length=50, blank=True, default='')
    status = models.CharField(max_length=60, blank=True, default='')
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Banco(FinanceiroBase):
    nome = models.CharField(max_length=150, blank=True, default='')
    tipo = models.CharField(max_length=80, blank=True, default='')
    pix = models.CharField(max_length=255, blank=True, default='')

    def __str__(self):
        return f'Banco {self.nome}'


class SolicitacaoPagamento(FinanceiroBase):
    solicitante = models.CharField(max_length=150, blank=True, default='')
    tipo = models.CharField(max_length=80, blank=True, default='')  # tipo/forma de pagamento
    vinculo_tipo = models.CharField(max_length=30, blank=True, default='')  # 'OS' | 'Departamento'
    vinculo_valor = models.CharField(max_length=120, blank=True, default='')
    fornecedor = models.CharField(max_length=200, blank=True, default='')
    documento = models.CharField(max_length=150, blank=True, default='')
    valor = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    compra = models.CharField(max_length=20, blank=True, default='')
    vencimento = models.CharField(max_length=20, blank=True, default='')
    forma = models.CharField(max_length=120, blank=True, default='')
    descricao = models.TextField(blank=True, default='')
    anexos = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f'Solicitação {self.record_id}'


class ContaPagar(FinanceiroBase):
    type = models.CharField(max_length=10, default='single')  # 'single' | 'parent' | 'child'
    parent_record_id = models.CharField(max_length=80, blank=True, null=True)
    parcela = models.CharField(max_length=20, blank=True, default='')
    total_parcelas = models.IntegerField(default=1)
    vinculo_tipo = models.CharField(max_length=30, blank=True, default='')
    vinculo_valor = models.CharField(max_length=120, blank=True, default='')
    fornecedor = models.CharField(max_length=200, blank=True, default='')
    tipo = models.CharField(max_length=80, blank=True, default='')
    documento = models.CharField(max_length=150, blank=True, default='')
    valor = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vencimento = models.CharField(max_length=20, blank=True, default='')
    banco = models.CharField(max_length=150, blank=True, default='')
    forma = models.CharField(max_length=120, blank=True, default='')
    anexos = models.JSONField(default=list, blank=True)
    comprovantes = models.JSONField(default=list, blank=True)
    valor_pago = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    data_pagamento = models.CharField(max_length=20, blank=True, default='')
    juros_pago = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    def __str__(self):
        return f'Conta a Pagar {self.record_id}'


class NotaFiscal(FinanceiroBase):
    # kind diferencia a solicitação de NFe ('nfeReq') da NFe emitida/arquivada ('nfe').
    kind = models.CharField(max_length=10, default='nfe')
    source_id = models.CharField(max_length=80, blank=True, default='')
    os = models.CharField(max_length=120, blank=True, default='')
    cliente = models.CharField(max_length=200, blank=True, default='')
    numero = models.CharField(max_length=80, blank=True, default='')
    emissao = models.CharField(max_length=20, blank=True, default='')
    valor = models.DecimalField(max_digits=15, decimal_places=2, default=0)  # original
    liquido = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vencimento = models.CharField(max_length=20, blank=True, default='')
    forma = models.CharField(max_length=160, blank=True, default='')
    tipo_nfe = models.CharField(max_length=60, blank=True, default='')
    contrato = models.CharField(max_length=120, blank=True, default='')
    anexos = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f'NFe {self.record_id} ({self.kind})'


class ContaReceber(FinanceiroBase):
    origem = models.CharField(max_length=60, blank=True, default='')
    cliente = models.CharField(max_length=200, blank=True, default='')
    referencia = models.CharField(max_length=160, blank=True, default='')
    valor_original = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    valor_liquido = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vencimento_recebimento = models.CharField(max_length=20, blank=True, default='')
    recebido = models.BooleanField(default=False)
    data_recebimento = models.CharField(max_length=20, blank=True, default='')
    valor_recebido = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    banco_recebimento = models.CharField(max_length=150, blank=True, default='')

    def __str__(self):
        return f'Conta a Receber {self.record_id}'


class EstudoLocacao(FinanceiroBase):
    tipo = models.CharField(max_length=80, blank=True, default='')
    unidade = models.CharField(max_length=120, blank=True, default='')
    vincula_os = models.CharField(max_length=120, blank=True, default='')
    cobranca = models.CharField(max_length=160, blank=True, default='')

    def __str__(self):
        return f'Locação {self.record_id}'
#--------------------- Fim Financeiro ------------------

#--------------------- Compras ------------------
# Uma RequisicaoCompra é um documento agregado: traz `itens` e `budgetDetails` (cotações)
# aninhados que o kanban manipula em conjunto. Guardamos o agregado completo em `extra`
# (round-trip fiel para a UI) e replicamos os campos de topo em colunas tipadas para
# consultas/relatórios. O histórico é o snapshot do pedido concluído.

class RequisicaoCompra(models.Model):
    record_id = models.CharField(max_length=80, unique=True)
    solicitante = models.CharField(max_length=150, blank=True, default='')
    departamento = models.CharField(max_length=150, blank=True, default='')
    centro_custo = models.CharField(max_length=120, blank=True, default='')
    stage = models.CharField(max_length=40, blank=True, default='')
    approval_route = models.CharField(max_length=40, blank=True, null=True)
    purchase_state = models.CharField(max_length=30, blank=True, default='')
    budget_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Requisição {self.record_id}'


class CompraHistorico(models.Model):
    record_id = models.CharField(max_length=80, unique=True)
    solicitante = models.CharField(max_length=150, blank=True, default='')
    departamento = models.CharField(max_length=150, blank=True, default='')
    centro_custo = models.CharField(max_length=120, blank=True, default='')
    finalizado_em = models.CharField(max_length=40, blank=True, default='')
    finalizado_por = models.CharField(max_length=150, blank=True, default='')
    budget_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Compra Histórico {self.record_id}'
#--------------------- Fim Compras ------------------

#--------------------- Almoxarifado / Estoque ------------------
# O estoque/almoxarifado é um agregado coeso que as telas (EstoqueView etc.) manipulam
# como um único objeto (tables, gasTypes, allocations, históricos, romaneios...). Guardamos
# o objeto completo em `data` (round-trip fiel para a UI) numa linha singleton, com algumas
# projeções em colunas para consulta. Tira o estoque do blob do workspace e do localStorage.

class EstoqueAlmoxarifado(models.Model):
    data = models.JSONField(default=dict, blank=True)  # objeto completo (fonte para a UI)
    version = models.IntegerField(default=2)
    tables = models.JSONField(default=list, blank=True)
    gas_types = models.JSONField(default=list, blank=True)
    allocations = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Estoque/Almoxarifado (v{self.version})'
#--------------------- Fim Almoxarifado ------------------

#--------------------- Alocações ------------------
# Vincula um funcionário a uma Obra/Negócio e/ou a uma OS. Hoje funcionário/obra/os
# ainda são referenciados por id-string (funcionário é do RH, fora do escopo; obra/os
# saem do blob na consolidação do Comercial). Guardamos o registro completo em `extra`.

class Alocacao(models.Model):
    record_id = models.CharField(max_length=80, unique=True)
    funcionario_id = models.CharField(max_length=120, blank=True, default='')
    obra_id = models.CharField(max_length=120, blank=True, null=True)
    os_id = models.CharField(max_length=120, blank=True, null=True)
    data_inicio = models.CharField(max_length=20, blank=True, default='')
    data_fim = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=30, blank=True, default='Ativa')
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Alocação {self.record_id}'
#--------------------- Fim Alocações ------------------

#--------------------- Configurações ------------------
# Configurações da empresa (nome, empresas prestadoras) e listas auxiliares
# (departamentos, categorias, prioridades). São objetos de configuração singleton,
# lidos em muitos lugares como `ctx.config`/`ctx.listas`; guardamos cada um numa coluna
# JSON desta linha única para tirá-los do blob do workspace.

class ConfiguracaoApp(models.Model):
    config = models.JSONField(default=dict, blank=True)   # { empresaNome, empresasPrestadoras, ... }
    listas = models.JSONField(default=dict, blank=True)   # { departamentos, categorias, prioridades }
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return 'Configurações do app'


#--------------------- Documentos (upload genérico) ------------------
# Tabela única e reutilizável para TODO upload de documento do sistema. O binário
# fica em disco (MEDIA_ROOT, via FileField) e o banco guarda o caminho + metadados.
# O vínculo é genérico (vinculo_tipo + vinculo_id) para servir Negócio, OS, Financeiro
# etc. sem acoplar a esquemas que são reescritos por replace-all (ex.: Financeiro).
#   - vinculo_tipo: 'negocio' | 'os' | 'financeiro' | ...
#   - vinculo_id:   id do registro vinculado (string: id numérico do Negócio/OS ou
#                   id de negócio do FinRecord, ex.: 'CP-0001')
#   - categoria:    "slot"/subtipo do documento dentro do vínculo (ver CATEGORIA_CHOICES)

def documento_upload_path(instance, filename):
    tipo = (instance.vinculo_tipo or 'gerais').strip() or 'gerais'
    return f'documentos/{tipo}/{filename}'


class Documento(models.Model):
    CATEGORIA_CHOICES = [
        ('negocio', 'Documento do Negócio'),
        ('cliente_assinado', 'Documento assinado pelo cliente'),
        ('os_assinatura', 'Assinatura/aprovação de OS'),
        ('fin_anexo', 'Anexo financeiro'),
        ('fin_comprovante', 'Comprovante de pagamento'),
        ('outro', 'Outro'),
    ]

    id = models.BigAutoField(primary_key=True)
    arquivo = models.FileField(upload_to=documento_upload_path)
    nome_original = models.CharField(max_length=255, blank=True, default='')
    tipo = models.CharField(max_length=120, blank=True, default='')   # mime-type
    tamanho = models.BigIntegerField(default=0)                       # bytes
    categoria = models.CharField(max_length=40, choices=CATEGORIA_CHOICES, default='outro')
    vinculo_tipo = models.CharField(max_length=40, blank=True, default='')
    vinculo_id = models.CharField(max_length=120, blank=True, default='')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']
        indexes = [models.Index(fields=['vinculo_tipo', 'vinculo_id'])]
        verbose_name = 'Documento'
        verbose_name_plural = 'Documentos'

    def __str__(self):
        return f'{self.nome_original or self.arquivo.name} ({self.vinculo_tipo}:{self.vinculo_id})'
#--------------------- Fim Documentos ------------------
#--------------------- Fim Configurações ------------------
