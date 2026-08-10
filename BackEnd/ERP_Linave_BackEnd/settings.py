import os
from pathlib import Path
from datetime import timedelta

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DJANGO_DEBUG', 'False') == 'True'

DJANGO_ALLOWED = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost')
ALLOWED_HOSTS = [host.strip() for host in DJANGO_ALLOWED.split(',')]


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    "rest_framework",
    "corsheaders",
    "ComercialApp",
    'rest_framework_simplejwt',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'cpf',
    'USER_ID_CLAIM': 'cpf',
}


MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # <--- Coloque aqui, como o primeiro da lista
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'ComercialApp.middleware.APILoggingMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# --- BLINDAGEM DE SEGURANÇA ---

# Impede que o ERP seja renderizado dentro de <iframe> de outros sites (Protege contra Clickjacking)
X_FRAME_OPTIONS = 'DENY'

# Impede que o navegador tente adivinhar o Content-Type (Protege contra Drive-by Downloads maliciosos)
SECURE_CONTENT_TYPE_NOSNIFF = True

# Ativa o filtro de Cross-Site Scripting (XSS) nativo de navegadores mais antigos
SECURE_BROWSER_XSS_FILTER = True

# Confia nos cabeçalhos de HTTPS que o Traefik vai enviar (Crucial para quando colocar SSL)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
#SECURE_SSL_REDIRECT = True  # Redireciona tudo de HTTP para HTTPS

SESSION_COOKIE_SECURE = True  # Garante que o cookie de sessão use HTTPS
CSRF_COOKIE_SECURE = True  # Garante que o cookie anti-CSRF use HTTPS
SESSION_COOKIE_HTTPONLY = True  # Garante que o cookie de sessão não seja acessível via JavaScript

DJANGO_CORS = os.environ.get('DJANGO_CORS_ALLOWED_ORIGINS', 'http://localhost,http://127.0.0.1')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in DJANGO_CORS.split(',')]

ROOT_URLCONF = 'ERP_Linave_BackEnd.urls'
AUTH_USER_MODEL = 'ComercialApp.User'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            os.path.join(BASE_DIR, '../FrontEnd/dist'),
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'ERP_Linave_BackEnd.wsgi.application'

# Usa BigAutoField por padrão em todos os models (elimina os warnings W042).
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'linave_db',
        'USER': 'root',
<<<<<<< HEAD
<<<<<<< HEAD
        #'PASSWORD': 'Kamilinha1-',
        'PASSWORD': 'password@123',
=======
        'PASSWORD': 'Kamilinha1-',
>>>>>>> 9f29e86 (feat: tentativa-merge)
=======
        'PASSWORD': 'password@123',
>>>>>>> 3c3ffb4 (falha integração)
        'HOST': 'localhost',
        'PORT': '3306',
    }
}


# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
    {
        'NAME': 'ComercialApp.validators.SenhaSeguraValidator'
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Em produção quem serve /media é o nginx do container frontend (volume media_data
# montado read-only), rodando com outro usuário que não o do Django. Fixamos as
# permissões para não depender do umask do container: sem isso um upload pode nascer
# ilegível para o nginx e virar 403/404 na hora do download.
FILE_UPLOAD_PERMISSIONS = 0o644
FILE_UPLOAD_DIRECTORY_PERMISSIONS = 0o755

