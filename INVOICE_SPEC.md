# PLC Teacher Invoice - Feature Spec

## Overview
Build a new teacher invoice page that replaces the existing basic invoice system. This is a comprehensive monthly billing statement for each teacher showing all charges (room rental, photocopy, registration fees, overdue fees) and payment details.

## Invoice Layout (Sections in Order)

### Header
- Title: "PERSEVERANCE LEARNING CENTRE" (bold, centered)
- Subtitle: "TEACHER MONTHLY INVOICE"
- Month/Year selector (e.g., "APRIL 2026")
- Teacher name (dropdown to select teacher)

### Section 1: Room Rental
A table with 3 rate tiers:

| Rate | Hours | Amount (RM) |
|------|-------|-------------|
| RM22/hr | [auto-calculated from schedule] | [hours × 22] |
| RM20/hr | [default 0, editable] | [hours × 20] |
| RM12/hr | [default 0, editable] | [hours × 12] |
| **Subtotal** | | **[sum]** |

**Logic:**
- All teaching hours default to the RM22/hr row (auto-calculated from class_sessions for the selected month)
- RM20/hr and RM12/hr rows start at 0 hours — admin can manually type hours to move them from the RM22 row
- When admin enters hours in RM20 or RM12, those hours are subtracted from RM22 automatically
- All rate values (22, 20, 12) are editable (admin can change the rate)

### Section 2: Photocopy Meter
| Field | Value |
|-------|-------|
| Price per page | [default from settings, editable] |
| Previous reading | [editable] |
| Current reading | [editable] |
| Pages used | [auto: current - previous] |
| **Subtotal** | **[pages × price]** |

### Section 3: Registration Fee
| Field | Value |
|-------|-------|
| Number of students | [editable] |
| Fee per student | [editable, default from settings] |
| Rebate per student | [editable, default RM25] |
| **Subtotal** | **[(fee - rebate) × students]** |

Note: The RM100 first subject / RM50 additional is the student-facing fee. The registration fee on the teacher invoice is what PLC collects/charges from the teacher (commission-like). Make all fields editable.

### Section 4: Overdue Fee
| Field | Value |
|-------|-------|
| Overdue amount | [editable, default 0] |
| Description | [editable text field] |

Purely manual — admin types the amount if there's an outstanding balance from previous months.

### Section 5: Summary
| Item | Amount (RM) |
|------|-------------|
| Room Rental | [from section 1] |
| Photocopy | [from section 2] |
| Registration Fee | [from section 3] |
| Overdue Fee | [from section 4] |
| **GRAND TOTAL** | **[sum of all]** |

### Section 6: Bank Details
- Bank: RHB (default, editable)
- Account Number: 26003200018111 (default, editable)
- Account Name: (editable)

### Section 7: Remark
- Text area with default text (about Jaycie — the admin person at PLC)
- Fully editable
- Default: "Please make payment to Jaycie or bank transfer to the account above. Thank you."

## Technical Implementation

### Database Changes
Create a new table `teacher_invoices` to store the full invoice with all editable fields:

```sql
CREATE TABLE teacher_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES teachers(id) NOT NULL,
  month text NOT NULL, -- '2026-04'
  
  -- Room rental (3 tiers)
  rental_rate_1 numeric DEFAULT 22,
  rental_hours_1 numeric DEFAULT 0,
  rental_rate_2 numeric DEFAULT 20,
  rental_hours_2 numeric DEFAULT 0,
  rental_rate_3 numeric DEFAULT 12,
  rental_hours_3 numeric DEFAULT 0,
  
  -- Photocopy
  photocopy_price numeric DEFAULT 0.05,
  photocopy_prev_reading numeric DEFAULT 0,
  photocopy_curr_reading numeric DEFAULT 0,
  
  -- Registration fee
  reg_fee_students integer DEFAULT 0,
  reg_fee_per_student numeric DEFAULT 50,
  reg_fee_rebate numeric DEFAULT 25,
  
  -- Overdue
  overdue_amount numeric DEFAULT 0,
  overdue_description text DEFAULT '',
  
  -- Bank details
  bank_name text DEFAULT 'RHB',
  bank_account text DEFAULT '26003200018111',
  bank_account_name text DEFAULT 'PERSEVERANCE LEARNING CENTRE',
  
  -- Remark
  remark text DEFAULT 'Please make payment to Jaycie or bank transfer to the account above. Thank you.',
  
  -- Status
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid')),
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(teacher_id, month)
);

-- RLS
ALTER TABLE teacher_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on teacher_invoices"
  ON teacher_invoices FOR ALL
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Teachers view own invoices"
  ON teacher_invoices FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM teachers WHERE user_id = auth.uid()
    )
  );
```

### Page: `/invoices` (Replace existing)

**UI Flow:**
1. Top: Month picker + Teacher dropdown + "Generate Invoice" button
2. Below: List of existing invoices for the selected month (cards showing teacher name, total, status)
3. Click on invoice → opens full editable invoice form
4. "Generate" auto-fills from class_sessions data, but everything is editable
5. "Save Draft" / "Mark Issued" / "Mark Paid" buttons
6. "Print" button → clean print-friendly layout

**Generate Logic:**
1. Select teacher + month
2. Query `class_sessions` for that teacher+month (non-cancelled)
3. Calculate total hours → put ALL hours in rental_rate_1 (RM22) row
4. Pre-fill other fields with defaults
5. Save as draft

**The key principle: everything auto-fills with smart defaults, but admin can override ANY field.**

### Existing Code Context
- Supabase client: `@/lib/supabase/client`
- Auth context: `@/lib/auth-context`
- UI components: shadcn/ui (Card, Button, Input, Dialog, Table, etc.)
- Types: `@/lib/types.ts`
- Dashboard layout: `@/app/(dashboard)/layout.tsx`
- Existing invoice page (to be replaced): `@/app/(dashboard)/invoices/page.tsx`

### Style
- Use blue primary color (#2563eb) consistent with rest of PLC app
- Mobile-first responsive
- Clean, professional layout suitable for printing
- Use shadcn/ui components

### Print Layout
When printing, hide navigation and show a clean invoice format suitable for handing to a teacher.

## DON'T
- Don't change any other pages
- Don't modify the database schema for existing tables
- Don't break existing functionality
- Don't use the old `invoices` / `invoice_items` tables — create new `teacher_invoices` table
