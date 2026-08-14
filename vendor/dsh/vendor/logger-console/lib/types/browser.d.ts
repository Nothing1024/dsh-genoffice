import { Message } from 'cordis';
import { ConsoleExporter as Base } from './shared.ts';
/** Re-export shared console exporter config and base implementation. */
export * from './shared.ts';
/** Browser console exporter that dispatches to native console methods. */
export declare class ConsoleExporter extends Base {
    export(message: Message): void;
}
export default ConsoleExporter;
//# sourceMappingURL=browser.d.ts.map