from pathlib import Path
from datetime import timedelta
import os
# Build paths inside the project like this: BASE_DIR / 'subdir'.

BASE_DIR = Path(__file__).resolve().parent.parent

# Quick-start development settings - unsuitable for production

# See https://docs.djangoproject.com/en/5.1/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!

SECRET_KEY = "django-insecure-&6-8d6c6l98fs2&w5q1*r9f3legx2w&eny07zs*n+opr01_w0!"

ROBOFLOW_API_KEY = "MsN2q6uZAFf2kf47c7f1"

MEDIA_URL = '/media/'

MEDIA_ROOT = os.path.join(BASE_DIR, 'media') # Or your actual path

# SECURITY WARNING: don't run with debug turned on in production!

DEBUG = True



ALLOWED_HOSTS = ['192.168.1.74', 'localhost','100.64.220.170','192.168.132.48','127.0.0.1','192.168.31.7','192.168.198.48','192.168.1.76','192.168.1.75','192.168.156.48','192.168.186.48','192.168.1.69','192.168.2.132','192.168.22.48','192.168.2.158','192.168.95.48']

CORS_ALLOWED_ORIGINS = [

"http://192.168.1.74:8000",
"http://localhost:8000",
"http://100.64.220.170:8000",
"http://192.168.132.48:8000",
"http://192.168.1.69:8000",
"http://192.168.198.48:8000",
"http://192.168.1.76:8000",
"http://192.168.1.75:8000",
"http://192.168.156.48:8000",
"http://192.168.2.132:8000",
"http://192.168.22.48:8000",
"http://192.168.2.158:8000",
"http://192.168.95.48:8000",
]

# Application definition

INSTALLED_APPS = [
"django.contrib.admin",
"django.contrib.auth",
"django.contrib.contenttypes",
"django.contrib.sessions",
"django.contrib.messages",
"django.contrib.staticfiles",
"rest_framework",
"schedules",
"corsheaders",
"user_authentication",
"rest_framework.authtoken",
"django_celery_beat",
"django_celery_results",
"upload_prescription"
]

MIDDLEWARE = [
"django.middleware.security.SecurityMiddleware",
"corsheaders.middleware.CorsMiddleware",
"django.contrib.sessions.middleware.SessionMiddleware",
"django.middleware.common.CommonMiddleware",
"django.middleware.csrf.CsrfViewMiddleware",
"django.contrib.auth.middleware.AuthenticationMiddleware",
"django.contrib.messages.middleware.MessageMiddleware",
"django.middleware.clickjacking.XFrameOptionsMiddleware",
]



CORS_ALLOW_ALL_ORIGINS = True



REST_FRAMEWORK = {
'DEFAULT_AUTHENTICATION_CLASSES': (
'rest_framework_simplejwt.authentication.JWTAuthentication',
)
}



ROOT_URLCONF = "pill_dispenser.urls"



TEMPLATES = [
{
"BACKEND": "django.template.backends.django.DjangoTemplates",
"DIRS": [],
"APP_DIRS": True,
"OPTIONS": {
"context_processors": [
"django.template.context_processors.debug",
"django.template.context_processors.request",
"django.contrib.auth.context_processors.auth",
"django.contrib.messages.context_processors.messages",
],
},
},
]



WSGI_APPLICATION = "pill_dispenser.wsgi.application"





# Database

# https://docs.djangoproject.com/en/5.1/ref/settings/#databases



DATABASES = {

"default": {

"ENGINE": "django.db.backends.sqlite3",

"NAME": BASE_DIR / "db.sqlite3",

}

}



# Password validation

# https://docs.djangoproject.com/en/5.1/ref/settings/#auth-password-validators



AUTH_PASSWORD_VALIDATORS = [

{
"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
},

{
"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
},
{
"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
},
{
"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
},
]

# Internationalization
# https://docs.djangoproject.com/en/5.1/topics/i18n/

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kathmandu"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.1/howto/static-files/


STATIC_URL = "static/"

# Default primary key field type

# https://docs.djangoproject.com/en/5.1/ref/settings/#default-auto-field


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
CELERY_BROKER_URL = 'redis://localhost:6380/0'
CELERY_RESULT_BACKEND = 'django-db'
CELERY_CACHE_BACKEND = 'django-cache'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'


EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

EMAIL_HOST = 'smtp.gmail.com'

EMAIL_PORT = 587

EMAIL_USE_TLS = True

EMAIL_HOST_USER = 'wricha.singh01@gmail.com'

EMAIL_HOST_PASSWORD = 'swfjjgqzuvtfdsvd'

DEFAULT_FROM_EMAIL = 'wricha.singh01@gmail.com'# use an app-specific password if 2FA

