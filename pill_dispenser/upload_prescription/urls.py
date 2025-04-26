from django.urls import path
from .views import process_prescription, update_medicine, get_prescription_medicines


urlpatterns = [
    path('api/prescriptions/process/', process_prescription, name='process_prescription'),
    path('api/prescriptions/<int:prescription_id>/medicines/', get_prescription_medicines, name='get_prescription_medicines'),
    path('api/prescriptions/medicines/<int:medicine_id>/', update_medicine, name='update_medicine'),
]