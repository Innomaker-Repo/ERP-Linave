"""
URL configuration for ERP_LINAVE_BackEnd project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
import os
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView
from django.views.static import serve as serve_static
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenVerifyView, TokenRefreshView
from ComercialApp.views import FlexTokenView


urlpatterns = [
    path('jamanta-fiscal/', admin.site.urls),
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('comercial/', include('ComercialApp.urls')),
    path('token/', FlexTokenView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view()),

]

# Serve os documentos enviados (MEDIA) em desenvolvimento. Em produção isso é feito
# pelo servidor web (nginx/whitenoise). O frontend acessa via /media/... (mesmo origem,
# proxiado pelo Vite / túnel ngrok).
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

    # Serve o build do Vite (FrontEnd/dist/assets) quando o Django é acessado direto
    # (porta 8000), sem passar pelo proxy do Vite dev server. A rota '' acima já
    # encontra o dist/index.html via TEMPLATES.DIRS, mas os arquivos que esse HTML
    # referencia em /assets/... nunca ficavam expostos — daí o 404/MIME error no
    # navegador. Em produção isso também é responsabilidade do nginx/whitenoise.
    urlpatterns += static('assets/', document_root=os.path.join(settings.BASE_DIR, '../FrontEnd/dist/assets'))

    # Além de /assets/, o build também copia direto pra raiz do dist/ tudo que está em
    # FrontEnd/public/ (logos, favicon, a imagem de fundo da Proposta, etc.) — sem essa
    # rota, esses arquivos davam 404 quando acessados via :8000 (só funcionavam no `vite
    # dev`, que serve public/ nativamente), e a Proposta em PDF saía sem logo/marca d'água.
    # `static()` não aceita prefixo vazio ("Empty static prefix not permitted"), então usa
    # `django.views.static.serve` direto via re_path. Fica por último pra só pegar o que
    # nenhuma rota mais específica acima já resolveu.
    urlpatterns += [
        re_path(r'^(?P<path>[^/]+\.[A-Za-z0-9]+)$', serve_static, {
            'document_root': os.path.join(settings.BASE_DIR, '../FrontEnd/dist'),
        }),
    ]