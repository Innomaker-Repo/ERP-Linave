"""Executor dos testes (`manage.py test`), configurado em settings.TEST_RUNNER."""
from django.conf import settings
from django.test.runner import DiscoverRunner


class ComercialTestRunner(DiscoverRunner):
    """Desliga na prática o limite de login por minuto (LoginRateThrottle) durante os testes.

    O contador desse limite fica no cache, que — ao contrário do banco — não é desfeito entre
    um teste e outro: com dezenas de testes fazendo login no mesmo minuto, a partir do 21º o
    /token/ respondia 429 e os testes seguintes quebravam sem relação com o que testavam. Os
    testes do próprio limite (LoginThrottleTests) definem a taxa com override_settings e
    limpam o cache antes, então continuam valendo.
    """

    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        settings.LOGIN_THROTTLE_RATE = '10000/min'
