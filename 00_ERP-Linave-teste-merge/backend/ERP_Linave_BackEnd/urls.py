from django.contrib import admin
from django.urls import include, path
from django.views.generic import TemplateView
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

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)