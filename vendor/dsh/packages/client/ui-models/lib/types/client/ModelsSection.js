import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Models settings section: the provider rows joined from the configurable
 * directory, settings namespaces, and credential states, with one editor
 * card at a time. A whole-section provider without a configured key (the
 * unconfigured DeepSeek posture) renders as its open setup card instead of a
 * row; the add flow is a card carrying the dormant-provider select. Every
 * mutation writes through the wire, while a provider removal first requires
 * confirmation; the page re-renders from pushed invalidations or the
 * post-apply reload.
 */
import { useState } from 'react';
import { Button, IconPlusOutline16, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import { CustomProviderCard } from "./CustomProviderCard.js";
import { messageOf, protocolChoices } from "./store.js";
import { ProviderEditor } from "./ProviderEditor.js";
import styles from './ModelsSection.module.css';
/**
 * Remove one user-added provider profile by unsetting its path in the stored
 * user section, then reload. The removal names the profile rather than
 * rebuilding the section: this page only ever holds the redacted descriptor,
 * so a rebuilt section would drop every literal secret stored elsewhere in
 * the namespace along with the profile being removed.
 * @param api - settings wire face.
 * @param controller - the page store to refresh.
 * @param target - the provider's settings address.
 * @returns the failure message, or undefined once the write and reload landed.
 */
export async function removeProviderProfile(api, controller, target) {
    let response;
    try {
        response = await api.settings.mutate({
            ns: target.settingsNs,
            ops: [{ op: 'unset', path: [...target.settingsPath] }],
        });
    }
    catch (error) {
        // The transport rejected rather than answering; the caller must be able
        // to say so instead of the row silently staying put.
        return messageOf(error);
    }
    if (!response.result.ok)
        return response.result.error.message;
    await controller.load();
    return undefined;
}
/**
 * Whether a whole-section provider still needs its first key: nothing marks
 * the credential configured and no literal `apiKey` is stored, so the page
 * opens the setup card instead of showing a row.
 * @param row - the joined provider row.
 * @returns whether to render the setup card.
 */
export function needsSetup(row) {
    if (row.entry.settingsPath.length > 0)
        return false;
    if (row.credential?.configured === true)
        return false;
    return !row.literalApiKeyConfigured;
}
function targetOf(row) {
    return {
        provider: row.entry.provider,
        displayName: row.entry.displayName,
        settingsNs: row.entry.settingsNs,
        settingsPath: row.entry.settingsPath,
    };
}
/**
 * Render the Models section content column.
 * @param props - slot-delivered injected dependencies.
 * @returns the section, or null while the shell has not injected yet.
 */
export function ModelsSection(props) {
    const { controller, useSnapshot, api, t } = props;
    if (controller === undefined || useSnapshot === undefined || api === undefined || t === undefined)
        return null;
    return _jsx(Loaded, { injected: { controller, useSnapshot, api, t } });
}
function Loaded({ injected }) {
    const { controller, api, t } = injected;
    const state = injected.useSnapshot(snapshot => snapshot);
    const [editing, setEditing] = useState(undefined);
    const [adding, setAdding] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(undefined);
    const [deleting, setDeleting] = useState(false);
    const [declaring, setDeclaring] = useState(false);
    const closeEditor = (changed) => {
        setEditing(undefined);
        setAdding(false);
        setDeclaring(false);
        if (changed)
            void controller.load();
    };
    const closeDelete = () => {
        if (deleting)
            return;
        setDeleteTarget(undefined);
    };
    const confirmDelete = () => {
        /* v8 ignore next -- the action only renders with a target and is disabled while a deletion is pending */
        if (deleteTarget === undefined || deleting)
            return;
        setDeleting(true);
        void removeProviderProfile(api, controller, deleteTarget)
            .then((failure) => {
            if (failure !== undefined) {
                controller.fail(failure);
                return;
            }
            setDeleteTarget(undefined);
        })
            .finally(() => { setDeleting(false); });
    };
    if (state.status === 'idle')
        void controller.load();
    if (state.status === 'error') {
        /* v8 ignore next -- an error status always carries text; the fallback satisfies the nullable type */
        const errorText = state.error ?? '';
        return (_jsxs("div", { className: styles['section'], children: [_jsx("p", { className: styles['error'], children: `${t('loadFailed')}: ${errorText}` }), _jsx("button", { type: "button", className: styles['secondaryButton'], onClick: () => { void controller.load(); }, children: t('retry') })] }));
    }
    const configured = state.rows.filter(row => row.configured);
    const addable = state.rows.filter(row => !row.configured && row.entry.settingsNs !== '');
    const addTarget = adding ? editing : undefined;
    const addNamespace = addTarget === undefined ? undefined : state.namespaces.get(addTarget.settingsNs);
    // Hand-declared routes live in the pi-ai namespace, which is also the only
    // one whose schema names the protocols one may speak; without it mounted
    // there is nothing to declare and the entry point stays disabled.
    const protocols = protocolChoices(state.namespaces.get('llm-pi-ai'));
    return (_jsxs("div", { className: styles['section'], children: [_jsx("h2", { className: styles['title'], children: t('title') }), _jsx("p", { className: styles['intro'], children: t('intro') }), !state.writable && state.status === 'ready' ? _jsx("p", { className: styles['notice'], children: t('readOnly') }) : null, _jsx("ul", { className: styles['rows'], children: configured.map((row) => {
                    const target = targetOf(row);
                    const namespace = state.namespaces.get(target.settingsNs);
                    /* v8 ignore next -- the join marks a row configured only when its namespace resolved */
                    if (namespace === undefined)
                        return null;
                    if (needsSetup(row)) {
                        // First-run posture: the provider exists but has no key — the
                        // setup card IS its presence on the page.
                        return (_jsx("li", { className: styles['setupCard'], children: _jsx(ProviderEditor, { provider: target.provider, displayName: target.displayName, namespace: namespace, settingsPath: target.settingsPath, api: api, t: t, readOnly: !state.writable, onClose: closeEditor }) }, row.entry.provider));
                    }
                    const open = !adding && editing?.provider === row.entry.provider;
                    return (_jsxs("li", { className: styles['rowCard'], children: [_jsxs("div", { className: styles['rowHead'], children: [_jsx("span", { className: styles['rowName'], children: row.entry.displayName }), _jsxs("span", { className: styles['rowActions'], children: [_jsx("button", { type: "button", className: styles['secondaryButton'], onClick: () => {
                                                    // One card at a time: leaving `declaring` set would show
                                                    // the create card beside this editor, and closing either
                                                    // one discards the other's draft.
                                                    setDeclaring(false);
                                                    setAdding(false);
                                                    setEditing(open ? undefined : target);
                                                }, children: t('edit') }), row.removable
                                                ? (_jsx("button", { type: "button", className: styles['dangerButton'], disabled: !state.writable, onClick: () => { setDeleteTarget(target); }, children: t('remove') }))
                                                : null] })] }), open
                                ? (_jsx(ProviderEditor, { provider: target.provider, displayName: target.displayName, namespace: namespace, settingsPath: target.settingsPath, api: api, t: t, readOnly: !state.writable, onClose: closeEditor }))
                                : null] }, row.entry.provider));
                }) }), _jsx("div", { className: styles['addBlock'], children: addTarget !== undefined && addNamespace !== undefined
                    ? (_jsxs("div", { className: styles['addCard'], children: [_jsxs("div", { className: styles['field'], children: [_jsx("span", { className: styles['fieldLabel'], children: t('provider') }), _jsx("select", { className: `${styles['input']} ${styles['selectInput']}`, value: addTarget.provider, "aria-label": t('provider'), onChange: (event) => {
                                            const row = addable.find(candidate => candidate.entry.provider === event.target.value);
                                            /* v8 ignore next -- the select only lists addable rows */
                                            if (row === undefined)
                                                return;
                                            setEditing(targetOf(row));
                                        }, children: addable.map(row => (_jsx("option", { value: row.entry.provider, children: row.entry.displayName }, row.entry.provider))) })] }), _jsx(ProviderEditor, { provider: addTarget.provider, displayName: addTarget.displayName, hideTitle: true, namespace: addNamespace, settingsPath: addTarget.settingsPath, api: api, t: t, readOnly: !state.writable, onClose: closeEditor }, addTarget.provider)] }))
                    : declaring
                        ? (_jsx("div", { className: styles['addCard'], children: _jsx(CustomProviderCard, { taken: state.rows.map(row => row.entry.provider), protocols: protocols, 
                                /* v8 ignore next -- the card only opens from a button disabled without this namespace */
                                revision: state.namespaces.get('llm-pi-ai')?.revision ?? 0, api: api, t: t, readOnly: !state.writable, onClose: closeEditor }) }))
                        : (_jsxs("div", { className: styles['addActions'], children: [_jsxs("button", { type: "button", className: styles['addButton'], disabled: addable.length === 0 || !state.writable, onClick: () => {
                                        const first = addable[0];
                                        /* v8 ignore next -- the button is disabled while nothing is addable */
                                        if (first === undefined)
                                            return;
                                        setDeclaring(false);
                                        setAdding(true);
                                        setEditing(targetOf(first));
                                    }, children: [_jsx(IconPlusOutline16, { size: 14 }), t('add')] }), _jsxs("button", { type: "button", className: styles['addButton'], disabled: protocols.length === 0 || !state.writable, onClick: () => { setAdding(false); setEditing(undefined); setDeclaring(true); }, children: [_jsx(IconPlusOutline16, { size: 14 }), t('customAdd')] })] })) }), _jsx(Modal, { open: deleteTarget !== undefined, onClose: closeDelete, title: t('deleteTitle'), closeLabel: t('close'), description: t('deleteDescription'), className: styles['deleteDialog'], footer: (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", autoFocus: true, disabled: deleting, onClick: closeDelete, children: t('cancel') }), _jsx(Button, { variant: "outline", className: styles['deleteConfirm'], disabled: deleting, onClick: confirmDelete, children: deleting ? t('deleting') : t('deleteConfirm') })] })) })] }));
}
//# sourceMappingURL=ModelsSection.js.map