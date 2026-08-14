import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The card that declares a provider pi-ai does not ship — an OpenAI-compatible
 * gateway, a self-hosted server, or a provider newer than the installed
 * catalog.
 *
 * This is a create, not an edit, which is why it is its own card rather than
 * the provider editor with extra fields: the route id is being *chosen* here,
 * and the settings address does not exist until it is. One `settings.mutate`
 * sets the whole profile at `providers.<route>`; the key travels separately
 * through `credentials.set` under the reference the profile records, exactly as
 * an existing provider's key does.
 *
 * The three fields a hand-declared route cannot default — endpoint, protocol,
 * and at least one model — are required here rather than at load, so the
 * failure names the field while the user is still looking at it.
 */
import { useState } from 'react';
import { EditorFooter } from "./EditorFooter.js";
import { validateDeepSeekModels } from "./DeepSeekModelsEditor.js";
import { ModelListEditor } from "./ModelListEditor.js";
import { deriveKeyRef, messageOf } from "./store.js";
import styles from './ModelsSection.module.css';
/** The settings namespace a hand-declared provider is written into. */
const NS = 'llm-pi-ai';
/** A route id usable as a settings key and as the stem of a credential name. */
const ROUTE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/**
 * Render the custom-provider creation card.
 * @param props - existing routes, protocol choices, wire faces, and copy.
 * @returns the creation card.
 */
export function CustomProviderCard(props) {
    const { taken, protocols, api, t } = props;
    // Captured at mount, like the editor's: the write must be judged against the
    // section this card was drafted over, not whatever it grew into meanwhile.
    const [openedAt] = useState(() => props.revision);
    const [route, setRoute] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [baseURL, setBaseURL] = useState('');
    const [protocol, setProtocol] = useState(protocols[0] ?? '');
    const [keyDraft, setKeyDraft] = useState('');
    const [models, setModels] = useState([]);
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState(undefined);
    const disabled = props.readOnly || busy;
    const routeInvalid = route.length > 0 && !ROUTE_PATTERN.test(route);
    const routeTaken = taken.includes(route);
    // Rows are checked by the same per-row validator the editor cards use, so a
    // bad row is named by its position here too. Capacities have route-level
    // fallbacks; what a route cannot default is at least one model.
    const modelFailure = validateDeepSeekModels(models);
    const ready = route.length > 0 && !routeInvalid && !routeTaken
        && baseURL.length > 0 && models.length > 0 && modelFailure === undefined;
    // The one blocked gate worth a line under the form. The route id is omitted
    // because its own field already explains itself, and a satisfied card says
    // nothing at all rather than printing an empty paragraph.
    const hint = failure !== undefined || ready
        ? undefined
        : baseURL.length === 0
            ? t('customNeedsBaseUrl')
            : modelFailure !== undefined
                ? `${t('model')} ${String(modelFailure.index + 1)}: ${t(modelFailure.key)}`
                : t('customNeedsModels');
    /** Perform the create, returning a failure message or undefined. */
    const createOnce = async () => {
        const keyRef = deriveKeyRef(route);
        const profile = {
            ...displayName.length === 0 ? {} : { displayName },
            apiKeyEnv: keyRef,
            api: protocol,
            baseURL,
            models: models.map(model => ({ ...model })),
        };
        const response = await api.settings.mutate({
            ns: NS,
            ops: [{ op: 'set', path: ['providers', route], value: profile }],
            // `taken` is a snapshot too, so the id check alone cannot see a route
            // declared after this card opened; the revision makes that race a
            // `settings-conflict` instead of a write over the other profile.
            expectedRevision: openedAt,
        });
        if (!response.result.ok)
            return response.result.error.message;
        if (keyDraft.length > 0) {
            const stored = await api.credentials.set({ ref: keyRef, value: keyDraft });
            // The profile landed; saying the key did not is the only honest report,
            // and the row is now editable so the key can be entered again there.
            if (!stored.result.ok)
                return stored.result.error.message;
        }
        return undefined;
    };
    const create = async () => {
        setBusy(true);
        setFailure(undefined);
        try {
            const outcome = await createOnce();
            if (outcome !== undefined) {
                setFailure(outcome);
                return;
            }
            props.onClose(true);
        }
        catch (error) {
            // A transport failure rejects rather than answering; without this the
            // card would stay busy with nothing shown.
            setFailure(messageOf(error));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: styles['editor'], children: [_jsx("div", { className: styles['editorHeader'], children: _jsx("span", { className: styles['editorTitle'], children: t('customTitle') }) }), _jsxs("div", { className: styles['field'], children: [_jsx("span", { className: styles['fieldLabel'], children: t('customRoute') }), _jsx("input", { className: styles['input'], type: "text", value: route, placeholder: "acme-gateway", "aria-label": t('customRoute'), disabled: disabled, onChange: (event) => { setRoute(event.target.value); } })] }), _jsx("p", { className: styles['advancedHint'], children: routeInvalid ? t('customRouteInvalid') : routeTaken ? t('customRouteTaken') : t('customRouteHint') }), _jsxs("div", { className: styles['field'], children: [_jsx("span", { className: styles['fieldLabel'], children: t('customDisplayName') }), _jsx("input", { className: styles['input'], type: "text", value: displayName, placeholder: route.length === 0 ? t('customDisplayName') : route, "aria-label": t('customDisplayName'), disabled: disabled, onChange: (event) => { setDisplayName(event.target.value); } })] }), _jsxs("div", { className: styles['field'], children: [_jsx("span", { className: styles['fieldLabel'], children: t('baseUrl') }), _jsx("input", { className: styles['input'], type: "text", value: baseURL, placeholder: "https://gateway.example/v1", "aria-label": t('baseUrl'), disabled: disabled, onChange: (event) => { setBaseURL(event.target.value); } })] }), _jsxs("div", { className: styles['field'], children: [_jsx("span", { className: styles['fieldLabel'], children: t('customApi') }), _jsx("select", { className: styles['input'], value: protocol, "aria-label": t('customApi'), disabled: disabled, onChange: (event) => { setProtocol(event.target.value); }, children: protocols.map(choice => _jsx("option", { value: choice, children: choice }, choice)) })] }), _jsxs("div", { className: styles['field'], children: [_jsx("span", { className: styles['fieldLabel'], children: t('keyInput') }), _jsx("input", { className: styles['input'], type: "password", autoComplete: "off", value: keyDraft, placeholder: t('keyPlaceholder'), "aria-label": t('keyInput'), disabled: disabled, onChange: (event) => { setKeyDraft(event.target.value); } })] }), _jsx(ModelListEditor, { models: models, onChange: setModels, probe: {
                    settingsNs: NS,
                    baseURL,
                    api: protocol,
                    ...keyDraft.length === 0 ? {} : { apiKey: keyDraft },
                }, api: api, t: t, disabled: disabled }), failure !== undefined ? _jsx("p", { className: styles['error'], children: failure }) : null, hint === undefined ? null : _jsx("p", { className: styles['advancedHint'], children: hint }), _jsx(EditorFooter, { t: t, busy: busy, submitDisabled: disabled || !ready, submitLabel: "create", submitBusyLabel: "creating", onCancel: () => { props.onClose(false); }, onSubmit: () => { void create(); } })] }));
}
//# sourceMappingURL=CustomProviderCard.js.map