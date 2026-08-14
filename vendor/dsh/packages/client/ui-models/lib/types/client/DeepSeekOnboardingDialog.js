import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Official-DeepSeek first-run step. Readiness comes from the same
 * provider/settings/credential join as the Models page; the prompt only
 * routes the user to that page's single credential editor.
 */
import { useEffect, useRef } from 'react';
import { BrandWordmark, Button, OnboardingSurface } from '@deepseek-ai/dsh-client-ui-primitives';
import { deepSeekReadiness } from "./store.js";
import styles from './DeepSeekOnboardingDialog.module.css';
/* v8 ignore next 3 -- closed-union defaults only defend future source widening */
function assertNever(_value) {
    throw new Error('unexpected DeepSeek onboarding state');
}
/**
 * Prompt a first-run user to open Models while the official adapter exists
 * and its effective credential is not configured.
 * @param props - settings-shell owner state and Models feature dependencies.
 * @returns the onboarding page or null when onboarding needs no intervention.
 */
export function DeepSeekOnboardingDialog(props) {
    const { complete, openSection, controller, useSnapshot, t } = props;
    const state = useSnapshot(snapshot => snapshot);
    const readiness = deepSeekReadiness(state);
    const titleRef = useRef(null);
    useEffect(() => {
        if (state.status === 'idle')
            void controller.load();
    }, [controller, state.status]);
    useEffect(() => {
        if (readiness.kind === 'adapter-absent'
            || readiness.kind === 'configured'
            || readiness.kind === 'unavailable')
            complete();
    }, [complete, readiness.kind]);
    useEffect(() => {
        if (readiness.kind === 'credential-missing')
            titleRef.current?.focus();
    }, [readiness.kind]);
    const openModels = () => {
        complete();
        openSection('models');
    };
    // Null covers the still-deciding and nothing-to-do states alike: the
    // takeover chrome below is part of THIS render, so declining paints and
    // blocks nothing while the shared join is in flight.
    switch (readiness.kind) {
        case 'loading':
        case 'adapter-absent':
        case 'configured':
        case 'unavailable':
            return null;
        case 'credential-missing':
            break;
        /* v8 ignore next -- every current readiness variant is handled above */
        default:
            return assertNever(readiness);
    }
    return (_jsx(OnboardingSurface, { children: _jsxs("section", { className: styles['page'], role: "region", "aria-labelledby": "deepseek-onboarding-title", children: [_jsx("div", { className: styles['brand'], "aria-hidden": "true", children: _jsx(BrandWordmark, { size: 24 }) }), _jsx("h2", { ref: titleRef, id: "deepseek-onboarding-title", className: styles['title'], tabIndex: -1, children: t('onboardingTitle') }), _jsx("p", { className: styles['description'], children: t('onboardingDescription') }), _jsxs("div", { className: styles['actions'], children: [_jsx(Button, { variant: "ghost", className: styles['later'], onClick: complete, children: t('onboardingLater') }), _jsx(Button, { variant: "primary", className: styles['primary'], onClick: openModels, children: t('onboardingGoToSettings') })] })] }) }));
}
//# sourceMappingURL=DeepSeekOnboardingDialog.js.map