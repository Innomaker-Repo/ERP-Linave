from django.db import models

class Cliente(models.Model):
    cnpj = models.BigIntegerField(primary_key=True) # BIGINT UNSIGNED (PK)
    nome = models.CharField(max_length=150)

    def __str__(self):
        return self.nome

class Negocio(models.Model):
    id = models.BigAutoField(primary_key=True)
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='negocios')
    origem_lead = models.CharField(max_length=100, null=True, blank=True)
    solicitante = models.CharField(max_length=150)
    cargo = models.CharField(max_length=100, null=True, blank=True)
    telefone = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField(max_length=254)
    responsavel_comercial = models.CharField(max_length=150)
    observacoes_internas = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Negócio {self.id} - {self.solicitante}"

class Servico(models.Model):
    URGENCIA_CHOICES = [
        ('baixa', 'Baixa'),
        ('media', 'Média'),
        ('alta', 'Alta'),
    ]

    id = models.BigAutoField(primary_key=True)
    # Relacionando com Negocio (1 Negocio para N Servicos conforme o diagrama)
    
    negocio = models.ForeignKey(Negocio, on_delete=models.CASCADE, related_name='servicos')
    ordem_servico_id = models.BigIntegerField(null=True, blank=True)
    tipo_servico = models.CharField(max_length=100)
    categoria = models.CharField(max_length=100)
    embarcacao = models.CharField(max_length=100)
    local_execucao = models.CharField(max_length=150)
    porto = models.CharField(max_length=100)
    urgencia = models.CharField(max_length=10, choices=URGENCIA_CHOICES)
    prazo_desejado = models.DateField()
    descricao_solicitacao = models.TextField()

    def __str__(self):
        return f"Serviço {self.id} - {self.embarcacao}"
    
class User(models.Model):
    user_email = models.CharField(max_length=150, primary_key=True)
    user_name = models.CharField(max_length=200)
    user_funcao = models.CharField(max_length=100)
    user_setor = models.CharField(max_length=100)
    user_data_nascimento = models.DateField()
    
    def __str__(self):
        return f"E-mail: {self.user_email} - Nome: {self.user_name} - Função: {self.user_funcao} - Setor: {self.user_setor}"