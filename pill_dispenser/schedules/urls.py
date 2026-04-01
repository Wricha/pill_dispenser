from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MedicationViewSet, MedicationEventViewSet, register_esp32, save_push_token

router = DefaultRouter()
router.register(r'medications', MedicationViewSet, basename='medication')
router.register(r'medication-events', MedicationEventViewSet, basename='medication-event')

urlpatterns = [
    path('api/', include(router.urls)),
    path("devices/register/", register_esp32),
    path('api/save-push-token/', save_push_token, name='save_push_token'),
]