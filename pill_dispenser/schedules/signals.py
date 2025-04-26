# schedules/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from django_celery_beat.models import PeriodicTask, CrontabSchedule
from .models import DosageSchedule # Make sure DosageSchedule is imported
from datetime import timezone,datetime, timedelta, time # Import necessary datetime components
import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

@receiver(post_save, sender=DosageSchedule)
def schedule_medication_reminder_task(sender, instance: DosageSchedule, created, **kwargs):
    """
    When a DosageSchedule is CREATED, create a corresponding PeriodicTask
    to send a reminder via Celery Beat.
    """
    if not created:
        # Optional: Handle updates or deletions if needed.
        # This would involve finding and modifying/deleting the existing PeriodicTask.
        # For simplicity, this only handles creation.
        # logger.debug(f"DosageSchedule {instance.id} was updated, not created. Signal skipped.")
        return

    try:
        med = instance.medication
        # Combine today's date with the dosage time to perform time arithmetic
        # Note: This assumes the task should run based on the *server's* date notion combined with the stored time.
        # Be mindful of timezone handling if server/user timezones differ significantly.
        schedule_datetime = datetime.combine(timezone.now().date(), instance.time)

        # Use the 'reminder' field (ensure it contains minutes)
        reminder_minutes = int(med.reminder) # Ensure it's an integer
        if reminder_minutes <= 0:
            logger.info(f"Reminder minutes is {reminder_minutes} for med {med.id}. Skipping task creation for schedule {instance.id}.")
            return

        reminder_offset = timedelta(minutes=reminder_minutes)
        reminder_datetime = schedule_datetime - reminder_offset
        reminder_time = reminder_datetime.time()

        # Convert day name to crontab format (0=Sun, 6=Sat)
        day_of_week_str = day_to_crontab(instance.day)

        # Create or get the CrontabSchedule
        # Timezone must match Celery Beat's timezone setting
        crontab, crontab_created = CrontabSchedule.objects.get_or_create(
            minute=str(reminder_time.minute),         # Use string for crontab part
            hour=str(reminder_time.hour),             # Use string for crontab part
            day_of_week=day_of_week_str,              # e.g., "1" for Monday
            day_of_month='*',                         # Run every month
            month_of_year='*',                        # Run every year
            timezone=settings.CELERY_TIMEZONE         # Use timezone from settings
        )
        if crontab_created:
             logger.info(f"Created new CrontabSchedule: {crontab}")

        # Create the PeriodicTask that Celery Beat will execute
        task_name = f"Medication Reminder: Schedule {instance.id} - {med.name} on {instance.day} at {instance.time}"
        # Use the NEW task name (assuming tasks.py is in 'schedules' app)
        task_function = 'schedules.tasks.send_medication_schedule_reminder'

        PeriodicTask.objects.create(
            crontab=crontab,
            name=task_name, # Unique name for the task
            task=task_function,
            args=json.dumps([instance.id]), # Pass the DosageSchedule ID
            # Optional: Set expires time if the schedule is temporary
            # expires=datetime.now() + timedelta(days=30),
        )
        logger.info(f"Created PeriodicTask '{task_name}' linked to Crontab {crontab.id} to run {task_function}")

    except Exception as e:
        logger.error(f"Error creating periodic task for DosageSchedule {instance.id}: {e}", exc_info=True)


def day_to_crontab(day_name):
    """Converts day string ('Monday', 'Sunday', etc.) to crontab integer string."""
    day_name = day_name.strip().capitalize() # Normalize input
    days = {
        "Sunday": "0", "Monday": "1", "Tuesday": "2",
        "Wednesday": "3", "Thursday": "4", "Friday": "5", "Saturday": "6"
    }
    return days.get(day_name, "*") # Return "*" if day is invalid/not found