# PHASE 1: INTERPRETATION
inputs:
  - stakeholder_supplied_image
  - interpretation_protocol
  - [optional] previous_checkpoint

process:
  1.1) AI creates interpretation summary (markdown)
  1.2) User QA review
  1.3) If FAIL:
       - User provides corrections
       - AI updates interpretation
       - AI logs corrections
       - Return to 1.2
       If PASS:
       - AI creates interpretation_checkpoint.yaml
       - Proceed to Phase 2

outputs:
  - interpretation_checkpoint.yaml
  - [retained] stakeholder_supplied_image (in context)

---

# PHASE 2: CONSTRUCTION PLANNING
inputs:
  - interpretation_checkpoint.yaml (from Phase 1)
  - stakeholder_supplied_image (still in context)
  - illustrator_document_state.json (exported)
  - construction_protocol

process:
  2.1) AI maps: checkpoint ID's to their corresponding document_state objects.
  2.2) AI creates construction_plan (markdown with operations list)
  2.3) User QA review
  2.4) If FAIL:
       - User provides corrections
       - AI updates plan
       - Return to 2.3
       If PASS:
       - AI creates construction_checkpoint.yaml
       - Proceed to Phase 3

outputs:
  - construction_checkpoint.yaml
  - construction_plan.md (for user reference)

---

# PHASE 3: SCRIPT GENERATION & EXECUTION
inputs:
  - construction_checkpoint.yaml (from Phase 2)
  - illustrator_document_state.json
  - script_generation_protocol

process:
  3.1) AI generates JSX script implementing operations
  3.2) [Optional] AI performs dry-run validation
  3.3) User executes script in Illustrator
  3.4) If ERRORS:
       - User reports error message
       - AI debugs and regenerates script
       - Return to 3.3
       If SUCCESS:
       - Proceed to verification
  
  3.5) User exports post-execution document state
  3.6) AI verifies: post_state matches checkpoint
  3.7) AI reports: success | discrepancies

outputs:
  - reconstruct_document.jsx (final script)
  - execution_report.yaml (verification results)

# Process complete ✓
