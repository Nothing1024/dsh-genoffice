/**
 * TypeScript project analyzer for the compiler-independent Typert model.
 * Programs, symbols, and syntax nodes remain extraction-only implementation
 * details; callers receive only the model declared in {@link ./model.ts}.
 * @module @deepseek-ai/dsh-typert-generator/analyzer
 */
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
/** Analysis failure with a source-oriented diagnostic. */
export class TypertAnalysisError extends Error {
    name = 'TypertAnalysisError';
}
class SourceEditQueued extends Error {
}
const EMPTY_DOCUMENTATION = { tags: [] };
/**
 * Process-wide parse cache for the bundled TypeScript default libraries.
 * `typescript/lib/lib.*.d.ts` content is immutable for the process lifetime,
 * so parses are shared across every {@link WorkspaceCaches} instance; the key
 * carries the parse-affecting settings, keeping reuse exact.
 */
const defaultLibraryParses = new Map();
function defaultLibraryKey(fileName, languageVersionOrOptions) {
    const options = typeof languageVersionOrOptions === 'object'
        ? languageVersionOrOptions
        : { languageVersion: languageVersionOrOptions };
    return [
        fileName,
        String(options.languageVersion),
        String(options.impliedNodeFormat ?? ''),
        String(options.jsDocParsingMode ?? ''),
    ].join('\0');
}
/**
 * Shared memo over one immutable workspace snapshot. Passing one instance to
 * several analyzers (the batched and write-mode children reuse their parent's
 * automatically) reuses parsed tsconfigs, the registration inventory, and
 * per-face compiler hosts whose parsed and bound source files and module
 * resolutions carry across programs. Callers that mutate workspace files
 * between analyses must start from a fresh instance; write-mode source edits
 * invalidate themselves through {@link invalidate}.
 */
export class WorkspaceCaches {
    /** Parsed tsconfig files by absolute config path. */
    configs = new Map();
    /** Registration inventories keyed by root and aggregate config paths. */
    registrations = new Map();
    hosts = new Map();
    /**
     * Parse one tsconfig once per workspace snapshot.
     * @param path - absolute config path.
     * @returns the memoized parse result.
     */
    config(path) {
        let parsed = this.configs.get(path);
        if (parsed === undefined) {
            parsed = parseConfig(path);
            this.configs.set(path, parsed);
        }
        return parsed;
    }
    /**
     * Return the shared compiler host for one face. Every program of one face
     * is built from the same aggregate compiler options (the first call wins),
     * so parsed source files, binder state, and module resolutions are safe to
     * reuse across the face's batched programs.
     * @param face - the face whose programs share this host.
     * @param options - the face's effective compiler options.
     * @returns a compiler host with source-file and module-resolution caches.
     */
    programHost(face, options) {
        let entry = this.hosts.get(face);
        if (entry === undefined) {
            const host = ts.createCompilerHost(options);
            const files = new Map();
            const resolutionCache = ts.createModuleResolutionCache(host.getCurrentDirectory(), fileName => host.getCanonicalFileName(fileName), options);
            const base = host.getSourceFile.bind(host);
            // The snapshot contract makes shouldCreateNewSourceFile irrelevant: it
            // only fires under oldProgram reuse, which these fresh programs never
            // request, and invalidate() is the one supported re-read path.
            host.getSourceFile = (fileName, languageVersionOrOptions, onError) => {
                if (isStandardLibraryFile(fileName)) {
                    const key = defaultLibraryKey(fileName, languageVersionOrOptions);
                    if (!defaultLibraryParses.has(key)) {
                        defaultLibraryParses.set(key, base(fileName, languageVersionOrOptions, onError));
                    }
                    return defaultLibraryParses.get(key);
                }
                if (!files.has(fileName))
                    files.set(fileName, base(fileName, languageVersionOrOptions, onError));
                return files.get(fileName);
            };
            host.getModuleResolutionCache = () => resolutionCache;
            entry = { host, files };
            this.hosts.set(face, entry);
        }
        return entry.host;
    }
    /**
     * Drop cached parses of one edited source file so the next analysis reads
     * the written content.
     * @param file - path of the edited file.
     */
    invalidate(file) {
        const target = realPath(file);
        for (const { files } of this.hosts.values()) {
            for (const key of [...files.keys()]) {
                if (realPath(key) === target)
                    files.delete(key);
            }
        }
    }
}
/** Analyze host and client as independent TypeScript programs. */
export class WorkspaceAnalyzer {
    options;
    queuedEdit;
    crossFaceLinks = new Map();
    checkedProjects = new Set();
    registrations = [];
    caches;
    constructor(options) {
        this.options = {
            root: resolve(options.root),
            hostConfig: options.hostConfig ?? 'tsconfig.host.json',
            clientConfig: options.clientConfig ?? 'tsconfig.client.json',
            faces: options.faces ?? ['host', 'client'],
            checkDiagnostics: options.checkDiagnostics ?? true,
            mode: options.mode ?? 'check',
            ...(options.packages === undefined ? {} : { packages: options.packages }),
        };
        this.caches = options.caches ?? new WorkspaceCaches();
    }
    /**
     * Build the workspace model. Write mode applies inferred annotations and then
     * returns a fresh check-mode analysis of the edited projects.
     * @returns the independent face models and their explicit cross-face links.
     */
    analyze() {
        this.registrations = this.loadRegistrations();
        const selected = this.options.packages === undefined
            ? undefined
            : new Set(this.options.packages);
        const faces = [];
        try {
            for (const face of this.options.faces) {
                const registrations = this.registrations.filter(registration => registration.face === face && (selected === undefined || selected.has(registration.name)));
                if (registrations.length === 0)
                    continue;
                if (this.options.checkDiagnostics) {
                    for (const registration of registrations)
                        this.checkProject(registration);
                }
                const aggregatePath = resolve(this.options.root, face === 'host' ? this.options.hostConfig : this.options.clientConfig);
                const aggregate = this.caches.config(aggregatePath);
                const rootNames = [...new Set(registrations.flatMap(registration => registration.config.parsed.fileNames))];
                const options = {
                    ...aggregate.parsed.options,
                    composite: false,
                    incremental: false,
                    noEmit: true,
                };
                const program = ts.createProgram({
                    rootNames,
                    options,
                    host: this.caches.programHost(face, options),
                });
                faces.push(new FaceAnalyzer({
                    root: this.options.root,
                    face,
                    program,
                    registrations,
                    allRegistrations: this.registrations,
                    mode: this.options.mode,
                    queueEdit: (edit) => { this.queueEdit(edit); },
                    crossFaceLinks: this.crossFaceLinks,
                }).analyze());
            }
        }
        catch (error) {
            if (!(error instanceof SourceEditQueued) || this.options.mode !== 'write' || this.queuedEdit === undefined)
                throw error;
        }
        if (this.queuedEdit !== undefined) {
            this.applyEdit(this.queuedEdit);
            return new WorkspaceAnalyzer({ ...this.options, caches: this.caches, mode: 'write' }).analyze();
        }
        if (this.options.mode === 'write') {
            return new WorkspaceAnalyzer({ ...this.options, caches: this.caches, mode: 'check' }).analyze();
        }
        return {
            faces,
            crossFaceLinks: [...this.crossFaceLinks.values()].sort(compareCrossFaceLinks),
        };
    }
    /**
     * Analyze an explicit package selection through bounded compiler programs.
     * The resulting model is identical in shape to {@link analyze}; stable graph
     * ids let repeated dependency declarations merge without flattening types.
     * @param batchSize - maximum selected packages in one face program.
     * @returns one merged workspace model.
     */
    analyzeInBatches(batchSize = 8) {
        if (this.options.packages === undefined) {
            throw new TypertAnalysisError('typert: batched analysis requires an explicit package selection');
        }
        if (!Number.isInteger(batchSize) || batchSize < 1) {
            throw new TypertAnalysisError(`typert: batch size must be a positive integer, received ${String(batchSize)}`);
        }
        const batches = [];
        for (let index = 0; index < this.options.packages.length; index += batchSize) {
            batches.push(new WorkspaceAnalyzer({
                ...this.options,
                caches: this.caches,
                packages: this.options.packages.slice(index, index + batchSize),
            }).analyze());
        }
        return mergeWorkspaceModels(batches);
    }
    /**
     * Discover package faces from public-export-reachable Cordis augmentations
     * and explicit `@typert` roots without constructing a type-checker program.
     * @returns contributors grouped by package with deterministic face order.
     */
    discoverPackages() {
        const registrations = this.loadRegistrations()
            .filter(registration => this.options.faces.includes(registration.face))
            .filter(registration => this.registrationHasSurface(registration));
        const packages = new Map();
        for (const registration of registrations) {
            const current = packages.get(registration.name) ?? {
                root: slash(relative(this.options.root, registration.root)),
                faces: new Set(),
            };
            current.faces.add(registration.face);
            packages.set(registration.name, current);
        }
        return [...packages]
            .map(([packageName, value]) => ({
            package: packageName,
            root: value.root,
            faces: [...value.faces].sort(),
        }))
            .sort((left, right) => left.package.localeCompare(right.package));
    }
    /**
     * Index top-level exported type declarations without promoting them to graph
     * roots. Consumers use this lexical index for ambiguity checks while all
     * semantic traversal continues through {@link TypeGraph}.
     * @returns declarations from the selected faces and package projects.
     */
    indexSourceDeclarations() {
        const selected = this.options.packages === undefined ? undefined : new Set(this.options.packages);
        const declarations = [];
        for (const registration of this.loadRegistrations()) {
            if (!this.options.faces.includes(registration.face)
                || (selected !== undefined && !selected.has(registration.name)))
                continue;
            for (const file of registration.config.parsed.fileNames) {
                const relativeFile = slash(relative(this.options.root, file));
                if (!existsSync(file)
                    || !isWithin(realPath(file), join(registration.root, 'src'))
                    || !/\.(?:cts|mts|ts)$/.test(file))
                    continue;
                const sourceFile = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
                for (const statement of sourceFile.statements) {
                    if (!isTypeDeclaration(statement)
                        || statement.name === undefined
                        || !hasModifier(statement, ts.SyntaxKind.ExportKeyword))
                        continue;
                    const position = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
                    declarations.push({
                        face: registration.face,
                        package: registration.name,
                        name: statement.name.text,
                        kind: ts.isClassDeclaration(statement)
                            ? 'class'
                            : ts.isInterfaceDeclaration(statement)
                                ? 'interface'
                                : ts.isTypeAliasDeclaration(statement)
                                    ? 'alias'
                                    : 'enum',
                        location: {
                            file: relativeFile,
                            line: position.line + 1,
                            column: position.character + 1,
                        },
                        text: declarationText(statement),
                    });
                }
            }
        }
        return uniqueBy(declarations, declaration => `${declaration.face}\0${declaration.location.file}\0${String(declaration.location.line)}\0${declaration.name}`)
            .sort((left, right) => left.face.localeCompare(right.face)
            || left.location.file.localeCompare(right.location.file)
            || left.location.line - right.location.line);
    }
    loadRegistrations() {
        const inventoryKey = `${this.options.root}\0${this.options.hostConfig}\0${this.options.clientConfig}`;
        const cached = this.caches.registrations.get(inventoryKey);
        if (cached !== undefined)
            return cached;
        const registrations = [];
        for (const face of ['host', 'client']) {
            const aggregatePath = resolve(this.options.root, face === 'host' ? this.options.hostConfig : this.options.clientConfig);
            if (!existsSync(aggregatePath))
                continue;
            const aggregate = this.caches.config(aggregatePath);
            for (const reference of aggregate.parsed.projectReferences ?? []) {
                const configPath = projectConfigPath(reference.path);
                const packageRoot = dirname(configPath);
                if (!isWithin(realPath(packageRoot), join(this.options.root, 'packages')))
                    continue;
                const manifestPath = join(packageRoot, 'package.json');
                if (!existsSync(manifestPath))
                    continue;
                const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
                if (typeof manifest.name !== 'string')
                    continue;
                const registration = {
                    face,
                    name: manifest.name,
                    root: realPath(packageRoot),
                    config: this.caches.config(configPath),
                    manifest,
                };
                const packagePath = slash(relative(this.options.root, packageRoot));
                const clientPackage = packagePath === 'packages/client' || packagePath.startsWith('packages/client/');
                if (clientPackage && isDualFacePackage(manifest)) {
                    registrations.push({ ...registration, face: 'host', exportSubpaths: hostExportSubpaths(manifest) });
                    registrations.push({ ...registration, face: 'client', exportSubpaths: clientExportSubpaths(manifest) });
                }
                else if (clientPackage) {
                    registrations.push({ ...registration, face: 'client' });
                }
                else {
                    registrations.push({ ...registration, face: 'host' });
                }
            }
        }
        const inventory = uniqueBy(registrations, registration => `${registration.face}\0${registration.name}`)
            .sort((left, right) => left.face.localeCompare(right.face) || left.name.localeCompare(right.name));
        this.caches.registrations.set(inventoryKey, inventory);
        return inventory;
    }
    entrySourcePaths(registration) {
        return packageExportTargets(registration.manifest)
            .filter(([subpath, target]) => (registration.exportSubpaths === undefined
            || registration.exportSubpaths.includes(subpath))
            && !target.includes('*')
            && subpath !== './package.json'
            && subpath !== './typert'
            && subpath !== './client/typert'
            && !target.endsWith('.json'))
            .map(([, target]) => sourcePathForExport(registration.root, target))
            .filter(existsSync);
    }
    registrationHasSurface(registration) {
        const seen = new Set();
        const queue = this.entrySourcePaths(registration);
        while (queue.length > 0) {
            const file = realPath(queue.shift());
            if (seen.has(file) || !isWithin(file, registration.root))
                continue;
            seen.add(file);
            const source = readFileSync(file, 'utf8');
            const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
            if (sourceFileHasSurface(sourceFile))
                return true;
            for (const imported of ts.preProcessFile(source).importedFiles) {
                const resolved = ts.resolveModuleName(imported.fileName, file, registration.config.parsed.options, ts.sys).resolvedModule;
                if (resolved !== undefined && isWithin(resolved.resolvedFileName, registration.root)) {
                    queue.push(resolved.resolvedFileName);
                }
            }
        }
        return false;
    }
    checkProject(registration) {
        if (this.checkedProjects.has(registration.config.path))
            return;
        this.checkedProjects.add(registration.config.path);
        const program = ts.createProgram({
            rootNames: registration.config.parsed.fileNames,
            options: {
                ...registration.config.parsed.options,
                composite: false,
                incremental: false,
                noEmit: true,
                // Source-plane workspace aliases resolve referenced packages to source.
                // Widen only this diagnostic program's root so those imports do not
                // produce an artificial TS6059 before Typert checks the public edge.
                rootDir: this.options.root,
            },
        });
        const diagnostics = [
            ...program.getSyntacticDiagnostics(),
            ...program.getSemanticDiagnostics(),
        ].filter((diagnostic) => diagnostic.file !== undefined
            && diagnostic.start !== undefined
            && isWithin(diagnostic.file.fileName, registration.root));
        if (diagnostics.length === 0)
            return;
        throw new TypertAnalysisError(diagnostics
            .map(diagnostic => formatProgramDiagnostic(this.options.root, registration.face, diagnostic))
            .join('\n'));
    }
    queueEdit(edit) {
        this.queuedEdit = edit;
    }
    applyEdit(edit) {
        const source = readFileSync(edit.file, 'utf8');
        writeFileSync(edit.file, source.slice(0, edit.position) + edit.text + source.slice(edit.position));
        this.caches.invalidate(edit.file);
    }
}
class FaceAnalyzer {
    root;
    face;
    program;
    checker;
    registrations;
    allRegistrations;
    mode;
    queueEdit;
    crossFaceLinks;
    sourceFiles = new Map();
    declarations = new Map();
    declarationStates = new Set();
    nodes = new Map();
    exportsByPackage = new Map();
    nodeOrdinals = new Map();
    constructor(options) {
        this.root = options.root;
        this.face = options.face;
        this.program = options.program;
        this.checker = options.program.getTypeChecker();
        this.registrations = options.registrations;
        this.allRegistrations = options.allRegistrations;
        this.mode = options.mode;
        this.queueEdit = options.queueEdit;
        this.crossFaceLinks = options.crossFaceLinks;
        for (const sourceFile of this.program.getSourceFiles()) {
            this.sourceFiles.set(realPath(sourceFile.fileName), sourceFile);
        }
    }
    analyze() {
        for (const registration of this.registrations) {
            this.exportsByPackage.set(registration.name, this.collectExports(registration));
        }
        const packages = this.registrations
            .map(registration => this.analyzePackage(registration))
            .filter(hasPackageSurface);
        return {
            face: this.face,
            packages,
            graph: {
                declarations: [...this.declarations.values()].sort((left, right) => left.id.localeCompare(right.id)),
                nodes: [...this.nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
            },
        };
    }
    analyzePackage(registration) {
        const records = this.exportsByPackage.get(registration.name);
        const reachable = this.reachableFiles(registration, records.map(record => record.sourceFile));
        const services = [];
        const events = [];
        for (const sourceFile of reachable) {
            for (const statement of sourceFile.statements) {
                if (!ts.isModuleDeclaration(statement)
                    || !ts.isStringLiteral(statement.name)
                    || statement.name.text !== 'cordis'
                    || statement.body === undefined
                    || !ts.isModuleBlock(statement.body))
                    continue;
                for (const member of statement.body.statements) {
                    if (!ts.isInterfaceDeclaration(member))
                        continue;
                    if (member.name.text === 'Context') {
                        services.push(...this.collectServices(member, records));
                    }
                    else if (member.name.text === 'Events') {
                        events.push(...this.collectEvents(member));
                    }
                }
            }
        }
        const objects = [];
        const schemas = [];
        const seenBusinessSymbols = new Set();
        for (const record of records) {
            const declaration = record.declaration;
            if (!isTypeDeclaration(declaration))
                continue;
            if (this.registrationForFile(declaration.getSourceFile().fileName) === undefined)
                continue;
            const symbol = this.resolveSymbol(record.symbol);
            const symbolId = this.symbolId(symbol);
            if (seenBusinessSymbols.has(symbolId))
                continue;
            const mode = typertMode(declaration);
            if (mode !== 'object' && mode !== 'schema')
                continue;
            seenBusinessSymbols.add(symbolId);
            this.ensureDeclaration(symbol, declaration);
            const documentation = documentationOf(declaration);
            if (mode === 'object') {
                objects.push({
                    ...documentation,
                    export: record.model,
                    symbol: symbolId,
                    passing: 'reference',
                });
            }
            else {
                schemas.push({
                    ...documentation,
                    export: record.model,
                    symbol: symbolId,
                    type: this.referenceNode(symbol, declaration),
                });
            }
        }
        return {
            name: registration.name,
            root: slash(relative(this.root, registration.root)),
            exports: records.map(record => record.model)
                .sort((left, right) => left.subpath.localeCompare(right.subpath) || left.name.localeCompare(right.name)),
            services: uniqueBy(services, service => service.key).sort((left, right) => left.key.localeCompare(right.key)),
            events: uniqueBy(events, event => event.name).sort((left, right) => left.name.localeCompare(right.name)),
            objects: objects.sort((left, right) => left.export.name.localeCompare(right.export.name)),
            schemas: schemas.sort((left, right) => left.export.name.localeCompare(right.export.name)),
        };
    }
    collectExports(registration) {
        const targets = packageExportTargets(registration.manifest)
            .filter(([subpath]) => registration.exportSubpaths === undefined
            || registration.exportSubpaths.includes(subpath));
        const records = [];
        for (const [subpath, target] of targets) {
            if (target.includes('*') || subpath === './package.json'
                || subpath === './typert' || subpath === './client/typert'
                // Data exports (bundle patch lists, JSON manifests) carry no TypeScript API.
                || target.endsWith('.json') || target.endsWith('.yml') || target.endsWith('.yaml'))
                continue;
            const sourcePath = sourcePathForExport(registration.root, target);
            const sourceFile = this.sourceFiles.get(realPath(sourcePath));
            if (sourceFile === undefined) {
                throw new TypertAnalysisError(`typert(${this.face}): ${registration.name} export ${subpath} resolves to missing source ${sourcePath}`);
            }
            const moduleSymbol = this.checker.getSymbolAtLocation(sourceFile);
            if (moduleSymbol === undefined)
                continue;
            for (const exported of this.checker.getExportsOfModule(moduleSymbol)) {
                const symbol = this.resolveSymbol(exported);
                const declaration = preferredDeclaration(symbol);
                const aliases = exported === symbol || exported.name === symbol.name
                    ? [exported.name]
                    : [exported.name, symbol.name];
                records.push({
                    model: {
                        subpath,
                        name: exported.name,
                        symbol: this.symbolId(symbol),
                        aliases,
                    },
                    symbol,
                    declaration,
                    sourceFile,
                });
            }
        }
        const unique = uniqueBy(records, record => `${record.model.subpath}\0${record.model.name}`);
        this.collectCrossFaceReExports(registration, unique);
        return unique;
    }
    collectCrossFaceReExports(registration, records) {
        const publicSymbols = new Set(records.map(record => record.symbol));
        const entryFiles = uniqueBy(records, record => record.sourceFile.fileName).map(record => record.sourceFile);
        for (const sourceFile of this.reachableFiles(registration, entryFiles)) {
            for (const statement of sourceFile.statements) {
                if (!ts.isExportDeclaration(statement)
                    || statement.moduleSpecifier === undefined
                    || !ts.isStringLiteral(statement.moduleSpecifier))
                    continue;
                const module = moduleIdentity(statement.moduleSpecifier.text);
                if (module === undefined)
                    continue;
                const toFace = this.allRegistrations
                    .find(candidate => candidate.name === module.package && candidate.face !== this.face)?.face;
                if (toFace === undefined)
                    continue;
                if (statement.exportClause !== undefined && ts.isNamespaceExport(statement.exportClause)) {
                    const namespace = this.resolveSymbol(this.checker.getSymbolAtLocation(statement.exportClause.name));
                    if (publicSymbols.has(namespace)) {
                        this.fail(statement.exportClause, 'cross-face namespace re-exports are not supported');
                    }
                    continue;
                }
                const exports = statement.exportClause === undefined
                    ? this.moduleExports(statement.moduleSpecifier)
                        .map(symbol => ({ symbol: this.resolveSymbol(symbol), requestedName: symbol.name, site: statement }))
                    : statement.exportClause.elements.map(element => ({
                        symbol: this.resolveSymbol(this.checker.getSymbolAtLocation(element.name)),
                        requestedName: element.propertyName?.text ?? element.name.text,
                        site: element,
                    }));
                for (const exported of exports) {
                    if (!publicSymbols.has(exported.symbol))
                        continue;
                    const name = this.packageExportName(module, exported.symbol, toFace, exported.requestedName);
                    if (name === undefined) {
                        this.fail(exported.site, `cross-face re-export ${exported.requestedName} is not exported by ${module.package} at ${module.subpath}`);
                    }
                    this.recordCrossFaceLink(registration.name, toFace, module, name);
                }
            }
        }
    }
    moduleExports(moduleSpecifier) {
        /* v8 ignore next -- a semantically valid export declaration from a resolved module always has a module symbol. */
        const moduleSymbol = this.checker.getSymbolAtLocation(moduleSpecifier);
        return this.checker.getExportsOfModule(moduleSymbol);
    }
    reachableFiles(registration, entryFiles) {
        const reachable = new Map();
        const queue = [...entryFiles];
        while (queue.length > 0) {
            const sourceFile = queue.shift();
            const fileName = realPath(sourceFile.fileName);
            if (reachable.has(fileName) || !isWithin(fileName, registration.root))
                continue;
            reachable.set(fileName, sourceFile);
            for (const statement of sourceFile.statements) {
                if ((!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement))
                    || statement.moduleSpecifier === undefined
                    || !ts.isStringLiteral(statement.moduleSpecifier))
                    continue;
                const resolved = ts.resolveModuleName(statement.moduleSpecifier.text, sourceFile.fileName, this.program.getCompilerOptions(), ts.sys).resolvedModule;
                if (resolved === undefined)
                    continue;
                const resolvedPath = realPath(resolved.resolvedFileName);
                if (!isWithin(resolvedPath, registration.root))
                    continue;
                queue.push(this.sourceFiles.get(resolvedPath));
            }
        }
        return [...reachable.values()].sort((left, right) => left.fileName.localeCompare(right.fileName));
    }
    collectServices(context, records) {
        const bySymbol = new Map();
        for (const record of records) {
            const id = this.symbolId(record.symbol);
            const matches = bySymbol.get(id) ?? [];
            matches.push(record);
            bySymbol.set(id, matches);
        }
        const result = [];
        for (const member of context.members) {
            if (!ts.isPropertySignature(member) || member.type === undefined)
                continue;
            const symbol = this.symbolAtType(member.type);
            if (symbol === undefined)
                continue;
            const symbolId = this.symbolId(symbol);
            const exported = bySymbol.get(symbolId)?.find(record => record.model.name === symbol.name)
                ?? bySymbol.get(symbolId)?.find(record => record.model.name !== 'default')
                ?? bySymbol.get(symbolId)?.[0];
            if (exported === undefined)
                continue;
            const declaration = preferredDeclaration(symbol);
            if (declaration === undefined || (!ts.isClassDeclaration(declaration) && !ts.isInterfaceDeclaration(declaration))) {
                this.fail(member, `service ${memberName(member.name)} does not resolve to an exported class or interface`);
            }
            const model = this.ensureDeclaration(symbol, declaration);
            const exposed = model.members
                .filter(exposableMember)
                .map(publicMember => publicMember.id);
            result.push({
                ...documentationOf(declaration),
                key: memberName(member.name),
                symbol: symbolId,
                export: exported.model,
                members: exposed,
                location: this.location(member),
            });
        }
        return result;
    }
    collectEvents(events) {
        const result = [];
        for (const member of events.members) {
            const documentation = documentationOf(member);
            const mode = documentation.tags.find(tag => tag.name === 'mode')?.comment?.trim();
            if (ts.isMethodSignature(member)) {
                const signature = this.signature(member, member.type);
                result.push({
                    ...documentation,
                    name: memberName(member.name),
                    signature: this.addNode(member, { kind: 'function', signature }),
                    text: memberText(member),
                    ...(mode === undefined ? {} : { mode }),
                    location: this.location(member),
                });
            }
            else if (ts.isPropertySignature(member) && member.type !== undefined) {
                result.push({
                    ...documentation,
                    name: memberName(member.name),
                    signature: this.convertType(member.type),
                    text: memberText(member),
                    ...(mode === undefined ? {} : { mode }),
                    location: this.location(member),
                });
            }
        }
        return result;
    }
    ensureDeclaration(symbol, selected) {
        const resolved = this.resolveSymbol(symbol);
        const id = this.symbolId(resolved);
        const existing = this.declarations.get(id);
        if (existing !== undefined)
            return existing;
        const declarationParts = resolved.declarations.filter(isTypeDeclaration);
        if (declarationParts.length > 1 && !declarationParts.every(ts.isInterfaceDeclaration)) {
            this.fail(selected, `merged ${ts.SyntaxKind[selected.kind]} declaration ${resolved.name} is not supported`);
        }
        if (selected.name === undefined) {
            this.fail(selected, `anonymous ${ts.SyntaxKind[selected.kind]} cannot be represented as a named type declaration`);
        }
        const owner = this.registrationForFile(selected.getSourceFile().fileName);
        this.declarationStates.add(id);
        if (declarationParts.length > 1) {
            const analyzedParts = declarationParts.map((declarationPart) => {
                const part = declarationPart;
                const partOwner = this.registrationForFile(part.getSourceFile().fileName);
                if (partOwner === undefined) {
                    this.fail(part, `merged interface ${resolved.name} contains a declaration outside this face`);
                }
                const typeParameters = this.typeParameters(part.typeParameters);
                const heritage = this.heritage(part);
                const members = this.members(part.members, id);
                return {
                    typeParameters,
                    heritage,
                    members,
                    model: {
                        ...documentationOf(part),
                        package: partOwner.name,
                        location: this.location(part),
                        typeParameters,
                        extends: heritage.extends,
                        members: members.map(member => member.id),
                    },
                };
            });
            const parameters = this.mergeTypeParameters(analyzedParts.map(part => part.typeParameters), selected, resolved.name);
            const model = {
                ...documentationOf(selected),
                id,
                package: owner.name,
                name: declarationName(selected),
                kind: 'interface',
                abstract: false,
                exported: hasModifier(selected, ts.SyntaxKind.ExportKeyword),
                location: this.location(selected),
                text: declarationText(selected),
                typeParameters: parameters,
                extends: analyzedParts.flatMap(part => part.heritage.extends),
                implements: [],
                members: analyzedParts.flatMap(part => part.members),
                parts: analyzedParts.map(part => part.model),
            };
            this.declarations.set(id, model);
            this.declarationStates.delete(id);
            return model;
        }
        const parameters = ts.isEnumDeclaration(selected) ? [] : this.typeParameters(selected.typeParameters);
        const heritage = ts.isTypeAliasDeclaration(selected) || ts.isEnumDeclaration(selected)
            ? { extends: [], implements: [] }
            : this.heritage(selected);
        const kind = ts.isClassDeclaration(selected)
            ? 'class'
            : ts.isInterfaceDeclaration(selected)
                ? 'interface'
                : ts.isTypeAliasDeclaration(selected)
                    ? 'alias'
                    : 'enum';
        const model = {
            ...documentationOf(selected),
            id,
            package: owner.name,
            name: declarationName(selected),
            kind,
            abstract: hasModifier(selected, ts.SyntaxKind.AbstractKeyword),
            exported: hasModifier(selected, ts.SyntaxKind.ExportKeyword),
            location: this.location(selected),
            text: declarationText(selected),
            typeParameters: parameters,
            extends: heritage.extends,
            implements: heritage.implements,
            members: ts.isTypeAliasDeclaration(selected) || ts.isEnumDeclaration(selected)
                ? []
                : this.members(selected.members, id),
            ...(ts.isTypeAliasDeclaration(selected) ? { type: this.convertType(selected.type) } : {}),
            ...(ts.isEnumDeclaration(selected) ? { enumMembers: this.enumMembers(selected) } : {}),
        };
        this.declarations.set(id, model);
        this.declarationStates.delete(id);
        return model;
    }
    enumMembers(declaration) {
        return declaration.members.map(member => ({
            ...documentationOf(member),
            name: memberName(member.name),
            ...(member.initializer === undefined ? {} : { initializer: member.initializer.getText() }),
            location: this.location(member),
        }));
    }
    heritage(declaration) {
        const result = { extends: [], implements: [] };
        for (const clause of declaration.heritageClauses ?? []) {
            const target = clause.token === ts.SyntaxKind.ExtendsKeyword ? result.extends : result.implements;
            for (const type of clause.types)
                target.push(this.convertHeritage(type));
        }
        return result;
    }
    convertHeritage(node) {
        const symbol = this.checker.getSymbolAtLocation(node.expression);
        return this.addNode(node, {
            kind: 'reference',
            name: node.expression.getText(),
            target: this.targetForReference(this.resolveSymbol(symbol), node),
            arguments: node.typeArguments?.map(argument => this.convertType(argument)) ?? [],
        });
    }
    members(members, ownerId) {
        const result = [];
        for (const member of members) {
            const visibility = visibilityOf(member);
            const isStatic = hasModifier(member, ts.SyntaxKind.StaticKeyword);
            if (visibility !== 'public' || isStatic || ts.isConstructorDeclaration(member))
                continue;
            const base = this.memberBase(member, ownerId, visibility, isStatic);
            if (ts.isPropertySignature(member) || ts.isPropertyDeclaration(member)) {
                const type = this.requiredType(member, member.type, 'property');
                result.push({ ...base, kind: 'property', type: this.convertType(type) });
            }
            else if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) {
                result.push({ ...base, kind: 'method', signature: this.signature(member, member.type) });
            }
            else if (ts.isGetAccessorDeclaration(member)) {
                result.push({ ...base, kind: 'getter', signature: this.signature(member, member.type) });
            }
            else if (ts.isSetAccessorDeclaration(member)) {
                result.push({ ...base, kind: 'setter', signature: this.signature(member, member.type) });
            }
            else if (ts.isCallSignatureDeclaration(member)) {
                result.push({ ...base, kind: 'call', signature: this.signature(member, member.type) });
            }
            else if (ts.isConstructSignatureDeclaration(member)) {
                result.push({ ...base, kind: 'construct', signature: this.signature(member, member.type) });
            }
            else if (ts.isIndexSignatureDeclaration(member)) {
                result.push({ ...base, kind: 'index', signature: this.signature(member, member.type) });
            }
        }
        return result;
    }
    memberBase(member, ownerId, visibility, isStatic) {
        const name = member.name !== undefined
            ? memberName(member.name)
            : ts.isCallSignatureDeclaration(member)
                ? '(call)'
                : ts.isConstructSignatureDeclaration(member)
                    ? '(construct)'
                    : '(index)';
        return {
            ...documentationOf(member),
            id: `${ownerId}#${name}@${String(member.getStart())}`,
            name,
            optional: 'questionToken' in member && member.questionToken !== undefined,
            readonly: hasModifier(member, ts.SyntaxKind.ReadonlyKeyword),
            async: hasModifier(member, ts.SyntaxKind.AsyncKeyword),
            abstract: hasModifier(member, ts.SyntaxKind.AbstractKeyword),
            static: isStatic,
            visibility,
            location: this.location(member),
            text: memberText(member),
        };
    }
    signature(node, explicitReturn) {
        const parameters = node.parameters.map(parameter => ({
            name: memberName(parameter.name),
            binding: ts.isIdentifier(parameter.name)
                ? 'identifier'
                : ts.isObjectBindingPattern(parameter.name)
                    ? 'object'
                    : 'array',
            type: this.convertType(this.requiredType(parameter, parameter.type, 'parameter')),
            optional: parameter.questionToken !== undefined || parameter.initializer !== undefined,
            rest: parameter.dotDotDotToken !== undefined,
            receiver: ts.isIdentifier(parameter.name) && parameter.name.text === 'this',
            ...(parameter.initializer === undefined ? {} : { initializer: parameter.initializer.getText() }),
        }));
        return {
            typeParameters: this.typeParameters(node.typeParameters),
            parameters,
            returns: ts.isSetAccessorDeclaration(node)
                ? this.addNode(node, { kind: 'keyword', name: 'void' })
                : this.convertType(this.requiredType(node, explicitReturn, 'return')),
        };
    }
    typeParameters(parameters) {
        return parameters?.map(parameter => ({
            id: `${this.locationKey(parameter)}#${parameter.name.text}`,
            name: parameter.name.text,
            const: hasModifier(parameter, ts.SyntaxKind.ConstKeyword),
            ...(parameter.constraint === undefined ? {} : { constraint: this.convertType(parameter.constraint) }),
            ...(parameter.default === undefined ? {} : { default: this.convertType(parameter.default) }),
            ...(hasModifier(parameter, ts.SyntaxKind.InKeyword) && hasModifier(parameter, ts.SyntaxKind.OutKeyword)
                ? { variance: 'in-out' }
                : hasModifier(parameter, ts.SyntaxKind.InKeyword)
                    ? { variance: 'in' }
                    : hasModifier(parameter, ts.SyntaxKind.OutKeyword)
                        ? { variance: 'out' }
                        : {}),
        })) ?? [];
    }
    mergeTypeParameters(parts, site, declarationName) {
        const first = parts[0];
        return first.map((parameter, index) => {
            const peers = parts.map(part => part[index]);
            const constraint = peers.find(peer => peer.constraint !== undefined)?.constraint;
            const fallback = peers.find(peer => peer.default !== undefined)?.default;
            const variances = [...new Set(peers.flatMap(peer => peer.variance === undefined ? [] : [peer.variance]))];
            if (variances.length > 1) {
                this.fail(site, `merged interface ${declarationName} has incompatible variance modifiers`);
            }
            return {
                id: parameter.id,
                name: parameter.name,
                const: peers.some(peer => peer.const),
                ...(constraint === undefined ? {} : { constraint }),
                ...(fallback === undefined ? {} : { default: fallback }),
                ...(variances[0] === undefined ? {} : { variance: variances[0] }),
            };
        });
    }
    requiredType(owner, type, purpose) {
        if (type !== undefined)
            return type;
        if (this.mode === 'check') {
            this.fail(owner, `public ${purpose} is missing an explicit type annotation`);
        }
        const inferred = this.inferType(owner, purpose);
        const rendered = ts.createPrinter().printNode(ts.EmitHint.Unspecified, inferred, owner.getSourceFile());
        const position = annotationPosition(owner, purpose);
        this.queueEdit({ file: realPath(owner.getSourceFile().fileName), position, text: `: ${rendered}` });
        throw new SourceEditQueued();
    }
    inferType(owner, purpose) {
        let type;
        if (purpose === 'return') {
            const signature = this.checker.getSignatureFromDeclaration(owner);
            type = this.checker.getReturnTypeOfSignature(signature);
        }
        else {
            type = this.checker.getTypeAtLocation(owner);
        }
        return this.checker.typeToTypeNode(type, owner, ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.UseAliasDefinedOutsideCurrentScope);
    }
    convertType(node) {
        const id = this.allocateNodeId(node);
        const add = (model) => {
            this.nodes.set(id, { id, ...model });
            return id;
        };
        const keyword = keywordName(node.kind);
        if (keyword !== undefined)
            return add({ kind: 'keyword', name: keyword });
        if (ts.isParenthesizedTypeNode(node)) {
            return add({ kind: 'parenthesized', type: this.convertType(node.type) });
        }
        if (ts.isLiteralTypeNode(node))
            return add(literalModel(node));
        if (ts.isTypeReferenceNode(node)) {
            const symbol = this.checker.getSymbolAtLocation(node.typeName);
            return add({
                kind: 'reference',
                name: node.typeName.getText(),
                target: this.targetForReference(this.resolveSymbol(symbol), node),
                arguments: node.typeArguments?.map(argument => this.convertType(argument)) ?? [],
            });
        }
        if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
            return add({
                kind: ts.isUnionTypeNode(node) ? 'union' : 'intersection',
                types: node.types.map(type => this.convertType(type)),
            });
        }
        if (ts.isArrayTypeNode(node))
            return add({ kind: 'array', element: this.convertType(node.elementType) });
        if (ts.isTupleTypeNode(node)) {
            return add({
                kind: 'tuple',
                elements: node.elements.map((element) => {
                    const named = ts.isNamedTupleMember(element) ? element : undefined;
                    const raw = named?.type ?? element;
                    const optional = named?.questionToken !== undefined || ts.isOptionalTypeNode(raw);
                    const rest = named?.dotDotDotToken !== undefined || ts.isRestTypeNode(raw);
                    const type = ts.isOptionalTypeNode(raw) || ts.isRestTypeNode(raw) ? raw.type : raw;
                    return {
                        ...(named === undefined ? {} : { name: named.name.text }),
                        type: this.convertType(type),
                        optional,
                        rest,
                    };
                }),
            });
        }
        if (ts.isTypeLiteralNode(node))
            return add({ kind: 'object', members: this.members(node.members, id) });
        if (ts.isFunctionTypeNode(node)) {
            return add({ kind: 'function', signature: this.signature(node, node.type) });
        }
        if (ts.isConstructorTypeNode(node)) {
            return add({
                kind: 'constructor',
                abstract: hasModifier(node, ts.SyntaxKind.AbstractKeyword),
                signature: this.signature(node, node.type),
            });
        }
        if (ts.isIndexedAccessTypeNode(node)) {
            return add({
                kind: 'indexed-access',
                object: this.convertType(node.objectType),
                index: this.convertType(node.indexType),
            });
        }
        if (ts.isTypeOperatorNode(node)) {
            return add({
                kind: 'operator',
                operator: ts.tokenToString(node.operator),
                type: this.convertType(node.type),
            });
        }
        if (ts.isConditionalTypeNode(node)) {
            return add({
                kind: 'conditional',
                check: this.convertType(node.checkType),
                extends: this.convertType(node.extendsType),
                whenTrue: this.convertType(node.trueType),
                whenFalse: this.convertType(node.falseType),
            });
        }
        if (ts.isInferTypeNode(node)) {
            return add({ kind: 'infer', parameter: this.typeParameters(ts.factory.createNodeArray([node.typeParameter]))[0] });
        }
        if (ts.isMappedTypeNode(node)) {
            const parameter = this.typeParameters(ts.factory.createNodeArray([node.typeParameter]))[0];
            return add({
                kind: 'mapped',
                parameter,
                ...(node.nameType === undefined ? {} : { nameType: this.convertType(node.nameType) }),
                ...(node.type === undefined ? {} : { value: this.convertType(node.type) }),
                readonly: modifierMode(node.readonlyToken),
                optional: modifierMode(node.questionToken),
            });
        }
        if (ts.isTemplateLiteralTypeNode(node)) {
            return add({
                kind: 'template-literal',
                head: node.head.text,
                spans: node.templateSpans.map(span => ({ type: this.convertType(span.type), text: span.literal.text })),
            });
        }
        if (ts.isTypeQueryNode(node)) {
            return add({
                kind: 'type-query',
                expression: node.exprName.getText(),
                arguments: node.typeArguments?.map(argument => this.convertType(argument)) ?? [],
            });
        }
        if (ts.isImportTypeNode(node)) {
            const argument = node.argument;
            const symbol = node.qualifier === undefined ? undefined : this.checker.getSymbolAtLocation(node.qualifier);
            return add({
                kind: 'import-type',
                module: argument.literal.text,
                ...(node.qualifier === undefined ? {} : { qualifier: node.qualifier.getText() }),
                arguments: node.typeArguments?.map(argument => this.convertType(argument)) ?? [],
                typeof: node.isTypeOf,
                ...(node.attributes === undefined ? {} : { attributes: importTypeAttributesText(node) }),
                ...(symbol === undefined ? {} : { target: this.targetForReference(this.resolveSymbol(symbol), node) }),
            });
        }
        if (ts.isTypePredicateNode(node)) {
            return add({
                kind: 'predicate',
                asserts: node.assertsModifier !== undefined,
                parameter: node.parameterName.getText(),
                ...(node.type === undefined ? {} : { type: this.convertType(node.type) }),
            });
        }
        /* v8 ignore else -- every source TypeNode kind accepted by TypeScript is handled above; this arm keeps
         * future compiler kinds fail-loud. */
        if (ts.isThisTypeNode(node))
            return add({ kind: 'this' });
        /* v8 ignore next -- paired with the exhaustive TypeNode guard above. */
        this.fail(node, `unsupported TypeScript type node ${ts.SyntaxKind[node.kind]}`);
    }
    addNode(site, model) {
        const id = this.allocateNodeId(site);
        this.nodes.set(id, { id, ...model });
        return id;
    }
    referenceNode(symbol, site) {
        return this.addNode(site, {
            kind: 'reference',
            name: symbol.name,
            target: { kind: 'declaration', symbol: this.symbolId(symbol) },
            arguments: [],
        });
    }
    targetForReference(symbol, site) {
        const declaration = preferredDeclaration(symbol);
        /* v8 ignore next -- a symbol from a semantically valid source type reference always has a declaration. */
        if (declaration === undefined)
            this.fail(site, `type symbol ${symbol.name} has no declaration`);
        if (ts.isTypeParameterDeclaration(declaration)) {
            return {
                kind: 'type-parameter',
                parameter: `${this.locationKey(declaration)}#${declaration.name.text}`,
            };
        }
        if (isStandardLibraryFile(declaration.getSourceFile().fileName)) {
            return { kind: 'standard', name: symbol.name };
        }
        const moduleSpecifier = moduleSpecifierOf(site);
        const module = moduleSpecifier === undefined ? undefined : moduleIdentity(moduleSpecifier);
        const from = this.registrationForFile(site.getSourceFile().fileName);
        const owner = this.registrationForFile(declaration.getSourceFile().fileName);
        if (owner !== undefined) {
            if (owner.name !== from.name) {
                if (module === undefined) {
                    this.fail(site, `reference to ${symbol.name} crosses a package without an explicit package import`);
                }
                const exportName = authoredExportName(site, moduleSpecifier);
                if (this.packageExportName(module, symbol, owner.face, exportName) === undefined) {
                    this.fail(site, `package reference ${exportName} is not exported by ${module.package} at ${module.subpath}`);
                }
            }
            const typeDeclaration = declaration;
            if (!this.declarationStates.has(this.symbolId(symbol)))
                this.ensureDeclaration(symbol, typeDeclaration);
            return { kind: 'declaration', symbol: this.symbolId(symbol) };
        }
        const packageFaces = module === undefined
            ? []
            : [...new Set(this.allRegistrations.filter(candidate => candidate.name === module.package).map(candidate => candidate.face))];
        const otherFace = packageFaces.find(face => face !== this.face);
        if (otherFace !== undefined && module !== undefined) {
            const requestedName = authoredExportName(site, moduleSpecifier);
            const exportName = this.packageExportName(module, symbol, otherFace, requestedName);
            if (exportName === undefined) {
                this.fail(site, `cross-face reference ${requestedName} is not exported by ${module.package} at ${module.subpath}`);
            }
            this.recordCrossFaceLink(from.name, otherFace, module, exportName);
            return {
                kind: 'cross-face',
                face: otherFace,
                package: module.package,
                subpath: module.subpath,
                name: exportName,
            };
        }
        if (module !== undefined) {
            return {
                kind: 'external',
                module: module.package,
                subpath: module.subpath,
                name: symbol.name,
            };
        }
        const external = externalModuleIdentityForFile(declaration.getSourceFile().fileName);
        if (external !== undefined) {
            return {
                kind: 'external',
                module: external.package,
                subpath: external.subpath,
                name: symbol.name,
            };
        }
        this.fail(site, `reference to ${symbol.name} crosses a package or face without an explicit import`);
    }
    recordCrossFaceLink(fromPackage, toFace, module, name) {
        const link = {
            fromFace: this.face,
            fromPackage,
            toFace,
            toPackage: module.package,
            subpath: module.subpath,
            name,
        };
        const key = [
            link.fromFace,
            link.fromPackage,
            link.toFace,
            link.toPackage,
            link.subpath,
            link.name,
        ].join('\0');
        this.crossFaceLinks.set(key, link);
    }
    packageExportName(module, symbol, face, requestedName) {
        const registration = this.allRegistrations.find(candidate => candidate.face === face && candidate.name === module.package);
        const target = packageExportTargets(registration.manifest)
            .find(([subpath]) => subpath === module.subpath)?.[1];
        if (target === undefined)
            return undefined;
        const sourceFile = this.sourceFiles.get(realPath(sourcePathForExport(registration.root, target)));
        const moduleSymbol = this.checker.getSymbolAtLocation(sourceFile);
        const exported = this.checker.getExportsOfModule(moduleSymbol)
            .find(candidate => candidate.name === requestedName && this.resolveSymbol(candidate) === symbol);
        return exported?.name;
    }
    symbolAtType(node) {
        if (ts.isTypeReferenceNode(node)) {
            return this.resolveSymbol(this.checker.getSymbolAtLocation(node.typeName));
        }
        const type = this.checker.getTypeAtLocation(node);
        const symbol = type.aliasSymbol ?? type.getSymbol();
        return symbol === undefined ? undefined : this.resolveSymbol(symbol);
    }
    resolveSymbol(symbol) {
        return (symbol.flags & ts.SymbolFlags.Alias) === 0 ? symbol : this.checker.getAliasedSymbol(symbol);
    }
    symbolId(symbol) {
        const declaration = preferredDeclaration(symbol);
        if (declaration === undefined)
            return `symbol:${symbol.name}`;
        const location = this.location(declaration);
        return `${this.packageNameForFile(declaration.getSourceFile().fileName)}:${location.file}#${symbol.name}`;
    }
    registrationForFile(file) {
        const path = realPath(file);
        return this.allRegistrations
            .find(registration => registration.face === this.face && isWithin(path, registration.root));
    }
    packageNameForFile(file) {
        const path = realPath(file);
        return this.allRegistrations.find(registration => isWithin(path, registration.root))?.name ?? '<external>';
    }
    allocateNodeId(site) {
        const location = this.locationKey(site);
        const ordinal = (this.nodeOrdinals.get(location) ?? 0) + 1;
        this.nodeOrdinals.set(location, ordinal);
        return `type:${location}#${String(ordinal)}`;
    }
    locationKey(node) {
        const location = this.location(node);
        return `${location.file}:${String(location.line)}:${String(location.column)}`;
    }
    location(node) {
        const sourceFile = node.getSourceFile();
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        return {
            file: slash(relative(this.root, sourceFile.fileName)),
            line: position.line + 1,
            column: position.character + 1,
        };
    }
    fail(node, message) {
        const location = this.location(node);
        throw new TypertAnalysisError(`typert(${this.face}): ${location.file}:${String(location.line)}:${String(location.column)}: ${message}`);
    }
}
function mergeWorkspaceModels(models) {
    const faces = new Map();
    const links = new Map();
    for (const model of models) {
        for (const face of model.faces) {
            const merged = faces.get(face.face) ?? {
                packages: new Map(),
                declarations: new Map(),
                nodes: new Map(),
            };
            for (const packageModel of face.packages)
                merged.packages.set(packageModel.name, packageModel);
            for (const declaration of face.graph.declarations) {
                if (!merged.declarations.has(declaration.id))
                    merged.declarations.set(declaration.id, declaration);
            }
            for (const node of face.graph.nodes) {
                if (!merged.nodes.has(node.id))
                    merged.nodes.set(node.id, node);
            }
            faces.set(face.face, merged);
        }
        for (const link of model.crossFaceLinks) {
            links.set([
                link.fromFace,
                link.fromPackage,
                link.toFace,
                link.toPackage,
                link.subpath,
                link.name,
            ].join('\0'), link);
        }
    }
    return {
        faces: [...faces].sort(([left], [right]) => (left === 'host' ? 0 : 1) - (right === 'host' ? 0 : 1)).map(([face, model]) => ({
            face,
            packages: [...model.packages.values()].sort((left, right) => left.name.localeCompare(right.name)),
            graph: {
                declarations: [...model.declarations.values()].sort((left, right) => left.id.localeCompare(right.id)),
                nodes: [...model.nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
            },
        })),
        crossFaceLinks: [...links.values()].sort(compareCrossFaceLinks),
    };
}
function parseConfig(path) {
    const read = ts.readConfigFile(path, file => ts.sys.readFile(file));
    if (read.error !== undefined)
        throw new TypertAnalysisError(formatDiagnostic(read.error));
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(path), undefined, path);
    if (parsed.errors.length > 0)
        throw new TypertAnalysisError(parsed.errors.map(formatDiagnostic).join('\n'));
    return { path, parsed };
}
function projectConfigPath(path) {
    if (extname(path) === '.json')
        return path;
    return join(path, 'tsconfig.json');
}
function sourceFileHasSurface(sourceFile) {
    for (const statement of sourceFile.statements) {
        if ((ts.isClassDeclaration(statement)
            || ts.isInterfaceDeclaration(statement)
            || ts.isTypeAliasDeclaration(statement)
            || ts.isEnumDeclaration(statement))
            && typertMode(statement) !== undefined)
            return true;
        if (!ts.isModuleDeclaration(statement)
            || !ts.isStringLiteral(statement.name)
            || statement.name.text !== 'cordis'
            || statement.body === undefined
            || !ts.isModuleBlock(statement.body))
            continue;
        if (statement.body.statements.some(member => ts.isInterfaceDeclaration(member)
            && (member.name.text === 'Context' || member.name.text === 'Events')
            && member.members.length > 0))
            return true;
    }
    return false;
}
function hasPackageSurface(model) {
    return model.services.length > 0
        || model.events.length > 0
        || model.objects.length > 0
        || model.schemas.length > 0;
}
function isDualFacePackage(manifest) {
    return manifest.dshClient !== null
        && typeof manifest.dshClient === 'object'
        && clientExportSubpaths(manifest).length > 0;
}
function hostExportSubpaths(manifest) {
    return packageExportTargets(manifest)
        .map(([subpath]) => subpath)
        .filter(subpath => subpath !== './client' && !subpath.startsWith('./client/'));
}
function clientExportSubpaths(manifest) {
    return packageExportTargets(manifest)
        .map(([subpath]) => subpath)
        .filter(subpath => subpath === './client' || subpath.startsWith('./client/'));
}
function packageExportTargets(manifest) {
    const exportsField = manifest.exports;
    if (typeof exportsField === 'string')
        return [['.', exportsField]];
    if (exportsField === null || typeof exportsField !== 'object') {
        const types = manifest.types;
        return typeof types === 'string' ? [['.', types]] : [];
    }
    if (Array.isArray(exportsField)
        || !Object.keys(exportsField).some(key => key.startsWith('.'))) {
        const target = exportTarget(exportsField);
        return target === undefined ? [] : [['.', target]];
    }
    const result = [];
    for (const [subpath, value] of Object.entries(exportsField)) {
        if (!subpath.startsWith('.'))
            continue;
        const target = exportTarget(value);
        if (target !== undefined)
            result.push([subpath, target]);
    }
    return result.sort(([left], [right]) => left.localeCompare(right));
}
function exportTarget(value) {
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value)) {
        for (const candidate of value) {
            const target = exportTarget(candidate);
            if (target !== undefined)
                return target;
        }
        return undefined;
    }
    if (value === null || typeof value !== 'object')
        return undefined;
    const conditions = value;
    for (const key of ['types', 'import', 'default']) {
        const target = exportTarget(conditions[key]);
        if (target !== undefined)
            return target;
    }
    for (const candidate of Object.values(conditions)) {
        const target = exportTarget(candidate);
        if (target !== undefined)
            return target;
    }
    return undefined;
}
function sourcePathForExport(packageRoot, target) {
    const normalized = target.replace(/^\.\//, '');
    if (normalized.startsWith('lib/types/')) {
        return resolve(packageRoot, 'src', normalized.slice('lib/types/'.length).replace(/\.d\.(?:mts|cts|ts)$/, '.ts'));
    }
    if (normalized.startsWith('lib/')) {
        return resolve(packageRoot, 'src', normalized.slice('lib/'.length).replace(/\.(?:mjs|cjs|js|d\.ts)$/, '.ts'));
    }
    return resolve(packageRoot, normalized);
}
function preferredDeclaration(symbol) {
    return symbol.declarations?.find(isTypeDeclaration)
        ?? symbol.valueDeclaration
        ?? symbol.declarations?.[0];
}
function isTypeDeclaration(node) {
    return ts.isClassDeclaration(node)
        || ts.isInterfaceDeclaration(node)
        || ts.isTypeAliasDeclaration(node)
        || ts.isEnumDeclaration(node);
}
function declarationName(declaration) {
    return declaration.name.text;
}
function memberText(member) {
    const sourceFile = member.getSourceFile();
    const full = member.getText(sourceFile);
    const body = member.body;
    const signature = body === undefined ? full : full.slice(0, full.length - body.getText(sourceFile).length);
    return signature.replace(/\s*;?\s*$/, '').replace(/\s+/g, ' ').trim();
}
function declarationText(declaration) {
    const printer = ts.createPrinter({ removeComments: true });
    const projected = ts.isClassDeclaration(declaration) ? classShape(declaration) : declaration;
    return printer.printNode(ts.EmitHint.Unspecified, projected, declaration.getSourceFile()).replace(/\r/g, '');
}
function classShape(node) {
    const nonPublic = (member) => (ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined)?.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword) ?? false;
    const members = node.members.flatMap((member) => {
        if (nonPublic(member) || (ts.isPropertyDeclaration(member) && ts.isPrivateIdentifier(member.name)))
            return [];
        if (ts.isMethodDeclaration(member)) {
            return [ts.factory.updateMethodDeclaration(member, member.modifiers, member.asteriskToken, member.name, member.questionToken, member.typeParameters, member.parameters, member.type, undefined)];
        }
        if (ts.isConstructorDeclaration(member)) {
            return [ts.factory.updateConstructorDeclaration(member, member.modifiers, member.parameters, undefined)];
        }
        if (ts.isGetAccessorDeclaration(member)) {
            return [ts.factory.updateGetAccessorDeclaration(member, member.modifiers, member.name, member.parameters, member.type, undefined)];
        }
        if (ts.isSetAccessorDeclaration(member)) {
            return [ts.factory.updateSetAccessorDeclaration(member, member.modifiers, member.name, member.parameters, undefined)];
        }
        if (ts.isPropertyDeclaration(member)) {
            return [ts.factory.updatePropertyDeclaration(member, member.modifiers, member.name, member.questionToken ?? member.exclamationToken, member.type, undefined)];
        }
        return [member];
    });
    return ts.factory.updateClassDeclaration(node, node.modifiers, node.name, node.typeParameters, node.heritageClauses, members);
}
function documentationOf(node) {
    const blocks = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
    const block = blocks.at(-1);
    if (block === undefined)
        return EMPTY_DOCUMENTATION;
    const description = normalizedDocText(ts.getTextOfJSDocComment(block.comment));
    const tags = ts.getJSDocTags(node).map((tag) => {
        const named = tag;
        const comment = normalizedDocText(ts.getTextOfJSDocComment(tag.comment));
        return {
            name: tag.tagName.text,
            ...(named.name === undefined ? {} : { argument: named.name.getText() }),
            ...(comment === undefined ? {} : { comment }),
            text: tag.getText(tag.getSourceFile()).trim(),
        };
    });
    return {
        ...(description === undefined ? {} : {
            description,
            summary: firstSentence(description),
        }),
        tags,
        jsDoc: rawJsDoc(node),
    };
}
function normalizedDocText(value) {
    if (value === undefined)
        return undefined;
    const normalized = value.replace(/\s+/g, ' ').trim();
    /* v8 ignore next -- TypeScript represents whitespace-only JSDoc as undefined before this helper is called. */
    return normalized.length === 0 ? undefined : normalized;
}
function firstSentence(value) {
    return (/^(.*?[.!?])(?:\s|$)/.exec(value)?.[1] ?? value).trim();
}
function rawJsDoc(node) {
    const sourceFile = node.getSourceFile();
    const source = sourceFile.getFullText();
    const ranges = ts.getLeadingCommentRanges(source, node.getFullStart());
    const range = ranges.filter(candidate => source.slice(candidate.pos, candidate.pos + 3) === '/**').at(-1);
    const raw = source.slice(range.pos, range.end);
    const { line } = sourceFile.getLineAndCharacterOfPosition(range.pos);
    const lineStart = sourceFile.getPositionOfLineAndCharacter(line, 0);
    const indent = source.slice(lineStart, range.pos);
    return raw.split('\n')
        .map((text, index) => index > 0 && text.startsWith(indent) ? text.slice(indent.length) : text)
        .join('\n');
}
function typertMode(node) {
    for (const tag of ts.getJSDocTags(node)) {
        if (tag.tagName.text !== 'typert')
            continue;
        const mode = (ts.getTextOfJSDocComment(tag.comment) ?? '').trim().split(/\s+/, 1)[0];
        if (mode === 'object')
            return 'object';
        if (mode === '' || mode === 'schema' || mode === 'type')
            return 'schema';
    }
    return undefined;
}
function memberName(name) {
    if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name)
        || ts.isNumericLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name))
        return name.text;
    if (ts.isComputedPropertyName(name))
        return `[${name.expression.getText()}]`;
    return name.getText();
}
function visibilityOf(node) {
    if ('name' in node && node.name !== undefined && ts.isPrivateIdentifier(node.name))
        return 'private';
    if (hasModifier(node, ts.SyntaxKind.PrivateKeyword))
        return 'private';
    if (hasModifier(node, ts.SyntaxKind.ProtectedKeyword))
        return 'protected';
    return 'public';
}
function hasModifier(node, kind) {
    return (ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)?.some(modifier => modifier.kind === kind) ?? false;
}
function exposableMember(member) {
    return member.visibility === 'public' && !member.static;
}
function keywordName(kind) {
    switch (kind) {
        case ts.SyntaxKind.AnyKeyword: return 'any';
        case ts.SyntaxKind.BigIntKeyword: return 'bigint';
        case ts.SyntaxKind.BooleanKeyword: return 'boolean';
        case ts.SyntaxKind.NeverKeyword: return 'never';
        case ts.SyntaxKind.NumberKeyword: return 'number';
        case ts.SyntaxKind.ObjectKeyword: return 'object';
        case ts.SyntaxKind.StringKeyword: return 'string';
        case ts.SyntaxKind.SymbolKeyword: return 'symbol';
        case ts.SyntaxKind.UndefinedKeyword: return 'undefined';
        case ts.SyntaxKind.UnknownKeyword: return 'unknown';
        case ts.SyntaxKind.VoidKeyword: return 'void';
        default: return undefined;
    }
}
function literalModel(node) {
    const literal = node.literal;
    if (ts.isStringLiteral(literal))
        return { kind: 'literal', value: literal.text, text: literal.getText() };
    if (ts.isNoSubstitutionTemplateLiteral(literal)) {
        return { kind: 'literal', value: literal.text, text: literal.getText() };
    }
    if (ts.isNumericLiteral(literal))
        return { kind: 'literal', value: Number(literal.text), text: literal.getText() };
    if (ts.isBigIntLiteral(literal))
        return { kind: 'literal', value: BigInt(literal.text.slice(0, -1)), text: literal.getText() };
    if (literal.kind === ts.SyntaxKind.TrueKeyword)
        return { kind: 'literal', value: true, text: 'true' };
    if (literal.kind === ts.SyntaxKind.FalseKeyword)
        return { kind: 'literal', value: false, text: 'false' };
    if (literal.kind === ts.SyntaxKind.NullKeyword)
        return { kind: 'literal', value: null, text: 'null' };
    /* v8 ignore else -- all remaining LiteralTypeNode syntax is a signed numeric or bigint literal. */
    if (ts.isPrefixUnaryExpression(literal)
        && (ts.isNumericLiteral(literal.operand) || ts.isBigIntLiteral(literal.operand))) {
        return {
            kind: 'literal',
            value: ts.isBigIntLiteral(literal.operand)
                ? BigInt(literal.getText().slice(0, -1))
                : Number(literal.getText()),
            text: literal.getText(),
        };
    }
    /* v8 ignore next -- TypeScript's LiteralTypeNode grammar is exhausted above; this contains future compiler syntax. */
    throw new TypertAnalysisError(`typert: unsupported literal type ${literal.getText()}`);
}
function modifierMode(token) {
    if (token?.kind === ts.SyntaxKind.PlusToken)
        return 'add';
    if (token?.kind === ts.SyntaxKind.MinusToken)
        return 'remove';
    return token === undefined ? 'preserve' : 'add';
}
function annotationPosition(node, purpose) {
    if (purpose === 'return')
        return node.parameters.end + 1;
    return node.name.end;
}
function moduleSpecifierOf(node) {
    if (ts.isImportTypeNode(node)) {
        const argument = node.argument;
        return argument.literal.text;
    }
    const symbol = ts.isTypeReferenceNode(node)
        ? node.typeName
        : node.expression;
    const sourceFile = node.getSourceFile();
    const first = ts.isIdentifier(symbol) ? symbol.text : symbol.getFirstToken(sourceFile)?.getText(sourceFile);
    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement) || statement.importClause === undefined
            || !ts.isStringLiteral(statement.moduleSpecifier))
            continue;
        if (statement.importClause.name?.text === first)
            return statement.moduleSpecifier.text;
        const bindings = statement.importClause.namedBindings;
        if (bindings !== undefined && ts.isNamespaceImport(bindings) && bindings.name.text === first) {
            return statement.moduleSpecifier.text;
        }
        if (bindings !== undefined && ts.isNamedImports(bindings)
            && bindings.elements.some(element => element.name.text === first))
            return statement.moduleSpecifier.text;
    }
    return undefined;
}
function authoredExportName(node, moduleSpecifier) {
    if (ts.isImportTypeNode(node))
        return node.qualifier.getText().split('.')[0];
    const referenced = ts.isTypeReferenceNode(node)
        ? node.typeName.getText().split('.')
        : node.expression.getText().split('.');
    const localName = referenced[0];
    for (const statement of node.getSourceFile().statements) {
        if (!ts.isImportDeclaration(statement)
            || statement.importClause === undefined
            || !ts.isStringLiteral(statement.moduleSpecifier)
            || statement.moduleSpecifier.text !== moduleSpecifier)
            continue;
        if (statement.importClause.name?.text === localName)
            return 'default';
        const bindings = statement.importClause.namedBindings;
        if (bindings !== undefined && ts.isNamedImports(bindings)) {
            const imported = bindings.elements.find(element => element.name.text === localName);
            if (imported !== undefined)
                return imported.propertyName?.text ?? imported.name.text;
        }
        if (bindings !== undefined && ts.isNamespaceImport(bindings) && bindings.name.text === localName) {
            return referenced[1];
        }
    }
    /* v8 ignore next -- moduleSpecifierOf returns only the matching import inspected by this loop. */
    throw new TypertAnalysisError(`typert: cannot recover export name for ${localName} from ${moduleSpecifier}`);
}
function importTypeAttributesText(node) {
    const sourceFile = node.getSourceFile();
    const children = node.getChildren(sourceFile);
    const comma = children.find(child => child.kind === ts.SyntaxKind.CommaToken);
    const close = children.find(child => child.kind === ts.SyntaxKind.CloseParenToken);
    return sourceFile.text.slice(comma.end, close.pos).trim();
}
function moduleIdentity(specifier) {
    if (specifier.startsWith('.') || specifier.startsWith('/'))
        return undefined;
    const parts = specifier.split('/');
    const packageLength = specifier.startsWith('@') ? 2 : 1;
    const packageName = parts.slice(0, packageLength).join('/');
    const rest = parts.slice(packageLength).join('/');
    return {
        package: packageName,
        subpath: rest.length === 0 ? '.' : `./${rest}`,
    };
}
function externalModuleIdentityForFile(file) {
    const normalized = slash(file);
    const marker = '/node_modules/';
    const index = normalized.lastIndexOf(marker);
    if (index < 0)
        return undefined;
    const parts = normalized.slice(index + marker.length).split('/');
    const packageLength = parts[0].startsWith('@') ? 2 : 1;
    const packageName = parts.slice(0, packageLength).join('/');
    return { package: packageName, subpath: '.' };
}
function isStandardLibraryFile(file) {
    const base = file.replaceAll('\\', '/');
    return /\/typescript\/lib\/lib\.[^/]+\.d\.ts$/.test(base);
}
function formatDiagnostic(diagnostic) {
    return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
}
function formatProgramDiagnostic(root, face, diagnostic) {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    const file = slash(relative(root, diagnostic.file.fileName));
    return `typert(${face}): ${file}:${String(position.line + 1)}:${String(position.character + 1)}: TypeScript TS${String(diagnostic.code)}: ${message}`;
}
const realPathCache = new Map();
function realPath(path) {
    const absolute = resolve(path);
    const cached = realPathCache.get(absolute);
    if (cached !== undefined)
        return cached;
    // Only existing paths are memoized: a path can come into existence later,
    // but an existing path's canonical form is stable for the process lifetime
    // (analysis edits rewrite file contents, never the directory tree).
    if (!existsSync(absolute))
        return absolute;
    const resolved = realpathSync(absolute);
    realPathCache.set(absolute, resolved);
    return resolved;
}
function isWithin(path, root) {
    const absolute = realPath(path);
    const parent = realPath(root);
    return absolute === parent || absolute.startsWith(parent + sep);
}
function slash(value) {
    return value.replaceAll('\\', '/');
}
function uniqueBy(values, key) {
    const result = new Map();
    for (const value of values)
        if (!result.has(key(value)))
            result.set(key(value), value);
    return [...result.values()];
}
function compareCrossFaceLinks(left, right) {
    return left.fromFace.localeCompare(right.fromFace)
        || left.fromPackage.localeCompare(right.fromPackage)
        || left.toFace.localeCompare(right.toFace)
        || left.toPackage.localeCompare(right.toPackage)
        || left.subpath.localeCompare(right.subpath)
        || left.name.localeCompare(right.name);
}
//# sourceMappingURL=analyzer.js.map