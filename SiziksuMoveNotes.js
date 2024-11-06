// SV.QUARTER
// Number of blicks in a quarter. The value is 705600000

var SCRIPT_TITLE = "Move Notes";
var SCRIPT_AUTHOR = "Esteban Latre";
var SCRIPT_CATEGORY = "Siziksu";
var SCRIPT_PARAMETERS = [
    "pitchDelta",
    "vibratoEnv",
    "loudness",
    "tension",
    "breathiness",
    "voicing",
    "gender",
    "toneShift"
];
var SCRIPT_VOCAL_MODE = "vocalMode_";

function getClientInfo() {
    return {
        "name": SCRIPT_TITLE,
        "category": SCRIPT_CATEGORY,
        "author": SCRIPT_AUTHOR,
        "versionNumber": 1.00,
        "minEditorVersion": 65540
    };
}

function main() {
    var result = SV.showCustomDialog(getForm());
    var threshold = 0;

    if (result.status == 1) {
        var answers = result.answers;

        threshold = parseFloat(answers.amount);
        if (isNaN(threshold) || threshold == 0) {
            // If there is no threshold or the value is not valid
            SV.finish();
            return;
        }

        var track = SV.getMainEditor().getCurrentTrack();
        var selection = SV.getMainEditor().getSelection();
        var notes = selection.getSelectedNotes();

        if (answers.parameters) {
            moveParameters(track, getSortedNotes(notes), answers.modes, threshold);
        }

        switch (true) {
            case notes.length > 0:
                var sorted = getSortedNotes(notes);
                moveNotes(sorted, threshold);
                break;
            default:
                var groups = track.getNumGroups();
                var visited = [];
                for (var i = 0; i < groups; i++) {
                    var group = track.getGroupReference(i).getTarget();
                    if (visited.indexOf(group.getUUID()) < 0) {
                        var sorted = getSortedGroupNotes(group);
                        moveNotes(sorted, threshold);
                        visited.push(group.getUUID());
                    }
                }
                break;
        }
    }

    SV.finish();
}

function moveNotes(notes, threshold) {
    var onset = 0;
    for (var i = 0; i < notes.length; i++) {
        onset = notes[i].getOnset() + SV.QUARTER * threshold;
        notes[i].setOnset(onset < 0 ? 0 : onset);
    }
}

function moveParameters(track, notes, answers, threshold) {
    var vocalModes = getVocalMode(answers.modes);
    if (vocalModes.length > 0) {
        for (var i = 0; i < vocalModes.length; i++) {
            SCRIPT_PARAMETERS.push(vocalModes[i]);
        }
    }

    var parameter;
    var points;
    var selection = notes.length > 0 ? true : false;
    for (var index = 0; index < SCRIPT_PARAMETERS.length; index++) {
        parameter = track.getGroupReference(0).getTarget().getParameter(SCRIPT_PARAMETERS[index]);

        switch (true) {
            case selection: // Just move the points in the selection
                points = parameter.getPoints(notes[0].getOnset(), notes[notes.length - 1].getEnd());
                break;
            default:
                points = parameter.getAllPoints();
                break;
        }

        if (points.length <= 0) {
            continue;
        }

        var shifted = [];
        for (var i = points.length - 1; i >= 0; i--) {
            var x = points[i][0] + SV.QUARTER * threshold;
            var y = points[i][1];
            if (x > 0) {
                shifted.push([x, y]);
                parameter.remove(points[i][0]);
            }
        }
        for (var i = 0; i < shifted.length; i++) {
            parameter.add(shifted[i][0], shifted[i][1]);
        }
    }
}

function getForm() {
    return {
        "title": SCRIPT_TITLE,
        "buttons": "OkCancel",
        "widgets": [
            {
                name: "amount",
                type: "TextBox",
                label: "Quarter multiplier (negative to move backwards)",
                default: "0"
            },
            {
                name: "parameters",
                type: "CheckBox",
                text: "Move also parameters",
                default: false
            },
            {
                name: 'modes',
                type: 'TextBox',
                label: "Vocal Modes (separated by commas)"
            }
        ]
    };
}

function getSortedGroupNotes(group) {
    var result = [];
    for (var i = 0; i < group.getNumNotes(); i++) {
        result.push(group.getNote(i));
    }
    return getSortedNotes(result);
}

function getSortedNotes(notes) {
    return notes.sort(function (a, b) {
        if (a.getOnset() < b.getOnset()) return -1;
        if (a.getOnset() > b.getOnset()) return 1;
        return 0;
    });
}

function getVocalMode(modes) {
    var parts = modes.replace(/\s/g, "").split(",");
    var list = [];
    for (var i = 0; i < parts.length; i++) {
        if (parts[i].length > 0) {
            list.push(SCRIPT_VOCAL_MODE + capitalizeVocalMode(parts[i]));
        }
    }
    return list;
}

function capitalizeVocalMode(vocalMode) {
    // Supports multi-word vocal modes (like Maki's "Power_Pop")
    var parts = vocalMode.split('_');
    for (var i = 0; i < parts.length; i++) {
        parts[i] = capitalize(parts[i]);
    }
    return parts.join('_');
}

function capitalize(string) {
    return string.charAt(0).toLocaleUpperCase() + string.slice(1).toLocaleLowerCase();
}
