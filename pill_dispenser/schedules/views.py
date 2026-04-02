
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework import status
from .models import Medication, DosageSchedule
from .serializers import MedicationSerializer
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import Medication
from .models import UserProfile
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import MedicationEvent
from .serializers import MedicationEventSerializer
from .notifications import send_expo_push_notification
from datetime import datetime
from datetime import timedelta
from django.utils import timezone
from .permissions import IsOwner
from django.db import transaction
from datetime import time
import logging
import requests
from django.contrib.auth import get_user_model
from .models import UserProfile

logger = logging.getLogger(__name__)

class MedicationViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows medications to be viewed, created, edited or deleted.
    """
    serializer_class = MedicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        """
        This view should return a list of all the medications
        for the currently authenticated user.
        """
        
        user = self.request.user
        if user.is_authenticated:
            return Medication.objects.filter(user=user).order_by('name')
        return Medication.objects.none()

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        medication = serializer.save(user=self.request.user)
        logger.info(f"Medication {medication.id} created for user {request.user.id}")

        try:
            selected_days = request.data.get('selected_days', [])
            dosages = request.data.get('dosages', [])

            if not isinstance(selected_days, list) or not isinstance(dosages, list):
                raise serializers.ValidationError("Invalid format: 'selected_days' and 'dosages' must be lists.")

            schedules_created = 0
            for day in selected_days:
                if not isinstance(day, str) or not day: 
                     logger.warning(f"Skipping invalid day entry: {day}")
                     continue
                for dosage_info in dosages:
                    if not isinstance(dosage_info, dict):
                        logger.warning(f"Skipping invalid dosage entry: {dosage_info}")
                        continue

                    time_str = dosage_info.get('time')
                    amount = dosage_info.get('amount')

                    if time_str and amount is not None:
                        try:
                            if not isinstance(time_str, str) or len(time_str) != 5 or time_str[2] != ':':
                                 raise ValueError("Time must be in HH:MM format")
                            parsed_time = time.fromisoformat(time_str + ':00') 
                            parsed_amount = float(amount) 

                            DosageSchedule.objects.create(
                                medication=medication,
                                day=day.capitalize(),
                                time=parsed_time,
                                amount=parsed_amount
                            )
                            schedules_created += 1
                            logger.info(f"Created DosageSchedule for med {medication.id} on {day} at {time_str}")
                        except (ValueError, TypeError) as e:
                            logger.error(f"Error parsing/creating schedule for med {medication.id} (Day: {day}, Time: {time_str}, Amount: {amount}): {e}")
                            # Raise validation error!
                            raise serializers.ValidationError(f"Invalid schedule data provided. Error for day '{day}', time '{time_str}', amount '{amount}': {e}")
                    else:
                        logger.warning(f"Skipping dosage for med {medication.id} due to missing time or amount (Day: {day}, Info: {dosage_info})")

        except serializers.ValidationError:
             raise 
        except Exception as e:
            logger.error(f"Unexpected error processing schedule data during Medication creation for user {request.user.id}: {e}", exc_info=True)
            raise serializers.ValidationError("An unexpected error occurred while processing the medication schedule. Please check the data or contact support.")

        headers = self.get_success_headers(serializer.data)
        final_serializer = self.get_serializer(medication)
        return Response(final_serializer.data, status=status.HTTP_201_CREATED, headers=headers)


    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        updated_medication = serializer.save() # Save medication first
        logger.info(f"Medication {updated_medication.id} updated for user {request.user.id}")

        # Check if schedule data is present for update
        if 'selected_days' in request.data or 'dosages' in request.data:
            try:
                current_schedules = list(instance.schedules.values('day', 'time', 'amount')) 
                selected_days = request.data.get('selected_days') 
                dosages = request.data.get('dosages')            

                if selected_days is not None or dosages is not None:
                    selected_days = selected_days if selected_days is not None else []
                    dosages = dosages if dosages is not None else []

                    if not isinstance(selected_days, list) or not isinstance(dosages, list):
                        raise serializers.ValidationError("Invalid format: 'selected_days' and 'dosages' must be lists if provided.")

                    # Delete existing ONLY if new data is provided and valid so far
                    logger.info(f"Replacing existing DosageSchedules for med {instance.id} during update.")
                    instance.schedules.all().delete() # Delete existing schedules

                    schedules_created = 0
                    for day in selected_days:
                        if not isinstance(day, str) or not day: continue
                        for dosage_info in dosages:
                            if not isinstance(dosage_info, dict): continue
                            time_str = dosage_info.get('time')
                            amount = dosage_info.get('amount')
                            if time_str and amount is not None:
                                try:
                                    if not isinstance(time_str, str) or len(time_str) != 5 or time_str[2] != ':':
                                         raise ValueError("Time must be in HH:MM format")
                                    parsed_time = time.fromisoformat(time_str + ':00')
                                    parsed_amount = float(amount)
                                    DosageSchedule.objects.create(
                                        medication=instance, 
                                        day=day.capitalize(),
                                        time=parsed_time,
                                        amount=parsed_amount
                                    )
                                    schedules_created += 1
                                    logger.info(f"Re-created DosageSchedule for med {instance.id} on {day} at {time_str}")
                                except (ValueError, TypeError) as e:
                                    logger.error(f"Error parsing/creating schedule during update for med {instance.id} (Day: {day}, Time: {time_str}, Amount: {amount}): {e}")
                                    raise serializers.ValidationError(f"Invalid schedule data provided during update. Error for day '{day}', time '{time_str}', amount '{amount}': {e}")
                            else:
                                 logger.warning(f"Skipping dosage during update for med {instance.id} due to missing time/amount (Day: {day}, Info: {dosage_info})")

                    logger.info(f"Finished schedule update for med {instance.id}. {schedules_created} schedules created.")

            except serializers.ValidationError:
                 raise 
            except Exception as e:
                logger.error(f"Unexpected error processing schedule data during Medication update for med {instance.id}: {e}", exc_info=True)
                raise serializers.ValidationError("An unexpected error occurred while updating the medication schedule.")

        final_serializer = self.get_serializer(updated_medication)
        return Response(final_serializer.data, status=status.HTTP_200_OK)


class GetScheduledMedication(APIView):
    def get(self, request):
        current_day = datetime.now().strftime('%A').lower()  # e.g., 'monday'
        current_time = datetime.now().time()

        # Query for medications that are scheduled for today
        medications = Medication.objects.filter(selected_days__contains=[current_day])
        
        scheduled_medications = []
        for medication in medications:
            # Check if the current time matches the reminder time for the medication
            if medication.reminder_time <= current_time:
                scheduled_medications.append({
                    'name': medication.name,
                    'reminder_time': str(medication.reminder_time),
                    'dosage': medication.dosages,
                    'stock': medication.stock
                })

        if scheduled_medications:
            return Response(scheduled_medications)
        else:
            return Response({"message": "No scheduled medications at this time."}, status=status.HTTP_404_NOT_FOUND)


class MedicationEventViewSet(viewsets.ModelViewSet):
    queryset = MedicationEvent.objects.all()
    serializer_class = MedicationEventSerializer

    def create(self, request, *args, **kwargs):
        # Perform custom actions before creating the event
        medication_id = request.data.get('medication')
        schedule_id = request.data.get('schedule')
        amount = request.data.get('amount', 1)  # Default to 1 if no amount is provided
        
        try:
            medication = Medication.objects.get(id=medication_id)
            schedule = None
            if schedule_id:
                schedule = DosageSchedule.objects.get(id=schedule_id)
            
            # Get the stock status before dispensing
            stock_before = medication.stock
            stock_after = stock_before - amount
            
            if stock_after < 0:
                return Response({"detail": "Not enough stock available."}, status=status.HTTP_400_BAD_REQUEST)

            # Create the Medication Event
            medication_event = MedicationEvent.objects.create(
                medication=medication,
                schedule=schedule,
                amount=amount,
                success=True,  # Default success is True
                stock_before=stock_before,
                stock_after=stock_after,
            )
            
            # Update medication stock
            medication.stock = stock_after
            medication.save()

            return Response(MedicationEventSerializer(medication_event).data, status=status.HTTP_201_CREATED)

        except Medication.DoesNotExist:
            return Response({"detail": "Medication not found."}, status=status.HTTP_404_NOT_FOUND)
        except DosageSchedule.DoesNotExist:
            return Response({"detail": "Dosage schedule not found."}, status=status.HTTP_404_NOT_FOUND)

# schedules/views.py
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_push_token(request):
    token = request.data.get('expo_push_token')
    if not token:
        return Response({'error': 'No token provided'}, status=400)
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    profile.expo_push_token = token
    profile.save()
    logger.info(f"Saved push token for user {request.user.username}: {token}")
    return Response({'status': 'Token saved'})
    
User = get_user_model()

@api_view(["POST"])
def register_esp32(request):
    """
    ESP32 auto-register endpoint
    """
    device_id = request.data.get("device_id")
    ip_address = request.data.get("ip_address")

    if not all([device_id, ip_address]):
        return Response(
            {"error": "Missing fields"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        profile = UserProfile.objects.get(device_id=device_id)

        # save IP dynamically
        profile.esp32_ip_address = ip_address
        profile.save()

        return Response({
            "message": "ESP32 registered successfully",
            "ip": ip_address
        })

    except UserProfile.DoesNotExist:
        return Response(
            {"error": "Device ID not found or not paired to any user."},
            status=status.HTTP_404_NOT_FOUND
        )

def dispense_pill(medication, slot):
    try:
        # Get ESP32 IP from user's profile
        esp32_ip = medication.user.profile.esp32_ip_address

        if not esp32_ip:
            logger.error("ESP32 IP not configured for user")
            return False

        url = f"http://{esp32_ip}/dispense"

        response = requests.get(
            url,
            params={"slot": slot},
            timeout=5
        )

        if response.status_code == 200:
            logger.info(f"Dispensed successfully from slot {slot}")
            return True
        else:
            logger.error(f"ESP32 error: {response.status_code} {response.text}")
            return False

    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to reach ESP32: {e}")
        return False


