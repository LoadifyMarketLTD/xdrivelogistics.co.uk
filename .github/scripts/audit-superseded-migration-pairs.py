import base64
import difflib
import json
import os
import urllib.parse
import urllib.request

PAIRS = [
    ("102_restrict_onboarding_applicant_state_writes.sql", "107_restrict_onboarding_applicant_state_writes.sql"),
    ("103_p0_p1_launch_hardening.sql", "108_p0_p1_launch_hardening.sql"),
    ("104_lock_owner_driver_onboarding_evidence_writes.sql", "109_lock_owner_driver_onboarding_evidence_writes.sql"),
    ("105_assign_job_driver_atomic.sql", "110_assign_job_driver_atomic.sql"),
    ("106_onboarding_compliance_profile_schema_guards.sql", "111_onboarding_compliance_profile_schema_guards.sql"),
    ("107_review_onboarding_application_atomic.sql", "112_review_onboarding_application_atomic.sql"),
    ("108_promote_to_platform_owner.sql", "113_promote_to_platform_owner.sql"),
    ("109_notification_events_recipient_fk.sql", "114_notification_events_recipient_fk.sql"),
    ("110_observable_email_trigger_settings.sql", "115_observable_email_trigger_settings.sql"),
    ("111_notify_invoice_created.sql", "116_notify_invoice_created.sql"),
    ("112_canonical_onboarding_submit_all_writes.sql", "117_canonical_onboarding_submit_all_writes.sql"),
    ("113_prelaunch_hot_path_indexes.sql", "118_prelaunch_hot_path_indexes.sql"),
]

API = os.environ["GITHUB_API_URL"]
REPOSITORY = os.environ["GITHUB_REPOSITORY"]
REF = os.environ["GITHUB_SHA"]
TOKEN = os.environ["GH_TOKEN"]


def fetch(name: str) -> str:
    path = urllib.parse.quote(f"supabase/migrations/{name}", safe="/")
    url = f"{API}/repos/{REPOSITORY}/contents/{path}?ref={urllib.parse.quote(REF)}"
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(request) as response:
        payload = json.load(response)
    return base64.b64decode(payload["content"]).decode("utf-8-sig").replace("\r\n", "\n")


def normalized_lines(text: str) -> list[str]:
    return [
        line.rstrip()
        for line in text.splitlines()
        if line.strip() and not line.lstrip().startswith("--")
    ]


for earlier, later in PAIRS:
    old_lines = normalized_lines(fetch(earlier))
    new_lines = normalized_lines(fetch(later))
    matcher = difflib.SequenceMatcher(a=old_lines, b=new_lines, autojunk=False)
    opcodes = matcher.get_opcodes()
    item = {
        "earlier": earlier,
        "later": later,
        "equal": old_lines == new_lines,
        "similarity": round(matcher.ratio(), 4),
        "earlierLines": len(old_lines),
        "laterLines": len(new_lines),
        "inserted": sum(j2 - j1 for tag, i1, i2, j1, j2 in opcodes if tag in ("insert", "replace")),
        "deleted": sum(i2 - i1 for tag, i1, i2, j1, j2 in opcodes if tag in ("delete", "replace")),
    }
    print("SUPABASE_SUPERSEDED_PAIR=" + json.dumps(item, separators=(",", ":")))
