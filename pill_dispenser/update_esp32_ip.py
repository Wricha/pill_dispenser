import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pill_dispenser.settings')
django.setup()

from schedules.models import UserProfile

if len(sys.argv) != 2:
    print('Error: You did not provide the new IP address!')
    print('Usage: python update_esp32_ip.py <YOUR_NEW_IP>')
    print('Example: python update_esp32_ip.py 192.168.1.5')
    sys.exit(1)

new_ip = sys.argv[1]

for profile in UserProfile.objects.all():
    old_ip = profile.esp32_ip_address
    profile.esp32_ip_address = new_ip
    profile.save()
    print(f"Updated user '{profile.user.username}' ESP32 IP from {old_ip} to {new_ip}")

print('Database successfully updated!')
