from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MedicationViewSet, MedicationEventViewSet

router = DefaultRouter()
router.register(r'medications', MedicationViewSet, basename='medication')
router.register(r'medication-events', MedicationEventViewSet, basename='medication-event')

urlpatterns = [
    path('api/', include(router.urls)),
]