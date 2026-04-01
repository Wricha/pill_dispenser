# schedules/notifications.py
import requests
import logging

logger = logging.getLogger(__name__)

def send_expo_push_notification(expo_push_token, title, message):
    """
    Send a push notification via the Expo Push API.
    """

    # ── 1. Validate token before sending ─────────────────────────────────────
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
        "_contentAvailable": True,   # ensures delivery on iOS background
    }
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",   # required by Expo
        "Content-Type": "application/json",
    }

    try:
        # ── 2. Add timeout — your original had none, causing Celery to hang ──
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()   # raises on 4xx/5xx HTTP errors

        result = response.json()
        logger.info(f"Expo push API response: {result}")

        # ── 3. Check Expo-level errors inside the response body ───────────────
        # HTTP 200 doesn't mean success — Expo puts errors inside the JSON
        data = result.get("data", {})
        status = data.get("status")

        if status == "error":
            error_msg = data.get("message", "Unknown error")
            error_detail = data.get("details", {}).get("error", "")

            logger.error(f"Expo push notification failed — status: error, message: {error_msg}, detail: {error_detail}")

            # Handle specific Expo error codes
            if error_detail == "DeviceNotRegistered":
                logger.warning(f"Token {expo_push_token} is no longer registered. Consider removing it from DB.")
            elif error_detail == "InvalidCredentials":
                logger.error("Expo push credentials are invalid. Check your EAS project config.")
            elif error_detail == "MessageTooBig":
                logger.error("Push notification payload is too large.")
            elif error_detail == "MessageRateExceeded":
                logger.warning("Push notification rate limit hit. Consider batching.")

        elif status == "ok":
            logger.info(f"Push notification sent successfully to {expo_push_token}")

        return result

    except requests.exceptions.Timeout:
        logger.error("send_expo_push_notification: Request timed out after 10s.")
        return None
    except requests.exceptions.ConnectionError:
        logger.error("send_expo_push_notification: Could not connect to Expo push service. Check internet.")
        return None
    except requests.exceptions.HTTPError as e:
        logger.error(f"send_expo_push_notification: HTTP error — {e.response.status_code}: {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"send_expo_push_notification: Unexpected error — {e}", exc_info=True)
        return None