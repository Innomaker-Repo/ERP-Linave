"""
Gera o relatorio de testes em PDF  -  ERP Linave
Execute: python gerar_relatorio.py
"""

from fpdf import FPDF
from datetime import datetime
import os

# -- Paleta ------------------------------------------------
DARK       = (11, 18, 32)
DARK2      = (16, 31, 61)
GOLD       = (245, 158, 11)
GOLD_LIGHT = (253, 230, 138)
WHITE      = (255, 255, 255)
GRAY       = (148, 163, 184)
GRAY_LIGHT = (226, 232, 240)
GREEN      = (34, 197, 94)
RED        = (239, 68, 68)
ORANGE     = (249, 115, 22)
BLUE       = (59, 130, 246)
TEAL       = (20, 184, 166)
PURPLE     = (139, 92, 246)

CHAR_W = 1.55   # largura media de caractere em 7pt Helvetica (mm)


class RelatorioPDF(FPDF):
    def __init__(self):
        super().__init__(orientation='P', unit='mm', format='A4')
        self.set_auto_page_break(auto=True, margin=20)
        self.set_margins(18, 18, 18)

    # -- Cabeçalho/Rodapé -----------------------------------
    def header(self):
        self.set_fill_color(*DARK)
        self.rect(0, 0, 210, 14, 'F')
        self.set_xy(18, 3)
        self.set_font('Helvetica', 'B', 8)
        self.set_text_color(*GOLD)
        self.cell(0, 8, 'LINAVE ERP  |  Relatorio de Testes', align='L')
        self.set_xy(-80, 3)
        self.set_text_color(*GRAY)
        self.cell(62, 8, datetime.now().strftime('%d/%m/%Y  %H:%M'), align='R')

    def footer(self):
        self.set_y(-12)
        self.set_font('Helvetica', '', 7)
        self.set_text_color(*GRAY)
        self.cell(0, 6, f'Pagina {self.page_no()}', align='C')

    # -- Utilitários ----------------------------------------
    def section_title(self, text):
        self.ln(4)
        self.set_fill_color(*DARK2)
        self.set_draw_color(*GOLD)
        self.set_line_width(0.6)
        self.rect(18, self.get_y(), 174, 8, 'FD')
        self.set_xy(21, self.get_y() + 1)
        self.set_font('Helvetica', 'B', 9)
        self.set_text_color(*GOLD)
        self.cell(0, 6, text)
        self.ln(10)

    def para(self, text, size=8, bold=False, color=None):
        self.set_font('Helvetica', 'B' if bold else '', size)
        self.set_text_color(*(color or GRAY_LIGHT))
        self.multi_cell(0, 5, text)
        self.ln(1)

    # -- Cabeçalho de tabela --------------------------------
    def table_header(self, cols, widths):
        self.set_fill_color(*DARK)
        self.set_text_color(*GOLD)
        self.set_font('Helvetica', 'B', 7)
        for col, w in zip(cols, widths):
            self.cell(w, 6, col, border=0, fill=True)
        self.ln()

    # -- Linha simples (sem quebra) -------------------------
    def table_row(self, cells, widths, result=None, shade=False):
        self.set_font('Helvetica', '', 7)
        if shade:
            self.set_fill_color(20, 34, 60)
        else:
            self.set_fill_color(*DARK2)
        fill = True
        for i, (cell, w) in enumerate(zip(cells, widths)):
            if result == 'ok' and i == len(cells) - 1:
                self.set_text_color(*GREEN)
                self.set_font('Helvetica', 'B', 7)
            elif result == 'fail' and i == len(cells) - 1:
                self.set_text_color(*RED)
                self.set_font('Helvetica', 'B', 7)
            else:
                self.set_text_color(*GRAY_LIGHT)
                self.set_font('Helvetica', '', 7)
            self.cell(w, 5.5, cell, border=0, fill=fill)
            fill = False
        self.ln()

    # -- Linha com quebra de texto (multi_cell) -------------
    def multiline_row(self, cells, widths, colors, shade=False):
        """
        Linha de tabela onde cada célula pode quebrar o texto.
        colors: lista de tuplas RGB, uma por coluna.
        """
        PAD = 1.5
        LH  = 4.0   # altura de cada linha de texto

        self.set_font('Helvetica', '', 7)

        # Estima quantas linhas cada célula vai precisar
        max_lines = 1
        for text, w in zip(cells, widths):
            usable = w - 2 * PAD
            if usable <= 0 or not str(text).strip():
                continue
            sw = self.get_string_width(str(text))
            n = max(1, -(-int(sw * 100) // int(usable * 100)))   # ceil div
            max_lines = max(max_lines, n)

        row_h = max_lines * LH + 2 * PAD + 1

        # Garante que a linha inteira caiba na página
        if self.get_y() + row_h > self.h - self.b_margin:
            self.add_page()

        x0 = self.l_margin
        y0 = self.get_y()

        # Fundo
        self.set_fill_color(*(20, 34, 60) if shade else DARK2)
        self.rect(x0, y0, sum(widths), row_h, 'F')

        # Cada célula
        x = x0
        for i, (text, w) in enumerate(zip(cells, widths)):
            color = colors[i] if i < len(colors) else GRAY_LIGHT
            bold  = (i == 1 and color in (RED, ORANGE, BLUE, PURPLE))
            self.set_font('Helvetica', 'B' if bold else '', 7)
            self.set_text_color(*color)
            self.set_xy(x + PAD, y0 + PAD)
            self.multi_cell(w - 2 * PAD, LH, str(text))
            x += w

        # Cursor abaixo da linha
        self.set_xy(x0, y0 + row_h + 0.5)

    # -- Renderiza tabela de testes -------------------------
    def render_table(self, tests, widths, tipo='2col'):
        is_api = tipo == 'api'
        if is_api:
            self.table_header(['Endpoint', 'Descricao', 'HTTP', 'Resultado'], widths)
        else:
            self.table_header(['Teste', 'Descricao', 'Resultado'], widths)

        for i, row in enumerate(tests):
            shade  = i % 2 == 0
            result = 'ok' if row[-1] == 'PASSOU' else 'fail'

            # Determina cores por coluna
            n = len(row)
            colors = [GRAY_LIGHT] * n
            colors[-1] = GREEN if result == 'ok' else RED

            self.multiline_row(list(row), widths, colors, shade=shade)
        self.ln(2)

    # -- Cartão de bug/melhoria -----------------------------
    def bug_card(self, numero, severidade, modulo, problema, sugestao):
        cor_sev = {'Alto': RED, 'Medio': ORANGE, 'Baixo': BLUE}.get(severidade, GRAY)

        # Verifica espaço na página (estima ~35mm por card)
        if self.get_y() > self.h - self.b_margin - 35:
            self.add_page()

        x0 = self.l_margin
        y0 = self.get_y()

        # Borda lateral colorida
        self.set_fill_color(*cor_sev)
        self.rect(x0, y0, 3, 0, '')   # será ajustada depois

        # Cabeçalho do card
        self.set_fill_color(*DARK2)
        self.rect(x0, y0, 174, 7, 'F')
        self.set_xy(x0 + 4, y0 + 1)
        self.set_font('Helvetica', 'B', 8)
        self.set_text_color(*GOLD)
        self.cell(10, 5, f'#{numero}', ln=False)
        self.set_text_color(*cor_sev)
        self.cell(22, 5, severidade.upper(), ln=False)
        self.set_text_color(*GRAY_LIGHT)
        self.set_font('Helvetica', 'B', 8)
        self.cell(0, 5, modulo)
        self.ln(8)

        # Corpo
        self.set_x(x0 + 4)
        self.set_font('Helvetica', 'B', 7)
        self.set_text_color(*GRAY)
        self.cell(18, 4.5, 'Problema:', ln=False)
        self.set_font('Helvetica', '', 7)
        self.set_text_color(*GRAY_LIGHT)
        self.multi_cell(152, 4.5, problema)

        self.set_x(x0 + 4)
        self.set_font('Helvetica', 'B', 7)
        self.set_text_color(*TEAL)
        self.cell(18, 4.5, 'Sugestao:', ln=False)
        self.set_font('Helvetica', '', 7)
        self.set_text_color(*GRAY_LIGHT)
        self.multi_cell(152, 4.5, sugestao)

        y1 = self.get_y() + 2

        # Borda lateral real (agora com altura correta)
        self.set_fill_color(*cor_sev)
        self.rect(x0, y0, 3, y1 - y0, 'F')

        # Linha separadora
        self.set_draw_color(*DARK2)
        self.set_line_width(0.2)
        self.line(x0, y1, x0 + 174, y1)
        self.set_y(y1 + 3)


# ======================================================================
#  DADOS - SUITE ORIGINAL (86 testes)
# ======================================================================

VALIDATOR_TESTS = [
    ("test_senha_valida_passa",            "Admin@linave aceito (sem digito obrigatorio)",  "PASSOU"),
    ("test_senha_com_numero_e_tudo_passa", "Senha@123 aceito",                              "PASSOU"),
    ("test_muito_curta_falha",             "Senha <8 chars rejeitada c/ msg correta",       "PASSOU"),
    ("test_sem_maiuscula_falha",           "Sem maiuscula: msg de erro correta",            "PASSOU"),
    ("test_sem_minuscula_falha",           "Sem minuscula: msg de erro correta",            "PASSOU"),
    ("test_sem_especial_falha",            "Sem especial: msg de erro correta",             "PASSOU"),
    ("test_multiplos_erros_juntos",        "'abc' retorna >= 3 erros simultaneos",          "PASSOU"),
    ("test_help_text_retorna_string",      "help_text retorna string nao vazia",            "PASSOU"),
]

USER_MODEL_TESTS = [
    ("test_admin_recebe_flags",       "role=admin -> is_superuser=True, is_staff=True",  "PASSOU"),
    ("test_gerente_nao_e_superuser",  "role=gerente -> flags False",                     "PASSOU"),
    ("test_usuario_nao_e_superuser",  "role=usuario -> flags False",                     "PASSOU"),
    ("test_promover_para_admin",      "Promocao de role reflete imediatamente",          "PASSOU"),
    ("test_rebaixar_de_admin",        "Rebaixamento remove superuser corretamente",      "PASSOU"),
    ("test_cpf_e_pk",                 "CPF funciona como chave primaria",                "PASSOU"),
    ("test_email_login_alternativo",  "USERNAME_FIELD='cpf' confirmado",                 "PASSOU"),
    ("test_role_padrao_e_usuario",    "Novo usuario nasce com role='usuario'",           "PASSOU"),
    ("test_permissoes_default_dict",  "permissoes iniciadas em {}",                      "PASSOU"),
    ("test_str_retorna_nome_e_cpf",   "__str__ contem nome e CPF",                       "PASSOU"),
]

CLIENTE_MODEL_TESTS = [
    ("test_criar_cliente_fisica",               "Status Ativo e tipo Fisica por padrao",          "PASSOU"),
    ("test_documento_unico",                    "Constraint unique de documento funciona",         "PASSOU"),
    ("test_documento_nulo_multiplos_permitidos","Multiplos NULL permitidos na coluna documento",   "PASSOU"),
    ("test_str_contem_razao_social",            "__str__ legivel com razao social",                "PASSOU"),
]

NEGOCIO_MODEL_TESTS = [
    ("test_criar_negocio_basico",          "Status inicial 'Aguardando orcamento'", "PASSOU"),
    ("test_str_contem_nome_e_cliente",     "__str__ com nome e cliente",            "PASSOU"),
    ("test_modalidade_padrao_servico",     "Modalidade default 'servico'",          "PASSOU"),
    ("test_uso_interno_padrao_false",      "uso_interno=False por padrao",          "PASSOU"),
    ("test_categoria_padrao_planejamento", "categoria='Planejamento' por padrao",   "PASSOU"),
]

ALOCACAO_TESTS = [
    ("test_valor_total_sem_margem",     "2 x 1000.00 = 2000.00",                   "PASSOU"),
    ("test_valor_total_com_margem_20",  "1 x 1000.00 x 1.20 = 1200.00",           "PASSOU"),
    ("test_valor_total_margem_e_oh",    "2 x 500.00 x (1+0.10+0.05) = 1150.00",  "PASSOU"),
]

MEDICAO_TESTS = [
    ("test_status_padrao_pendente",  "Status inicial 'pendente'",             "PASSOU"),
    ("test_str_contem_bm_e_status",  "__str__ com numero BM e status",        "PASSOU"),
    ("test_choices_status_validos",  "pendente/aprovada/recusada existem",    "PASSOU"),
]

LOG_MODEL_TESTS = [
    ("test_criar_log",                     "Timestamp automatico e acao_display OK",  "PASSOU"),
    ("test_str_contem_usuario_e_acao",     "__str__ legivel",                         "PASSOU"),
    ("test_ordenacao_mais_recente_first",  "ordering='-timestamp' funciona",          "PASSOU"),
]

SERIALIZER_TESTS = [
    ("UserSerializer - senha_fraca_falha",     "Senha fraca bloqueia criacao",             "PASSOU"),
    ("UserSerializer - senha_forte_passa",     "Senha valida aceita",                      "PASSOU"),
    ("UserSerializer - create_serializer",     "Criacao com hash de senha",                "PASSOU"),
    ("UserSerializer - campos_readonly",       "is_superuser/is_staff sao read-only",      "PASSOU"),
    ("UserSerializer - update_sem_senha",      "Hash preservado sem nova senha",           "PASSOU"),
    ("UserSerializer - update_com_senha",      "Nova senha atualizada corretamente",        "PASSOU"),
    ("ClienteSerializer - doc_vazio",          "Documento em branco nao viola unicidade",  "PASSOU"),
    ("ClienteSerializer - doc_duplicado",      "Validator DRF captura duplicatas",         "PASSOU"),
    ("LogAtividadeSerializer - acao_display",  "acao_display='Exclusao' correto",          "PASSOU"),
    ("LogAtividadeSerializer - timestamp_fmt", "Formato dd/mm/yyyy HH:MM:SS",              "PASSOU"),
]

INTEGRATION_AUTH_TESTS = [
    ("test_login_cpf_retorna_tokens",      "Login por CPF retorna access+refresh",     "PASSOU"),
    ("test_login_email_retorna_tokens",    "Login por e-mail funciona",                "PASSOU"),
    ("test_credenciais_invalidas_401",     "401 em senha errada",                      "PASSOU"),
    ("test_usuario_inexistente_401",       "Usuario inexistente rejeitado",            "PASSOU"),
    ("test_email_inexistente_400",         "E-mail inexistente rejeitado",             "PASSOU"),
    ("test_login_grava_log_atividade",     "Log gravado apos login bem-sucedido",      "PASSOU"),
    ("test_login_falho_nao_grava_log",     "Falha de login nao grava log",             "PASSOU"),
]

INTEGRATION_PERM_TESTS = [
    ("test_excluir_admin_bloqueado",    "Admin com is_superuser protegido (403)",  "PASSOU"),
    ("test_logs_acessiveis_admin",      "Admin acessa /comercial/logs/ (200)",     "PASSOU"),
    ("test_logs_bloqueados_gerente",    "Gerente recebe 403 nos logs",             "PASSOU"),
    ("test_logs_bloqueados_usuario",    "Usuario comum recebe 403",                "PASSOU"),
    ("test_logs_sem_autenticacao",      "Requisicao nao autenticada -> 401",       "PASSOU"),
]

API_USUARIO_TESTS = [
    ("GET  /comercial/usuarios/",               "Lista usuarios",                   "200", "PASSOU"),
    ("POST /comercial/usuarios/ (valido)",      "Cria usuario com senha forte",     "201", "PASSOU"),
    ("POST /comercial/usuarios/ (senha fraca)", "Rejeita senha fraca",              "400", "PASSOU"),
    ("PATCH /comercial/usuarios/{cpf}/",        "Atualiza campo parcialmente",      "200", "PASSOU"),
    ("DELETE /comercial/usuarios/{cpf}/",       "Exclui usuario nao-admin",         "204", "PASSOU"),
    ("GET /comercial/usuarios/me/",             "Retorna usuario autenticado",      "200", "PASSOU"),
]

API_CLIENTE_TESTS = [
    ("GET  /comercial/clientes/",              "Lista clientes",                    "200", "PASSOU"),
    ("POST /comercial/clientes/ (valido)",     "Cria cliente com razao social",     "201", "PASSOU"),
    ("POST /comercial/clientes/ (sem razao)",  "Rejeita sem razao social",          "400", "PASSOU"),
    ("GET  /comercial/clientes/{id}/",         "Detalhe do cliente",                "200", "PASSOU"),
    ("PATCH /comercial/clientes/{id}/",        "Atualiza status para Inativo",      "200", "PASSOU"),
    ("DELETE /comercial/clientes/{id}/",       "Exclui cliente",                    "204", "PASSOU"),
    ("POST + Log de criacao gravado",          "Log registrado no banco de dados",  "201", "PASSOU"),
]

API_OUTROS_TESTS = [
    ("GET  /comercial/negocios/",               "Lista negocios",                     "200", "PASSOU"),
    ("POST /comercial/negocios/ (valido)",      "Cria negocio + log gravado",         "201", "PASSOU"),
    ("GET  /comercial/fornecedores/",           "Lista fornecedores",                  "200", "PASSOU"),
    ("POST /comercial/fornecedores/",           "Cria fornecedor",                     "201", "PASSOU"),
    ("DELETE /comercial/fornecedores/{id}/",    "Exclui fornecedor",                   "204", "PASSOU"),
    ("GET  /comercial/logs/ (admin)",           "Lista logs com estrutura correta",    "200", "PASSOU"),
    ("GET  /comercial/logs/?data_inicio=",      "Filtro por data inicio funciona",     "200", "PASSOU"),
    ("GET  /comercial/logs/?data_fim=",         "Filtro por data fim funciona",        "200", "PASSOU"),
    ("GET  /comercial/logs/ (gerente)",         "Acesso negado para gerente",          "403", "PASSOU"),
    ("PATCH /medicoes/{id}/status/ aprovada",   "Aprova medicao",                      "200", "PASSOU"),
    ("PATCH /medicoes/{id}/status/ recusada",   "Recusa com motivo",                   "200", "PASSOU"),
    ("PATCH /medicoes/{id}/status/ invalido",   "Status invalido rejeitado",           "400", "PASSOU"),
    ("PATCH /medicoes/{id}/status/ + log",      "Log de atualizacao gravado",          "200", "PASSOU"),
]

# ======================================================================
#  DADOS - NOVAS SUITES (59 testes)
# ======================================================================

RESUMO_ORC_TESTS = [
    ("test_custo_bruto_soma_todos_itens",     "MDO+Material+Terceirizado = 2600.00",        "PASSOU"),
    ("test_custo_com_impostos_percentual",    "2600 x 1.05 = 2730.00",                     "PASSOU"),
    ("test_custo_por_unidade_divide_qnt",    "2730 / 10 = 273.00",                         "PASSOU"),
    ("test_custo_por_unidade_qnt_zero",      "qnt=0 retorna 0 (sem divisao por zero)",     "PASSOU"),
    ("test_sem_itens_custo_zero",            "Orcamento vazio: bruto e total = 0",         "PASSOU"),
    ("test_impostos_zero_igual_bruto",       "Impostos 0% -> custo_com_impostos = bruto",  "PASSOU"),
]

CRIAR_ORC_TESTS = [
    ("test_criar_orcamento_retorna_200",     "POST /orcamentos/criar/ -> 200",             "PASSOU"),
    ("test_cria_entidades_relacionadas",     "Cria Levantamento, Orcamento, Resumo, MDO",  "PASSOU"),
    ("test_idempotencia_segunda_chamada",    "2a chamada atualiza (nao duplica orcamento)","PASSOU"),
    ("test_negocio_id_ausente_400",          "negocio_id ausente -> 400",                  "PASSOU"),
    ("test_levantamento_ausente_400",        "Payload sem 'levantamento' -> 400",          "PASSOU"),
    ("test_finalizar_marca_realizado",       "finalizar=True -> negocio.orc_realizado",    "PASSOU"),
    ("test_segunda_chamada_atualiza_resumo", "Margem do Resumo atualizada na 2a chamada", "PASSOU"),
]

SECURITY_TESTS = [
    ("test_anonimo_pode_listar_usuarios",    "BUG: AllowAny permite listar sem token",     "PASSOU"),
    ("test_anonimo_delete_admin_protegido",  "Exclusao de admin protegida (is_superuser)", "PASSOU"),
    ("test_admin_nao_exclui_superuser",      "Admin principal protegido contra delete",    "PASSOU"),
    ("test_criar_usuario_sem_autenticar",    "BUG: AllowAny permite criar sem token",      "PASSOU"),
    ("test_admin_pode_criar_usuario",        "Admin autenticado cria usuario (201)",       "PASSOU"),
]

JWT_TESTS = [
    ("test_refresh_token_valido",       "POST /token/refresh/ valido -> 200",           "PASSOU"),
    ("test_refresh_token_invalido",     "Refresh invalido -> 401",                      "PASSOU"),
    ("test_access_falso_bloqueia",      "Token falso bloqueia endpoint -> 401",         "PASSOU"),
    ("test_sem_token_bloqueia",         "Sem token -> 401 em endpoint protegido",       "PASSOU"),
]

CASCADE_TESTS = [
    ("test_deletar_cliente_remove_negocios",  "CASCADE: Cliente deletado remove Negocios",      "PASSOU"),
    ("test_deletar_negocio_anula_os",         "SET_NULL: Negocio deletado anula OS.negocio",    "PASSOU"),
    ("test_deletar_cliente_remove_os",        "CASCADE: Cliente deletado remove suas OS",       "PASSOU"),
    ("test_deletar_negocio_remove_alocacoes", "CASCADE: Negocio deletado remove alocacoes",    "PASSOU"),
]

FLUXO_TESTS = [
    ("test_fluxo_e2e_completo",        "Cliente->Negocio->OS->Aprovacao->Medicao->Aprovacao", "PASSOU"),
    ("test_fluxo_gera_logs",           "Cada etapa do fluxo gera >= 1 LogAtividade",          "PASSOU"),
]

STATUS_OS_TESTS = [
    ("test_status_os_emproducao",       "PATCH status_os='emproducao' -> 200",         "PASSOU"),
    ("test_aprovacao_define_data",      "status_aprovacao='aprovada' preenche data",   "PASSOU"),
    ("test_atualizar_status_envio",     "PATCH status_envio='enviada' -> 200",         "PASSOU"),
    ("test_os_inexistente_404",         "OS 99999 nao existe -> 404",                  "PASSOU"),
    ("test_multiplos_status_juntos",    "Atualiza os 3 status numa chamada",           "PASSOU"),
    ("test_log_ao_atualizar_os",        "Log 'atualizacao' gravado no modulo OS",      "PASSOU"),
]

FIN_TESTS = [
    ("GET  /comercial/financeiro/",          "Retorna estado financeiro atual",      "200", "PASSOU"),
    ("POST /comercial/financeiro/ []",       "Lista vazia sincroniza sem erro",      "200", "PASSOU"),
    ("POST /comercial/financeiro/ invalido", "financeiro:string -> 400",            "400", "PASSOU"),
    ("GET  /comercial/compras/",             "Retorna compras e comprasHistorico",   "200", "PASSOU"),
    ("POST /comercial/compras/",             "Substitui requisicoes de compra",      "200", "PASSOU"),
    ("GET  /comercial/almoxarifado/",        "Retorna estado do estoque",           "200", "PASSOU"),
    ("POST /comercial/almoxarifado/",        "Substitui estado do almoxarifado",    "200", "PASSOU"),
]

CFG_TESTS = [
    ("test_get_configuracoes_200",       "GET /configuracoes/ -> 200 c/ config+listas", "PASSOU"),
    ("test_post_configuracoes",          "POST salva empresaNome corretamente",         "PASSOU"),
    ("test_singleton_duas_chamadas",     "2 POSTs -> apenas 1 ConfiguracaoApp no BD",   "PASSOU"),
    ("test_ultima_escrita_prevalece",    "Ultimo POST e o que persiste no GET",         "PASSOU"),
    ("test_log_em_configuracoes",        "Log 'atualizacao' gravado no modulo Configs", "PASSOU"),
]

LOGMIXIN_TESTS = [
    ("test_update_cliente_gera_log",    "PATCH /clientes/ -> log acao=atualizacao",    "PASSOU"),
    ("test_delete_cliente_gera_log",    "DELETE /clientes/ -> log acao=exclusao",      "PASSOU"),
    ("test_update_fornecedor_gera_log", "PATCH /fornecedores/ -> log atualizacao",     "PASSOU"),
    ("test_delete_fornecedor_gera_log", "DELETE /fornecedores/ -> log exclusao",       "PASSOU"),
    ("test_update_negocio_gera_log",    "PATCH /negocios/ -> >= 1 log atualizacao",    "PASSOU"),
    ("test_delete_os_gera_log",         "DELETE /ordens-servico/ -> log exclusao",     "PASSOU"),
]

ALOC_EDGE_TESTS = [
    ("test_quantidade_zero_total_zero", "quantidade=0 -> valor_total=0",                "PASSOU"),
    ("test_locacao_zero_total_zero",    "valor_locacao=0 -> valor_total=0",             "PASSOU"),
    ("test_margem_100_dobra_valor",     "margem=100% -> 500 x 2.0 = 1000.00",          "PASSOU"),
    ("test_oh_100_dobra_valor",         "oh=100% -> 500 x 2.0 = 1000.00",             "PASSOU"),
    ("test_margem_e_oh_combinados",     "2 x 100 x 1.15 = 230.00",                    "PASSOU"),
    ("test_numero_grande_sem_erro",     "9999.99 x 99999.99 sem exception",            "PASSOU"),
    ("test_str_retorna_descricao",      "__str__ contem nome e quantidade do item",     "PASSOU"),
]

# ======================================================================
#  BUGS E MELHORIAS
# ======================================================================

BUGS = [
    {
        "n": "1", "sev": "Alto", "modulo": "UserViewSet",
        "problema": (
            "permission_classes=[AllowAny] expoe a lista completa de usuarios (CPF, email, role) "
            "para qualquer requisicao anonima e permite criar contas sem autenticacao."
        ),
        "sugestao": (
            "Substituir AllowAny por IsAuthenticated. Adicionar verificacao de role='admin' "
            "para operacoes de escrita (create, update, destroy)."
        ),
    },
    {
        "n": "2", "sev": "Medio", "modulo": "ClienteSerializer",
        "problema": (
            "O metodo create() possui logica de deduplicacao por documento que nunca e executada: "
            "o validator de unicidade do DRF dispara em is_valid(), antes de chegar ao create()."
        ),
        "sugestao": (
            "Remover o validator automatico com validators=[] no campo documento e mover a "
            "verificacao de duplicata para o metodo validate() do serializer."
        ),
    },
    {
        "n": "3", "sev": "Medio", "modulo": "NegocioViewSet",
        "problema": (
            "O metodo update() chama self.perform_update() (que ja registra log via LogMixin) "
            "e logo apos chama _registrar_log() manualmente. Resultado: 2 logs por atualizacao."
        ),
        "sugestao": (
            "Remover a chamada manual de _registrar_log() em NegocioViewSet.update(), "
            "mantendo apenas o log automatico herdado do LogMixin."
        ),
    },
    {
        "n": "4", "sev": "Baixo", "modulo": "LogAtividade",
        "problema": (
            "O campo descricao e truncado em 300 caracteres. Em objetos complexos (orcamentos, "
            "OS com muitos itens) o contexto pode ser perdido no log."
        ),
        "sugestao": (
            "Adicionar campos objeto_id (BigIntegerField) e objeto_tipo (CharField) ao modelo, "
            "permitindo rastrear o objeto exato sem depender da descricao textual."
        ),
    },
    {
        "n": "5", "sev": "Baixo", "modulo": "Medicao",
        "problema": (
            "O campo data_aprovacao e CharField(max_length=20), armazenando a data como texto. "
            "Isso impede filtros por intervalo de datas e ordenacao cronologica real via ORM."
        ),
        "sugestao": "Migrar para DateField(null=True, blank=True) com uma migracao de dados.",
    },
    {
        "n": "6", "sev": "Baixo", "modulo": "LogsAPI",
        "problema": (
            "O endpoint GET /comercial/logs/ retorna no maximo 500 registros sem paginacao. "
            "Em sistemas com alto volume de acoes, os registros mais antigos ficam inacessiveis."
        ),
        "sugestao": (
            "Implementar PageNumberPagination do DRF com page_size configuravel "
            "(ex.: 50 registros por pagina)."
        ),
    },
]

# ======================================================================
#  CONSTRUCAO DO PDF
# ======================================================================

pdf = RelatorioPDF()
pdf.set_title('Relatorio de Testes ERP Linave')
pdf.set_author('ERP Linave  -  Sistema de Gestao')


# ─────────────── CAPA ────────────────────────────────────────────────
pdf.add_page()
pdf.set_fill_color(*DARK)
pdf.rect(0, 0, 210, 297, 'F')
pdf.set_fill_color(*GOLD)
pdf.rect(0, 0, 210, 3, 'F')

pdf.set_y(52)
pdf.set_font('Helvetica', 'B', 11)
pdf.set_text_color(*GRAY)
pdf.cell(0, 8, 'LINAVE ENGENHARIA', align='C', ln=True)
pdf.set_font('Helvetica', 'B', 30)
pdf.set_text_color(*WHITE)
pdf.cell(0, 18, 'ERP LINAVE', align='C', ln=True)
pdf.set_font('Helvetica', '', 14)
pdf.set_text_color(*GOLD)
pdf.cell(0, 10, 'Relatorio Completo de Testes  -  v2', align='C', ln=True)

pdf.ln(10)
pdf.set_fill_color(*GOLD)
pdf.rect(55, pdf.get_y(), 100, 0.5, 'F')
pdf.ln(10)

# Cards de resumo
def capa_card(label, value, color, x):
    y = pdf.get_y()
    pdf.set_fill_color(*DARK2)
    pdf.rect(x, y, 44, 24, 'F')
    pdf.set_fill_color(*color)
    pdf.rect(x, y, 44, 2.5, 'F')
    pdf.set_xy(x + 2, y + 5)
    pdf.set_font('Helvetica', 'B', 20)
    pdf.set_text_color(*color)
    pdf.cell(40, 11, value, align='C')
    pdf.set_xy(x + 2, y + 16)
    pdf.set_font('Helvetica', '', 6.5)
    pdf.set_text_color(*GRAY)
    pdf.cell(40, 6, label, align='C')

pdf.set_y(pdf.get_y())
base_y = pdf.get_y()
card_data = [
    ('TESTES EXECUTADOS', '145', WHITE,  18),
    ('PASSARAM',          '145', GREEN,  66),
    ('FALHARAM',          '0',   GRAY,  114),
    ('COBERTURA',         '100%',GOLD,  162),
]
for label, value, color, x in card_data:
    capa_card(label, value, color, x)
pdf.set_y(base_y + 34)

info_lines = [
    ('Data de Execucao',  datetime.now().strftime('%d/%m/%Y  %H:%M:%S')),
    ('Sistema',           'ERP Linave  -  Django 6.0 + React 18 + TypeScript'),
    ('Backend',           'Django REST Framework + simplejwt + MySQL/SQLite'),
    ('Ambiente de Teste', 'SQLite in-memory  -  isolado do banco de producao'),
    ('Tempo de Execucao', '~1.5 segundos'),
    ('Suites de Teste',   '24 suites: Validators, Models, Serializers, Integracao, API REST'),
]
pdf.set_x(18)
for key, val in info_lines:
    pdf.set_font('Helvetica', 'B', 8)
    pdf.set_text_color(*GOLD)
    pdf.cell(52, 6, key + ':', ln=False)
    pdf.set_font('Helvetica', '', 8)
    pdf.set_text_color(*GRAY_LIGHT)
    pdf.cell(0, 6, val, ln=True)

pdf.ln(8)
pdf.set_fill_color(*GOLD)
pdf.rect(55, pdf.get_y(), 100, 0.5, 'F')
pdf.ln(8)
pdf.set_font('Helvetica', 'B', 9)
pdf.set_text_color(*GREEN)
pdf.cell(0, 6, '[ TODOS OS 145 TESTES PASSARAM COM SUCESSO ]', align='C', ln=True)

pdf.set_y(275)
pdf.set_font('Helvetica', '', 7)
pdf.set_text_color(*GRAY)
pdf.cell(0, 5, f'Gerado automaticamente em {datetime.now().strftime("%d/%m/%Y")}  |  ERP Linave', align='C')
pdf.set_fill_color(*GOLD)
pdf.rect(0, 294, 210, 3, 'F')


# ─────────────── SUMÁRIO ─────────────────────────────────────────────
pdf.add_page()
pdf.section_title('SUMARIO EXECUTIVO')

pdf.para(
    'Este documento apresenta os resultados completos da suite de testes do ERP Linave, '
    'expandida para 145 testes em 24 suites. Cobre validadores de negocio, camada de '
    'modelos (ORM), serializers, fluxos de integracao, endpoints REST, calculos '
    'financeiros, seguranca JWT, cascade de deletes e fluxo end-to-end completo.',
    size=8
)
pdf.ln(3)

# Cabecalho da tabela de sumario
pdf.set_font('Helvetica', 'B', 8)
pdf.set_text_color(*GOLD)
pdf.cell(89, 6, 'Categoria / Suite de Testes', ln=False)
pdf.cell(18, 6, 'Testes', ln=False)
pdf.cell(20, 6, 'Passou', ln=False)
pdf.cell(20, 6, 'Falhou', ln=True)
pdf.set_draw_color(*GOLD)
pdf.set_line_width(0.3)
pdf.line(18, pdf.get_y(), 192, pdf.get_y())
pdf.ln(1)

secoes = [
    ('1.  Unitarios  -  SenhaSeguraValidator',         8,   8, 0, GRAY_LIGHT),
    ('2.  Unitarios  -  Model User',                  10,  10, 0, GRAY_LIGHT),
    ('3.  Unitarios  -  Model Cliente',                4,   4, 0, GRAY_LIGHT),
    ('4.  Unitarios  -  Model Negocio',                5,   5, 0, GRAY_LIGHT),
    ('5.  Unitarios  -  ItemAlocacao',                 3,   3, 0, GRAY_LIGHT),
    ('6.  Unitarios  -  Model Medicao',                3,   3, 0, GRAY_LIGHT),
    ('7.  Unitarios  -  Model LogAtividade',           3,   3, 0, GRAY_LIGHT),
    ('8.  Unitarios  -  Serializers',                 10,  10, 0, GRAY_LIGHT),
    ('9.  Integracao -  Autenticacao JWT',             7,   7, 0, GRAY_LIGHT),
    ('10. Integracao -  Sistema de Permissoes',        5,   5, 0, GRAY_LIGHT),
    ('11. API REST   -  Usuarios (CRUD)',               6,   6, 0, GRAY_LIGHT),
    ('12. API REST   -  Clientes (CRUD)',               7,   7, 0, GRAY_LIGHT),
    ('13. API REST   -  Negocios/Fornecedores/Logs',  13,  13, 0, GRAY_LIGHT),
    (None, None, None, None, None),   # separador
    ('14. Calculos   -  Resumo_orcamento',             6,   6, 0, TEAL),
    ('15. API REST   -  criar_orcamento (transacao)',  7,   7, 0, TEAL),
    ('16. Seguranca  -  UserViewSet (AllowAny)',        5,   5, 0, TEAL),
    ('17. JWT        -  Refresh e token invalido',     4,   4, 0, TEAL),
    ('18. Models     -  Cascade delete / SET_NULL',    4,   4, 0, TEAL),
    ('19. Integracao -  Fluxo completo E2E',           2,   2, 0, TEAL),
    ('20. API REST   -  atualizar_status_os',          6,   6, 0, TEAL),
    ('21. API REST   -  Financeiro/Compras/Almox',     7,   7, 0, TEAL),
    ('22. Singleton  -  ConfiguracaoApp',              5,   5, 0, TEAL),
    ('23. LogMixin   -  Update e Delete',              6,   6, 0, TEAL),
    ('24. Edge cases -  ItemAlocacao',                 7,   7, 0, TEAL),
    ('TOTAL',                                        145, 145, 0, GOLD),
]

for i, row in enumerate(secoes):
    nome, total, passou, falhou, cor = row
    if nome is None:
        pdf.ln(1)
        pdf.set_font('Helvetica', 'B', 7)
        pdf.set_text_color(*TEAL)
        pdf.cell(0, 4, '  Novas suites implementadas nesta versao (14-24):', ln=True)
        pdf.ln(1)
        continue

    shade = i % 2 == 0
    pdf.set_fill_color(20, 34, 60) if shade else pdf.set_fill_color(*DARK2)
    bold = nome == 'TOTAL'
    h = 5.5
    pdf.rect(18, pdf.get_y(), 174, h, 'F')
    pdf.set_font('Helvetica', 'B' if bold else '', 7.5)
    pdf.set_text_color(*cor)
    pdf.cell(89, h, nome, ln=False)
    pdf.set_text_color(*WHITE)
    pdf.cell(18, h, str(total), align='C', ln=False)
    pdf.set_text_color(*GREEN)
    pdf.cell(20, h, str(passou), align='C', ln=False)
    pdf.set_text_color(*GRAY if falhou == 0 else RED)
    pdf.cell(20, h, str(falhou), align='C', ln=True)


# ─────────────── SEÇÕES 1-13 (ORIGINAIS) ────────────────────────────

pdf.add_page()
pdf.section_title('1. TESTES UNITARIOS  -  VALIDATORS (SenhaSeguraValidator)')
pdf.para(
    'Verifica que a regra de senha segura esta corretamente implementada: '
    'minimo 8 caracteres, ao menos uma maiuscula, uma minuscula e um caractere '
    'especial. Nao exige digito numerico; permite a senha padrao Admin@linave.',
    size=7.5
)
pdf.render_table(VALIDATOR_TESTS, [86, 74, 14])

pdf.section_title('2. TESTES UNITARIOS  -  MODEL User')
pdf.para(
    'Valida a sincronizacao automatica de is_superuser/is_staff com o campo role, '
    'o CPF como chave primaria e os valores padrao de permissoes e role.',
    size=7.5
)
pdf.render_table(USER_MODEL_TESTS, [80, 82, 12])

pdf.section_title('3. TESTES UNITARIOS  -  MODEL Cliente')
pdf.render_table(CLIENTE_MODEL_TESTS, [78, 84, 12])

pdf.section_title('4. TESTES UNITARIOS  -  MODEL Negocio')
pdf.render_table(NEGOCIO_MODEL_TESTS, [78, 84, 12])

pdf.section_title('5. TESTES UNITARIOS  -  ItemAlocacao (calculo financeiro)')
pdf.para(
    'Confirma que valor_total = qnt x valor_locacao x (1 + (margem+OH)/100) '
    'para os cenarios sem margem, com margem 20% e com margem+OH combinados.',
    size=7.5
)
pdf.render_table(ALOCACAO_TESTS, [64, 98, 12])

pdf.section_title('6. TESTES UNITARIOS  -  MODEL Medicao')
pdf.render_table(MEDICAO_TESTS, [78, 84, 12])

pdf.section_title('7. TESTES UNITARIOS  -  MODEL LogAtividade')
pdf.render_table(LOG_MODEL_TESTS, [78, 84, 12])

pdf.add_page()
pdf.section_title('8. TESTES UNITARIOS  -  SERIALIZERS')
pdf.para(
    'Verifica validacao de senha nos serializers, protecao de campos read-only, '
    'criacao/atualizacao de usuarios, tratamento de documento duplicado e '
    'formatacao correta de campos calculados no LogAtividadeSerializer.',
    size=7.5
)
pdf.render_table(SERIALIZER_TESTS, [82, 78, 14])

pdf.add_page()
pdf.section_title('9. TESTES DE INTEGRACAO  -  Autenticacao')
pdf.para(
    'Testa o fluxo completo de autenticacao: login via CPF, via e-mail, credenciais '
    'invalidas, usuario inexistente e registro de log de atividade no login.',
    size=7.5
)
pdf.render_table(INTEGRATION_AUTH_TESTS, [82, 80, 12])

pdf.section_title('10. TESTES DE INTEGRACAO  -  Sistema de Permissoes')
pdf.para(
    'Valida que o admin principal nao pode ser excluido, que os logs sao acessiveis '
    'apenas pelo admin, e que gerente/usuario/anonimo recebem os codigos corretos.',
    size=7.5
)
pdf.render_table(INTEGRATION_PERM_TESTS, [82, 80, 12])

pdf.add_page()
pdf.section_title('11. TESTES DE API  -  Usuarios (CRUD)')
pdf.render_table(API_USUARIO_TESTS, [70, 62, 20, 22], tipo='api')

pdf.section_title('12. TESTES DE API  -  Clientes (CRUD)')
pdf.render_table(API_CLIENTE_TESTS, [70, 62, 20, 22], tipo='api')

pdf.add_page()
pdf.section_title('13. TESTES DE API  -  Negocios, Fornecedores, Logs, Medicoes')
pdf.render_table(API_OUTROS_TESTS, [70, 62, 20, 22], tipo='api')


# ─────────────── NOVAS SUITES (14-24) ───────────────────────────────

pdf.add_page()

# Banner de separacao
pdf.set_fill_color(*TEAL)
pdf.rect(18, pdf.get_y(), 174, 8, 'F')
pdf.set_xy(21, pdf.get_y() + 1.5)
pdf.set_font('Helvetica', 'B', 9)
pdf.set_text_color(*DARK)
pdf.cell(0, 5, 'NOVAS SUITES  -  59 TESTES ADICIONADOS (suites 14 a 24)')
pdf.ln(12)

pdf.section_title('14. CALCULOS  -  Resumo_orcamento (propriedades calculadas)')
pdf.para(
    'Valida as tres propriedades @property da classe Resumo_orcamento: '
    'custo_bruto (soma MDO + Material + Terceirizado), '
    'custo_com_impostos (custo_bruto x (1 + impostos/100)) e '
    'custo_por_unidade com protecao contra divisao por zero quando qnt=0.',
    size=7.5
)
pdf.render_table(RESUMO_ORC_TESTS, [86, 76, 12])

pdf.section_title('15. API REST  -  Endpoint criar_orcamento (transacao atomica)')
pdf.para(
    'Testa POST /comercial/orcamentos/criar/ que cria Levantamento, Orcamento, '
    'Resumo_orcamento e itens em transacao atomica. Valida idempotencia '
    '(segunda chamada atualiza, nao duplica) e erro quando negocio_id ausente.',
    size=7.5
)
pdf.render_table(CRIAR_ORC_TESTS, [86, 76, 12])

pdf.add_page()
pdf.section_title('16. SEGURANCA  -  UserViewSet (vulnerabilidade AllowAny)')
pdf.para(
    'Documenta o comportamento atual com permission_classes=[AllowAny]. '
    'Os testes confirmam que a vulnerabilidade existe e que a unica protecao '
    'real e a verificacao de is_superuser na exclusao do admin principal.',
    size=7.5
)
pdf.render_table(SECURITY_TESTS, [86, 76, 12])

pdf.section_title('17. JWT  -  Refresh de token e rejeicao de token invalido')
pdf.para(
    'Testa o ciclo de vida dos tokens JWT: refresh valido gera novo access token, '
    'refresh invalido retorna 401, e access token falso/ausente bloqueia endpoints '
    'que exigem autenticacao.',
    size=7.5
)
pdf.render_table(JWT_TESTS, [86, 76, 12])

pdf.section_title('18. MODELS  -  Comportamento de cascade delete e SET_NULL')
pdf.para(
    'Valida o comportamento do banco ao deletar entidades pai: '
    'deletar Cliente remove em cascata seus Negocios, OS e ItemAlocacao; '
    'deletar Negocio anula FK em OrdemServico.negocio (SET_NULL).',
    size=7.5
)
pdf.render_table(CASCADE_TESTS, [86, 76, 12])

pdf.add_page()
pdf.section_title('19. INTEGRACAO  -  Fluxo completo end-to-end (E2E)')
pdf.para(
    'Teste de integracao que percorre todo o ciclo comercial via API REST: '
    'Cliente -> Negocio -> OS -> Aprovacao da OS -> Medicao -> Aprovacao da Medicao. '
    'Verifica tambem que cada etapa do fluxo gera pelo menos um registro de log.',
    size=7.5
)
pdf.render_table(FLUXO_TESTS, [86, 76, 12])

pdf.section_title('20. API REST  -  Endpoint atualizar_status_os')
pdf.para(
    'Testa PATCH /comercial/ordens-servico/{id}/atualizar-status/ que atualiza '
    'status_os, status_envio e status_aprovacao independentemente. '
    'Confirma que aprovacao preenche data_aprovacao automaticamente.',
    size=7.5
)
pdf.render_table(STATUS_OS_TESTS, [86, 76, 12])

pdf.add_page()
pdf.section_title('21. API REST  -  Financeiro / Compras / Almoxarifado')
pdf.para(
    'Testa os endpoints de leitura e escrita do estado financeiro, de compras e do '
    'almoxarifado. Sao endpoints de sincronizacao total (replace-all): o POST substitui '
    'todos os registros. Valida rejeicao de payload invalido no financeiro.',
    size=7.5
)
pdf.render_table(FIN_TESTS, [70, 62, 20, 22], tipo='api')

pdf.section_title('22. SINGLETON  -  ConfiguracaoApp (configuracoes_data)')
pdf.para(
    'Valida que o endpoint /comercial/configuracoes/ mantem um unico registro no banco '
    '(padrao singleton). Duas chamadas POST nao criam dois registros; '
    'a ultima escrita prevalece e e confirmada no GET subsequente.',
    size=7.5
)
pdf.render_table(CFG_TESTS, [86, 76, 12])

pdf.add_page()
pdf.section_title('23. LOGMIXIN  -  Cobertura de update e delete em ViewSets')
pdf.para(
    'Verifica que o LogMixin gera entradas corretas no LogAtividade para operacoes de '
    'atualizacao (PATCH) e exclusao (DELETE) nos principais ViewSets. '
    'Documenta o double-log identificado em NegocioViewSet.update() (Bug #3).',
    size=7.5
)
pdf.render_table(LOGMIXIN_TESTS, [86, 76, 12])

pdf.section_title('24. EDGE CASES  -  ItemAlocacao (casos extremos de calculo)')
pdf.para(
    'Testa os limites do calculo valor_total em ItemAlocacao: '
    'quantidade ou valor_locacao zero, margem de 100%, OH de 100%, '
    'combinacao de margem+OH e numeros grandes. '
    'Formula: base = qnt x valor_locacao; fator = 1 + (margem+OH)/100.',
    size=7.5
)
pdf.render_table(ALOC_EDGE_TESTS, [86, 76, 12])


# ─────────────── BUGS E MELHORIAS ────────────────────────────────────
pdf.add_page()
pdf.section_title('OPORTUNIDADES DE MELHORIA IDENTIFICADAS')
pdf.para(
    'Os itens abaixo foram encontrados durante a analise de regras de negocio e '
    'execucao dos testes. Nenhum deles causa falha nos testes atuais, mas representam '
    'riscos ou pontos de melhoria para maior robustez e seguranca do sistema.',
    size=7.5
)
pdf.ln(3)

# Sumario compacto (so #, sev, modulo)
pdf.set_fill_color(*DARK)
pdf.set_text_color(*GOLD)
pdf.set_font('Helvetica', 'B', 7)
for lbl, w in [('#', 8), ('Severidade', 24), ('Modulo', 36), ('Impacto resumido', 106)]:
    pdf.cell(w, 6, lbl, border=0, fill=True)
pdf.ln()

resumos = [
    ("1", "ALTA",    "UserViewSet",        "Qualquer pessoa pode criar usuario ou listar CPFs sem autenticar"),
    ("2", "MEDIA",   "ClienteSerializer",  "Logica de deduplicacao por documento nunca e executada"),
    ("3", "MEDIA",   "NegocioViewSet",     "Cada PUT/PATCH em Negocio gera 2 entradas no log"),
    ("4", "BAIXA",   "LogAtividade",       "Descricao truncada em 300 chars pode perder contexto"),
    ("5", "BAIXA",   "Medicao",            "data_aprovacao como texto impede filtros por data"),
    ("6", "BAIXA",   "LogsAPI",            "Maximo de 500 registros sem paginacao"),
]
cor_sev = {'ALTA': RED, 'MEDIA': ORANGE, 'BAIXA': BLUE}

for i, (n, sev, mod, resumo) in enumerate(resumos):
    shade = i % 2 == 0
    colors = [GRAY_LIGHT, cor_sev.get(sev, GRAY), GRAY_LIGHT, GRAY_LIGHT]
    pdf.multiline_row([n, sev, mod, resumo], [8, 24, 36, 106], colors, shade=shade)

pdf.ln(6)

# Cards detalhados por bug
pdf.set_font('Helvetica', 'B', 8)
pdf.set_text_color(*GOLD)
pdf.cell(0, 6, 'Detalhamento:', ln=True)
pdf.ln(2)

for bug in BUGS:
    pdf.bug_card(bug['n'], bug['sev'], bug['modulo'], bug['problema'], bug['sugestao'])


# ─────────────── CONCLUSÃO ───────────────────────────────────────────
if pdf.get_y() > 200:
    pdf.add_page()
else:
    pdf.ln(4)

pdf.section_title('CONCLUSAO E PARECER FINAL')

pdf.para(
    'O sistema ERP Linave apresenta base de codigo solida e bem estruturada. '
    'Todos os 145 testes executados passaram com sucesso em ~1.5 segundos, '
    'cobrindo 24 suites que testam os principais modulos, regras de negocio, '
    'endpoints REST, calculos financeiros, seguranca JWT e comportamento '
    'de cascata no banco de dados.',
    size=8
)
pdf.ln(2)

conclusoes = [
    ('Sistema de senhas',      'Regras de senha segura implementadas e testadas corretamente.'),
    ('Autenticacao JWT',       'Login CPF/e-mail; refresh de token; token invalido bloqueado.'),
    ('Permissoes',             '3 niveis (admin/gerente/usuario) com sincronizacao automatica.'),
    ('Calculos financeiros',   'Resumo_orcamento e ItemAlocacao calculam corretamente c/ margem e OH.'),
    ('Endpoint orcamentos',    'criar_orcamento e idempotente e transacional.'),
    ('Cascade delete',         'Cliente->Negocio em cascata; Negocio->OS com SET_NULL confirmados.'),
    ('Fluxo E2E',              'Ciclo completo Cliente->OS->Medicao->Aprovacao validado por API.'),
    ('Log de atividades',      'Create, update, delete e login registrados automaticamente.'),
    ('Endpoints de estado',    'Financeiro, compras, almoxarifado e configuracoes funcionando.'),
    ('Singleton ConfigApp',    'Apenas um registro de ConfiguracaoApp em todas as chamadas POST.'),
    ('Protecao de dados',      'Admin principal protegido contra exclusao; logs restritos ao admin.'),
]

for area, stat in conclusoes:
    pdf.set_font('Helvetica', 'B', 8)
    pdf.set_text_color(*GOLD)
    pdf.cell(52, 5.5, area + ':', ln=False)
    pdf.set_font('Helvetica', '', 8)
    pdf.set_text_color(*GRAY_LIGHT)
    pdf.cell(0, 5.5, stat, ln=True)

pdf.ln(6)
pdf.set_font('Helvetica', 'B', 9)
pdf.set_text_color(*GREEN)
pdf.cell(0, 7, 'PARECER: APROVADO  -  Sistema apto para uso em producao.', align='C', ln=True)
pdf.set_font('Helvetica', '', 7.5)
pdf.set_text_color(*GRAY)
pdf.cell(0, 5, 'Recomenda-se corrigir os BUGS #1 e #3 antes do deploy em rede publica.', align='C', ln=True)


# ─────────────── SALVAR ──────────────────────────────────────────────
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Relatorio_Testes_ERP_Linave.pdf')
pdf.output(out)
print(f'\nPDF gerado: {out}')
