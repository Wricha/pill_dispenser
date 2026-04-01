# upload_prescription/views.py

from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Prescription, Medicine
from .serializers import MedicineSerializer
from django.conf import settings

from PIL import Image, UnidentifiedImageError
import google.generativeai as genai
import io
import json
import traceback

# ── Configure Gemini ──────────────────────────────────────────────────────────
genai.configure(api_key=settings.GEMINI_API_KEY)
gemini_model = genai.GenerativeModel("gemini-2.5-flash")

# ── Extraction prompt ─────────────────────────────────────────────────────────
EXTRACTION_PROMPT = """
You are a medical prescription parser. Carefully analyze this prescription image.

Extract ALL medicines and return ONLY a valid JSON object in this exact format (no markdown, no extra text):
{
  "medicines": [
    {
      "name": "medicine name, strength and when to take — e.g. Amoxicillin 500mg after meals",
      "frequency": "how often to take — e.g. 3 times a day, every 8 hours, twice daily"
    }
  ]
}

Rules:
- Return ONLY the JSON object, no preamble or markdown fences
- Pack the dosage, timing, and duration into the 'name' field since that is all we store
- If frequency is not mentioned, set it to an empty string ""
- Extract every medicine listed
"""


# ── Helper ────────────────────────────────────────────────────────────────────
def extract_medicines_with_gemini(image_bytes: bytes) -> list[dict]:
    img_pil = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB to avoid issues with RGBA/palette PNGs
    if img_pil.mode != "RGB":
        img_pil = img_pil.convert("RGB")

    response = gemini_model.generate_content([EXTRACTION_PROMPT, img_pil])
    raw_text = response.text.strip()
    print(f"DEBUG: Raw Gemini response: {raw_text[:500]}")  # Log first 500 chars

    clean = raw_text.replace("```json", "").replace("```", "").strip()
    data = json.loads(clean)
    return data.get("medicines", [])


# ── Views ─────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_prescription(request):
    print("--- PROCESS PRESCRIPTION VIEW STARTED ---")

    if 'image' not in request.FILES:
        return Response({'error': 'No image provided'}, status=status.HTTP_400_BAD_REQUEST)

    image_file = request.FILES['image']
    print(f"DEBUG: Received file — name: {image_file.name}, content_type: {image_file.content_type}, size: {image_file.size} bytes")

    if not image_file.content_type.startswith('image/'):
        return Response({'error': 'Uploaded file is not a valid image.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        image_bytes = image_file.read()
        image_file.seek(0)
        print(f"DEBUG: Read {len(image_bytes)} bytes from uploaded file")

        # Validate image
        try:
            test_img = Image.open(io.BytesIO(image_bytes))
            test_img.verify()
            print(f"DEBUG: Image verified — format: {test_img.format}, mode: {test_img.mode}")
        except UnidentifiedImageError:
            return Response(
                {'error': 'Cannot identify image file. Please upload a valid image (JPEG, PNG, etc.).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save Prescription to DB
        prescription = Prescription()
        prescription.image = image_file
        prescription.save()
        print(f"DEBUG: Saved Prescription ID: {prescription.id}")

        # Check API key is configured
        api_key = getattr(settings, 'GEMINI_API_KEY', None)
        if not api_key or api_key == "your_gemini_api_key_here":
            print("ERROR: GEMINI_API_KEY is not set in settings!")
            prescription.delete()
            return Response(
                {'error': 'Gemini API key is not configured on the server.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        print(f"DEBUG: GEMINI_API_KEY found (starts with: {api_key[:8]}...)")

        # Call Gemini
        print("DEBUG: Calling Gemini API...")
        try:
            extracted = extract_medicines_with_gemini(image_bytes)
            print(f"DEBUG: Gemini returned {len(extracted)} medicine(s): {extracted}")

        except json.JSONDecodeError as e:
            print(f"ERROR: JSON parse failed — {e}")
            prescription.delete()
            return Response(
                {'error': 'AI model returned an unexpected response. Please try again.'},
                status=status.HTTP_502_BAD_GATEWAY
            )
        except Exception as e:
            # Print the FULL error so we can see exactly what Gemini returned
            print(f"ERROR: Gemini API call failed — type: {type(e).__name__}")
            print(f"ERROR: Gemini error message: {str(e)}")
            traceback.print_exc()
            prescription.delete()
            return Response(
                {'error': f'Gemini error: {str(e)}'},   # <-- now returns actual error
                status=status.HTTP_502_BAD_GATEWAY
            )

        # Save medicines using original model fields
        medicines_data = []
        for item in extracted:
            name      = item.get('name') or 'Unknown'
            frequency = item.get('frequency') or ''

            medicine = Medicine(
                prescription=prescription,
                name=name,
                frequency=frequency,
                bbox_x=0,
                bbox_y=0,
                bbox_width=0,
                bbox_height=0,
                confidence=0.0,
            )
            medicine.save()
            print(f"DEBUG: Saved Medicine ID: {medicine.id} — {name}")

            medicines_data.append({
                'id':         medicine.id,
                'name':       medicine.name,
                'frequency':  medicine.frequency,
                'bbox':       [medicine.bbox_x, medicine.bbox_y, medicine.bbox_width, medicine.bbox_height],
                'confidence': medicine.confidence,
            })

        print("--- PROCESS PRESCRIPTION VIEW FINISHED SUCCESSFULLY ---")
        return Response({
            'prescription_id': prescription.id,
            'image_url': prescription.image.url if prescription.image else None,
            'medicines': medicines_data,
        }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"ERROR: Critical error — {type(e).__name__}: {e}")
        traceback.print_exc()
        return Response(
            {'error': f'Server error: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_medicine(request, medicine_id):
    try:
        medicine = Medicine.objects.get(id=medicine_id)

        new_name      = request.data.get('name', medicine.name)
        new_frequency = request.data.get('frequency', medicine.frequency)

        if not new_name:
            return Response({'error': 'Medicine name cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        medicine.name      = new_name
        medicine.frequency = new_frequency
        medicine.save()

        return Response({
            'id':        medicine.id,
            'name':      medicine.name,
            'frequency': medicine.frequency,
        }, status=status.HTTP_200_OK)

    except Medicine.DoesNotExist:
        return Response({'error': 'Medicine not found.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        print(f"ERROR: update_medicine (ID: {medicine_id}): {e}")
        traceback.print_exc()
        return Response({'error': 'Failed to update medicine.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_prescription_medicines(request, prescription_id):
    try:
        prescription = Prescription.objects.get(id=prescription_id)
        medicines    = Medicine.objects.filter(prescription=prescription)
        serializer   = MedicineSerializer(medicines, many=True)
        return Response(serializer.data)
    except Prescription.DoesNotExist:
        return Response({'error': 'Prescription not found.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        print(f"ERROR: get_prescription_medicines: {e}")
        return Response({'error': 'Failed to retrieve medicines.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)