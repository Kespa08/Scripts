#target illustrator

(function () {

  var GRID = 3.25;
  var EPS = 0.01;

  // Updated semantic prefixes
  var PREFIXES = ["ICON_", "COMP_", "LABEL_", "SHAPE_", "GUIDE_", "AREA_", "BOUND_"];

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

  function isOnGrid(value, unit) {
    var r = value % unit;
    if (r < 0) r += unit;
    return (r <= EPS) || (Math.abs(r - unit) <= EPS);
  }

  function snap(value, unit) {
    return Math.round(value / unit) * unit;
  }

  // Returns true if this item is inside any ancestor named COMP_*
  function isDescendantOfComposite(it) {
    var p = it.parent;
    while (p) {
      if (p.typename === "GroupItem" && p.name && p.name.indexOf("COMP_") === 0) return true;
      if (p.typename === "Document") break;
      p = p.parent;
    }
    return false;
  }

  // Determine guide axis: prefer GUIDE_xN / GUIDE_yN; fallback to orientation.
  function guideAxis(itemName, b) {
    if (itemName && itemName.indexOf("GUIDE_x") === 0) return "x";
    if (itemName && itemName.indexOf("GUIDE_y") === 0) return "y";

    var w = Math.abs(b.right - b.left);
    var h = Math.abs(b.top - b.bottom);
    return (w < h) ? "x" : "y";
  }

  if (app.documents.length === 0) {
    alert("No document open.");
    return;
  }

  var doc = app.activeDocument;

  var moved = 0;
  var skipped = 0;
  var compositeChildrenSkipped = 0;
  var guideAxisOnly = 0;

  var report = [];

  report.push("Grid Snap Report v4 (delta translate)");
  report.push("Document: " + doc.name);
  report.push("Grid: " + GRID + " pt");
  report.push("Tolerance EPS: " + EPS);
  report.push("Generated: " + (new Date()).toString());
  report.push("");
  report.push("NOTES:");
  report.push("  - Items inside COMP_* groups are NOT moved (composite constituents).");
  report.push("  - GUIDE_y* snaps TOP only; GUIDE_x* snaps LEFT only.");
  report.push("");

  for (var i = 0; i < doc.pageItems.length; i++) {
    var it = doc.pageItems[i];
    var nm = it.name;
    if (!nm || nm === "") continue;

    var pref = startsWithAny(nm, PREFIXES);
    if (!pref) continue;

    // Skip composite constituents (anything inside COMP_*), except the COMP_* itself.
    if (pref !== "COMP_" && isDescendantOfComposite(it)) {
      compositeChildrenSkipped++;
      continue;
    }

    var b = boundsObj(it);

    var leftOK = true;
    var topOK = true;

    // Guides are axis-specific
    if (pref === "GUIDE_") {
      var axis = guideAxis(nm, b);
      guideAxisOnly++;

      if (axis === "x") {
        leftOK = isOnGrid(b.left, GRID);
        topOK = true; // don't care
      } else {
        leftOK = true; // don't care
        topOK = isOnGrid(b.top, GRID);
      }
    } else {
      // Normal semantic items: both left and top must be on grid
      leftOK = isOnGrid(b.left, GRID);
      topOK  = isOnGrid(b.top, GRID);
    }

    if (leftOK && topOK) continue;

    var targetLeft = b.left;
    var targetTop  = b.top;

    if (pref === "GUIDE_") {
      // Axis-specific snapping
      var axis2 = guideAxis(nm, b);
      if (axis2 === "x") {
        if (!leftOK) targetLeft = snap(b.left, GRID);
      } else {
        if (!topOK) targetTop = snap(b.top, GRID);
      }
    } else {
      // Normal items snap both
      if (!leftOK) targetLeft = snap(b.left, GRID);
      if (!topOK)  targetTop  = snap(b.top, GRID);
    }

    var dx = targetLeft - b.left;
    var dy = targetTop - b.top;

    // Safety: if nothing changes, don't translate
    if (Math.abs(dx) <= EPS && Math.abs(dy) <= EPS) continue;

    try {
      it.translate(dx, dy);
      moved++;

      report.push(
        nm + " | " + it.typename +
        " | dx: " + dx + " | dy: " + dy +
        " | left: " + b.left + " -> " + targetLeft +
        " | top: " + b.top + " -> " + targetTop +
        (pref === "GUIDE_" ? " | guide-axis: " + guideAxis(nm, b) : "")
      );
    } catch (e) {
      skipped++;
      report.push("SKIP: " + nm + " | " + it.typename + " | reason: " + e);
    }
  }

  var outFile = new File("~/Desktop/grid_snap_report_v4.txt");
  outFile.encoding = "UTF-8";
  if (!outFile.open("w")) {
    alert("Could not write grid_snap_report_v4.txt to Desktop.");
    return;
  }
  outFile.write(report.join("\n"));
  outFile.close();

  alert(
    "Grid Snap v4 complete.\n\n" +
    "Moved items: " + moved + "\n" +
    "Skipped (errors): " + skipped + "\n" +
    "Composite children skipped: " + compositeChildrenSkipped + "\n" +
    "Guide axis-only items processed: " + guideAxisOnly + "\n\n" +
    "Report written: grid_snap_report_v4.txt (Desktop)"
  );

})();
