# PHASE 1: INTERPRETATION
inputs:
  - stakeholder_supplied_image
  - interpretation_protocol (Phase1_InterpretationProtocol_v2.yaml)
  - coordinate_placement_spec (# Coordinate Placement Spec v1.yaml)
  - layout_profile (LayoutProfile_v1.yaml)
  - [optional] previous_checkpoint

process:
  1.1) AI creates interpretation summary (markdown)
       - Follows analysis_sequence: baseline count → color semantics → icons → labels → compositions → cross-reference
       - Includes spatial hints (cell_hint, spatial_note) for each identified object
  1.2) User QA review
  1.3) If FAIL:
       - User provides corrections
       - AI updates interpretation
       - AI logs corrections
       - Return to 1.2
       If PASS:
       - AI creates interpretation_checkpoint.yaml (# INTERPRETATION_CHECKPOINT.yaml schema)
       - Spatial hints preserved in checkpoint for Phase 2 consumption
       - Proceed to Phase 2

outputs:
  - interpretation_checkpoint.yaml (includes object IDs, spatial hints, counts)
  - [retained] stakeholder_supplied_image (in context)

---

# PHASE 2: CONSTRUCTION PLANNING
inputs:
  - interpretation_checkpoint.yaml (from Phase 1 — includes spatial hints)
  - stakeholder_supplied_image (still in context — fallback for spatial reference)
  - illustrator_document_state.json (exported via current_state_v2.jsx)
  - construction_protocol (Phase2_ConstructionPlanProtocol_v1.yaml)

process:
  2.1) AI builds Unused Assets catalog (objects on artboard 1 with cell == null)
  2.2) AI filters active objects (artboard 0 only) and normalizes names
  2.3) AI maps: checkpoint IDs → active document objects (three-pass matching)
       - Produces mapping table: checkpoint_id | doc_object_id | operation | notes
  2.4) AI categorizes operations: DUPLICATE, ADD, REMOVE, MOVE, RENAME, KEEP
  2.5) AI sequences operations (Phase A→E) and specifies parameters (cell positions, layers, sources)
  2.6) AI validates plan (dependency, count reconciliation, source existence, cell validity, etc.)
  2.7) AI creates construction_plan.md (human-readable) for user review
  2.8) User QA review
  2.9) If FAIL:
       - User provides corrections
       - AI updates plan
       - Return to 2.8
       If PASS:
       - AI creates construction_checkpoint.yaml (# CONSTRUCTION_CHECKPOINT.yaml schema)
       - Proceed to Phase 3

outputs:
  - construction_checkpoint.yaml (machine-readable, authoritative input for Phase 3)
  - construction_plan.md (human-readable, for user reference)

---

# PHASE 3: SCRIPT GENERATION & EXECUTION
inputs:
  - construction_checkpoint.yaml (from Phase 2 — sequenced operations with full parameters)
  - illustrator_document_state.json
  - script_generation_protocol

process:
  3.1) AI generates JSX script implementing operations from construction_checkpoint.yaml
       - Operations are executed in checkpoint sequence order (Phase A→E)
       - All positions use cell-grid references resolved to document coordinates via cellGrid data
  3.2) [Optional] AI performs dry-run validation
  3.3) User executes script in Illustrator
  3.4) If ERRORS:
       - User reports error message
       - AI debugs and regenerates script
       - Return to 3.3
       If SUCCESS:
       - Proceed to verification

  3.5) User exports post-execution document state (via current_state_v2.jsx)
  3.6) AI verifies: post_state matches construction_checkpoint expected counts and positions
  3.7) AI reports: success | discrepancies

outputs:
  - reconstruct_document.jsx (final script)
  - execution_report.yaml (verification results)

# Process complete
