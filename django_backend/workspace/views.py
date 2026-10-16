import json
import logging
import re
from datetime import date
from decimal import Decimal, InvalidOperation
from functools import wraps
from pathlib import Path

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import PasswordResetForm
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import FileResponse, Http404, JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.crypto import salted_hmac
from django.views.decorators.cache import never_cache

from .knowledge import GroundingError, gemini_quotes, retrieve, source_data
from .models import Assessment, AuditControl, BudgetLine, Bulletin, BulletinRead, Case, Event, Evidence, Procedure, Profile, Source

logger = logging.getLogger(__name__)


def endpoint(methods, authenticated=True):
    def decorate(function):
        @wraps(function)
        def wrapped(request, *args, **kwargs):
            if request.method not in methods:
                return JsonResponse({"error": "Méthode non autorisée."}, status=405)
            if authenticated and not request.user.is_authenticated:
                return JsonResponse({"error": "Connectez-vous pour accéder à votre espace."}, status=401)
            try:
                data = {}
                if request.content_type == "application/json":
                    data = json.loads(request.body)
                    if not isinstance(data, dict):
                        raise ValidationError("Un objet JSON est requis.")
                return function(request, data, *args, **kwargs)
            except (ValidationError, ValueError, TypeError, InvalidOperation) as error:
                message = " ".join(error.messages) if isinstance(error, ValidationError) else "Saisie invalide."
                return JsonResponse({"error": message}, status=400)
            except Http404:
                return JsonResponse({"error": "Ressource introuvable dans votre espace."}, status=404)
        return never_cache(wrapped)
    return decorate


def field(data, key, limit=200, required=True):
    value = data.get(key, "")
    if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
        raise ValidationError(f"Champ {key} invalide (maximum {limit} caractères).")
    return value.strip()


def day(value):
    if value in (None, ""):
        return None
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValidationError("Date attendue au format AAAA-MM-JJ.")
    return date.fromisoformat(value)


def limited(request, scope, count):
    identity = f"{request.META.get('REMOTE_ADDR', '')}:{request.user.pk if request.user.is_authenticated else ''}"
    key = salted_hmac("request-limit", f"{scope}:{identity}").hexdigest()
    current = cache.get(key, 0)
    cache.set(key, current + 1, 300)
    return current >= count


def profile_data(request):
    if not request.user.is_authenticated:
        return None
    profile, _ = Profile.objects.get_or_create(user=request.user)
    return {"email": request.user.email, "staff": request.user.is_staff,
            "kind": profile.kind, "organization": profile.organization,
            "activity": profile.activity, "city": profile.city}


@endpoint(["GET"], authenticated=False)
def session(request, data):
    return JsonResponse({"csrf": get_token(request), "user": profile_data(request),
                         "gemini_configured": bool(settings.GEMINI_API_KEY)})


@endpoint(["POST"], authenticated=False)
def register(request, data):
    if limited(request, "register", 8):
        return JsonResponse({"error": "Trop de tentatives. Réessayez dans cinq minutes."}, status=429)
    email = field(data, "email", 150).lower()
    validate_email(email)
    password = field(data, "password", 128)
    user = User(username=email, email=email)
    validate_password(password, user)
    try:
        with transaction.atomic():
            user.set_password(password)
            user.save()
            Profile.objects.create(user=user)
    except IntegrityError:
        return JsonResponse({"error": "Inscription impossible. Essayez la connexion ou la récupération du compte."}, status=400)
    login(request, user)
    return JsonResponse({"user": profile_data(request), "csrf": get_token(request)}, status=201)


@endpoint(["POST"], authenticated=False)
def sign_in(request, data):
    if limited(request, "login", 12):
        return JsonResponse({"error": "Trop de tentatives. Réessayez dans cinq minutes."}, status=429)
    user = authenticate(request, username=field(data, "email", 150).lower(), password=field(data, "password", 128))
    if user is None:
        return JsonResponse({"error": "Courriel ou mot de passe incorrect."}, status=400)
    login(request, user)
    return JsonResponse({"user": profile_data(request), "csrf": get_token(request)})


@endpoint(["POST"])
def sign_out(request, data):
    logout(request)
    return JsonResponse({"ok": True, "csrf": get_token(request)})


@endpoint(["POST"], authenticated=False)
def reset_password(request, data):
    if not settings.EMAIL_HOST or not settings.DEFAULT_FROM_EMAIL:
        return JsonResponse({"error": "Récupération indisponible : le serveur de courriel n'est pas configuré."}, status=503)
    if limited(request, "password-reset", 5):
        return JsonResponse({"error": "Trop de demandes. Réessayez dans cinq minutes."}, status=429)
    form = PasswordResetForm({"email": field(data, "email", 150)})
    if not form.is_valid():
        raise ValidationError("Adresse de courriel invalide.")
    form.save(request=request, use_https=request.is_secure(),
              email_template_name="registration/password_reset_email.txt",
              subject_template_name="registration/password_reset_subject.txt")
    return JsonResponse({"message": "Si ce compte existe, les instructions de récupération seront envoyées."})


@endpoint(["POST"])
def profile(request, data):
    item, _ = Profile.objects.get_or_create(user=request.user)
    for name, maximum in [("kind", 20), ("activity", 20), ("organization", 160), ("city", 100)]:
        setattr(item, name, field(data, name, maximum, required=name in ["kind", "activity"]))
    item.full_clean()
    item.save()
    Event.objects.create(owner=request.user, action="Profil modifié", object_id=str(item.pk))
    return JsonResponse({"user": profile_data(request)})


@endpoint(["GET"], authenticated=False)
def procedures(request, data):
    activity = request.GET.get("activity", "")
    rows = Procedure.objects.filter(published=True, source__draft=False).select_related("source")
    return JsonResponse({"procedures": [
        {"id": p.pk, "title": p.title, "description": p.description, "steps": p.steps,
         "activities": p.activities, "version": p.version, "source": source_data(p.source, include_text=False),
         "suggested": not p.activities or activity in p.activities}
        for p in rows.order_by("id")
    ]})


def case_data(item):
    totals = {}
    unknown = 0
    budget = []
    for line in item.budget.all():
        budget.append({"id": line.pk, "label": line.label, "amount": str(line.amount) if line.amount is not None else None,
                       "category": line.category, "tax": line.tax, "basis": line.basis})
        if line.amount is None:
            unknown += 1
        else:
            key = f"{line.category} · {line.tax}"
            totals[key] = totals.get(key, Decimal(0)) + line.amount
    return {
        "id": item.pk, "title": item.title, "status": item.status, "receipt": item.receipt,
        "steps": item.steps, "description": item.description, "due_date": item.due_date,
        "procedure": item.procedure_id, "version": item.version,
        "outdated": (item.version != item.procedure.version or item.source_fingerprint != item.procedure.source.fingerprint
                     or item.procedure.source.draft or not item.procedure.published),
        "source": source_data(item.procedure.source, include_text=False),
        "evidence": [{"id": e.pk, "name": e.name, "expires_on": e.expires_on,
                      "expired": bool(e.expires_on and e.expires_on < timezone.localdate()),
                      "url": f"/workspace-api/evidence/{e.pk}/"} for e in item.evidence.all()],
        "budget": budget, "totals": {k: str(v) for k, v in totals.items()}, "unknown_amounts": unknown,
    }


@endpoint(["GET", "POST"])
def cases(request, data):
    if request.method == "POST":
        procedure = get_object_or_404(Procedure, pk=field(data, "procedure", 20), published=True, source__draft=False)
        item = Case.objects.create(
            owner=request.user, procedure=procedure, title=procedure.title, version=procedure.version,
            source_fingerprint=procedure.source.fingerprint, description=procedure.description,
            steps=[{"label": s, "done": False} for s in procedure.steps],
        )
        Event.objects.create(owner=request.user, action="Dossier créé", object_id=str(item.pk))
        return JsonResponse({"case": case_data(item)}, status=201)
    items = Case.objects.filter(owner=request.user).select_related("procedure__source").prefetch_related("evidence", "budget")
    return JsonResponse({"cases": [case_data(c) for c in items.order_by("-updated_at")]})


@endpoint(["POST"])
@transaction.atomic
def update_case(request, data, pk):
    item = get_object_or_404(Case.objects.select_for_update(), pk=pk, owner=request.user)
    done = data.get("done")
    if not isinstance(done, list) or len(done) != len(item.steps) or any(type(v) is not bool for v in done):
        raise ValidationError("La progression ne correspond pas aux étapes du dossier.")
    item.steps = [{"label": s["label"], "done": value} for s, value in zip(item.steps, done)]
    item.status = field(data, "status", 24)
    item.receipt = field(data, "receipt", 200, required=False)
    item.due_date = day(data.get("due_date"))
    if item.status in ["depot_declare", "instruction_declaree", "decision", "refuse"] and not item.receipt:
        raise ValidationError("Indiquez une référence de dépôt ou de décision. Le statut restera déclaré, non confirmé par l'administration.")
    if item.status == "pret" and not all(done):
        raise ValidationError("Terminez les étapes avant de déclarer le dossier prêt.")
    item.full_clean()
    item.save()
    Event.objects.create(owner=request.user, action=f"Statut déclaré : {item.status}", object_id=str(item.pk))
    return JsonResponse({"case": case_data(item)})


@endpoint(["POST"])
def upload(request, data, pk):
    item = get_object_or_404(Case, pk=pk, owner=request.user)
    uploaded = request.FILES.get("file")
    if not uploaded or uploaded.size > 10 * 1024 * 1024 or uploaded.size == 0:
        raise ValidationError("Document requis, non vide, de 10 Mo maximum.")
    signature = uploaded.read(8)
    uploaded.seek(0)
    if not (signature.startswith(b"%PDF-") or signature.startswith(b"\x89PNG\r\n\x1a\n") or signature.startswith(b"\xff\xd8\xff")):
        raise ValidationError("Formats acceptés : PDF, PNG ou JPEG uniquement.")
    expires = day(request.POST.get("expires_on"))
    evidence = Evidence(case=item, file=uploaded, name=Path(uploaded.name).name[:200], expires_on=expires)
    evidence.save()
    Event.objects.create(owner=request.user, action="Justificatif ajouté — non authentifié", object_id=str(evidence.pk))
    return JsonResponse({"case": case_data(item)}, status=201)


@endpoint(["GET", "DELETE"])
def evidence(request, data, pk):
    item = get_object_or_404(Evidence, pk=pk, case__owner=request.user)
    if request.method == "DELETE":
        item.file.delete(save=False)
        item.delete()
        Event.objects.create(owner=request.user, action="Justificatif supprimé", object_id=str(pk))
        return JsonResponse({"ok": True})
    response = FileResponse(item.file.open("rb"), as_attachment=True, filename=item.name, content_type="application/octet-stream")
    response["Cache-Control"] = "no-store"
    return response


@endpoint(["POST"])
def budget(request, data, pk):
    item = get_object_or_404(Case, pk=pk, owner=request.user)
    raw = data.get("amount")
    amount = None if raw in (None, "") else Decimal(str(raw))
    if amount is not None and (not amount.is_finite() or amount < 0):
        raise ValidationError("Montant positif ou vide requis. Vide signifie inconnu, pas gratuit.")
    line = BudgetLine(case=item, label=field(data, "label", 160), amount=amount,
                      category=field(data, "category", 20), tax=field(data, "tax", 12),
                      basis=field(data, "basis", 300))
    line.full_clean()
    line.save()
    return JsonResponse({"case": case_data(item)}, status=201)


@endpoint(["DELETE"])
def delete_budget(request, data, pk):
    get_object_or_404(BudgetLine, pk=pk, case__owner=request.user).delete()
    return JsonResponse({"ok": True})


def audit_state(owner):
    assessments = {a.control_id: a for a in Assessment.objects.filter(owner=owner).select_related("evidence")}
    groups = {"reglementaire": [], "marche": []}
    today = timezone.localdate()
    for control in AuditControl.objects.all().order_by("id"):
        record = assessments.get(control.pk)
        app = record.applicability if record else "A_DETERMINER"
        status = record.status if record else "NON_EVALUE"
        expired = bool(record and record.evidence and record.evidence.expires_on and record.evidence.expires_on < today)
        if status == "CONFORME" and (not record.evidence or expired):
            status = "NON_EVALUE"
        groups["marche" if int(control.pk[1:]) >= 101 else "reglementaire"].append({
            "id": control.pk, "text": control.text, "condition": control.condition, "source": control.source_ref,
            "domain": control.domain, "critical": control.critical, "applicability": app, "status": status,
            "justification": record.justification if record else "",
            "evidence": record.evidence_id if record else None, "proof_invalid": expired,
        })
    summaries = {}
    for name, controls in groups.items():
        retained = [c for c in controls if not (c["applicability"] == "NON" and c["justification"])]
        conform = sum(c["applicability"] == "OUI" and c["status"] == "CONFORME" for c in retained)
        evaluated = sum(c["applicability"] == "OUI" and c["status"] != "NON_EVALUE" for c in retained)
        blocking = sum(c["critical"] and not (c["applicability"] == "OUI" and c["status"] == "CONFORME") for c in retained)
        summaries[name] = {"total": len(retained), "evaluated": evaluated, "blocking": blocking,
                           "score": round(100 * conform / len(retained), 1) if retained and evaluated else None,
                           "coverage": round(100 * evaluated / len(retained), 1) if retained else None}
    return {"groups": groups, "summaries": summaries}


@endpoint(["GET", "POST"])
@transaction.atomic
def audit(request, data):
    if request.method == "POST":
        control = get_object_or_404(AuditControl, pk=field(data, "control", 20))
        item, _ = Assessment.objects.get_or_create(owner=request.user, control=control)
        item.applicability = field(data, "applicability", 20)
        item.status = field(data, "status", 20)
        item.justification = field(data, "justification", 2000, required=False)
        evidence_id = data.get("evidence")
        item.evidence = get_object_or_404(Evidence, pk=evidence_id, case__owner=request.user) if evidence_id else None
        if item.applicability != "OUI" and item.status != "NON_EVALUE":
            raise ValidationError("Un contrôle évalué doit être applicable.")
        if item.applicability == "NON" and len(item.justification) < 10:
            raise ValidationError("Justifiez l'exclusion avec au moins 10 caractères. Elle sera attribuée à votre compte.")
        if item.status == "CONFORME" and (
            not item.evidence or not item.justification or
            (item.evidence.expires_on and item.evidence.expires_on < timezone.localdate())
        ):
            raise ValidationError("Une preuve valide et une justification sont requises. Ce résultat reste une auto-évaluation.")
        item.full_clean()
        item.save()
        Event.objects.create(owner=request.user, action="Auto-évaluation enregistrée", object_id=control.pk)
    return JsonResponse(audit_state(request.user))


@endpoint(["GET", "POST"])
def bulletins(request, data):
    activity = profile_data(request)["activity"]
    visible = Bulletin.objects.filter(published_at__lte=timezone.now(), verified=True, source__draft=False).filter(Q(activity="all") | Q(activity=activity))
    if request.method == "POST":
        item = get_object_or_404(visible, pk=data.get("id"))
        BulletinRead.objects.update_or_create(owner=request.user, bulletin=item, defaults={"revision": item.revision})
    reads = dict(BulletinRead.objects.filter(owner=request.user).values_list("bulletin_id", "revision"))
    return JsonResponse({"bulletins": [
        {"id": b.pk, "title": b.title, "body": b.body, "action": b.action, "consequence": b.consequence,
         "effective_on": b.effective_on, "published_at": b.published_at, "revision": b.revision,
         "read": reads.get(b.pk) == b.revision, "source": source_data(b.source, include_text=False)}
        for b in visible.select_related("source").order_by("-published_at")
    ], "checked_at": timezone.now()})


@endpoint(["POST"])
def assistant(request, data):
    if limited(request, "assistant", 20):
        return JsonResponse({"error": "Limite atteinte. Réessayez dans cinq minutes."}, status=429)
    question = field(data, "question", 600)
    sources = retrieve(question)
    mode = field(data, "mode", 12)
    if mode not in ["local", "gemini"]:
        raise ValidationError("Mode d'assistant inconnu.")
    result = {"sources": [source_data(s) for s in sources], "mode": mode, "citations": [],
              "message": "Aucune source suffisamment concordante. Précisez l'activité ou les mots-clés." if not sources
              else "Passages du corpus local. Applicabilité et actualité à vérifier."}
    if mode == "gemini" and sources:
        if data.get("public_question") is not True:
            raise ValidationError("Confirmez que la question ne contient aucune information privée avant l'envoi à Gemini.")
        try:
            result["citations"] = gemini_quotes(question, sources)
        except GroundingError as error:
            return JsonResponse({"error": str(error)}, status=503)
        result["message"] = "Citations sélectionnées par Gemini et vérifiées mot à mot." if result["citations"] else "Gemini n'a trouvé aucune citation suffisante. Aucune conclusion inventée."
    return JsonResponse(result)


@endpoint(["GET"], authenticated=False)
def source(request, data, pk):
    return JsonResponse(source_data(get_object_or_404(Source, pk=pk)))


@endpoint(["GET"])
def history(request, data):
    return JsonResponse({"events": list(Event.objects.filter(owner=request.user).order_by("-created_at").values(
        "action", "object_id", "created_at",
    )[:80])})
