from rest_framework import serializers
from .models import Medication, DosageSchedule, MedicationEvent
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import datetime

class MedicationSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    status_today = serializers.SerializerMethodField()

    class Meta:
        model = Medication
        fields = ['id', 'user', 'name', 'selected_days', 'dosages', 'stock', 'reminder', 'dispenser_slot', 'status_today']
        read_only_fields = ['user']

    def get_status_today(self, obj):
        """
        Returns a list of times that have been dispensed successfully today.
        Includes both scheduled and manual dispenses.
        """
        today = timezone.localdate()
        # Get all successful dispensing events for this medication today
        events = MedicationEvent.objects.filter(
            medication=obj,
            timestamp__date=today,
            success=True
        ).select_related('schedule')

        taken_times = []
        for event in events:
            if event.schedule:
                # Add the scheduled time (e.g. "08:00")
                taken_times.append(event.schedule.time.strftime("%H:%M"))
            else:
                # For manual dispenses, add the event's local timestamp time
                local_time = timezone.localtime(event.timestamp)
                taken_times.append(local_time.strftime("%H:%M"))
        
        return list(set(taken_times))

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
