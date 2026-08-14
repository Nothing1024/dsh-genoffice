import { Formatter } from 'cordis';
import { ConsoleExporter as Base } from './shared.ts';
/** Re-export shared console exporter config and base implementation. */
export * from './shared.ts';
/** Node console exporter with `util.inspect` object formatting. */
export declare class ConsoleExporter extends Base {
    formatters: Record<string, Formatter>;
    getDefaults(): {
        colors: false | 0 | 1 | 2 | 3;
        showTime: string;
        showDiff: boolean;
    };
}
export default ConsoleExporter;
//# sourceMappingURL=index.d.ts.map