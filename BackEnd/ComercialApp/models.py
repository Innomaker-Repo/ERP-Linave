from django.db import models

class Cliente(models.Model):
    TIPO_CHOICES = [('Fisica', 'Pessoa Física'), ('Juridica', 'Pessoa Jurídica')]
    STATUS_CHOICES = [('Ativo', 'Ativo'), ('Inativo', 'Inativo')]

    id = models.BigAutoField(primary_key=True)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES, default='Fisica')
    razao_social = models.CharField(max_length=150) # "Razão Social / Nome Completo"
    nome_fantasia = models.CharField(max_length=150, null=True, blank=True)
    documento = models.CharField(max_length=20, unique=True) # CPF ou CNPJ
    inscricao_estadual = models.CharField(max_length=20, null=True, blank=True)
    status = models.CharField(choices=STATUS_CHOICES, max_length=10, default='Ativo')
    contato_geral = models.CharField(max_length=255) 
    endereco_completo = models.TextField()
    data_cadastro = models.DateField(auto_now_add=True)
    usuario_responsavel = models.ForeignKey('User', on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return self.razao_social

from django.db import models

class Negocio(models.Model):
    id = models.BigAutoField(primary_key=True)
    cliente = models.ForeignKey('Cliente', on_delete=models.CASCADE, related_name='negocios')
    empresa_prestadora = models.CharField(max_length=100) 
    nome_negocio = models.CharField(max_length=200) 
    solicitante = models.CharField(max_length=150)
    cargo = models.CharField(max_length=100, null=True, blank=True)
    telefone = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField(max_length=254)
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
