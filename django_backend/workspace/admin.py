from django.contrib import admin, messages
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from .knowledge import fingerprint, normalize
from .models import AuditControl, Bulletin, Event, Procedure, Profile, PublicImport, Source

admin.site.site_header = "Mon Assistant — Administration documentaire"
admin.site.site_title = "Administration"
admin.site.index_title = "Sources, parcours et publications — aucun service public connecté"


@admin.register(PublicImport)
class PublicImportAdmin(admin.ModelAdmin):
    list_display = ("title", "public_confirmed", "imported_at")
    readonly_fields = ("imported_at",)
    actions = ("index_public",)

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        if change and form.changed_data:
            source = Source.objects.filter(pk=f"public:{obj.pk}")
            Procedure.objects.filter(source__in=source).update(published=False, version=F("version") + 1)
            Bulletin.objects.filter(source__in=source).update(verified=False, published_at=None)
            source.update(draft=True)
            obj.imported_at = None
        super().save_model(request, obj, form, change)

    @admin.action(description="Indexer les documents publics explicitement approuvés")
    @transaction.atomic
    def index_public(self, request, queryset):
        for document in queryset:
            if not document.public_confirmed:
                self.message_user(request, f"{document.title} : caractère public non confirmé.", messages.ERROR)
                continue
            try:
                with document.document.open("rb") as stream:
                    text = stream.read(2 * 1024 * 1024 + 1).decode("utf-8")
            except UnicodeDecodeError:
                self.message_user(request, f"{document.title} : texte UTF-8 requis.", messages.ERROR)
                continue
            if not text.strip() or len(text.encode()) > 2 * 1024 * 1024:
                self.message_user(request, f"{document.title} : document vide ou trop volumineux.", messages.ERROR)
                continue
            old = Source.objects.filter(pk=f"public:{document.pk}").first()
            if old and old.fingerprint != fingerprint(text):
                Procedure.objects.filter(source=old).update(published=False, version=F("version") + 1)
                Bulletin.objects.filter(source=old).update(verified=False, published_at=None)
            Source.objects.update_or_create(id=f"public:{document.pk}", defaults={
                "title": document.title, "text": text, "search_text": normalize(f"{document.title} {text}"),
                "path": document.document.name, "locator": document.reference, "fingerprint": fingerprint(text),
                "kind": "reference", "draft": False,
                "warning": "Source publique importée par un administrateur. Actualité juridique non certifiée.",
            })
            document.imported_at = timezone.now()
            document.save(update_fields=["imported_at"])
            Event.objects.create(owner=request.user, action="Source publique indexée", object_id=str(document.pk))
            self.message_user(request, f"{document.title} indexé. Publier une fiche de veille séparément pour notifier les utilisateurs.")


@admin.register(Source)
class SourceAdmin(admin.ModelAdmin):
    list_display = ("title", "locator", "kind", "draft")
    list_filter = ("kind", "draft")
    search_fields = ("title", "text", "id")
    readonly_fields = ("id", "title", "text", "path", "locator", "fingerprint", "kind", "warning", "draft")
    exclude = ("search_text",)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Procedure)
class ProcedureAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "published", "version")
    list_filter = ("published",)
    search_fields = ("id", "title", "description")
    autocomplete_fields = ("source",)
    readonly_fields = ("version",)

    def save_model(self, request, obj, form, change):
        if change:
            obj.version += 1
        super().save_model(request, obj, form, change)


@admin.register(Bulletin)
class BulletinAdmin(admin.ModelAdmin):
    list_display = ("title", "kind", "activity", "closes_at", "verified", "published_at", "revision")
    list_filter = ("kind", "activity", "verified")
    autocomplete_fields = ("source", "required_controls")
    readonly_fields = ("published_at", "revision", "published_by")
    actions = ("publish", "withdraw")

    @admin.action(description="Publier les fiches relues et notifier les profils concernés")
    def publish(self, request, queryset):
        ready = queryset.filter(verified=True, source__draft=False).filter(
            Q(kind="reglementation") | Q(kind="appel_offres", closes_at__gt=timezone.now()))
        rejected = queryset.count() - ready.count()
        count = ready.update(published_at=timezone.now(), published_by=request.user, revision=F("revision") + 1)
        Event.objects.create(owner=request.user, action="Publication admin", object_id=f"{count} fiches")
        self.message_user(request, f"{count} fiche(s) publiée(s). {rejected} non relue(s), non publiée(s).",
                          messages.WARNING if rejected else messages.SUCCESS)

    @admin.action(description="Retirer la publication")
    def withdraw(self, request, queryset):
        queryset.update(published_at=None)
        self.message_user(request, "Fiches retirées de la veille utilisateur.")

    def save_model(self, request, obj, form, change):
        # Editing a public notice requires a new deliberate publication.
        if change and obj.published_at and form.changed_data:
            obj.published_at = None
            obj.verified = False
        super().save_model(request, obj, form, change)


@admin.register(AuditControl)
class ControlAdmin(admin.ModelAdmin):
    list_display = ("id", "domain", "critical")
    search_fields = ("id", "text", "condition")
    readonly_fields = ("id", "domain", "text", "condition", "source_ref", "critical")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "owner", "action", "object_id")
    readonly_fields = ("created_at", "owner", "action", "object_id")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "kind", "activity")
    readonly_fields = ("user", "kind", "organization", "activity", "city")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
