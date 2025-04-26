# schedules/permissions.py (Create this file if it doesn't exist)

from rest_framework import permissions

class IsOwner(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit or delete it.
    Assumes the model instance has a `user` attribute.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        # if request.method in permissions.SAFE_METHODS:
        #     return True # Allow listing/viewing for any authenticated user

        # Write permissions are only allowed to the owner of the medication.
        # Ensure the object we're checking (obj) has a 'user' field
        # and compare it to the authenticated user making the request.
        if hasattr(obj, 'user'):
            return obj.user == request.user
        # Handle cases where the object might not have a user field if necessary
        # Or raise an error/return False if user field is expected but missing
        return False