# SurreyAlign Companion Mobile App — Update Specification

> **For:** Replit AI Agent
> **Purpose:** Update the existing mobile app to reflect server-side changes
> **API Base URL:** `https://surreyalign.org/api/external/v1/`

The server has been significantly updated since the app was first built. This document covers ALL changes the mobile app needs to incorporate. Apply these changes to the existing codebase — do not rebuild from scratch.

---

## PART 1: Calling Lifecycle Updates

### 1A. New Field in Detail Response: `next_action`

Every `GET /calling-requests/{id}` response now includes a `next_action` object alongside `permissions` and `view_level`. This tells the mobile app exactly what the user should do next — no client-side logic needed.

**Response envelope (all view levels):**
```json
{
  "success": true,
  "calling_request": { ... },
  "permissions": { ... },
  "next_action": {
    "type": "vote",
    "heading": "Your Next Step",
    "description": "Prayerfully consider this calling and cast your recommendation.",
    "context": "3 of 10 have responded. No majority yet.",
    "style": "primary",
    "is_terminal": false,
    "is_waiting": false
  },
  "view_level": "voter",
  "is_requestor_only": false
}
```

**TypeScript interface:**
```typescript
interface NextAction {
  type: string;           // Action identifier (see table below)
  heading: string;        // Display heading (e.g., "Your Next Step")
  description: string;    // Human-readable instruction
  context: string | null; // Extra info (vote tally, progress %)
  style: 'primary' | 'success' | 'warning' | 'info' | 'muted' | 'danger';
  is_terminal: boolean;   // True for completed/cancelled/not_approved
  is_waiting: boolean;    // True when user has no action — waiting on someone else
}
```

**Action types the app should handle:**

| type | Who sees it | What to show |
|------|------------|-------------|
| `submit` | Submitter on a draft | "Submit for Review" button |
| `begin_review` | SP/Bishop on submitted request | "Begin Review" button |
| `decide_external` | SP on externally-approved request | "Record Decision" form |
| `provide_recommendation` | SP counselor during discussion | Recommendation form |
| `decide` | SP/Bishop during discussion | Decision form |
| `decide_or_vote` | SP during discussion (HC-required) | Two options: send to HC or decide now |
| `vote` | HC member during voting (not yet voted) | Voting form |
| `voted` | HC member who already voted | "Recommendation submitted" badge |
| `decide_after_voting` | SP during voting phase | Decision form with tally |
| `respond_feedback` | Leader with pending feedback request | Feedback response form |
| `select_nominee` | Decision-maker, multiple individuals | Individual selection |
| `assign_interviewer` | Step manager, no interviewer yet | Interviewer assignment |
| `next_step` | Step manager, next step pending | Step update form |
| `waiting_setting_apart` | Non-interviewer leader | Info: "assigned to [Name]" |
| `mark_complete` | Step manager, all steps done | "Mark Complete" button |
| `waiting_*` | Any `is_waiting: true` state | Status info, no action button |
| `completed` | Anyone on completed request | ✅ Complete badge |
| `cancelled` | Anyone on cancelled request | Cancelled badge |
| `not_approved` | Anyone on not-approved request | Not approved badge with feedback |

**How to render `next_action` in the detail screen:**

Display as a banner/card at the top of the detail view, ABOVE the content tabs:

```
┌─────────────────────────────────────────┐
│ 🔵 Your Next Step                       │  ← heading
│ Prayerfully consider this calling and   │  ← description
│ cast your recommendation.               │
│ 3 of 10 have responded. No majority.    │  ← context (if not null)
│                        [Cast Vote →]    │  ← action button (if !is_waiting)
└─────────────────────────────────────────┘
```

- **Color:** Map `style` to your theme colors (primary=blue, success=green, warning=amber, info=teal, muted=gray, danger=red)
- **When `is_waiting: true`:** Show the banner without an action button — just informational
- **When `is_terminal: true`:** Show as a final-state badge (completed=green, cancelled=gray, not_approved=red with `context` as the feedback text)
- **The action button:** Tapping it should navigate to or reveal the relevant form (vote form, decision form, step update, etc.) — use the `type` field to determine which screen/section to open

---

### 1B. New Endpoint: `GET /calling-requests/action-required`

Returns ONLY the calling requests where the user is the next-action owner — the things that need their attention right now.

**Response:**
```json
{
  "success": true,
  "action_required": [
    {
      "id": 3,
      "request_type": "calling",
      "request_type_label": "Calling",
      "scope": "stake",
      "status": "voting",
      "status_label": "Pending Approval",
      "target_calling": "Stake High Councilor",
      "target_ward": null,
      "target_organization": null,
      "approval_authority": "high_council",
      "approval_authority_label": "High Council",
      "submitted_by": "Bishop Williams",
      "submitted_at": "2026-02-15T...",
      "individuals": [{ "id": 5, "name": "David Smith", "is_selected": false }],
      "selected_individual": null,
      "steps_progress": null,
      "updated_at": "2026-02-18T...",
      "action_label": "Your recommendation needed"
    }
  ],
  "meta": { "total": 1 }
}
```

Each item includes `action_label` — a human-readable string describing the action (e.g., "Your recommendation needed", "Review & begin discussion", "Next: Setting Apart", "Assign interviewer", "Ready to complete").

**Where to use this:**
- **Home screen "Action Needed" section** — show these items as a priority list above the general calling request list
- **Badge count** — use `meta.total` for the Callings tab badge (or keep using `pending-action-count` for the simpler count)
- **Tapping an item** navigates to the calling request detail screen

**TypeScript:**
```typescript
interface ActionRequiredItem extends CallingRequestListItem {
  action_label: string;
}
```

---

### 1C. Setting Apart Ownership

When the next lifecycle step is "Setting Apart", only the **assigned interviewer** sees it as an action. All other leaders see a waiting state instead.

The mobile app doesn't need to implement this logic — it's already handled server-side:
- `next_action.type === "waiting_setting_apart"` → show info banner: "Setting apart — assigned to [Name]"
- `next_action.type === "next_step"` with description containing "Setting Apart" → show the active step form (only the interviewer gets this)

No client-side role checks needed. Just render what `next_action` says.

---

### 1D. Updated Step Label

The step formerly called "Sustained in Sacrament Meeting" is now called **"Business Conducted in Sacrament Meeting"**. This comes from `step_type_label` in the API — no hardcoded label changes needed if the app already uses the API's label field. If you hardcoded the old label anywhere, update it.

---

## PART 2: Stake/Ward Business — Major Updates

The Sunday Business feature has been significantly enhanced with bundles, ward scoping, and role-based UI.

### 2A. Updated Response Shape for `GET /stake-business/sunday`

```json
{
  "success": true,
  "user_context": {
    "role": "high_councilor",
    "label": "Sunday Business",
    "can_manage_queue": false,
    "sees_stake_business": true,
    "sees_ward_business": false,
    "ward_ids": null
  },
  "business_items": [
    {
      "id": 3,
      "bundle_id": "075dc3ee-82a7-4869-88da-34cc73f1d40a",
      "scope": "stake",
      "item_type": "release",
      "item_type_label": "Release",
      "person_name": "Kurtis Beaumont",
      "calling_name": "Stake Young Men First Counselor",
      "organization_name": "Stake Young Men",
      "person_ward": { "id": 5, "name": "Brookswood" },
      "target_ward": null,
      "script_text": "Kurtis Beaumont has been released as Stake Young Men First Counselor...",
      "released_at": "2026-02-19T...",
      "wards_required": [3, 4, 5, 6, 7, 8, 9, 10],
      "wards_completed": [3, 5, 7],
      "wards_outstanding": [4, 6, 8, 9, 10],
      "ward_names": { "3": "Richmond 1st", "4": "Richmond 2nd", "5": "Brookswood", ... },
      "completion_progress": 38,
      "created_at": "2026-02-19T..."
    },
    {
      "id": 4,
      "bundle_id": "075dc3ee-82a7-4869-88da-34cc73f1d40a",
      "scope": "stake",
      "item_type": "sustaining",
      "item_type_label": "Sustaining",
      "person_name": "Joe Martinez",
      "calling_name": "Stake Young Men First Counselor",
      ...
    }
  ],
  "wards": [
    { "id": 3, "name": "Richmond 1st" },
    { "id": 4, "name": "Richmond 2nd" },
    ...
  ]
}
```

### 2B. New Fields Explained

| Field | What it means |
|-------|--------------|
| `user_context` | **Use this for ALL UI decisions.** The `label` field is the screen title. `can_manage_queue` shows/hides the release button. `role` determines which sections to show. |
| `bundle_id` | When non-null, items sharing the same `bundle_id` are a group (release + sustaining for the same calling). **Marking one as conducted marks ALL items in the bundle.** |
| `scope` | `"stake"` = must be conducted in all 8 wards. `"ward"` = only in the target ward. |
| `target_ward` | For ward-scoped items: the specific ward where business must be conducted. Null for stake-scoped. |
| `wards_required` | Array of ward IDs where this item needs to be conducted. 8 IDs for stake, 1 for ward. |
| `wards_completed` | Ward IDs already done. |
| `wards_outstanding` | Ward IDs still needed. |
| `created_at` | Use for "New" (< 7 days) vs "Outstanding" (≥ 7 days) badge logic. |

### 2C. Rendering Bundles

Items with the same `bundle_id` must be rendered as a single card:

```
┌─────────────────────────────────────────┐
│ Stake Young Men First Counselor         │  ← shared calling_name
│                                         │
│ RELEASE                                 │
│ "Kurtis Beaumont has been released as   │
│  Stake Young Men First Counselor..."    │
│                                         │
│ SUSTAINING                              │
│ "Joe Martinez has been called as Stake  │
│  Young Men First Counselor..."          │
│                                         │
│ 3/8 wards ██████░░░░░░  38%            │
│                                         │
│         [Mark as Conducted]             │  ← one button for the whole bundle
└─────────────────────────────────────────┘
```

**Grouping logic:**
```typescript
// Group items by bundle_id (null = standalone)
const bundles = new Map<string | null, SundayBusinessItem[]>();
items.forEach(item => {
  const key = item.bundle_id ?? `standalone_${item.id}`;
  if (!bundles.has(key)) bundles.set(key, []);
  bundles.get(key)!.push(item);
});

// Render each group as one card
// Within a bundle: show release items first, then sustainings
```

**Standalone items** (bundle_id = null): render as individual cards, same as before.

### 2D. Marking as Conducted (Bundle-Aware)

When the user taps "Mark as Conducted", call the API with ANY item ID from the bundle — the server marks ALL items in the bundle for that ward:

```
POST /stake-business/{any_item_id_from_bundle}/complete-ward
{ "ward_id": 9 }
```

**Response includes updated state for ALL bundle items:**
```json
{
  "success": true,
  "items_completed": 2,
  "bundle_id": "075dc3ee-82a7-...",
  "completion": {
    "ward_id": 9,
    "ward_name": "Surrey 4th",
    "conducted_at": "2026-02-19T...",
    "conducted_by": "Danny Veldhoen"
  },
  "updated_items": [
    { "id": 3, "status": "released", "wards_completed": [3, 5, 7, 9], "wards_outstanding": [4, 6, 8, 10] },
    { "id": 4, "status": "released", "wards_completed": [3, 5, 7, 9], "wards_outstanding": [4, 6, 8, 10] }
  ],
  "calling_step_updated": true
}
```

After the response, update ALL items in the local state using `updated_items`. If `calling_step_updated: true`, show a toast: "The calling lifecycle step has been updated."

### 2E. Role-Based UI (user_context)

The `user_context` object from the API drives ALL UI decisions:

**High Councilor (`role: "high_councilor"`):**
```
Screen title: "Sunday Business"           ← from user_context.label
Shows: Only stake-scoped items
Ward selector: All 8 wards (pick which they're visiting)
Actions: Mark as conducted
Cannot: Manage queue, see ward business
```

**Bishop/Bishopric (`role: "ward_leader"`):**
```
Screen title: "Ward Business"             ← from user_context.label
Shows: Only ward-scoped items for their ward
Ward selector: Only their ward (auto-selected, can_manage_queue determines if shown)
Actions: Mark as conducted
Can manage queue: Only if user_context.can_manage_queue === true (Bishop only)
Cannot: See stake business, see other wards
```

**Stake Presidency/Admin (`role: "stake_admin"`):**
```
Screen title: "Stake Business"            ← from user_context.label
Shows: Everything (stake + ward, all wards)
Ward selector: All wards
Actions: Mark as conducted, manage queue
Full access to all features
```

### 2F. Ward-Scoped Items

Ward-scoped items (`scope: "ward"`) only need to be conducted in ONE ward (`target_ward`):

```
┌─────────────────────────────────────────┐
│ 🏠 Ward Business                        │
│ Relief Society First Counselor          │
│                                         │
│ "Sister Jones has been called as..."    │
│                                         │
│ ✅ Surrey 4th — Conducted               │  ← only one ward to check
│         [Already Conducted ✓]           │
└─────────────────────────────────────────┘
```

vs stake-scoped items which show the full 8-ward progress grid.

### 2G. New/Outstanding Badges

Use `created_at` to categorize items on the home screen:

```typescript
const isNew = (item: SundayBusinessItem) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return new Date(item.created_at) > sevenDaysAgo;
};

// New: created within last 7 days, not fully completed
// Outstanding: older than 7 days, not fully completed
```

---

## PART 3: Updated TypeScript Interfaces

### Calling Request Detail Show Response
```typescript
interface CallingRequestShowResponse {
  success: boolean;
  calling_request: CallingRequestDetail | CallingRequestRequestorView;
  permissions: CallingRequestPermissions;
  next_action: NextAction;   // ← NEW
  view_level: 'full' | 'presidency' | 'ward_authority' | 'voter' | 'monitor' | 'requestor';
  is_requestor_only: boolean;
}
```

### Permissions (updated key name)
```typescript
interface CallingRequestPermissions {
  can_move_to_discussion: boolean;
  can_move_to_voting: boolean;
  can_vote: boolean;
  can_decide: boolean;
  can_manage_steps: boolean;
  can_comment: boolean;
  can_request_feedback: boolean;
  can_select_individual: boolean;  // was can_select_nominee
  can_complete: boolean;
  can_cancel: boolean;
}
```

### Sunday Business Item (updated)
```typescript
interface SundayBusinessItem {
  id: number;
  bundle_id: string | null;        // ← NEW: null = standalone, string = grouped
  scope: 'stake' | 'ward';         // ← NEW
  item_type: 'release' | 'sustaining';
  item_type_label: string;
  person_name: string;
  calling_name: string;
  organization_name: string | null;
  person_ward: { id: number; name: string } | null;
  target_ward: { id: number; name: string } | null;  // ← NEW: for ward-scoped items
  script_text: string;
  released_at: string;
  wards_required: number[];          // ← NEW: which wards need this done
  wards_completed: number[];
  wards_outstanding: number[];
  ward_names: Record<string, string>;
  completion_progress: number;
  created_at: string;
}
```

### Sunday Business Response (updated)
```typescript
interface SundayBusinessResponse {
  success: boolean;
  user_context: UserBusinessContext;  // ← NEW
  business_items: SundayBusinessItem[];
  wards: { id: number; name: string }[];
}

interface UserBusinessContext {
  role: 'stake_admin' | 'high_councilor' | 'ward_leader' | 'none';
  label: string;                   // Screen title to display
  can_manage_queue: boolean;       // Show release/manage buttons
  sees_stake_business: boolean;
  sees_ward_business: boolean;
  ward_ids: number[] | null;       // null = all wards
}
```

### Complete Ward Response (updated)
```typescript
interface CompleteWardResponse {
  success: boolean;
  items_completed: number;         // ← NEW: how many items marked (2 for bundle)
  bundle_id: string | null;        // ← NEW
  completion: {
    ward_id: number;
    ward_name: string;
    conducted_at: string;
    conducted_by: string;
  };
  updated_items: {                 // ← NEW: state of ALL bundle items after completion
    id: number;
    status: 'released' | 'completed';
    wards_completed: number[];
    wards_outstanding: number[];
  }[];
  calling_step_updated: boolean;
}
```

---

## PART 4: Complete Endpoint Reference (Updated)

### Calling Requests
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/calling-requests` | List — unchanged |
| POST | `/calling-requests` | Create — unchanged |
| GET | `/calling-requests/submission-context` | Unchanged |
| GET | `/calling-requests/pending-action-count` | Unchanged |
| **GET** | **`/calling-requests/action-required`** | **NEW — action items with labels** |
| GET | `/calling-requests/{id}` | **UPDATED — now includes `next_action`** |
| POST | `/calling-requests/{id}/submit` | Unchanged |
| POST | `/calling-requests/{id}/move-to-discussion` | Unchanged |
| POST | `/calling-requests/{id}/move-to-voting` | Unchanged |
| POST | `/calling-requests/{id}/vote` | Unchanged |
| POST | `/calling-requests/{id}/decide` | Unchanged |
| POST | `/calling-requests/{id}/cancel` | Unchanged |
| POST | `/calling-requests/{id}/presidency-recommendation` | Unchanged |
| POST | `/calling-requests/{id}/feedback` | Unchanged |
| POST | `/calling-requests/{id}/comments` | Unchanged |
| POST | `/calling-requests/{id}/request-feedback` | Unchanged |
| POST | `/calling-requests/{id}/respond-feedback/{fbId}` | Unchanged |
| POST | `/calling-requests/{id}/assign-interviewer` | Unchanged |
| PATCH | `/calling-requests/{id}/steps/{stepId}` | Unchanged |
| POST | `/calling-requests/{id}/select-nominee` | Unchanged (input param still `nominee_id`) |
| POST | `/calling-requests/{id}/complete` | Unchanged |
| GET | `/calling-requests/{id}/interviewer-candidates` | Unchanged |
| GET | `/calling-requests/{id}/feedback-candidates` | Unchanged |

### Stake/Ward Business
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/stake-business/sunday` | **UPDATED — includes `user_context`, `bundle_id`, `scope`, `target_ward`, `wards_required`** |
| GET | `/stake-business/outstanding` | **UPDATED — includes `user_context`, `bundle_id`, `scope`** |
| GET | `/stake-business/{id}` | **UPDATED — includes `bundle_siblings`** |
| POST | `/stake-business/{id}/complete-ward` | **UPDATED — bundle-aware, returns `updated_items`** |

---

## PART 5: Migration Checklist

If you previously used any of these old field names, update them:

| Old | New | Where |
|-----|-----|-------|
| `nominees` | `individuals` | API response arrays |
| `selected_nominee` | `selected_individual` | API response field |
| `can_select_nominee` | `can_select_individual` | permissions object |
| `nominee` (in vote) | `individual` | vote response field |
| `nominee_user_id` | `user_id` | individual detail field |
| "Sustained in Sacrament Meeting" | "Business Conducted in Sacrament Meeting" | step_type_label (from API) |
| No `next_action` | `next_action` object | detail response |
| No `bundle_id` | `bundle_id` field | business items |
| No `scope` | `scope` field | business items |
| No `user_context` | `user_context` object | business response |
| No `wards_required` | `wards_required` array | business items |
| No `target_ward` | `target_ward` object | business items |
