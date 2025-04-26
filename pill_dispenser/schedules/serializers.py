from rest_framework import serializers
from .models import Medication, DosageSchedule, MedicationEvent
from django.contrib.auth.models import User

class MedicationSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = Medication
        fields = ['id', 'user', 'name', 'selected_days', 'dosages', 'stock', 'reminder','dispenser_slot']
        read_only_fields = ['user']

class DosageSerializer(serializers.ModelSerializer):
    class Meta:
        model = DosageSchedule
        fields = ['id', 'time', 'amount']

class MedicationEventSerializer(serializers.ModelSerializer):
    medication = serializers.PrimaryKeyRelatedField(queryset=Medication.objects.all())
    schedule = serializers.PrimaryKeyRelatedField(queryset=DosageSchedule.objects.all(), required=False)

    class Meta:
        model = MedicationEvent
        fields = ['id', 'medication', 'schedule', 'timestamp', 'amount', 'success', 'stock_before', 'stock_after', 'esp32_response']
        read_only_fields = ['id', 'timestamp']


