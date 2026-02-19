# SurreyAlign Companion Mobile App — Calling Lifecycle Management Specification

> **For:** Replit AI Agent
> **App:** React Native (Expo) with TypeScript
> **API Base URL:** `https://surreyalign.org/api/external/v1/`
> **Auth:** Laravel Sanctum bearer tokens (90-day expiry)

---

## What You Are Building

A companion mobile app for SurreyAlign.org that lets Church stake leaders manage the full calling lifecycle from their phones. The web app (Laravel) already exists at surreyalign.org. **Both platforms share the same API and database** — a Bishop can start a request on the mobile app, the Stake Presidency can approve it on the web, then a High Councilor gets a push notification on mobile and provides their recommendation there. Any action on either platform is immediately visible on the other.

This is for the Surrey British Columbia Stake of The Church of Jesus Christ of Latter-day Saints. All terminology must use proper LDS nomenclature (see Terminology Table at the end).

---

## Technology Stack

- **React Native** with Expo (managed workflow)
- **TypeScript** for all code
- **Zustand** for state management
- **React Navigation** — bottom tabs + stack navigators
- **Axios** for API communication
- **expo-secure-store** for token storage
- **expo-notifications** for push notifications

---

## 1. Authentication (Already Exists in App)

The login/logout flow is already implemented. The API endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/login` | Authenticate, returns `{ token, user }` |
| POST | `/auth/logout` | Revoke token |
| GET | `/auth/me` | Refresh user profile |

User profile shape:
```json
{
  "id": 42,
  "name": "Flavio Ortolano",
  "email": "...",
  "phone": "...",
  "calling": "Stake President",
  "ward": "Surrey 4th",
  "ward_id": 9,
  "stake": "Surrey British Columbia",
  "stake_id": 1,
  "is_stake_admin": true,
  "is_stake_presidency": true,
  "is_active": true
}
```

---

## 2. Navigation Structure

Add a **"Callings"** tab to the bottom navigation bar (icon: `person-badge`). This tab contains a stack navigator:

```
CallingsTabs (Bottom Tab)
  └── CallingsStack
        ├── CallingRequestList    (index screen)
        ├── CallingRequestCreate  (create form)
        └── CallingRequestDetail  (detail with role-adaptive sections)
```

---

## 3. Screen: Calling Request List

**API:** `GET /calling-requests?status=&scope=&mine_only=&ward_id=`

### Layout

```
┌─────────────────────────────────────────┐
│  Calling Requests          [+ New]      │
│  ▸ 3 pending actions                    │
├─────────────────────────────────────────┤
│  [All ▼] [Stake|Ward] [My Requests □]  │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ EQ President — Surrey 1st Ward     │ │
│ │ James Brown, Michael Lee           │ │
│ │ ⬤ Pending Approval · Stake · 1d   │ │
│ │ ██████░░░░ 6/10 approved           │ │
│ │ ⚠️ Your recommendation needed      │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Primary President — Surrey 2nd     │ │
│ │ Sarah Johnson ✓                    │ │
│ │ ⬤ In Progress · Ward · 5d         │ │
│ │ ████████░░ 67% steps complete      │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Card Data Mapping (from list item response)

- **Title:** `target_calling` (calling name)
- **Subtitle:** `target_ward` + `target_organization` if present
- **Individuals:** comma-separated `individuals[].name`, selected individual gets ✓
- **Status badge:** `status_label` with color coding (see Status Colors below)
- **Scope chip:** "Stake" or "Ward"
- **Progress:** if `status=voting` → show vote tally from detail; if `status=in_progress` → show `steps_progress`%
- **Time:** `updated_at` as relative ("2h ago", "1d ago")

### Pending Action Badge

Call `GET /calling-requests/pending-action-count` on load → returns `{ pending_action_count: 3 }`. Show as a badge on the tab icon and at the top of the list.

### Filters (persist in local state)

- **Status:** All, Draft, Submitted, Under Consideration, Pending Approval, Approved, Not Approved, In Progress, Completed, Cancelled
- **Scope toggle:** All | Stake | Ward
- **"My Requests" toggle:** passes `mine_only=true`
- **Ward dropdown:** only shown when scope=Ward

### Status Colors

| Status | Background | Text Color |
|--------|-----------|------------|
| draft | `#f3f4f6` | `#6b7280` |
| submitted | `#e0e7ff` | `#3730a3` |
| discussion | `#dbeafe` | `#1e40af` |
| voting | `#fef3c7` | `#92400e` |
| approved | `#d1fae5` | `#065f46` |
| not_approved | `#fce7f3` | `#9d174d` |
| in_progress | `#dbeafe` | `#1e40af` |
| completed | `#d1fae5` | `#065f46` |
| cancelled | `#f3f4f6` | `#6b7280` |

### Pull-to-refresh

Refetches the list + pending action count.

---

## 4. Screen: Create Calling Request

This is a scrollable form with 4 sections. **The server controls all dropdown options — the mobile app never applies its own business rule filtering.** When a selection changes, call the appropriate API to get the next dropdown's valid options.

### API Call Sequence

```
ON FORM LOAD (parallel):
  GET /calling-requests/submission-context
    → { allowed_scopes, allowed_wards, can_create }
  GET /reference/wards
    → all wards (for individual's ward dropdown — see note below)

WHEN SCOPE CHANGES:
  GET /reference/callings?scope=ward   (or scope=stake)
    → server returns ONLY valid callings for that scope

WHEN WARD CHANGES:
  GET /reference/organizations?level=ward&ward_id=3
    → organizations for that ward only

WHEN CALLING CHANGES:
  GET /reference/current-holders/{callingId}
    → { holders: [{user_id, user_name, label}] }
    → auto-fill "Current Holder" (pick holder matching selected ward_id)

ON SUBMIT:
  POST /calling-requests
    → server validates scope + ward authorization, returns 403 if unauthorized
```

### Section 1: Request Details

```
┌─────────────────────────────────────────┐
│ ① Request Details                       │
├─────────────────────────────────────────┤
│ Request Type:    [Calling ▼]            │
│ Scope:           [Ward ▼]              │
│                  (options from           │
│                   submission-context     │
│                   allowed_scopes)        │
│ Ward:            [Surrey 4th ▼]         │
│                  (options from           │
│                   submission-context     │
│                   allowed_wards;         │
│                   null = use full wards  │
│                   list; hidden when      │
│                   scope=stake)           │
└─────────────────────────────────────────┘
```

**Scope dropdown:** Only show options from `allowed_scopes`. A ward RS President sees only "Ward". Stake Presidency sees both.

**Ward dropdown:** When `allowed_wards` is null (unrestricted), show all wards from `GET /reference/wards`. When it's an array, show only those wards. Hidden when scope is "Stake".

### Section 2: Calling

```
┌─────────────────────────────────────────┐
│ ② Calling                              │
├─────────────────────────────────────────┤
│ Calling:         [Primary President ▼]  │
│ Organization:    [Surrey 4th Primary ▼] │
│ Current Holder:  [Debora Silva ▼]       │
│                  ℹ Auto-detected         │
└─────────────────────────────────────────┘
```

**Calling dropdown:** Populated from `GET /reference/callings?scope={selectedScope}`. The server handles all exclusions (Bishop/Branch President excluded from ward scope, Stake President always excluded).

**Organization dropdown:** Populated from `GET /reference/organizations?level=ward&ward_id={selectedWard}` (or `?level=stake` when scope=stake). Auto-select: when the calling has an `organization_type` that matches an org's `type`, auto-select it.

**Current Holder:** When calling changes, call `GET /reference/current-holders/{callingId}`. The response contains all holders of that calling. Pick the one matching `ward_id` of the selected ward. If no holder for that ward → show "Calling is currently vacant" hint.

### Section 3: Individual(s) Prayerfully Considered (1–3)

```
┌─────────────────────────────────────────┐
│ ③ Individual(s) Prayerfully Considered  │
├─────────────────────────────────────────┤
│ ┌───────────────────────────────────┐   │
│ │ Name*:        [_________________] │   │
│ │ Ward:         [Select Ward ▼]     │   │
│ │ Current Calling: [Select... ▼]    │   │
│ │ Recommendation: [_______________] │   │
│ └───────────────────────────────────┘   │
│        [+ Add Another Individual]       │
│        (max 3, button hidden at 3)      │
└─────────────────────────────────────────┘
```

**Individual's Ward dropdown:** Uses `allowed_wards` from submission-context. Ward-only users see only their own ward. Stake users see all wards.

**Current Calling dropdown:** For ward-only users, call `GET /reference/callings?scope=ward` (flat list, no grouping). For stake users, call `GET /reference/callings` (all callings).

**Add Another Individual:** Appends a new card (max 3). Each card after the first has a ✕ remove button.

### Section 4: Context (Optional)

```
┌─────────────────────────────────────────┐
│ ④ Context & Background (Optional)      │
├─────────────────────────────────────────┤
│ [Multi-line text input]                 │
└─────────────────────────────────────────┘
```

### Submit Buttons

```
[Cancel]  [Save as Draft]  [Submit for Review]
```

- **Save as Draft:** `POST /calling-requests` (creates with status=draft)
- **Submit for Review:** `POST /calling-requests` then `POST /calling-requests/{id}/submit`

### POST /calling-requests Payload

```json
{
  "request_type": "calling",
  "scope": "ward",
  "target_calling_id": 42,
  "target_organization_id": 15,
  "target_ward_id": 3,
  "ward_id": 3,
  "current_holder_user_id": 108,
  "context_notes": "...",
  "nominees": [
    {
      "name": "John Smith",
      "user_id": null,
      "ward_id": 3,
      "current_calling_id": 27,
      "recommendation": "Brother Smith has been..."
    }
  ]
}
```

Note: The input field name is `nominees` (database column name). The API *response* returns these as `individuals`.

---

## 5. Screen: Calling Request Detail

**API:** `GET /calling-requests/{id}`

The response includes `view_level`, `is_requestor_only`, and a `permissions` object. What the user sees depends entirely on their view level.

### 5A. Header (all view levels)

```
┌─────────────────────────────────────────┐
│ ← Back                                  │
│ EQ President                            │
│ ⬤ Pending Approval                     │
│ Calling · Stake · High Council          │
│ Surrey 1st Ward · Elders Quorum         │
│                                         │
│ [Action Button(s) based on permissions] │
└─────────────────────────────────────────┘
```

Action buttons (only show when permission is true):

| Permission | Button | When |
|-----------|--------|------|
| `can_move_to_discussion` | "Begin Review" | status=submitted |
| `can_move_to_voting` | "Request Approvals" | status=discussion, HC-required |
| `can_complete` | "Mark Complete" | status=in_progress |
| `can_cancel` | "Cancel Request" | any non-terminal |

**Note:** `can_decide` does NOT get a header button — the decision form is inside the Discussion or Approvals tab to prevent accidental clicks.

### 5B. Requestor View (`is_requestor_only: true`)

Shows: Overview card, individuals list (with recommendations), status timeline, progress bar.

**Status Timeline** — render from the `timeline` array:

```
┌─────────────────────────────────────────┐
│ Status Timeline                         │
├─────────────────────────────────────────┤
│  ● Draft                    Feb 15      │
│  ● Submitted                Feb 16      │
│  ◉ Under Prayerful Review   (current)   │
│  ○ Approved                             │
│  ○ In Progress                          │
│  ○ Completed                            │
└─────────────────────────────────────────┘
```

Filled circles for `reached`, highlighted ring for `active`, empty circles otherwise.

### 5C. Monitor View (`view_level: "monitor"`)

Same as requestor but individuals are shown WITHOUT recommendations. No tabs, no deliberation details.

### 5D. Governance View (`view_level: "full", "presidency", "ward_authority", "voter"`)

Full tabbed interface:

```
[ Discussion ] [ Approvals ] [ Required Steps ]
```

- **Approvals tab:** only shown when `approval_authority = "high_council"`
- **Required Steps tab:** only shown when `steps` array is non-empty

---

#### Discussion Tab

Contains (in order):

1. **Confidential Feedback section** (if `feedback_requests` present; entries where `is_confidential=true` only visible when `view_level=full`)
2. **Request Feedback form** (when `can_request_feedback` is true)
   - Dropdown: `GET /calling-requests/{id}/feedback-candidates`
   - **Scope-aware:** Stake-level → Bishops + Stake RS President; Ward-level → Stake Presidency
   - Submit: `POST /calling-requests/{id}/request-feedback`
3. **Respond to Feedback** — if current user has a pending feedback request addressed to them, show inline response form
   - Submit: `POST /calling-requests/{id}/respond-feedback/{feedbackId}`
4. **Discussion thread** (comments where `phase != presidency_recommendation`)
   - Add comment: `POST /calling-requests/{id}/comments`
5. **SP Counselor Recommendation** (when user is SP counselor and status=discussion, stake-level)
   - Submit: `POST /calling-requests/{id}/presidency-recommendation`
6. **Presidency Counsel card** (when `can_decide` and recommendations exist)
7. **Stake President Decision form** (when `can_decide` and status=discussion)
   - Compact inline: radio buttons + feedback textarea + "Record Decision" button
   - Submit: `POST /calling-requests/{id}/decide`

---

#### External Approval Card

When `approval_authority` is `first_presidency_lcr` or `quorum_of_twelve` AND status is `submitted`:

```
┌─────────────────────────────────────────┐
│ 🏛 Awaiting Approval from the           │
│   First Presidency                      │
├─────────────────────────────────────────┤
│ This calling requires approval from     │
│ the First Presidency through LCR.       │
│                                         │
│ Has approval been received?             │
│ ○ Yes — Approval Received              │
│ ○ Not Approved                          │
│ Notes: [_____________________________] │
│              [Record Decision]          │
└─────────────────────────────────────────┘
```

Button says **"Record Decision"** (not "Approve") — HQ approved, not the SP.

---

#### Approvals Tab (HC Voting)

1. **Summary cards:** Approve count / Not Approved count / Pending count
2. **Individual Approvals list:** Each HC member with vote badge + comment
   - When `is_private=true` and `view_level != full`: comment shows as null (display "Private comment — Stake President only")
   - When `is_private=true` and `view_level = full`: show comment with "Private" badge
3. **Voting form** (when `can_vote` is true):
   - If multiple individuals: radio "Which individual do you feel inspired to support?"
   - Radio: Approve / Not Approved
   - Comment textarea
   - Checkbox: "Private comment (visible to Stake President only)"
   - Submit: `POST /calling-requests/{id}/vote` with `{ vote, nominee_id, comment, is_private }`
4. **Stake President Decision** (when `can_decide` and status=voting)
   - Shows vote tally summary
   - Compact inline decision form: "Record Decision"
   - Submit: `POST /calling-requests/{id}/decide`

---

#### Required Steps Tab

1. **Interviewer Assignment** (when `can_manage_steps` and no interviewer yet):
   - Compact inline: label + dropdown + Assign button
   - Dropdown: `GET /calling-requests/{id}/interviewer-candidates`
   - Hint adapts to `interviewer_rule`: "Stake President only" / "SP counselor or HC" / "Bishopric member"
   - Submit: `POST /calling-requests/{id}/assign-interviewer`

2. **Steps Checklist** with progress bar:
   - Each step: icon (✅ completed, 🔄 in_progress, —— skipped, ○ pending), label, assigned person, scheduled date, notes
   - When `can_manage_steps`: inline date picker + status dropdown for actionable steps
   - Submit: `PATCH /calling-requests/{id}/steps/{stepId}`

**Step types and labels:**

| step_type | Label |
|-----------|-------|
| assign_interviewer | Assign Who Will Interview |
| interview_scheduled | Interview Scheduled |
| calling_extended | Calling Extended |
| calling_accepted | Calling Accepted |
| calling_declined | Calling Declined |
| release_interview | Release Interview |
| sunday_announcement | Sustained in Sacrament Meeting |
| setting_apart | Setting Apart |
| training | Orientation & Training |
| record_updated | Records Updated |

**Special behaviors (server-side, app just reflects):**
- Completing "Calling Accepted" auto-skips "Calling Declined" (and vice versa)
- "Release Interview" auto-skipped when calling was vacant
- Completing "Records Updated" auto-updates the user_callings table

---

## 6. Individual Selection

When `can_select_individual` is true and there are multiple individuals, show a "Choose This Individual" button next to each. **Only show when count > 1** — with a single individual, selection is implicit at approval.

Submit: `POST /calling-requests/{id}/select-nominee` with `{ nominee_id }`

(Note: The API input field is `nominee_id` — this is the database column name. The display text should say "Individual".)

---

## 7. Complete API Endpoint Reference

### Authentication
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/login` | Login → `{ token, user }` |
| POST | `/auth/logout` | Revoke token |
| GET | `/auth/me` | Refresh profile |

### Reference Data (for dropdowns)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/reference/callings?scope=ward` | Callings filtered by scope (recommended for create form) |
| GET | `/reference/callings` | All callings (for individual's current calling dropdown) |
| GET | `/reference/wards` | All wards in user's stake |
| GET | `/reference/organizations?level=ward&ward_id=3` | Organizations filtered by level + ward |
| GET | `/reference/users/search?q=John&ward_id=3` | Search users (min 2 chars, max 25 results) |
| GET | `/reference/current-holders/{callingId}` | Current holder(s) of a calling |

### Calling Requests
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/calling-requests` | List (filters: status, scope, mine_only, ward_id) |
| POST | `/calling-requests` | Create new request with individuals |
| GET | `/calling-requests/submission-context` | User's allowed scopes + wards for create form |
| GET | `/calling-requests/pending-action-count` | Badge count for pending actions |
| GET | `/calling-requests/{id}` | Full detail (filtered by view_level) |
| POST | `/calling-requests/{id}/submit` | Draft → Submitted |
| POST | `/calling-requests/{id}/move-to-discussion` | Submitted → Discussion |
| POST | `/calling-requests/{id}/move-to-voting` | Discussion → Voting (HC required) |
| POST | `/calling-requests/{id}/vote` | Cast HC recommendation |
| POST | `/calling-requests/{id}/decide` | Approve or Not Approve (final decision) |
| POST | `/calling-requests/{id}/cancel` | Cancel request |
| POST | `/calling-requests/{id}/presidency-recommendation` | SP counselor advisory recommendation |
| POST | `/calling-requests/{id}/feedback` | Add rejection feedback text |
| POST | `/calling-requests/{id}/comments` | Add discussion comment |
| POST | `/calling-requests/{id}/request-feedback` | Request confidential feedback from leader |
| POST | `/calling-requests/{id}/respond-feedback/{fbId}` | Respond to feedback request |
| POST | `/calling-requests/{id}/assign-interviewer` | Assign who will conduct interview |
| PATCH | `/calling-requests/{id}/steps/{stepId}` | Update logistics step |
| POST | `/calling-requests/{id}/select-nominee` | Select which individual was chosen |
| POST | `/calling-requests/{id}/complete` | Mark entire workflow complete |
| GET | `/calling-requests/{id}/interviewer-candidates` | Eligible interviewers for this request |
| GET | `/calling-requests/{id}/feedback-candidates` | Eligible feedback respondents (scope-aware) |

---

## 8. API Response Shapes

### List Item
```typescript
interface CallingRequestListItem {
  id: number;
  request_type: 'calling' | 'release' | 'priesthood_advancement';
  request_type_label: string;
  scope: 'stake' | 'ward';
  status: CallingRequestStatus;
  status_label: string;
  target_calling: string | null;
  target_ward: string | null;
  target_organization: string | null;
  approval_authority: ApprovalAuthority;
  approval_authority_label: string;
  submitted_by: string | null;
  submitted_at: string | null;
  individuals: { id: number; name: string; is_selected: boolean }[];
  selected_individual: string | null;
  steps_progress: number | null;
  updated_at: string;
}
```

### Detail (governance view)
```typescript
interface CallingRequestDetail {
  id: number;
  request_type: string;
  request_type_label: string;
  scope: 'stake' | 'ward';
  status: CallingRequestStatus;
  status_label: string;
  target_calling: { id: number; name: string; level: string; category: string } | null;
  target_ward: { id: number; name: string } | null;
  target_organization: { id: number; name: string } | null;
  ward: { id: number; name: string } | null;
  current_holder: { id: number; name: string } | null;
  approval_authority: ApprovalAuthority;
  approval_authority_label: string;
  context_notes: string | null;
  submitted_by: { id: number; name: string } | null;
  submitted_at: string | null;
  decided_by: { id: number; name: string } | null;
  decided_at: string | null;
  decision_feedback: string | null;
  interviewer: { id: number; name: string } | null;
  interviewer_rule: 'stake_president_only' | 'stake_presidency_or_hc' | 'bishopric_member';
  individuals: Individual[];
  selected_individual: Individual | null;
  votes?: Vote[];
  vote_tally?: { approve: number; disapprove: number; total_voters: number };
  comments?: Comment[];
  feedback_requests?: FeedbackRequest[];
  steps?: Step[];
  steps_progress: number;
  created_at: string;
  updated_at: string;
}
```

### Requestor View (stripped)
```typescript
interface CallingRequestRequestorView {
  id: number;
  request_type: string;
  request_type_label: string;
  scope: string;
  status: string;
  status_label: string;
  target_calling: { id: number; name: string } | null;
  target_ward: { id: number; name: string } | null;
  target_organization: { id: number; name: string } | null;
  context_notes: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  decision_feedback: string | null;
  individuals: { id: number; name: string; recommendation: string; is_selected: boolean }[];
  selected_individual: string | null;
  steps_progress: number | null;
  timeline: TimelinePhase[];
  created_at: string;
  updated_at: string;
}

interface TimelinePhase {
  phase: string;
  label: string;
  reached: boolean;
  active: boolean;
  date: string | null;
}
```

### Permissions Object
```typescript
interface CallingRequestPermissions {
  can_move_to_discussion: boolean;
  can_move_to_voting: boolean;
  can_vote: boolean;
  can_decide: boolean;
  can_manage_steps: boolean;
  can_comment: boolean;
  can_request_feedback: boolean;
  can_select_individual: boolean;
  can_complete: boolean;
  can_cancel: boolean;
}
```

### Show Response Envelope
```typescript
interface CallingRequestShowResponse {
  success: boolean;
  calling_request: CallingRequestDetail | CallingRequestRequestorView;
  permissions: CallingRequestPermissions;
  view_level: 'full' | 'presidency' | 'ward_authority' | 'voter' | 'monitor' | 'requestor';
  is_requestor_only: boolean;
}
```

### Submission Context
```typescript
interface SubmissionContext {
  success: boolean;
  allowed_scopes: ('stake' | 'ward')[];
  allowed_wards: { id: number; name: string }[] | null; // null = unrestricted
  can_create: boolean;
}
```

### Sub-types
```typescript
interface Individual {
  id: number;
  name: string;
  user_id: number | null;
  recommendation: string | null;
  is_selected: boolean;
  sort_order: number;
}

interface Vote {
  id: number;
  voter: { id: number; name: string } | null;
  individual: { id: number; name: string } | null;
  vote: 'approve' | 'disapprove';
  comment: string | null;  // null when is_private=true and view_level != 'full'
  is_private: boolean;
  voted_at: string;
}

interface Comment {
  id: number;
  author: { id: number; name: string } | null;
  comment: string;
  phase: string;
  is_internal: boolean;
  created_at: string;
}

interface FeedbackRequest {
  id: number;
  requested_by: { id: number; name: string } | null;
  requested_of: { id: number; name: string } | null;
  reason: string | null;
  response: string | null;
  responded_at: string | null;
  is_pending: boolean;
  is_confidential: boolean;
}

interface Step {
  id: number;
  step_type: StepType;
  step_type_label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  assigned_to: { id: number; name: string } | null;
  scheduled_date: string | null;
  completed_at: string | null;
  completed_by: { id: number; name: string } | null;
  notes: string | null;
  sort_order: number;
}

type CallingRequestStatus =
  | 'draft' | 'submitted' | 'discussion' | 'voting'
  | 'approved' | 'not_approved' | 'in_progress' | 'completed' | 'cancelled';

type ApprovalAuthority =
  | 'high_council' | 'bishopric' | 'first_presidency_lcr' | 'quorum_of_twelve';

type StepType =
  | 'assign_interviewer' | 'interview_scheduled' | 'calling_extended'
  | 'calling_accepted' | 'calling_declined' | 'release_interview'
  | 'sunday_announcement' | 'setting_apart' | 'training' | 'record_updated';
```

---

## 9. Push Notifications (Future Enhancement)

Register for push notifications. The server sends on these events:

| Event | Recipients | Message |
|-------|-----------|---------|
| Request submitted | SP (stake) / Bishop (ward) | "New calling request: {calling}" |
| Moved to discussion | Submitter | "Your request is now under consideration" |
| Moved to voting | All HC members | "Recommendation needed: {calling}" |
| Decision made (approved) | Submitter | "Calling request approved: {calling}" |
| Decision made (not approved) | Submitter | "Calling request update: {calling}" |
| Feedback requested | Respondent | "Confidential feedback requested for {calling}" |
| Step completed | SP/Bishop/Exec Sec | "{step} completed for {calling}" |
| Workflow completed | Submitter | "Calling process completed: {calling}" |

---

## 10. Offline Behavior

- **List:** Cache last fetch in AsyncStorage. Show cached immediately, refresh from API in background.
- **Detail:** Cache last viewed per request ID.
- **Create:** Allow draft creation offline. Queue for submission when online.
- **Actions** (vote, decide, step update): Require connectivity. Show "No connection" toast.

---

## 11. CRITICAL — Terminology Table

This is a Church of Jesus Christ of Latter-day Saints leadership tool. Every label in the mobile app MUST use these terms:

| Concept | ✅ Use This | ❌ Never Use |
|---------|-----------|------------|
| People being considered | Individual(s) Prayerfully Considered | Nominees, Candidates |
| HC voting | Approvals / Provide Your Recommendation | Voting / Cast Your Vote |
| HC disapproval | Not Approved | Rejected, Disapproved |
| Position | Calling | Position, Role, Job |
| Person doing interview | Interviewed by | Interviewer |
| Post-approval tracking | Required Steps | Logistics, Tasks |
| Discussion+voting (requestor view) | Under Prayerful Review | Under Review |
| Discussion phase (governance view) | Under Consideration | Discussion |
| Voting phase (governance view) | Pending Approval | Voting |
| SP counselor input | Provide Your Recommendation | Cast Your Vote |
| Sustained publicly | Sustained in Sacrament Meeting | Sunday Announcement |
| External HQ decision button | Record Decision | Approve |
| Decision-maker for stake | Stake President | Admin, Approver |
| Decision-maker for ward | Bishop | Manager, Approver |

---

## 12. Design Principles

1. **Server is the single source of truth.** The mobile app never applies business rule filtering. Every dropdown gets its valid options from an API call. If the server returns 3 callings, the app shows 3 callings.

2. **Permissions drive the UI.** The `permissions` object tells the app exactly which buttons/forms to show. Never hardcode role checks in the mobile app — just check `permissions.can_vote`, `permissions.can_decide`, etc.

3. **View level drives content visibility.** Use `view_level` from the response to determine which sections to render. Don't duplicate the server's access logic.

4. **Both platforms are interchangeable.** A workflow started on the web app continues seamlessly on mobile and vice versa. The API is the bridge — same endpoints, same data, same authorization.
