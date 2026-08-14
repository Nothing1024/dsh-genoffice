/**
 * Runtime registry for generated Typert contributions. It owns live Zod
 * instances and generated package reflection, but performs no TypeScript
 * analysis or schema generation.
 * @module @deepseek-ai/dsh-typert-registry
 */
import { Service } from 'cordis';
import { z } from 'zod';
/**
 * Compose the global key of one generated schema.
 * @param packageName - contributing npm package.
 * @param name - schema export name.
 * @returns `<package>#<name>`.
 */
export function typertKey(packageName, name) {
    return `${packageName}#${name}`;
}
/**
 * Compose the identity of one package-face model.
 * @param packageName - contributing npm package.
 * @param face - independently compiled face.
 * @returns `<package>#<face>`.
 */
export function typertPackageKey(packageName, face) {
    return `${packageName}#${face}`;
}
/**
 * Registry of generated schemas and package reflection.
 * @typert service
 */
export class TypertRegistry extends Service {
    schemas = new Map();
    packages = new Map();
    constructor(ctx) {
        super(ctx, 'typert');
    }
    /**
     * Register one generated contribution atomically for the calling fiber.
     * Duplicate package-face identities or schema keys reject the whole batch.
     * @param contribution - generated schemas and package metadata.
     * @returns the exact effect disposer that removes this contribution.
     */
    register(contribution) {
        const packageRecord = this.validatePackage(contribution);
        const schemaRecords = this.validateSchemas(contribution);
        const { schemas, packages } = this;
        const dispose = this.ctx.effect(function* () {
            packages.set(packageRecord.key, packageRecord);
            for (const record of schemaRecords)
                schemas.set(record.key, record);
            yield () => {
                packages.delete(packageRecord.key);
                for (const record of schemaRecords)
                    schemas.delete(record.key);
            };
        }, 'typert.register()');
        // oxlint-disable-next-line typescript/no-misused-promises -- synchronous cleanup; preserve Cordis disposer identity
        return dispose;
    }
    /**
     * Look up one schema by `<package>#<name>`.
     * @param key - global schema key.
     * @returns the live schema record, or `undefined` when absent.
     */
    get(key) {
        return this.schemas.get(key);
    }
    /**
     * Resolve one required schema.
     * @param key - global schema key.
     * @returns the live schema record.
     * @throws when the key is malformed, the package face is absent, or the schema is not contributed.
     */
    resolve(key) {
        const record = this.schemas.get(key);
        if (record !== undefined) {
            return record;
        }
        const hash = key.indexOf('#');
        if (hash <= 0 || hash === key.length - 1) {
            throw new Error(`typert: invalid schema key "${key}" — expected "<package>#<name>"`);
        }
        const packageName = key.slice(0, hash);
        if ([...this.packages.values()].some(candidate => candidate.package === packageName)) {
            throw new Error(`typert: cannot resolve "${key}" — package "${packageName}" is registered but contributes no schema named "${key.slice(hash + 1)}"`);
        }
        throw new Error(`typert: cannot resolve "${key}" — package "${packageName}" has no registered contribution`);
    }
    /**
     * Enumerate live schemas in registration order.
     * @param filter - optional package and face restriction.
     * @returns matching schema records.
     */
    list(filter = {}) {
        return [...this.schemas.values()].filter(record => matches(record, filter));
    }
    /**
     * Look up generated reflection for one package face.
     * @param packageName - exact npm package name.
     * @param face - face to query; defaults to the host runtime.
     * @returns the live package record, or `undefined` when absent.
     */
    getPackage(packageName, face = 'host') {
        return this.packages.get(typertPackageKey(packageName, face));
    }
    /**
     * Enumerate generated package reflection in registration order.
     * @param filter - optional package and face restriction.
     * @returns matching package records.
     */
    listPackages(filter = {}) {
        return [...this.packages.values()].filter(record => matches(record, filter));
    }
    /**
     * Project a live Zod schema to JSON Schema without caching the result.
     * @param key - global schema key.
     * @param params - Zod projection parameters.
     * @returns a fresh JSON Schema document.
     */
    toJSONSchema(key, params) {
        return z.toJSONSchema(this.resolve(key).schema, params);
    }
    validatePackage(contribution) {
        validateSegment('package name', contribution.package);
        const face = contribution.face;
        if (face !== 'host' && face !== 'client') {
            throw new Error(`typert: invalid face ${JSON.stringify(face)} — expected "host" or "client"`);
        }
        const key = typertPackageKey(contribution.package, contribution.face);
        if (this.packages.has(key)) {
            throw new Error(`typert: package face "${key}" is already registered`);
        }
        return {
            package: contribution.package,
            face,
            key,
            model: contribution.model,
        };
    }
    validateSchemas(contribution) {
        const records = [];
        const batch = new Set();
        for (const schema of contribution.schemas) {
            validateSegment('schema name', schema.name);
            const key = typertKey(contribution.package, schema.name);
            if (batch.has(key) || this.schemas.has(key)) {
                throw new Error(`typert: schema "${key}" is already registered`);
            }
            batch.add(key);
            records.push({
                ...schema,
                package: contribution.package,
                face: contribution.face,
                key,
            });
        }
        return records;
    }
}
function matches(record, filter) {
    return (filter.package === undefined || record.package === filter.package)
        && (filter.face === undefined || record.face === filter.face);
}
function validateSegment(subject, value) {
    if (value.length === 0 || value.includes('#')) {
        throw new Error(`typert: invalid ${subject} "${value}" — must be nonempty and must not contain "#"`);
    }
}
export default TypertRegistry;
//# sourceMappingURL=index.js.map