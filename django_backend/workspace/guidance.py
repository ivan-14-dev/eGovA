import json
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db.models import Q
from django.utils import timezone

from .knowledge import fingerprint, source_data
from .models import ActionProposal, Bulletin, BulletinRead, Case, NotificationRead, Profile

REMINDER_DAYS = 30


def case_outdated(case):
    return (case.version != case.procedure.version
            or case.source_fingerprint != case.procedure.source.fingerprint
            or case.procedure.source.draft or not case.procedure.published)


def visible_bulletins(owner):
    profile, _ = Profile.objects.get_or_create(user=owner)
    return Bulletin.objects.filter(
        published_at__lte=timezone.now(), verified=True, source__draft=False,
    ).filter(Q(activity="all") | Q(activity=profile.activity)).filter(
        Q(kind="reglementation") | Q(kind="appel_offres", closes_at__gt=timezone.now()),
    )


def notification_state(owner, audit):
    items = []
    controls = {c["id"]: c for group in audit["groups"].values() for c in group}
    summaries = audit["summaries"]
    today = timezone.localdate()

    def add(key, kind, title, message, target, **extra):
        item = {"id": key, "kind": kind, "title": title, "message": message, "target": target, **extra}
        item["revision"] = fingerprint(json.dumps(item, sort_keys=True, ensure_ascii=False))
        items.append(item)

    for notice in visible_bulletins(owner).select_related("source").prefetch_related("required_controls").order_by("-published_at"):
        if notice.kind == "appel_offres":
            required = [controls[c.pk] for c in notice.required_controls.all() if c.pk in controls]
            missing = [c["id"] for c in required if c["applicability"] != "OUI" or c["status"] != "CONFORME"]
            add(f"tender:{notice.pk}", "appel_offres", notice.title,
                "Opportunité correspondant à votre activité, sans garantie d'éligibilité. "
                + (f"{len(missing)} contrôle(s) demandé(s) non démontré(s)." if required else "Exigences du DAO à qualifier par l'administrateur."),
                "audit", bulletin=notice.pk, publication_revision=notice.revision,
                deadline=notice.closes_at.isoformat(), action=notice.action, consequence=notice.consequence,
                body=notice.body, source=source_data(notice.source, include_text=False),
                missing_controls=missing, required_count=len(required), summaries=summaries)
        else:
            add(f"bulletin:{notice.pk}", "reglementation", notice.title, notice.action, "veille",
                bulletin=notice.pk, publication_revision=notice.revision)

    for case in Case.objects.filter(owner=owner).exclude(status="archive").select_related("procedure__source").prefetch_related("evidence"):
        if case_outdated(case):
            add(f"case:{case.pk}:version", "dossier", f"{case.title} : référentiel modifié",
                "Réexaminer les pièces et préparer une mise à jour avant de poursuivre.", "dossiers",
                case_id=case.pk, version=case.procedure.version, fingerprint=case.procedure.source.fingerprint,
                available=case.procedure.published and not case.procedure.source.draft)
        if case.due_date and case.due_date <= today + timedelta(days=REMINDER_DAYS):
            add(f"case:{case.pk}:due", "echeance", f"{case.title} : échéance",
                f"Échéance saisie : {case.due_date}. " + ("En retard." if case.due_date < today else "À préparer dans les 30 prochains jours."),
                "dossiers", case_id=case.pk, due_date=str(case.due_date), overdue=case.due_date < today)
        current = [e for e in case.evidence.all() if not e.superseded_at]
        if not current:
            add(f"case:{case.pk}:empty", "document", f"{case.title} : aucun justificatif",
                "Ajoutez les pièces requises. Leur présence seule ne prouve pas la conformité.", "dossiers", case_id=case.pk)
        for proof in current:
            if proof.expires_on and proof.expires_on <= today + timedelta(days=REMINDER_DAYS):
                expired = proof.expires_on < today
                add(f"evidence:{proof.pk}:expiry", "document", f"{proof.name} : {'expiré' if expired else 'expiration proche'}",
                    f"Expiration : {proof.expires_on}. Obtenez un document valable puis téléversez-le en remplacement ; l'assistant ne le délivre pas.",
                    "dossiers", case_id=case.pk, evidence_id=proof.pk, expired=expired)
    for group, summary in summaries.items():
        if summary["blocking"]:
            add(f"audit:{group}", "audit", "Conformité réglementaire" if group == "reglementaire" else "Préparation des marchés",
                f"{summary['blocking']} point(s) critique(s) non démontré(s). "
                f"Pourcentage : {str(summary['score']) + ' %' if summary['score'] is not None else 'non évalué'}. "
                "Auto-évaluation, pas une certification.", "audit", summary=summary)
    reads = dict(NotificationRead.objects.filter(owner=owner).values_list("key", "revision"))
    bulletin_reads = dict(BulletinRead.objects.filter(owner=owner).values_list("bulletin_id", "revision"))
    for item in items:
        item["read"] = reads.get(item["id"]) == item["revision"] or (
            item["kind"] == "reglementation" and bulletin_reads.get(item["bulletin"]) == item["publication_revision"])
    return {"items": items, "unread": sum(not item["read"] for item in items),
            "summaries": summaries, "checked_at": timezone.now(), "reminder_days": REMINDER_DAYS}


def case_snapshot(case):
    return {"title": case.title, "version": case.version, "source_fingerprint": case.source_fingerprint,
            "description": case.description, "steps": case.steps, "status": case.status,
            "receipt": case.receipt, "due_date": str(case.due_date) if case.due_date else None}


def proposal_context(case):
    return fingerprint(json.dumps({
        "case": case_snapshot(case), "updated_at": case.updated_at.isoformat(),
        "procedure": [case.procedure.version, case.procedure.source.fingerprint,
                      case.procedure.description, case.procedure.steps, case.procedure.published,
                      case.procedure.source.draft],
    }, sort_keys=True, ensure_ascii=False))


def prepare_proposal(case, kind, due_date=None):
    if case.status == "archive":
        raise ValidationError("Ce dossier est archivé. Réexaminez son statut avant de préparer une modification.")
    if kind == "refresh":
        if not case.procedure.published or case.procedure.source.draft:
            raise ValidationError("La nouvelle procédure attend une validation administrative. Aucune mise à jour automatique possible.")
        if not case_outdated(case):
            raise ValidationError("Ce dossier utilise déjà la version publiée. Vérifiez plutôt les pièces et échéances.")
        changes = {
            "title": case.procedure.title, "description": case.procedure.description,
            "version": case.procedure.version, "source_fingerprint": case.procedure.source.fingerprint,
            "steps": [{"label": step, "done": False} for step in case.procedure.steps],
            "status": "preparation",
        }
        message = ("Remplacer la description et les étapes par la version publiée ; décocher toutes les étapes "
                   "et revenir en préparation. Pièces, budget, référence de dépôt et échéance conservés. "
                   "Les évaluations liées aux pièces de ce dossier seront à réexaminer. L'ancienne version sera conservée dans l'historique.")
    elif kind == "due_date" and due_date:
        changes = {"due_date": due_date.isoformat()}
        message = f"Remplacer l'échéance saisie par {due_date.isoformat()}. Date choisie par vous, non calculée depuis une loi."
    else:
        raise ValidationError("Action inconnue ou date manquante.")
    proposal = ActionProposal.objects.create(
        case=case, kind=kind, before=case_snapshot(case), changes=changes, context=proposal_context(case),
        expires_at=timezone.now() + timedelta(minutes=15),
    )
    return {"id": str(proposal.pk), "case_id": case.pk, "message": message,
            "before": proposal.before, "changes": changes, "expires_at": proposal.expires_at}
