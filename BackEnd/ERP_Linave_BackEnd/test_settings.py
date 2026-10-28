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

# Uploads dos testes ficam em memória (não sujam BackEnd/media). DEFAULT_FILE_STORAGE foi
# removido no Django 5.1 e era ignorado — o equivalente atual é STORAGES['default'].
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}

# Os testes fazem muitos logins seguidos do mesmo "IP"; o limite real é testado à parte
# (override_settings em LoginThrottleTests).
LOGIN_THROTTLE_RATE = '10000/min'
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
