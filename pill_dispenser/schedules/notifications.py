from django.core.mail import send_mail
from django.conf import settings
import requests
import logging

logger = logging.getLogger(__name__)

def send_expo_push_notification(expo_push_token, title, message):
    """
    Send a push notification via the Expo Push API.
    """
    if not expo_push_token:
        logger.warning("send_expo_push_notification: No token provided. Skipping.")
        return None

    if not expo_push_token.startswith("ExponentPushToken["):
        logger.warning(f"send_expo_push_notification: Invalid token format: {expo_push_token}")
        return None

    url = "https://exp.host/--/api/v2/push/send"
    payload = {
        "to": expo_push_token,
        "sound": "default",
        "title": title,
        "body": message,
        "priority": "high",
        "_contentAvailable": True,
    }
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        result = response.json()
        logger.info(f"Expo push API response: {result}")
        return result
    except Exception as e:
        logger.error(f"send_expo_push_notification: Error — {e}", exc_info=True)
        return None

def check_and_send_low_stock_notification(medication):
    """
    Checks if medication stock is below threshold and sends email/push alerts.
    """
    if medication.stock <= medication.reminder:
        user = medication.user
        profile = getattr(user, 'profile', None)
        
        # 1. Send Email
        try:
            subject = f"Low Stock Alert: Your {medication.name} is running low!"
            message = (
                f"Hi {user.username},\n\n"
                f"Your medication '{medication.name}' is running low!\n\n"
                f"Current Stock: {medication.stock}\n"
                f"Reminder Threshold: {medication.reminder}\n\n"
                f"Please refill your medication soon to ensure you don't run out.\n\n"
                f"Best regards,\nYour Medimate App"
            )
            send_mail(
                subject, message, settings.DEFAULT_FROM_EMAIL,
                [user.email], fail_silently=False,
            )
            logger.info(f"Sent low stock email for {medication.name} to {user.email}")
        except Exception as e:
            logger.error(f"Failed to send low stock email: {e}")

        # 2. Send Push Notification
        try:
            expo_token = getattr(profile, 'expo_push_token', None)
            if expo_token:
                push_title = f"⚠️ Low Stock: {medication.name}"
                push_body = f"Only {medication.stock} left (threshold: {medication.reminder}). Please refill soon!"
                send_expo_push_notification(expo_token, push_title, push_body)
                logger.info(f"Sent low stock push notification for {medication.name} to {user.username}")
        except Exception as e:
            logger.error(f"Failed to send low stock push notification: {e}")