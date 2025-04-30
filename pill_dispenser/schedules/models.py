
from django.db import models
from django.conf import settings # To get the User model
from django.db.models import UniqueConstraint, Max
from django.db.models.signals import post_save
from django.dispatch import receiver


class Medication(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='medications',
    )
    
    name = models.CharField(max_length=255)
    selected_days = models.JSONField()  # Store selected days as a JSON array
    dosages = models.JSONField()  # Store dosages as a JSON array of objects
    stock = models.IntegerField()
    reminder = models.IntegerField()
    dispenser_slot = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['user', 'dispenser_slot'] 
        constraints = [
            # Ensure a user cannot have two medications assigned to the same slot
            UniqueConstraint(fields=['user', 'dispenser_slot'], name='unique_user_dispenser_slot')
        ]

    def __str__(self):
        return f"{self.name} ({self.user.username})" 

class DosageSchedule(models.Model):
    medication = models.ForeignKey(Medication, on_delete=models.CASCADE, related_name='schedules')
    day = models.CharField(max_length=10)  
    time = models.TimeField()
    amount = models.FloatField()

    def __str__(self):
        return f"{self.medication.name} on {self.day} at {self.time} for {self.medication.user.username}"

class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile' 
    )
    esp32_ip_address = models.GenericIPAddressField(
    verbose_name="ESP32 IP Address",
    protocol='IPv4',
    blank=True,
    null=True,
    default="192.168.1.86"  
)

    def __str__(self):
        return f"Profile for {self.user.username}"

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()
    else:
        UserProfile.objects.get_or_create(user=instance)

# Add this to your models.py

class MedicationEvent(models.Model):
    """
    Model to track each medication dispensing event
    """
    medication = models.ForeignKey(
        Medication, 
        on_delete=models.CASCADE, 
        related_name='events'
    )
    schedule = models.ForeignKey(
        DosageSchedule,
        on_delete=models.SET_NULL,
        related_name='events',
        null=True,
        blank=True
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    amount = models.FloatField()
    success = models.BooleanField(default=True)


    stock_before = models.IntegerField(null=True, blank=True)
    stock_after = models.IntegerField(null=True, blank=True)
    esp32_response = models.TextField(null=True, blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        
    def __str__(self):
        return f"{self.medication.name} - {self.timestamp.strftime('%Y-%m-%d %H:%M')}"
   