// script.js — email frontend

document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('nav a[data-panel]');
    const panels = document.querySelectorAll('main section.panel');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');
    const toast = document.getElementById('toast');

    let currentPanel = 'inbox';

    function switchPanel(name) {
        currentPanel = name;
        panels.forEach(p => p.hidden = (p.id !== name));
        navLinks.forEach(l => l.classList.toggle('active', l.dataset.panel === name));
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchPanel(link.dataset.panel);
        });
    });

    function openModal(title, bodyHtml, onConfirm) {
        if (!modal) return;
        modalTitle.textContent = title;
        modalBody.innerHTML = bodyHtml;
        modal.hidden = false;
        const confirm = modal.querySelector('#modal-confirm');
        if (confirm) {
            const handler = () => {
                onConfirm(modalBody);
                closeModal();
            };
            confirm.replaceWith(confirm.cloneNode(true));
            modal.querySelector('#modal-confirm').addEventListener('click', handler);
        }
    }

    function closeModal() {
        if (!modal) return;
        modal.hidden = true;
        modalBody.innerHTML = '';
    }

    modalCancel && modalCancel.addEventListener('click', closeModal);
    const backdrop = modal && modal.querySelector('.modal-backdrop');
    backdrop && backdrop.addEventListener('click', closeModal);

    function showToast(message) {
        if (!toast) return;
        toast.textContent = message;
        toast.hidden = false;
        setTimeout(() => { toast.hidden = true; }, 3000);
    }

    const composeBtn = document.getElementById('compose-btn');
    if (composeBtn && modal) {
        composeBtn.addEventListener('click', () => {
            openModal('compose', `
                <form id="compose-form">
                    <label>
                        <span>to</span>
                        <input type="email" id="compose-to" autocomplete="off" required>
                    </label>
                    <label>
                        <span>subject</span>
                        <input type="text" id="compose-subject" autocomplete="off" required>
                    </label>
                    <label>
                        <span>message</span>
                        <textarea id="compose-body" rows="6" required></textarea>
                    </label>
                </form>
            `, (formContainer) => {
                const to = formContainer.querySelector('#compose-to').value.trim();
                const subject = formContainer.querySelector('#compose-subject').value.trim();
                const body = formContainer.querySelector('#compose-body').value.trim();
                if (!to || !subject || !body) {
                    showToast('please fill in all fields');
                    return;
                }
                showToast('sent to ' + to + ': ' + subject);
            });
        });
    }

    const createAliasBtn = document.getElementById('create-alias-btn');
    const aliasList = document.getElementById('alias-list');
    const aliasEmpty = document.getElementById('alias-empty');

    function renderAliases() {
        if (!aliasList || !aliasEmpty) return;
        const items = aliasList.querySelectorAll('.alias-item');
        aliasEmpty.hidden = items.length > 0;
    }

    if (createAliasBtn && modal) {
        createAliasBtn.addEventListener('click', () => {
            openModal('new alias', `
                <form id="alias-form">
                    <label>
                        <span>local part</span>
                        <input type="text" id="alias-local" autocomplete="off" required>
                    </label>
                    <label>
                        <span>domain</span>
                        <input type="text" id="alias-domain" value="localhost" autocomplete="off" required>
                    </label>
                </form>
            `, (formContainer) => {
                const local = formContainer.querySelector('#alias-local').value.trim().toLowerCase();
                const domain = formContainer.querySelector('#alias-domain').value.trim().toLowerCase();
                if (!local || !domain) {
                    showToast('please fill in all fields');
                    return;
                }
                const item = document.createElement('div');
                item.className = 'alias-item';
                item.innerHTML = `
                    <span class="alias">${local}@${domain}</span>
                    <span class="alias-tag">custom</span>
                    <button class="danger" data-action="delete">delete</button>
                `;
                item.querySelector('[data-action="delete"]').addEventListener('click', () => {
                    item.remove();
                    renderAliases();
                    showToast('alias deleted');
                });
                aliasList.appendChild(item);
                renderAliases();
                showToast('alias ' + local + '@' + domain + ' created');
            });
        });
    }

    const createIdentityBtn = document.getElementById('create-identity-btn');
    const identityList = document.getElementById('identity-list');
    const identityEmpty = document.getElementById('identity-empty');

    function renderIdentities() {
        if (!identityList || !identityEmpty) return;
        const items = identityList.querySelectorAll('.identity-item');
        identityEmpty.hidden = items.length > 0;
    }

    if (createIdentityBtn && modal) {
        createIdentityBtn.addEventListener('click', () => {
            openModal('new identity', `
                <form id="identity-form">
                    <label>
                        <span>display name</span>
                        <input type="text" id="identity-name" autocomplete="name" required>
                    </label>
                    <label>
                        <span>email</span>
                        <input type="email" id="identity-email" autocomplete="email" required>
                    </label>
                </form>
            `, (formContainer) => {
                const name = formContainer.querySelector('#identity-name').value.trim();
                const email = formContainer.querySelector('#identity-email').value.trim().toLowerCase();
                if (!name || !email) {
                    showToast('please fill in all fields');
                    return;
                }
                const item = document.createElement('div');
                item.className = 'identity-item';
                item.innerHTML = `
                    <h3>${name}</h3>
                    <span class="identity-meta">${email}</span>
                    <button class="danger" data-action="delete">delete</button>
                `;
                item.querySelector('[data-action="delete"]').addEventListener('click', () => {
                    item.remove();
                    renderIdentities();
                    showToast('identity deleted');
                });
                identityList.appendChild(item);
                renderIdentities();
                showToast('identity ' + name + ' added');
            });
        });
    }

    switchPanel('inbox');
    renderAliases();
    renderIdentities();
});
