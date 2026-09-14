// フォルダパスの正規化（余分なスラッシュや階層移動記号を除去）
function sanitizeFolder(folder) {
    // 保存先はダウンロードフォルダからの相対パスとして扱う
    if (!folder) return '';
    return folder.trim().replace(/^\/+|\/+$/g, '').replace(/\.\.\//g, '');
}

// 対象フォルダの判定ロジック（単一責任に分離）
function findTargetFolder(item, settings) {
    const urlStr = (item.url || '').toLowerCase();
    const referrerStr = (item.referrer || '').toLowerCase();
    const filename = (item.filename || '').split(/[/\\]/).pop();

    // 1. URLルール（部分一致）
    const domainRules = Array.isArray(settings.domainRules) ? settings.domainRules : [];
    const domainRule = domainRules.find(rule => {
        if (!rule?.domain) return false;
        const keywords = rule.domain.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
        return keywords.some(k => urlStr.includes(k) || referrerStr.includes(k));
    });

    if (domainRule?.folder) return sanitizeFolder(domainRule.folder);

    // 2. 拡張子ルール（完全一致）
    const extMatch = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
    if (extMatch) {
        const extensionRules = Array.isArray(settings.extensionRules) ? settings.extensionRules : [];
        const extRule = extensionRules.find(rule => {
            if (!rule?.extension) return false;
            const exts = rule.extension.split(',').map(e => e.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
            return exts.includes(extMatch);
        });

        if (extRule?.folder) return sanitizeFolder(extRule.folder);
    }

    return '';
}

// ファイル名決定イベントハンドラ
function onDeterminingFilename(item, suggest) {
    chrome.storage.local.get({ domainRules: [], extensionRules: [] }, (settings) => {
        if (!item.state || item.state === 'interrupted' || item.state === 'complete') {
            suggest();
            return;
        }

        const filename = (item.filename || '').split(/[/\\]/).pop();
        const targetFolder = findTargetFolder(item, settings);

        if (targetFolder) {
            suggest({
                filename: `${targetFolder}/${filename}`,
                conflictAction: 'uniquify'
            });
        } else {
            suggest();
        }
    });

    return true;
}

// 状態に応じたリスナーの動的着脱
function applyState(isEnabled) {
    const hasListener = chrome.downloads.onDeterminingFilename.hasListener(onDeterminingFilename);
    if (isEnabled && !hasListener) {
        chrome.downloads.onDeterminingFilename.addListener(onDeterminingFilename);
    } else if (!isEnabled && hasListener) {
        chrome.downloads.onDeterminingFilename.removeListener(onDeterminingFilename);
    }
    updateIcon(isEnabled);
}

function updateIcon(isEnabled) {
    const iconSuffix = isEnabled ? '' : '_disabled';
    chrome.action.setIcon({
        path: {
            16: `icons/icon_16${iconSuffix}.png`,
            48: `icons/icon_48${iconSuffix}.png`,
            128: `icons/icon_128${iconSuffix}.png`
        }
    });
    chrome.action.setBadgeText({ text: isEnabled ? "" : "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#666666" });
}

// 初期化と設定変化の購読
chrome.storage.local.get({ isEnabled: true }, (items) => {
    applyState(items.isEnabled ?? true);
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.isEnabled !== undefined) {
        applyState(changes.isEnabled.newValue);
    }
});

chrome.action.onClicked.addListener(() => {
    chrome.storage.local.get({ isEnabled: true }, (items) => {
        chrome.storage.local.set({ isEnabled: !(items.isEnabled ?? true) });
    });
});