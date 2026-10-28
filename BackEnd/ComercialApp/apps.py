from django.apps import AppConfig


class ComercialappConfig(AppConfig):
    name = 'ComercialApp'

    def ready(self):
        from django.contrib.auth.signals import user_login_failed

        from .auth_backends import contar_falha_login

        user_login_failed.connect(contar_falha_login, dispatch_uid='comercial_contar_falha_login')
