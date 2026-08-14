import { Context, Exporter, Formatter, Message } from 'cordis';
import z from 'schemastery';
/** Terminal color support level compatible with supports-color. */
export type ColorSupportLevel = 0 | 1 | 2 | 3;
/** Formatting options for the logger name label. */
export interface LabelStyle {
    width?: number;
    margin?: number;
    align?: 'left' | 'right';
}
/** Config namespace for console logger exporters. */
export declare namespace ConsoleExporter {
    interface Config {
        colors?: false | ColorSupportLevel;
        maxLength?: number;
        levels?: Record<string, number>;
        showDiff?: boolean;
        showTime?: string;
        label?: LabelStyle;
    }
}
/** Shared console log exporter implementation used by Node and browser builds. */
export declare class ConsoleExporter implements Exporter {
    ctx: Context;
    static readonly name = "logger-console";
    static readonly Config: z<ConsoleExporter.Config>;
    colors: false | ColorSupportLevel;
    maxLength?: number;
    levels?: Record<string, number>;
    showDiff: boolean;
    showTime: string;
    label?: LabelStyle;
    timestamp: number;
    formatters: Record<string, Formatter>;
    constructor(ctx: Context, config?: ConsoleExporter.Config);
    getDefaults(): {
        colors: false | ColorSupportLevel;
        showTime: string;
        showDiff: boolean;
    };
    export(message: Message): void;
    render(message: Message): string;
}
export default ConsoleExporter;
//# sourceMappingURL=shared.d.ts.map