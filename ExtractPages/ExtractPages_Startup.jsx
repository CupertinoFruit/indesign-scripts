#targetengine "ExtractPagesMenu"
/**********************************************************************************************
 * Extract Pages - Startup Menu Installer
 * ---------------------------------------------------------------------------------------------
 * Install location:   .../Adobe InDesign 2026/Scripts/startup scripts/
 * On launch this adds an "Extract Pages..." command to InDesign's File menu (just above
 * "Package..."). Choosing it runs ExtractInDesignPages.jsx, located anywhere under the
 * "Scripts" folder (it is searched for recursively, so subfolders are fine).
 *
 * The persistent #targetengine (first line) keeps the menu handler alive for the whole session.
 * 
 * Script creator: Ravi Kiran
 * Copyright (c) 2026 Ravi Kiran. All rights reserved.
 *********************************************************************************************/

(function () {
    var MENU_LABEL    = "Extract Pages\u2026";
    var TARGET_FILES  = ["ExtractInDesignPages.jsxbin", "ExtractInDesignPages.jsx"];   // prefer binary

    // ---- Remember where this startup script lives (used to locate the main script later) ----
    var startupFolder = null, scriptsRoot = null;
    try {
        var here = File($.fileName);
        startupFolder = here.parent;          // .../Scripts/startup scripts
        scriptsRoot   = here.parent.parent;   // .../Scripts
    } catch (eLoc) { }

    // ---- Recursive search for any of the candidate file names (depth-limited) ----
    function findFileByName(folder, names, maxDepth) {
        if (!folder || maxDepth < 0) { return null; }
        var items;
        try { items = folder.getFiles(); } catch (e) { return null; }
        var i, j;
        for (i = 0; i < items.length; i++) {                       // files at this level first
            if (items[i] instanceof File) {
                for (j = 0; j < names.length; j++) { if (items[i].name === names[j]) { return items[i]; } }
            }
        }
        for (i = 0; i < items.length; i++) {                       // then descend into subfolders
            if (items[i] instanceof Folder) {
                var found = findFileByName(items[i], names, maxDepth - 1);
                if (found !== null) { return found; }
            }
        }
        return null;
    }

    // ---- Locate the main script (cached; re-searches only if the cached file is gone) ----
    var cachedScript = null;
    function locateMainScript() {
        if (cachedScript !== null && cachedScript.exists) { return cachedScript; }
        cachedScript = null;
        if (scriptsRoot !== null) {
            var panel = Folder(scriptsRoot.fsName + "/Scripts Panel");   // most likely place
            if (panel.exists) { cachedScript = findFileByName(panel, TARGET_FILES, 8); }
            if (cachedScript === null) { cachedScript = findFileByName(scriptsRoot, TARGET_FILES, 8); }
        }
        if (cachedScript === null && startupFolder !== null) {           // last resort: beside this file
            cachedScript = findFileByName(startupFolder, TARGET_FILES, 2);
        }
        return cachedScript;
    }

    // ---- Create (or refresh) the menu action ----
    try {
        var old = app.scriptMenuActions.itemByName(MENU_LABEL);
        if (old.isValid) { old.remove(); }                               // avoid duplicates if re-run
    } catch (eOld) { }

    // A script run from inside a menu handler is still "inside the menu event": InDesign defers
    // every doc.close() until the handler returns, so documents the script closes keep holding
    // their file paths ("Cannot save ... because it is already open"). On the Mac, hand the run
    // back to InDesign through a detached osascript; it then starts after this handler returns,
    // exactly like a run from the Scripts panel.
    function launchOutsideEvent(ms) {
        if (File.fs !== "Macintosh") { return false; }
        function sq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }      // shell quote
        function aq(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; } // AppleScript string
        var tell = "tell application " + aq(File(app.fullName).fsName) +
                   " to do script (POSIX file " + aq(ms.fsName) + ") language javascript";
        var cmd = "/usr/bin/osascript -e " + sq("with timeout of 86400 seconds") + " -e " + sq(tell) +
                  " -e " + sq("end timeout") + " > /dev/null 2>&1 &";
        app.doScript("do shell script " + aq(cmd), ScriptLanguage.APPLESCRIPT_LANGUAGE);
        return true;
    }

    var action = app.scriptMenuActions.add(MENU_LABEL);
    action.enabled = (app.documents.length > 0);   // greyed out in the No Document state
    action.eventListeners.add("onInvoke", function () {
        try {
            var ms = locateMainScript();
            if (ms && ms.exists) {
                var launched = false;
                try { launched = launchOutsideEvent(ms); } catch (eAsync) { launched = false; }
                if (!launched) { app.doScript(ms, ScriptLanguage.JAVASCRIPT); }
            } else {
                alert("Extract Pages: could not find \u201CExtractInDesignPages.jsxbin\u201D (or .jsx) anywhere under the \u201CScripts\u201D folder.");
            }
        } catch (eRun) {
            alert("Extract Pages failed to launch:\n" + eRun);
        }
    });

    // ---- Insert into the File menu (near Package; fall back to the end) ----
    try {
        var fileMenu = app.menus.item("$ID/Main").submenus.item("$ID/&File");

        for (var m = fileMenu.menuItems.length - 1; m >= 0; m--) {       // clear any leftover copy
            try { if (String(fileMenu.menuItems.item(m).name) === MENU_LABEL) { fileMenu.menuItems.item(m).remove(); } } catch (eRm) { }
        }

        var refNames = ["$ID/Package for Print...", "$ID/Package...", "$ID/Export..."];
        var ref = null;
        for (var i = 0; i < refNames.length; i++) {
            try { var cand = fileMenu.menuItems.item(refNames[i]); if (cand.isValid) { ref = cand; break; } } catch (eRef) { }
        }

        if (ref !== null) { fileMenu.menuItems.add(action, LocationOptions.BEFORE, ref); }
        else { fileMenu.menuItems.add(action, LocationOptions.AT_END); }

        // Enable only when a document is open; re-checked every time the File menu is opened.
        fileMenu.eventListeners.add("beforeDisplay", function () {
            try { action.enabled = (app.documents.length > 0); } catch (eEn) { }
        });
    } catch (eMenu) { }
})();
