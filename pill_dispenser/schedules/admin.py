from django.contrib import admin
from .models import DosageSchedule


# schedules/admin.py
from django.contrib import admin
from .models import Medication, DosageSchedule, MedicationEvent, UserProfile

# Simple registration (shows default representation)
admin.site.register(Medication)
admin.site.register(DosageSchedule)
admin.site.register(MedicationEvent)
admin.site.register(UserProfile)

