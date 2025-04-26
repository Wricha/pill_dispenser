# upload_prescription/views.py

from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated # Ensure user is logged in
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework import status # Import status codes
from .models import Prescription, Medicine
from .serializers import MedicineSerializer # If you created serializers
from django.conf import settings

# Image processing libraries
import cv2
import numpy as np
import pytesseract
from PIL import Image, UnidentifiedImageError # Import Pillow and specific error
import io
import os # For path manipulation (debug saving)
import traceback # For printing tracebacks explicitly

# Roboflow (assuming library is installed)
from roboflow import Roboflow

# --- Configuration ---
# IMPORTANT: Set this path for Tesseract if needed
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
# IMPORTANT: Move your Roboflow API key to settings or environment variables
 # <-- TODO: Move this!

# --- Views ---

@api_view(['POST'])
@permission_classes([IsAuthenticated]) # Protect this endpoint
def process_prescription(request):
    print("--- PROCESS PRESCRIPTION VIEW STARTED ---")
    if 'image' not in request.FILES:
        return Response({'error': 'No image provided'}, status=status.HTTP_400_BAD_REQUEST)

    image_file = request.FILES['image']
    prescription = Prescription() # Create instance first
    medicines_data = [] # To store successfully processed medicines for response

    # --- IMPORTANT: Define a writable debug directory ---
    # Change this path to something suitable for your OS!
    # On Windows, maybe 'C:/temp/img_debug' (ensure C:/temp exists)
    # On Linux/macOS, '/tmp/img_debug' might work
    temp_save_dir = "C:/temp/img_debug"
    # ---

    try:
        # It's generally safer to read the file content BEFORE saving the model instance
        # in case reading fails.
        image_bytes_content = image_file.read()
        image_file.seek(0) # Reset pointer IMPORTANT for saving

        # Now save the model instance associated with the logged-in user
        # Assuming you add a 'user' ForeignKey to Prescription model:
        # prescription.user = request.user
        prescription.image = image_file # Assign the file object
        prescription.save() # Now it gets an ID
        print(f"DEBUG: Saved Prescription object with ID: {prescription.id}")

        image_bytes = io.BytesIO(image_bytes_content) # Create BytesIO from content

        # --- Start Image Opening Debugging Code ---
        os.makedirs(temp_save_dir, exist_ok=True) # Create debug dir if needed
        # Use prescription ID in the filename now that it's saved
        debug_file_path = os.path.join(temp_save_dir, f"debug_{prescription.id}_{image_file.name}")

        try:
            print(f"DEBUG: Attempting to save uploaded bytes to {debug_file_path}")
            with open(debug_file_path, "wb") as f_debug:
                f_debug.write(image_bytes.getvalue()) # Write the buffer's content
            print(f"DEBUG: Saved uploaded bytes successfully.")
            image_bytes.seek(0) # Reset BytesIO pointer AFTER getvalue()

            # Attempt to open the image
            print(f"DEBUG: Attempting Image.open() on BytesIO...")
            img_pil = Image.open(image_bytes)
            print(f"DEBUG: Image.open() successful. Format: {img_pil.format}")

            # Attempt to convert to numpy array (for potential OpenCV use later)
            print(f"DEBUG: Attempting np.array()...")
            image_np = np.array(img_pil)
            # Convert PIL image (RGB) to OpenCV format (BGR) if needed for OpenCV functions
            # image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
            print(f"DEBUG: np.array() successful. Image shape: {image_np.shape}")

        except UnidentifiedImageError as e:
            print(f"ERROR: PIL.UnidentifiedImageError - Pillow cannot identify image format.")
            print(f"DEBUG: Uploaded bytes were saved to {debug_file_path} for inspection.")
            # Optionally delete the failed Prescription object
            # prescription.delete()
            return Response({'error': f'Cannot identify image file. Is it a valid image format? Debug file saved: {debug_file_path}'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
             print(f"ERROR: Unexpected error during image loading/conversion: {e}")
             traceback.print_exc() # Print full traceback for other errors
             # Also save the bytes for inspection in case of other errors
             try:
                 # Ensure image_bytes is still accessible and has content
                 image_bytes.seek(0)
                 with open(debug_file_path, "wb") as f_debug:
                     f_debug.write(image_bytes.getvalue())
                 print(f"DEBUG: Uploaded bytes saved to {debug_file_path} due to unexpected error.")
             except Exception as save_err:
                 print(f"ERROR: Could not save debug file during error handling: {save_err}")
             # Optionally delete the failed Prescription object
             # prescription.delete()
             return Response({'error': 'An unexpected error occurred during image processing.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        # --- End Image Opening Debugging Code ---

        # ----- IF IMAGE LOADED SUCCESSFULLY, CONTINUE WITH ROBOFLOW/OCR -----
        print("DEBUG: Proceeding with Roboflow...")

        # Initialize Roboflow
        try:
            rf = Roboflow(api_key=settings.ROBOFLOW_API_KEY)
            # Make sure project/workspace names are correct
            project = rf.workspace().project("prescription-v2-6q5tz")
            model = project.version(1).model

            # Predict using the saved debug file path (or could try sending bytes if supported)
            # Note: Roboflow SDK might prefer a file path
            print(f"DEBUG: Running Roboflow prediction on: {debug_file_path}")
            predictions_result = model.predict(debug_file_path)
            predictions = predictions_result.json()
            print(f"DEBUG: Roboflow predictions received.")
            # Optionally delete the debug file after prediction if desired
            # os.remove(debug_file_path)

            # Process each detection
            print(f"DEBUG: Processing {len(predictions.get('predictions', []))} detections...")
            for pred in predictions.get("predictions", []):
                 if pred.get("class") == "Drug": # Check class name carefully
                    print(f"DEBUG: Found 'Drug' prediction: {pred}")
                    # Extract bounding box coordinates (adjust based on Roboflow output format)
                    x = int(pred["x"] - pred["width"]/2)
                    y = int(pred["y"] - pred["height"]/2)
                    w = int(pred["width"])
                    h = int(pred["height"])
                    confidence = pred["confidence"]

                    # Ensure coordinates stay within image boundaries
                    img_h, img_w = image_np.shape[:2] # Use numpy image dimensions
                    x1 = max(0, x)
                    y1 = max(0, y)
                    x2 = min(img_w, x + w) # Use x+w for end coordinate
                    y2 = min(img_h, y + h) # Use y+h for end coordinate
                    w_adj = x2 - x1
                    h_adj = y2 - y1

                    if w_adj <= 0 or h_adj <= 0:
                         print(f"WARN: Skipping prediction with invalid adjusted bbox: {pred}")
                         continue

                    print(f"DEBUG: Cropping ROI: y={y1}:{y2}, x={x1}:{x2}")
                    # Crop the region for OCR using numpy slicing
                    roi = image_np[y1:y2, x1:x2]

                    # Use OCR to extract text
                    try:
                        print(f"DEBUG: Running OCR on ROI...")
                        # --psm 6 assumes a single uniform block of text. Adjust if needed.
                        config = r'--oem 3 --psm 6'
                        text = pytesseract.image_to_string(roi, config=config).strip()
                        print(f"DEBUG: OCR Result: '{text}'")

                        # Save to database
                        medicine = Medicine(
                            prescription=prescription,
                            name=text if text else "OCR Failed", # Handle empty OCR result
                            frequency='', # Frequency isn't extracted here
                            bbox_x=x1,
                            bbox_y=y1,
                            bbox_width=w_adj,
                            bbox_height=h_adj,
                            confidence=confidence
                        )
                        medicine.save()
                        print(f"DEBUG: Saved Medicine object with ID: {medicine.id}")

                        # Add to response list
                        medicines_data.append({
                            'id': medicine.id,
                            'text': text,
                            'bbox': [x1, y1, w_adj, h_adj],
                            'confidence': confidence
                        })
                    except pytesseract.TesseractError as ocr_error:
                        print(f"ERROR: Tesseract OCR failed for a region: {ocr_error}")
                        # Decide how to handle OCR failure: skip medicine, save with placeholder?
                        # Save with placeholder:
                        medicine = Medicine(
                            prescription=prescription, name="OCR Error", frequency='',
                            bbox_x=x1, bbox_y=y1, bbox_width=w_adj, bbox_height=h_adj,
                            confidence=confidence
                        )
                        medicine.save()
                        medicines_data.append({
                            'id': medicine.id, 'text': 'OCR Error',
                            'bbox': [x1, y1, w_adj, h_adj], 'confidence': confidence
                        })
                    except Exception as ocr_general_error:
                        print(f"ERROR: Unexpected error during OCR or saving Medicine: {ocr_general_error}")
                        traceback.print_exc()
                        # Optionally continue to next prediction?

        except Exception as e:
            # Catch errors during Roboflow initialization or prediction
            print(f"ERROR: An error occurred during Roboflow processing: {e}")
            traceback.print_exc()
            # Optionally delete the failed Prescription object
            # prescription.delete()
            return Response({'error': 'Failed during AI model processing.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Final response after processing all predictions
        print("--- PROCESS PRESCRIPTION VIEW FINISHED ---")
        return Response({
            'prescription_id': prescription.id,
            'image_url': prescription.image.url if prescription.image else None,
            'medicines': medicines_data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        # Catch potential errors happening BEFORE image processing (like initial DB save)
        print(f"ERROR: An critical error occurred very early in processing: {e}")
        traceback.print_exc()
        # Ensure prescription object exists before trying to delete
        # if prescription and prescription.id:
        #    try:
        #        prescription.delete()
        #    except Exception as del_err:
        #        print(f"ERROR: Could not delete prescription object during error handling: {del_err}")
        return Response({'error': 'An critical server error occurred during initial processing.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT'])
@permission_classes([IsAuthenticated]) # Protect this endpoint
def update_medicine(request, medicine_id):
    """
    Updates the name and frequency of a specific Medicine instance.
    Expects JSON data in the request body: {'name': 'new name', 'frequency': 'new freq'}
    """
    try:
        # Optional: Add check if medicine/prescription belongs to the user
        medicine = Medicine.objects.get(id=medicine_id)

        # Using request.data for DRF api_view
        new_name = request.data.get('name', medicine.name)
        new_frequency = request.data.get('frequency', medicine.frequency)

        # Basic validation example (expand as needed)
        if not new_name:
             return Response({'error': 'Medicine name cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)

        medicine.name = new_name
        medicine.frequency = new_frequency
        medicine.save()

        # Return updated medicine data (consider using a serializer)
        return Response({
            'id': medicine.id,
            'name': medicine.name,
            'frequency': medicine.frequency,
            # include other fields if needed
        }, status=status.HTTP_200_OK)

    except Medicine.DoesNotExist:
        return Response({'error': 'Medicine not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
         print(f"Error updating medicine (ID: {medicine_id}): {e}") # Log errors
         traceback.print_exc()
         return Response({'error': 'Failed to update medicine due to server error.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Add any other views like get_prescription_medicines here if you created them

@api_view(['GET'])
@permission_classes([IsAuthenticated]) # Add authentication
def get_prescription_medicines(request, prescription_id):
    try:
        # Optional: Check if the prescription belongs to the requesting user if needed
        prescription = Prescription.objects.get(id=prescription_id)
        medicines = Medicine.objects.filter(prescription=prescription)
        serializer = MedicineSerializer(medicines, many=True) # Use a serializer
        return Response(serializer.data)
    except Prescription.DoesNotExist:
        return Response({'error': 'Prescription not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
         print(f"Error fetching medicines: {e}") # Log errors
         return Response({'error': 'Failed to retrieve medicines'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


