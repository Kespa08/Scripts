#target illustrator

(function () {

  // =========================
  // Config
  // =========================
  var GRID = 3.25;
  var EPS  = 0.01;

  // Canonical semantic prefixes (GUIDE_ intentionally excluded from semantic export)
  var SEM_PREFIXES = ["ICON_", "COMP_", "LABEL_", "SHAPE_", "AREA_", "BOUND_"];
  var GUIDE_PREFIX = "GUIDE_";

  // =========================
  // Helpers
  // =========================
  function startsWithAny(name, prefixes) {
    for (var i = 0; i < prefixes.length; i++) {
      if (name.indexOf(prefixes[i]) === 0) return prefixes[i];
    }
    return null;
  }

  function safeName(it) {
    try { return it.name || ""; } catch (e) { return ""; }
  }

  function safeLayerName(it) {
    try { return (it.layer && it.layer.name) ? it.layer.name : "(unknown)"; }
    catch (e) { return "(unknown)"; }
  }

  function boundsObj(item) {
    var b = item.visibleBounds; // [L,T,R,B]
    return {
      left: b[0], top: b[1], right: b[2], bottom: b[3],
      width: (b[2] - b[0]),
      height: (b[1] - b[3])
    };
  }

  function isGuideItem(it) {
    // Illustrator "guide" paths usually have .guides === true
    // Fallback: anything on a layer literally named "Guides"
    try {
      if (it.typename === "PathItem" && it.guides === true) return true;
    } catch (e) {}
    var ln = safeLayerName(it);
    return (ln === "Guides");
  }

  function guideAxisFromName(nm) {
    // Expect GUIDE_xN / GUIDE_yN
    // Return "x", "y", or null
    if (!nm || nm.indexOf(GUIDE_PREFIX) !== 0) return null;
    if (nm.indexOf("GUIDE_x") === 0) return "x";
    if (nm.indexOf("GUIDE_y") === 0) return "y";
    return null;
  }

  function guideCoord(axis, b) {
    // vertical guide => x coord is left; horizontal guide => y coord is top
    return (axis === "x") ? b.left : b.top;
  }

// ---------- JSON polyfill (ExtendScript safe) ----------
if (typeof JSON === "undefined") {
  JSON = {};
}

if (typeof JSON.stringify !== "function") {
  JSON.stringify = function (obj, indent) {
    function esc(str) {
      return str.replace(/\\/g, "\\\\")
                .replace(/"/g, '\\"')
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r")
                .replace(/\t/g, "\\t");
    }

    function serialize(value, level) {
      var pad = indent ? new Array(level + 1).join(indent) : "";
      var padNext = indent ? pad + indent : "";

      if (value === null) return "null";
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      if (typeof value === "string") return '"' + esc(value) + '"';

      if (value instanceof Array) {
        var arr = [];
        for (var i = 0; i < value.length; i++) {
          arr.push(serialize(value[i], level + 1));
        }
        return "[" + (indent ? "\n" : "") +
          padNext + arr.join("," + (indent ? "\n" + padNext : "")) +
          (indent ? "\n" + pad : "") + "]";
      }

      if (typeof value === "object") {
        var props = [];
        for (var k in value) {
          if (value.hasOwnProperty(k)) {
            props.push(
              '"' + esc(k) + '": ' + serialize(value[k], level + 1)
            );
          }
        }
        return "{" + (indent ? "\n" : "") +
          padNext + props.join("," + (indent ? "\n" + padNext : "")) +
          (indent ? "\n" + pad : "") + "}";
      }

      return "null";
    }

    return serialize(obj, 0);
  };
}


  function jsonStringify(obj) {
    // ExtendScript doesn’t always have JSON; in modern Illustrator it does.
    // If JSON is unavailable in your build, tell me and I’ll add a polyfill.
    return JSON.stringify(obj, null, 2);
  }

  // =========================
  // Guard
  // =========================
  if (app.documents.length === 0) {
    alert("No document open.");
    return;
  }

  var doc = app.activeDocument;

  // =========================
  // Export skeleton
  // =========================
  var out = {
    meta: {
      name: doc.name,
      fullName: (doc.fullName ? String(doc.fullName) : ""),
      colorSpace: String(doc.documentColorSpace),
      rulerUnits: String(doc.rulerUnits),
      exportedAt: (new Date()).getFullYear() + "-" +
                  ("0" + ((new Date()).getMonth() + 1)).slice(-2) + "-" +
                  ("0" + (new Date()).getDate()).slice(-2) + " " +
                  ("0" + (new Date()).getHours()).slice(-2) + ":" +
                  ("0" + (new Date()).getMinutes()).slice(-2) + ":" +
                  ("0" + (new Date()).getSeconds()).slice(-2),
      grid: { unitPt: GRID, eps: EPS }
    },
    artboards: [],
    layers: [],
    guides: {
      counts: { x: 0, y: 0, unknown: 0 },
      items: []
    },
    semantic: {
      prefixes: SEM_PREFIXES.slice(0),
      countsByPrefix: { ICON_:0, COMP_:0, LABEL_:0, SHAPE_:0, AREA_:0, BOUND_:0, unknown:0 },
      items: []
    },
    signature: ""
  };

  // =========================
  // Artboards
  // =========================
  for (var a = 0; a < doc.artboards.length; a++) {
    var ab = doc.artboards[a];
    var r = ab.artboardRect; // [L,T,R,B]
    out.artboards.push({
      index: a,
      name: ab.name,
      rect: {
        left: r[0], top: r[1], right: r[2], bottom: r[3],
        width: (r[2] - r[0]),
        height: (r[1] - r[3])
      }
    });
  }

  // =========================
  // Layers
  // =========================
  for (var l = 0; l < doc.layers.length; l++) {
    var ly = doc.layers[l];
    out.layers.push({
      name: ly.name,
      visible: ly.visible,
      locked: ly.locked,
      printable: ly.printable
    });
  }

  // =========================
  // Pass 1: Collect guides ONLY
  // =========================
  for (var i = 0; i < doc.pageItems.length; i++) {
    var it = doc.pageItems[i];
    if (!isGuideItem(it)) continue;

    var nm = safeName(it);
    // Only export guides that are properly named GUIDE_*
    if (!nm || nm.indexOf(GUIDE_PREFIX) !== 0) continue;

    var axis = guideAxisFromName(nm);
    var b = boundsObj(it);

    if (axis === "x") out.guides.counts.x++;
    else if (axis === "y") out.guides.counts.y++;
    else out.guides.counts.unknown++;

    out.guides.items.push({
      name: nm,
      axis: axis,
      coord: (axis ? guideCoord(axis, b) : null),
      bounds: b,
      layer: safeLayerName(it)
    });
  }

  // =========================
  // Utility: mark composite children
  // =========================
  // We will build:
  // - compChildrenByName[childName] = true
  // - compChildrenById (safer): using object references is awkward in ExtendScript,
  //   so we use name-based exclusion and accept the constraint that children must be named.
  var compChildrenByName = {};

  function collectSemanticChildren(groupItem) {
    var kids = [];
    // groupItem.pageItems includes nested items
    for (var k = 0; k < groupItem.pageItems.length; k++) {
      var child = groupItem.pageItems[k];
      var cnm = safeName(child);
      if (!cnm) continue;

      // Never treat GUIDE_ as a semantic child (guides are structural only)
      if (cnm.indexOf(GUIDE_PREFIX) === 0) continue;

      var cpref = startsWithAny(cnm, SEM_PREFIXES);
      if (!cpref) continue;

      // Do not re-include nested COMP_ as "children" of a COMP_
      // (keep hierarchy clean; nested comps should be separate comps if needed)
      if (cpref === "COMP_") continue;

      compChildrenByName[cnm] = true;

      kids.push({
        name: cnm,
        prefix: cpref,
        typename: child.typename,
        layer: safeLayerName(child),
        bounds: boundsObj(child)
      });
    }
    return kids;
  }

  // =========================
  // Pass 2: Export semantic (GUIDE_ excluded; COMP_ includes children; children not duplicated)
  // =========================
  for (var j = 0; j < doc.pageItems.length; j++) {
    var p = doc.pageItems[j];
    var pnm = safeName(p);
    if (!pnm) continue;

    // Exclude guides from semantic entirely
    if (pnm.indexOf(GUIDE_PREFIX) === 0) continue;
    if (isGuideItem(p)) continue;

    var pref = startsWithAny(pnm, SEM_PREFIXES);
    if (!pref) continue;

    // If this is a COMP_, export it (atomic) with its children
    if (pref === "COMP_") {
      var compEntry = {
        name: pnm,
        prefix: pref,
        typename: p.typename,
        layer: safeLayerName(p),
        bounds: boundsObj(p),
        children: []
      };

      if (p.typename === "GroupItem") {
        compEntry.children = collectSemanticChildren(p);
      }

      out.semantic.items.push(compEntry);
      out.semantic.countsByPrefix[pref]++;

      continue;
    }

    // For non-COMP semantic items: if they are composite children, skip them in flat list
    if (compChildrenByName[pnm] === true) {
      continue;
    }

    out.semantic.items.push({
      name: pnm,
      prefix: pref,
      typename: p.typename,
      layer: safeLayerName(p),
      bounds: boundsObj(p)
    });
    out.semantic.countsByPrefix[pref]++;
  }

  // Unknown count (names that look semantic but aren’t) isn’t tracked here; add if you want.
  // out.semantic.countsByPrefix.unknown = ...

  // =========================
  // Signature
  // =========================
  var guideTotal = out.guides.items.length;
  var semTotal = out.semantic.items.length;

  out.signature =
    "doc=" + out.meta.name +
    "|artboards=" + out.artboards.length +
    "|guides=" + guideTotal +
    "|semantic=" + semTotal +
    "|ICON=" + out.semantic.countsByPrefix["ICON_"] +
    "|COMP=" + out.semantic.countsByPrefix["COMP_"] +
    "|AREA=" + out.semantic.countsByPrefix["AREA_"] +
    "|BOUND=" + out.semantic.countsByPrefix["BOUND_"] +
    "|LABEL=" + out.semantic.countsByPrefix["LABEL_"] +
    "|SHAPE=" + out.semantic.countsByPrefix["SHAPE_"];

  // =========================
  // Write file
  // =========================
  var outFile = new File("~/Desktop/doc_state_export_v2.json");
  outFile.encoding = "UTF-8";
  if (!outFile.open("w")) {
    alert("Could not write doc_state_export_v2.json to Desktop.");
    return;
  }

  outFile.write(jsonStringify(out));
  outFile.close();

  alert(
    "Document state exported.\n\n" +
    "File: doc_state_export_v2.json (Desktop)\n" +
    "Artboards: " + out.artboards.length + "\n" +
    "Guides: " + guideTotal + " (x=" + out.guides.counts.x + ", y=" + out.guides.counts.y + ")\n" +
    "Semantic items (flat): " + semTotal + "\n" +
    "  ICON: " + out.semantic.countsByPrefix["ICON_"] + "\n" +
    "  COMP: " + out.semantic.countsByPrefix["COMP_"] + "\n" +
    "  AREA: " + out.semantic.countsByPrefix["AREA_"] + "\n" +
    "  BOUND: " + out.semantic.countsByPrefix["BOUND_"] + "\n" +
    "  LABEL: " + out.semantic.countsByPrefix["LABEL_"]
  );

})();
