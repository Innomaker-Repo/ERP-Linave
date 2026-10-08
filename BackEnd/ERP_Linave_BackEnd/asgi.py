"""
ASGI config for ERP_LINAVE_BackEnd project.

It exposes the ASGI callable as a module-level variable named ``application``.

HTTP continua servido pelo Django normal (em produção, gunicorn/WSGI — este arquivo só
importa pra quando o processo ASGI roda, ex.: `daphne` local ou o worker de WebSocket em
produção). O roteamento real (HTTP + /ws/workspace/) fica em `routing.py`.
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ERP_Linave_BackEnd.settings')

from .routing import application  # noqa: E402
