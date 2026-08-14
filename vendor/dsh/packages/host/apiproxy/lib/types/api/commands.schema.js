/**
 * commands domain zod schemas (names derived from map keys: commandListRequestSchema /
 * commandListValueSchema / commandExecuteRequestSchema / commandExecuteValueSchema).
 */
import { z } from 'zod';
import { sessionIdSchema } from "./sessions.schema.js";
/** CommandDescriptor row of command.list. */
export const commandDescriptorSchema = z.object({
    name: z.string().min(1),
    description: z.string(),
    input: z.object({ hint: z.string() }).optional(),
});
/** command.list request payload. */
export const commandListRequestSchema = z.object({
    sessionId: sessionIdSchema,
});
/** command.list response value. */
export const commandListValueSchema = z.object({
    commands: z.array(commandDescriptorSchema),
});
/** command.execute request payload. */
export const commandExecuteRequestSchema = z.object({
    sessionId: sessionIdSchema,
    line: z.string(),
});
/** CommandId: one brand cast after shape validation (the only cast point in this domain). */
export const commandIdSchema = z.string().min(1);
/** command.execute response value: pure admission — outcomes ride the logged
 * lifecycle events; commandId (present exactly when matched) correlates with them. */
export const commandExecuteValueSchema = z.object({
    matched: z.boolean(),
    commandId: commandIdSchema.optional(),
});
//# sourceMappingURL=commands.schema.js.map