import {
    Plugin,
    showMessage,
    fetchPost,
    Setting,
    Dialog
} from "siyuan";

interface TargetConfig {
    id: string;
    name: string;
    titleLevel: number;
    titleType: 'number' | 'timestamp' | 'none';
    titleChar: string;
    addSource: boolean;
}

const STORAGE_NAME = "inbox-config";

export default class InboxPlugin extends Plugin {
    private isProcessing = false;
    private targets: TargetConfig[] = [];

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
    }

    private renderTargetList(container: HTMLElement) {
        container.innerHTML = "";
        
        // 添加按钮
        const addBtn = document.createElement("button");
        addBtn.className = "b3-button b3-button--outline fn__flex-center";
        addBtn.style.marginBottom = "10px";
        addBtn.innerText = this.i18n.addTarget || "➕ 添加目标";
        addBtn.onclick = () => this.showTargetDialog();
        container.appendChild(addBtn);

        // 列表容器
        const list = document.createElement("div");
        list.className = "b3-list b3-list--background";
        
        this.targets.forEach((target, index) => {
            const item = document.createElement("div");
            item.className = "b3-list-item fn__flex";
            item.innerHTML = `
                <span class="b3-list-item__text fn__flex-1">${target.name} <small style="opacity:0.6">(${target.id})</small></span>
                <span class="b3-list-item__action" data-type="edit"><svg><use xlink:href="#iconEdit"></use></svg></span>
                <span class="b3-list-item__action" data-type="delete"><svg><use xlink:href="#iconTrashcan"></use></svg></span>
            `;
            
            item.querySelector('[data-type="edit"]').addEventListener("click", () => this.showTargetDialog(target, index));
            item.querySelector('[data-type="delete"]').addEventListener("click", () => {
                this.targets.splice(index, 1);
                this.saveData(STORAGE_NAME, this.targets);
                this.renderTargetList(container);
            });
            
            list.appendChild(item);
        });
        
        container.appendChild(list);
    }

    private showTargetDialog(target?: TargetConfig, index?: number) {
        const isEdit = !!target;
        const dialog = new Dialog({
            title: isEdit ? this.i18n.editTarget : this.i18n.addTarget,
            content: `
                <div class="b3-dialog__content" style="padding: 20px;">
                    <label class="fn__block b3-label">名称</label>
                    <input class="b3-text-field fn__block" id="targetName" value="${target?.name || ''}" placeholder="例如：隨記">
                    
                    <label class="fn__block b3-label">文档 ID</label>
                    <input class="b3-text-field fn__block" id="targetId" value="${target?.id || ''}" placeholder="输入目标文档的 ID">
                    
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
                    
                    <label class="fn__block b3-label">分割字符 (仅空标题模式有效)</label>
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

        const saveBtn = document.getElementById("saveBtn");
        saveBtn.onclick = () => {
            const newTarget: TargetConfig = {
                name: (document.getElementById("targetName") as HTMLInputElement).value,
                id: (document.getElementById("targetId") as HTMLInputElement).value,
                titleLevel: parseInt((document.getElementById("titleLevel") as HTMLSelectElement).value),
                titleType: (document.getElementById("titleType") as HTMLSelectElement).value as any,
                titleChar: (document.getElementById("titleChar") as HTMLInputElement).value,
                addSource: (document.getElementById("addSource") as HTMLInputElement).checked
            };

            if (!newTarget.name || !newTarget.id) {
                showMessage("名称和 ID 不能为空");
                return;
            }

            if (isEdit && typeof index === 'number') {
                this.targets[index] = newTarget;
            } else {
                this.targets.push(newTarget);
            }

            this.saveData(STORAGE_NAME, this.targets);
            dialog.destroy();
            // 刷新设置页面列表
            const settingContainer = document.querySelector('.b3-dialog__container .fn__block');
            if (settingContainer) this.renderTargetList(settingContainer as HTMLElement);
        };
    }

    private async loadConfig() {
        const storage = await this.loadData(STORAGE_NAME);
        if (storage && Array.isArray(storage)) {
            this.targets = storage;
        } else {
            this.targets = [{ id: '20250504141931-cv4a2up', name: '→ 隨記', titleLevel: 1, titleType: 'none', titleChar: '---', addSource: true }];
            await this.saveData(STORAGE_NAME, this.targets);
        }
    }

    // ... 其余 handleCollect, filterBlockIds, cleanMarkdown, getNextNumber 逻辑保持不变 ...
    // (此处省略以节省空间，实际代码中会完整包含)
}
