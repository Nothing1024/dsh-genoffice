import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/** Product-wide, versioned first-run welcome step. */
import { useCallback, useEffect, useRef } from 'react';
import { BrandWordmark, Button, OnboardingSurface } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './WelcomeNotice.module.css';
function emphasizedFeedback(paragraph, emphasis) {
    const index = paragraph.indexOf(emphasis);
    /* v8 ignore next -- both locale values derive from one owner object that contains the emphasis */
    if (index < 0)
        return paragraph;
    return (_jsxs(_Fragment, { children: [paragraph.slice(0, index), _jsx("strong", { children: emphasis }), paragraph.slice(index + emphasis.length)] }));
}
/** Render the mandatory notice until its current version is acknowledged. */
export function WelcomeNotice(props) {
    const { complete, controller, useSnapshot, t } = props;
    const state = useSnapshot(snapshot => snapshot);
    const finished = useRef(false);
    const titleRef = useRef(null);
    const finish = useCallback(() => {
        if (finished.current)
            return;
        finished.current = true;
        complete();
    }, [complete]);
    useEffect(() => {
        if (state.status === 'idle')
            void controller.load();
    }, [controller, state.status]);
    useEffect(() => {
        if (state.acknowledged)
            finish();
    }, [finish, state.acknowledged]);
    useEffect(() => {
        if (state.status === 'ready' && !state.acknowledged) {
            titleRef.current?.focus();
        }
    }, [state.acknowledged, state.status]);
    // Null while the acknowledgement fact is still loading (or already given):
    // the takeover chrome below is part of THIS render, so deciding not to
    // show paints and blocks nothing.
    if (state.status === 'idle' || state.status === 'loading' || state.acknowledged)
        return null;
    const acknowledge = async () => {
        if (await controller.acknowledge())
            finish();
    };
    return (_jsx(OnboardingSurface, { children: _jsxs("section", { className: css.page, role: "region", "aria-labelledby": "welcome-notice-title", children: [_jsx("div", { className: css.brand, "aria-hidden": "true", children: _jsx(BrandWordmark, { size: 24 }) }), _jsx("h2", { ref: titleRef, id: "welcome-notice-title", className: css.title, tabIndex: -1, children: t('welcome.title') }), _jsx("p", { className: css.opening, children: t('welcome.paragraph.0') }), _jsx("blockquote", { className: css.reflection, children: t('welcome.paragraph.1') }), _jsx("p", { className: css.feedback, children: emphasizedFeedback(t('welcome.paragraph.2'), t('welcome.feedbackEmphasis')) }), state.error === null ? null : _jsx("p", { className: css.error, role: "alert", children: t('welcome.error') }), _jsx("div", { className: css.footer, children: _jsx(Button, { variant: "primary", className: css.primary, disabled: state.status === 'saving', onClick: () => { void acknowledge(); }, children: t('welcome.continue') }) })] }) }));
}
//# sourceMappingURL=WelcomeNotice.js.map