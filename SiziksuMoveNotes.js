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
        "versionNumber": 1.01,
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
        var selection = answers.before || answers.after ? {} : SV.getMainEditor().getSelection();
        var notes = answers.before || answers.after ? [] : selection.getSelectedNotes();

        if (answers.parameters) {
            moveParameters(track, getSortedNotes(notes), answers, threshold);
        }

        switch (true) {
            case notes.length > 0:
                var sorted = getSortedNotes(notes);
                moveNotes(sorted, answers, threshold);
                break;
            default:
                var groups = track.getNumGroups();
                var visited = [];
                for (var i = 0; i < groups; i++) {
                    var group = track.getGroupReference(i).getTarget();
                    if (visited.indexOf(group.getUUID()) < 0) {
                        var sorted = getSortedGroupNotes(group);
                        moveNotes(sorted, answers, threshold);
                        visited.push(group.getUUID());
                    }
                }
                break;
        }
    }

    SV.finish();
}

function moveNotes(notes, answers, threshold) {
    var affected = [];
    switch (true) {
        case answers.slider == -1: // Just get the notes before playhead
            var playhead = getPlayheadPosition();
            for (var i = 0; i < notes.length; i++) {
                if (notes[i].getOnset() < playhead) {
                    affected.push(notes[i]);
                } else {
                    break;
                }
            }
            break;
        case answers.slider == 1: // Just get the notes after playhead
            var playhead = getPlayheadPosition();
            for (var i = 0; i < notes.length; i++) {
                if (notes[i].getOnset() >= playhead) {
                    affected.push(notes[i]);
                }
            }
            break;
        default:
            affected = notes;
            break;
    }
    var onset = 0;
    for (var i = 0; i < affected.length; i++) {
        onset = affected[i].getOnset() + SV.QUARTER * threshold;
        affected[i].setOnset(onset < 0 ? 0 : onset);
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
            case answers.slider == -1: // Just move the points before playhead
                var playhead = getPlayheadPosition();
                points = parameter.getPoints(0, playhead);
                break;
            case answers.slider == 1: // Just move the points after playhead
                var playhead = getPlayheadPosition();
                points = parameter.getPoints(playhead, track.getDuration());
                break;
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
        title: SCRIPT_TITLE,
        buttons: "OkCancel",
        message: "Moving notes relative to the playhead, ignores the selection if present.\n\nThe slider to the left means Before and to the right means After.",
        widgets: [
            {
                name: "amount",
                type: "TextBox",
                label: "Quarter multiplier (negative to move backwards)",
                default: "0"
            },
            {
                name: "slider",
                type: "Slider",
                label: "Relative to the playhead",
                format: "%1.0f",
                minValue: -1,
                maxValue: 1,
                interval: 1,
                default: 0
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

function getPlayheadPosition() {
    var timeAxis = SV.getProject().getTimeAxis();
    var playback = SV.getPlayback();
    var currentPos = playback.getPlayhead(); // Gets the current playhead position in seconds
    return timeAxis.getBlickFromSeconds(currentPos); // Converts physical time in seconds to musical time in blicks
}
