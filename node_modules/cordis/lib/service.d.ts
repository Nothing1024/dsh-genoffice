import { Context } from './context';
import { symbols } from './utils';
export declare abstract class Service<out T = never> {
    protected ctx: Context;
    static readonly init: unique symbol;
    static readonly check: unique symbol;
    static readonly config: unique symbol;
    static readonly invoke: unique symbol;
    static readonly extend: unique symbol;
    static readonly tracker: unique symbol;
    static readonly resolveConfig: unique symbol;
    [symbols.config]: T;
    name: string;
    constructor(ctx: Context, name: string);
    protected [symbols.filter](ctx: Context): boolean;
    protected [symbols.extend](props?: any): any;
    [symbols.resolveConfig](base?: T, head?: T): T;
    static [Symbol.hasInstance](instance: any): boolean;
}
