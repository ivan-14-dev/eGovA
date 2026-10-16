from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import path

from workspace import views
from workspace.native import native_endpoint

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/reset/<uidb64>/<token>/", auth_views.PasswordResetConfirmView.as_view(
        success_url="/accounts/reset/done/"), name="password_reset_confirm"),
    path("accounts/reset/done/", auth_views.PasswordResetCompleteView.as_view(), name="password_reset_complete"),
    path("workspace-api/session/", views.session),
    path("workspace-api/register/", views.register),
    path("workspace-api/login/", views.sign_in),
    path("workspace-api/logout/", views.sign_out),
    path("workspace-api/password-reset/", views.reset_password),
    path("workspace-api/profile/", views.profile),
    path("workspace-api/procedures/", views.procedures),
    path("workspace-api/cases/", views.cases),
    path("workspace-api/cases/<int:pk>/", views.update_case),
    path("workspace-api/cases/<int:pk>/evidence/", views.upload),
    path("workspace-api/cases/<int:pk>/budget/", views.budget),
    path("workspace-api/budget/<int:pk>/", views.delete_budget),
    path("workspace-api/evidence/<int:pk>/", views.evidence),
    path("workspace-api/audit/", views.audit),
    path("workspace-api/bulletins/", views.bulletins),
    path("workspace-api/assistant/", views.assistant),
    path("workspace-api/notifications/", views.notifications),
    path("workspace-api/proposals/<uuid:pk>/confirm/", views.confirm_proposal),
    path("workspace-api/source/<path:pk>/", views.source),
    path("workspace-api/history/", views.history),
]

for route in list(urlpatterns):
    pattern = str(route.pattern)
    if pattern.startswith("workspace-api/"):
        suffix = pattern.removeprefix("workspace-api/")
        urlpatterns.append(path(
            f"native-api/{suffix}", native_endpoint(
                route.callback, anonymous=suffix in ["register/", "login/", "password-reset/"],
            ),
        ))
