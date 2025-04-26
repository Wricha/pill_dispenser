# upload_prescription/serializers.py
from rest_framework import serializers
from .models import Medicine, Prescription

class MedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicine
        fields = [ # Specify fields you want to expose
            'id',
            'prescription', # Or maybe prescription_id is enough?
            'name',
            'frequency',
            'bbox_x',
            'bbox_y',
            'bbox_width',
            'bbox_height',
            'confidence',
         ]
        read_only_fields = ['prescription', 'bbox_x', 'bbox_y', 'bbox_width', 'bbox_height', 'confidence'] # Fields not typically updated directly via this serializer

class PrescriptionSerializer(serializers.ModelSerializer):
     # If you want nested medicines in prescription response:
     # medicines = MedicineSerializer(many=True, read_only=True)
     class Meta:
          model = Prescription
          fields = ['id', 'image', 'uploaded_at'] # Add 'medicines' if nested