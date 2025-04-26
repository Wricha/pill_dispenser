# schedules/tasks.py

# Add requests import
import requests
from celery import shared_task
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model
# Import your models
from .models import DosageSchedule, Medication, UserProfile,MedicationEvent

import logging
from datetime import date, datetime, timedelta 

logger = logging.getLogger(__name__) 

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_reminder_emails_task(self):
    """
    Fetches and sends medication reminders EXACTLY AT the scheduled time
    AND signals the configured ESP32 to dispense.
    This task should run frequently via Celery Beat (e.g., every minute).
    """
    # Use timezone-aware current time based on Django settings
    now = timezone.localtime()
    current_day_name = now.strftime('%A')
    # Get the current time truncated to the minute (HH:MM), ignoring seconds/microseconds
    current_time_minute = now.time().replace(second=0, microsecond=0)

    logger.info(f"Running dispenser task check for schedules due at: {current_time_minute} on {current_day_name}")

    schedules_due_now = DosageSchedule.objects.filter(
        day__iexact=current_day_name, # Case-insensitive match for day name
        time=current_time_minute      # Exact match for HH:MM
    ).select_related(
        'medication__user__profile' # Pre-fetch medication, user, AND user profile
    )

    sent_reminders = 0
    failed_reminders = 0
    sent_esp_signals = 0
    failed_esp_signals = 0
    sent_stock_alerts = 0
    medication_events_created = 0

    if not schedules_due_now.exists():
        logger.info("No medication schedules due at this exact minute.")
        # Return early as there's nothing to process
        return "No schedules due now."

    for schedule in schedules_due_now:
        medication = None
        user = None
        profile = None
        try:
            # Access related objects efficiently due to select_related
            medication = schedule.medication
            user = medication.user
            # Try accessing profile, handle if it might not exist (though signals should create it)
            profile = getattr(user, 'profile', None)

            # --- 1. Send Email Reminder ---
            # Check if user is active and has an email
            if user.is_active and user.email:
                try:
                    # Construct the email subject and message
                    subject = f"Pill Reminder: Time for your {medication.name} dose!"
                    dose_time_str = schedule.time.strftime("%I:%M %p") # Format time as e.g., 08:30 AM
                    message = (
                        f"Hi {user.username},\n\n"
                        f"It's time to take your dose of {medication.name} ({schedule.amount} units) "
                        f"scheduled for {dose_time_str} today ({schedule.day}).\n\n"
                        f"Current Stock: {medication.stock}\n\n"
                        f"Best regards,\nYour Medimate App" # Or your app name
                    )

                    logger.debug(f"Attempting medication reminder email to {user.email} for schedule ID {schedule.id}")

                    send_mail(
                        subject, message, settings.DEFAULT_FROM_EMAIL,
                        [user.email], fail_silently=False,
                    )

                    logger.info(f"Successfully sent medication reminder email to {user.email} for schedule ID {schedule.id}")
                    sent_reminders += 1
                except Exception as mail_exc:
                    logger.error(f"Failed to send medication reminder email to {user.email} for schedule ID {schedule.id}: {mail_exc}", exc_info=True)
                    failed_reminders += 1
            else:
                logger.warning(f"Skipping reminder email for schedule {schedule.id}. User {user.username} is inactive or has no email.")

            # --- 2. Signal ESP32 ---
            esp_ip = getattr(profile, 'esp32_ip_address', None) if profile else None
            dispenser_slot = getattr(medication, 'dispenser_slot', None)

            if esp_ip and dispenser_slot is not None:
                try:
                    # Construct the URL (adjust '/dispense' and 'slot' parameter if your ESP32 code expects different)
                    esp_url = f"http://{esp_ip}/dispense"
                    params = {'slot': dispenser_slot}
                    logger.debug(f"Attempting to signal ESP32 at {esp_url} with params {params} for schedule ID {schedule.id}")

                    # Store current stock for event tracking
                    stock_before = medication.stock
                    
                    # Send GET request with timeout
                    response = requests.get(esp_url, params=params, timeout=10) # 10-second timeout
                    response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
                    
                    # Get response content for event tracking
                    esp32_response = response.text[:200]  # Limit text size to avoid db issues
                    
                    logger.info(f"Successfully signaled ESP32 at {esp_ip} for slot {dispenser_slot} (Schedule ID: {schedule.id}). Status: {response.status_code}")
                    sent_esp_signals += 1
                    
                    # --- 3. UPDATE STOCK COUNT AFTER SUCCESSFUL DISPENSE ---
                    if medication.stock > 0:
                        medication.stock -= 1
                        medication.save()
                        stock_after = medication.stock
                        logger.info(f"Decreased stock of '{medication.name}' to {medication.stock} after successful dispense.")
                        
                        # --- 4. CREATE MEDICATION EVENT RECORD ---
                        try:
                            event = MedicationEvent.objects.create(
                                medication=medication,
                                schedule=schedule,
                                amount=schedule.amount,
                                success=True,
                                stock_before=stock_before,
                                stock_after=stock_after,
                                esp32_response=esp32_response
                            )
                            logger.info(f"Created MedicationEvent record ID {event.id} for '{medication.name}' dispense")
                            medication_events_created += 1
                        except Exception as event_exc:
                            logger.error(f"Failed to create MedicationEvent for '{medication.name}' (ID: {medication.id}): {event_exc}", exc_info=True)
                        
                        # --- 5. CHECK IF STOCK IS BELOW REMINDER THRESHOLD ---
                        if medication.stock <= medication.reminder:
                            try:
                                # Send stock alert email
                                stock_subject = f"Low Stock Alert: Your {medication.name} is running low!"
                                stock_message = (
                                    f"Hi {user.username},\n\n"
                                    f"Your medication '{medication.name}' is running low!\n\n"
                                    f"Current Stock: {medication.stock}\n"
                                    f"Reminder Threshold: {medication.reminder}\n\n"
                                    f"Please refill your medication soon to ensure you don't run out.\n\n"
                                    f"Best regards,\nYour Medimate App"
                                )
                                
                                send_mail(
                                    stock_subject, stock_message, settings.DEFAULT_FROM_EMAIL,
                                    [user.email], fail_silently=False,
                                )
                                
                                logger.info(f"Sent low stock alert email for '{medication.name}' (ID: {medication.id}) to {user.email}. Stock: {medication.stock}, Threshold: {medication.reminder}")
                                sent_stock_alerts += 1
                            except Exception as stock_mail_exc:
                                logger.error(f"Failed to send stock alert email for '{medication.name}' (ID: {medication.id}) to {user.email}: {stock_mail_exc}", exc_info=True)
                    else:
                        logger.warning(f"Stock of '{medication.name}' is already 0. Not decrementing further.")
                        
                        # Create event record even when stock is 0
                        try:
                            event = MedicationEvent.objects.create(
                                medication=medication,
                                schedule=schedule,
                                amount=schedule.amount,
                                success=True,  # Dispense still worked even if stock is 0
                                stock_before=0,
                                stock_after=0,
                                esp32_response=esp32_response
                            )
                            logger.info(f"Created MedicationEvent record ID {event.id} for '{medication.name}' dispense (zero stock)")
                            medication_events_created += 1
                        except Exception as event_exc:
                            logger.error(f"Failed to create MedicationEvent (zero stock) for '{medication.name}' (ID: {medication.id}): {event_exc}", exc_info=True)

                except requests.exceptions.Timeout:
                    logger.error(f"Timeout error signaling ESP32 at {esp_ip} for slot {dispenser_slot} (Schedule ID: {schedule.id}).")
                    failed_esp_signals += 1
                    
                    # Create failed event record
                    try:
                        event = MedicationEvent.objects.create(
                            medication=medication,
                            schedule=schedule,
                            amount=schedule.amount,
                            success=False,
                            stock_before=medication.stock,
                            stock_after=medication.stock,  # No change in stock
                            esp32_response="Timeout error"
                        )
                        logger.info(f"Created failed MedicationEvent record ID {event.id} due to timeout")
                        medication_events_created += 1
                    except Exception as event_exc:
                        logger.error(f"Failed to create failed MedicationEvent record: {event_exc}", exc_info=True)
                        
                except requests.exceptions.ConnectionError:
                    logger.error(f"Connection error signaling ESP32 at {esp_ip} for slot {dispenser_slot} (Schedule ID: {schedule.id}). Check IP and network.")
                    failed_esp_signals += 1
                    
                    # Create failed event record
                    try:
                        event = MedicationEvent.objects.create(
                            medication=medication,
                            schedule=schedule,
                            amount=schedule.amount,
                            success=False,
                            stock_before=medication.stock,
                            stock_after=medication.stock,  # No change in stock
                            esp32_response="Connection error"
                        )
                        logger.info(f"Created failed MedicationEvent record ID {event.id} due to connection error")
                        medication_events_created += 1
                    except Exception as event_exc:
                        logger.error(f"Failed to create failed MedicationEvent record: {event_exc}", exc_info=True)
                        
                except requests.exceptions.RequestException as req_exc:
                    logger.error(f"Error signaling ESP32 at {esp_ip} for slot {dispenser_slot} (Schedule ID: {schedule.id}): {req_exc}", exc_info=True)
                    failed_esp_signals += 1
                    
                    # Create failed event record
                    try:
                        event = MedicationEvent.objects.create(
                            medication=medication,
                            schedule=schedule,
                            amount=schedule.amount,
                            success=False,
                            stock_before=medication.stock,
                            stock_after=medication.stock,  # No change in stock
                            esp32_response=str(req_exc)[:200]  # Limit text size
                        )
                        logger.info(f"Created failed MedicationEvent record ID {event.id} due to request exception")
                        medication_events_created += 1
                    except Exception as event_exc:
                        logger.error(f"Failed to create failed MedicationEvent record: {event_exc}", exc_info=True)
            else:
                # Log why signal wasn't sent
                if not profile:
                     logger.warning(f"Skipping ESP32 signal for schedule {schedule.id}: User {user.username} has no profile.")
                elif not esp_ip:
                    logger.warning(f"Skipping ESP32 signal for schedule {schedule.id}: User {user.username} has no ESP32 IP configured in profile.")
                if dispenser_slot is None: # Check separately
                    logger.warning(f"Skipping ESP32 signal for schedule {schedule.id}: Medication '{medication.name}' has no dispenser slot assigned.")

        except Exception as outer_exc:
            # Catch errors accessing medication/user/profile itself
            user_identifier = user.username if user else 'unknown user'
            logger.error(f"Outer error processing schedule ID {schedule.id} for user {user_identifier}: {outer_exc}", exc_info=True)
            # Increment general failure counts if specific ones weren't hit
            if 'mail_exc' not in locals(): failed_reminders += 1
            if 'req_exc' not in locals() and 'esp_ip' in locals() and esp_ip: failed_esp_signals += 1


    result_message = (
        f"Dispenser Task finished check for {current_time_minute}. "
        f"Emails - Sent: {sent_reminders}, Failed: {failed_reminders}. "
        f"ESP32 Signals - Sent: {sent_esp_signals}, Failed: {failed_esp_signals}. "
        f"Stock Alerts - Sent: {sent_stock_alerts}. "
        f"Medication Events - Created: {medication_events_created}."
    )
    logger.info(result_message)
    return result_message




# --- Other tasks remain unchanged ---

# Reminder task triggered by signal (runs *before* dose time based on Medication.reminder)
@shared_task(bind=True, max_retries=3, default_retry_delay=120)
def send_medication_schedule_reminder(self, schedule_id):
    # ... (keep existing implementation - this is for *advance* email reminders) ...
    logger.info(f"Running send_medication_schedule_reminder for schedule_id: {schedule_id}")
    UserModel = get_user_model()
    try:
        schedule = DosageSchedule.objects.select_related('medication__user').get(pk=schedule_id)
        medication = schedule.medication
        user = medication.user # Get user from the related Medication

        if not user.is_active or not user.email:
            logger.warning(f"Skipping reminder for schedule {schedule_id}. User {user.username} is inactive or has no email.")
            return f"User {user.username} skipped (inactive or no email)."

        subject = f"Pill Reminder: Time for your {medication.name} dose!"
        # Format time for readability
        dose_time_str = schedule.time.strftime("%I:%M %p") # e.g., 08:30 AM
        message = (
            f"Hi {user.get_full_name() or user.username},\n\n"
            f"This is a reminder to take your dose of {medication.name} ({schedule.amount} units) "
            f"scheduled for {schedule.day} at {dose_time_str}.\n\n"
            f"Current Stock (if tracked): {medication.stock}\n\n" # Optional: add stock info
            f"Best regards,\nYour Medimate App"
        )

        logger.debug(f"Attempting medication reminder email to {user.email} for schedule {schedule_id}")
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
        logger.info(f"Successfully sent medication reminder to {user.email} for schedule {schedule_id}")
        return f"Sent medication reminder to {user.email} for schedule {schedule_id}"

    except DosageSchedule.DoesNotExist:
        logger.error(f"DosageSchedule with ID {schedule_id} not found.")
        # Don't retry if the schedule doesn't exist
        return f"DosageSchedule {schedule_id} not found."
    except AttributeError as e:
        # Could happen if user relationship is missing or incorrectly set up
        logger.error(f"AttributeError fetching user/medication for schedule {schedule_id}: {e}", exc_info=True)
        return f"Error fetching related data for schedule {schedule_id}."
    except Exception as exc:
        user_id_str = user.id if 'user' in locals() and hasattr(user, 'id') else 'unknown'
        logger.error(f"Failed sending medication reminder for schedule {schedule_id} to user ID {user_id_str}: {exc}", exc_info=True)
        # Retry the task using Celery's mechanism
        try:
            raise self.retry(exc=exc)
        except Exception as retry_exc: # Catch potential retry errors too
            logger.error(f"Celery retry failed for schedule {schedule_id}: {retry_exc}")
            return f"Failed sending reminder for schedule {schedule_id} after retries."


# Generic single reminder task
@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_single_reminder(self, user_id):
    # ... (keep existing implementation) ...
    UserModel = get_user_model()
    try:
        user = UserModel.objects.get(pk=user_id)
        if not user.is_active or not user.email:
            logger.warning(f"Skipping single reminder for inactive/emailless user ID {user_id}")
            return "User skipped."

        today = timezone.localdate()
        subject = f"Friendly Reminder, {user.get_full_name() or user.username}!"
        message = f"Hi {user.get_full_name() or user.username},\n\nThis is your scheduled reminder for {today}.\n\nHave a great day!\n\nBest regards,\nYour App"

        logger.debug(f"Attempting single reminder email to {user.email}")
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
        logger.info(f"Successfully sent single reminder to {user.email}")
        # Update state if needed
        return f"Sent reminder to {user.email}"

    except UserModel.DoesNotExist:
        logger.error(f"User with ID {user_id} not found for single reminder.")
        # Don't retry if user doesn't exist
        return "User not found."
    except Exception as exc:
        logger.error(f"Failed sending single reminder to user ID {user_id}: {exc}", exc_info=True)
        # Retry the task using Celery's mechanism
        try:
            raise self.retry(exc=exc)
        except Exception as retry_exc:
            logger.error(f"Celery retry failed for user {user_id}: {retry_exc}")
            return f"Failed sending reminder for user {user_id} after retries."
        



@shared_task
def dispense_scheduled_medications():
    now = timezone.localtime()
    today = now.strftime("%A")
    current_time = now.time().replace(second=0, microsecond=0)

    matching_schedules = DosageSchedule.objects.filter(day=today, time=current_time)

    sent_esp_signals = 0

    for schedule in matching_schedules:
        medication = schedule.medication
        user = medication.user

        esp_ip = user.profile.esp32_ip_address
        dispenser_slot = medication.dispenser_slot

        if not dispenser_slot or not esp_ip:
            logger.warning(f"Missing dispenser slot or ESP32 IP for {medication}. Skipping.")
            continue

        try:
            response = requests.post(
                f"http://{esp_ip}/dispense",
                json={"slot": dispenser_slot, "amount": schedule.amount},
                timeout=5
            )
            if response.status_code == 200:
                logger.info(f"✅ Successfully signaled ESP32 at {esp_ip} for slot {dispenser_slot} (Schedule ID: {schedule.id}). Status: {response.status_code}")
                sent_esp_signals += 1

                if medication.stock > 0:
                    medication.stock -= 1
                    medication.save()
                    logger.info(f"Decreased stock of '{medication.name}' to {medication.stock} after successful dispense.")
                else:
                    logger.warning(f"Stock of '{medication.name}' is already 0. Not decrementing further.")
            else:
                logger.error(f"❌ Failed to signal ESP32 for {medication}. Status code: {response.status_code}")
        except requests.RequestException as e:
            logger.error(f"❌ Error signaling ESP32 for {medication}: {e}")

    logger.info(f"ESP signals sent: {sent_esp_signals}")
