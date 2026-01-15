const { Plugin, showMessage, fetchPost, Setting, Dialog } = require("siyuan");

const STORAGE_NAME = "inbox-config";

class InboxPlugin extends Plugin {
    constructor() {
        super(...arguments);
        this.isProcessing = false;
        this.targets = [];
    }

    async onload() {
        await this.loadConfig();

        this.setting = new Setting({
            confirmCallback: () => {
                this.saveData(STORAGE_NAME, this.targets);
            }
        });

        this.setting.addItem({
            title: this.i18n.manageTargets || "管理收集目标",
            description: this.i18n.manageTargetsDesc || "添加、编辑或删除您的收集箱配置",
            createGui: () => {
                const container = document.createElement("div");
                container.className = "fn__block";
                this.renderTargetList(container);
                return container;
            }
        });

        this.eventBus.on("click-blockicon", ({ detail }) => {
            this.addMenuItems(detail.menu, detail.blockIds, 'block');
        });

        this.eventBus.on("click-editortitleicon", ({ detail }) => {
            this.addMenuItems(detail.menu, [detail.id], 'title');
        });

        this.eventBus.on("opened-protyle-menu", ({ detail }) => {
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0) {
                this.addMenuItems(detail.menu, [], 'selection', selection.toString());
            }
        });
    }

    renderTargetList(container) {
        container.innerHTML = "";
        const addBtn = document.createElement("button");
        addBtn.className = "b3-button b3-button--outline fn__flex-center";
        addBtn.style.marginBottom = "10px";
        addBtn.innerText = this.i18n.addTarget || "➕ 添加目标";
        addBtn.onclick = () => this.showTargetDialog(null, null, container);
        container.appendChild(addBtn);

        const list = document.createElement("div");
        list.className = "b3-list b3-list--background";
        
        this.targets.forEach((target, index) => {
            const item = document.createElement("div");
            item.className = "b3-list-item fn__flex";
            item.innerHTML = `
                <span class="b3-list-item__text fn__flex-1">${target.name} <small style="opacity:0.6">(${target.id})</small></span>
                <span class="b3-list-item__action" data-type="edit"><svg style="width:14px;height:14px"><use xlink:href="#iconEdit"></use></svg></span>
                <span class="b3-list-item__action" data-type="delete"><svg style="width:14px;height:14px"><use xlink:href="#iconTrashcan"></use></svg></span>
            `;
            
            item.querySelector('[data-type="edit"]').onclick = () => this.showTargetDialog(target, index, container);
            item.querySelector('[data-type="delete"]').onclick = () => {
                this.targets.splice(index, 1);
                this.saveData(STORAGE_NAME, this.targets);
                this.renderTargetList(container);
            };
            list.appendChild(item);
        });
        container.appendChild(list);
    }

    showTargetDialog(target, index, container) {
        const isEdit = !!target;
        const dialog = new Dialog({
            title: isEdit ? (this.i18n.editTarget || "编辑目标") : (this.i18n.addTarget || "添加目标"),
            content: `
                <div class="b3-dialog__content" style="padding: 20px;">
                    <label class="fn__block b3-label">名称</label>
                    <input class="b3-text-field fn__block" id="targetName" value="${target?.name || ''}">
                    <label class="fn__block b3-label">文档 ID</label>
                    <input class="b3-text-field fn__block" id="targetId" value="${target?.id || ''}">
                    <label class="fn__block b3-label">标题级别</label>
                    <select class="b3-select fn__block" id="titleLevel">
                        ${[1,2,3,4,5,6].map(l => `<option value="${l}" ${target?.titleLevel === l ? 'selected' : ''}>H${l}</option>`).join('')}
                    </select>
                    <label class="fn__block b3-label">分割类型</label>
                    <select class="b3-select fn__block" id="titleType">
                        <option value="none" ${target?.titleType === 'none' ? 'selected' : ''}>空标题/分割符</option>
                        <option value="number" ${target?.titleType === 'number' ? 'selected' : ''}>递增序号</option>
                        <option value="timestamp" ${target?.titleType === 'timestamp' ? 'selected' : ''}>时间戳</option>
                    </select>
                    <label class="fn__block b3-label">分割字符</label>
                    <input class="b3-text-field fn__block" id="titleChar" value="${target?.titleChar || '---'}">
                    <label class="fn__flex b3-label" style="align-items: center; gap: 10px; margin-top: 10px;">
                        <input type="checkbox" class="b3-switch" id="addSource" ${target?.addSource !== false ? 'checked' : ''}>
                        <span>添加来源链接</span>
                    </label>
                </div>
                <div class="b3-dialog__action">
                    <button class="b3-button b3-button--cancel">取消</button>
                    <button class="b3-button b3-button--text" id="saveBtn">保存</button>
                </div>
            `,
            width: "400px"
        });

        document.getElementById("saveBtn").onclick = () => {
            const newTarget = {
                name: document.getElementById("targetName").value,
                id: document.getElementById("targetId").value,
                titleLevel: parseInt(document.getElementById("titleLevel").value),
                titleType: document.getElementById("titleType").value,
                titleChar: document.getElementById("titleChar").value,
                addSource: document.getElementById("addSource").checked
            };

            if (!newTarget.name || !newTarget.id) {
                showMessage("名称和 ID 不能为空");
                return;
            }

            if (isEdit) this.targets[index] = newTarget;
            else this.targets.push(newTarget);

            this.saveData(STORAGE_NAME, this.targets);
            dialog.destroy();
            this.renderTargetList(container);
        };
    }

    async loadConfig() {
        const storage = await this.loadData(STORAGE_NAME);
        if (storage && Array.isArray(storage)) this.targets = storage;
        else {
            this.targets = [{ id: '20250504141931-cv4a2up', name: '→ 隨記', titleLevel: 1, titleType: 'none', titleChar: '---', addSource: true }];
            await this.saveData(STORAGE_NAME, this.targets);
        }
    }

    addMenuItems(menu, blockIds, type, selectedText) {
        if (this.targets.length === 0) return;
        const subMenu = [];
        this.targets.forEach((target) => {
            subMenu.push({
                label: target.name,
                icon: "iconUpload",
                click: async () => {
                    if (this.isProcessing) return;
                    await this.handleCollect(target, blockIds, type, selectedText);
                }
            });
        });
        menu.addItem({
            label: this.i18n.collect || "Inbox 收集",
            icon: "iconInbox",
            type: "submenu",
            submenu: subMenu
        });
    }

    async handleCollect(target, blockIds, type, selectedText) {
        this.isProcessing = true;
        try {
            let finalMarkdownParts = [];
            let sourceBlockId = blockIds[0];
            if (type === 'selection' && selectedText) {
                finalMarkdownParts.push(selectedText);
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    let node = selection.getRangeAt(0).startContainer;
                    while (node && node !== document.body) {
                        if (node.nodeType === 1 && node.dataset.nodeId) {
                            sourceBlockId = node.dataset.nodeId;
                            break;
                        }
                        node = node.parentNode;
                    }
                }
            } else {
                const filteredIds = await this.filterBlockIds(blockIds, type === 'title');
                for (const id of filteredIds) {
                    const res = await fetchPost("/api/export/exportMdContent", { id });
                    if (res.code === 0) {
                        const info = await fetchPost("/api/block/getBlockInfo", { id });
                        const cleanMd = this.cleanMarkdown(res.data.content, info.data, type === 'title');
                        if (cleanMd) finalMarkdownParts.push(cleanMd);
                    }
                }
            }
            let output = [];
            if (target.titleType === 'number') {
                const num = await this.getNextNumber(target.id);
                output.push(`${"#".repeat(target.titleLevel)} ${String(num).padStart(4, '0')}`);
            } else if (target.titleType === 'timestamp') {
                output.push(`${"#".repeat(target.titleLevel)} ${new Date().toLocaleString('zh-CN')}`);
            } else if (target.titleType === 'none') {
                output.push(`${"#".repeat(target.titleLevel)} ${target.titleChar || ''}`);
            }
            output.push(...finalMarkdownParts);
            if (target.addSource && sourceBlockId) {
                const info = await fetchPost("/api/block/getBlockInfo", { id: sourceBlockId });
                if (info.data && info.data.rootID) {
                    const docRes = await fetchPost("/api/query/sql", { stmt: `SELECT content FROM blocks WHERE id = '${info.data.rootID}' AND type = 'd'` });
                    const title = docRes.data?.[0]?.content || "来源文档";
                    output.push(`> 来源：((${info.data.rootID} "${title}"))`);
                }
            }
            const res = await fetchPost("/api/block/appendBlock", { dataType: "markdown", data: output.join("\n\n"), parentID: target.id });
            if (res.code === 0) showMessage(`${this.i18n.success || "✅ 已收集到"} ${target.name}`);
            else throw new Error(res.msg);
        } catch (e) {
            showMessage(`${this.i18n.error || "❌ 失败"}: ${e.message}`, 6000, "error");
        } finally {
            this.isProcessing = false;
        }
    }

    async filterBlockIds(ids, isTitle) { return ids; }

    cleanMarkdown(md, info, isTitle) {
        md = md.replace(/^---\n[\s\S]*?\n---\n*/m, '');
        if (isTitle) return md.trim();
        const lines = md.split('\n');
        let startIndex = 0;
        while (startIndex < lines.length && lines[startIndex].trim() === '') startIndex++;
        if (startIndex < lines.length && lines[startIndex].match(/^#\s+/)) {
            const firstLineContent = lines[startIndex].replace(/^#\s+/, '').trim();
            if (info && info.type !== 'NodeHeading') startIndex++;
            else if (info && info.type === 'NodeHeading') {
                if (firstLineContent !== info.content.trim() && lines.length > 1) startIndex++;
            }
        }
        return lines.slice(startIndex).join('\n').trim();
    }

    async getNextNumber(docId) {
        const res = await fetchPost("/api/query/sql", { stmt: `SELECT content FROM blocks WHERE root_id = '${docId}' AND type = 'h' ORDER BY created DESC LIMIT 100` });
        let max = 0;
        res.data?.forEach((b) => {
            const m = b.content.match(/^(\d+)/);
            if (m) max = Math.max(max, parseInt(m[1]));
        });
        return max + 1;
    }
}

module.exports = InboxPlugin;
