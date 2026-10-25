# Implementation Plan: Mass Balance Tracking System (TC to TC)

## 1. Requirement Analysis
- **Goal**: Track material consumption from a `Purchase TC` to generate an `Output TC` (Sold TC).
- **Key Flow**:
    1.  User has stock from `Purchase TC`.
    2.  User issues material to create an `Output TC`.
    3.  System deducts stock from the specific `Purchase TC`.
    4.  System records the usage against the `Output TC`.

## 2. Database Schema (Revised)
- `MaterialPurchase`: Stores initial stock for each `Purchase TC`.
- `MaterialUsage`: Records consumption linked to a `Purchase TC` and the resulting `Output TC` (Sold TC).

## 3. Workflow Logic (Crucial)
1.  **Purchase**: New `Purchase TC` entry -> Adds stock to `MaterialPurchase`.
2.  **Usage/Issue (for Output TC)**:
    - User initiates "Issue for Output TC".
    - User selects a **Purchase TC** (source of material).
    - User enters **Output TC** (target/sold TC), PI, Commercial Doc, and quantities (Used/Loss).
    - System validates: `Used Qty <= Available Stock` for the selected `Purchase TC`.
    - System updates `MaterialUsage` (linking Source Purchase TC to Output TC) and deducts stock from the source `Purchase TC`.

## 4. UI Implementation
- **Mass Balance Page**: Summary table of `Purchase TCs` with current stock.
- **Issuance Modal**: A form where the user:
    - Picks the **Purchase TC** (Stock Source).
    - Enters the **Output TC** (Sold TC Number).
    - Enters PI, Commercial Doc, Used Qty, and Loss Qty.
    - Submits to finalize the deduction.

---
Please confirm if this "TC to TC" issuance workflow aligns perfectly with your requirements.
