/**
 * commands domain zod schemas (names derived from map keys: commandListRequestSchema /
 * commandListValueSchema / commandExecuteRequestSchema / commandExecuteValueSchema).
 */
import { z } from 'zod';
import type { CommandId } from '@deepseek-ai/dsh-commands/brand';
/** CommandDescriptor row of command.list. */
export declare const commandDescriptorSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    input: z.ZodOptional<z.ZodObject<{
        hint: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** command.list request payload. */
export declare const commandListRequestSchema: z.ZodObject<{
    sessionId: z.ZodType<import("@deepseek-ai/dsh-session").SessionId, unknown, z.core.$ZodTypeInternals<import("@deepseek-ai/dsh-session").SessionId, unknown>>;
}, z.core.$strip>;
/** command.list response value. */
export declare const commandListValueSchema: z.ZodObject<{
    commands: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        input: z.ZodOptional<z.ZodObject<{
            hint: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** command.execute request payload. */
export declare const commandExecuteRequestSchema: z.ZodObject<{
    sessionId: z.ZodType<import("@deepseek-ai/dsh-session").SessionId, unknown, z.core.$ZodTypeInternals<import("@deepseek-ai/dsh-session").SessionId, unknown>>;
    line: z.ZodString;
}, z.core.$strip>;
/** CommandId: one brand cast after shape validation (the only cast point in this domain). */
export declare const commandIdSchema: z.ZodType<CommandId>;
/** command.execute response value: pure admission — outcomes ride the logged
 * lifecycle events; commandId (present exactly when matched) correlates with them. */
export declare const commandExecuteValueSchema: z.ZodObject<{
    matched: z.ZodBoolean;
    commandId: z.ZodOptional<z.ZodType<CommandId, unknown, z.core.$ZodTypeInternals<CommandId, unknown>>>;
}, z.core.$strip>;
//# sourceMappingURL=commands.schema.d.ts.map