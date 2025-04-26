from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from user_authentication.views import register_user, MyTokenObtainPairView
from .views import LogoutView
from .views import SessionLogoutView

urlpatterns = [
    path('api/register/', register_user),
    path('api/token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='auth_logout'),
    path('auth/session-logout/', SessionLogoutView.as_view(), name='auth_session_logout'),
]
