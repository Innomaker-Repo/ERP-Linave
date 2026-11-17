"""
ASGI config for ERP_LINAVE_BackEnd project.

It exposes the ASGI callable as a module-level variable named ``application``.

Em produção o HTTP é servido pelo gunicorn via WSGI (wsgi.py); este arquivo fica só como
ponto de entrada ASGI padrão do Django.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ERP_Linave_BackEnd.settings')

application = get_asgi_application()
