from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .serializers import RegisterSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import MyTokenObtainPairSerializer
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from django.contrib.auth import logout

@api_view(['POST'])
def register_user(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({'message': 'User registered successfully'}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer
    
class LogoutView(APIView):
    permission_classes = (permissions.IsAuthenticated,) # Ensuring user is logged in

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh") 
            if refresh_token is None:
                return Response({"error": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)

            token = RefreshToken(refresh_token)
            token.blacklist() 

            return Response({"detail": "Successfully logged out."}, status=status.HTTP_204_NO_CONTENT)
        except TokenError as e:
            # Handling cases where the token is invalid or expired
            return Response({"error": f"Invalid token: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Logout error: {e}") # Log the error for debugging
            return Response({"error": "An error occurred during logout."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class SessionLogoutView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        try:
            logout(request) # Django's built-in logout function
            return Response({"detail": "Successfully logged out."}, status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            print(f"Logout error: {e}")
            return Response({"error": "An error occurred during logout."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)