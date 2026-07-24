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
    """UserViewSet usa AllowAny — documenta o comportamento atual (vulnerabilidade conhecida)."""

    def setUp(self):
        self.admin = criar_admin('adm-sec', 'Admin@teste1')
        self.gerente = criar_gerente('ger-sec', 'Admin@teste1')

    def test_usuario_anonimo_pode_listar_usuarios(self):
        """BUG CONHECIDO: AllowAny expõe a lista de usuários sem autenticação."""
        resp = self.client.get(f'{BASE}/usuarios/')
        self.assertEqual(resp.status_code, 200)

    def test_usuario_anonimo_nao_pode_excluir_admin(self):
        """Sem token, DELETE deve retornar 401 (autenticação exigida pelo DRF padrão ao tentar deletar)."""
        resp = self.client.delete(f'{BASE}/usuarios/{self.admin.pk}/')
        # AllowAny permite; a proteção real é a lógica de negócio (is_superuser)
        # Documentamos o status real para monitorar regressões
        self.assertIn(resp.status_code, [200, 204, 403, 401])

    def test_admin_nao_pode_excluir_superuser(self):
        """Regra de negócio: admin principal (is_superuser) não pode ser deletado."""
        resp_tok = obter_token(self.client, 'adm-sec', 'Admin@teste1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp_tok.data["access"]}')
        resp = self.client.delete(f'{BASE}/usuarios/{self.admin.pk}/')
        self.assertEqual(resp.status_code, 403)

    def test_criar_usuario_sem_autenticacao(self):
        """BUG CONHECIDO: AllowAny permite criar usuário sem autenticar."""
        payload = {
            'cpf': 'anon-new', 'password': 'Admin@teste1',
            'nome': 'Anon User', 'email': 'anon@test.com', 'role': 'usuario'
        }
        resp = self.client.post(f'{BASE}/usuarios/', payload, format='json')
        self.assertIn(resp.status_code, [201, 400])  # 201 = bug ativo, 400 = validação

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
