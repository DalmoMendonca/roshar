var characters = [];
var selectedIds = new Set();
var sortKey = null;
var sortDesc = true;

var ATTRIBUTE_FIELDS = [
    { key: 'strength', label: 'Strength' },
    { key: 'speed', label: 'Speed' },
    { key: 'intellect', label: 'Intellect' },
    { key: 'willpower', label: 'Willpower' },
    { key: 'awareness', label: 'Awareness' },
    { key: 'presence', label: 'Presence' }
];

var STAT_FIELDS = [
    { key: 'health', label: 'Health' },
    { key: 'focus', label: 'Focus' },
    { key: 'marks', label: 'Marks' }
];

var OTHER_STAT_FIELDS = [
    { key: 'liftingCapacity', label: 'Lifting Capacity' },
    { key: 'movement', label: 'Movement' },
    { key: 'recoveryDie', label: 'Recovery Die' },
    { key: 'sensesRange', label: 'Senses Range' }
];

var INFO_FIELDS = [
    { key: 'level', label: 'Level' },
    { key: 'ancestry', label: 'Ancestry' },
    { key: 'sex', label: 'Sex' },
    { key: 'alignment', label: 'Alignment' }
];

var GEAR_FIELDS = [
    { key: 'expertises', label: 'Expertises' },
    { key: 'talents', label: 'Talents' },
    { key: 'weapons', label: 'Weapons' },
    { key: 'armorEquipment', label: 'Armor & Equipment' },
    { key: 'connections', label: 'Connections' },
    { key: 'conditionsInjuries', label: 'Conditions & Injuries' }
];

var BIO_FIELDS = [
    { key: 'appearance', label: 'Appearance' },
    { key: 'background', label: 'Background' },
    { key: 'personality', label: 'Personality' },
    { key: 'catchphrase', label: 'Catchphrase' },
    { key: 'characterFlaws', label: 'Character Flaws' }
];

var toggleList = document.getElementById('toggleList');
var tableHead = document.getElementById('tableHead');
var tableBody = document.getElementById('tableBody');
var searchInput = document.getElementById('searchChars');
var selectAllBtn = document.getElementById('selectAll');
var selectNoneBtn = document.getElementById('selectNone');
var charCount = document.getElementById('charCount');
var emptyState = document.getElementById('emptyState');
var noSelection = document.getElementById('noSelection');
var tableWrapper = document.getElementById('tableWrapper');
var clearPartyBtn = document.getElementById('clearParty');

init();

function init() {
    characters = loadCharacters();

    if (!characters.length) {
        emptyState.style.display = '';
        tableWrapper.style.display = 'none';
        document.querySelector('.gm-controls').style.display = 'none';
        document.querySelector('.gm-footer').style.display = 'none';
        return;
    }

    characters.forEach(function (c) { selectedIds.add(c.id); });

    buildToggles();
    buildTable();

    selectAllBtn.addEventListener('click', function () {
        characters.forEach(function (c) { selectedIds.add(c.id); });
        syncToggles();
        buildTable();
    });

    selectNoneBtn.addEventListener('click', function () {
        selectedIds.clear();
        syncToggles();
        buildTable();
    });

    searchInput.addEventListener('input', filterToggles);

    clearPartyBtn.addEventListener('click', function () {
        if (confirm('Remove all ' + characters.length + ' characters from the party? This cannot be undone.')) {
            localStorage.removeItem('roshar-party-characters');
            location.reload();
        }
    });
}

function loadCharacters() {
    try {
        return JSON.parse(localStorage.getItem('roshar-party-characters') || '[]');
    } catch (e) {
        return [];
    }
}

function numVal(char, key) {
    var v = Number(char[key]);
    return isNaN(v) ? 0 : v;
}

function textVal(char, key) {
    return char[key] || '';
}

function formatAlignment(val) {
    if (!val) return '';
    return val.split('-').map(function (w) {
        return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c];
    });
}

function truncate(str, max) {
    if (!str || str.length <= max) return str || '';
    return str.substring(0, max) + '...';
}

// ── Toggles ──

function buildToggles() {
    toggleList.innerHTML = characters.map(function (c) {
        var cls = selectedIds.has(c.id) ? 'gm-chip is-active' : 'gm-chip';
        var name = c.characterName || 'Unnamed';
        return '<button class="' + cls + '" data-id="' + c.id + '">' + escapeHtml(name) + '</button>';
    }).join('');

    toggleList.addEventListener('click', function (e) {
        var btn = e.target.closest('.gm-chip');
        if (!btn) return;
        var id = btn.dataset.id;
        if (selectedIds.has(id)) {
            selectedIds.delete(id);
            btn.classList.remove('is-active');
        } else {
            selectedIds.add(id);
            btn.classList.add('is-active');
        }
        updateCount();
        buildTable();
    });

    updateCount();
}

function syncToggles() {
    toggleList.querySelectorAll('.gm-chip').forEach(function (btn) {
        btn.classList.toggle('is-active', selectedIds.has(btn.dataset.id));
    });
    updateCount();
}

function updateCount() {
    charCount.textContent = selectedIds.size + ' of ' + characters.length + ' shown';
}

function filterToggles() {
    var query = searchInput.value.toLowerCase().trim();
    toggleList.querySelectorAll('.gm-chip').forEach(function (btn) {
        var c = characters.find(function (ch) { return ch.id === btn.dataset.id; });
        var name = (c.characterName || '').toLowerCase();
        btn.style.display = !query || name.indexOf(query) !== -1 ? '' : 'none';
    });
}

// ── Table ──

function buildTable() {
    var visible = characters.filter(function (c) { return selectedIds.has(c.id); });

    if (!visible.length) {
        tableWrapper.style.display = 'none';
        noSelection.style.display = '';
        return;
    }
    tableWrapper.style.display = '';
    noSelection.style.display = 'none';

    var sorted = visible.slice();
    if (sortKey) {
        sorted.sort(function (a, b) {
            var va = numVal(a, sortKey);
            var vb = numVal(b, sortKey);
            return sortDesc ? vb - va : va - vb;
        });
    }

    // Compute winners for numeric fields
    var allNumeric = ATTRIBUTE_FIELDS.concat(STAT_FIELDS);
    var meta = {};
    var winCounts = {};

    allNumeric.forEach(function (field) {
        var values = sorted.map(function (c) { return numVal(c, field.key); });
        var min = Math.min.apply(null, values);
        var max = Math.max.apply(null, values);
        var range = max - min || 1;
        var allTied = min === max;
        var winnerIds = allTied ? [] : sorted
            .filter(function (c) { return numVal(c, field.key) === max; })
            .map(function (c) { return c.id; });

        var unique = values.slice().sort(function (a, b) { return b - a; });
        unique = unique.filter(function (v, i, arr) { return arr.indexOf(v) === i; });
        var rankMap = {};
        unique.forEach(function (v, i) { rankMap[v] = i + 1; });

        meta[field.key] = { min: min, max: max, range: range, winnerIds: winnerIds, rankMap: rankMap };

        if (!allTied) {
            winnerIds.forEach(function (id) {
                winCounts[id] = (winCounts[id] || 0) + 1;
            });
        }
    });

    var maxWins = Math.max.apply(null, Object.values(winCounts).concat([0]));
    var championIds = [];
    if (maxWins > 0) {
        Object.keys(winCounts).forEach(function (id) {
            if (winCounts[id] === maxWins) championIds.push(id);
        });
    }

    // Build header
    var headHtml = '<tr><th class="gm-sticky-col"></th>';
    sorted.forEach(function (c) {
        var wins = winCounts[c.id] || 0;
        var isChamp = championIds.indexOf(c.id) !== -1;
        var name = c.characterName || 'Unnamed';
        var player = c.playerName ? 'Player: ' + escapeHtml(c.playerName) : '';
        headHtml += '<th class="gm-char-header' + (isChamp ? ' is-champion' : '') + '">';
        headHtml += '<span class="gm-char-name">' + escapeHtml(name) + '</span>';
        headHtml += '<span class="gm-char-meta">';
        if (player) headHtml += player;
        if (wins > 0) headHtml += (player ? ' &middot; ' : '') + '<span class="gm-char-wins">' + wins + ' win' + (wins !== 1 ? 's' : '') + '</span>';
        headHtml += '</span></th>';
    });
    headHtml += '</tr>';
    tableHead.innerHTML = headHtml;

    // Build body
    var bodyHtml = '';

    // Section: Attributes
    bodyHtml += sectionHeader('Attributes', sorted.length);
    ATTRIBUTE_FIELDS.forEach(function (field) {
        bodyHtml += numericRow(field, sorted, meta);
    });

    // Section: Stats
    bodyHtml += sectionHeader('Stats', sorted.length);
    STAT_FIELDS.forEach(function (field) {
        bodyHtml += numericRow(field, sorted, meta);
    });

    // Section: Other Stats
    bodyHtml += sectionHeader('Other Stats', sorted.length);
    OTHER_STAT_FIELDS.forEach(function (field) {
        bodyHtml += textRow(field, sorted);
    });

    // Section: Identity
    bodyHtml += sectionHeader('Identity', sorted.length);
    INFO_FIELDS.forEach(function (field) {
        bodyHtml += textRow(field, sorted, field.key === 'alignment' ? formatAlignment : null);
    });

    // Section: Skills & Gear
    bodyHtml += sectionHeader('Skills & Gear', sorted.length);
    GEAR_FIELDS.forEach(function (field) {
        bodyHtml += textRow(field, sorted);
    });

    // Section: Bio Highlights
    bodyHtml += sectionHeader('Bio Highlights', sorted.length);
    BIO_FIELDS.forEach(function (field) {
        bodyHtml += textRow(field, sorted, function (v) { return truncate(v, 60); });
    });

    tableBody.innerHTML = bodyHtml;

    // Sort click handlers
    tableBody.querySelectorAll('[data-sort]').forEach(function (cell) {
        cell.addEventListener('click', function () {
            var key = cell.dataset.sort;
            if (sortKey === key) {
                if (sortDesc) { sortDesc = false; }
                else { sortKey = null; sortDesc = true; }
            } else {
                sortKey = key;
                sortDesc = true;
            }
            buildTable();
        });
    });
}

function sectionHeader(title, colCount) {
    return '<tr class="gm-section-row"><td class="gm-sticky-col" colspan="1">' + title + '</td>' +
        '<td colspan="' + colCount + '"></td></tr>';
}

function numericRow(field, sorted, meta) {
    var m = meta[field.key];
    var isSorted = sortKey === field.key;

    var html = '<tr class="gm-stat-row" data-stat="' + field.key + '">';
    html += '<td class="gm-label-cell gm-sticky-col" data-sort="' + field.key + '" title="Click to sort">';
    html += '<div class="gm-label-inner"><span>' + field.label + '</span>';
    if (isSorted) html += '<span class="gm-sort-arrow">' + (sortDesc ? '\u2193' : '\u2191') + '</span>';
    html += '</div></td>';

    sorted.forEach(function (c) {
        var value = numVal(c, field.key);
        var isWinner = m.winnerIds.indexOf(c.id) !== -1;
        var rank = m.rankMap[value] || 0;
        var isTop3 = rank >= 1 && rank <= 3;
        var pct = ((value - m.min) / m.range) * 100;

        var cls = 'gm-cell';
        if (isWinner) cls += ' is-winner';
        if (isTop3) cls += ' is-top3';

        html += '<td class="' + cls + '" data-rank="' + rank + '">';
        html += '<span class="gm-bar" style="width:' + pct.toFixed(1) + '%"></span>';
        html += '<span class="gm-value">' + (value || '\u2014') + '</span>';
        if (isWinner) html += '<span class="gm-crown">\u2605</span>';
        html += '</td>';
    });

    html += '</tr>';
    return html;
}

function textRow(field, sorted, formatter) {
    var html = '<tr class="gm-stat-row">';
    html += '<td class="gm-label-cell gm-sticky-col"><div class="gm-label-inner"><span>' + field.label + '</span></div></td>';

    sorted.forEach(function (c) {
        var raw = textVal(c, field.key);
        var display = formatter ? formatter(raw) : raw;
        html += '<td class="gm-cell gm-text-cell"><span class="gm-value">' + escapeHtml(display || '\u2014') + '</span></td>';
    });

    html += '</tr>';
    return html;
}
