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

// UI Elements - Save
const saveAllBtn = document.getElementById('save-all');
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
    if (saveAllBtn) {
        saveAllBtn.addEventListener('click', () => saveAllSettings());
    }
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
    currentSettings.domainRules.forEach((rule, index) => {
        const tr = document.createElement('tr');

        const tdDomain = document.createElement('td');
        tdDomain.textContent = rule.domain;

        const tdFolder = document.createElement('td');
        tdFolder.textContent = rule.folder;

        const tdAction = document.createElement('td');

        const editBtn = document.createElement('button');
        editBtn.textContent = '編集';
        editBtn.style.marginRight = '5px';
        editBtn.onclick = () => startEditDomainRule(index);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '削除';
        deleteBtn.className = 'delete';
        deleteBtn.onclick = () => removeDomainRule(index);

        tdAction.appendChild(editBtn);
        tdAction.appendChild(deleteBtn);

        tr.appendChild(tdDomain);
        tr.appendChild(tdFolder);
        tr.appendChild(tdAction);

        domainList.appendChild(tr);
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
    currentSettings.extensionRules.forEach((rule, index) => {
        const tr = document.createElement('tr');

        const tdExt = document.createElement('td');
        tdExt.textContent = rule.extension;

        const tdFolder = document.createElement('td');
        tdFolder.textContent = rule.folder;

        const tdAction = document.createElement('td');

        const editBtn = document.createElement('button');
        editBtn.textContent = '編集';
        editBtn.style.marginRight = '5px';
        editBtn.onclick = () => startEditExtensionRule(index);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '削除';
        deleteBtn.className = 'delete';
        deleteBtn.onclick = () => removeExtensionRule(index);

        tdAction.appendChild(editBtn);
        tdAction.appendChild(deleteBtn);

        tr.appendChild(tdExt);
        tr.appendChild(tdFolder);
        tr.appendChild(tdAction);

        extensionList.appendChild(tr);
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

// トースト表示のアニメーション・タイマー制御
function showStatus(element) {
    const target = element || statusGeneralDiv;
    if (!target) return;

    target.classList.add('show');

    if (target.dataset.timeoutId) {
        clearTimeout(parseInt(target.dataset.timeoutId, 10));
    }

    const timeoutId = setTimeout(() => {
        target.classList.remove('show');
    }, 2000);

    target.dataset.timeoutId = timeoutId.toString();
}