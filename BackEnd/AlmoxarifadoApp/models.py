from django.db import models


TABELA_NOME_CHOICES = [
    ('EQUIPAMENTOS ELETRICOS', 'EQUIPAMENTOS ELETRICOS'),
    ('EXTENSÃO-CABOS', 'EXTENSÃO-CABOS'),
    ('BOMBA HIDROJATO', 'BOMBA HIDROJATO'),
    ('INSTRUMENTOS', 'INSTRUMENTOS'),
    ('FERRAMENTAS', 'FERRAMENTAS'),
    ('TALHAS', 'TALHAS'),
    ('Controle de ferramentas', 'Controle de ferramentas'),
    ('Materiais', 'Materiais'),
    ('Alugados - Gases', 'Alugados - Gases'),
    ('Alugados - Equipamentos', 'Alugados - Equipamentos'),
]


class TabelaEstoque(models.Model):
    """Representa uma das categorias de tabela do estoque (ex: FERRAMENTAS, MATERIAIS)."""
    nome = models.CharField(max_length=100, choices=TABELA_NOME_CHOICES)
    workspace_email = models.EmailField(blank=True, db_index=True)

    class Meta:
        unique_together = [('workspace_email', 'nome')]
        ordering = ['id']

    def __str__(self):
        return f"{self.nome} ({self.workspace_email})"


class ItemEstoque(models.Model):
    """
    Representa uma linha (item) dentro de uma tabela de estoque.
    Todos os campos dinâmicos (colunas variáveis por tabela) são armazenados
    em `values` como JSONField, espelhando o Record<string, string> do frontend.
    """
    tabela = models.ForeignKey(
        TabelaEstoque, on_delete=models.CASCADE, related_name='itens'
    )
    item_id = models.CharField(max_length=60, blank=True)
    values = models.JSONField(default=dict)
    search_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.tabela.nome} / {self.item_id}"


class TipoGas(models.Model):
    """Tipos de gás configuráveis por workspace (ex: Oxigênio, Acetileno)."""
    workspace_email = models.EmailField(blank=True, db_index=True)
    nome = models.CharField(max_length=100)

    class Meta:
        unique_together = [('workspace_email', 'nome')]
        ordering = ['id']

    def __str__(self):
        return self.nome


class AlocacaoGas(models.Model):
    """
    Alocação de cilindros de gás (linha de fornecedor) para uma OS.
    Validação de saldo disponível é responsabilidade do frontend/serializer.
    """
    workspace_email = models.EmailField(blank=True, db_index=True)
    fornecedor_item = models.ForeignKey(
        ItemEstoque, on_delete=models.CASCADE, related_name='alocacoes_gas'
    )
    gas_nome = models.CharField(max_length=100)
    quantidade = models.IntegerField(default=0)
    local = models.CharField(max_length=255, blank=True)
    service_os = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.gas_nome} x{self.quantidade} → {self.service_os}"


class HistoricoBaixa(models.Model):
    """
    Auditoria de remoções (baixas) de itens do estoque.
    Guarda snapshot completo do item no momento da baixa.
    """
    workspace_email = models.EmailField(blank=True, db_index=True)
    data_baixa = models.DateField()
    tabela_nome = models.CharField(max_length=100)
    item_label = models.CharField(max_length=255)
    status_anterior = models.CharField(max_length=100, blank=True)
    motivo = models.TextField(blank=True)
    os_id = models.CharField(max_length=150, blank=True)
    os_label = models.CharField(max_length=255, blank=True)
    localizacao = models.CharField(max_length=255, blank=True)
    service_os = models.CharField(max_length=150, blank=True)
    snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data_baixa', '-id']

    def __str__(self):
        return f"Baixa: {self.item_label} em {self.data_baixa}"


class HistoricoAlocacao(models.Model):
    """
    Auditoria de alocações e desalocações de itens/gases para OS.
    """
    ACTION_CHOICES = [('alocar', 'Alocar'), ('desalocar', 'Desalocar')]
    KIND_CHOICES = [
        ('gases', 'Gases'),
        ('equipamentos', 'Equipamentos'),
        ('materiais', 'Materiais'),
        ('alugaveis', 'Alugáveis'),
        ('outros', 'Outros'),
    ]

    workspace_email = models.EmailField(blank=True, db_index=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    kind = models.CharField(max_length=30, choices=KIND_CHOICES)
    data_evento = models.DateTimeField(auto_now_add=True)
    os_id = models.CharField(max_length=150, blank=True)
    os_label = models.CharField(max_length=255, blank=True)
    item_label = models.CharField(max_length=255)
    tabela_nome = models.CharField(max_length=100)
    quantidade = models.IntegerField(null=True, blank=True)
    local = models.CharField(max_length=255, blank=True)
    gas_nome = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ['-data_evento', '-id']

    def __str__(self):
        return f"{self.action} {self.item_label} ({self.kind})"
