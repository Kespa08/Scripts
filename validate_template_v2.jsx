#target illustrator

(function () {

  var GRID = 3.25;
  var EPS = 0.01; // tolerance for floating point drift

  function isOnGrid(value, unit) {
    var r = value % unit;
    if (r < 0) r += unit; // handle negative coords too
    return (r <= EPS) || (Math.abs(r - unit) <= EPS);
  }

  function startsWithAny(name, prefixes) {
    for (var i = 0; i < prefixes.length; i++) {
      if (name.indexOf(prefixes[i]) === 0) return prefixes[i];
    }
    return null;
  }

  function boundsObj(item) {
    var b = item.visibleBounds; // [L,T,R,B]
    return { left: b[0], top: b[1], right: b[2], bottom: b[3] };
  }

  // Returns true if this item is inside any ancestor named COMP_*
  function isDescendantOfComposite(it) {
    var p = it.parent;
    while (p) {
      // parent can be Document, Layer, GroupItem, etc.
      if (p.typename === "GroupItem" && p.name && p.name.indexOf("COMP_") === 0) return true;
      if (p.typename === "Document") break;
      p = p.parent;
    }
    return false;
  }

  // Determine guide type:
  // Prefer naming convention GUIDE_xN / GUIDE_yN. Fallback to geometric orientation.
  function guideAxis(itemName, b) {
    if (itemName && itemName.indexOf("GUIDE_x") === 0) return "x";
    if (itemName && itemName.indexOf("GUIDE_y") === 0) return "y";

    // fallback: orientation by bounds
    var w = Math.abs(b.right - b.left);
    var h = Math.abs(b.top - b.bottom);
    return (w < h) ? "x" : "y"; // vertical line -> x axis fixed; horizontal line -> y axis fixed
  }

  var docOpen = (app.documents.length > 0);
  if (!docOpen) {
    alert("No document open.");
    return;
  }

  var doc = app.activeDocument;

  var PREFIXES = ["ICON_", "COMP_", "LABEL_", "SHAPE_", "GUIDE_", "AREA_", "BOUND_"];

  var report = [];
  report.push("Validation Report v2");
  report.push("Document: " + doc.name);
  report.push("Grid: " + GRID + " pt");
  report.push("Tolerance EPS: " + EPS);
  report.push("Generated: " + (new Date()).toString());
  report.push("");

  var counts = {
    semanticNamed: 0,
    byPrefix: { ICON_: 0, COMP_: 0, AREA_: 0, BOUND_: 0, LABEL_: 0, SHAPE_: 0, GUIDE_: 0 },
    unknownPrefixNamed: 0,
    duplicateNames: 0,
    unnamedPlacedItems: 0,
    offGridSemantic: 0,
    compositeChildrenSkipped: 0,
    guideAxisChecks: 0
  };

  var seenNames = {};
  var unknownPrefixItems = [];
  var duplicateNameList = [];
  var unnamedPlaced = [];
  var offGrid = [];

  // --- Pass 1: scan all pageItems ---
  for (var i = 0; i < doc.pageItems.length; i++) {
    var it = doc.pageItems[i];
    var nm = it.name;

    // Track unnamed PlacedItems as common “semantic loss” risk
    if (it.typename === "PlacedItem" && (!nm || nm === "")) {
      counts.unnamedPlacedItems++;
      var pb = boundsObj(it);
      unnamedPlaced.push({
        typename: it.typename,
        layer: (it.layer && it.layer.name) ? it.layer.name : "(unknown)",
        left: pb.left,
        top: pb.top
      });
      continue;
    }

    if (!nm || nm === "") continue;

    var pref = startsWithAny(nm, PREFIXES);

    if (pref) {
      counts.semanticNamed++;
      counts.byPrefix[pref]++;

      // Duplicate semantic IDs check
      if (seenNames[nm]) {
        counts.duplicateNames++;
        duplicateNameList.push(nm);
      } else {
        seenNames[nm] = true;
      }

      // --- GRID VALIDATION LOGIC ---

      // (A) Skip grid-check for non-COMP semantic items that are children of a COMP_ group
      //     This prevents flagging/snapping atomic icons that constitute a composite.
      if (pref !== "COMP_" && isDescendantOfComposite(it)) {
        counts.compositeChildrenSkipped++;
        continue;
      }

      var b = boundsObj(it);

      var leftOK = true;
      var topOK = true;

      // (B) Guides: validate only the relevant axis
      if (pref === "GUIDE_") {
        var axis = guideAxis(nm, b); // "x" or "y"
        counts.guideAxisChecks++;

        if (axis === "x") {
          // vertical guide: x position must align, y can be anything
          leftOK = isOnGrid(b.left, GRID);
          topOK = true;
        } else {
          // horizontal guide: y position must align, x can be anything
          leftOK = true;
          topOK = isOnGrid(b.top, GRID);
        }
      } else {
        // (C) Normal semantic items: check both left and top
        leftOK = isOnGrid(b.left, GRID);
        topOK = isOnGrid(b.top, GRID);
      }

      if (!leftOK || !topOK) {
        counts.offGridSemantic++;
        offGrid.push({
          id: nm,
          prefix: pref,
          typename: it.typename,
          layer: (it.layer && it.layer.name) ? it.layer.name : "(unknown)",
          left: b.left,
          top: b.top,
          leftOK: leftOK,
          topOK: topOK
        });
      }

    } else {
      // Named but not in known semantic prefixes
      counts.unknownPrefixNamed++;
      unknownPrefixItems.push({
        name: nm,
        typename: it.typename,
        layer: (it.layer && it.layer.name) ? it.layer.name : "(unknown)"
      });
    }
  }

  // --- Report: Summary ---
  report.push("SUMMARY");
  report.push("  Named semantic items: " + counts.semanticNamed);
  report.push("    ICON_:  " + counts.byPrefix["ICON_"]);
  report.push("    COMP_:  " + counts.byPrefix["COMP_"]);
  report.push("    AREA_:  " + counts.byPrefix["AREA_"]);
  report.push("    BOUND_: " + counts.byPrefix["BOUND_"]);
  report.push("    LABEL_: " + counts.byPrefix["LABEL_"]);
  report.push("    SHAPE_: " + counts.byPrefix["SHAPE_"]);
  report.push("    GUIDE_: " + counts.byPrefix["GUIDE_"]);
  report.push("");
  report.push("  Named items w/ unknown prefix: " + counts.unknownPrefixNamed);
  report.push("  Duplicate semantic names: " + counts.duplicateNames);
  report.push("  Unnamed PlacedItems: " + counts.unnamedPlacedItems);
  report.push("  Off-grid semantic items: " + counts.offGridSemantic);
  report.push("  Composite child items skipped (no grid check): " + counts.compositeChildrenSkipped);
  report.push("  Guide axis-only checks performed: " + counts.guideAxisChecks);
  report.push("");

  // --- Report: Details ---
  if (counts.unknownPrefixNamed > 0) {
    report.push("DETAIL: Named items with UNKNOWN prefix");
    for (var u = 0; u < unknownPrefixItems.length; u++) {
      var ui = unknownPrefixItems[u];
      report.push("  - " + ui.name + " | " + ui.typename + " | layer: " + ui.layer);
    }
    report.push("");
  }

  if (counts.duplicateNames > 0) {
    report.push("DETAIL: Duplicate semantic names");
    for (var d = 0; d < duplicateNameList.length; d++) {
      report.push("  - " + duplicateNameList[d]);
    }
    report.push("");
  }

  if (counts.unnamedPlacedItems > 0) {
    report.push("DETAIL: Unnamed PlacedItems (common risk)");
    for (var p = 0; p < unnamedPlaced.length; p++) {
      var up = unnamedPlaced[p];
      report.push("  - PlacedItem | layer: " + up.layer + " | left: " + up.left + " | top: " + up.top);
    }
    report.push("");
  }

  if (counts.offGridSemantic > 0) {
    report.push("DETAIL: Off-grid semantic items");
    report.push("  NOTE: GUIDE_y* validates TOP only; GUIDE_x* validates LEFT only.");
    report.push("  NOTE: Items inside COMP_* groups are skipped (children not checked).");
    for (var g = 0; g < offGrid.length; g++) {
      var og = offGrid[g];
      report.push(
        "  - " + og.id +
        " | " + og.typename +
        " | layer: " + og.layer +
        " | left: " + og.left + (og.leftOK ? " (OK)" : " (OFF)") +
        " | top: " + og.top + (og.topOK ? " (OK)" : " (OFF)")
      );
    }
    report.push("");
  }

  // Write report
  var outFile = new File("~/Desktop/validation_report.txt");
  outFile.encoding = "UTF-8";
  if (!outFile.open("w")) {
    alert("Could not write validation_report.txt to Desktop.");
    return;
  }
  outFile.write(report.join("\n"));
  outFile.close();

  // Popup summary
  alert(
    "Validation v2 complete.\n\n" +
    "Semantic named: " + counts.semanticNamed +
    " (ICON " + counts.byPrefix["ICON_"] +
    ", COMP " + counts.byPrefix["COMP_"] +
    ", AREA " + counts.byPrefix["AREA_"] +
    ", BOUND " + counts.byPrefix["BOUND_"] +
    ", LABEL " + counts.byPrefix["LABEL_"] +
    ", GUIDE " + counts.byPrefix["GUIDE_"] + ")\n\n" +
    "Off-grid semantic items: " + counts.offGridSemantic + "\n" +
    "Composite children skipped: " + counts.compositeChildrenSkipped + "\n" +
    "Unknown-prefix named items: " + counts.unknownPrefixNamed + "\n" +
    "Unnamed PlacedItems: " + counts.unnamedPlacedItems + "\n\n" +
    "Report written: validation_report.txt (Desktop)"
  );

})();
