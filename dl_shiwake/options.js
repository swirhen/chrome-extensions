// UI Elements - Domain
const domainList = document.getElementById('domain-list').querySelector('tbody');
const newDomainInput = document.getElementById('new-domain');
const newFolderInput = document.getElementById('new-folder');
const addDomainBtn = document.getElementById('add-domain-rule');
const editDomainIndexInput = document.getElementById('edit-domain-index');

// UI Elements - Extension
const extensionList = document.getElementById('extension-list').querySelector('tbody');
const newExtensionInput = document.getElementById('new-extension');
const newExtFolderInput = document.getElementById('new-ext-folder');
const addExtensionBtn = document.getElementById('add-extension-rule');
const editExtIndexInput = document.getElementById('edit-ext-index');

// UI Elements - Settings Backup
const exportSettingsBtn = document.getElementById('export-settings');
const importSettingsBtn = document.getElementById('import-settings');
const importSettingsFileInput = document.getElementById('import-settings-file');

// UI Elements - Notification
const statusGeneralDiv = document.getElementById('status-general');

// State (ルールのみ保持)
let currentSettings = {
    domainRules: [],
    extensionRules: []
};

// 初期化
function init() {
    restoreOptions();
    addDomainBtn.addEventListener('click', addOrUpdateDomainRule);
    addExtensionBtn.addEventListener('click', addOrUpdateExtensionRule);
    exportSettingsBtn.addEventListener('click', exportSettings);
    importSettingsBtn.addEventListener('click', () => importSettingsFileInput.click());
    importSettingsFileInput.addEventListener('change', importSettings);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function restoreOptions() {
    chrome.storage.local.get(['domainRules', 'extensionRules'], (items) => {
        currentSettings.domainRules = Array.isArray(items.domainRules) ? items.domainRules : [];
        currentSettings.extensionRules = Array.isArray(items.extensionRules) ? items.extensionRules : [];
        renderDomainRules();
        renderExtensionRules();
    });
}

// --- Domain Rules ---

function renderDomainRules() {
    domainList.innerHTML = '';
    const total = currentSettings.domainRules.length;
    currentSettings.domainRules.forEach((rule, index) => {
        const tr = document.createElement('tr');

        const tdDomain = document.createElement('td');
        tdDomain.textContent = rule.domain;

        const tdFolder = document.createElement('td');
        tdFolder.textContent = rule.folder;

        const tdAction = document.createElement('td');
        tdAction.className = 'action-cell';

        const upBtn = document.createElement('button');
        upBtn.textContent = '↑';
        upBtn.title = '上へ移動';
        upBtn.className = 'move-btn';
        upBtn.disabled = index === 0;
        upBtn.style.marginRight = '3px';
        upBtn.onclick = () => moveDomainRule(index, -1);

        const downBtn = document.createElement('button');
        downBtn.textContent = '↓';
        downBtn.title = '下へ移動';
        downBtn.className = 'move-btn';
        downBtn.disabled = index === total - 1;
        downBtn.style.marginRight = '8px';
        downBtn.onclick = () => moveDomainRule(index, 1);

        const editBtn = document.createElement('button');
        editBtn.textContent = '編集';
        editBtn.style.marginRight = '5px';
        editBtn.onclick = () => startEditDomainRule(index);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '削除';
        deleteBtn.className = 'delete';
        deleteBtn.onclick = () => removeDomainRule(index);

        tdAction.appendChild(upBtn);
        tdAction.appendChild(downBtn);
        tdAction.appendChild(editBtn);
        tdAction.appendChild(deleteBtn);

        tr.appendChild(tdDomain);
        tr.appendChild(tdFolder);
        tr.appendChild(tdAction);

        domainList.appendChild(tr);
    });
}

function moveDomainRule(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentSettings.domainRules.length) return;

    const [item] = currentSettings.domainRules.splice(index, 1);
    currentSettings.domainRules.splice(targetIndex, 0, item);

    const currentEditIndex = parseInt(editDomainIndexInput.value, 10);
    if (currentEditIndex === index) {
        editDomainIndexInput.value = targetIndex;
    } else if (currentEditIndex === targetIndex) {
        editDomainIndexInput.value = index;
    }

    saveAllSettings(() => {
        renderDomainRules();
    });
}

function startEditDomainRule(index) {
    const rule = currentSettings.domainRules[index];
    newDomainInput.value = rule.domain;
    newFolderInput.value = rule.folder;
    editDomainIndexInput.value = index;
    addDomainBtn.textContent = '更新';
    newDomainInput.focus();
}

function addOrUpdateDomainRule() {
    const domain = newDomainInput.value.trim();
    const folder = newFolderInput.value.trim();
    const editIndex = parseInt(editDomainIndexInput.value, 10);

    if (!domain || !folder) {
        alert('キーワードとフォルダ名を入力してください。');
        return;
    }

    if (editIndex >= 0) {
        currentSettings.domainRules[editIndex] = { domain, folder };
        editDomainIndexInput.value = '-1';
        addDomainBtn.textContent = '追加';
    } else {
        currentSettings.domainRules.push({ domain, folder });
    }

    saveAllSettings(() => {
        newDomainInput.value = '';
        newFolderInput.value = '';
        renderDomainRules();
    });
}

function removeDomainRule(index) {
    if (confirm('このルールを削除しますか？')) {
        currentSettings.domainRules.splice(index, 1);
        saveAllSettings(() => {
            if (parseInt(editDomainIndexInput.value, 10) === index) {
                editDomainIndexInput.value = '-1';
                addDomainBtn.textContent = '追加';
                newDomainInput.value = '';
                newFolderInput.value = '';
            }
            renderDomainRules();
        });
    }
}

// --- Extension Rules ---

function renderExtensionRules() {
    extensionList.innerHTML = '';
    const total = currentSettings.extensionRules.length;
    currentSettings.extensionRules.forEach((rule, index) => {
        const tr = document.createElement('tr');

        const tdExt = document.createElement('td');
        tdExt.textContent = rule.extension;

        const tdFolder = document.createElement('td');
        tdFolder.textContent = rule.folder;

        const tdAction = document.createElement('td');
        tdAction.className = 'action-cell';

        const upBtn = document.createElement('button');
        upBtn.textContent = '↑';
        upBtn.title = '上へ移動';
        upBtn.className = 'move-btn';
        upBtn.disabled = index === 0;
        upBtn.style.marginRight = '3px';
        upBtn.onclick = () => moveExtensionRule(index, -1);

        const downBtn = document.createElement('button');
        downBtn.textContent = '↓';
        downBtn.title = '下へ移動';
        downBtn.className = 'move-btn';
        downBtn.disabled = index === total - 1;
        downBtn.style.marginRight = '8px';
        downBtn.onclick = () => moveExtensionRule(index, 1);

        const editBtn = document.createElement('button');
        editBtn.textContent = '編集';
        editBtn.style.marginRight = '5px';
        editBtn.onclick = () => startEditExtensionRule(index);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '削除';
        deleteBtn.className = 'delete';
        deleteBtn.onclick = () => removeExtensionRule(index);

        tdAction.appendChild(upBtn);
        tdAction.appendChild(downBtn);
        tdAction.appendChild(editBtn);
        tdAction.appendChild(deleteBtn);

        tr.appendChild(tdExt);
        tr.appendChild(tdFolder);
        tr.appendChild(tdAction);

        extensionList.appendChild(tr);
    });
}

function moveExtensionRule(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentSettings.extensionRules.length) return;

    const [item] = currentSettings.extensionRules.splice(index, 1);
    currentSettings.extensionRules.splice(targetIndex, 0, item);

    const currentEditIndex = parseInt(editExtIndexInput.value, 10);
    if (currentEditIndex === index) {
        editExtIndexInput.value = targetIndex;
    } else if (currentEditIndex === targetIndex) {
        editExtIndexInput.value = index;
    }

    saveAllSettings(() => {
        renderExtensionRules();
    });
}

function startEditExtensionRule(index) {
    const rule = currentSettings.extensionRules[index];
    newExtensionInput.value = rule.extension;
    newExtFolderInput.value = rule.folder;
    editExtIndexInput.value = index;
    addExtensionBtn.textContent = '更新';
    newExtensionInput.focus();
}

function addOrUpdateExtensionRule() {
    const extension = newExtensionInput.value.trim();
    const folder = newExtFolderInput.value.trim();
    const editIndex = parseInt(editExtIndexInput.value, 10);

    if (!extension || !folder) {
        alert('拡張子とフォルダ名を入力してください。');
        return;
    }

    if (editIndex >= 0) {
        currentSettings.extensionRules[editIndex] = { extension, folder };
        editExtIndexInput.value = '-1';
        addExtensionBtn.textContent = '追加';
    } else {
        currentSettings.extensionRules.push({ extension, folder });
    }

    saveAllSettings(() => {
        newExtensionInput.value = '';
        newExtFolderInput.value = '';
        renderExtensionRules();
    });
}

function removeExtensionRule(index) {
    if (confirm('このルールを削除しますか？')) {
        currentSettings.extensionRules.splice(index, 1);
        saveAllSettings(() => {
            if (parseInt(editExtIndexInput.value, 10) === index) {
                editExtIndexInput.value = '-1';
                addExtensionBtn.textContent = '追加';
                newExtensionInput.value = '';
                newExtFolderInput.value = '';
            }
            renderExtensionRules();
        });
    }
}

// --- Common ---

// 設定保存の一元化（完了時にトースト表示）
function saveAllSettings(callback) {
    chrome.storage.local.set({
        domainRules: currentSettings.domainRules,
        extensionRules: currentSettings.extensionRules
    }, () => {
        showStatus(statusGeneralDiv);
        if (typeof callback === 'function') {
            callback();
        }
    });
}

// --- Settings Backup ---

function exportSettings() {
    const settings = {
        format: 'dl-shiwake-settings',
        version: 1,
        exportedAt: new Date().toISOString(),
        domainRules: currentSettings.domainRules,
        extensionRules: currentSettings.extensionRules
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `dl-shiwake-settings-${date}.json`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    showStatus(statusGeneralDiv, `ダウンロードフォルダに保存しました。\nファイル名: ${filename}`);
}

function importSettings(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const importedSettings = JSON.parse(reader.result);
            if (!isValidSettingsFile(importedSettings)) {
                throw new Error('設定ファイルの形式が正しくありません。');
            }

            if (!confirm('現在の設定をインポートした内容で置き換えますか？')) return;

            currentSettings.domainRules = importedSettings.domainRules;
            currentSettings.extensionRules = importedSettings.extensionRules;
            editDomainIndexInput.value = '-1';
            editExtIndexInput.value = '-1';
            addDomainBtn.textContent = '追加';
            addExtensionBtn.textContent = '追加';
            newDomainInput.value = '';
            newFolderInput.value = '';
            newExtensionInput.value = '';
            newExtFolderInput.value = '';

            saveAllSettings(() => {
                renderDomainRules();
                renderExtensionRules();
            });
        } catch (error) {
            alert(`設定をインポートできませんでした。\n${error.message}`);
        }
    };
    reader.onerror = () => alert('設定ファイルを読み込めませんでした。');
    reader.readAsText(file);
}

function isValidSettingsFile(settings) {
    if (!settings || settings.format !== 'dl-shiwake-settings' || settings.version !== 1) {
        return false;
    }

    return areValidRules(settings.domainRules, 'domain')
        && areValidRules(settings.extensionRules, 'extension');
}

function areValidRules(rules, valueKey) {
    return Array.isArray(rules) && rules.every((rule) => (
        rule && typeof rule[valueKey] === 'string' && rule[valueKey].trim()
        && typeof rule.folder === 'string' && rule.folder.trim()
    ));
}

// トースト表示のアニメーション・タイマー制御
function showStatus(element, message = '設定を保存しました。') {
    const target = element || statusGeneralDiv;
    if (!target) return;

    target.textContent = message;
    target.classList.add('show');

    if (target.dataset.timeoutId) {
        clearTimeout(parseInt(target.dataset.timeoutId, 10));
    }

    const timeoutId = setTimeout(() => {
        target.classList.remove('show');
    }, 2000);

    target.dataset.timeoutId = timeoutId.toString();
}