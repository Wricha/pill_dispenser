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

genai.configure(api_key=settings.GEMINI_API_KEY)

# Use a default model, but our extraction logic will try fallbacks
DEFAULT_GEMINI_MODEL = "gemini-1.5-flash"

# ── Extraction prompt ─────────────────────────────────────────────────────────
EXTRACTION_PROMPT = """
You are a highly accurate medical prescription parser. Your task is to analyze the provided image of a medical prescription and extract all listed medications.

For each medication, identify:
1. The **name**, **strength** (e.g., 500mg), and **form** (e.g., Tablet/Capsule).
2. The **dosage instructions** (e.g., 1 tablet twice daily after meals).
3. The **frequency** of intake.

Return the results EXCLUSIVELY as a valid JSON object. Do not include any preamble, conversational text, or markdown formatting outside of the JSON block.

Expected JSON structure:
{
  "medicines": [
    {
      "name": "Full name including strength and form (e.g., 'Amoxicillin 500mg Tablet')",
      "frequency": "Frequency of intake (e.g., 'Twice daily', 'Every 8 hours')",
      "dosage_instructions": "Full specific instructions (e.g., '1 tab twice daily after meals for 7 days')"
    }
  ]
}

If a field is not clear or not mentioned, use an empty string "". Ensure every distinct medication in the image is captured.
"""


# ── Helper ────────────────────────────────────────────────────────────────────
def extract_medicines_with_gemini(image_bytes: bytes) -> list[dict]:
    import re
    img_pil = Image.open(io.BytesIO(image_bytes))

    if img_pil.mode != "RGB":
        img_pil = img_pil.convert("RGB")

    # List of models to try in order of preference
    # Note: Our diagnostic scan confirmed these 'models/' prefixed names exist in your environment.
    model_candidates = [
        "models/gemini-2.5-flash", 
        "models/gemini-2.0-flash", 
        "models/gemini-flash-latest", 
        "models/gemini-pro-latest"
    ]
    last_error = None

    for model_name in model_candidates:
        try:
            print(f"DEBUG: Attempting extraction with model: {model_name}")
            model = genai.GenerativeModel(model_name)
            response = model.generate_content([EXTRACTION_PROMPT, img_pil])
            raw_text = response.text.strip()
            print(f"DEBUG: Raw Gemini response from {model_name}: {raw_text}") 

            # Robust JSON extraction using regex
            json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                data = json.loads(json_str)
                return data.get("medicines", [])
            else:
                print(f"DEBUG: No JSON found in response from {model_name}. Trying next model...")
                continue
                
        except Exception as e:
            last_error = e
            print(f"DEBUG: Model {model_name} failed: {str(e)}")
            continue

    # If we get here, all models failed
    print("ERROR: All Gemini models failed or returned no usable data.")
    try:
        print("DEBUG: Listing available models for diagnostic purposes:")
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f" - {m.name} (supports generateContent)")
    except Exception as list_err:
        print(f"DEBUG: Could not list models: {list_err}")

    if last_error:
        raise last_error
    return []


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
            dosage    = item.get('dosage_instructions') or ''
            
            # Combine details into name if that's what the UI expects, 
            # or keep them separate if the model supports it. 
            # Current model seems to store name, frequency.
            # We'll prepend dosage to the name for better detail in the UI.
            full_name_detail = f"{name} ({dosage})".strip(" ()") if dosage else name

            medicine = Medicine(
                prescription=prescription,
                name=full_name_detail,
                frequency=frequency,
                bbox_x=0,
                bbox_y=0,
                bbox_width=0,
                bbox_height=0,
                confidence=0.0,
            )
            medicine.save()
            print(f"DEBUG: Saved Medicine ID: {medicine.id} — {full_name_detail}")

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
    print(f"--- GET PRESCRIPTION MEDICINES (ID: {prescription_id}) STARTED ---")
    try:
        prescription = Prescription.objects.get(id=prescription_id)
        medicines    = Medicine.objects.filter(prescription=prescription)
        print(f"DEBUG: Found {medicines.count()} medicine(s) for Prescription ID: {prescription_id}")
        serializer   = MedicineSerializer(medicines, many=True)
        return Response(serializer.data)
    except Prescription.DoesNotExist:
        print(f"ERROR: Prescription ID {prescription_id} not found.")
        return Response({'error': 'Prescription not found.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        print(f"ERROR: get_prescription_medicines: {e}")
        return Response({'error': 'Failed to retrieve medicines.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)