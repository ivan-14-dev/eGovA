import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

ACTIVITIES = [
    ("telecom", "Opérateur / fournisseur télécom"), ("installation", "Installation de réseaux"),
    ("logiciel", "Logiciels et informatique"), ("commerce", "Vente d'équipements"),
    ("consommateur", "Consommateur"), ("autre", "À qualifier"),
]


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    kind = models.CharField(max_length=20, choices=[(x, x.capitalize()) for x in [
        "particulier", "entreprise", "independant", "cabinet", "investisseur",
    ]], default="particulier")
    organization = models.CharField(max_length=160, blank=True)
    activity = models.CharField(max_length=20, choices=ACTIVITIES, default="autre")
    city = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.user} — {self.organization or self.kind}"


class NativeToken(models.Model):
    digest = models.CharField(primary_key=True, max_length=64)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    auth_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()


class Source(models.Model):
    id = models.CharField(primary_key=True, max_length=180)
    title = models.CharField(max_length=500)
    text = models.TextField()
    search_text = models.TextField()
    path = models.CharField(max_length=700)
    locator = models.CharField(max_length=160)
    fingerprint = models.CharField(max_length=64)
    kind = models.CharField(max_length=40)
    warning = models.CharField(max_length=500, default="Actualité et validité juridique à vérifier.")
    draft = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.title[:90]} — {self.locator}"


class PublicImport(models.Model):
    title = models.CharField(max_length=200)
    document = models.FileField(upload_to="public_imports/")
    reference = models.CharField(max_length=300, help_text="Émetteur, date et identification de la source.")
    public_confirmed = models.BooleanField(default=False, verbose_name="Document public sans données privées")
    imported_at = models.DateTimeField(null=True, blank=True, editable=False)

    def clean(self):
        if self.document:
            if self.document.size > 2 * 1024 * 1024:
                raise ValidationError("Document de 2 Mo maximum.")
            if not self.document.name.lower().endswith((".md", ".txt")):
                raise ValidationError("Importer du texte UTF-8 (.md/.txt). Les PDF passent par le pipeline documentaire existant.")

    def __str__(self):
        return self.title


class Procedure(models.Model):
    id = models.CharField(primary_key=True, max_length=20)
    title = models.CharField(max_length=200)
    description = models.TextField()
    activities = models.JSONField(default=list)
    source = models.ForeignKey(Source, on_delete=models.PROTECT)
    steps = models.JSONField(default=list)
    published = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=1)

    def clean(self):
        if not isinstance(self.steps, list) or not self.steps or any(
            not isinstance(s, str) or not s.strip() or len(s) > 300 for s in self.steps
        ):
            raise ValidationError({"steps": "Liste non vide de libellés de 300 caractères maximum requise."})
        if not isinstance(self.activities, list) or any(a not in dict(ACTIVITIES) for a in self.activities):
            raise ValidationError({"activities": "Activités inconnues."})

    def __str__(self):
        return self.title


class Case(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    procedure = models.ForeignKey(Procedure, on_delete=models.PROTECT)
    title = models.CharField(max_length=200)
    version = models.PositiveIntegerField()
    source_fingerprint = models.CharField(max_length=64)
    description = models.TextField()
    steps = models.JSONField(default=list)
    status = models.CharField(max_length=24, default="preparation", choices=[
        ("preparation", "En préparation"), ("pret", "Prêt à déposer"),
        ("depot_declare", "Dépôt déclaré"), ("instruction_declaree", "Instruction déclarée"),
        ("complement", "Complément demandé"), ("decision", "Décision déclarée"),
        ("refuse", "Refus déclaré"), ("archive", "Archivé"),
    ])
    receipt = models.CharField(max_length=200, blank=True)
    due_date = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)


def private_path(instance, filename):
    return f"{instance.case.owner_id}/{uuid.uuid4().hex}"


class Evidence(models.Model):
    case = models.ForeignKey(Case, related_name="evidence", on_delete=models.CASCADE)
    file = models.FileField(upload_to=private_path)
    name = models.CharField(max_length=200)
    expires_on = models.DateField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    superseded_by = models.OneToOneField("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="previous_document")
    superseded_at = models.DateTimeField(null=True, blank=True)


class BudgetLine(models.Model):
    case = models.ForeignKey(Case, related_name="budget", on_delete=models.CASCADE)
    label = models.CharField(max_length=160)
    amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    category = models.CharField(max_length=20, choices=[
        ("initial", "Initial"), ("annuel", "Annuel"), ("renouvellement", "Renouvellement"),
        ("garantie", "Garantie"), ("commercial", "Prestation commerciale"),
    ])
    tax = models.CharField(max_length=12, choices=[("HT", "HT"), ("TTC", "TTC"), ("inconnu", "À confirmer")])
    basis = models.CharField(max_length=300)


class AuditControl(models.Model):
    id = models.CharField(primary_key=True, max_length=20)
    domain = models.CharField(max_length=80)
    text = models.TextField()
    condition = models.TextField()
    source_ref = models.CharField(max_length=300)
    critical = models.BooleanField(default=False)


class Assessment(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    control = models.ForeignKey(AuditControl, on_delete=models.PROTECT)
    applicability = models.CharField(max_length=20, default="A_DETERMINER", choices=[
        ("A_DETERMINER", "À déterminer"), ("OUI", "Oui"), ("NON", "Non applicable"),
    ])
    status = models.CharField(max_length=20, default="NON_EVALUE", choices=[
        ("NON_EVALUE", "Non évalué"), ("CONFORME", "Conforme"), ("NON_CONFORME", "Non conforme"),
    ])
    evidence = models.ForeignKey(Evidence, null=True, blank=True, on_delete=models.SET_NULL)
    justification = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "control"], name="one_assessment_per_owner")]


class Bulletin(models.Model):
    title = models.CharField(max_length=200)
    body = models.TextField()
    source = models.ForeignKey(Source, on_delete=models.PROTECT)
    activity = models.CharField(max_length=20, choices=[("all", "Tous")] + ACTIVITIES)
    action = models.TextField()
    consequence = models.TextField()
    effective_on = models.DateField(null=True, blank=True)
    verified = models.BooleanField(default=False, verbose_name="Source et portée relues")
    published_at = models.DateTimeField(null=True, blank=True, editable=False)
    revision = models.PositiveIntegerField(default=1, editable=False)
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    kind = models.CharField(max_length=20, default="reglementation", choices=[
        ("reglementation", "Veille réglementaire"), ("appel_offres", "Appel d'offres"),
    ])
    closes_at = models.DateTimeField(null=True, blank=True, verbose_name="Date et heure limites de dépôt")
    required_controls = models.ManyToManyField(AuditControl, blank=True, verbose_name="Contrôles à examiner pour cet appel")

    def clean(self):
        if self.published_at and not self.verified:
            raise ValidationError("Une publication doit être relue. Dépublier avant de retirer la validation.")
        if self.kind == "appel_offres" and not self.closes_at:
            raise ValidationError({"closes_at": "Une date limite documentée est requise pour un appel d'offres."})

    def __str__(self):
        return self.title


class BulletinRead(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bulletin = models.ForeignKey(Bulletin, on_delete=models.CASCADE)
    revision = models.PositiveIntegerField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "bulletin"], name="one_read_per_bulletin")]


class NotificationRead(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    key = models.CharField(max_length=100)
    revision = models.CharField(max_length=64)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "key"], name="one_notification_read")]


class ActionProposal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="proposals")
    kind = models.CharField(max_length=20)
    before = models.JSONField()
    changes = models.JSONField()
    context = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    applied_at = models.DateTimeField(null=True, blank=True)


class Event(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    action = models.CharField(max_length=80)
    object_id = models.CharField(max_length=100)
    created_at = models.DateTimeField(default=timezone.now)
