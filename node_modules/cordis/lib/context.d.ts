import { Dict } from 'cosmokit';
import { EventsService } from './events';
import { LoggerService } from './logger';
import { ReflectService } from './reflect';
import { InjectKey, RegistryService } from './registry';
import { symbols } from './utils';
import './fiber';
export interface Context {
    [symbols.isolate]: Dict<symbol>;
    [symbols.intercept]: Dict;
    /** @experimental */
    root: this;
    baseUrl?: string;
    events: EventsService;
    logger: LoggerService;
    reflect: ReflectService;
    registry: RegistryService;
}
export declare class Context {
    static readonly effect: unique symbol;
    static readonly filter: unique symbol;
    static readonly isolate: unique symbol;
    static readonly intercept: unique symbol;
    static is(value: any): value is Context;
    constructor();
    extend(meta?: {}): this;
    isolate(name: string, label?: symbol): this;
    intercept<K extends InjectKey>(name: K, config: Context[K] extends {
        [symbols.config]: infer T;
    } ? T : never): this;
    intercept(name: string, config: any): this;
}
