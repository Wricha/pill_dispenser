from django.db import models

class Prescription(models.Model):
    image = models.ImageField(upload_to='prescriptions/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

class Medicine(models.Model):
    prescription = models.ForeignKey(Prescription, related_name='medicines', on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    frequency = models.CharField(max_length=100, blank=True)
    bbox_x = models.IntegerField()
    bbox_y = models.IntegerField()
    bbox_width = models.IntegerField()
    bbox_height = models.IntegerField()
    confidence = models.FloatField()
