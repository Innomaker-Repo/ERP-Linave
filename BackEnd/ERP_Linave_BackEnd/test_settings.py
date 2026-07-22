"""Settings para execução de testes — usa SQLite em memória."""
from .settings import *

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Desabilita migrações demoradas de produção (usa schema direto do model)
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',  # mais rápido para testes
]

# Silencia warnings de media durante testes
DEFAULT_FILE_STORAGE = 'django.core.files.storage.InMemoryStorage'
