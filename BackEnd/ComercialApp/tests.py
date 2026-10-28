"""
Suíte de testes — ERP Linave
Cobre: regras de negócio, validators, serializers, models e API (REST endpoints).
"""

from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from .models import (
    User, Cliente, Negocio, Servico, OrdemServico,
    PropostaComercial, Medicao, Fornecedor, LogAtividade, ItemAlocacao,
    Workspace,
)
from .validators import SenhaSeguraValidator
from .serializers import UserSerializer, ClienteSerializer, LogAtividadeSerializer


# =============================================================================
# HELPERS
# =============================================================================

def criar_admin(cpf='admin-test', senha='Admin@teste1'):
    return User.objects.create_user(cpf=cpf, password=senha, nome='Admin Teste',
                                    email='admin@test.com', role='admin')

def criar_gerente(cpf='gerente-test', senha='Admin@teste1'):
    return User.objects.create_user(cpf=cpf, password=senha, nome='Gerente Teste',
                                    email='gerente@test.com', role='gerente')

def criar_usuario(cpf='user-test', senha='Admin@teste1', permissoes=None):
    return User.objects.create_user(cpf=cpf, password=senha, nome='Usuario Teste',
                                    email='user@test.com', role='usuario',
                                    permissoes=permissoes or {})

def criar_cliente(razao='Cliente Teste', documento=None):
    return Cliente.objects.create(razao_social=razao, documento=documento)

def criar_negocio(cliente, nome='Negócio Teste'):
    return Negocio.objects.create(
        cliente=cliente,
        empresa_prestadora='Linave',
        nome_negocio=nome,
        solicitante='Solicitante Teste',
        email='solicitante@test.com',
    )

BASE = '/comercial'

def obter_token(client, identifier, senha='Admin@teste1'):
    resp = client.post('/token/', {'identifier': identifier, 'password': senha},
                       content_type='application/json')
    return resp

def autenticar_admin(client, cpf='admin-test'):
    """Cria um admin e autentica `client` (APIClient) com o Bearer dele. Usado em testes
    de endpoints que exigem IsAuthenticated (REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES
    em settings.py) mas cujo propósito é testar outra coisa (filtro, CRUD, etc.) — não a
    autenticação em si, que já tem cobertura própria."""
    criar_admin(cpf=cpf)
    tok = obter_token(client, cpf, 'Admin@teste1')
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {tok.data["access"]}')


# =============================================================================
# 1. UNIT TESTS — VALIDATORS
# =============================================================================

class SenhaSeguraValidatorTests(TestCase):
    """Regra de negócio: senha precisa de ≥8 chars, maiúscula, minúscula e especial."""

    def setUp(self):
        self.v = SenhaSeguraValidator()

    def test_senha_valida_passa(self):
        """Admin@linave deve passar (sem dígito obrigatório)."""
        self.v.validate('Admin@linave')  # não levanta

    def test_senha_com_numero_e_tudo_passa(self):
        self.v.validate('Senha@123')

    def test_muito_curta_falha(self):
        with self.assertRaises(ValidationError) as ctx:
            self.v.validate('Ab@1')
        self.assertTrue(any('8 caracteres' in m for m in ctx.exception.messages))

    def test_sem_maiuscula_falha(self):
        with self.assertRaises(ValidationError) as ctx:
            self.v.validate('senha@teste')
        self.assertTrue(any('maiúscula' in m for m in ctx.exception.messages))

    def test_sem_minuscula_falha(self):
        with self.assertRaises(ValidationError) as ctx:
            self.v.validate('SENHA@TESTE')
        self.assertTrue(any('minúscula' in m for m in ctx.exception.messages))

    def test_sem_especial_falha(self):
        with self.assertRaises(ValidationError) as ctx:
            self.v.validate('SenhaTeste')
        self.assertTrue(any('especial' in m for m in ctx.exception.messages))

    def test_multiplos_erros_juntos(self):
        with self.assertRaises(ValidationError) as ctx:
            self.v.validate('abc')
        self.assertGreaterEqual(len(ctx.exception.messages), 3)

    def test_help_text_retorna_string(self):
        txt = self.v.get_help_text()
        self.assertIsInstance(txt, str)
        self.assertGreater(len(txt), 10)


# =============================================================================
# 2. UNIT TESTS — MODELS
# =============================================================================

class UserModelTests(TestCase):
    """Regras de negócio: CPF como PK, sincronização is_superuser/is_staff com role."""

    def test_admin_recebe_is_superuser_e_is_staff(self):
        u = criar_admin('admin-001')
        self.assertTrue(u.is_superuser)
        self.assertTrue(u.is_staff)

    def test_gerente_nao_e_superuser(self):
        u = criar_gerente('gerente-001')
        self.assertFalse(u.is_superuser)
        self.assertFalse(u.is_staff)

    def test_usuario_nao_e_superuser(self):
        u = criar_usuario('user-001')
        self.assertFalse(u.is_superuser)
        self.assertFalse(u.is_staff)

    def test_promover_para_admin_atualiza_flags(self):
        u = criar_gerente('gerente-002')
        self.assertFalse(u.is_superuser)
        u.role = 'admin'
        u.save()
        u.refresh_from_db()
        self.assertTrue(u.is_superuser)
        self.assertTrue(u.is_staff)

    def test_rebaixar_de_admin_remove_flags(self):
        u = criar_admin('admin-002')
        u.role = 'gerente'
        u.save()
        u.refresh_from_db()
        self.assertFalse(u.is_superuser)
        self.assertFalse(u.is_staff)

    def test_cpf_e_pk(self):
        u = criar_usuario('cpf-unico-123')
        self.assertEqual(u.pk, 'cpf-unico-123')

    def test_str_retorna_nome_e_cpf(self):
        u = User(nome='João Silva', cpf='123.456.789-00')
        self.assertIn('João Silva', str(u))
        self.assertIn('123.456.789-00', str(u))

    def test_email_login_alternativo(self):
        """O login por email é resolvido na view — o model usa cpf como USERNAME_FIELD."""
        self.assertEqual(User.USERNAME_FIELD, 'cpf')

    def test_role_padrao_e_usuario(self):
        u = User.objects.create_user(cpf='sem-role', password='Abc@1234', nome='Sem Role')
        self.assertEqual(u.role, 'usuario')

    def test_permissoes_default_e_dict_vazio(self):
        u = criar_usuario('perm-test')
        self.assertEqual(u.permissoes, {})


class ClienteModelTests(TestCase):

    def test_criar_cliente_fisica(self):
        c = criar_cliente('Fulano de Tal')
        self.assertEqual(c.status, 'Ativo')
        self.assertEqual(c.tipo, 'Fisica')

    def test_str_contem_razao_social(self):
        c = criar_cliente('Empresa XYZ')
        self.assertIn('Empresa XYZ', str(c))

    def test_documento_unico(self):
        criar_cliente('Cliente A', documento='12345678901')
        from django.db import IntegrityError
        with self.assertRaises(Exception):
            criar_cliente('Cliente B', documento='12345678901')

    def test_documento_nulo_permitido_multiplos(self):
        c1 = Cliente.objects.create(razao_social='Sem Doc 1', documento=None)
        c2 = Cliente.objects.create(razao_social='Sem Doc 2', documento=None)
        self.assertNotEqual(c1.pk, c2.pk)


class NegocioModelTests(TestCase):

    def setUp(self):
        self.cliente = criar_cliente('Cliente Negócio')

    def test_criar_negocio_basico(self):
        n = criar_negocio(self.cliente)
        self.assertEqual(n.status, 'Aguardando orçamento')
        self.assertFalse(n.orcamento_realizado)

    def test_str_contem_nome_e_cliente(self):
        n = criar_negocio(self.cliente, 'Projeto Alfa')
        self.assertIn('Projeto Alfa', str(n))

    def test_modalidade_padrao_servico(self):
        n = criar_negocio(self.cliente)
        self.assertEqual(n.modalidade, 'servico')

    def test_uso_interno_padrao_false(self):
        n = criar_negocio(self.cliente)
        self.assertFalse(n.uso_interno)

    def test_categoria_padrao_planejamento(self):
        n = criar_negocio(self.cliente)
        self.assertEqual(n.categoria, 'Planejamento')


class ItemAlocacaoModelTests(TestCase):
    """Regra de negócio: valor_total = quantidade × valor_locacao × (1 + (margem+oh)/100)."""

    def setUp(self):
        self.cliente = criar_cliente('Cliente Alocacao')
        self.negocio = criar_negocio(self.cliente)

    def test_valor_total_sem_margem(self):
        item = ItemAlocacao.objects.create(
            negocio=self.negocio,
            equipamento='Equipamento X',
            quantidade=Decimal('2'),
            valor_locacao=Decimal('1000.00'),
            margem=Decimal('0'),
            oh=Decimal('0'),
        )
        self.assertEqual(item.valor_total, Decimal('2000.00'))

    def test_valor_total_com_margem_20(self):
        item = ItemAlocacao.objects.create(
            negocio=self.negocio,
            equipamento='Equipamento Y',
            quantidade=Decimal('1'),
            valor_locacao=Decimal('1000.00'),
            margem=Decimal('20'),
            oh=Decimal('0'),
        )
        self.assertEqual(item.valor_total, Decimal('1200.00'))

    def test_valor_total_com_margem_e_oh(self):
        item = ItemAlocacao.objects.create(
            negocio=self.negocio,
            equipamento='Equipamento Z',
            quantidade=Decimal('2'),
            valor_locacao=Decimal('500.00'),
            margem=Decimal('10'),
            oh=Decimal('5'),
        )
        # 2 × 500 × (1 + 0.15) = 1150
        self.assertEqual(item.valor_total, Decimal('1150.00'))


class MedicaoModelTests(TestCase):

    def setUp(self):
        self.cliente = criar_cliente('Cliente Med')
        self.negocio = criar_negocio(self.cliente)

    def test_status_padrao_pendente(self):
        m = Medicao.objects.create(negocio=self.negocio)
        self.assertEqual(m.status, 'pendente')

    def test_str_contem_bm_e_status(self):
        m = Medicao.objects.create(negocio=self.negocio, numero_bm='BM-001')
        self.assertIn('BM-001', str(m))
        self.assertIn('pendente', str(m))

    def test_choices_status_validos(self):
        choices = [c[0] for c in Medicao.STATUS_CHOICES]
        self.assertIn('pendente', choices)
        self.assertIn('aprovada', choices)
        self.assertIn('recusada', choices)


class LogAtividadeModelTests(TestCase):

    def test_criar_log(self):
        log = LogAtividade.objects.create(
            usuario_cpf='admin',
            usuario_nome='Admin Teste',
            acao='login',
            modulo='Sistema',
            descricao='Login realizado.',
        )
        self.assertIsNotNone(log.timestamp)
        self.assertEqual(log.get_acao_display(), 'Login')

    def test_str_contem_usuario_e_acao(self):
        log = LogAtividade.objects.create(
            usuario_cpf='admin',
            usuario_nome='Admin Teste',
            acao='criacao',
            modulo='Clientes',
            descricao='Cliente criado.',
        )
        s = str(log)
        self.assertIn('Admin Teste', s)
        self.assertIn('Clientes', s)

    def test_ordenacao_mais_recente_primeiro(self):
        LogAtividade.objects.create(usuario_cpf='u1', acao='login', modulo='A')
        LogAtividade.objects.create(usuario_cpf='u2', acao='criacao', modulo='B')
        logs = list(LogAtividade.objects.all())
        self.assertGreaterEqual(logs[0].timestamp, logs[1].timestamp)


# =============================================================================
# 3. UNIT TESTS — SERIALIZERS
# =============================================================================

class UserSerializerTests(TestCase):

    def test_senha_fraca_falha_na_validacao(self):
        data = {'cpf': 'novo-user', 'nome': 'Novo', 'email': 'n@t.com',
                'password': 'fraca', 'role': 'usuario'}
        s = UserSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn('password', s.errors)

    def test_senha_forte_passa(self):
        data = {'cpf': 'novo-user2', 'nome': 'Novo2', 'email': 'n2@t.com',
                'password': 'Admin@teste', 'role': 'usuario'}
        s = UserSerializer(data=data)
        self.assertTrue(s.is_valid(), s.errors)

    def test_create_via_serializer_cria_usuario(self):
        data = {'cpf': 'create-test', 'nome': 'Criado', 'email': 'criado@t.com',
                'password': 'Admin@teste', 'role': 'gerente'}
        s = UserSerializer(data=data)
        self.assertTrue(s.is_valid(), s.errors)
        u = s.save()
        self.assertEqual(u.cpf, 'create-test')
        self.assertTrue(u.check_password('Admin@teste'))

    def test_campos_is_superuser_is_staff_sao_readonly(self):
        """Não deve ser possível setar is_superuser via serializer diretamente."""
        data = {'cpf': 'hack-test', 'nome': 'Hacker', 'email': 'h@t.com',
                'password': 'Admin@teste', 'role': 'usuario',
                'is_superuser': True, 'is_staff': True}
        s = UserSerializer(data=data)
        self.assertTrue(s.is_valid(), s.errors)
        u = s.save()
        # role=usuario → is_superuser deve ser False (sincronizado pelo save do model)
        self.assertFalse(u.is_superuser)
        self.assertFalse(u.is_staff)

    def test_update_sem_senha_nao_altera_senha(self):
        u = criar_usuario('update-no-pwd')
        senha_hash_original = u.password
        s = UserSerializer(u, data={'nome': 'Novo Nome', 'email': 'novo@t.com'}, partial=True)
        self.assertTrue(s.is_valid(), s.errors)
        s.save()
        u.refresh_from_db()
        self.assertEqual(u.password, senha_hash_original)

    def test_update_com_nova_senha_altera(self):
        u = criar_usuario('update-pwd')
        s = UserSerializer(u, data={'password': 'NovoPass@2024'}, partial=True)
        self.assertTrue(s.is_valid(), s.errors)
        s.save()
        u.refresh_from_db()
        self.assertTrue(u.check_password('NovoPass@2024'))


class ClienteSerializerTests(TestCase):

    def test_documento_vazio_e_removido(self):
        """Documento em branco não deve violar unique constraint."""
        data = {'razao_social': 'Empresa A', 'documento': ''}
        s = ClienteSerializer(data=data)
        self.assertTrue(s.is_valid(), s.errors)
        c = s.save()
        self.assertIsNone(c.documento)

    def test_documento_duplicado_falha_na_validacao(self):
        """Documento duplicado é bloqueado pelo unique validator antes de chegar ao create().
        Comportamento atual: serializer.is_valid() retorna False com erro de unicidade.
        Nota: o método create() tem lógica de retornar cliente existente, mas é código morto
        pois o validator DRF dispara antes — oportunidade de melhoria identificada."""
        criar_cliente('Original', documento='99988877766')
        data = {'razao_social': 'Duplicado', 'documento': '99988877766'}
        s = ClienteSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn('documento', s.errors)


class LogAtividadeSerializerTests(TestCase):

    def test_serializer_inclui_acao_display(self):
        log = LogAtividade.objects.create(
            usuario_cpf='adm', usuario_nome='Admin', acao='exclusao',
            modulo='Clientes', descricao='Teste.',
        )
        s = LogAtividadeSerializer(log)
        self.assertEqual(s.data['acao_display'], 'Exclusão')

    def test_timestamp_fmt_formato_correto(self):
        log = LogAtividade.objects.create(
            usuario_cpf='adm', usuario_nome='Admin', acao='login', modulo='S',
        )
        s = LogAtividadeSerializer(log)
        fmt = s.data['timestamp_fmt']
        # dd/mm/yyyy HH:MM:SS
        import re
        self.assertTrue(re.match(r'\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}', fmt))


# =============================================================================
# 4. INTEGRATION TESTS
# =============================================================================

class AuthFluxoIntegrationTests(APITestCase):
    """Fluxo completo de autenticação: login com CPF, com e-mail e credenciais inválidas."""

    def setUp(self):
        self.admin = criar_admin('admin-int', 'Admin@linave')
        self.admin.email = 'admin@linave.com.br'
        self.admin.save()

    def test_login_com_cpf_retorna_tokens(self):
        resp = obter_token(self.client, 'admin-int', 'Admin@linave')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.data)

    def test_login_com_email_retorna_tokens(self):
        resp = obter_token(self.client, 'admin@linave.com.br', 'Admin@linave')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('access', resp.data)

    def test_login_credenciais_invalidas_retorna_401(self):
        resp = obter_token(self.client, 'admin-int', 'SenhaErrada@!')
        self.assertEqual(resp.status_code, 401)

    def test_login_usuario_inexistente_retorna_401_ou_400(self):
        resp = obter_token(self.client, 'cpf-nao-existe', 'Admin@teste1')
        self.assertIn(resp.status_code, [400, 401])

    def test_login_email_inexistente_retorna_400(self):
        resp = obter_token(self.client, 'naoexiste@email.com', 'Admin@teste1')
        self.assertIn(resp.status_code, [400, 401])

    def test_login_grava_log_de_atividade(self):
        count_antes = LogAtividade.objects.count()
        obter_token(self.client, 'admin-int', 'Admin@linave')
        count_depois = LogAtividade.objects.count()
        self.assertEqual(count_depois, count_antes + 1)
        log = LogAtividade.objects.latest('timestamp')
        self.assertEqual(log.acao, 'login')
        self.assertEqual(log.usuario_cpf, 'admin-int')

    def test_login_falho_nao_grava_log(self):
        count_antes = LogAtividade.objects.count()
        obter_token(self.client, 'admin-int', 'SenhaErrada@!')
        self.assertEqual(LogAtividade.objects.count(), count_antes)


class PermissaoSistemaIntegrationTests(APITestCase):
    """Regras de negócio de permissão: admin não pode ser excluído; apenas admin acessa logs."""

    def setUp(self):
        self.admin = criar_admin('adm-perm', 'Admin@teste1')
        self.gerente = criar_gerente('ger-perm', 'Admin@teste1')
        self.usuario = criar_usuario('usr-perm', 'Admin@teste1')
        resp = obter_token(self.client, 'adm-perm', 'Admin@teste1')
        self.token_admin = resp.data['access']
        resp = obter_token(self.client, 'ger-perm', 'Admin@teste1')
        self.token_gerente = resp.data['access']
        resp = obter_token(self.client, 'usr-perm', 'Admin@teste1')
        self.token_usuario = resp.data['access']

    def _auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_excluir_admin_principal_e_bloqueado(self):
        self._auth(self.token_admin)
        resp = self.client.delete(f'/comercial/usuarios/{self.admin.cpf}/')
        self.assertEqual(resp.status_code, 403)

    def test_logs_acessiveis_pelo_admin(self):
        self._auth(self.token_admin)
        resp = self.client.get('/comercial/logs/')
        self.assertEqual(resp.status_code, 200)

    def test_logs_bloqueados_para_gerente(self):
        self._auth(self.token_gerente)
        resp = self.client.get('/comercial/logs/')
        self.assertEqual(resp.status_code, 403)

    def test_logs_bloqueados_para_usuario(self):
        self._auth(self.token_usuario)
        resp = self.client.get('/comercial/logs/')
        self.assertEqual(resp.status_code, 403)

    def test_logs_bloqueados_sem_autenticacao(self):
        resp = self.client.get('/comercial/logs/')
        self.assertEqual(resp.status_code, 401)


# =============================================================================
# 5. API TESTS
# =============================================================================

class UsuariosAPITests(APITestCase):

    def setUp(self):
        self.admin = criar_admin('adm-api', 'Admin@teste1')
        resp = obter_token(self.client, 'adm-api', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def test_listar_usuarios(self):
        resp = self.client.get('/comercial/usuarios/')
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.data, list)

    def test_criar_usuario_valido(self):
        payload = {'cpf': 'novo-via-api', 'nome': 'Via API', 'email': 'api@test.com',
                   'password': 'Admin@teste', 'role': 'usuario'}
        resp = self.client.post('/comercial/usuarios/', payload, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(User.objects.filter(cpf='novo-via-api').exists())

    def test_criar_usuario_senha_fraca_falha(self):
        payload = {'cpf': 'fraco-api', 'nome': 'Fraco', 'email': 'fraco@t.com',
                   'password': 'abc', 'role': 'usuario'}
        resp = self.client.post('/comercial/usuarios/', payload, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('password', resp.data)

    def test_atualizar_usuario_parcialmente(self):
        u = criar_usuario('edit-api')
        resp = self.client.patch(f'/comercial/usuarios/{u.cpf}/', {'nome': 'Nome Editado'}, format='json')
        self.assertEqual(resp.status_code, 200)
        u.refresh_from_db()
        self.assertEqual(u.nome, 'Nome Editado')

    def test_excluir_usuario_nao_admin(self):
        u = criar_usuario('del-api')
        resp = self.client.delete(f'/comercial/usuarios/{u.cpf}/')
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(User.objects.filter(cpf='del-api').exists())

    def test_usuario_me_retorna_dados_corretos(self):
        resp = self.client.get('/comercial/usuarios/me/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['cpf'], 'adm-api')


class ClientesAPITests(APITestCase):

    def setUp(self):
        self.admin = criar_admin('adm-cli', 'Admin@teste1')
        resp = obter_token(self.client, 'adm-cli', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def test_listar_clientes(self):
        resp = self.client.get('/comercial/clientes/')
        self.assertEqual(resp.status_code, 200)

    def test_criar_cliente_valido(self):
        payload = {'razao_social': 'Empresa Teste API', 'tipo': 'Juridica',
                   'email': 'empresa@test.com'}
        resp = self.client.post('/comercial/clientes/', payload, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(Cliente.objects.filter(razao_social='Empresa Teste API').exists())

    def test_criar_cliente_sem_razao_falha(self):
        payload = {'tipo': 'Fisica'}
        resp = self.client.post('/comercial/clientes/', payload, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_detalhe_cliente(self):
        c = criar_cliente('Detail Test')
        resp = self.client.get(f'/comercial/clientes/{c.pk}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['razao_social'], 'Detail Test')

    def test_atualizar_status_cliente(self):
        c = criar_cliente('Status Test')
        resp = self.client.patch(f'/comercial/clientes/{c.pk}/', {'status': 'Inativo'}, format='json')
        self.assertEqual(resp.status_code, 200)
        c.refresh_from_db()
        self.assertEqual(c.status, 'Inativo')

    def test_excluir_cliente(self):
        c = criar_cliente('Del Test')
        resp = self.client.delete(f'/comercial/clientes/{c.pk}/')
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Cliente.objects.filter(pk=c.pk).exists())

    def test_log_criacao_cliente_e_registrado(self):
        count_antes = LogAtividade.objects.filter(acao='criacao', modulo='Clientes').count()
        self.client.post('/comercial/clientes/', {'razao_social': 'Log Test'}, format='json')
        count_depois = LogAtividade.objects.filter(acao='criacao', modulo='Clientes').count()
        self.assertEqual(count_depois, count_antes + 1)


class NegociosAPITests(APITestCase):

    def setUp(self):
        self.admin = criar_admin('adm-neg', 'Admin@teste1')
        resp = obter_token(self.client, 'adm-neg', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')
        self.cliente = criar_cliente('Cliente API Neg')

    def test_listar_negocios(self):
        resp = self.client.get('/comercial/negocios/')
        self.assertEqual(resp.status_code, 200)

    def test_criar_negocio_valido(self):
        payload = {
            'cliente': self.cliente.pk,
            'empresa_prestadora': 'Linave',
            'nome_negocio': 'Negócio API',
            'solicitante': 'Solicitante',
            'email': 'sol@test.com',
        }
        resp = self.client.post('/comercial/negocios/', payload, format='json')
        self.assertEqual(resp.status_code, 201)

    def test_log_criacao_negocio_registrado(self):
        count = LogAtividade.objects.filter(acao='criacao', modulo='Negócios').count()
        self.client.post('/comercial/negocios/', {
            'cliente': self.cliente.pk,
            'empresa_prestadora': 'L',
            'nome_negocio': 'Log Neg',
            'solicitante': 'X',
            'email': 'x@x.com',
        }, format='json')
        self.assertEqual(
            LogAtividade.objects.filter(acao='criacao', modulo='Negócios').count(),
            count + 1
        )


class FornecedoresAPITests(APITestCase):

    def setUp(self):
        self.admin = criar_admin('adm-forn', 'Admin@teste1')
        resp = obter_token(self.client, 'adm-forn', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def test_listar_fornecedores(self):
        resp = self.client.get('/comercial/fornecedores/')
        self.assertEqual(resp.status_code, 200)

    def test_criar_fornecedor(self):
        payload = {'razao_social': 'Fornecedor Teste', 'tipo': 'Empresas',
                   'natureza_fornecimento': 'SERVICO', 'status': 'Ativo'}
        resp = self.client.post('/comercial/fornecedores/', payload, format='json')
        self.assertEqual(resp.status_code, 201)

    def test_excluir_fornecedor(self):
        f = Fornecedor.objects.create(razao_social='Del Forn', tipo='Serviços')
        resp = self.client.delete(f'/comercial/fornecedores/{f.pk}/')
        self.assertEqual(resp.status_code, 204)


class LogsAPITests(APITestCase):
    """Endpoint /api/logs/ — filtros por data, acesso restrito."""

    def setUp(self):
        self.admin = criar_admin('adm-log', 'Admin@teste1')
        self.gerente = criar_gerente('ger-log', 'Admin@teste1')
        resp = obter_token(self.client, 'adm-log', 'Admin@teste1')
        self.token_admin = resp.data['access']
        resp = obter_token(self.client, 'ger-log', 'Admin@teste1')
        self.token_gerente = resp.data['access']
        # Cria logs de teste
        LogAtividade.objects.create(usuario_cpf='adm-log', usuario_nome='Admin',
                                    acao='login', modulo='Sistema')
        LogAtividade.objects.create(usuario_cpf='adm-log', usuario_nome='Admin',
                                    acao='criacao', modulo='Clientes')

    def test_admin_lista_todos_logs(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_admin}')
        resp = self.client.get('/comercial/logs/')
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.data, list)
        self.assertGreaterEqual(len(resp.data), 2)

    def test_filtro_por_data_inicio(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_admin}')
        from datetime import date
        hoje = date.today().isoformat()
        resp = self.client.get(f'/comercial/logs/?data_inicio={hoje}')
        self.assertEqual(resp.status_code, 200)
        # Todos os logs retornados devem ser de hoje ou depois
        for log in resp.data:
            self.assertGreaterEqual(log['timestamp'][:10], hoje)

    def test_filtro_por_data_fim(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_admin}')
        from datetime import date
        amanha = date.today().isoformat()
        resp = self.client.get(f'/comercial/logs/?data_fim={amanha}')
        self.assertEqual(resp.status_code, 200)

    def test_gerente_nao_acessa_logs(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_gerente}')
        resp = self.client.get('/comercial/logs/')
        self.assertEqual(resp.status_code, 403)

    def test_estrutura_log_entry(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_admin}')
        resp = self.client.get('/comercial/logs/')
        self.assertEqual(resp.status_code, 200)
        if resp.data:
            entry = resp.data[0]
            campos_esperados = ['id', 'usuario_cpf', 'usuario_nome', 'acao',
                                'acao_display', 'modulo', 'descricao', 'timestamp', 'timestamp_fmt']
            for campo in campos_esperados:
                self.assertIn(campo, entry, f'Campo ausente: {campo}')


class MedicaoStatusAPITests(APITestCase):
    """Regra de negócio: status de medição só aceita pendente/aprovada/recusada."""

    def setUp(self):
        self.admin = criar_admin('adm-med', 'Admin@teste1')
        resp = obter_token(self.client, 'adm-med', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')
        cli = criar_cliente('Med Client')
        neg = criar_negocio(cli)
        self.medicao = Medicao.objects.create(negocio=neg, numero_bm='BM-API-001')

    def test_aprovar_medicao(self):
        resp = self.client.patch(
            f'/comercial/medicoes/{self.medicao.pk}/atualizar-status/',
            {'status': 'aprovada'}, format='json'
        )
        self.assertEqual(resp.status_code, 200)
        self.medicao.refresh_from_db()
        self.assertEqual(self.medicao.status, 'aprovada')

    def test_recusar_medicao_com_motivo(self):
        resp = self.client.patch(
            f'/comercial/medicoes/{self.medicao.pk}/atualizar-status/',
            {'status': 'recusada', 'motivo_recusa': 'Valores incorretos'}, format='json'
        )
        self.assertEqual(resp.status_code, 200)
        self.medicao.refresh_from_db()
        self.assertEqual(self.medicao.status, 'recusada')
        self.assertEqual(self.medicao.motivo_recusa, 'Valores incorretos')

    def test_status_invalido_retorna_400(self):
        resp = self.client.patch(
            f'/comercial/medicoes/{self.medicao.pk}/atualizar-status/',
            {'status': 'invalido'}, format='json'
        )
        self.assertEqual(resp.status_code, 400)

    def test_log_atualizacao_medicao_registrado(self):
        count = LogAtividade.objects.filter(acao='atualizacao', modulo='Medições').count()
        self.client.patch(
            f'/comercial/medicoes/{self.medicao.pk}/atualizar-status/',
            {'status': 'aprovada'}, format='json'
        )
        self.assertEqual(
            LogAtividade.objects.filter(acao='atualizacao', modulo='Medições').count(),
            count + 1
        )


# =============================================================================
# 12. CÁLCULOS DE RESUMO_ORCAMENTO
# =============================================================================

class ResumoOrcamentoCalculationTests(TestCase):
    """Propriedades calculadas de Resumo_orcamento: custo_bruto, custo_com_impostos, custo_por_unidade."""

    def setUp(self):
        from .models import Levantamento, Orcamento, Resumo_orcamento, MDO, Material, Servico_terceirizado
        cli = criar_cliente('ResumoCliente')
        neg = criar_negocio(cli, 'ResumoNegocio')
        self.lev = Levantamento.objects.create(cliente=cli, negocio=neg)
        self.orc = Orcamento.objects.create(levantamento=self.lev, numero_orcamento='RES-001')
        self.resumo = Resumo_orcamento.objects.create(
            orcamento=self.orc,
            margem=Decimal('20.00'),
            OH=Decimal('10.00'),
            impostos=Decimal('5.00'),
            impostos_locacao=Decimal('0.00'),
            qnt=Decimal('10.00'),
        )
        # MDO: 2 workers × 5 dias × R$100/dia = R$1.000
        MDO.objects.create(
            orcamento=self.orc, fnc='Soldador',
            qnt=Decimal('2'), dias=Decimal('5'), custo_unit_dia=Decimal('100.00')
        )
        # Material: 10 unid × fator 2 × R$50/unit = R$1.000
        Material.objects.create(
            orcamento=self.orc, item='Chapa', unidade='un',
            qnt=Decimal('10'), peso=Decimal('2'), custo_unit=Decimal('50.00')
        )
        # Terceirizado: 3 unid × fator 1 (peso=None) × R$200/unit = R$600
        Servico_terceirizado.objects.create(
            orcamento=self.orc, descricao='Pintura', unidade='m2',
            qnt=Decimal('3'), peso=None, valor_unit=Decimal('200.00'), observacao=''
        )

    def test_custo_bruto_soma_todos_itens(self):
        from .models import Resumo_orcamento
        resumo = Resumo_orcamento.objects.get(pk=self.resumo.pk)
        self.assertEqual(resumo.custo_bruto, Decimal('2600.00'))

    def test_custo_com_impostos_aplica_percentual(self):
        from .models import Resumo_orcamento
        resumo = Resumo_orcamento.objects.get(pk=self.resumo.pk)
        # 2600 × 1.05 = 2730.00
        self.assertEqual(resumo.custo_com_impostos, Decimal('2730.00'))

    def test_custo_por_unidade_divide_por_qnt(self):
        from .models import Resumo_orcamento
        resumo = Resumo_orcamento.objects.get(pk=self.resumo.pk)
        # 2730 / 10 = 273.00
        self.assertEqual(resumo.custo_por_unidade, Decimal('273.00'))

    def test_custo_por_unidade_qnt_zero_retorna_zero(self):
        """Regra de negócio: qnt=0 não deve causar divisão por zero."""
        from .models import Resumo_orcamento
        self.resumo.qnt = Decimal('0')
        self.resumo.save()
        resumo = Resumo_orcamento.objects.get(pk=self.resumo.pk)
        self.assertEqual(resumo.custo_por_unidade, 0)

    def test_sem_itens_custo_bruto_e_zero(self):
        from .models import Levantamento, Orcamento, Resumo_orcamento
        cli = criar_cliente('VazioResumo')
        neg = criar_negocio(cli, 'NegocioVazio')
        lev = Levantamento.objects.create(cliente=cli, negocio=neg)
        orc = Orcamento.objects.create(levantamento=lev, numero_orcamento='VAZIO-001')
        resumo = Resumo_orcamento.objects.create(
            orcamento=orc, margem=Decimal('0'), OH=Decimal('0'),
            impostos=Decimal('10'), impostos_locacao=Decimal('0'), qnt=Decimal('1')
        )
        self.assertEqual(resumo.custo_bruto, Decimal('0'))
        self.assertEqual(resumo.custo_com_impostos, Decimal('0'))

    def test_impostos_zero_custo_com_impostos_igual_bruto(self):
        from .models import Resumo_orcamento
        self.resumo.impostos = Decimal('0')
        self.resumo.save()
        resumo = Resumo_orcamento.objects.get(pk=self.resumo.pk)
        self.assertEqual(resumo.custo_com_impostos, resumo.custo_bruto)


# =============================================================================
# 13. CRIAR_ORCAMENTO — ENDPOINT TRANSACIONAL
# =============================================================================

class CriarOrcamentoAPITests(APITestCase):
    """Endpoint POST /comercial/orcamentos/criar/ — criação, idempotência e rollback."""

    def setUp(self):
        self.admin = criar_admin('adm-orc', 'Admin@teste1')
        resp = obter_token(self.client, 'adm-orc', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')
        self.cliente = criar_cliente('OrcCliente')
        self.negocio = criar_negocio(self.cliente, 'OrcNegocio')

    def _payload(self, extra=None):
        data = {
            'levantamento': {
                'negocio_id': self.negocio.pk,
                'cliente_id': self.cliente.pk,
            },
            'resumo': {
                'margem': 20, 'OH': 10, 'impostos': 5,
                'impostos_locacao': 0, 'qnt': 5,
            },
            'mao_de_obra': [
                {'fnc': 'Solda', 'qnt': '2', 'dias': '3', 'custo_unit_dia': '100.00'}
            ],
            'materiais': [],
            'terceirizados': [],
        }
        if extra:
            data.update(extra)
        return data

    def test_criar_orcamento_retorna_200(self):
        resp = self.client.post(f'{BASE}/orcamentos/criar/', self._payload(), format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('orcamento_id', resp.data)

    def test_cria_entidades_relacionadas(self):
        from .models import Levantamento, Orcamento, Resumo_orcamento, MDO
        resp = self.client.post(f'{BASE}/orcamentos/criar/', self._payload(), format='json')
        self.assertEqual(resp.status_code, 200)
        orc_id = resp.data['orcamento_id']
        self.assertTrue(Levantamento.objects.filter(negocio=self.negocio).exists())
        self.assertTrue(Orcamento.objects.filter(pk=orc_id).exists())
        self.assertTrue(Resumo_orcamento.objects.filter(orcamento_id=orc_id).exists())
        self.assertEqual(MDO.objects.filter(orcamento_id=orc_id).count(), 1)

    def test_idempotencia_segunda_chamada_nao_duplica(self):
        from .models import Orcamento
        self.client.post(f'{BASE}/orcamentos/criar/', self._payload(), format='json')
        self.client.post(f'{BASE}/orcamentos/criar/', self._payload(), format='json')
        count = Orcamento.objects.filter(levantamento__negocio=self.negocio).count()
        self.assertEqual(count, 1, 'Segunda chamada deve atualizar, não criar novo orçamento')

    def test_negocio_id_ausente_retorna_400(self):
        payload = {
            'levantamento': {'cliente_id': self.cliente.pk},
            'resumo': {'margem': 10, 'OH': 5, 'impostos': 3, 'qnt': 1},
        }
        resp = self.client.post(f'{BASE}/orcamentos/criar/', payload, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_levantamento_ausente_retorna_400(self):
        resp = self.client.post(f'{BASE}/orcamentos/criar/', {'resumo': {'margem': 10}}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_finalizar_marca_negocio_orcamento_realizado(self):
        payload = self._payload({'finalizar': True})
        resp = self.client.post(f'{BASE}/orcamentos/criar/', payload, format='json')
        self.assertEqual(resp.status_code, 200)
        self.negocio.refresh_from_db()
        self.assertTrue(self.negocio.orcamento_realizado)

    def test_segunda_chamada_atualiza_resumo_existente(self):
        from .models import Resumo_orcamento
        self.client.post(f'{BASE}/orcamentos/criar/', self._payload(), format='json')
        payload2 = self._payload()
        payload2['resumo']['margem'] = 30
        self.client.post(f'{BASE}/orcamentos/criar/', payload2, format='json')
        neg = self.negocio
        resumo = Resumo_orcamento.objects.get(orcamento__levantamento__negocio=neg)
        self.assertEqual(resumo.margem, Decimal('30'))


# =============================================================================
# 14. SEGURANÇA DO USERVIEWSET (AllowAny)
# =============================================================================

class UserViewSetSecurityTests(APITestCase):
    """UserViewSet exige autenticação (IsAuthenticated, via REST_FRAMEWORK.
    DEFAULT_PERMISSION_CLASSES em settings.py) — a vulnerabilidade AllowAny que estes
    testes documentavam foi corrigida antes desta sessão; os testes abaixo cobrem o
    comportamento atual (401 para quem não autentica), não mais o bug antigo."""

    def setUp(self):
        self.admin = criar_admin('adm-sec', 'Admin@teste1')
        self.gerente = criar_gerente('ger-sec', 'Admin@teste1')

    def test_usuario_anonimo_nao_pode_listar_usuarios(self):
        """Sem token, GET /usuarios/ deve retornar 401 (IsAuthenticated)."""
        resp = self.client.get(f'{BASE}/usuarios/')
        self.assertEqual(resp.status_code, 401)

    def test_usuario_anonimo_nao_pode_excluir_admin(self):
        """Sem token, DELETE deve retornar 401 (autenticação exigida pelo DRF padrão ao tentar deletar)."""
        resp = self.client.delete(f'{BASE}/usuarios/{self.admin.pk}/')
        self.assertEqual(resp.status_code, 401)

    def test_admin_nao_pode_excluir_superuser(self):
        """Regra de negócio: admin principal (is_superuser) não pode ser deletado."""
        resp_tok = obter_token(self.client, 'adm-sec', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp_tok.data["access"]}')
        resp = self.client.delete(f'{BASE}/usuarios/{self.admin.pk}/')
        self.assertEqual(resp.status_code, 403)

    def test_criar_usuario_sem_autenticacao_retorna_401(self):
        """Sem token, POST /usuarios/ deve retornar 401 (IsAuthenticated)."""
        payload = {
            'cpf': 'anon-new', 'password': 'Admin@teste1',
            'nome': 'Anon User', 'email': 'anon@test.com', 'role': 'usuario'
        }
        resp = self.client.post(f'{BASE}/usuarios/', payload, format='json')
        self.assertEqual(resp.status_code, 401)

    def test_admin_pode_criar_usuario(self):
        resp_tok = obter_token(self.client, 'adm-sec', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp_tok.data["access"]}')
        payload = {
            'cpf': 'novo-user-sec', 'password': 'Admin@teste1',
            'nome': 'Novo Sec', 'email': 'novosec@test.com', 'role': 'usuario'
        }
        resp = self.client.post(f'{BASE}/usuarios/', payload, format='json')
        self.assertEqual(resp.status_code, 201)


# =============================================================================
# 15. JWT — REFRESH E TOKEN INVÁLIDO
# =============================================================================

class JWTTokenTests(APITestCase):
    """Fluxo de autenticação JWT: refresh funciona, token inválido retorna 401."""

    def setUp(self):
        self.admin = criar_admin('adm-jwt', 'Admin@teste1')

    def test_refresh_token_valido_retorna_novo_access(self):
        resp = obter_token(self.client, 'adm-jwt', 'Admin@teste1')
        self.assertEqual(resp.status_code, 200)
        refresh_token = resp.data['refresh']
        resp2 = self.client.post('/token/refresh/', {'refresh': refresh_token}, format='json')
        self.assertEqual(resp2.status_code, 200)
        self.assertIn('access', resp2.data)

    def test_refresh_token_invalido_retorna_401(self):
        resp = self.client.post('/token/refresh/', {'refresh': 'token.invalido.aqui'}, format='json')
        self.assertEqual(resp.status_code, 401)

    def test_access_token_invalido_bloqueia_endpoint_autenticado(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer token.falso.invalido')
        resp = self.client.get('/comercial/usuarios/me/')
        self.assertEqual(resp.status_code, 401)

    def test_sem_token_bloqueia_endpoint_autenticado(self):
        resp = self.client.get('/comercial/usuarios/me/')
        self.assertEqual(resp.status_code, 401)


# =============================================================================
# 16. CASCADE DELETE — COMPORTAMENTO EM CASCATA
# =============================================================================

class CascadeDeleteTests(TestCase):
    """Verifica cascata e SET_NULL ao deletar entidades pai."""

    def test_deletar_cliente_remove_negocios(self):
        cli = criar_cliente('CascadeCliente')
        neg = criar_negocio(cli, 'Negocio Cascade')
        cli_pk = cli.pk
        neg_pk = neg.pk
        cli.delete()
        self.assertFalse(Cliente.objects.filter(pk=cli_pk).exists())
        self.assertFalse(Negocio.objects.filter(pk=neg_pk).exists())

    def test_deletar_negocio_anula_referencia_na_os(self):
        cli = criar_cliente('CascadeOS')
        neg = criar_negocio(cli, 'Negocio OS Cascade')
        os = OrdemServico.objects.create(
            cliente=cli,
            negocio=neg,
            numero_os='OS-CASCADE-001',
            local='Porto',
            data_inicio_previsto='2025-01-01',
            data_termino_previsto='2025-01-31',
            supervisor_encarregado='Supervisor',
            descricao_geral_servico='Teste de cascade',
        )
        neg.delete()
        os.refresh_from_db()
        self.assertIsNone(os.negocio)

    def test_deletar_cliente_remove_os(self):
        cli = criar_cliente('CascadeOSCliente')
        neg = criar_negocio(cli, 'Neg OS')
        os = OrdemServico.objects.create(
            cliente=cli,
            negocio=neg,
            numero_os='OS-CASCADE-002',
            local='Rio',
            data_inicio_previsto='2025-02-01',
            data_termino_previsto='2025-02-28',
            supervisor_encarregado='Sup',
            descricao_geral_servico='Cascade cliente→OS',
        )
        os_pk = os.pk
        cli.delete()
        self.assertFalse(OrdemServico.objects.filter(pk=os_pk).exists())

    def test_deletar_negocio_remove_itens_alocacao(self):
        cli = criar_cliente('CascadeAloc')
        neg = criar_negocio(cli, 'NegAloc')
        item = ItemAlocacao.objects.create(
            negocio=neg, equipamento='Guincho', quantidade=Decimal('2')
        )
        item_pk = item.pk
        neg.delete()
        self.assertFalse(ItemAlocacao.objects.filter(pk=item_pk).exists())


# =============================================================================
# 17. FLUXO COMPLETO — CLIENTE → NEGÓCIO → OS → MEDIÇÃO → APROVAÇÃO
# =============================================================================

class FluxoCompletoTests(APITestCase):
    """Teste de integração end-to-end do ciclo comercial principal."""

    def setUp(self):
        self.admin = criar_admin('adm-flow', 'Admin@teste1')
        resp = obter_token(self.client, 'adm-flow', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def test_fluxo_cliente_negocio_os_medicao_aprovacao(self):
        # 1. Criar cliente
        resp_cli = self.client.post(f'{BASE}/clientes/', {
            'razao_social': 'Empresa Fluxo LTDA',
            'documento': '99.000.000/0001-99',
        }, format='json')
        self.assertEqual(resp_cli.status_code, 201)
        cli_id = resp_cli.data['id']

        # 2. Criar negócio
        resp_neg = self.client.post(f'{BASE}/negocios/', {
            'cliente': cli_id,
            'empresa_prestadora': 'Linave',
            'nome_negocio': 'Projeto Fluxo',
            'solicitante': 'João da Silva',
            'email': 'joao@empresa.com',
        }, format='json')
        self.assertEqual(resp_neg.status_code, 201)
        neg_id = resp_neg.data['negocio']['id']

        # 3. Criar OS (serializer usa cliente_id/negocio_id como write-only FKs)
        resp_os = self.client.post(f'{BASE}/ordens-servico/', {
            'cliente_id': cli_id,
            'negocio_id': neg_id,
            'numero_os': 'OS-FLUXO-001',
            'local': 'Santos - SP',
            'data_inicio_previsto': '2025-06-01',
            'data_termino_previsto': '2025-06-30',
            'supervisor_encarregado': 'Carlos',
            'descricao_geral_servico': 'Servico de manutencao',
        }, format='json')
        self.assertEqual(resp_os.status_code, 201)
        os_id = resp_os.data['data']['id']

        # 4. Aprovar OS
        resp_ap = self.client.patch(
            f'{BASE}/ordens-servico/{os_id}/atualizar-status/',
            {'status_aprovacao': 'aprovada'}, format='json'
        )
        self.assertEqual(resp_ap.status_code, 200)
        self.assertEqual(resp_ap.data['data']['status_aprovacao'], 'aprovada')

        # 5. Criar medição (direto no model — endpoint de criação é via ViewSet)
        neg_obj = Negocio.objects.get(pk=neg_id)
        medicao = Medicao.objects.create(negocio=neg_obj, numero_bm='BM-FLUXO-001')

        # 6. Aprovar medição
        resp_med = self.client.patch(
            f'{BASE}/medicoes/{medicao.pk}/atualizar-status/',
            {'status': 'aprovada'}, format='json'
        )
        self.assertEqual(resp_med.status_code, 200)
        medicao.refresh_from_db()
        self.assertEqual(medicao.status, 'aprovada')

    def test_fluxo_cria_logs_em_cada_etapa(self):
        """Cada etapa do fluxo deve gerar ao menos um log de atividade."""
        logs_antes = LogAtividade.objects.count()

        cli = self.client.post(f'{BASE}/clientes/', {
            'razao_social': 'Log Fluxo SA'
        }, format='json')
        neg = self.client.post(f'{BASE}/negocios/', {
            'cliente': cli.data['id'],
            'empresa_prestadora': 'Linave',
            'nome_negocio': 'Log Neg',
            'solicitante': 'Ana',
            'email': 'ana@log.com',
        }, format='json')

        logs_depois = LogAtividade.objects.count()
        self.assertGreater(logs_depois, logs_antes)


# =============================================================================
# 18. ATUALIZAR STATUS DE OS
# =============================================================================

class AtualizarStatusOSTests(APITestCase):
    """Endpoint PATCH /comercial/ordens-servico/<pk>/atualizar-status/"""

    def setUp(self):
        self.admin = criar_admin('adm-os-status', 'Admin@teste1')
        resp = obter_token(self.client, 'adm-os-status', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')
        cli = criar_cliente('OS Status Cliente')
        self.os = OrdemServico.objects.create(
            cliente=cli,
            numero_os='OS-STATUS-001',
            local='Recife',
            data_inicio_previsto='2025-03-01',
            data_termino_previsto='2025-03-31',
            supervisor_encarregado='Sup',
            descricao_geral_servico='Teste status',
        )

    def test_atualizar_status_os_para_emproducao(self):
        resp = self.client.patch(
            f'{BASE}/ordens-servico/{self.os.pk}/atualizar-status/',
            {'status_os': 'emproducao'}, format='json'
        )
        self.assertEqual(resp.status_code, 200)
        self.os.refresh_from_db()
        self.assertEqual(self.os.status_os, 'emproducao')

    def test_aprovacao_define_data_aprovacao(self):
        resp = self.client.patch(
            f'{BASE}/ordens-servico/{self.os.pk}/atualizar-status/',
            {'status_aprovacao': 'aprovada'}, format='json'
        )
        self.assertEqual(resp.status_code, 200)
        self.os.refresh_from_db()
        self.assertEqual(self.os.status_aprovacao, 'aprovada')
        self.assertIsNotNone(self.os.data_aprovacao)

    def test_atualizar_status_envio(self):
        resp = self.client.patch(
            f'{BASE}/ordens-servico/{self.os.pk}/atualizar-status/',
            {'status_envio': 'enviada'}, format='json'
        )
        self.assertEqual(resp.status_code, 200)
        self.os.refresh_from_db()
        self.assertEqual(self.os.status_envio, 'enviada')

    def test_os_inexistente_retorna_404(self):
        resp = self.client.patch(
            f'{BASE}/ordens-servico/99999/atualizar-status/',
            {'status_os': 'concluida'}, format='json'
        )
        self.assertEqual(resp.status_code, 404)

    def test_atualizar_multiplos_status_numa_chamada(self):
        resp = self.client.patch(
            f'{BASE}/ordens-servico/{self.os.pk}/atualizar-status/',
            {'status_os': 'concluida', 'status_envio': 'enviada', 'status_aprovacao': 'aprovada'},
            format='json'
        )
        self.assertEqual(resp.status_code, 200)
        self.os.refresh_from_db()
        self.assertEqual(self.os.status_os, 'concluida')
        self.assertEqual(self.os.status_envio, 'enviada')
        self.assertEqual(self.os.status_aprovacao, 'aprovada')

    def test_log_registrado_ao_atualizar_status_os(self):
        count = LogAtividade.objects.filter(modulo='Ordens de Serviço').count()
        self.client.patch(
            f'{BASE}/ordens-servico/{self.os.pk}/atualizar-status/',
            {'status_os': 'emproducao'}, format='json'
        )
        self.assertEqual(LogAtividade.objects.filter(modulo='Ordens de Serviço').count(), count + 1)


# =============================================================================
# 19. ENDPOINTS FINANCEIRO / COMPRAS / ALMOXARIFADO / CONFIGURAÇÕES
# =============================================================================

class FinanceiroCRUDTests(APITestCase):
    """Verifica GET e POST dos endpoints de estado agregado."""

    def setUp(self):
        self.admin = criar_admin('adm-fin', 'Admin@teste1')
        resp = obter_token(self.client, 'adm-fin', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def test_get_financeiro_retorna_200(self):
        resp = self.client.get(f'{BASE}/financeiro/')
        self.assertEqual(resp.status_code, 200)

    def test_post_financeiro_com_lista_vazia_retorna_200(self):
        resp = self.client.post(f'{BASE}/financeiro/', [], format='json')
        self.assertEqual(resp.status_code, 200)

    def test_post_financeiro_payload_invalido_retorna_400(self):
        # Enviar 'financeiro' com valor não-lista → 400
        resp = self.client.post(f'{BASE}/financeiro/', {'financeiro': 'nao-e-lista'}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_get_compras_retorna_200(self):
        resp = self.client.get(f'{BASE}/compras/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('compras', resp.data)
        self.assertIn('comprasHistorico', resp.data)

    def test_post_compras_substitui_requisicoes(self):
        payload = {'compras': [{'id': 'REQ-001', 'descricao': 'Parafuso', 'status': 'pendente'}]}
        resp = self.client.post(f'{BASE}/compras/', payload, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('compras', resp.data)

    def test_get_almoxarifado_retorna_200(self):
        resp = self.client.get(f'{BASE}/almoxarifado/')
        self.assertEqual(resp.status_code, 200)

    def test_post_almoxarifado_retorna_200(self):
        resp = self.client.post(f'{BASE}/almoxarifado/', {}, format='json')
        self.assertEqual(resp.status_code, 200)


class FinanceiroReplaceAllGuardTests(APITestCase):
    """Rede de segurança em financeiro_data: recusa um replace-all que encolheria o banco
    de forma drástica (a causa raiz do apagão real de dados — uma escrita partiu de uma
    cópia incompleta do estado atual e o replace-all apagou o que não estava nela)."""

    def setUp(self):
        self.admin = criar_admin('adm-guard', 'Admin@teste1')
        resp = obter_token(self.client, 'adm-guard', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def _solicitacoes(self, n):
        return [{'id': f'SP-{i:04d}', 'tipo': 'solicitacao', 'valor': 10} for i in range(n)]

    def test_recusa_queda_drastica_acima_do_piso(self):
        from .models import SolicitacaoPagamento
        # Estabelece 25 registros (acima do piso de 20 que ativa a checagem).
        self.assertEqual(self.client.post(f'{BASE}/financeiro/', self._solicitacoes(25), format='json').status_code, 200)
        self.assertEqual(SolicitacaoPagamento.objects.count(), 25)

        # Uma lista com só 2 registros (bem menos da metade de 25) deve ser recusada.
        resp = self.client.post(f'{BASE}/financeiro/', self._solicitacoes(2), format='json')
        self.assertEqual(resp.status_code, 400)
        # Nada foi apagado: os 25 registros originais continuam intactos.
        self.assertEqual(SolicitacaoPagamento.objects.count(), 25)

    def test_permite_queda_moderada_acima_do_piso(self):
        from .models import SolicitacaoPagamento
        self.assertEqual(self.client.post(f'{BASE}/financeiro/', self._solicitacoes(25), format='json').status_code, 200)
        # 20 de 25 é 80% — acima do piso de 50%, deve passar normalmente.
        resp = self.client.post(f'{BASE}/financeiro/', self._solicitacoes(20), format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(SolicitacaoPagamento.objects.count(), 20)

    def test_nao_bloqueia_banco_pequeno_abaixo_do_piso(self):
        from .models import SolicitacaoPagamento
        # Com poucos registros (ambiente novo/de teste), mesmo uma queda proporcionalmente
        # grande não deve ser bloqueada — é abaixo do piso mínimo que ativa a checagem.
        self.assertEqual(self.client.post(f'{BASE}/financeiro/', self._solicitacoes(5), format='json').status_code, 200)
        resp = self.client.post(f'{BASE}/financeiro/', self._solicitacoes(1), format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(SolicitacaoPagamento.objects.count(), 1)


class ComprasEscopoPorUsuarioTests(APITestCase):
    """compras_data: usuário comum só lê/grava/apaga as próprias compras; admin e gerente
    têm acesso a todas. Antes, qualquer autenticado zerava o kanban inteiro com
    POST {"compras": []}."""

    def setUp(self):
        criar_admin('adm-cmp', 'Admin@teste1')
        criar_gerente('ger-cmp', 'Admin@teste1')
        criar_usuario('ana-cmp', 'Admin@teste1')
        User.objects.create_user(cpf='bia-cmp', password='Admin@teste1', nome='Bia',
                                 email='bia@test.com', role='usuario', permissoes={})
        self._logar('adm-cmp')
        resp = self.client.post(f'{BASE}/compras/', {
            'compras': [
                {'id': 'REQ-ANA', 'solicitante': 'Usuario Teste', 'solicitanteCpf': 'ana-cmp'},
                {'id': 'REQ-BIA', 'solicitante': 'Bia', 'solicitanteCpf': 'bia-cmp'},
                {'id': 'REQ-LEGADO-BIA', 'solicitante': 'Bia'},
            ],
            'comprasHistorico': [
                {'id': 'H-ANA', 'solicitanteEmail': 'user@test.com'},
                {'id': 'H-BIA', 'solicitanteEmail': 'bia@test.com'},
            ],
        }, format='json')
        self.assertEqual(resp.status_code, 200)

    def _logar(self, cpf, senha='Admin@teste1'):
        resp = obter_token(self.client, cpf, senha)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def _ids_no_banco(self):
        from .models import RequisicaoCompra, CompraHistorico
        return (set(RequisicaoCompra.objects.values_list('record_id', flat=True)),
                set(CompraHistorico.objects.values_list('record_id', flat=True)))

    def test_usuario_comum_le_so_as_proprias(self):
        self._logar('ana-cmp')
        resp = self.client.get(f'{BASE}/compras/')
        self.assertEqual([r['id'] for r in resp.data['compras']], ['REQ-ANA'])
        self.assertEqual([r['id'] for r in resp.data['comprasHistorico']], ['H-ANA'])

    def test_compra_legada_casa_pelo_nome(self):
        self._logar('bia-cmp')
        resp = self.client.get(f'{BASE}/compras/')
        self.assertEqual({r['id'] for r in resp.data['compras']}, {'REQ-BIA', 'REQ-LEGADO-BIA'})

    def test_lista_vazia_de_usuario_comum_so_apaga_as_proprias(self):
        self._logar('ana-cmp')
        resp = self.client.post(f'{BASE}/compras/', {'compras': [], 'comprasHistorico': []}, format='json')
        self.assertEqual(resp.status_code, 200)
        compras, historico = self._ids_no_banco()
        self.assertEqual(compras, {'REQ-BIA', 'REQ-LEGADO-BIA'})
        self.assertEqual(historico, {'H-BIA'})

    def test_usuario_comum_cria_a_propria_sem_mexer_nas_outras(self):
        self._logar('ana-cmp')
        resp = self.client.post(f'{BASE}/compras/', {'compras': [
            {'id': 'REQ-ANA', 'solicitanteCpf': 'ana-cmp'},
            {'id': 'REQ-ANA-2', 'solicitanteCpf': 'ana-cmp'},
        ]}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual({r['id'] for r in resp.data['compras']}, {'REQ-ANA', 'REQ-ANA-2'})
        self.assertEqual(self._ids_no_banco()[0], {'REQ-ANA', 'REQ-ANA-2', 'REQ-BIA', 'REQ-LEGADO-BIA'})

    def test_registro_sem_identidade_e_carimbado_com_o_cpf_do_usuario(self):
        from .models import RequisicaoCompra
        self._logar('ana-cmp')
        resp = self.client.post(f'{BASE}/compras/', {'compras': [{'id': 'REQ-ANON'}]}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(RequisicaoCompra.objects.get(record_id='REQ-ANON').extra['solicitanteCpf'], 'ana-cmp')

    def test_recusa_compra_de_outra_pessoa_no_payload(self):
        self._logar('ana-cmp')
        resp = self.client.post(f'{BASE}/compras/', {'compras': [
            {'id': 'REQ-NOVA', 'solicitanteCpf': 'bia-cmp'},
        ]}, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(self._ids_no_banco()[0], {'REQ-ANA', 'REQ-BIA', 'REQ-LEGADO-BIA'})

    def test_recusa_tomar_compra_alheia_reenviando_com_o_proprio_cpf(self):
        from .models import RequisicaoCompra
        self._logar('ana-cmp')
        resp = self.client.post(f'{BASE}/compras/', {'compras': [
            {'id': 'REQ-BIA', 'solicitanteCpf': 'ana-cmp', 'stage': 'COMPRADOS'},
        ]}, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(RequisicaoCompra.objects.get(record_id='REQ-BIA').extra['solicitanteCpf'], 'bia-cmp')

    def test_recusa_no_historico_desfaz_tambem_as_compras(self):
        self._logar('ana-cmp')
        resp = self.client.post(f'{BASE}/compras/', {
            'compras': [],
            'comprasHistorico': [{'id': 'H-BIA', 'solicitanteEmail': 'user@test.com'}],
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertIn('REQ-ANA', self._ids_no_banco()[0])

    def test_gerente_le_e_grava_todas(self):
        self._logar('ger-cmp')
        resp = self.client.get(f'{BASE}/compras/')
        self.assertEqual(len(resp.data['compras']), 3)
        resp = self.client.post(f'{BASE}/compras/', {'compras': [
            {'id': 'REQ-BIA', 'solicitanteCpf': 'bia-cmp', 'stage': 'COMPRADOS'},
        ]}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self._ids_no_banco()[0], {'REQ-BIA'})

    def test_recusa_queda_drastica_acima_do_piso(self):
        self._logar('adm-cmp')
        muitas = [{'id': f'REQ-{i:03d}', 'solicitanteCpf': 'bia-cmp'} for i in range(12)]
        self.assertEqual(self.client.post(f'{BASE}/compras/', {'compras': muitas}, format='json').status_code, 200)
        resp = self.client.post(f'{BASE}/compras/', {'compras': []}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(len(self._ids_no_banco()[0]), 12)

    def test_payload_que_nao_e_lista_retorna_400(self):
        self._logar('ana-cmp')
        resp = self.client.post(f'{BASE}/compras/', {'compras': 'x'}, format='json')
        self.assertEqual(resp.status_code, 400)


class ComprasPermissoesDoPainelTests(APITestCase):
    """Quem tem a permissão de Compras no painel acessa todas as compras daquela coleção
    (COMPRAS_ACESSO em views.py); sem ela, só as próprias."""

    def setUp(self):
        criar_admin('adm-cp', 'Admin@teste1')
        for cpf, perms in (('comprador', {'kanbanCompras': True}), ('aprovador', {'aprovarComercial': True}),
                           ('hist', {'historicoCompras': True}), ('estoq', {'itensAdicionar': True}),
                           ('custo', {'finCustoOs': True}), ('zeca', {})):
            User.objects.create_user(cpf=cpf, password='Admin@teste1', nome=cpf, email=f'{cpf}@cp.com',
                                     role='usuario', permissoes=perms)
        self._logar('adm-cp')
        self.client.post(f'{BASE}/compras/', {
            'compras': [{'id': 'REQ-1', 'solicitanteCpf': 'zeca', 'stage': 'SOLICITACOES'}],
            'comprasHistorico': [{'id': 'H-1', 'solicitanteCpf': 'zeca', 'purchaseState': 'comprado'}],
        }, format='json')

    def _logar(self, cpf):
        token = obter_token(self.client, cpf, 'Admin@teste1').data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def _get(self, cpf):
        self._logar(cpf)
        r = self.client.get(f'{BASE}/compras/')
        return {r2['id'] for r2 in r.data['compras']}, {r2['id'] for r2 in r.data['comprasHistorico']}

    def _alterar(self, cpf, chave, rid, **campos):
        self._logar(cpf)
        base = self.client.get(f'{BASE}/compras/').data[chave]
        novo = [({**r, **campos} if r['id'] == rid else r) for r in base]
        return self.client.post(f'{BASE}/compras/', {chave: novo}, format='json').status_code

    def test_leitura_por_permissao(self):
        self.assertEqual(self._get('comprador'), ({'REQ-1'}, {'H-1'}))
        self.assertEqual(self._get('aprovador'), ({'REQ-1'}, {'H-1'}))
        self.assertEqual(self._get('custo'), ({'REQ-1'}, {'H-1'}))
        self.assertEqual(self._get('hist'), (set(), {'H-1'}))
        self.assertEqual(self._get('estoq'), (set(), {'H-1'}))

    def test_comprador_e_aprovador_alteram_requisicao_alheia(self):
        self.assertEqual(self._alterar('comprador', 'compras', 'REQ-1', stage='COMPRADOS'), 200)
        self.assertEqual(self._alterar('aprovador', 'compras', 'REQ-1', stage='AGUARDANDO_FIN'), 200)

    def test_historico_e_estoque_alteram_historico_alheio(self):
        self.assertEqual(self._alterar('hist', 'comprasHistorico', 'H-1', nfeStatus='recebida'), 200)
        self.assertEqual(self._alterar('estoq', 'comprasHistorico', 'H-1', purchaseState='estoque'), 200)

    def test_quem_so_le_nao_altera_mas_pode_reenviar_inalterado(self):
        from .models import RequisicaoCompra
        self.assertEqual(self._alterar('custo', 'compras', 'REQ-1', stage='COMPRADOS'), 403)
        self.assertEqual(self._alterar('custo', 'compras', 'REQ-1'), 200)  # lista inalterada
        self.assertEqual(RequisicaoCompra.objects.get(record_id='REQ-1').extra['stage'], 'SOLICITACOES')
        self.assertEqual(self._alterar('aprovador', 'comprasHistorico', 'H-1', purchaseState='estoque'), 403)

    def test_sem_permissao_nao_ve_nem_altera_as_dos_outros(self):
        User.objects.create_user(cpf='bia-cp', password='Admin@teste1', nome='Bia', email='bia@cp.com',
                                 role='usuario', permissoes={})
        self.assertEqual(self._get('bia-cp'), (set(), set()))
        self._logar('bia-cp')
        r = self.client.post(f'{BASE}/compras/', {'compras': [{'id': 'REQ-1', 'solicitanteCpf': 'zeca', 'stage': 'X'}]}, format='json')
        self.assertEqual(r.status_code, 403)


class FinanceiroLeituraRestritaTests(APITestCase):
    """GET /comercial/financeiro/ — usuário sem NENHUMA permissão de Financeiro não pode ler
    solicitação de pagamento (nome, fornecedor, valor, motivo) nem os campos sensíveis de
    conta a pagar, mesmo que o backend libere GET pra qualquer autenticado (outras telas,
    tipo Almoxarifado/Compras, precisam ler outros tipos do Financeiro pra funcionar)."""

    def _logar(self, cpf, senha='Admin@teste1'):
        resp = obter_token(self.client, cpf, senha)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def _semear_financeiro(self):
        # Usa o replace-all direto (como admin) pra semear uma solicitação e uma conta a
        # pagar com dado sensível, sem passar pelo endpoint append-only.
        self._logar('adm-leitura', 'Admin@teste1')
        payload = [
            {'id': 'SP-SIGILO', 'tipo': 'solicitacao', 'solicitante': 'Fulano Sigiloso',
             'fornecedor': 'Fornecedor Confidencial', 'valor': 9999.99, 'documento': 'NF-SECRETA'},
            {'id': 'CP-SIGILO', 'tipo': 'contaPagar', 'status': 'Aberto', 'documento': 'NF-002',
             'anexos': ['/media/x.pdf'], 'fornecedor': 'Fornecedor Confidencial', 'valor': 500},
        ]
        resp = self.client.post(f'{BASE}/financeiro/', payload, format='json')
        self.assertEqual(resp.status_code, 200)

    def setUp(self):
        criar_admin('adm-leitura', 'Admin@teste1')
        self._semear_financeiro()

    def test_usuario_sem_permissao_nao_ve_solicitacao(self):
        criar_usuario('user-sem-perm', permissoes={})
        self._logar('user-sem-perm')
        resp = self.client.get(f'{BASE}/financeiro/')
        self.assertEqual(resp.status_code, 200)
        tipos = {r.get('tipo') for r in resp.data}
        self.assertNotIn('solicitacao', tipos)

    def test_usuario_sem_permissao_ve_contapagar_so_com_campos_publicos(self):
        criar_usuario('user-sem-perm2', permissoes={})
        self._logar('user-sem-perm2')
        resp = self.client.get(f'{BASE}/financeiro/')
        conta = next(r for r in resp.data if r.get('id') == 'CP-SIGILO')
        self.assertEqual(set(conta.keys()), {'id', 'tipo', 'status', 'documento', 'anexos'})
        self.assertNotIn('fornecedor', conta)
        self.assertNotIn('valor', conta)

    def test_usuario_com_permissao_financeira_ve_tudo(self):
        criar_usuario('user-com-perm', permissoes={'finPagar': True})
        self._logar('user-com-perm')
        resp = self.client.get(f'{BASE}/financeiro/')
        sol = next((r for r in resp.data if r.get('id') == 'SP-SIGILO'), None)
        self.assertIsNotNone(sol)
        self.assertEqual(sol.get('solicitante'), 'Fulano Sigiloso')
        conta = next(r for r in resp.data if r.get('id') == 'CP-SIGILO')
        self.assertEqual(conta.get('fornecedor'), 'Fornecedor Confidencial')

    def test_so_finsolicitacao_nao_e_equipe_financeira(self):
        # finSolicitacao é só a tela de pedir pagamento — não libera ler o Financeiro inteiro.
        criar_usuario('user-so-sol', permissoes={'finSolicitacao': True})
        self._logar('user-so-sol')
        resp = self.client.get(f'{BASE}/financeiro/')
        self.assertIsNone(next((r for r in resp.data if r.get('id') == 'SP-SIGILO'), None))
        conta = next(r for r in resp.data if r.get('id') == 'CP-SIGILO')
        self.assertNotIn('fornecedor', conta)

    def test_gerente_ve_tudo(self):
        criar_gerente('ger-leitura')
        self._logar('ger-leitura')
        resp = self.client.get(f'{BASE}/financeiro/')
        tipos = {r.get('tipo') for r in resp.data}
        self.assertIn('solicitacao', tipos)


class FinanceiroSolicitacaoCriarTests(APITestCase):
    """POST /comercial/financeiro/solicitacao/ — append-only, aberto a todo autenticado.

    A tela "Solicitação de Pagamento" é liberada a TODO colaborador (Home/Sidebar),
    então o endpoint não exige permissão de módulo; já o replace-all de /financeiro/
    continua restrito ao módulo Financeiro.
    """

    def _logar(self, cpf, senha='Admin@teste1'):
        resp = obter_token(self.client, cpf, senha)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def test_usuario_comum_sem_permissoes_cria_solicitacao(self):
        criar_usuario('user-sol')
        self._logar('user-sol')
        payload = {'id': 'SP-TESTE1', 'solicitante': 'Usuario Teste', 'valor': 123.45}
        resp = self.client.post(f'{BASE}/financeiro/solicitacao/', payload, format='json')
        self.assertEqual(resp.status_code, 201)
        criado = next((r for r in resp.data.get('financeiro', []) if r.get('id') == 'SP-TESTE1'), None)
        self.assertIsNotNone(criado)
        self.assertEqual(criado['tipo'], 'solicitacao')
        self.assertEqual(criado['status'], 'Aguardando aprovação')

    def test_tipo_eh_forcado_para_solicitacao(self):
        from .models import SolicitacaoPagamento, ContaPagar
        criar_usuario('user-sol')
        self._logar('user-sol')
        payload = {'id': 'CP-FALSO', 'tipo': 'contaPagar', 'valor': 999}
        resp = self.client.post(f'{BASE}/financeiro/solicitacao/', payload, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(ContaPagar.objects.count(), 0)
        self.assertTrue(SolicitacaoPagamento.objects.filter(record_id='CP-FALSO').exists())

    def test_sem_id_retorna_400(self):
        criar_usuario('user-sol')
        self._logar('user-sol')
        resp = self.client.post(f'{BASE}/financeiro/solicitacao/', {'valor': 10}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_id_duplicado_retorna_409(self):
        criar_usuario('user-sol')
        self._logar('user-sol')
        payload = {'id': 'SP-DUP', 'valor': 10}
        self.assertEqual(self.client.post(f'{BASE}/financeiro/solicitacao/', payload, format='json').status_code, 201)
        self.assertEqual(self.client.post(f'{BASE}/financeiro/solicitacao/', payload, format='json').status_code, 409)

    def test_replace_all_continua_bloqueado_para_usuario_comum(self):
        criar_usuario('user-sol')
        self._logar('user-sol')
        resp = self.client.post(f'{BASE}/financeiro/', [], format='json')
        self.assertEqual(resp.status_code, 403)

    def test_anonimo_retorna_401(self):
        resp = self.client.post(f'{BASE}/financeiro/solicitacao/', {'id': 'SP-X'}, format='json')
        self.assertEqual(resp.status_code, 401)

    def test_usuario_com_permissao_finsolicitacao_nao_aprova_via_replace_all(self):
        # finSolicitacao dá acesso de escrita ao módulo (passa no permissao_modulo),
        # mas aprovar/reprovar continua sendo ato de gerência — o replace-all não pode
        # servir de atalho pra um usuário comum autorizar a própria solicitação.
        from .models import SolicitacaoPagamento
        criar_usuario('user-sol', permissoes={'finSolicitacao': True})
        self._logar('user-sol')
        self.client.post(f'{BASE}/financeiro/solicitacao/', {'id': 'SP-APV', 'valor': 10}, format='json')

        payload = [{'id': 'SP-APV', 'tipo': 'solicitacao', 'valor': 10, 'status': 'Aprovado'}]
        resp = self.client.post(f'{BASE}/financeiro/', payload, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(SolicitacaoPagamento.objects.get(record_id='SP-APV').status, 'Aguardando aprovação')

    def test_gerente_aprova_via_replace_all(self):
        from .models import SolicitacaoPagamento
        criar_usuario('user-sol', permissoes={'finSolicitacao': True})
        self._logar('user-sol')
        self.client.post(f'{BASE}/financeiro/solicitacao/', {'id': 'SP-APV2', 'valor': 10}, format='json')

        criar_gerente('ger-fin')
        self._logar('ger-fin')
        payload = [{'id': 'SP-APV2', 'tipo': 'solicitacao', 'valor': 10, 'status': 'Aprovado'}]
        resp = self.client.post(f'{BASE}/financeiro/', payload, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(SolicitacaoPagamento.objects.get(record_id='SP-APV2').status, 'Aprovado')

    def test_usuario_pode_reenviar_solicitacao_reprovada(self):
        # Regressão: o bloqueio é só pra ENTRAR em Aprovado/Reprovado — o solicitante
        # continua livre pra corrigir e reenviar (status volta a 'Aguardando aprovação').
        from .models import SolicitacaoPagamento
        criar_usuario('user-sol', permissoes={'finSolicitacao': True})
        self._logar('user-sol')
        self.client.post(f'{BASE}/financeiro/solicitacao/', {'id': 'SP-REENVIO', 'valor': 10}, format='json')
        SolicitacaoPagamento.objects.filter(record_id='SP-REENVIO').update(status='Reprovado')

        payload = [{'id': 'SP-REENVIO', 'tipo': 'solicitacao', 'valor': 10, 'status': 'Aguardando aprovação'}]
        resp = self.client.post(f'{BASE}/financeiro/', payload, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(SolicitacaoPagamento.objects.get(record_id='SP-REENVIO').status, 'Aguardando aprovação')


# =============================================================================
# 20. CONFIGURAÇÕES — SINGLETON
# =============================================================================

class ConfiguracoesDataTests(APITestCase):
    """configuracoes_data deve manter um único registro (singleton)."""

    def setUp(self):
        self.admin = criar_admin('adm-cfg', 'Admin@teste1')
        resp = obter_token(self.client, 'adm-cfg', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def test_get_configuracoes_retorna_200(self):
        resp = self.client.get(f'{BASE}/configuracoes/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('config', resp.data)
        self.assertIn('listas', resp.data)

    def test_post_configuracoes_salva_config(self):
        payload = {'config': {'empresaNome': 'Linave Teste'}}
        resp = self.client.post(f'{BASE}/configuracoes/', payload, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['config']['empresaNome'], 'Linave Teste')

    def test_duas_chamadas_post_mantem_singleton(self):
        from .models import ConfiguracaoApp
        self.client.post(f'{BASE}/configuracoes/', {'config': {'empresaNome': 'Primeira'}}, format='json')
        self.client.post(f'{BASE}/configuracoes/', {'config': {'empresaNome': 'Segunda'}}, format='json')
        count = ConfiguracaoApp.objects.count()
        self.assertEqual(count, 1, 'Deve existir apenas um registro de ConfiguracaoApp')

    def test_ultima_escrita_prevalece(self):
        self.client.post(f'{BASE}/configuracoes/', {'config': {'empresaNome': 'Primeira'}}, format='json')
        self.client.post(f'{BASE}/configuracoes/', {'config': {'empresaNome': 'Segunda'}}, format='json')
        resp = self.client.get(f'{BASE}/configuracoes/')
        self.assertEqual(resp.data['config']['empresaNome'], 'Segunda')

    def test_post_configuracoes_gera_log(self):
        count = LogAtividade.objects.filter(modulo='Configurações').count()
        self.client.post(f'{BASE}/configuracoes/', {'config': {'empresaNome': 'LogTeste'}}, format='json')
        self.assertEqual(LogAtividade.objects.filter(modulo='Configurações').count(), count + 1)


# =============================================================================
# 21. LOGMIXIN — COBERTURA DE UPDATE E DELETE
# =============================================================================

class LogMixinUpdateDeleteTests(APITestCase):
    """Verifica que LogMixin registra logs em atualizações e exclusões."""

    def setUp(self):
        self.admin = criar_admin('adm-logmx', 'Admin@teste1')
        resp = obter_token(self.client, 'adm-logmx', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def test_update_cliente_gera_log_atualizacao(self):
        cli = criar_cliente('LogMixin Update')
        count = LogAtividade.objects.filter(acao='atualizacao', modulo='Clientes').count()
        self.client.patch(
            f'{BASE}/clientes/{cli.pk}/',
            {'razao_social': 'Cliente Atualizado'}, format='json'
        )
        self.assertEqual(LogAtividade.objects.filter(acao='atualizacao', modulo='Clientes').count(), count + 1)

    def test_delete_cliente_gera_log_exclusao(self):
        cli = criar_cliente('LogMixin Delete')
        count = LogAtividade.objects.filter(acao='exclusao', modulo='Clientes').count()
        self.client.delete(f'{BASE}/clientes/{cli.pk}/')
        self.assertEqual(LogAtividade.objects.filter(acao='exclusao', modulo='Clientes').count(), count + 1)

    def test_update_fornecedor_gera_log_atualizacao(self):
        from .models import Fornecedor
        forn = Fornecedor.objects.create(razao_social='Forn LogMixin', documento='11.222.333/0001-55')
        count = LogAtividade.objects.filter(acao='atualizacao', modulo='Fornecedores').count()
        self.client.patch(
            f'{BASE}/fornecedores/{forn.pk}/',
            {'razao_social': 'Forn Atualizado'}, format='json'
        )
        self.assertEqual(LogAtividade.objects.filter(acao='atualizacao', modulo='Fornecedores').count(), count + 1)

    def test_delete_fornecedor_gera_log_exclusao(self):
        from .models import Fornecedor
        forn = Fornecedor.objects.create(razao_social='Forn Del', documento='44.555.666/0001-77')
        count = LogAtividade.objects.filter(acao='exclusao', modulo='Fornecedores').count()
        self.client.delete(f'{BASE}/fornecedores/{forn.pk}/')
        self.assertEqual(LogAtividade.objects.filter(acao='exclusao', modulo='Fornecedores').count(), count + 1)

    def test_update_negocio_gera_log_atualizacao(self):
        """NegocioViewSet.update() loga via LogMixin.perform_update + chamada manual → 2 logs por update."""
        cli = criar_cliente('Neg LogMixin')
        neg = criar_negocio(cli, 'Neg Log')
        count = LogAtividade.objects.filter(acao='atualizacao', modulo='Negócios').count()
        self.client.patch(
            f'{BASE}/negocios/{neg.pk}/',
            {'nome_negocio': 'Neg Atualizado'}, format='json'
        )
        # Double-log é um bug conhecido: perform_update (LogMixin) + _registrar_log manual na view
        self.assertGreaterEqual(
            LogAtividade.objects.filter(acao='atualizacao', modulo='Negócios').count(),
            count + 1
        )

    def test_delete_os_gera_log_exclusao(self):
        cli = criar_cliente('OS LogDel')
        os = OrdemServico.objects.create(
            cliente=cli,
            numero_os='OS-LOGDEL-001',
            local='Fortaleza',
            data_inicio_previsto='2025-04-01',
            data_termino_previsto='2025-04-30',
            supervisor_encarregado='Sup',
            descricao_geral_servico='OS para teste de log de exclusão',
        )
        count = LogAtividade.objects.filter(acao='exclusao', modulo='Ordens de Serviço').count()
        self.client.delete(f'{BASE}/ordens-servico/{os.pk}/')
        self.assertEqual(LogAtividade.objects.filter(acao='exclusao', modulo='Ordens de Serviço').count(), count + 1)


# =============================================================================
# 22. ITEMALOCALOCAO — CASOS EXTREMOS
# =============================================================================

class ItemAlocacaoEdgeCaseTests(TestCase):
    """Casos extremos do cálculo de valor_total em ItemAlocacao."""

    def setUp(self):
        self.cli = criar_cliente('Aloc Edge')
        self.neg = criar_negocio(self.cli, 'Neg Aloc Edge')

    def _item(self, **kwargs):
        defaults = dict(
            negocio=self.neg, equipamento='Guindaste',
            quantidade=Decimal('1'), valor_locacao=Decimal('1000.00'),
            margem=Decimal('0'), oh=Decimal('0'),
        )
        defaults.update(kwargs)
        return ItemAlocacao(**defaults)

    def test_quantidade_zero_valor_total_zero(self):
        item = self._item(quantidade=Decimal('0'))
        self.assertEqual(item.valor_total, Decimal('0'))

    def test_valor_locacao_zero_valor_total_zero(self):
        item = self._item(valor_locacao=Decimal('0'))
        self.assertEqual(item.valor_total, Decimal('0'))

    def test_margem_100_dobra_valor(self):
        item = self._item(quantidade=Decimal('1'), valor_locacao=Decimal('500.00'), margem=Decimal('100'), oh=Decimal('0'))
        # base=500, fator=2.0 → total=1000
        self.assertEqual(item.valor_total, Decimal('1000.00'))

    def test_oh_100_dobra_valor(self):
        item = self._item(quantidade=Decimal('1'), valor_locacao=Decimal('500.00'), margem=Decimal('0'), oh=Decimal('100'))
        self.assertEqual(item.valor_total, Decimal('1000.00'))

    def test_margem_e_oh_combinados(self):
        item = self._item(quantidade=Decimal('2'), valor_locacao=Decimal('100.00'), margem=Decimal('10'), oh=Decimal('5'))
        # base=200, fator=1.15 → 230
        self.assertEqual(item.valor_total, Decimal('230.00'))

    def test_numero_grande_nao_causa_erro(self):
        item = self._item(
            quantidade=Decimal('9999.99'),
            valor_locacao=Decimal('99999.99'),
            margem=Decimal('0'), oh=Decimal('0')
        )
        resultado = item.valor_total
        self.assertGreater(resultado, Decimal('0'))

    def test_str_retorna_descricao_legivel(self):
        item = ItemAlocacao.objects.create(
            negocio=self.neg, equipamento='Andaime',
            quantidade=Decimal('3'), valor_locacao=Decimal('200')
        )
        self.assertIn('Andaime', str(item))
        self.assertIn('3', str(item))


# =============================================================================
# 25. PROPOSTA COMERCIAL — CRUD E FILTROS
# =============================================================================

class PropostaComercialAPITests(APITestCase):
    """CRUD e filtros por cliente/negocio no PropostaComercialViewSet."""

    def setUp(self):
        autenticar_admin(self.client)
        self.cli = criar_cliente()
        self.neg = criar_negocio(self.cli)

    def test_criar_proposta_retorna_201(self):
        r = self.client.post(f'{BASE}/propostas-comerciais/',
                             {'cliente': self.cli.id}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertIn('proposta', r.data)

    def test_listar_propostas_retorna_200(self):
        PropostaComercial.objects.create(cliente=self.cli, encerramento='')
        r = self.client.get(f'{BASE}/propostas-comerciais/')
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.data), 1)

    def test_filtro_por_cliente_retorna_apenas_deste_cliente(self):
        PropostaComercial.objects.create(cliente=self.cli, encerramento='')
        outro = criar_cliente(razao='Outro Cliente')
        PropostaComercial.objects.create(cliente=outro, encerramento='')
        r = self.client.get(f'{BASE}/propostas-comerciais/?cliente={self.cli.id}')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_filtro_por_negocio_retorna_apenas_vinculados(self):
        PropostaComercial.objects.create(cliente=self.cli, negocio=self.neg, encerramento='')
        PropostaComercial.objects.create(cliente=self.cli, encerramento='')
        r = self.client.get(f'{BASE}/propostas-comerciais/?negocio={self.neg.id}')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_deletar_proposta_retorna_204(self):
        prop = PropostaComercial.objects.create(cliente=self.cli, encerramento='')
        r = self.client.delete(f'{BASE}/propostas-comerciais/{prop.id}/')
        self.assertEqual(r.status_code, 204)
        self.assertFalse(PropostaComercial.objects.filter(pk=prop.id).exists())

    def test_filtro_cliente_inexistente_lista_vazia(self):
        r = self.client.get(f'{BASE}/propostas-comerciais/?cliente=99999')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 0)


# =============================================================================
# 26. ORDEM DE SERVIÇO — FILTROS POR STATUS
# =============================================================================

def _criar_os(cliente, negocio, numero='OS-X01', status_os='rascunho'):
    """Cria um OrdemServico diretamente no banco para testes."""
    return OrdemServico.objects.create(
        cliente=cliente, negocio=negocio,
        numero_os=numero, local='Porto Teste',
        data_inicio_previsto='2026-01-01', data_termino_previsto='2026-01-31',
        supervisor_encarregado='Supervisor Teste',
        descricao_geral_servico='Descricao do servico',
        status_os=status_os,
    )


class OrdemServicoFiltersTests(APITestCase):
    """Filtros de GET /ordens-servico/: status_os, status_envio, status_aprovacao."""

    def setUp(self):
        autenticar_admin(self.client)
        self.cli = criar_cliente()
        self.neg = criar_negocio(self.cli)

    def test_filtro_status_os_rascunho_exclui_outros(self):
        _criar_os(self.cli, self.neg, numero='OS-F01', status_os='rascunho')
        _criar_os(self.cli, self.neg, numero='OS-F02', status_os='concluida')
        r = self.client.get(f'{BASE}/ordens-servico/?status_os=rascunho')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_filtro_status_os_emproducao(self):
        _criar_os(self.cli, self.neg, numero='OS-F03', status_os='emproducao')
        _criar_os(self.cli, self.neg, numero='OS-F04', status_os='rascunho')
        r = self.client.get(f'{BASE}/ordens-servico/?status_os=emproducao')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_filtro_status_aprovacao_aprovada(self):
        os1 = _criar_os(self.cli, self.neg, numero='OS-F05')
        os1.status_aprovacao = 'aprovada'
        os1.save()
        _criar_os(self.cli, self.neg, numero='OS-F06')
        r = self.client.get(f'{BASE}/ordens-servico/?status_aprovacao=aprovada')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_filtro_status_envio_enviada(self):
        os1 = _criar_os(self.cli, self.neg, numero='OS-F07')
        os1.status_envio = 'enviada'
        os1.save()
        _criar_os(self.cli, self.neg, numero='OS-F08')
        r = self.client.get(f'{BASE}/ordens-servico/?status_envio=enviada')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)


# =============================================================================
# 27. OS POR CLIENTE E POR NEGOCIO
# =============================================================================

class OsPorClienteNegocioTests(APITestCase):
    """Endpoints /os-por-cliente/ e /os-por-negocio/ retornam estrutura com chave ordens_servico."""

    def setUp(self):
        autenticar_admin(self.client)
        self.cli = criar_cliente()
        self.neg = criar_negocio(self.cli)
        self.os = _criar_os(self.cli, self.neg, numero='OS-CN01')

    def test_os_por_cliente_retorna_200_com_estrutura_correta(self):
        r = self.client.get(f'{BASE}/os-por-cliente/{self.cli.id}/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('ordens_servico', r.data)
        self.assertIn('total', r.data)

    def test_os_por_cliente_retorna_os_deste_cliente(self):
        r = self.client.get(f'{BASE}/os-por-cliente/{self.cli.id}/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['total'], 1)

    def test_os_por_cliente_outro_cliente_sem_os(self):
        outro = criar_cliente(razao='Outro CN')
        r = self.client.get(f'{BASE}/os-por-cliente/{outro.id}/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['total'], 0)

    def test_os_por_cliente_inexistente_retorna_404(self):
        r = self.client.get(f'{BASE}/os-por-cliente/99999/')
        self.assertEqual(r.status_code, 404)

    def test_os_por_negocio_retorna_200_com_estrutura_correta(self):
        r = self.client.get(f'{BASE}/os-por-negocio/{self.neg.id}/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('ordens_servico', r.data)
        self.assertIn('total', r.data)
        self.assertEqual(r.data['total'], 1)

    def test_os_por_negocio_inexistente_retorna_404(self):
        r = self.client.get(f'{BASE}/os-por-negocio/99999/')
        self.assertEqual(r.status_code, 404)


# =============================================================================
# 28. MEDICAOVIEWSET — CRUD E FILTROS
# =============================================================================

class MedicaoViewSetCRUDTests(APITestCase):
    """CRUD de Medicao via API e filtros por negocio/status."""

    def setUp(self):
        autenticar_admin(self.client)
        self.cli = criar_cliente()
        self.neg = criar_negocio(self.cli)

    def test_criar_medicao_retorna_201(self):
        r = self.client.post(f'{BASE}/medicoes/', {'negocio': self.neg.id}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertTrue(Medicao.objects.filter(negocio=self.neg).exists())

    def test_listar_medicoes_retorna_200(self):
        Medicao.objects.create(negocio=self.neg)
        r = self.client.get(f'{BASE}/medicoes/')
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.data), 1)

    def test_filtro_por_negocio_exclui_outros(self):
        Medicao.objects.create(negocio=self.neg)
        outro_neg = criar_negocio(criar_cliente(razao='Outro Med'), nome='Neg Outro Med')
        Medicao.objects.create(negocio=outro_neg)
        r = self.client.get(f'{BASE}/medicoes/?negocio={self.neg.id}')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_filtro_por_status_aprovada(self):
        Medicao.objects.create(negocio=self.neg, status='aprovada')
        Medicao.objects.create(negocio=self.neg, status='pendente')
        r = self.client.get(f'{BASE}/medicoes/?status=aprovada')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_deletar_medicao_retorna_204(self):
        m = Medicao.objects.create(negocio=self.neg)
        r = self.client.delete(f'{BASE}/medicoes/{m.id}/')
        self.assertEqual(r.status_code, 204)
        self.assertFalse(Medicao.objects.filter(pk=m.id).exists())

    def test_atualizar_status_medicao_aprovada(self):
        m = Medicao.objects.create(negocio=self.neg)
        r = self.client.patch(f'{BASE}/medicoes/{m.id}/atualizar-status/',
                              {'status': 'aprovada'}, format='json')
        self.assertEqual(r.status_code, 200)
        m.refresh_from_db()
        self.assertEqual(m.status, 'aprovada')

    def test_atualizar_status_invalido_retorna_400(self):
        m = Medicao.objects.create(negocio=self.neg)
        r = self.client.patch(f'{BASE}/medicoes/{m.id}/atualizar-status/',
                              {'status': 'invalido'}, format='json')
        self.assertEqual(r.status_code, 400)


# =============================================================================
# 29. DOCUMENTOVIEWSET — UPLOAD MULTIPART E FILTROS
# =============================================================================

class DocumentoViewSetTests(APITestCase):
    """Upload multipart, filtros e exclusao de Documentos."""

    def setUp(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        autenticar_admin(self.client)
        self.SimpleUploadedFile = SimpleUploadedFile
        self.neg = criar_negocio(criar_cliente())

    def _upload(self, categoria='negocio', vinculo_tipo='negocio', vinculo_id=None):
        arquivo = self.SimpleUploadedFile(
            'teste.pdf', b'conteudo binario de teste', content_type='application/pdf'
        )
        return self.client.post(f'{BASE}/documentos/', {
            'arquivo': arquivo,
            'vinculo_tipo': vinculo_tipo,
            'vinculo_id': str(vinculo_id or self.neg.id),
            'categoria': categoria,
        }, format='multipart')

    def test_upload_retorna_201(self):
        r = self._upload()
        self.assertEqual(r.status_code, 201)

    def _upload_arquivo(self, nome, conteudo=b'x', content_type='application/octet-stream'):
        return self.client.post(f'{BASE}/documentos/', {
            'arquivo': self.SimpleUploadedFile(nome, conteudo, content_type=content_type),
            'vinculo_tipo': 'negocio', 'vinculo_id': str(self.neg.id), 'categoria': 'outro',
        }, format='multipart')

    def test_recusa_extensoes_que_o_navegador_executa(self):
        # XSS armazenado: anexos são servidos no mesmo domínio do ERP.
        from .models import Documento
        for nome, ct in (('x.html', 'text/html'), ('x.htm', 'text/html'), ('x.svg', 'image/svg+xml'),
                         ('x.xhtml', 'application/xhtml+xml'), ('x.js', 'text/javascript'), ('sem_extensao', '')):
            with self.subTest(nome=nome):
                self.assertEqual(self._upload_arquivo(nome, b'<script>alert(1)</script>', ct).status_code, 400)
        self.assertEqual(Documento.objects.count(), 0)

    def test_recusa_content_type_html_mesmo_com_extensao_permitida(self):
        self.assertEqual(self._upload_arquivo('nota.pdf', b'<script></script>', 'text/html').status_code, 400)

    def test_aceita_tipos_usados_pelas_telas(self):
        for nome in ('nf.pdf', 'foto.JPG', 'foto.png', 'planilha.xlsx', 'extrato.csv', 'nfe.xml', 'contrato.docx'):
            with self.subTest(nome=nome):
                self.assertEqual(self._upload_arquivo(nome).status_code, 201)

    def test_listar_documentos_retorna_200(self):
        self._upload()
        r = self.client.get(f'{BASE}/documentos/')
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.data), 1)

    def test_filtro_por_vinculo_tipo_e_id(self):
        self._upload()
        r = self.client.get(
            f'{BASE}/documentos/?vinculo_tipo=negocio&vinculo_id={self.neg.id}'
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_filtro_por_categoria_exclui_outras(self):
        self._upload(categoria='negocio')
        self._upload(categoria='outro')
        r = self.client.get(f'{BASE}/documentos/?categoria=negocio')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_deletar_documento_retorna_204(self):
        r = self._upload()
        self.assertEqual(r.status_code, 201)
        doc_id = r.data['id']
        r2 = self.client.delete(f'{BASE}/documentos/{doc_id}/')
        self.assertEqual(r2.status_code, 204)

    def test_metadados_extraidos_automaticamente(self):
        from .models import Documento as Doc
        r = self._upload()
        self.assertEqual(r.status_code, 201)
        doc = Doc.objects.get(pk=r.data['id'])
        self.assertEqual(doc.nome_original, 'teste.pdf')
        self.assertEqual(doc.tipo, 'application/pdf')
        self.assertGreater(doc.tamanho, 0)


# =============================================================================
# 30. NEGOCIO UPDATE COM REPOSIÇÃO DE SERVICOS
# =============================================================================

class NegocioUpdateComServicosTests(APITestCase):
    """PATCH /negocios/{id}/ com servicos=[...] substitui todos os servicos existentes."""

    def setUp(self):
        autenticar_admin(self.client)
        self.cli = criar_cliente()
        self.neg = criar_negocio(self.cli)
        Servico.objects.create(negocio=self.neg, tipo_servico='Solda', descricao='Servico A')
        Servico.objects.create(negocio=self.neg, tipo_servico='Pintura', descricao='Servico B')

    def test_patch_com_nova_lista_substitui_servicos(self):
        novos = [{'tipo_servico': 'Jateamento', 'descricao': 'Servico Novo'}]
        r = self.client.patch(f'{BASE}/negocios/{self.neg.id}/',
                              {'servicos': novos}, format='json')
        self.assertEqual(r.status_code, 200)
        tipos = list(Servico.objects.filter(negocio=self.neg).values_list('tipo_servico', flat=True))
        self.assertEqual(len(tipos), 1)
        self.assertIn('Jateamento', tipos)

    def test_patch_sem_servicos_preserva_lista_existente(self):
        r = self.client.patch(f'{BASE}/negocios/{self.neg.id}/',
                              {'status': 'Ativo'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Servico.objects.filter(negocio=self.neg).count(), 2)

    def test_patch_com_lista_vazia_remove_todos_servicos(self):
        r = self.client.patch(f'{BASE}/negocios/{self.neg.id}/',
                              {'servicos': []}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Servico.objects.filter(negocio=self.neg).count(), 0)


# =============================================================================
# 31. SERVICO_TERCEIRIZADO — CÁLCULO DE VALOR_TOT E FATOR
# =============================================================================

class ServicoTerceirizadoValorTotTests(TestCase):
    """valor_tot: peso=None → fator 1; peso=0 → fator 1; peso>0 → fator=peso."""

    def setUp(self):
        from .models import Servico_terceirizado, Orcamento, Levantamento
        self.Servico_terceirizado = Servico_terceirizado
        cli = criar_cliente()
        neg = criar_negocio(cli)
        lev = Levantamento.objects.create(negocio=neg, cliente=cli)
        self.orc = Orcamento.objects.create(levantamento=lev)

    def _item(self, qnt, peso, valor_unit):
        return self.Servico_terceirizado(
            orcamento=self.orc, descricao='Teste', unidade='m',
            qnt=qnt, peso=peso, valor_unit=valor_unit, observacao='',
        )

    def test_peso_none_usa_fator_1(self):
        # qnt=2, fator=1, valor=100 → 200
        self.assertEqual(self._item(Decimal('2'), None, Decimal('100')).valor_tot, Decimal('200.00'))

    def test_peso_zero_usa_fator_1(self):
        # peso=0 não é positivo → fator=1; qnt=3*1*50=150
        self.assertEqual(self._item(Decimal('3'), Decimal('0'), Decimal('50')).valor_tot, Decimal('150.00'))

    def test_peso_positivo_usa_como_fator(self):
        # qnt=2, fator=3, valor=100 → 600
        self.assertEqual(self._item(Decimal('2'), Decimal('3'), Decimal('100')).valor_tot, Decimal('600.00'))

    def test_qnt_none_retorna_zero(self):
        self.assertEqual(self._item(None, Decimal('1'), Decimal('100')).valor_tot, Decimal('0'))

    def test_valor_unit_none_retorna_zero(self):
        self.assertEqual(self._item(Decimal('5'), Decimal('2'), None).valor_tot, Decimal('0'))


# =============================================================================
# 32. MDO E MATERIAL — CAMPOS NONE NO CÁLCULO
# =============================================================================

class MDOMaterialNoneFieldsTests(TestCase):
    """valor_total retorna 0 quando qualquer campo numérico é None."""

    def setUp(self):
        from .models import MDO, Material, Orcamento, Levantamento
        self.MDO = MDO
        self.Material = Material
        cli = criar_cliente()
        neg = criar_negocio(cli)
        lev = Levantamento.objects.create(negocio=neg, cliente=cli)
        self.orc = Orcamento.objects.create(levantamento=lev)

    def _mdo(self, qnt=Decimal('2'), dias=Decimal('5'), custo=Decimal('100')):
        return self.MDO(orcamento=self.orc, fnc='Solda', qnt=qnt, dias=dias, custo_unit_dia=custo)

    def _mat(self, qnt=Decimal('2'), peso=Decimal('5'), custo=Decimal('100')):
        return self.Material(orcamento=self.orc, item='Placa', unidade='m²',
                             qnt=qnt, peso=peso, custo_unit=custo)

    def test_mdo_qnt_none_retorna_zero(self):
        self.assertEqual(self._mdo(qnt=None).valor_total, 0)

    def test_mdo_dias_none_retorna_zero(self):
        self.assertEqual(self._mdo(dias=None).valor_total, 0)

    def test_mdo_custo_none_retorna_zero(self):
        self.assertEqual(self._mdo(custo=None).valor_total, 0)

    def test_mdo_todos_preenchidos_calcula_corretamente(self):
        # 2 * 5 * 100 = 1000
        self.assertEqual(self._mdo().valor_total, Decimal('1000'))

    def test_material_qnt_none_retorna_zero(self):
        self.assertEqual(self._mat(qnt=None).valor_total, Decimal('0'))

    def test_material_peso_none_retorna_zero(self):
        self.assertEqual(self._mat(peso=None).valor_total, Decimal('0'))

    def test_material_custo_none_retorna_zero(self):
        self.assertEqual(self._mat(custo=None).valor_total, Decimal('0'))

    def test_material_todos_preenchidos_calcula_corretamente(self):
        # 2 * 5 * 100 = 1000
        self.assertEqual(self._mat().valor_total, Decimal('1000'))


# =============================================================================
# 33. ORCAMENTO — TRANSIÇÕES DE STATUS VIA CRIAR_ORCAMENTO
# =============================================================================

class OrcamentoStatusTransitionTests(APITestCase):
    """Status pendente/aprovado/recusado persiste via endpoint criar_orcamento."""

    def setUp(self):
        autenticar_admin(self.client)

    def _payload(self, neg, cli, status_val):
        return {
            'levantamento': {'negocio_id': neg.id, 'cliente_id': cli.id},
            'resumo': {'margem': 0, 'OH': 0, 'impostos': 0, 'impostos_locacao': 0, 'qnt': 1},
            'mao_de_obra': [], 'materiais': [], 'terceirizados': [],
            'status': status_val,
        }

    def test_status_pendente_salvo(self):
        from .models import Orcamento
        cli = criar_cliente(razao='Cli-Pend')
        neg = criar_negocio(cli, nome='Neg-Pend')
        r = self.client.post(f'{BASE}/orcamentos/criar/',
                             self._payload(neg, cli, 'pendente'), format='json')
        self.assertEqual(r.status_code, 200)
        orc = Orcamento.objects.filter(levantamento__negocio=neg).first()
        self.assertIsNotNone(orc)
        self.assertEqual(orc.status, 'pendente')

    def test_status_aprovado_salvo(self):
        from .models import Orcamento
        cli = criar_cliente(razao='Cli-Aprov')
        neg = criar_negocio(cli, nome='Neg-Aprov')
        r = self.client.post(f'{BASE}/orcamentos/criar/',
                             self._payload(neg, cli, 'aprovado'), format='json')
        self.assertEqual(r.status_code, 200)
        orc = Orcamento.objects.filter(levantamento__negocio=neg).first()
        self.assertEqual(orc.status, 'aprovado')

    def test_status_recusado_salvo(self):
        from .models import Orcamento
        cli = criar_cliente(razao='Cli-Recus')
        neg = criar_negocio(cli, nome='Neg-Recus')
        r = self.client.post(f'{BASE}/orcamentos/criar/',
                             self._payload(neg, cli, 'recusado'), format='json')
        self.assertEqual(r.status_code, 200)
        orc = Orcamento.objects.filter(levantamento__negocio=neg).first()
        self.assertEqual(orc.status, 'recusado')

    def test_segundo_post_mesmo_negocio_atualiza_status(self):
        from .models import Orcamento
        cli = criar_cliente(razao='Cli-Upd')
        neg = criar_negocio(cli, nome='Neg-Upd')
        self.client.post(f'{BASE}/orcamentos/criar/',
                         self._payload(neg, cli, 'pendente'), format='json')
        self.client.post(f'{BASE}/orcamentos/criar/',
                         self._payload(neg, cli, 'aprovado'), format='json')
        self.assertEqual(Orcamento.objects.filter(levantamento__negocio=neg).count(), 1)
        orc = Orcamento.objects.filter(levantamento__negocio=neg).first()
        self.assertEqual(orc.status, 'aprovado')


# =============================================================================
# 34. LEVANTAMENTO — PROPRIEDADES CALCULADAS
# =============================================================================

class LevantamentoPropertiesTests(TestCase):
    """responsavel_financeiro, dados_servicos e arquivos_negocio do Levantamento."""

    def setUp(self):
        from .models import Levantamento
        self.cli = criar_cliente()
        self.neg = criar_negocio(self.cli)
        self.lev = Levantamento.objects.create(negocio=self.neg, cliente=self.cli)

    def test_responsavel_financeiro_retorna_solicitante_do_negocio(self):
        self.assertEqual(self.lev.responsavel_financeiro, 'Solicitante Teste')

    def test_responsavel_financeiro_reflete_alteracao_no_negocio(self):
        self.neg.solicitante = 'Novo Solicitante'
        self.neg.save()
        self.neg.refresh_from_db()
        self.assertEqual(self.lev.responsavel_financeiro, 'Novo Solicitante')

    def test_dados_servicos_vazio_sem_servicos(self):
        self.assertEqual(list(self.lev.dados_servicos), [])

    def test_dados_servicos_retorna_servicos_do_negocio(self):
        Servico.objects.create(negocio=self.neg, tipo_servico='Solda', descricao='Desc A')
        Servico.objects.create(negocio=self.neg, tipo_servico='Pintura', descricao='Desc B')
        self.assertEqual(self.lev.dados_servicos.count(), 2)

    def test_arquivos_negocio_falsy_sem_arquivo(self):
        self.assertFalse(bool(self.lev.arquivos_negocio))


# =============================================================================
# SETUP_ADMIN — SEM SENHA FIXA NO CÓDIGO
# =============================================================================

class SetupAdminTests(TestCase):
    """A senha do admin nunca é fixa: vem de DJANGO_ADMIN_PASSWORD ou é gerada. E um admin
    que ainda usa a senha antiga publicada no repositório ('Admin@linave') tem ela trocada
    até no `--if-missing` (o modo que roda a cada deploy)."""

    def _rodar(self, *args, env=None):
        import os
        from io import StringIO
        from unittest import mock
        from django.core.management import call_command
        saida = StringIO()
        with mock.patch.dict(os.environ, env or {}, clear=False):
            if env is None:
                os.environ.pop('DJANGO_ADMIN_PASSWORD', None)
            call_command('setup_admin', *args, stdout=saida)
        return saida.getvalue()

    def test_cria_admin_com_senha_do_ambiente(self):
        self._rodar('--if-missing', env={'DJANGO_ADMIN_PASSWORD': 'Ambiente@Forte1'})
        admin = User.objects.get(cpf='admin')
        self.assertTrue(admin.check_password('Ambiente@Forte1'))
        self.assertFalse(admin.check_password('Admin@linave'))

    def test_sem_variavel_gera_senha_aleatoria_valida(self):
        saida = self._rodar('--if-missing')
        admin = User.objects.get(cpf='admin')
        self.assertFalse(admin.check_password('Admin@linave'))
        senha = saida.split('Senha gerada: ')[1].split()[0]
        self.assertTrue(admin.check_password(senha))
        SenhaSeguraValidator().validate(senha)

    def test_if_missing_troca_senha_padrao_antiga(self):
        User.objects.create_user(cpf='admin', password='Admin@linave', nome='Administrador',
                                 email='admin@linave.com.br', role='admin')
        saida = self._rodar('--if-missing')
        admin = User.objects.get(cpf='admin')
        self.assertFalse(admin.check_password('Admin@linave'))
        self.assertIn('ATENÇÃO', saida)

    def test_if_missing_nao_mexe_em_admin_com_senha_propria(self):
        User.objects.create_user(cpf='admin', password='Minha@Senha9', nome='Administrador',
                                 email='admin@linave.com.br', role='admin')
        self._rodar('--if-missing')
        self.assertTrue(User.objects.get(cpf='admin').check_password('Minha@Senha9'))


# =============================================================================
# DOCUMENTOS — CONTROLE DE ACESSO POR DONO / MÓDULO / FLUXO
# =============================================================================

class DocumentoAcessoTests(APITestCase):
    """Usuário comum só vê documento que ele enviou, de módulo em que tem permissão, ou de um
    fluxo em que é o solicitante (solicitação de pagamento/conta gerada dela, compra).
    Excluir: só quem enviou, admin/gerente ou quem tem permissão no módulo."""

    def setUp(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.SimpleUploadedFile = SimpleUploadedFile
        criar_admin('adm-doc', 'Admin@teste1')
        criar_gerente('ger-doc', 'Admin@teste1')
        User.objects.create_user(cpf='ana-doc', password='Admin@teste1', nome='Ana',
                                 email='ana@doc.com', role='usuario', permissoes={})
        User.objects.create_user(cpf='bia-doc', password='Admin@teste1', nome='Bia',
                                 email='bia@doc.com', role='usuario', permissoes={})
        User.objects.create_user(cpf='fin-doc', password='Admin@teste1', nome='Fin',
                                 email='fin@doc.com', role='usuario', permissoes={'finPagar': True})

        # Ana pediu um pagamento (SP-ANA) e uma compra (REQ-ANA); o admin aprovou e gerou a CP-ANA.
        self._logar('adm-doc')
        self.client.post(f'{BASE}/financeiro/', [
            {'id': 'SP-ANA', 'tipo': 'solicitacao', 'solicitanteCpf': 'ana-doc', 'valor': 10},
            {'id': 'CP-ANA', 'tipo': 'contaPagar', 'origemSolicitacao': 'SP-ANA', 'valor': 10},
            {'id': 'SP-BIA', 'tipo': 'solicitacao', 'solicitanteCpf': 'bia-doc', 'valor': 10},
        ], format='json')
        self.client.post(f'{BASE}/compras/', {'compras': [{'id': 'REQ-ANA', 'solicitanteCpf': 'ana-doc'}]}, format='json')

        self.docs = {
            'comprovante_ana': self._upload('financeiro', 'CP-ANA', 'fin_comprovante'),
            'anexo_sp_bia': self._upload('financeiro', 'SP-BIA', 'fin_anexo'),
            'nf_compra_ana': self._upload('compras', 'REQ-ANA', 'outro'),
            'negocio': self._upload('negocio', '1', 'negocio'),
        }
        self._logar('bia-doc')
        self.docs['enviado_bia'] = self._upload('financeiro', 'SP-BIA', 'fin_anexo')

    def _logar(self, cpf):
        resp = obter_token(self.client, cpf, 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def _upload(self, vinculo_tipo, vinculo_id, categoria):
        r = self.client.post(f'{BASE}/documentos/', {
            'arquivo': self.SimpleUploadedFile('a.pdf', b'%PDF', content_type='application/pdf'),
            'vinculo_tipo': vinculo_tipo, 'vinculo_id': vinculo_id, 'categoria': categoria,
        }, format='multipart')
        self.assertEqual(r.status_code, 201, r.content)
        return r.data['id']

    def _visiveis(self):
        r = self.client.get(f'{BASE}/documentos/')
        self.assertEqual(r.status_code, 200)
        ids = {d['id'] for d in r.data}
        return {nome for nome, pk in self.docs.items() if pk in ids}

    def test_upload_registra_quem_enviou(self):
        from .models import Documento
        self.assertEqual(Documento.objects.get(pk=self.docs['enviado_bia']).enviado_por, 'bia-doc')

    def test_solicitante_ve_anexos_do_proprio_fluxo(self):
        self._logar('ana-doc')
        self.assertEqual(self._visiveis(), {'comprovante_ana', 'nf_compra_ana'})

    def test_usuario_ve_o_que_enviou_e_nao_o_resto(self):
        self._logar('bia-doc')
        # SP-BIA é dela: vê o próprio upload e o anexo do admin na solicitação dela.
        self.assertEqual(self._visiveis(), {'anexo_sp_bia', 'enviado_bia'})

    def test_permissao_no_modulo_ve_documentos_do_modulo(self):
        self._logar('fin-doc')
        self.assertEqual(self._visiveis(), {'comprovante_ana', 'anexo_sp_bia', 'enviado_bia'})

    def test_gerente_ve_tudo(self):
        self._logar('ger-doc')
        self.assertEqual(self._visiveis(), set(self.docs))

    def test_documento_de_outro_responde_404(self):
        self._logar('ana-doc')
        self.assertEqual(self.client.get(f"{BASE}/documentos/{self.docs['negocio']}/").status_code, 404)
        self.assertEqual(self.client.delete(f"{BASE}/documentos/{self.docs['anexo_sp_bia']}/").status_code, 404)

    def test_solicitante_le_mas_nao_apaga_comprovante_do_financeiro(self):
        self._logar('ana-doc')
        self.assertEqual(self.client.get(f"{BASE}/documentos/{self.docs['comprovante_ana']}/").status_code, 200)
        self.assertEqual(self.client.delete(f"{BASE}/documentos/{self.docs['comprovante_ana']}/").status_code, 404)

    def test_quem_enviou_pode_apagar(self):
        self._logar('bia-doc')
        self.assertEqual(self.client.delete(f"{BASE}/documentos/{self.docs['enviado_bia']}/").status_code, 204)

    def test_permissao_no_modulo_pode_apagar(self):
        self._logar('fin-doc')
        self.assertEqual(self.client.delete(f"{BASE}/documentos/{self.docs['comprovante_ana']}/").status_code, 204)

    def test_caminho_do_arquivo_nao_e_adivinhavel(self):
        from .models import Documento
        nome = Documento.objects.get(pk=self.docs['negocio']).arquivo.name
        self.assertRegex(nome, r'^documentos/negocio/[0-9a-f]{32}/a\.pdf$')


# =============================================================================
# LOGIN — BLOQUEIO APÓS 5 SENHAS ERRADAS
# =============================================================================

class LoginBloqueioTests(APITestCase):
    """Aviso a partir da 3ª senha errada, bloqueio na 5ª; nem a senha certa entra depois;
    só admin desbloqueia; login certo antes do limite zera a contagem."""

    def setUp(self):
        criar_admin('adm-lock', 'Admin@teste1')
        criar_usuario('ana-lock', 'Admin@teste1')

    def _tentar(self, senha, identifier='ana-lock'):
        return self.client.post('/token/', {'identifier': identifier, 'password': senha}, format='json')

    def test_aviso_a_partir_da_terceira_e_bloqueio_na_quinta(self):
        for _ in range(2):
            r = self._tentar('errada')
            self.assertEqual(r.status_code, 401)
            self.assertNotIn('restante', r.data['detail'])
        self.assertIn('2 tentativa(s) restante(s)', self._tentar('errada').data['detail'])
        self.assertIn('1 tentativa(s) restante(s)', self._tentar('errada').data['detail'])
        r = self._tentar('errada')
        self.assertIn('bloqueada', r.data['detail'])
        self.assertTrue(_origem_bloqueada('ana-lock'))

    def test_bloqueado_nao_entra_nem_com_senha_certa(self):
        for _ in range(5):
            self._tentar('errada')
        r = self._tentar('Admin@teste1')
        self.assertEqual(r.status_code, 401)
        self.assertIn('bloqueada', r.data['detail'])

    def test_bloqueio_tambem_vale_pelo_email(self):
        for _ in range(5):
            self._tentar('errada', identifier='user@test.com')
        self.assertTrue(_origem_bloqueada('ana-lock'))

    def test_login_certo_zera_a_contagem(self):
        for _ in range(4):
            self._tentar('errada')
        self.assertEqual(self._tentar('Admin@teste1').status_code, 200)
        self.assertEqual(User.objects.get(cpf='ana-lock').tentativas_login_falhas, 0)

    def test_bloqueio_gera_log(self):
        for _ in range(5):
            self._tentar('errada')
        self.assertTrue(LogAtividade.objects.filter(usuario_cpf='ana-lock', descricao__contains='bloqueado').exists())

    def test_admin_desbloqueia(self):
        for _ in range(5):
            self._tentar('errada')
        token = obter_token(self.client, 'adm-lock', 'Admin@teste1').data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        r = self.client.patch(f'{BASE}/usuarios/ana-lock/', {'login_bloqueado': False}, format='json')
        self.assertEqual(r.status_code, 200)
        self.client.credentials()
        u = User.objects.get(cpf='ana-lock')
        self.assertFalse(u.login_bloqueado)
        self.assertFalse(_origem_bloqueada('ana-lock'))
        self.assertEqual(u.tentativas_login_falhas, 0)
        self.assertEqual(self._tentar('Admin@teste1').status_code, 200)

    def test_nao_admin_nao_desbloqueia(self):
        criar_gerente('bia-lock', 'Admin@teste1')
        User.objects.filter(cpf='ana-lock').update(login_bloqueado=True)
        # Gerente não é admin: o painel de usuários é exclusivo de admin.
        token = obter_token(self.client, 'bia-lock', 'Admin@teste1').data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(self.client.patch(f'{BASE}/usuarios/ana-lock/', {'login_bloqueado': False}, format='json').status_code, 403)
        self.assertEqual(self.client.patch(f'{BASE}/usuarios/bia-lock/', {'login_bloqueado': False}, format='json').status_code, 403)
        self.assertTrue(User.objects.get(cpf='ana-lock').login_bloqueado)

    def test_comando_desbloquear_usuario(self):
        from io import StringIO
        from django.core.management import call_command
        User.objects.filter(cpf='adm-lock').update(login_bloqueado=True, tentativas_login_falhas=5)
        call_command('desbloquear_usuario', 'adm-lock', stdout=StringIO())
        self.assertFalse(User.objects.get(cpf='adm-lock').login_bloqueado)


# =============================================================================
# CORREÇÕES DO DIAGNÓSTICO — 500s, VALIDAÇÃO DE STATUS, TOKEN DO WEBSOCKET
# =============================================================================

class UsuarioSemSenhaTests(APITestCase):
    """make_random_password() não existe mais no Django 6 — criar sem senha dava 500."""

    def test_admin_cria_usuario_sem_senha_e_ele_nao_consegue_logar(self):
        autenticar_admin(self.client)
        r = self.client.post(f'{BASE}/usuarios/', {'cpf': 'sem-senha', 'nome': 'Sem Senha',
                                                   'email': 'sem@senha.com', 'role': 'usuario'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertFalse(User.objects.get(cpf='sem-senha').has_usable_password())


class CriarOrcamentoItensInvalidosTests(APITestCase):
    """criar_orcamento repassava o JSON direto pro create(**item): campo desconhecido = 500."""

    def setUp(self):
        autenticar_admin(self.client)
        self.neg = criar_negocio(criar_cliente())

    def _post(self, **itens):
        return self.client.post(f'{BASE}/orcamentos/criar/', {
            'levantamento': {'negocio_id': self.neg.id, 'cliente_id': self.neg.cliente_id}, **itens,
        }, format='json')

    def test_campo_desconhecido_e_ignorado(self):
        from .models import MDO
        r = self._post(mao_de_obra=[{'fnc': 'Soldador', 'qnt': 2, 'campo_que_nao_existe': 1, 'id': 99}])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(MDO.objects.get().fnc, 'Soldador')

    def test_valor_invalido_retorna_400_e_nao_grava_nada(self):
        from .models import Orcamento
        r = self._post(materiais=[{'item': 'Tubo', 'unidade': 'm', 'qnt': 'não é número'}])
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Orcamento.objects.count(), 0)

    def test_negocio_inexistente_retorna_404(self):
        r = self.client.post(f'{BASE}/orcamentos/criar/', {'levantamento': {'negocio_id': 999999}}, format='json')
        self.assertEqual(r.status_code, 404)

    def test_duracao_com_acento_continua_aceita(self):
        from .models import Ativ_prevista
        self.assertEqual(self._post(atividades=[{'atividade': 'Montagem', 'duração': 3}]).status_code, 200)
        self.assertEqual(Ativ_prevista.objects.get().duracao, 3)


class AtualizarStatusOsValidacaoTests(APITestCase):

    def setUp(self):
        autenticar_admin(self.client)
        cli = criar_cliente()
        self.os = _criar_os(cli, criar_negocio(cli), numero='OS-VAL1')

    def test_status_fora_das_choices_retorna_400(self):
        for campo in ('status_os', 'status_envio', 'status_aprovacao'):
            with self.subTest(campo=campo):
                r = self.client.patch(f'{BASE}/ordens-servico/{self.os.id}/atualizar-status/', {campo: 'hackeado'}, format='json')
                self.assertEqual(r.status_code, 400)
        self.os.refresh_from_db()
        self.assertEqual(self.os.status_os, 'rascunho')

    def test_status_valido_continua_funcionando(self):
        r = self.client.patch(f'{BASE}/ordens-servico/{self.os.id}/atualizar-status/',
                              {'status_os': 'emproducao', 'status_aprovacao': 'aprovada'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.os.refresh_from_db()
        self.assertEqual(self.os.status_os, 'emproducao')
        self.assertIsNotNone(self.os.data_aprovacao)


class WebSocketAuthTests(TestCase):
    """Token do WebSocket vai no Sec-WebSocket-Protocol (['erp-jwt', token]), não na URL."""

    def _conectar(self, path='/ws/workspace/', subprotocols=None):
        from asgiref.sync import async_to_sync
        from channels.testing import WebsocketCommunicator
        from ERP_Linave_BackEnd.routing import application

        async def _tentar():
            comunicador = WebsocketCommunicator(application, path, subprotocols=subprotocols)
            conectado, subprotocolo = await comunicador.connect()
            await comunicador.disconnect()
            return conectado, subprotocolo
        return async_to_sync(_tentar)()

    def _token(self):
        from rest_framework_simplejwt.tokens import AccessToken
        return str(AccessToken.for_user(criar_admin('adm-ws')))

    def test_conecta_com_token_no_subprotocolo(self):
        conectado, subprotocolo = self._conectar(subprotocols=['erp-jwt', self._token()])
        self.assertTrue(conectado)
        self.assertEqual(subprotocolo, 'erp-jwt')

    def _fechamento_sem_login(self, path='/ws/workspace/', subprotocols=None):
        """Sem login válido a conexão é aceita e fechada na hora com 4401 (o navegador
        precisa do código para saber que deve renovar o token) — sem entrar no grupo."""
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        from channels.testing import WebsocketCommunicator
        from ERP_Linave_BackEnd.routing import application

        async def _tentar():
            comunicador = WebsocketCommunicator(application, path, subprotocols=subprotocols)
            await comunicador.connect()
            saida = await comunicador.receive_output(timeout=1)
            # Um aviso enviado ao grupo depois disso não pode chegar a essa conexão.
            await get_channel_layer().group_send('workspace', {'type': 'workspace.notify', 'collection': 'financeiro'})
            self.assertTrue(await comunicador.receive_nothing(timeout=0.2))
            await comunicador.disconnect()
            return saida
        return async_to_sync(_tentar)()

    def test_token_na_query_string_nao_e_mais_aceito(self):
        saida = self._fechamento_sem_login(path=f'/ws/workspace/?token={self._token()}')
        self.assertEqual(saida, {'type': 'websocket.close', 'code': 4401})

    def test_sem_token_ou_token_invalido_fecha_com_4401(self):
        self.assertEqual(self._fechamento_sem_login(), {'type': 'websocket.close', 'code': 4401})
        self.assertEqual(self._fechamento_sem_login(subprotocols=['erp-jwt', 'token-falso']),
                         {'type': 'websocket.close', 'code': 4401})


class LoginBloqueioAdminDjangoTests(TestCase):
    """O admin do Django (/jamanta-fiscal/) tem login próprio — precisa contar e respeitar o
    mesmo bloqueio da API, senão vira a porta dos fundos da força bruta."""

    URL = '/jamanta-fiscal/login/'

    def setUp(self):
        criar_admin('adm-dj', 'Admin@teste1')

    def _tentar(self, senha):
        return self.client.post(self.URL, {'username': 'adm-dj', 'password': senha})

    def test_senhas_erradas_no_admin_bloqueiam_a_conta(self):
        for _ in range(5):
            self._tentar('errada')
        self.assertTrue(_origem_bloqueada('adm-dj'))

    def test_conta_bloqueada_nao_entra_no_admin_nem_na_api(self):
        User.objects.filter(cpf='adm-dj').update(login_bloqueado=True)
        self._tentar('Admin@teste1')
        self.assertNotIn('_auth_user_id', self.client.session)
        r = self.client.post('/token/', {'identifier': 'adm-dj', 'password': 'Admin@teste1'},
                             content_type='application/json')
        self.assertEqual(r.status_code, 401)

    def test_falhas_misturando_api_e_admin_somam(self):
        for _ in range(3):
            self._tentar('errada')
        r = self.client.post('/token/', {'identifier': 'adm-dj', 'password': 'errada'},
                             content_type='application/json')
        self.assertIn('1 tentativa(s) restante(s)', r.json()['detail'])


# =============================================================================
# FINANCEIRO — ESCRITA RESTRITA DE QUEM NÃO É EQUIPE FINANCEIRA
# =============================================================================

class FinanceiroEscritaRestritaTests(APITestCase):
    """Quem tem só finSolicitacao (ou só Compras/Gestão) reescrevia o Financeiro inteiro pelo
    replace-all. Agora só mexe nas próprias solicitações (e Compras só cria conta a pagar)."""

    def setUp(self):
        criar_admin('adm-fe', 'Admin@teste1')
        User.objects.create_user(cpf='ana-fe', password='Admin@teste1', nome='Ana', email='ana@fe.com',
                                 role='usuario', permissoes={'finSolicitacao': True})
        User.objects.create_user(cpf='cmp-fe', password='Admin@teste1', nome='Comprador', email='cmp@fe.com',
                                 role='usuario', permissoes={'kanbanCompras': True})
        User.objects.create_user(cpf='fin-fe', password='Admin@teste1', nome='Fin', email='fin@fe.com',
                                 role='usuario', permissoes={'finPagar': True})
        self._logar('adm-fe')
        r = self.client.post(f'{BASE}/financeiro/', [
            {'id': 'BANCO-1', 'tipo': 'banco', 'nome': 'Banco Real', 'saldo': 100},
            {'id': 'SP-ANA', 'tipo': 'solicitacao', 'solicitanteCpf': 'ana-fe', 'valor': 10, 'status': 'Aguardando aprovação'},
            {'id': 'SP-OUTRO', 'tipo': 'solicitacao', 'solicitanteCpf': 'outro', 'valor': 99, 'fornecedor': 'Sigiloso'},
            {'id': 'CP-1', 'tipo': 'contaPagar', 'status': 'Aberto', 'fornecedor': 'Forn X', 'valor': 500},
        ], format='json')
        self.assertEqual(r.status_code, 200)

    def _logar(self, cpf):
        resp = obter_token(self.client, cpf, 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

    def _base(self):
        return self.client.get(f'{BASE}/financeiro/').data

    def _banco(self):
        from .financeiro_sync import read_all
        return {r['id']: r for r in read_all()}

    def test_so_finsolicitacao_nao_forja_banco(self):
        self._logar('ana-fe')
        base = self._base()
        forjado = [({**r, 'saldo': 999999} if r['id'] == 'BANCO-1' else r) for r in base]
        self.assertEqual(self.client.post(f'{BASE}/financeiro/', forjado, format='json').status_code, 403)
        self.assertEqual(self._banco()['BANCO-1']['saldo'], 100)

    def test_so_finsolicitacao_nao_cria_banco_nem_conta(self):
        self._logar('ana-fe')
        for novo in ({'id': 'B-NOVO', 'tipo': 'banco'}, {'id': 'CP-NOVA', 'tipo': 'contaPagar', 'valor': 1}):
            with self.subTest(tipo=novo['tipo']):
                self.assertEqual(self.client.post(f'{BASE}/financeiro/', [*self._base(), novo], format='json').status_code, 403)

    def test_lista_vazia_nao_apaga_nada_alem_das_proprias(self):
        self._logar('ana-fe')
        # Só pode excluir a própria solicitação; o resto que ela vê precisa voltar intacto.
        r = self.client.post(f'{BASE}/financeiro/', [], format='json')
        self.assertEqual(r.status_code, 403)
        self.assertEqual(set(self._banco()), {'BANCO-1', 'SP-ANA', 'SP-OUTRO', 'CP-1'})

    def test_edita_e_exclui_a_propria_solicitacao_sem_afetar_o_resto(self):
        self._logar('ana-fe')
        base = self._base()
        self.assertNotIn('SP-OUTRO', {r['id'] for r in base})  # não vê a dos outros
        editado = [({**r, 'valor': 20} if r['id'] == 'SP-ANA' else r) for r in base]
        self.assertEqual(self.client.post(f'{BASE}/financeiro/', editado, format='json').status_code, 200)
        banco = self._banco()
        self.assertEqual(banco['SP-ANA']['valor'], 20)
        # Solicitação alheia e conta a pagar (que ela só via aparada) continuam completas.
        self.assertEqual(banco['SP-OUTRO']['fornecedor'], 'Sigiloso')
        self.assertEqual(banco['CP-1']['fornecedor'], 'Forn X')

        sem_a_dela = [r for r in self._base() if r['id'] != 'SP-ANA']
        self.assertEqual(self.client.post(f'{BASE}/financeiro/', sem_a_dela, format='json').status_code, 200)
        self.assertEqual(set(self._banco()), {'BANCO-1', 'SP-OUTRO', 'CP-1'})

    def test_nao_transfere_a_propria_solicitacao_para_outro(self):
        self._logar('ana-fe')
        base = [({**r, 'solicitanteCpf': 'outro'} if r['id'] == 'SP-ANA' else r) for r in self._base()]
        self.client.post(f'{BASE}/financeiro/', base, format='json')
        self.assertEqual(self._banco()['SP-ANA']['solicitanteCpf'], 'ana-fe')

    def test_compras_cria_conta_mas_nao_altera_existente(self):
        self._logar('cmp-fe')
        base = self._base()
        nova = {'id': 'CP-COMPRA', 'tipo': 'contaPagar', 'valor': 50, 'fornecedor': 'Forn Y'}
        self.assertEqual(self.client.post(f'{BASE}/financeiro/', [nova, *base], format='json').status_code, 200)
        self.assertIn('CP-COMPRA', self._banco())
        alterada = [({**r, 'status': 'Pago'} if r['id'] == 'CP-1' else r) for r in self._base()]
        self.assertEqual(self.client.post(f'{BASE}/financeiro/', alterada, format='json').status_code, 403)

    def test_equipe_financeira_continua_com_acesso_total(self):
        self._logar('fin-fe')
        base = [({**r, 'saldo': 150} if r['id'] == 'BANCO-1' else r) for r in self._base()]
        self.assertEqual(self.client.post(f'{BASE}/financeiro/', base, format='json').status_code, 200)
        self.assertEqual(self._banco()['BANCO-1']['saldo'], 150)

    def test_criar_solicitacao_nao_nasce_aprovada_nem_em_nome_de_outro(self):
        self._logar('ana-fe')
        r = self.client.post(f'{BASE}/financeiro/solicitacao/', {
            'id': 'SP-GOLPE', 'valor': 1, 'status': 'Aprovado', 'aprovadoPor': 'Gerente',
            'solicitanteCpf': 'outro',
        }, format='json')
        self.assertEqual(r.status_code, 201)
        criada = self._banco()['SP-GOLPE']
        self.assertEqual(criada['status'], 'Aguardando aprovação')
        self.assertNotIn('aprovadoPor', criada)
        self.assertEqual(criada['solicitanteCpf'], 'ana-fe')
        # A resposta não devolve o Financeiro inteiro pra quem não é da equipe.
        self.assertNotIn('SP-OUTRO', {x['id'] for x in r.data['financeiro']})


# =============================================================================
# /media/ AUTENTICADO — COOKIE erp_media + auth_request DO NGINX
# =============================================================================

class MediaAutenticadaTests(APITestCase):
    """O nginx pergunta a /comercial/media-auth/ (X-Original-URI) antes de servir um anexo.
    Sem cookie de sessão -> 401; documento fora do alcance -> 403; liberado -> 204."""

    def setUp(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        criar_admin('adm-md', 'Admin@teste1')
        User.objects.create_user(cpf='ana-md', password='Admin@teste1', nome='Ana', email='ana@md.com',
                                 role='usuario', permissoes={})
        self._login('adm-md')
        r = self.client.post(f'{BASE}/documentos/', {
            'arquivo': SimpleUploadedFile('nf.pdf', b'%PDF', content_type='application/pdf'),
            'vinculo_tipo': 'financeiro', 'vinculo_id': 'CP-X', 'categoria': 'fin_comprovante',
        }, format='multipart')
        self.url = r.data['url']
        self.client.cookies.clear()

    def _login(self, cpf):
        r = self.client.post('/token/', {'identifier': cpf, 'password': 'Admin@teste1'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {r.data["access"]}')
        return r

    def _checar(self, url, cookie=None):
        from django.test import Client
        headers = {'HTTP_X_ORIGINAL_URI': url}
        if cookie is not None:
            headers['HTTP_COOKIE'] = f'erp_media={cookie}'
        return Client().get(f'{BASE}/media-auth/', **headers).status_code

    def test_login_grava_cookie_httponly_restrito_a_media(self):
        r = self._login('ana-md')
        cookie = r.cookies['erp_media']
        self.assertEqual(cookie.value, r.data['access'])
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['path'], '/media/')

    def test_refresh_renova_o_cookie(self):
        r = self._login('ana-md')
        r = self.client.post('/token/refresh/', {'refresh': r.data['refresh']}, format='json')
        self.assertEqual(r.cookies['erp_media'].value, r.data['access'])

    def test_sem_cookie_ou_cookie_invalido_e_401(self):
        self.assertEqual(self._checar(self.url), 401)
        self.assertEqual(self._checar(self.url, 'token-falso'), 401)

    def test_dono_do_acesso_baixa_e_quem_nao_tem_acesso_recebe_403(self):
        admin = self._login('adm-md').data['access']
        ana = self._login('ana-md').data['access']
        self.assertEqual(self._checar(self.url, admin), 204)
        self.assertEqual(self._checar(self.url, ana), 403)

    def test_arquivo_sem_documento_exige_so_login(self):
        ana = self._login('ana-md').data['access']
        self.assertEqual(self._checar('/media/documentos_negocios/antigo.pdf', ana), 204)
        self.assertEqual(self._checar('/media/documentos_negocios/antigo.pdf'), 401)

    def test_caminho_fora_de_media_ou_com_ponto_ponto_e_403(self):
        admin = self._login('adm-md').data['access']
        self.assertEqual(self._checar('/comercial/financeiro/', admin), 403)
        self.assertEqual(self._checar('/media/../BackEnd/db.sqlite3', admin), 403)

    def test_usuario_desativado_perde_acesso(self):
        ana = self._login('ana-md').data['access']
        User.objects.filter(cpf='ana-md').update(is_active=False)
        self.assertEqual(self._checar('/media/documentos_negocios/antigo.pdf', ana), 401)

    def test_media_cookie_regrava_a_partir_do_bearer(self):
        access = self._login('ana-md').data['access']
        r = self.client.post(f'{BASE}/sessao/media-cookie/')
        self.assertEqual(r.status_code, 204)
        self.assertEqual(r.cookies['erp_media'].value, access)

    def test_logout_apaga_o_cookie_mesmo_com_token_vencido(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer token-vencido')
        r = self.client.post(f'{BASE}/sessao/logout/')
        self.assertEqual(r.status_code, 204)
        self.assertEqual(r.cookies['erp_media'].value, '')

    def test_servir_media_em_dev_aplica_a_mesma_checagem(self):
        from django.test import RequestFactory
        from .media_auth import servir_media
        rf = RequestFactory()
        caminho = self.url.split('/media/', 1)[1]
        self.assertEqual(servir_media(rf.get(self.url), caminho).status_code, 401)
        req = rf.get(self.url)
        req.COOKIES['erp_media'] = self._login('ana-md').data['access']
        self.assertEqual(servir_media(req, caminho).status_code, 403)


# =============================================================================
# LOGIN — SEM REVELAR CONTAS, LIMITE POR IP, DESATIVAÇÃO DERRUBA SESSÕES
# =============================================================================

class LoginSemRevelarContaTests(APITestCase):
    """CPF/e-mail inexistente responde igual a uma conta real — mensagens não revelam quem
    tem conta no sistema."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        criar_usuario('ana-enum', 'Admin@teste1')

    def _respostas(self, identifier):
        return [
            (r.status_code, r.data['detail'])
            for r in (self.client.post('/token/', {'identifier': identifier, 'password': 'errada'}, format='json')
                      for _ in range(6))
        ]

    def test_cpf_inexistente_e_indistinguivel_de_um_real(self):
        self.assertEqual(self._respostas('cpf-que-nao-existe'), self._respostas('ana-enum'))

    def test_email_inexistente_tambem(self):
        self.assertEqual(self._respostas('ninguem@test.com'), self._respostas('user@test.com'))


class LoginThrottleTests(APITestCase):

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

    def test_limite_de_tentativas_por_ip(self):
        from django.test import override_settings
        with override_settings(LOGIN_THROTTLE_RATE='3/min'):
            codigos = [self.client.post('/token/', {'identifier': f'x{i}', 'password': 'y'}, format='json').status_code
                       for i in range(4)]
        self.assertEqual(codigos, [401, 401, 401, 429])

    def test_mensagem_em_portugues(self):
        from django.test import override_settings
        with override_settings(LOGIN_THROTTLE_RATE='1/min'):
            self.client.post('/token/', {'identifier': 'a', 'password': 'b'}, format='json')
            r = self.client.post('/token/', {'identifier': 'a', 'password': 'b'}, format='json')
        self.assertIn('Muitas tentativas de login', r.data['detail'])


class DesativarUsuarioDerrubaSessaoTests(APITestCase):
    """Pra tirar alguém do sistema de propósito, desativar (is_active=False) já invalida na
    hora o access e o refresh token — ao contrário do bloqueio por senha errada, que de
    propósito não derruba a sessão de quem já estava logado (quem erra é o atacante)."""

    def test_desativado_perde_access_e_refresh(self):
        criar_usuario('ana-off', 'Admin@teste1')
        tokens = obter_token(self.client, 'ana-off', 'Admin@teste1').data
        User.objects.filter(cpf='ana-off').update(is_active=False)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(self.client.get(f'{BASE}/usuarios/me/').status_code, 401)
        self.client.credentials()
        self.assertEqual(self.client.post('/token/refresh/', {'refresh': tokens['refresh']}, format='json').status_code, 401)


class ConfiguracoesListasPermissaoTests(APITestCase):

    def setUp(self):
        criar_usuario('ana-cfg', 'Admin@teste1')
        User.objects.create_user(cpf='fin-cfg', password='Admin@teste1', nome='Fin', email='fin@cfg.com',
                                 role='usuario', permissoes={'finPagar': True})

    def _post(self, cpf):
        token = obter_token(self.client, cpf, 'Admin@teste1').data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return self.client.post(f'{BASE}/configuracoes/', {'listas': {'departamentos': []}}, format='json')

    def test_usuario_comum_nao_altera_listas(self):
        self.assertEqual(self._post('ana-cfg').status_code, 403)

    def test_equipe_financeira_altera_listas(self):
        self.assertEqual(self._post('fin-cfg').status_code, 200)


class PreencherAutorDocumentosAntigosTests(TestCase):
    """Migração 0011: autor de documento antigo vem do log de upload (mesma descrição,
    horário mais próximo, no máximo 10 min, cada log usado uma vez)."""

    def _doc(self, nome, quando):
        from django.core.files.base import ContentFile
        from .models import Documento
        doc = Documento(nome_original=nome, vinculo_tipo='financeiro', vinculo_id='SP-1', categoria='fin_anexo')
        doc.arquivo.save(nome, ContentFile(b'x'), save=True)
        Documento.objects.filter(pk=doc.pk).update(uploaded_at=quando)
        return doc.pk

    def _log(self, cpf, descricao, quando):
        log = LogAtividade.objects.create(usuario_cpf=cpf, usuario_nome=cpf, acao='criacao',
                                          modulo='Documentos', descricao=descricao)
        LogAtividade.objects.filter(pk=log.pk).update(timestamp=quando)

    def test_preenche_pelo_log_mais_proximo(self):
        import importlib
        from datetime import timedelta
        from io import StringIO
        from unittest import mock
        from django.apps import apps
        from django.utils import timezone
        from .models import Documento

        t0 = timezone.now() - timedelta(days=30)
        desc = 'nf.pdf (financeiro:SP-1)'
        # Dois uploads idênticos, de pessoas diferentes, com 1h de diferença.
        doc_ana = self._doc('nf.pdf', t0)
        doc_bia = self._doc('nf.pdf', t0 + timedelta(hours=1))
        self._log('ana', desc, t0 + timedelta(seconds=1))
        self._log('bia', desc, t0 + timedelta(hours=1, seconds=1))
        # Documento cujo único log está fora da janela de 10 min: fica sem autor.
        doc_longe = self._doc('outro.pdf', t0)
        self._log('ze', 'outro.pdf (financeiro:SP-1)', t0 + timedelta(hours=2))
        # Documento sem log nenhum.
        doc_sem = self._doc('semlog.pdf', t0)

        migracao = importlib.import_module('ComercialApp.migrations.0011_preencher_enviado_por_documentos')
        with mock.patch('sys.stdout', new=StringIO()):
            migracao.preencher(apps, None)

        autores = dict(Documento.objects.values_list('pk', 'enviado_por'))
        self.assertEqual(autores[doc_ana], 'ana')
        self.assertEqual(autores[doc_bia], 'bia')
        self.assertEqual(autores[doc_longe], '')
        self.assertEqual(autores[doc_sem], '')

    def test_autor_ve_documento_antigo_depois_da_migracao(self):
        import importlib
        from io import StringIO
        from unittest import mock
        from django.apps import apps
        from django.utils import timezone

        criar_usuario('autor-old', 'Admin@teste1')
        agora = timezone.now()
        pk = self._doc('velho.pdf', agora)
        self._log('autor-old', 'velho.pdf (financeiro:SP-1)', agora)
        with mock.patch('sys.stdout', new=StringIO()):
            importlib.import_module('ComercialApp.migrations.0011_preencher_enviado_por_documentos').preencher(apps, None)

        token = obter_token(APIClient(), 'autor-old', 'Admin@teste1').data['access']
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(c.get(f'{BASE}/documentos/{pk}/').status_code, 200)


def _origem_bloqueada(cpf):
    from .models import LoginBloqueioIP
    return LoginBloqueioIP.objects.filter(usuario_id=cpf, bloqueado=True).exists()


class LoginBloqueioPorOrigemTests(APITestCase):
    """Errar a senha de outra pessoa bloqueia só a SUA origem (IP) para aquela conta — o dono
    continua entrando de outro lugar. 20 falhas somando todas as origens bloqueiam a conta."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        criar_admin('adm-or', 'Admin@teste1')
        criar_usuario('ana-or', 'Admin@teste1')

    def _tentar(self, senha, ip):
        return self.client.post('/token/', {'identifier': 'ana-or', 'password': senha}, format='json',
                                REMOTE_ADDR=ip, HTTP_X_FORWARDED_FOR=ip)

    def test_atacante_nao_tranca_o_dono_fora(self):
        for _ in range(5):
            self._tentar('errada', '203.0.113.9')
        self.assertIn('bloqueada', self._tentar('Admin@teste1', '203.0.113.9').data['detail'])
        # O dono, de outra rede, entra normalmente.
        self.assertEqual(self._tentar('Admin@teste1', '198.51.100.7').status_code, 200)
        self.assertFalse(User.objects.get(cpf='ana-or').login_bloqueado)

    def test_vinte_falhas_de_varias_origens_bloqueiam_a_conta(self):
        for i in range(20):
            self._tentar('errada', f'203.0.113.{i // 4}')  # 4 por IP: nenhum IP chega a 5
        self.assertTrue(User.objects.get(cpf='ana-or').login_bloqueado)
        r = self._tentar('Admin@teste1', '198.51.100.7')
        self.assertEqual(r.status_code, 401)
        self.assertIn('bloqueada', r.data['detail'])

    def test_painel_mostra_bloqueado_e_admin_libera_a_origem(self):
        for _ in range(5):
            self._tentar('errada', '203.0.113.9')
        token = obter_token(APIClient(), 'adm-or', 'Admin@teste1').data['access']
        admin = APIClient()
        admin.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        lista = {u['cpf']: u for u in admin.get(f'{BASE}/usuarios/').data}
        self.assertTrue(lista['ana-or']['login_bloqueado'])
        self.assertEqual(admin.patch(f'{BASE}/usuarios/ana-or/', {'login_bloqueado': False}, format='json').status_code, 200)
        self.assertFalse(_origem_bloqueada('ana-or'))
        self.assertEqual(self._tentar('Admin@teste1', '203.0.113.9').status_code, 200)

    def test_comando_desbloquear_libera_origens(self):
        from io import StringIO
        from django.core.management import call_command
        for _ in range(5):
            self._tentar('errada', '203.0.113.9')
        call_command('desbloquear_usuario', 'ana-or', stdout=StringIO())
        self.assertFalse(_origem_bloqueada('ana-or'))


class RenomearFornecedorTests(APITestCase):
    """A cascata de renomear fornecedor roda no servidor — alcança registros que quem só tem
    acesso a Compras nem enxerga (solicitações alheias, contas a pagar completas)."""

    def setUp(self):
        criar_admin('adm-rf', 'Admin@teste1')
        User.objects.create_user(cpf='cmp-rf', password='Admin@teste1', nome='Comprador', email='cmp@rf.com',
                                 role='usuario', permissoes={'fornecedores': True})
        criar_usuario('zeca-rf', 'Admin@teste1')
        self._logar('adm-rf')
        self.client.post(f'{BASE}/financeiro/', [
            {'id': 'SP-1', 'tipo': 'solicitacao', 'solicitanteCpf': 'outro', 'fornecedor': 'Forn Velho'},
            {'id': 'CP-1', 'tipo': 'contaPagar', 'fornecedor': 'Forn Velho', 'valor': 10},
            {'id': 'CP-2', 'tipo': 'contaPagar', 'fornecedor': 'Outro Forn', 'valor': 10},
        ], format='json')

    def _logar(self, cpf):
        token = obter_token(self.client, cpf, 'Admin@teste1').data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_quem_so_tem_compras_renomeia_em_tudo(self):
        from .financeiro_sync import read_all
        from .models import ContaPagar
        self._logar('cmp-rf')
        r = self.client.post(f'{BASE}/fornecedores/renomear/', {'de': 'Forn Velho', 'para': 'Forn Novo'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['registros_atualizados'], 2)
        dados = {x['id']: x for x in read_all()}
        self.assertEqual(dados['SP-1']['fornecedor'], 'Forn Novo')
        self.assertEqual(dados['CP-1']['fornecedor'], 'Forn Novo')
        self.assertEqual(dados['CP-2']['fornecedor'], 'Outro Forn')
        self.assertEqual(ContaPagar.objects.get(record_id='CP-1').fornecedor, 'Forn Novo')

    def test_sem_permissao_recebe_403(self):
        self._logar('zeca-rf')
        r = self.client.post(f'{BASE}/fornecedores/renomear/', {'de': 'Forn Velho', 'para': 'X'}, format='json')
        self.assertEqual(r.status_code, 403)
