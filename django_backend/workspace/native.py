import hashlib
import secrets
from datetime import timedelta
from functools import wraps

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.http import JsonResponse
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt

from .models import NativeToken


def issue_token(user):
    secret = secrets.token_urlsafe(48)
    NativeToken.objects.filter(owner=user, expires_at__lte=timezone.now()).delete()
    NativeToken.objects.create(
        digest=hashlib.sha256(secret.encode()).hexdigest(), owner=user,
        auth_hash=user.get_session_auth_hash(),
        expires_at=timezone.now() + timedelta(seconds=settings.SESSION_COOKIE_AGE),
    )
    return secret


def native_endpoint(view, anonymous=False):
    @csrf_exempt
    @never_cache
    @wraps(view)
    def adapter(request, *args, **kwargs):
        # Native routes never use browser session cookies or create browser sessions.
        request.user = AnonymousUser()
        request.native = True
        request.native_token = None
        header = request.headers.get("Authorization", "")
        if header:
            if not header.startswith("Bearer ") or len(header) > 200:
                return JsonResponse({"error": "Jeton mobile invalide."}, status=401)
            token = NativeToken.objects.select_related("owner").filter(
                digest=hashlib.sha256(header[7:].encode()).hexdigest(),
                expires_at__gt=timezone.now(), owner__is_active=True,
            ).first()
            if not token or not constant_time_compare(token.auth_hash, token.owner.get_session_auth_hash()):
                return JsonResponse({"error": "Session mobile expirée. Reconnectez-vous."}, status=401)
            request.native_token = token
            request.user = token.owner
        if not anonymous and not request.user.is_authenticated:
            return JsonResponse({"error": "Connexion mobile requise."}, status=401)
        return view(request, *args, **kwargs)
    return adapter
