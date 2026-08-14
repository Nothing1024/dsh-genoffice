import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
//#region lib/types/analyzer.js
/**
* TypeScript project analyzer for the compiler-independent Typert model.
* Programs, symbols, and syntax nodes remain extraction-only implementation
* details; callers receive only the model declared in {@link ./model.ts}.
* @module @deepseek-ai/dsh-typert-generator/analyzer
*/
/** Analysis failure with a source-oriented diagnostic. */
var TypertAnalysisError = class extends Error {
	name = "TypertAnalysisError";
};
var SourceEditQueued = class extends Error {};
const EMPTY_DOCUMENTATION = { tags: [] };
/**
* Process-wide parse cache for the bundled TypeScript default libraries.
* `typescript/lib/lib.*.d.ts` content is immutable for the process lifetime,
* so parses are shared across every {@link WorkspaceCaches} instance; the key
* carries the parse-affecting settings, keeping reuse exact.
*/
const defaultLibraryParses = /* @__PURE__ */ new Map();
function defaultLibraryKey(fileName, languageVersionOrOptions) {
	const options = typeof languageVersionOrOptions === "object" ? languageVersionOrOptions : { languageVersion: languageVersionOrOptions };
	return [
		fileName,
		String(options.languageVersion),
		String(options.impliedNodeFormat ?? ""),
		String(options.jsDocParsingMode ?? "")
	].join("\0");
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
var WorkspaceCaches = class {
	/** Parsed tsconfig files by absolute config path. */
	configs = /* @__PURE__ */ new Map();
	/** Registration inventories keyed by root and aggregate config paths. */
	registrations = /* @__PURE__ */ new Map();
	hosts = /* @__PURE__ */ new Map();
	/**
	* Parse one tsconfig once per workspace snapshot.
	* @param path - absolute config path.
	* @returns the memoized parse result.
	*/
	config(path) {
		let parsed = this.configs.get(path);
		if (parsed === void 0) {
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
		if (entry === void 0) {
			const host = ts.createCompilerHost(options);
			const files = /* @__PURE__ */ new Map();
			const resolutionCache = ts.createModuleResolutionCache(host.getCurrentDirectory(), (fileName) => host.getCanonicalFileName(fileName), options);
			const base = host.getSourceFile.bind(host);
			host.getSourceFile = (fileName, languageVersionOrOptions, onError) => {
				if (isStandardLibraryFile(fileName)) {
					const key = defaultLibraryKey(fileName, languageVersionOrOptions);
					if (!defaultLibraryParses.has(key)) defaultLibraryParses.set(key, base(fileName, languageVersionOrOptions, onError));
					return defaultLibraryParses.get(key);
				}
				if (!files.has(fileName)) files.set(fileName, base(fileName, languageVersionOrOptions, onError));
				return files.get(fileName);
			};
			host.getModuleResolutionCache = () => resolutionCache;
			entry = {
				host,
				files
			};
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
		for (const { files } of this.hosts.values()) for (const key of [...files.keys()]) if (realPath(key) === target) files.delete(key);
	}
};
/** Analyze host and client as independent TypeScript programs. */
var WorkspaceAnalyzer = class WorkspaceAnalyzer {
	options;
	queuedEdit;
	crossFaceLinks = /* @__PURE__ */ new Map();
	checkedProjects = /* @__PURE__ */ new Set();
	registrations = [];
	caches;
	constructor(options) {
		this.options = {
			root: resolve(options.root),
			hostConfig: options.hostConfig ?? "tsconfig.host.json",
			clientConfig: options.clientConfig ?? "tsconfig.client.json",
			faces: options.faces ?? ["host", "client"],
			checkDiagnostics: options.checkDiagnostics ?? true,
			mode: options.mode ?? "check",
			...options.packages === void 0 ? {} : { packages: options.packages }
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
		const selected = this.options.packages === void 0 ? void 0 : new Set(this.options.packages);
		const faces = [];
		try {
			for (const face of this.options.faces) {
				const registrations = this.registrations.filter((registration) => registration.face === face && (selected === void 0 || selected.has(registration.name)));
				if (registrations.length === 0) continue;
				if (this.options.checkDiagnostics) for (const registration of registrations) this.checkProject(registration);
				const aggregatePath = resolve(this.options.root, face === "host" ? this.options.hostConfig : this.options.clientConfig);
				const aggregate = this.caches.config(aggregatePath);
				const rootNames = [...new Set(registrations.flatMap((registration) => registration.config.parsed.fileNames))];
				const options = {
					...aggregate.parsed.options,
					composite: false,
					incremental: false,
					noEmit: true
				};
				const program = ts.createProgram({
					rootNames,
					options,
					host: this.caches.programHost(face, options)
				});
				faces.push(new FaceAnalyzer({
					root: this.options.root,
					face,
					program,
					registrations,
					allRegistrations: this.registrations,
					mode: this.options.mode,
					queueEdit: (edit) => {
						this.queueEdit(edit);
					},
					crossFaceLinks: this.crossFaceLinks
				}).analyze());
			}
		} catch (error) {
			if (!(error instanceof SourceEditQueued) || this.options.mode !== "write" || this.queuedEdit === void 0) throw error;
		}
		if (this.queuedEdit !== void 0) {
			this.applyEdit(this.queuedEdit);
			return new WorkspaceAnalyzer({
				...this.options,
				caches: this.caches,
				mode: "write"
			}).analyze();
		}
		if (this.options.mode === "write") return new WorkspaceAnalyzer({
			...this.options,
			caches: this.caches,
			mode: "check"
		}).analyze();
		return {
			faces,
			crossFaceLinks: [...this.crossFaceLinks.values()].sort(compareCrossFaceLinks)
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
		if (this.options.packages === void 0) throw new TypertAnalysisError("typert: batched analysis requires an explicit package selection");
		if (!Number.isInteger(batchSize) || batchSize < 1) throw new TypertAnalysisError(`typert: batch size must be a positive integer, received ${String(batchSize)}`);
		const batches = [];
		for (let index = 0; index < this.options.packages.length; index += batchSize) batches.push(new WorkspaceAnalyzer({
			...this.options,
			caches: this.caches,
			packages: this.options.packages.slice(index, index + batchSize)
		}).analyze());
		return mergeWorkspaceModels(batches);
	}
	/**
	* Discover package faces from public-export-reachable Cordis augmentations
	* and explicit `@typert` roots without constructing a type-checker program.
	* @returns contributors grouped by package with deterministic face order.
	*/
	discoverPackages() {
		const registrations = this.loadRegistrations().filter((registration) => this.options.faces.includes(registration.face)).filter((registration) => this.registrationHasSurface(registration));
		const packages = /* @__PURE__ */ new Map();
		for (const registration of registrations) {
			const current = packages.get(registration.name) ?? {
				root: slash(relative(this.options.root, registration.root)),
				faces: /* @__PURE__ */ new Set()
			};
			current.faces.add(registration.face);
			packages.set(registration.name, current);
		}
		return [...packages].map(([packageName, value]) => ({
			package: packageName,
			root: value.root,
			faces: [...value.faces].sort()
		})).sort((left, right) => left.package.localeCompare(right.package));
	}
	/**
	* Index top-level exported type declarations without promoting them to graph
	* roots. Consumers use this lexical index for ambiguity checks while all
	* semantic traversal continues through {@link TypeGraph}.
	* @returns declarations from the selected faces and package projects.
	*/
	indexSourceDeclarations() {
		const selected = this.options.packages === void 0 ? void 0 : new Set(this.options.packages);
		const declarations = [];
		for (const registration of this.loadRegistrations()) {
			if (!this.options.faces.includes(registration.face) || selected !== void 0 && !selected.has(registration.name)) continue;
			for (const file of registration.config.parsed.fileNames) {
				const relativeFile = slash(relative(this.options.root, file));
				if (!existsSync(file) || !isWithin(realPath(file), join(registration.root, "src")) || !/\.(?:cts|mts|ts)$/.test(file)) continue;
				const sourceFile = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
				for (const statement of sourceFile.statements) {
					if (!isTypeDeclaration(statement) || statement.name === void 0 || !hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
					const position = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
					declarations.push({
						face: registration.face,
						package: registration.name,
						name: statement.name.text,
						kind: ts.isClassDeclaration(statement) ? "class" : ts.isInterfaceDeclaration(statement) ? "interface" : ts.isTypeAliasDeclaration(statement) ? "alias" : "enum",
						location: {
							file: relativeFile,
							line: position.line + 1,
							column: position.character + 1
						},
						text: declarationText(statement)
					});
				}
			}
		}
		return uniqueBy(declarations, (declaration) => `${declaration.face}\0${declaration.location.file}\0${String(declaration.location.line)}\0${declaration.name}`).sort((left, right) => left.face.localeCompare(right.face) || left.location.file.localeCompare(right.location.file) || left.location.line - right.location.line);
	}
	loadRegistrations() {
		const inventoryKey = `${this.options.root}\0${this.options.hostConfig}\0${this.options.clientConfig}`;
		const cached = this.caches.registrations.get(inventoryKey);
		if (cached !== void 0) return cached;
		const registrations = [];
		for (const face of ["host", "client"]) {
			const aggregatePath = resolve(this.options.root, face === "host" ? this.options.hostConfig : this.options.clientConfig);
			if (!existsSync(aggregatePath)) continue;
			const aggregate = this.caches.config(aggregatePath);
			for (const reference of aggregate.parsed.projectReferences ?? []) {
				const configPath = projectConfigPath(reference.path);
				const packageRoot = dirname(configPath);
				if (!isWithin(realPath(packageRoot), join(this.options.root, "packages"))) continue;
				const manifestPath = join(packageRoot, "package.json");
				if (!existsSync(manifestPath)) continue;
				const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
				if (typeof manifest.name !== "string") continue;
				const registration = {
					face,
					name: manifest.name,
					root: realPath(packageRoot),
					config: this.caches.config(configPath),
					manifest
				};
				const packagePath = slash(relative(this.options.root, packageRoot));
				const clientPackage = packagePath === "packages/client" || packagePath.startsWith("packages/client/");
				if (clientPackage && isDualFacePackage(manifest)) {
					registrations.push({
						...registration,
						face: "host",
						exportSubpaths: hostExportSubpaths(manifest)
					});
					registrations.push({
						...registration,
						face: "client",
						exportSubpaths: clientExportSubpaths(manifest)
					});
				} else if (clientPackage) registrations.push({
					...registration,
					face: "client"
				});
				else registrations.push({
					...registration,
					face: "host"
				});
			}
		}
		const inventory = uniqueBy(registrations, (registration) => `${registration.face}\0${registration.name}`).sort((left, right) => left.face.localeCompare(right.face) || left.name.localeCompare(right.name));
		this.caches.registrations.set(inventoryKey, inventory);
		return inventory;
	}
	entrySourcePaths(registration) {
		return packageExportTargets(registration.manifest).filter(([subpath, target]) => (registration.exportSubpaths === void 0 || registration.exportSubpaths.includes(subpath)) && !target.includes("*") && subpath !== "./package.json" && subpath !== "./typert" && subpath !== "./client/typert" && !target.endsWith(".json")).map(([, target]) => sourcePathForExport(registration.root, target)).filter(existsSync);
	}
	registrationHasSurface(registration) {
		const seen = /* @__PURE__ */ new Set();
		const queue = this.entrySourcePaths(registration);
		while (queue.length > 0) {
			const file = realPath(queue.shift());
			if (seen.has(file) || !isWithin(file, registration.root)) continue;
			seen.add(file);
			const source = readFileSync(file, "utf8");
			if (sourceFileHasSurface(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true))) return true;
			for (const imported of ts.preProcessFile(source).importedFiles) {
				const resolved = ts.resolveModuleName(imported.fileName, file, registration.config.parsed.options, ts.sys).resolvedModule;
				if (resolved !== void 0 && isWithin(resolved.resolvedFileName, registration.root)) queue.push(resolved.resolvedFileName);
			}
		}
		return false;
	}
	checkProject(registration) {
		if (this.checkedProjects.has(registration.config.path)) return;
		this.checkedProjects.add(registration.config.path);
		const program = ts.createProgram({
			rootNames: registration.config.parsed.fileNames,
			options: {
				...registration.config.parsed.options,
				composite: false,
				incremental: false,
				noEmit: true,
				rootDir: this.options.root
			}
		});
		const diagnostics = [...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics()].filter((diagnostic) => diagnostic.file !== void 0 && diagnostic.start !== void 0 && isWithin(diagnostic.file.fileName, registration.root));
		if (diagnostics.length === 0) return;
		throw new TypertAnalysisError(diagnostics.map((diagnostic) => formatProgramDiagnostic(this.options.root, registration.face, diagnostic)).join("\n"));
	}
	queueEdit(edit) {
		this.queuedEdit = edit;
	}
	applyEdit(edit) {
		const source = readFileSync(edit.file, "utf8");
		writeFileSync(edit.file, source.slice(0, edit.position) + edit.text + source.slice(edit.position));
		this.caches.invalidate(edit.file);
	}
};
var FaceAnalyzer = class {
	root;
	face;
	program;
	checker;
	registrations;
	allRegistrations;
	mode;
	queueEdit;
	crossFaceLinks;
	sourceFiles = /* @__PURE__ */ new Map();
	declarations = /* @__PURE__ */ new Map();
	declarationStates = /* @__PURE__ */ new Set();
	nodes = /* @__PURE__ */ new Map();
	exportsByPackage = /* @__PURE__ */ new Map();
	nodeOrdinals = /* @__PURE__ */ new Map();
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
		for (const sourceFile of this.program.getSourceFiles()) this.sourceFiles.set(realPath(sourceFile.fileName), sourceFile);
	}
	analyze() {
		for (const registration of this.registrations) this.exportsByPackage.set(registration.name, this.collectExports(registration));
		const packages = this.registrations.map((registration) => this.analyzePackage(registration)).filter(hasPackageSurface);
		return {
			face: this.face,
			packages,
			graph: {
				declarations: [...this.declarations.values()].sort((left, right) => left.id.localeCompare(right.id)),
				nodes: [...this.nodes.values()].sort((left, right) => left.id.localeCompare(right.id))
			}
		};
	}
	analyzePackage(registration) {
		const records = this.exportsByPackage.get(registration.name);
		const reachable = this.reachableFiles(registration, records.map((record) => record.sourceFile));
		const services = [];
		const events = [];
		for (const sourceFile of reachable) for (const statement of sourceFile.statements) {
			if (!ts.isModuleDeclaration(statement) || !ts.isStringLiteral(statement.name) || statement.name.text !== "cordis" || statement.body === void 0 || !ts.isModuleBlock(statement.body)) continue;
			for (const member of statement.body.statements) {
				if (!ts.isInterfaceDeclaration(member)) continue;
				if (member.name.text === "Context") services.push(...this.collectServices(member, records));
				else if (member.name.text === "Events") events.push(...this.collectEvents(member));
			}
		}
		const objects = [];
		const schemas = [];
		const seenBusinessSymbols = /* @__PURE__ */ new Set();
		for (const record of records) {
			const declaration = record.declaration;
			if (!isTypeDeclaration(declaration)) continue;
			if (this.registrationForFile(declaration.getSourceFile().fileName) === void 0) continue;
			const symbol = this.resolveSymbol(record.symbol);
			const symbolId = this.symbolId(symbol);
			if (seenBusinessSymbols.has(symbolId)) continue;
			const mode = typertMode(declaration);
			if (mode !== "object" && mode !== "schema") continue;
			seenBusinessSymbols.add(symbolId);
			this.ensureDeclaration(symbol, declaration);
			const documentation = documentationOf(declaration);
			if (mode === "object") objects.push({
				...documentation,
				export: record.model,
				symbol: symbolId,
				passing: "reference"
			});
			else schemas.push({
				...documentation,
				export: record.model,
				symbol: symbolId,
				type: this.referenceNode(symbol, declaration)
			});
		}
		return {
			name: registration.name,
			root: slash(relative(this.root, registration.root)),
			exports: records.map((record) => record.model).sort((left, right) => left.subpath.localeCompare(right.subpath) || left.name.localeCompare(right.name)),
			services: uniqueBy(services, (service) => service.key).sort((left, right) => left.key.localeCompare(right.key)),
			events: uniqueBy(events, (event) => event.name).sort((left, right) => left.name.localeCompare(right.name)),
			objects: objects.sort((left, right) => left.export.name.localeCompare(right.export.name)),
			schemas: schemas.sort((left, right) => left.export.name.localeCompare(right.export.name))
		};
	}
	collectExports(registration) {
		const targets = packageExportTargets(registration.manifest).filter(([subpath]) => registration.exportSubpaths === void 0 || registration.exportSubpaths.includes(subpath));
		const records = [];
		for (const [subpath, target] of targets) {
			if (target.includes("*") || subpath === "./package.json" || subpath === "./typert" || subpath === "./client/typert" || target.endsWith(".json") || target.endsWith(".yml") || target.endsWith(".yaml")) continue;
			const sourcePath = sourcePathForExport(registration.root, target);
			const sourceFile = this.sourceFiles.get(realPath(sourcePath));
			if (sourceFile === void 0) throw new TypertAnalysisError(`typert(${this.face}): ${registration.name} export ${subpath} resolves to missing source ${sourcePath}`);
			const moduleSymbol = this.checker.getSymbolAtLocation(sourceFile);
			if (moduleSymbol === void 0) continue;
			for (const exported of this.checker.getExportsOfModule(moduleSymbol)) {
				const symbol = this.resolveSymbol(exported);
				const declaration = preferredDeclaration(symbol);
				const aliases = exported === symbol || exported.name === symbol.name ? [exported.name] : [exported.name, symbol.name];
				records.push({
					model: {
						subpath,
						name: exported.name,
						symbol: this.symbolId(symbol),
						aliases
					},
					symbol,
					declaration,
					sourceFile
				});
			}
		}
		const unique = uniqueBy(records, (record) => `${record.model.subpath}\0${record.model.name}`);
		this.collectCrossFaceReExports(registration, unique);
		return unique;
	}
	collectCrossFaceReExports(registration, records) {
		const publicSymbols = new Set(records.map((record) => record.symbol));
		const entryFiles = uniqueBy(records, (record) => record.sourceFile.fileName).map((record) => record.sourceFile);
		for (const sourceFile of this.reachableFiles(registration, entryFiles)) for (const statement of sourceFile.statements) {
			if (!ts.isExportDeclaration(statement) || statement.moduleSpecifier === void 0 || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
			const module = moduleIdentity(statement.moduleSpecifier.text);
			if (module === void 0) continue;
			const toFace = this.allRegistrations.find((candidate) => candidate.name === module.package && candidate.face !== this.face)?.face;
			if (toFace === void 0) continue;
			if (statement.exportClause !== void 0 && ts.isNamespaceExport(statement.exportClause)) {
				const namespace = this.resolveSymbol(this.checker.getSymbolAtLocation(statement.exportClause.name));
				if (publicSymbols.has(namespace)) this.fail(statement.exportClause, "cross-face namespace re-exports are not supported");
				continue;
			}
			const exports = statement.exportClause === void 0 ? this.moduleExports(statement.moduleSpecifier).map((symbol) => ({
				symbol: this.resolveSymbol(symbol),
				requestedName: symbol.name,
				site: statement
			})) : statement.exportClause.elements.map((element) => ({
				symbol: this.resolveSymbol(this.checker.getSymbolAtLocation(element.name)),
				requestedName: element.propertyName?.text ?? element.name.text,
				site: element
			}));
			for (const exported of exports) {
				if (!publicSymbols.has(exported.symbol)) continue;
				const name = this.packageExportName(module, exported.symbol, toFace, exported.requestedName);
				if (name === void 0) this.fail(exported.site, `cross-face re-export ${exported.requestedName} is not exported by ${module.package} at ${module.subpath}`);
				this.recordCrossFaceLink(registration.name, toFace, module, name);
			}
		}
	}
	moduleExports(moduleSpecifier) {
		/* v8 ignore next -- a semantically valid export declaration from a resolved module always has a module symbol. */
		const moduleSymbol = this.checker.getSymbolAtLocation(moduleSpecifier);
		return this.checker.getExportsOfModule(moduleSymbol);
	}
	reachableFiles(registration, entryFiles) {
		const reachable = /* @__PURE__ */ new Map();
		const queue = [...entryFiles];
		while (queue.length > 0) {
			const sourceFile = queue.shift();
			const fileName = realPath(sourceFile.fileName);
			if (reachable.has(fileName) || !isWithin(fileName, registration.root)) continue;
			reachable.set(fileName, sourceFile);
			for (const statement of sourceFile.statements) {
				if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement) || statement.moduleSpecifier === void 0 || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
				const resolved = ts.resolveModuleName(statement.moduleSpecifier.text, sourceFile.fileName, this.program.getCompilerOptions(), ts.sys).resolvedModule;
				if (resolved === void 0) continue;
				const resolvedPath = realPath(resolved.resolvedFileName);
				if (!isWithin(resolvedPath, registration.root)) continue;
				queue.push(this.sourceFiles.get(resolvedPath));
			}
		}
		return [...reachable.values()].sort((left, right) => left.fileName.localeCompare(right.fileName));
	}
	collectServices(context, records) {
		const bySymbol = /* @__PURE__ */ new Map();
		for (const record of records) {
			const id = this.symbolId(record.symbol);
			const matches = bySymbol.get(id) ?? [];
			matches.push(record);
			bySymbol.set(id, matches);
		}
		const result = [];
		for (const member of context.members) {
			if (!ts.isPropertySignature(member) || member.type === void 0) continue;
			const symbol = this.symbolAtType(member.type);
			if (symbol === void 0) continue;
			const symbolId = this.symbolId(symbol);
			const exported = bySymbol.get(symbolId)?.find((record) => record.model.name === symbol.name) ?? bySymbol.get(symbolId)?.find((record) => record.model.name !== "default") ?? bySymbol.get(symbolId)?.[0];
			if (exported === void 0) continue;
			const declaration = preferredDeclaration(symbol);
			if (declaration === void 0 || !ts.isClassDeclaration(declaration) && !ts.isInterfaceDeclaration(declaration)) this.fail(member, `service ${memberName(member.name)} does not resolve to an exported class or interface`);
			const exposed = this.ensureDeclaration(symbol, declaration).members.filter(exposableMember).map((publicMember) => publicMember.id);
			result.push({
				...documentationOf(declaration),
				key: memberName(member.name),
				symbol: symbolId,
				export: exported.model,
				members: exposed,
				location: this.location(member)
			});
		}
		return result;
	}
	collectEvents(events) {
		const result = [];
		for (const member of events.members) {
			const documentation = documentationOf(member);
			const mode = documentation.tags.find((tag) => tag.name === "mode")?.comment?.trim();
			if (ts.isMethodSignature(member)) {
				const signature = this.signature(member, member.type);
				result.push({
					...documentation,
					name: memberName(member.name),
					signature: this.addNode(member, {
						kind: "function",
						signature
					}),
					text: memberText(member),
					...mode === void 0 ? {} : { mode },
					location: this.location(member)
				});
			} else if (ts.isPropertySignature(member) && member.type !== void 0) result.push({
				...documentation,
				name: memberName(member.name),
				signature: this.convertType(member.type),
				text: memberText(member),
				...mode === void 0 ? {} : { mode },
				location: this.location(member)
			});
		}
		return result;
	}
	ensureDeclaration(symbol, selected) {
		const resolved = this.resolveSymbol(symbol);
		const id = this.symbolId(resolved);
		const existing = this.declarations.get(id);
		if (existing !== void 0) return existing;
		const declarationParts = resolved.declarations.filter(isTypeDeclaration);
		if (declarationParts.length > 1 && !declarationParts.every(ts.isInterfaceDeclaration)) this.fail(selected, `merged ${ts.SyntaxKind[selected.kind]} declaration ${resolved.name} is not supported`);
		if (selected.name === void 0) this.fail(selected, `anonymous ${ts.SyntaxKind[selected.kind]} cannot be represented as a named type declaration`);
		const owner = this.registrationForFile(selected.getSourceFile().fileName);
		this.declarationStates.add(id);
		if (declarationParts.length > 1) {
			const analyzedParts = declarationParts.map((declarationPart) => {
				const part = declarationPart;
				const partOwner = this.registrationForFile(part.getSourceFile().fileName);
				if (partOwner === void 0) this.fail(part, `merged interface ${resolved.name} contains a declaration outside this face`);
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
						members: members.map((member) => member.id)
					}
				};
			});
			const parameters = this.mergeTypeParameters(analyzedParts.map((part) => part.typeParameters), selected, resolved.name);
			const model = {
				...documentationOf(selected),
				id,
				package: owner.name,
				name: declarationName(selected),
				kind: "interface",
				abstract: false,
				exported: hasModifier(selected, ts.SyntaxKind.ExportKeyword),
				location: this.location(selected),
				text: declarationText(selected),
				typeParameters: parameters,
				extends: analyzedParts.flatMap((part) => part.heritage.extends),
				implements: [],
				members: analyzedParts.flatMap((part) => part.members),
				parts: analyzedParts.map((part) => part.model)
			};
			this.declarations.set(id, model);
			this.declarationStates.delete(id);
			return model;
		}
		const parameters = ts.isEnumDeclaration(selected) ? [] : this.typeParameters(selected.typeParameters);
		const heritage = ts.isTypeAliasDeclaration(selected) || ts.isEnumDeclaration(selected) ? {
			extends: [],
			implements: []
		} : this.heritage(selected);
		const kind = ts.isClassDeclaration(selected) ? "class" : ts.isInterfaceDeclaration(selected) ? "interface" : ts.isTypeAliasDeclaration(selected) ? "alias" : "enum";
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
			members: ts.isTypeAliasDeclaration(selected) || ts.isEnumDeclaration(selected) ? [] : this.members(selected.members, id),
			...ts.isTypeAliasDeclaration(selected) ? { type: this.convertType(selected.type) } : {},
			...ts.isEnumDeclaration(selected) ? { enumMembers: this.enumMembers(selected) } : {}
		};
		this.declarations.set(id, model);
		this.declarationStates.delete(id);
		return model;
	}
	enumMembers(declaration) {
		return declaration.members.map((member) => ({
			...documentationOf(member),
			name: memberName(member.name),
			...member.initializer === void 0 ? {} : { initializer: member.initializer.getText() },
			location: this.location(member)
		}));
	}
	heritage(declaration) {
		const result = {
			extends: [],
			implements: []
		};
		for (const clause of declaration.heritageClauses ?? []) {
			const target = clause.token === ts.SyntaxKind.ExtendsKeyword ? result.extends : result.implements;
			for (const type of clause.types) target.push(this.convertHeritage(type));
		}
		return result;
	}
	convertHeritage(node) {
		const symbol = this.checker.getSymbolAtLocation(node.expression);
		return this.addNode(node, {
			kind: "reference",
			name: node.expression.getText(),
			target: this.targetForReference(this.resolveSymbol(symbol), node),
			arguments: node.typeArguments?.map((argument) => this.convertType(argument)) ?? []
		});
	}
	members(members, ownerId) {
		const result = [];
		for (const member of members) {
			const visibility = visibilityOf(member);
			const isStatic = hasModifier(member, ts.SyntaxKind.StaticKeyword);
			if (visibility !== "public" || isStatic || ts.isConstructorDeclaration(member)) continue;
			const base = this.memberBase(member, ownerId, visibility, isStatic);
			if (ts.isPropertySignature(member) || ts.isPropertyDeclaration(member)) {
				const type = this.requiredType(member, member.type, "property");
				result.push({
					...base,
					kind: "property",
					type: this.convertType(type)
				});
			} else if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) result.push({
				...base,
				kind: "method",
				signature: this.signature(member, member.type)
			});
			else if (ts.isGetAccessorDeclaration(member)) result.push({
				...base,
				kind: "getter",
				signature: this.signature(member, member.type)
			});
			else if (ts.isSetAccessorDeclaration(member)) result.push({
				...base,
				kind: "setter",
				signature: this.signature(member, member.type)
			});
			else if (ts.isCallSignatureDeclaration(member)) result.push({
				...base,
				kind: "call",
				signature: this.signature(member, member.type)
			});
			else if (ts.isConstructSignatureDeclaration(member)) result.push({
				...base,
				kind: "construct",
				signature: this.signature(member, member.type)
			});
			else if (ts.isIndexSignatureDeclaration(member)) result.push({
				...base,
				kind: "index",
				signature: this.signature(member, member.type)
			});
		}
		return result;
	}
	memberBase(member, ownerId, visibility, isStatic) {
		const name = member.name !== void 0 ? memberName(member.name) : ts.isCallSignatureDeclaration(member) ? "(call)" : ts.isConstructSignatureDeclaration(member) ? "(construct)" : "(index)";
		return {
			...documentationOf(member),
			id: `${ownerId}#${name}@${String(member.getStart())}`,
			name,
			optional: "questionToken" in member && member.questionToken !== void 0,
			readonly: hasModifier(member, ts.SyntaxKind.ReadonlyKeyword),
			async: hasModifier(member, ts.SyntaxKind.AsyncKeyword),
			abstract: hasModifier(member, ts.SyntaxKind.AbstractKeyword),
			static: isStatic,
			visibility,
			location: this.location(member),
			text: memberText(member)
		};
	}
	signature(node, explicitReturn) {
		const parameters = node.parameters.map((parameter) => ({
			name: memberName(parameter.name),
			binding: ts.isIdentifier(parameter.name) ? "identifier" : ts.isObjectBindingPattern(parameter.name) ? "object" : "array",
			type: this.convertType(this.requiredType(parameter, parameter.type, "parameter")),
			optional: parameter.questionToken !== void 0 || parameter.initializer !== void 0,
			rest: parameter.dotDotDotToken !== void 0,
			receiver: ts.isIdentifier(parameter.name) && parameter.name.text === "this",
			...parameter.initializer === void 0 ? {} : { initializer: parameter.initializer.getText() }
		}));
		return {
			typeParameters: this.typeParameters(node.typeParameters),
			parameters,
			returns: ts.isSetAccessorDeclaration(node) ? this.addNode(node, {
				kind: "keyword",
				name: "void"
			}) : this.convertType(this.requiredType(node, explicitReturn, "return"))
		};
	}
	typeParameters(parameters) {
		return parameters?.map((parameter) => ({
			id: `${this.locationKey(parameter)}#${parameter.name.text}`,
			name: parameter.name.text,
			const: hasModifier(parameter, ts.SyntaxKind.ConstKeyword),
			...parameter.constraint === void 0 ? {} : { constraint: this.convertType(parameter.constraint) },
			...parameter.default === void 0 ? {} : { default: this.convertType(parameter.default) },
			...hasModifier(parameter, ts.SyntaxKind.InKeyword) && hasModifier(parameter, ts.SyntaxKind.OutKeyword) ? { variance: "in-out" } : hasModifier(parameter, ts.SyntaxKind.InKeyword) ? { variance: "in" } : hasModifier(parameter, ts.SyntaxKind.OutKeyword) ? { variance: "out" } : {}
		})) ?? [];
	}
	mergeTypeParameters(parts, site, declarationName) {
		return parts[0].map((parameter, index) => {
			const peers = parts.map((part) => part[index]);
			const constraint = peers.find((peer) => peer.constraint !== void 0)?.constraint;
			const fallback = peers.find((peer) => peer.default !== void 0)?.default;
			const variances = [...new Set(peers.flatMap((peer) => peer.variance === void 0 ? [] : [peer.variance]))];
			if (variances.length > 1) this.fail(site, `merged interface ${declarationName} has incompatible variance modifiers`);
			return {
				id: parameter.id,
				name: parameter.name,
				const: peers.some((peer) => peer.const),
				...constraint === void 0 ? {} : { constraint },
				...fallback === void 0 ? {} : { default: fallback },
				...variances[0] === void 0 ? {} : { variance: variances[0] }
			};
		});
	}
	requiredType(owner, type, purpose) {
		if (type !== void 0) return type;
		if (this.mode === "check") this.fail(owner, `public ${purpose} is missing an explicit type annotation`);
		const inferred = this.inferType(owner, purpose);
		const rendered = ts.createPrinter().printNode(ts.EmitHint.Unspecified, inferred, owner.getSourceFile());
		const position = annotationPosition(owner, purpose);
		this.queueEdit({
			file: realPath(owner.getSourceFile().fileName),
			position,
			text: `: ${rendered}`
		});
		throw new SourceEditQueued();
	}
	inferType(owner, purpose) {
		let type;
		if (purpose === "return") {
			const signature = this.checker.getSignatureFromDeclaration(owner);
			type = this.checker.getReturnTypeOfSignature(signature);
		} else type = this.checker.getTypeAtLocation(owner);
		return this.checker.typeToTypeNode(type, owner, ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.UseAliasDefinedOutsideCurrentScope);
	}
	convertType(node) {
		const id = this.allocateNodeId(node);
		const add = (model) => {
			this.nodes.set(id, {
				id,
				...model
			});
			return id;
		};
		const keyword = keywordName(node.kind);
		if (keyword !== void 0) return add({
			kind: "keyword",
			name: keyword
		});
		if (ts.isParenthesizedTypeNode(node)) return add({
			kind: "parenthesized",
			type: this.convertType(node.type)
		});
		if (ts.isLiteralTypeNode(node)) return add(literalModel(node));
		if (ts.isTypeReferenceNode(node)) {
			const symbol = this.checker.getSymbolAtLocation(node.typeName);
			return add({
				kind: "reference",
				name: node.typeName.getText(),
				target: this.targetForReference(this.resolveSymbol(symbol), node),
				arguments: node.typeArguments?.map((argument) => this.convertType(argument)) ?? []
			});
		}
		if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) return add({
			kind: ts.isUnionTypeNode(node) ? "union" : "intersection",
			types: node.types.map((type) => this.convertType(type))
		});
		if (ts.isArrayTypeNode(node)) return add({
			kind: "array",
			element: this.convertType(node.elementType)
		});
		if (ts.isTupleTypeNode(node)) return add({
			kind: "tuple",
			elements: node.elements.map((element) => {
				const named = ts.isNamedTupleMember(element) ? element : void 0;
				const raw = named?.type ?? element;
				const optional = named?.questionToken !== void 0 || ts.isOptionalTypeNode(raw);
				const rest = named?.dotDotDotToken !== void 0 || ts.isRestTypeNode(raw);
				const type = ts.isOptionalTypeNode(raw) || ts.isRestTypeNode(raw) ? raw.type : raw;
				return {
					...named === void 0 ? {} : { name: named.name.text },
					type: this.convertType(type),
					optional,
					rest
				};
			})
		});
		if (ts.isTypeLiteralNode(node)) return add({
			kind: "object",
			members: this.members(node.members, id)
		});
		if (ts.isFunctionTypeNode(node)) return add({
			kind: "function",
			signature: this.signature(node, node.type)
		});
		if (ts.isConstructorTypeNode(node)) return add({
			kind: "constructor",
			abstract: hasModifier(node, ts.SyntaxKind.AbstractKeyword),
			signature: this.signature(node, node.type)
		});
		if (ts.isIndexedAccessTypeNode(node)) return add({
			kind: "indexed-access",
			object: this.convertType(node.objectType),
			index: this.convertType(node.indexType)
		});
		if (ts.isTypeOperatorNode(node)) return add({
			kind: "operator",
			operator: ts.tokenToString(node.operator),
			type: this.convertType(node.type)
		});
		if (ts.isConditionalTypeNode(node)) return add({
			kind: "conditional",
			check: this.convertType(node.checkType),
			extends: this.convertType(node.extendsType),
			whenTrue: this.convertType(node.trueType),
			whenFalse: this.convertType(node.falseType)
		});
		if (ts.isInferTypeNode(node)) return add({
			kind: "infer",
			parameter: this.typeParameters(ts.factory.createNodeArray([node.typeParameter]))[0]
		});
		if (ts.isMappedTypeNode(node)) {
			const parameter = this.typeParameters(ts.factory.createNodeArray([node.typeParameter]))[0];
			return add({
				kind: "mapped",
				parameter,
				...node.nameType === void 0 ? {} : { nameType: this.convertType(node.nameType) },
				...node.type === void 0 ? {} : { value: this.convertType(node.type) },
				readonly: modifierMode(node.readonlyToken),
				optional: modifierMode(node.questionToken)
			});
		}
		if (ts.isTemplateLiteralTypeNode(node)) return add({
			kind: "template-literal",
			head: node.head.text,
			spans: node.templateSpans.map((span) => ({
				type: this.convertType(span.type),
				text: span.literal.text
			}))
		});
		if (ts.isTypeQueryNode(node)) return add({
			kind: "type-query",
			expression: node.exprName.getText(),
			arguments: node.typeArguments?.map((argument) => this.convertType(argument)) ?? []
		});
		if (ts.isImportTypeNode(node)) {
			const argument = node.argument;
			const symbol = node.qualifier === void 0 ? void 0 : this.checker.getSymbolAtLocation(node.qualifier);
			return add({
				kind: "import-type",
				module: argument.literal.text,
				...node.qualifier === void 0 ? {} : { qualifier: node.qualifier.getText() },
				arguments: node.typeArguments?.map((argument) => this.convertType(argument)) ?? [],
				typeof: node.isTypeOf,
				...node.attributes === void 0 ? {} : { attributes: importTypeAttributesText(node) },
				...symbol === void 0 ? {} : { target: this.targetForReference(this.resolveSymbol(symbol), node) }
			});
		}
		if (ts.isTypePredicateNode(node)) return add({
			kind: "predicate",
			asserts: node.assertsModifier !== void 0,
			parameter: node.parameterName.getText(),
			...node.type === void 0 ? {} : { type: this.convertType(node.type) }
		});
		/* v8 ignore else -- every source TypeNode kind accepted by TypeScript is handled above; this arm keeps
		* future compiler kinds fail-loud. */
		if (ts.isThisTypeNode(node)) return add({ kind: "this" });
		/* v8 ignore next -- paired with the exhaustive TypeNode guard above. */
		this.fail(node, `unsupported TypeScript type node ${ts.SyntaxKind[node.kind]}`);
	}
	addNode(site, model) {
		const id = this.allocateNodeId(site);
		this.nodes.set(id, {
			id,
			...model
		});
		return id;
	}
	referenceNode(symbol, site) {
		return this.addNode(site, {
			kind: "reference",
			name: symbol.name,
			target: {
				kind: "declaration",
				symbol: this.symbolId(symbol)
			},
			arguments: []
		});
	}
	targetForReference(symbol, site) {
		const declaration = preferredDeclaration(symbol);
		/* v8 ignore next -- a symbol from a semantically valid source type reference always has a declaration. */
		if (declaration === void 0) this.fail(site, `type symbol ${symbol.name} has no declaration`);
		if (ts.isTypeParameterDeclaration(declaration)) return {
			kind: "type-parameter",
			parameter: `${this.locationKey(declaration)}#${declaration.name.text}`
		};
		if (isStandardLibraryFile(declaration.getSourceFile().fileName)) return {
			kind: "standard",
			name: symbol.name
		};
		const moduleSpecifier = moduleSpecifierOf(site);
		const module = moduleSpecifier === void 0 ? void 0 : moduleIdentity(moduleSpecifier);
		const from = this.registrationForFile(site.getSourceFile().fileName);
		const owner = this.registrationForFile(declaration.getSourceFile().fileName);
		if (owner !== void 0) {
			if (owner.name !== from.name) {
				if (module === void 0) this.fail(site, `reference to ${symbol.name} crosses a package without an explicit package import`);
				const exportName = authoredExportName(site, moduleSpecifier);
				if (this.packageExportName(module, symbol, owner.face, exportName) === void 0) this.fail(site, `package reference ${exportName} is not exported by ${module.package} at ${module.subpath}`);
			}
			const typeDeclaration = declaration;
			if (!this.declarationStates.has(this.symbolId(symbol))) this.ensureDeclaration(symbol, typeDeclaration);
			return {
				kind: "declaration",
				symbol: this.symbolId(symbol)
			};
		}
		const otherFace = (module === void 0 ? [] : [...new Set(this.allRegistrations.filter((candidate) => candidate.name === module.package).map((candidate) => candidate.face))]).find((face) => face !== this.face);
		if (otherFace !== void 0 && module !== void 0) {
			const requestedName = authoredExportName(site, moduleSpecifier);
			const exportName = this.packageExportName(module, symbol, otherFace, requestedName);
			if (exportName === void 0) this.fail(site, `cross-face reference ${requestedName} is not exported by ${module.package} at ${module.subpath}`);
			this.recordCrossFaceLink(from.name, otherFace, module, exportName);
			return {
				kind: "cross-face",
				face: otherFace,
				package: module.package,
				subpath: module.subpath,
				name: exportName
			};
		}
		if (module !== void 0) return {
			kind: "external",
			module: module.package,
			subpath: module.subpath,
			name: symbol.name
		};
		const external = externalModuleIdentityForFile(declaration.getSourceFile().fileName);
		if (external !== void 0) return {
			kind: "external",
			module: external.package,
			subpath: external.subpath,
			name: symbol.name
		};
		this.fail(site, `reference to ${symbol.name} crosses a package or face without an explicit import`);
	}
	recordCrossFaceLink(fromPackage, toFace, module, name) {
		const link = {
			fromFace: this.face,
			fromPackage,
			toFace,
			toPackage: module.package,
			subpath: module.subpath,
			name
		};
		const key = [
			link.fromFace,
			link.fromPackage,
			link.toFace,
			link.toPackage,
			link.subpath,
			link.name
		].join("\0");
		this.crossFaceLinks.set(key, link);
	}
	packageExportName(module, symbol, face, requestedName) {
		const registration = this.allRegistrations.find((candidate) => candidate.face === face && candidate.name === module.package);
		const target = packageExportTargets(registration.manifest).find(([subpath]) => subpath === module.subpath)?.[1];
		if (target === void 0) return void 0;
		const sourceFile = this.sourceFiles.get(realPath(sourcePathForExport(registration.root, target)));
		const moduleSymbol = this.checker.getSymbolAtLocation(sourceFile);
		return this.checker.getExportsOfModule(moduleSymbol).find((candidate) => candidate.name === requestedName && this.resolveSymbol(candidate) === symbol)?.name;
	}
	symbolAtType(node) {
		if (ts.isTypeReferenceNode(node)) return this.resolveSymbol(this.checker.getSymbolAtLocation(node.typeName));
		const type = this.checker.getTypeAtLocation(node);
		const symbol = type.aliasSymbol ?? type.getSymbol();
		return symbol === void 0 ? void 0 : this.resolveSymbol(symbol);
	}
	resolveSymbol(symbol) {
		return (symbol.flags & ts.SymbolFlags.Alias) === 0 ? symbol : this.checker.getAliasedSymbol(symbol);
	}
	symbolId(symbol) {
		const declaration = preferredDeclaration(symbol);
		if (declaration === void 0) return `symbol:${symbol.name}`;
		const location = this.location(declaration);
		return `${this.packageNameForFile(declaration.getSourceFile().fileName)}:${location.file}#${symbol.name}`;
	}
	registrationForFile(file) {
		const path = realPath(file);
		return this.allRegistrations.find((registration) => registration.face === this.face && isWithin(path, registration.root));
	}
	packageNameForFile(file) {
		const path = realPath(file);
		return this.allRegistrations.find((registration) => isWithin(path, registration.root))?.name ?? "<external>";
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
			column: position.character + 1
		};
	}
	fail(node, message) {
		const location = this.location(node);
		throw new TypertAnalysisError(`typert(${this.face}): ${location.file}:${String(location.line)}:${String(location.column)}: ${message}`);
	}
};
function mergeWorkspaceModels(models) {
	const faces = /* @__PURE__ */ new Map();
	const links = /* @__PURE__ */ new Map();
	for (const model of models) {
		for (const face of model.faces) {
			const merged = faces.get(face.face) ?? {
				packages: /* @__PURE__ */ new Map(),
				declarations: /* @__PURE__ */ new Map(),
				nodes: /* @__PURE__ */ new Map()
			};
			for (const packageModel of face.packages) merged.packages.set(packageModel.name, packageModel);
			for (const declaration of face.graph.declarations) if (!merged.declarations.has(declaration.id)) merged.declarations.set(declaration.id, declaration);
			for (const node of face.graph.nodes) if (!merged.nodes.has(node.id)) merged.nodes.set(node.id, node);
			faces.set(face.face, merged);
		}
		for (const link of model.crossFaceLinks) links.set([
			link.fromFace,
			link.fromPackage,
			link.toFace,
			link.toPackage,
			link.subpath,
			link.name
		].join("\0"), link);
	}
	return {
		faces: [...faces].sort(([left], [right]) => (left === "host" ? 0 : 1) - (right === "host" ? 0 : 1)).map(([face, model]) => ({
			face,
			packages: [...model.packages.values()].sort((left, right) => left.name.localeCompare(right.name)),
			graph: {
				declarations: [...model.declarations.values()].sort((left, right) => left.id.localeCompare(right.id)),
				nodes: [...model.nodes.values()].sort((left, right) => left.id.localeCompare(right.id))
			}
		})),
		crossFaceLinks: [...links.values()].sort(compareCrossFaceLinks)
	};
}
function parseConfig(path) {
	const read = ts.readConfigFile(path, (file) => ts.sys.readFile(file));
	if (read.error !== void 0) throw new TypertAnalysisError(formatDiagnostic(read.error));
	const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(path), void 0, path);
	if (parsed.errors.length > 0) throw new TypertAnalysisError(parsed.errors.map(formatDiagnostic).join("\n"));
	return {
		path,
		parsed
	};
}
function projectConfigPath(path) {
	if (extname(path) === ".json") return path;
	return join(path, "tsconfig.json");
}
function sourceFileHasSurface(sourceFile) {
	for (const statement of sourceFile.statements) {
		if ((ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement)) && typertMode(statement) !== void 0) return true;
		if (!ts.isModuleDeclaration(statement) || !ts.isStringLiteral(statement.name) || statement.name.text !== "cordis" || statement.body === void 0 || !ts.isModuleBlock(statement.body)) continue;
		if (statement.body.statements.some((member) => ts.isInterfaceDeclaration(member) && (member.name.text === "Context" || member.name.text === "Events") && member.members.length > 0)) return true;
	}
	return false;
}
function hasPackageSurface(model) {
	return model.services.length > 0 || model.events.length > 0 || model.objects.length > 0 || model.schemas.length > 0;
}
function isDualFacePackage(manifest) {
	return manifest.dshClient !== null && typeof manifest.dshClient === "object" && clientExportSubpaths(manifest).length > 0;
}
function hostExportSubpaths(manifest) {
	return packageExportTargets(manifest).map(([subpath]) => subpath).filter((subpath) => subpath !== "./client" && !subpath.startsWith("./client/"));
}
function clientExportSubpaths(manifest) {
	return packageExportTargets(manifest).map(([subpath]) => subpath).filter((subpath) => subpath === "./client" || subpath.startsWith("./client/"));
}
function packageExportTargets(manifest) {
	const exportsField = manifest.exports;
	if (typeof exportsField === "string") return [[".", exportsField]];
	if (exportsField === null || typeof exportsField !== "object") {
		const types = manifest.types;
		return typeof types === "string" ? [[".", types]] : [];
	}
	if (Array.isArray(exportsField) || !Object.keys(exportsField).some((key) => key.startsWith("."))) {
		const target = exportTarget(exportsField);
		return target === void 0 ? [] : [[".", target]];
	}
	const result = [];
	for (const [subpath, value] of Object.entries(exportsField)) {
		if (!subpath.startsWith(".")) continue;
		const target = exportTarget(value);
		if (target !== void 0) result.push([subpath, target]);
	}
	return result.sort(([left], [right]) => left.localeCompare(right));
}
function exportTarget(value) {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) {
		for (const candidate of value) {
			const target = exportTarget(candidate);
			if (target !== void 0) return target;
		}
		return;
	}
	if (value === null || typeof value !== "object") return void 0;
	const conditions = value;
	for (const key of [
		"types",
		"import",
		"default"
	]) {
		const target = exportTarget(conditions[key]);
		if (target !== void 0) return target;
	}
	for (const candidate of Object.values(conditions)) {
		const target = exportTarget(candidate);
		if (target !== void 0) return target;
	}
}
function sourcePathForExport(packageRoot, target) {
	const normalized = target.replace(/^\.\//, "");
	if (normalized.startsWith("lib/types/")) return resolve(packageRoot, "src", normalized.slice(10).replace(/\.d\.(?:mts|cts|ts)$/, ".ts"));
	if (normalized.startsWith("lib/")) return resolve(packageRoot, "src", normalized.slice(4).replace(/\.(?:mjs|cjs|js|d\.ts)$/, ".ts"));
	return resolve(packageRoot, normalized);
}
function preferredDeclaration(symbol) {
	return symbol.declarations?.find(isTypeDeclaration) ?? symbol.valueDeclaration ?? symbol.declarations?.[0];
}
function isTypeDeclaration(node) {
	return ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node);
}
function declarationName(declaration) {
	return declaration.name.text;
}
function memberText(member) {
	const sourceFile = member.getSourceFile();
	const full = member.getText(sourceFile);
	const body = member.body;
	return (body === void 0 ? full : full.slice(0, full.length - body.getText(sourceFile).length)).replace(/\s*;?\s*$/, "").replace(/\s+/g, " ").trim();
}
function declarationText(declaration) {
	const printer = ts.createPrinter({ removeComments: true });
	const projected = ts.isClassDeclaration(declaration) ? classShape(declaration) : declaration;
	return printer.printNode(ts.EmitHint.Unspecified, projected, declaration.getSourceFile()).replace(/\r/g, "");
}
function classShape(node) {
	const nonPublic = (member) => (ts.canHaveModifiers(member) ? ts.getModifiers(member) : void 0)?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword) ?? false;
	const members = node.members.flatMap((member) => {
		if (nonPublic(member) || ts.isPropertyDeclaration(member) && ts.isPrivateIdentifier(member.name)) return [];
		if (ts.isMethodDeclaration(member)) return [ts.factory.updateMethodDeclaration(member, member.modifiers, member.asteriskToken, member.name, member.questionToken, member.typeParameters, member.parameters, member.type, void 0)];
		if (ts.isConstructorDeclaration(member)) return [ts.factory.updateConstructorDeclaration(member, member.modifiers, member.parameters, void 0)];
		if (ts.isGetAccessorDeclaration(member)) return [ts.factory.updateGetAccessorDeclaration(member, member.modifiers, member.name, member.parameters, member.type, void 0)];
		if (ts.isSetAccessorDeclaration(member)) return [ts.factory.updateSetAccessorDeclaration(member, member.modifiers, member.name, member.parameters, void 0)];
		if (ts.isPropertyDeclaration(member)) return [ts.factory.updatePropertyDeclaration(member, member.modifiers, member.name, member.questionToken ?? member.exclamationToken, member.type, void 0)];
		return [member];
	});
	return ts.factory.updateClassDeclaration(node, node.modifiers, node.name, node.typeParameters, node.heritageClauses, members);
}
function documentationOf(node) {
	const block = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc).at(-1);
	if (block === void 0) return EMPTY_DOCUMENTATION;
	const description = normalizedDocText(ts.getTextOfJSDocComment(block.comment));
	const tags = ts.getJSDocTags(node).map((tag) => {
		const named = tag;
		const comment = normalizedDocText(ts.getTextOfJSDocComment(tag.comment));
		return {
			name: tag.tagName.text,
			...named.name === void 0 ? {} : { argument: named.name.getText() },
			...comment === void 0 ? {} : { comment },
			text: tag.getText(tag.getSourceFile()).trim()
		};
	});
	return {
		...description === void 0 ? {} : {
			description,
			summary: firstSentence$1(description)
		},
		tags,
		jsDoc: rawJsDoc(node)
	};
}
function normalizedDocText(value) {
	if (value === void 0) return void 0;
	const normalized = value.replace(/\s+/g, " ").trim();
	/* v8 ignore next -- TypeScript represents whitespace-only JSDoc as undefined before this helper is called. */
	return normalized.length === 0 ? void 0 : normalized;
}
function firstSentence$1(value) {
	return (/^(.*?[.!?])(?:\s|$)/.exec(value)?.[1] ?? value).trim();
}
function rawJsDoc(node) {
	const sourceFile = node.getSourceFile();
	const source = sourceFile.getFullText();
	const range = ts.getLeadingCommentRanges(source, node.getFullStart()).filter((candidate) => source.slice(candidate.pos, candidate.pos + 3) === "/**").at(-1);
	const raw = source.slice(range.pos, range.end);
	const { line } = sourceFile.getLineAndCharacterOfPosition(range.pos);
	const lineStart = sourceFile.getPositionOfLineAndCharacter(line, 0);
	const indent = source.slice(lineStart, range.pos);
	return raw.split("\n").map((text, index) => index > 0 && text.startsWith(indent) ? text.slice(indent.length) : text).join("\n");
}
function typertMode(node) {
	for (const tag of ts.getJSDocTags(node)) {
		if (tag.tagName.text !== "typert") continue;
		const mode = (ts.getTextOfJSDocComment(tag.comment) ?? "").trim().split(/\s+/, 1)[0];
		if (mode === "object") return "object";
		if (mode === "" || mode === "schema" || mode === "type") return "schema";
	}
}
function memberName(name) {
	if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
	if (ts.isComputedPropertyName(name)) return `[${name.expression.getText()}]`;
	return name.getText();
}
function visibilityOf(node) {
	if ("name" in node && node.name !== void 0 && ts.isPrivateIdentifier(node.name)) return "private";
	if (hasModifier(node, ts.SyntaxKind.PrivateKeyword)) return "private";
	if (hasModifier(node, ts.SyntaxKind.ProtectedKeyword)) return "protected";
	return "public";
}
function hasModifier(node, kind) {
	return (ts.canHaveModifiers(node) ? ts.getModifiers(node) : void 0)?.some((modifier) => modifier.kind === kind) ?? false;
}
function exposableMember(member) {
	return member.visibility === "public" && !member.static;
}
function keywordName(kind) {
	switch (kind) {
		case ts.SyntaxKind.AnyKeyword: return "any";
		case ts.SyntaxKind.BigIntKeyword: return "bigint";
		case ts.SyntaxKind.BooleanKeyword: return "boolean";
		case ts.SyntaxKind.NeverKeyword: return "never";
		case ts.SyntaxKind.NumberKeyword: return "number";
		case ts.SyntaxKind.ObjectKeyword: return "object";
		case ts.SyntaxKind.StringKeyword: return "string";
		case ts.SyntaxKind.SymbolKeyword: return "symbol";
		case ts.SyntaxKind.UndefinedKeyword: return "undefined";
		case ts.SyntaxKind.UnknownKeyword: return "unknown";
		case ts.SyntaxKind.VoidKeyword: return "void";
		default: return;
	}
}
function literalModel(node) {
	const literal = node.literal;
	if (ts.isStringLiteral(literal)) return {
		kind: "literal",
		value: literal.text,
		text: literal.getText()
	};
	if (ts.isNoSubstitutionTemplateLiteral(literal)) return {
		kind: "literal",
		value: literal.text,
		text: literal.getText()
	};
	if (ts.isNumericLiteral(literal)) return {
		kind: "literal",
		value: Number(literal.text),
		text: literal.getText()
	};
	if (ts.isBigIntLiteral(literal)) return {
		kind: "literal",
		value: BigInt(literal.text.slice(0, -1)),
		text: literal.getText()
	};
	if (literal.kind === ts.SyntaxKind.TrueKeyword) return {
		kind: "literal",
		value: true,
		text: "true"
	};
	if (literal.kind === ts.SyntaxKind.FalseKeyword) return {
		kind: "literal",
		value: false,
		text: "false"
	};
	if (literal.kind === ts.SyntaxKind.NullKeyword) return {
		kind: "literal",
		value: null,
		text: "null"
	};
	/* v8 ignore else -- all remaining LiteralTypeNode syntax is a signed numeric or bigint literal. */
	if (ts.isPrefixUnaryExpression(literal) && (ts.isNumericLiteral(literal.operand) || ts.isBigIntLiteral(literal.operand))) return {
		kind: "literal",
		value: ts.isBigIntLiteral(literal.operand) ? BigInt(literal.getText().slice(0, -1)) : Number(literal.getText()),
		text: literal.getText()
	};
	/* v8 ignore next -- TypeScript's LiteralTypeNode grammar is exhausted above; this contains future compiler syntax. */
	throw new TypertAnalysisError(`typert: unsupported literal type ${literal.getText()}`);
}
function modifierMode(token) {
	if (token?.kind === ts.SyntaxKind.PlusToken) return "add";
	if (token?.kind === ts.SyntaxKind.MinusToken) return "remove";
	return token === void 0 ? "preserve" : "add";
}
function annotationPosition(node, purpose) {
	if (purpose === "return") return node.parameters.end + 1;
	return node.name.end;
}
function moduleSpecifierOf(node) {
	if (ts.isImportTypeNode(node)) return node.argument.literal.text;
	const symbol = ts.isTypeReferenceNode(node) ? node.typeName : node.expression;
	const sourceFile = node.getSourceFile();
	const first = ts.isIdentifier(symbol) ? symbol.text : symbol.getFirstToken(sourceFile)?.getText(sourceFile);
	for (const statement of sourceFile.statements) {
		if (!ts.isImportDeclaration(statement) || statement.importClause === void 0 || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
		if (statement.importClause.name?.text === first) return statement.moduleSpecifier.text;
		const bindings = statement.importClause.namedBindings;
		if (bindings !== void 0 && ts.isNamespaceImport(bindings) && bindings.name.text === first) return statement.moduleSpecifier.text;
		if (bindings !== void 0 && ts.isNamedImports(bindings) && bindings.elements.some((element) => element.name.text === first)) return statement.moduleSpecifier.text;
	}
}
function authoredExportName(node, moduleSpecifier) {
	if (ts.isImportTypeNode(node)) return node.qualifier.getText().split(".")[0];
	const referenced = ts.isTypeReferenceNode(node) ? node.typeName.getText().split(".") : node.expression.getText().split(".");
	const localName = referenced[0];
	for (const statement of node.getSourceFile().statements) {
		if (!ts.isImportDeclaration(statement) || statement.importClause === void 0 || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== moduleSpecifier) continue;
		if (statement.importClause.name?.text === localName) return "default";
		const bindings = statement.importClause.namedBindings;
		if (bindings !== void 0 && ts.isNamedImports(bindings)) {
			const imported = bindings.elements.find((element) => element.name.text === localName);
			if (imported !== void 0) return imported.propertyName?.text ?? imported.name.text;
		}
		if (bindings !== void 0 && ts.isNamespaceImport(bindings) && bindings.name.text === localName) return referenced[1];
	}
	/* v8 ignore next -- moduleSpecifierOf returns only the matching import inspected by this loop. */
	throw new TypertAnalysisError(`typert: cannot recover export name for ${localName} from ${moduleSpecifier}`);
}
function importTypeAttributesText(node) {
	const sourceFile = node.getSourceFile();
	const children = node.getChildren(sourceFile);
	const comma = children.find((child) => child.kind === ts.SyntaxKind.CommaToken);
	const close = children.find((child) => child.kind === ts.SyntaxKind.CloseParenToken);
	return sourceFile.text.slice(comma.end, close.pos).trim();
}
function moduleIdentity(specifier) {
	if (specifier.startsWith(".") || specifier.startsWith("/")) return void 0;
	const parts = specifier.split("/");
	const packageLength = specifier.startsWith("@") ? 2 : 1;
	const packageName = parts.slice(0, packageLength).join("/");
	const rest = parts.slice(packageLength).join("/");
	return {
		package: packageName,
		subpath: rest.length === 0 ? "." : `./${rest}`
	};
}
function externalModuleIdentityForFile(file) {
	const normalized = slash(file);
	const index = normalized.lastIndexOf("/node_modules/");
	if (index < 0) return void 0;
	const parts = normalized.slice(index + 14).split("/");
	const packageLength = parts[0].startsWith("@") ? 2 : 1;
	return {
		package: parts.slice(0, packageLength).join("/"),
		subpath: "."
	};
}
function isStandardLibraryFile(file) {
	const base = file.replaceAll("\\", "/");
	return /\/typescript\/lib\/lib\.[^/]+\.d\.ts$/.test(base);
}
function formatDiagnostic(diagnostic) {
	return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
}
function formatProgramDiagnostic(root, face, diagnostic) {
	const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
	const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
	return `typert(${face}): ${slash(relative(root, diagnostic.file.fileName))}:${String(position.line + 1)}:${String(position.character + 1)}: TypeScript TS${String(diagnostic.code)}: ${message}`;
}
const realPathCache = /* @__PURE__ */ new Map();
function realPath(path) {
	const absolute = resolve(path);
	const cached = realPathCache.get(absolute);
	if (cached !== void 0) return cached;
	if (!existsSync(absolute)) return absolute;
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
	return value.replaceAll("\\", "/");
}
function uniqueBy(values, key) {
	const result = /* @__PURE__ */ new Map();
	for (const value of values) if (!result.has(key(value))) result.set(key(value), value);
	return [...result.values()];
}
function compareCrossFaceLinks(left, right) {
	return left.fromFace.localeCompare(right.fromFace) || left.fromPackage.localeCompare(right.fromPackage) || left.toFace.localeCompare(right.toFace) || left.toPackage.localeCompare(right.toPackage) || left.subpath.localeCompare(right.subpath) || left.name.localeCompare(right.name);
}
//#endregion
//#region lib/types/model.js
/**
* Compiler-independent Typert analysis model. TypeScript nodes and checker
* objects are extraction inputs only; emitters consume this graph.
* @module @deepseek-ai/dsh-typert-generator/model
*/
/**
* Return the direct type-expression edges owned by one node.
* @param node - compiler-independent type node to inspect.
* @returns graph-local ids of its direct child type nodes.
*/
function childTypeNodeIds(node) {
	switch (node.kind) {
		case "parenthesized":
		case "operator": return [node.type];
		case "reference": return [...node.arguments];
		case "union":
		case "intersection": return [...node.types];
		case "array": return [node.element];
		case "tuple": return node.elements.map((element) => element.type);
		case "indexed-access": return [node.object, node.index];
		case "conditional": return [
			node.check,
			node.extends,
			node.whenTrue,
			node.whenFalse
		];
		case "mapped": return [
			...node.parameter.constraint === void 0 ? [] : [node.parameter.constraint],
			...node.parameter.default === void 0 ? [] : [node.parameter.default],
			...node.nameType !== void 0 ? [node.nameType] : [],
			...node.value === void 0 ? [] : [node.value]
		];
		case "template-literal": return node.spans.map((span) => span.type);
		case "type-query":
		case "import-type": return [...node.arguments];
		case "predicate": return node.type === void 0 ? [] : [node.type];
		case "infer": return [...node.parameter.constraint === void 0 ? [] : [node.parameter.constraint], ...node.parameter.default === void 0 ? [] : [node.parameter.default]];
		case "keyword":
		case "literal":
		case "object":
		case "function":
		case "constructor":
		case "this": return [];
		default: return assertNever$1(node);
	}
}
function assertNever$1(value) {
	throw new Error(`unsupported model variant ${JSON.stringify(value)}`);
}
//#endregion
//#region lib/types/renderer.js
/**
* Rendering and traversal over the compiler-independent TypeGraph. Emitters
* use this module instead of reaching back into TypeScript AST nodes.
* @module @deepseek-ai/dsh-typert-generator/renderer
*/
/** Failure to render or traverse an internally inconsistent TypeGraph. */
var TypeGraphRenderError = class extends Error {
	name = "TypeGraphRenderError";
};
/** Read and render one TypeGraph without compiler objects. */
var TypeGraphRenderer = class {
	graph;
	nodes;
	declarations;
	members;
	parameterNames = /* @__PURE__ */ new Map();
	/**
	* Index one complete graph.
	* @param graph - compiler-independent graph to render.
	*/
	constructor(graph) {
		this.graph = graph;
		this.nodes = new Map(graph.nodes.map((node) => [node.id, node]));
		this.declarations = new Map(graph.declarations.map((declaration) => [declaration.id, declaration]));
		this.members = new Map(graph.declarations.flatMap((declaration) => declaration.members.map((member) => [member.id, member])));
		for (const declaration of graph.declarations) {
			this.indexParameters(declaration.typeParameters);
			for (const member of declaration.members) if ("signature" in member) this.indexParameters(member.signature.typeParameters);
		}
	}
	/**
	* Resolve a node id or fail with the broken edge.
	* @param id - graph-local type node id.
	* @returns the referenced node.
	*/
	node(id) {
		const node = this.nodes.get(id);
		if (node === void 0) throw new TypeGraphRenderError(`type graph references missing node ${id}`);
		return node;
	}
	/**
	* Resolve a declaration id or fail with the broken edge.
	* @param id - workspace symbol id.
	* @returns the referenced declaration.
	*/
	declaration(id) {
		const declaration = this.declarations.get(id);
		if (declaration === void 0) throw new TypeGraphRenderError(`type graph references missing declaration ${id}`);
		return declaration;
	}
	/**
	* Resolve a public member id.
	* @param id - declaration member id.
	* @returns the referenced member.
	*/
	member(id) {
		const member = this.members.get(id);
		if (member === void 0) throw new TypeGraphRenderError(`type graph references missing member ${id}`);
		return member;
	}
	/**
	* Render one type expression from the retained source structure.
	* @param id - type node id.
	* @returns TypeScript type text.
	*/
	renderType(id) {
		const node = this.node(id);
		switch (node.kind) {
			case "keyword": return node.name;
			case "literal": return node.text;
			case "parenthesized": return `(${this.renderType(node.type)})`;
			case "reference": {
				const name = node.target.kind === "type-parameter" ? this.parameterNames.get(node.target.parameter) ?? node.name : node.name;
				return node.arguments.length === 0 ? name : `${name}<${node.arguments.map((argument) => this.renderType(argument)).join(", ")}>`;
			}
			case "union": return node.types.map((type) => this.renderType(type)).join(" | ");
			case "intersection": return node.types.map((type) => this.renderType(type)).join(" & ");
			case "array": {
				const element = this.renderType(node.element);
				return `${needsArrayParentheses(this.node(node.element)) ? `(${element})` : element}[]`;
			}
			case "tuple": return `[${node.elements.map((element) => {
				const type = this.renderType(element.type);
				if (element.name !== void 0) return `${element.rest ? "..." : ""}${element.name}${element.optional ? "?" : ""}: ${type}`;
				return `${element.rest ? "..." : ""}${type}${element.optional ? "?" : ""}`;
			}).join(", ")}]`;
			case "object": return this.renderObject(node.members);
			case "function": return `${this.renderSignatureHead(node.signature)} => ${this.renderType(node.signature.returns)}`;
			case "constructor": return `${node.abstract ? "abstract " : ""}new ${this.renderSignatureHead(node.signature)} => ${this.renderType(node.signature.returns)}`;
			case "indexed-access": return `${this.renderType(node.object)}[${this.renderType(node.index)}]`;
			case "operator": return `${node.operator} ${this.renderType(node.type)}`;
			case "conditional": return `${this.renderType(node.check)} extends ${this.renderType(node.extends)} ? ${this.renderType(node.whenTrue)} : ${this.renderType(node.whenFalse)}`;
			case "infer": return `infer ${this.renderTypeParameter(node.parameter, false)}`;
			case "mapped": {
				const readonly = node.readonly === "preserve" ? "" : node.readonly === "remove" ? "-readonly " : "readonly ";
				const optional = node.optional === "preserve" ? "" : node.optional === "remove" ? "-?" : "?";
				if (node.parameter.constraint === void 0) throw new TypeGraphRenderError(`mapped type parameter ${node.parameter.name} has no constraint`);
				return `{ ${readonly}[${`${node.parameter.name} in ${this.renderType(node.parameter.constraint)}`}${node.nameType === void 0 ? "" : ` as ${this.renderType(node.nameType)}`}]${optional}: ${node.value === void 0 ? "unknown" : this.renderType(node.value)} }`;
			}
			case "template-literal": {
				const spans = node.spans.map((span) => `\${${this.renderType(span.type)}}${escapeTemplate(span.text)}`).join("");
				return `\`${escapeTemplate(node.head)}${spans}\``;
			}
			case "type-query": {
				const argumentsText = node.arguments.length === 0 ? "" : `<${node.arguments.map((argument) => this.renderType(argument)).join(", ")}>`;
				return `typeof ${node.expression}${argumentsText}`;
			}
			case "import-type": {
				const attributes = node.attributes === void 0 ? "" : `, ${node.attributes}`;
				const imported = `import(${quote$2(node.module)}${attributes})${node.qualifier === void 0 ? "" : `.${node.qualifier}`}`;
				const argumentsText = node.arguments.length === 0 ? "" : `<${node.arguments.map((argument) => this.renderType(argument)).join(", ")}>`;
				return `${node.typeof ? "typeof " : ""}${imported}${argumentsText}`;
			}
			case "predicate": {
				const assertion = node.asserts ? "asserts " : "";
				return node.type === void 0 ? `${assertion}${node.parameter}` : `${assertion}${node.parameter} is ${this.renderType(node.type)}`;
			}
			case "this": return "this";
			default: return assertNever(node);
		}
	}
	/**
	* Render a callable signature without a member name.
	* @param signature - modeled signature.
	* @returns parameter list and return type.
	*/
	renderSignature(signature) {
		return `${this.renderSignatureHead(signature)}: ${this.renderType(signature.returns)}`;
	}
	/**
	* Render one class/interface member as a body-free declaration.
	* @param member - modeled member.
	* @param sourceModifiers - retain source-only modifiers for reflection text.
	* @returns one-line TypeScript member text.
	*/
	renderMember(member, sourceModifiers = false) {
		if (sourceModifiers) return member.text;
		const name = renderPropertyName(member.name);
		const optional = member.optional ? "?" : "";
		const readonly = member.readonly ? "readonly " : "";
		const abstract = member.abstract ? "abstract " : "";
		switch (member.kind) {
			case "property": return `${abstract}${readonly}${name}${optional}: ${this.renderType(member.type)}`;
			case "method": return `${abstract}${name}${optional}${this.renderSignature(member.signature)}`;
			case "getter": return `${abstract}get ${name}()${this.renderReturn(member.signature)}`;
			case "setter": return `${abstract}set ${name}${this.renderSignatureHead(member.signature)}`;
			case "call": return this.renderSignature(member.signature);
			case "construct": return `new ${this.renderSignature(member.signature)}`;
			case "index": return `${readonly}[${member.signature.parameters.map((parameter) => this.renderParameter(parameter)).join(", ")}]: ${this.renderType(member.signature.returns)}`;
			default: return assertNever(member);
		}
	}
	/**
	* Render a named declaration without JSDoc.
	* @param id - declaration symbol id.
	* @returns exported TypeScript declaration text.
	*/
	renderDeclaration(id) {
		const declaration = this.declaration(id);
		const parameters = this.renderTypeParameters(declaration.typeParameters);
		if (declaration.kind === "enum") {
			const members = declaration.enumMembers?.map((member) => `    ${renderPropertyName(member.name)}${member.initializer === void 0 ? "" : ` = ${member.initializer}`},`) ?? [];
			return [
				`export enum ${declaration.name} {`,
				...members,
				"}"
			].join("\n");
		}
		if (declaration.kind === "alias") {
			if (declaration.type === void 0) throw new TypeGraphRenderError(`alias ${id} has no type node`);
			return `export type ${declaration.name}${parameters} = ${this.renderType(declaration.type)};`;
		}
		const extendsTypes = declaration.extends.map((type) => this.renderType(type));
		const implementsTypes = declaration.implements.map((type) => this.renderType(type));
		const heritage = [extendsTypes.length === 0 ? "" : ` extends ${extendsTypes.join(", ")}`, implementsTypes.length === 0 ? "" : ` implements ${implementsTypes.join(", ")}`].join("");
		const prefix = declaration.kind === "class" && declaration.abstract ? "abstract " : "";
		const members = declaration.members.map((member) => `    ${this.renderMember(member)};`);
		return [
			`export ${prefix}${declaration.kind} ${declaration.name}${parameters}${heritage} {`,
			...members,
			"}"
		].join("\n");
	}
	/**
	* Find the transitive declaration closure referenced by members.
	* @param memberIds - business-surface member ids.
	* @returns declarations in graph order, excluding no roots implicitly.
	*/
	declarationClosureForMembers(memberIds) {
		return this.declarationClosure(memberIds, []);
	}
	/**
	* Find the transitive declaration closure referenced by type roots.
	* @param typeIds - graph type roots.
	* @returns declarations in graph order.
	*/
	declarationClosureForTypes(typeIds) {
		return this.declarationClosure([], typeIds);
	}
	declarationClosure(memberIds, typeIds) {
		const found = /* @__PURE__ */ new Set();
		const visiting = /* @__PURE__ */ new Set();
		const visitNode = (id) => {
			const node = this.node(id);
			if (node.kind === "reference" && node.target.kind === "declaration") visitDeclaration(node.target.symbol);
			if (node.kind === "import-type" && node.target?.kind === "declaration") visitDeclaration(node.target.symbol);
			for (const child of childTypeNodeIds(node)) visitNode(child);
			for (const signature of nodeSignatures(node)) visitSignature(signature);
			if (node.kind === "object") for (const member of node.members) visitMember(member);
		};
		const visitSignature = (signature) => {
			for (const parameter of signature.typeParameters) {
				if (parameter.constraint !== void 0) visitNode(parameter.constraint);
				if (parameter.default !== void 0) visitNode(parameter.default);
			}
			for (const parameter of signature.parameters) visitNode(parameter.type);
			visitNode(signature.returns);
		};
		const visitMember = (member) => {
			if (member.kind === "property") visitNode(member.type);
			else visitSignature(member.signature);
		};
		const visitDeclaration = (id) => {
			if (found.has(id) || visiting.has(id)) return;
			visiting.add(id);
			const declaration = this.declaration(id);
			for (const parameter of declaration.typeParameters) {
				if (parameter.constraint !== void 0) visitNode(parameter.constraint);
				if (parameter.default !== void 0) visitNode(parameter.default);
			}
			for (const type of [...declaration.extends, ...declaration.implements]) visitNode(type);
			if (declaration.type !== void 0) visitNode(declaration.type);
			for (const member of declaration.members) visitMember(member);
			visiting.delete(id);
			found.add(id);
		};
		for (const id of memberIds) visitMember(this.member(id));
		for (const id of typeIds) visitNode(id);
		return this.graph.declarations.filter((declaration) => found.has(declaration.id));
	}
	renderSignatureHead(signature) {
		return `${this.renderTypeParameters(signature.typeParameters)}(${signature.parameters.map((parameter) => this.renderParameter(parameter)).join(", ")})`;
	}
	renderReturn(signature) {
		return `: ${this.renderType(signature.returns)}`;
	}
	renderParameter(parameter) {
		const name = parameter.binding === "identifier" ? renderPropertyName(parameter.name) : parameter.name;
		const optional = parameter.initializer === void 0 && parameter.optional && !parameter.rest ? "?" : "";
		const initializer = parameter.initializer === void 0 ? "" : ` = ${parameter.initializer}`;
		return `${parameter.rest ? "..." : ""}${name}${optional}: ${this.renderType(parameter.type)}${initializer}`;
	}
	renderTypeParameters(parameters) {
		return parameters.length === 0 ? "" : `<${parameters.map((parameter) => this.renderTypeParameter(parameter, true)).join(", ")}>`;
	}
	renderTypeParameter(parameter, includeDefault) {
		const variance = parameter.variance === void 0 ? "" : `${parameter.variance === "in-out" ? "in out" : parameter.variance} `;
		const constModifier = parameter.const ? "const " : "";
		const constraint = parameter.constraint === void 0 ? "" : ` extends ${this.renderType(parameter.constraint)}`;
		const fallback = !includeDefault || parameter.default === void 0 ? "" : ` = ${this.renderType(parameter.default)}`;
		return `${constModifier}${variance}${parameter.name}${constraint}${fallback}`;
	}
	renderObject(members) {
		if (members.length === 0) return "{}";
		return `{ ${members.map((member) => `${this.renderMember(member)};`).join(" ")} }`;
	}
	indexParameters(parameters) {
		for (const parameter of parameters) this.parameterNames.set(parameter.id, parameter.name);
	}
};
function nodeSignatures(node) {
	return node.kind === "function" || node.kind === "constructor" ? [node.signature] : [];
}
function needsArrayParentheses(node) {
	return node.kind === "union" || node.kind === "intersection" || node.kind === "function" || node.kind === "constructor" || node.kind === "conditional";
}
function renderPropertyName(name) {
	if (name.startsWith("[") && name.endsWith("]")) return name;
	if (/^(?:[$A-Z_a-z][$\w]*|\d+)$/u.test(name)) return name;
	return quote$2(name);
}
function quote$2(value) {
	return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll("\n", "\\n")}'`;
}
function escapeTemplate(value) {
	return value.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");
}
function assertNever(value) {
	throw new TypeGraphRenderError(`unsupported model variant ${JSON.stringify(value)}`);
}
//#endregion
//#region lib/types/emitter.js
/**
* Model-driven Typert artifact emitter. It consumes only FaceModel and
* TypeGraph data; TypeScript compiler nodes are not part of this boundary.
* @module @deepseek-ai/dsh-typert-generator/emitter
*/
/** Failure to project a modeled construct into an emitted artifact. */
var TypertEmitError = class extends Error {
	name = "TypertEmitError";
};
/** Emit generated runtime and type artifacts from one independently analyzed face. */
var FaceModelEmitter = class {
	face;
	renderer;
	/**
	* Create an emitter for one face graph.
	* @param face - independently analyzed face.
	*/
	constructor(face) {
		this.face = face;
		this.renderer = new TypeGraphRenderer(face.graph);
	}
	/**
	* Emit one modeled package.
	* @param packageName - exact package name in the face model.
	* @returns executable JavaScript and its precise declaration file.
	*/
	emit(packageName) {
		const packageModel = this.face.packages.find((candidate) => candidate.name === packageName);
		if (packageModel === void 0) throw new TypertEmitError(`typert emitter(${this.face.face}): package ${packageName} is not modeled on this face`);
		const schemaArtifact = new SchemaEmitter(this.renderer, packageModel.schemas).emit();
		const runtimeModel = this.runtimeModel(packageModel);
		const js = this.renderJs(packageModel, schemaArtifact, runtimeModel);
		const dts = this.renderDts(packageModel, schemaArtifact);
		return {
			package: packageName,
			face: this.face.face,
			exports: packageModel.schemas.map((schema) => schema.export.name),
			js,
			dts
		};
	}
	runtimeModel(packageModel) {
		return {
			services: packageModel.services.map((service) => {
				const members = service.members.map((id) => this.runtimeMember(this.renderer.member(id)));
				return {
					...documentationLiteral(service),
					key: service.key,
					exportName: service.export.name,
					members,
					types: this.runtimeTypes(this.renderer.declarationClosureForMembers(service.members), service.symbol)
				};
			}),
			events: packageModel.events.map((event) => {
				const node = this.renderer.node(event.signature);
				if (node.kind !== "function") throw new TypertEmitError(`typert emitter(${this.face.face}): event ${event.name} is not a function type`);
				return {
					...documentationLiteral(event),
					name: event.name,
					...event.mode === void 0 ? {} : { mode: event.mode },
					signature: `${quote$1(event.name)}${this.renderer.renderSignature(node.signature)}`
				};
			}),
			objects: packageModel.objects.map((object) => {
				const declaration = this.renderer.declaration(object.symbol);
				return {
					...documentationLiteral(object),
					name: declaration.name,
					exportName: object.export.name,
					members: declaration.members.map((member) => this.runtimeMember(member)),
					types: this.runtimeTypes(this.renderer.declarationClosureForMembers(declaration.members.map((member) => member.id)), declaration.id)
				};
			})
		};
	}
	runtimeMember(member) {
		return {
			kind: member.kind,
			name: member.name,
			signature: this.renderer.renderMember(member, true),
			...member.summary === void 0 ? {} : { summary: member.summary },
			...member.jsDoc === void 0 ? {} : { jsDoc: member.jsDoc }
		};
	}
	runtimeTypes(declarations, root) {
		return declarations.filter((declaration) => declaration.id !== root).map((declaration) => ({
			name: declaration.name,
			declaration: this.renderer.renderDeclaration(declaration.id)
		})).sort((left, right) => left.name.localeCompare(right.name));
	}
	renderJs(packageModel, schemas, runtimeModel) {
		const lines = ["/* Generated by @deepseek-ai/dsh-typert-generator from FaceModel — do not edit. */"];
		if (schemas.definitions.length > 0) lines.push("import { z } from 'zod'", "");
		lines.push(...schemas.definitions);
		if (schemas.definitions.length > 0) lines.push("");
		for (const schema of schemas.exports) lines.push(`export const ${schema.exportName} = ${schema.internalName}`);
		if (schemas.exports.length > 0) lines.push("");
		const model = JSON.stringify(runtimeModel, null, 2);
		lines.push("export const TYPERT = {");
		lines.push(`  package: ${quote$1(packageModel.name)},`);
		lines.push(`  face: ${quote$1(this.face.face)},`);
		lines.push("  schemas: [");
		for (const schema of schemas.exports) lines.push(`    { name: ${quote$1(schema.exportName)}, schema: ${schema.exportName} },`);
		lines.push("  ],");
		lines.push(`  model: ${indent(model, 2).trimStart()},`);
		lines.push("}");
		return `${lines.join("\n")}\n`;
	}
	renderDts(packageModel, schemas) {
		const imports = /* @__PURE__ */ new Map();
		for (const schema of schemas.exports) {
			const specifier = packageExportSpecifier(packageModel.name, schema.model.export.subpath);
			const names = imports.get(specifier) ?? [];
			names.push(`${schema.model.export.name} as ${schema.exportName}$source`);
			imports.set(specifier, names);
		}
		const lines = ["/* Generated by @deepseek-ai/dsh-typert-generator from FaceModel — do not edit. */"];
		if (schemas.exports.length > 0) lines.splice(1, 0, "import type { z } from 'zod'");
		for (const [specifier, names] of [...imports].sort(([left], [right]) => left.localeCompare(right))) lines.push(`import type { ${names.sort().join(", ")} } from ${quote$1(specifier)}`);
		lines.push("");
		for (const schema of schemas.exports) lines.push(`export declare const ${schema.exportName}: z.ZodType<${schema.exportName}$source>`);
		if (schemas.exports.length > 0) lines.push("");
		lines.push("export declare const TYPERT: unknown");
		return `${lines.join("\n")}\n`;
	}
};
var SchemaEmitter = class {
	renderer;
	schemas;
	names = /* @__PURE__ */ new Map();
	declarations;
	constructor(renderer, schemas) {
		this.renderer = renderer;
		this.schemas = schemas;
		const declarations = /* @__PURE__ */ new Map();
		for (const schema of schemas) for (const declaration of renderer.declarationClosureForTypes([schema.type])) declarations.set(declaration.id, declaration);
		this.declarations = renderer.graph.declarations.filter((declaration) => declarations.has(declaration.id));
		const identifiers = /* @__PURE__ */ new Set();
		for (const declaration of this.declarations) {
			const base = `${safeIdentifier(declaration.name)}$schema`;
			let name = base;
			let suffix = 2;
			while (identifiers.has(name)) name = `${base}${String(suffix++)}`;
			identifiers.add(name);
			this.names.set(declaration.id, name);
		}
	}
	emit() {
		return {
			definitions: this.declarations.map((declaration) => {
				if (declaration.typeParameters.length > 0) this.fail(declaration.name, "generic declarations require a schema-factory projection");
				return `const ${this.schemaName(declaration.id)} = ${this.declarationSchema(declaration)}`;
			}),
			exports: this.schemas.map((model) => ({
				model,
				exportName: safeIdentifier(model.export.name),
				internalName: this.schemaName(model.symbol)
			}))
		};
	}
	declarationSchema(declaration) {
		if (declaration.kind === "enum") this.fail(declaration.name, "enum declarations have no Zod projection");
		if (declaration.kind === "alias") {
			if (declaration.type === void 0) this.fail(declaration.name, "alias has no modeled type");
			return this.describe(this.typeSchema(declaration.type), declaration);
		}
		let result = this.objectSchema(declaration.members, declaration.name);
		for (const heritage of declaration.extends) result = `z.intersection(${this.typeSchema(heritage)}, ${result})`;
		return this.describe(result, declaration);
	}
	typeSchema(id) {
		const node = this.renderer.node(id);
		switch (node.kind) {
			case "keyword": return this.keywordSchema(node.name);
			case "literal": return `z.literal(${node.text})`;
			case "parenthesized": return this.typeSchema(node.type);
			case "reference": return this.referenceSchema(node);
			case "union":
				if (node.types.length === 0) return "z.never()";
				if (node.types.length === 1) return this.typeSchema(node.types[0]);
				return `z.union([${node.types.map((type) => this.typeSchema(type)).join(", ")}])`;
			case "intersection": {
				const [head, ...tail] = node.types;
				if (head === void 0) return "z.unknown()";
				return tail.reduce((left, right) => `z.intersection(${left}, ${this.typeSchema(right)})`, this.typeSchema(head));
			}
			case "array": return `z.array(${this.typeSchema(node.element)})`;
			case "tuple": {
				const fixed = node.elements.filter((element) => !element.rest);
				const rest = node.elements.find((element) => element.rest);
				let schema = `z.tuple([${fixed.map((element) => this.optional(this.typeSchema(element.type), element.optional)).join(", ")}])`;
				if (rest !== void 0) schema += `.rest(${this.tupleRestSchema(rest.type)})`;
				return schema;
			}
			case "object": return this.objectSchema(node.members, id);
			case "operator":
			case "indexed-access":
			case "conditional":
			case "infer":
			case "mapped":
			case "template-literal":
			case "type-query":
			case "import-type":
			case "predicate":
			case "function":
			case "constructor":
			case "this": return this.unsupported(node);
		}
	}
	referenceSchema(node) {
		if (node.target.kind === "declaration") return `z.lazy(() => ${this.schemaName(node.target.symbol)})`;
		if (node.target.kind === "standard") switch (node.target.name) {
			case "Array":
			case "ReadonlyArray": {
				const element = node.arguments[0];
				if (element === void 0) this.fail(node.name, "array reference has no element type");
				return this.readonly(`z.array(${this.typeSchema(element)})`, node.target.name === "ReadonlyArray");
			}
			case "Record": {
				const key = node.arguments[0];
				const value = node.arguments[1];
				if (key === void 0 || value === void 0) this.fail(node.name, "Record requires key and value types");
				return `z.record(${this.typeSchema(key)}, ${this.typeSchema(value)})`;
			}
			case "Date": return "z.date()";
			default: this.fail(node.name, `standard type ${node.target.name} has no Zod projection`);
		}
		this.fail(node.name, `${node.target.kind} reference has no Zod projection`);
	}
	tupleRestSchema(id) {
		const node = this.renderer.node(id);
		if (node.kind === "array") return this.typeSchema(node.element);
		if (node.kind === "reference" && node.target.kind === "standard" && (node.target.name === "Array" || node.target.name === "ReadonlyArray")) {
			const element = node.arguments[0];
			if (element === void 0) this.fail(node.name, "tuple rest array has no element type");
			return this.typeSchema(element);
		}
		this.fail(id, "tuple rest element must retain an array type");
	}
	objectSchema(members, subject) {
		const properties = [];
		for (const member of members) {
			if (member.static || member.visibility !== "public") continue;
			if (member.kind !== "property") this.fail(subject, `${member.kind} member ${member.name} is not data-schema projectable`);
			const property = this.describe(this.optional(this.readonly(this.typeSchema(member.type), member.readonly), member.optional), member);
			properties.push(`${quote$1(member.name)}: ${property}`);
		}
		return `z.object({${properties.length === 0 ? "" : `\n${properties.map((property) => `  ${property},`).join("\n")}\n`}})`;
	}
	keywordSchema(name) {
		switch (name) {
			case "any": return "z.any()";
			case "unknown": return "z.unknown()";
			case "never": return "z.never()";
			case "string": return "z.string()";
			case "number": return "z.number()";
			case "bigint": return "z.bigint()";
			case "boolean": return "z.boolean()";
			case "symbol": return "z.symbol()";
			case "undefined": return "z.undefined()";
			case "void": return "z.void()";
			case "object": return "z.custom((value) => (typeof value === 'object' && value !== null) || typeof value === 'function')";
			default: this.fail(name, `keyword ${name} has no Zod projection`);
		}
	}
	schemaName(symbol) {
		const name = this.names.get(symbol);
		if (name === void 0) this.fail(symbol, "referenced declaration is outside the selected schema closure");
		return name;
	}
	describe(schema, documentation) {
		return documentation.description === void 0 ? schema : `${schema}.describe(${quote$1(documentation.description)})`;
	}
	optional(schema, optional) {
		return optional ? `${schema}.optional()` : schema;
	}
	readonly(schema, readonly) {
		return readonly ? `${schema}.readonly()` : schema;
	}
	unsupported(node) {
		this.fail(node.id, `type node ${node.kind} has no Zod projection`);
	}
	fail(subject, message) {
		throw new TypertEmitError(`typert Zod emitter: ${subject}: ${message}`);
	}
};
function documentationLiteral(documentation) {
	return {
		...documentation.description === void 0 ? {} : { description: documentation.description },
		...documentation.summary === void 0 ? {} : { summary: documentation.summary },
		tags: documentation.tags,
		...documentation.jsDoc === void 0 ? {} : { jsDoc: documentation.jsDoc }
	};
}
function packageExportSpecifier(packageName, subpath) {
	return subpath === "." ? packageName : `${packageName}${subpath.slice(1)}`;
}
function safeIdentifier(name) {
	const normalized = name.replace(/[^$\w]/gu, "_");
	if (/^[$A-Z_a-z]/u.test(normalized)) return normalized;
	return `_${normalized}`;
}
function quote$1(value) {
	return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll("\n", "\\n").replaceAll("\r", "\\r")}'`;
}
function indent(value, spaces) {
	const prefix = " ".repeat(spaces);
	return value.split("\n").map((line) => `${prefix}${line}`).join("\n");
}
//#endregion
//#region lib/types/cordis-catalog.js
/**
* Cordis catalog-specific projection over the compiler-independent Typert
* model. This module owns Cordis validation and text projection mechanics;
* callers supply repository-specific type classifications and inherited data.
* @module @deepseek-ai/dsh-typert-generator
*/
/** Append fail-closed signature type-link violations from the retained type tree. */
function checkTypeLinks(where, names, policy, violations) {
	for (const name of names) {
		if (Object.hasOwn(policy.linkedTypePages, name) || policy.foundationTypeNames.has(name) || Object.hasOwn(policy.typeLinkExemptions, name)) continue;
		violations.push(`${where} references unclassified type '${name}'. Add it to linkedTypePages with its documentation page, to foundationTypeNames if TypeScript or the framework owns it, or to typeLinkExemptions with the non-catalog documentation owner.`);
	}
}
/** Throw one aggregated diagnostic for every unclassified signature type. */
function reportTypeLinkViolations(gate, violations) {
	if (violations.length === 0) return;
	throw new Error(`${gate}: ${violations.length} signature type-link coverage violation(s):\n` + violations.map((violation) => `  ${violation}`).join("\n"));
}
/** Repository-specific Cordis validation and projection over one Typert face. */
var CordisCatalogProjector = class {
	face;
	sourceDeclarations;
	policy;
	renderer;
	/**
	* @param face - analyzed host face containing package business semantics.
	* @param sourceDeclarations - exported declarations available to the runtime type closure.
	* @param policy - caller-owned type classifications and inherited Cordis data.
	*/
	constructor(face, sourceDeclarations, policy) {
		this.face = face;
		this.sourceDeclarations = sourceDeclarations;
		this.policy = policy;
		if (face.face !== "host") throw new Error(`cordis catalog requires the host face, received ${face.face}`);
		this.renderer = new TypeGraphRenderer(face.graph);
	}
	/**
	* Validate and project the host model's Cordis surface.
	* @returns every validated service and event projected from the host model.
	*/
	project() {
		return {
			events: this.collectEvents(),
			services: this.collectServices()
		};
	}
	/**
	* Render the model-facing static API consumed by `tool-cordis`.
	* @param model - validated Cordis catalog projection from this projector.
	* @returns the model-facing TypeScript catalog source.
	*/
	renderRuntimeApi(model) {
		return renderRuntimeApi(model.services, model.events, this.runtimeTypes(model.services), this.policy.inheritedServices);
	}
	collectEvents() {
		const entries = [];
		const violations = [];
		const typeLinkViolations = [];
		for (const packageModel of this.face.packages) for (const event of packageModel.events) {
			const source = pointer(event.location);
			const where = `event '${event.name}' (${source})`;
			const node = this.renderer.node(event.signature);
			if (node.kind !== "function") {
				violations.push(`${where} is not represented by a callable type.`);
				continue;
			}
			checkTypeLinks(where, signatureTypeNames(this.renderer, node.signature), this.policy, typeLinkViolations);
			const parsed = parseJsDoc(event.jsDoc ?? "");
			const mode = event.mode;
			if (!isMode(mode)) violations.push(`${where} is missing an @mode tag. Add '@mode emit|waterfall|parallel|serial' to its JSDoc (see AGENTS.md).`);
			const last = node.signature.parameters.at(-1);
			const hasNext = last?.name === "next";
			if (isMode(mode) && hasNext && mode !== "waterfall") violations.push(`${where} has a trailing 'next' parameter (structurally a waterfall) but is tagged '@mode ${mode}'. Fix the tag or the signature.`);
			if (isMode(mode) && !hasNext && mode === "waterfall") violations.push(`${where} is tagged '@mode waterfall' but has no trailing 'next' parameter. A waterfall delegates via next().`);
			if (parsed.doc === "") violations.push(`${where} has no description prose. Say what happened / what a listener may do, above the block tags.`);
			checkParams(where, "event", node.signature.parameters, parsed.params, (parameter) => parameter.receiver || hasNext && parameter === last, violations);
			if (isMode(mode)) entries.push({
				name: event.name,
				scope: event.name.split("/")[0] ?? event.name,
				signature: event.text,
				jsDoc: event.jsDoc ?? "",
				mode,
				doc: parsed.doc,
				source
			});
		}
		reportViolations("gen-cordis-catalog", violations);
		reportTypeLinkViolations("gen-cordis-catalog", typeLinkViolations);
		return entries;
	}
	collectServices() {
		const entries = [];
		const violations = [];
		const typeLinkViolations = [];
		for (const packageModel of this.face.packages) for (const service of packageModel.services) {
			const declaration = this.renderer.declaration(service.symbol);
			if (declaration.kind !== "class" || !/^packages\/[^/]+\/[^/]+\/src\/index\.ts$/.test(service.location.file) || declaration.location.file !== service.location.file) continue;
			const doc = parseJsDoc(declaration.jsDoc ?? "").doc;
			const source = pointer(declaration.location);
			if (doc === "") violations.push(`service ctx.${service.key} (${source}): class ${declaration.name} has no JSDoc.`);
			const methods = [];
			for (const memberId of service.members) {
				const member = this.renderer.member(memberId);
				if (member.kind !== "method" || member.name.startsWith("[")) continue;
				const where = `service method ctx.${service.key}.${member.name} (${pointer(member.location)})`;
				checkTypeLinks(where, signatureTypeNames(this.renderer, member.signature), this.policy, typeLinkViolations);
				methods.push({
					signature: member.text,
					jsDoc: member.jsDoc ?? ""
				});
				if (member.jsDoc === void 0) {
					violations.push(`${where} has no JSDoc.`);
					continue;
				}
				const parsed = parseJsDoc(member.jsDoc);
				if (parsed.doc === "") violations.push(`${where} has no description prose above its block tags.`);
				checkParams(where, "service", member.signature.parameters, parsed.params, (parameter) => parameter.receiver, violations);
				checkReturns(where, member.signature, parsed.returns, this.renderer, violations);
			}
			entries.push({
				key: service.key,
				type: declaration.name,
				abstract: declaration.abstract,
				doc,
				methods,
				source
			});
		}
		reportViolations("gen-cordis-catalog", violations);
		reportTypeLinkViolations("gen-cordis-catalog", typeLinkViolations);
		return entries.sort((left, right) => left.key.localeCompare(right.key));
	}
	runtimeTypes(services) {
		const declarations = /* @__PURE__ */ new Map();
		const ambiguous = /* @__PURE__ */ new Set();
		for (const declaration of this.sourceDeclarations) {
			if (declaration.face !== "host" || declaration.kind === "enum" || !/^packages\/[^/]+\/[^/]+\/src\/[^/]+\.ts$/.test(declaration.location.file)) continue;
			if (declarations.has(declaration.name)) {
				ambiguous.add(declaration.name);
				continue;
			}
			declarations.set(declaration.name, declaration.text.length > MAX_DECL_CHARS ? `${declaration.text.slice(0, MAX_DECL_CHARS)} /* …truncated — full shape in source */` : declaration.text);
		}
		for (const name of ambiguous) declarations.delete(name);
		return referencedTypes(services.flatMap((service) => service.methods.map((method) => method.signature)), declarations);
	}
};
/**
* Analyze the host project once and return both the model and its projection.
* @param scanRoot - workspace root containing `tsconfig.host.json`.
* @param policy - caller-owned type classifications and inherited Cordis data.
* @returns the configured projector and its validated catalog model.
*/
function projectCordisCatalog(scanRoot, policy) {
	const caches = new WorkspaceCaches();
	const face = new WorkspaceAnalyzer({
		root: scanRoot,
		faces: ["host"],
		packages: new WorkspaceAnalyzer({
			root: scanRoot,
			faces: ["host"],
			checkDiagnostics: false,
			caches
		}).discoverPackages().filter((candidate) => candidate.faces.includes("host")).map((candidate) => candidate.package),
		checkDiagnostics: false,
		caches
	}).analyzeInBatches().faces.find((candidate) => candidate.face === "host");
	if (face === void 0) throw new Error("gen-cordis-catalog: Typert produced no host face");
	const projector = new CordisCatalogProjector(face, new WorkspaceAnalyzer({
		root: scanRoot,
		faces: ["host"],
		checkDiagnostics: false,
		caches
	}).indexSourceDeclarations(), policy);
	return {
		projector,
		model: projector.project()
	};
}
/**
* Collect all modeled events for relationship-document consumers.
* @param scanRoot - workspace root containing `tsconfig.host.json`.
* @param policy - caller-owned Cordis catalog policy.
* @returns all validated event entries.
*/
function collectEvents(scanRoot, policy) {
	return [...projectCordisCatalog(scanRoot, policy).model.events];
}
/**
* Collect all modeled services for relationship-document consumers.
* @param scanRoot - workspace root containing `tsconfig.host.json`.
* @param policy - caller-owned Cordis catalog policy.
* @returns all validated service entries.
*/
function collectServices(scanRoot, policy) {
	return [...projectCordisCatalog(scanRoot, policy).model.services];
}
function parseJsDoc(raw) {
	const lines = raw.replace(/^\/\*\*/, "").replace(/\*\/$/, "").split("\n").map((line) => line.replace(/^\s*\*?\s?/, "").replace(/\s+$/, ""));
	const blocks = [];
	let paragraph = [];
	let list = [];
	let item = [];
	let inTags = false;
	const join = (parts) => parts.join(" ").replace(/\s+/g, " ").trim();
	const flushItem = () => {
		if (item.length > 0) list.push(join(item));
		item = [];
	};
	const flushList = () => {
		flushItem();
		if (list.length > 0) blocks.push(list.join("\n"));
		list = [];
	};
	const flushParagraph = () => {
		flushList();
		if (paragraph.length > 0) blocks.push(join(paragraph));
		paragraph = [];
	};
	for (const line of lines) {
		if (line.trimStart().startsWith("@")) {
			flushParagraph();
			inTags = true;
			continue;
		}
		if (inTags) continue;
		if (line.trim() === "") {
			flushParagraph();
			continue;
		}
		if (/^-\s+/.test(line)) {
			flushItem();
			if (paragraph.length > 0) {
				blocks.push(join(paragraph));
				paragraph = [];
			}
			item.push(line);
			continue;
		}
		if (item.length > 0) item.push(line);
		else paragraph.push(line);
	}
	flushParagraph();
	const params = /* @__PURE__ */ new Map();
	let returns = null;
	let sink;
	for (const line of lines) {
		const param = /^@param\s+(\[?[\w$]+\]?)\s*(?:[-—–]\s*)?(.*)$/.exec(line);
		if (param !== null) {
			const name = (param[1] ?? "").replace(/^\[|\]$/g, "");
			let value = param[2] ?? "";
			params.set(name, value);
			sink = (text) => {
				value = value === "" ? text : `${value} ${text}`;
				params.set(name, value);
			};
			continue;
		}
		const returnsTag = /^@returns?(?:\s+[-—–]?\s*(.*))?$/.exec(line);
		if (returnsTag !== null) {
			let value = returnsTag[1] ?? "";
			returns = value;
			sink = (text) => {
				value = value === "" ? text : `${value} ${text}`;
				returns = value;
			};
			continue;
		}
		if (line.startsWith("@") || line.trim() === "") sink = void 0;
		else sink?.(line.trim());
	}
	return {
		doc: blocks.join("\n\n").replace(/\{@link\s+([^}]+)\}/g, "$1").trim(),
		params,
		returns
	};
}
function checkParams(where, surface, parameters, tags, isExempt, violations) {
	for (const parameter of parameters) {
		if (parameter.binding !== "identifier") {
			violations.push(`${where}: parameter '${parameter.name}' is a binding pattern; the ${surface} surface needs simple identifier parameters so @param can name them.`);
			continue;
		}
		if (isExempt(parameter)) continue;
		const description = tags.get(parameter.name);
		if (description === void 0) violations.push(`${where} is missing @param ${parameter.name}.`);
		else if (description.trim() === "") violations.push(`${where}: @param ${parameter.name} has an empty description.`);
	}
	for (const tag of tags.keys()) if (!parameters.some((parameter) => parameter.binding === "identifier" && parameter.name === tag)) violations.push(`${where}: @param ${tag} does not match any parameter (stale tag?).`);
}
function checkReturns(where, signature, returns, renderer, violations) {
	const type = renderer.renderType(signature.returns);
	if (type === "void" || type === "Promise<void>") return;
	if (returns === null) violations.push(`${where} is missing @returns (return type: ${type}).`);
	else if (returns.trim() === "") violations.push(`${where}: @returns has an empty description.`);
}
function reportViolations(gate, violations) {
	if (violations.length === 0) return;
	throw new Error(`${gate}: ${String(violations.length)} JSDoc completeness violation(s) (see AGENTS.md):\n` + violations.map((violation) => `  ${violation}`).join("\n"));
}
function pointer(location) {
	return `${location.file}:${String(location.line)}`;
}
function isMode(mode) {
	return mode === "emit" || mode === "waterfall" || mode === "parallel" || mode === "serial";
}
function signatureTypeNames(renderer, signature) {
	const names = /* @__PURE__ */ new Set();
	const visited = /* @__PURE__ */ new Set();
	const visitSignature = (current) => {
		for (const parameter of current.typeParameters) {
			if (parameter.constraint !== void 0) visit(parameter.constraint);
			if (parameter.default !== void 0) visit(parameter.default);
		}
		for (const parameter of current.parameters) visit(parameter.type);
		visit(current.returns);
	};
	const visitMember = (member) => {
		if (member.kind === "property") visit(member.type);
		else visitSignature(member.signature);
	};
	const visit = (id) => {
		if (visited.has(id)) return;
		visited.add(id);
		const node = renderer.node(id);
		if (node.kind === "reference" && node.target.kind !== "type-parameter") names.add(node.name);
		if (node.kind === "type-query") names.add(node.expression);
		for (const child of childTypeNodeIds(node)) visit(child);
		if (node.kind === "object") for (const member of node.members) visitMember(member);
		if (node.kind === "function" || node.kind === "constructor") visitSignature(node.signature);
	};
	visitSignature(signature);
	return [...names].sort();
}
/** Declarations longer than this render as a truncated stub. */
const MAX_DECL_CHARS = 1500;
/** Render one value as a single-quoted TypeScript literal. */
function quote(value) {
	return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll("\n", "\\n")}'`;
}
/** Resolve and sort the word-bounded transitive type closure referenced by seed text. */
function referencedTypes(seeds, declarations) {
	const included = /* @__PURE__ */ new Map();
	let frontier = [...seeds];
	while (frontier.length > 0) {
		const next = [];
		for (const [name, declaration] of declarations) {
			if (included.has(name)) continue;
			const pattern = new RegExp(`\\b${name}\\b`);
			if (frontier.some((text) => pattern.test(text))) {
				included.set(name, declaration);
				next.push(declaration);
			}
		}
		frontier = next;
	}
	return [...included].map(([name, declaration]) => ({
		name,
		declaration
	})).sort((left, right) => left.name.localeCompare(right.name));
}
function firstSentence(doc) {
	const line = doc.split("\n", 1)[0] ?? "";
	return (/^(.*?[.!?])(?:\s|$)/.exec(line)?.[1] ?? line).trim();
}
/** Render the byte-compatible model-facing API catalog. */
function renderRuntimeApi(services, events, types, inheritedServices) {
	const lines = [
		"/**",
		" * Generated by scripts/gen-cordis-api.ts — do not edit by hand; run",
		" * `pnpm run gen-cordis-api` to regenerate (freshness-gated by",
		" * `pnpm run verify-cordis-api` in doc-sync).",
		" *",
		" * The machine-readable cordis API catalog `cordis_inspect` serves to the",
		" * model: harness services (summary + public method signatures/JSDoc),",
		" * harness events (mode + signature/JSDoc), and the inherited `ctx` surface. Produced by",
		" * the same AST walk as docs/cordis-catalog, so this data and the rendered",
		" * docs cannot diverge.",
		" *",
		" * @module @deepseek-ai/dsh-tool-cordis/api-catalog",
		" */",
		"",
		"/** One public service method and its source-owned contract. */",
		"export interface ServiceApiMethod {",
		"  /** Public method signature with its body stripped. */",
		"  signature: string",
		"  /** Original method JSDoc, with only container indentation removed. */",
		"  jsDoc: string",
		"}",
		"",
		"/** One harness `ctx.<key>` service: its one-line summary and public methods. */",
		"export interface ServiceApiEntry {",
		"  /** The `ctx.<key>` name, e.g. `tools`. */",
		"  key: string",
		"  /** First sentence of the service class JSDoc. */",
		"  summary: string",
		"  /** Public methods, bodies stripped, in source order. */",
		"  methods: readonly ServiceApiMethod[]",
		"}",
		"",
		"/** One harness event: its dispatch mode, exact signature, and one-line summary. */",
		"export interface EventApiEntry {",
		"  /** The scoped event name, e.g. `agent/status`. */",
		"  name: string",
		"  /** The dispatch mode from the declaration's `@mode` tag. */",
		"  mode: string",
		"  /** The exact listener signature, whitespace-normalized. */",
		"  signature: string",
		"  /** Original event JSDoc, with only container indentation removed. */",
		"  jsDoc: string",
		"  /** First sentence of the event JSDoc. */",
		"  summary: string",
		"}",
		"",
		"/** One inherited (cordis core + loader/hmr/timer) `ctx` member group with its summary. */",
		"export interface InheritedApiEntry {",
		"  /** The `ctx` member name(s), e.g. `ctx.on / ctx.once`. */",
		"  name: string",
		"  /** One-line summary of what the member does. */",
		"  summary: string",
		"}",
		"",
		"/** One named type shape the service signatures reference. */",
		"export interface TypeApiEntry {",
		"  /** The exported type/interface name, e.g. `BashRunResult`. */",
		"  name: string",
		"  /** The full declaration text, comments stripped. */",
		"  declaration: string",
		"}",
		"",
		"/** Every harness `ctx.<key>` service, sorted by key. */",
		"export const SERVICE_API: readonly ServiceApiEntry[] = ["
	];
	for (const service of services) {
		lines.push("  {");
		lines.push(`    key: ${quote(service.key)},`);
		lines.push(`    summary: ${quote(firstSentence(service.doc))},`);
		if (service.methods.length === 0) lines.push("    methods: [],");
		else {
			lines.push("    methods: [");
			for (const method of service.methods) {
				lines.push("      {");
				lines.push(`        signature: ${quote(method.signature)},`);
				lines.push(`        jsDoc: ${quote(method.jsDoc)},`);
				lines.push("      },");
			}
			lines.push("    ],");
		}
		lines.push("  },");
	}
	lines.push("]", "", "/** Every harness event, sorted by name. */", "export const EVENT_API: readonly EventApiEntry[] = [");
	for (const event of [...events].sort((left, right) => left.name.localeCompare(right.name))) {
		lines.push("  {");
		lines.push(`    name: ${quote(event.name)},`);
		lines.push(`    mode: ${quote(event.mode)},`);
		lines.push(`    signature: ${quote(event.signature)},`);
		lines.push(`    jsDoc: ${quote(event.jsDoc)},`);
		lines.push(`    summary: ${quote(firstSentence(event.doc))},`);
		lines.push("  },");
	}
	lines.push("]", "", "/** Shapes of every exported type the SERVICE_API signatures reference (transitively), sorted by name. */", "export const TYPE_API: readonly TypeApiEntry[] = [");
	for (const type of types) {
		lines.push("  {");
		lines.push(`    name: ${quote(type.name)},`);
		lines.push(`    declaration: ${quote(type.declaration)},`);
		lines.push("  },");
	}
	lines.push("]", "", "/** The inherited `ctx` surface (cordis core + loader/hmr/timer), in curated order. */", "export const INHERITED_CTX_API: readonly InheritedApiEntry[] = [");
	for (const inherited of inheritedServices) lines.push(`  { name: ${quote(inherited.name)}, summary: ${quote(inherited.summary)} },`);
	lines.push("]", "");
	return lines.join("\n");
}
/** Render the cross-link "Types:" line for a signature, or '' if none apply. */
function typeLinks(signature, linkedTypePages) {
	const seen = /* @__PURE__ */ new Set();
	for (const name of Object.keys(linkedTypePages)) if (new RegExp(`\\b${name}\\b`).test(signature)) seen.add(name);
	if (seen.size === 0) return "";
	return `Types: ${[...seen].sort().map((n) => `[${n}](../core-data-structures/${linkedTypePages[n]})`).join(" · ")}`;
}
/** Render one harness event entry. */
function renderEvent(e, linkedTypePages) {
	const out = [`### \`${e.name}\` — ${e.mode}`, ""];
	if (e.doc) out.push(e.doc, "");
	out.push("```ts cordis-catalog", e.jsDoc, e.signature, "```", "");
	const links = typeLinks(e.signature, linkedTypePages);
	if (links) out.push(links, "");
	out.push(`Source: [\`${e.source}\`](../../${e.source.split(":")[0]})`, "");
	return out;
}
/** Render one harness service entry. */
function renderService(s, linkedTypePages) {
	const kind = s.abstract ? " (abstract seam)" : "";
	const out = [`## \`ctx.${s.key}\` — \`${s.type}\`${kind}`, ""];
	if (s.doc) out.push(s.doc, "");
	if (s.methods.length) {
		const declarations = s.methods.flatMap((method, index) => [
			...index > 0 ? [""] : [],
			method.jsDoc,
			method.signature
		]);
		out.push("```ts cordis-catalog", ...declarations, "```", "");
		const links = typeLinks(s.methods.map((method) => method.signature).join("\n"), linkedTypePages);
		if (links) out.push(links, "");
	}
	out.push(`Source: [\`${s.source}\`](../../${s.source.split(":")[0]})`, "");
	return out;
}
/** The shared generated-file banner comment. */
const BANNER = [
	"<!-- Generated by scripts/gen-cordis-catalog.ts — do not edit by hand.",
	"     Run `pnpm run gen-cordis-catalog` to regenerate. -->",
	""
];
/** The shared GENERATED + freshness-gate + fence notice paragraph. */
const GATE_NOTICE = "This file is GENERATED from source (`scripts/gen-cordis-catalog.ts`) and verified fresh by `pnpm run verify-cordis-catalog` (part of `doc-sync`) — do not edit it by hand. Signature blocks use a `ts cordis-catalog` fence and include the original source JSDoc immediately before each event or service method. doc-typecheck skips these bare declaration fragments; type names in a signature link to the page that documents them.";
/**
* Render the events catalog deterministically.
* @param events - validated event entries to render.
* @param policy - type links and inherited events supplied by the caller.
* @returns the complete generated Markdown document.
*/
function renderEvents(events, policy) {
	const lines = [
		...BANNER,
		"# Cordis Events Catalog",
		"",
		"Every cordis event a plugin can listen to: exact signature, dispatch mode, and original declaration JSDoc. This is one axis of the **wiring** reference a plugin author works against — the callable `ctx.<key>` surface is the sibling [services catalog](services.md), and [core-data-structures/](../core-data-structures/core.md) catalogs the *data structures* these signatures move around.",
		"",
		GATE_NOTICE,
		"",
		"The **harness tier** below (the `@deepseek-ai/dsh-*` packages) is the vocabulary this repo owns, grouped by scope. The **inherited tier** at the end is the cordis-core + loader/hmr/timer event surface a plugin also sees — pinned vendor source, summarized tersely. The event-dispatch methods themselves are generated in the [Cordis core Events API](core/events.md).",
		"",
		"Dispatch modes: **emit** (fire-and-forget), **waterfall** (each listener gets `next()` and may transform or veto — see [waterfall semantics](../cordis-primer.md#cordis-waterfall-semantics)), **parallel** (awaited fan-out; all listeners run), **serial** (awaited in registration order until one returns a bail value — anything other than `null`, `false`, or `undefined`).",
		""
	];
	const scopes = [...new Set(events.map((e) => e.scope))].sort();
	for (const scope of scopes) {
		lines.push(`## \`${scope}/*\``, "");
		for (const e of events.filter((x) => x.scope === scope).sort((a, b) => a.name.localeCompare(b.name))) lines.push(...renderEvent(e, policy.linkedTypePages));
	}
	lines.push("## Inherited events (cordis core + loader/hmr/timer)", "", "The framework events every plugin also sees, beyond the harness vocabulary above. This is pinned vendor source ([vendoring policy](../../vendor/README.md)); it is summarized here so the page is a complete picture of the event bus, without elevating framework internals to the harness tier's prominence.", "");
	for (const e of policy.inheritedEvents) lines.push(`- \`${e.name}\` — ${e.summary} ([\`${e.source}\`](../../${e.source.split(":")[0]}))`);
	lines.push("");
	return lines.join("\n");
}
/**
* Render the services catalog deterministically.
* @param services - validated service entries to render.
* @param policy - type links and inherited services supplied by the caller.
* @returns the complete generated Markdown document.
*/
function renderServices(services, policy) {
	const lines = [
		...BANNER,
		"# Cordis Services Catalog",
		"",
		"Every `ctx.<key>` service a plugin can call: the exact public interface with original method JSDoc, plus the class JSDoc. This is one axis of the **wiring** reference a plugin author works against — the events a plugin listens to are the sibling [events catalog](events.md), and [core-data-structures/](../core-data-structures/core.md) catalogs the *data structures* these signatures move around. An abstract seam (e.g. `ctx.bash`) is implemented by a separate package; the interface is what consumers code against.",
		"",
		GATE_NOTICE,
		"",
		"The **harness tier** below (the `@deepseek-ai/dsh-*` packages) is the vocabulary this repo owns. The **inherited tier** at the end is the cordis-core + loader/hmr/timer `ctx` surface a plugin also sees — pinned vendor source, summarized tersely. Detailed Context, Fiber, Registry, and Service APIs are generated in the [Cordis core API](core/context.md).",
		""
	];
	for (const s of services) lines.push(...renderService(s, policy.linkedTypePages));
	lines.push("## Inherited `ctx` members (cordis core + loader/hmr/timer)", "", "The framework `ctx` surface every plugin also sees, beyond the harness services above. This is pinned vendor source ([vendoring policy](../../vendor/README.md)); it is summarized here so the page is a complete picture of what `ctx` offers, without elevating framework internals to the harness tier's prominence.", "");
	for (const s of policy.inheritedServices) lines.push(`- \`${s.name}\` — ${s.summary} ([\`${s.source}\`](../../${s.source.split(":")[0]}))`);
	lines.push("");
	return lines.join("\n");
}
//#endregion
//#region lib/types/workspace.js
/**
* Workspace-level discovery and model-driven Typert generation.
* @module @deepseek-ai/dsh-typert-generator/workspace
*/
/** Discover, analyze, and emit package reflection from independent faces. */
var WorkspaceTypertGenerator = class {
	root;
	/**
	* Bind generation to one workspace root.
	* @param root - directory containing face aggregate tsconfigs.
	*/
	constructor(root) {
		this.root = root;
	}
	/**
	* Find public package faces that contribute Cordis services/events or
	* explicitly tagged Typert roots.
	* @returns discovered packages in stable package-name order.
	*/
	discover() {
		return new WorkspaceAnalyzer({ root: this.root }).discoverPackages();
	}
	/**
	* Generate all discovered contributors, or an explicit package subset.
	* @param packages - optional exact package names for a focused pass.
	* @returns one artifact per package face.
	*/
	generate(packages) {
		const selected = packages ?? this.discover().map((candidate) => candidate.package);
		const workspace = new WorkspaceAnalyzer({
			root: this.root,
			packages: selected
		}).analyze();
		const artifacts = [];
		for (const face of workspace.faces) {
			const emitter = new FaceModelEmitter(face);
			for (const packageModel of face.packages) {
				const artifact = {
					...emitter.emit(packageModel.name),
					packageRoot: packageModel.root
				};
				this.validateExport(artifact);
				artifacts.push(artifact);
			}
		}
		return artifacts;
	}
	validateExport(artifact) {
		const manifestPath = resolve(this.root, artifact.packageRoot, "package.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
		const subpath = artifact.face === "host" ? "./typert" : "./client/typert";
		const expected = {
			types: `./lib/typert.${artifact.face}.d.ts`,
			default: `./lib/typert.${artifact.face}.js`
		};
		if (!sameExport(manifest.exports !== null && typeof manifest.exports === "object" ? manifest.exports[subpath] : void 0, expected)) throw new TypertAnalysisError(`typert(${artifact.face}): ${artifact.package} must export ${subpath} as ${JSON.stringify(expected)}`);
		const files = !Array.isArray(manifest.files) ? [] : manifest.files;
		for (const file of [`lib/typert.${artifact.face}.js`, `lib/typert.${artifact.face}.d.ts`]) if (!files.includes(file)) throw new TypertAnalysisError(`typert(${artifact.face}): ${artifact.package} package files must include ${file}`);
	}
};
function sameExport(actual, expected) {
	if (actual === null || typeof actual !== "object" || Array.isArray(actual)) return false;
	const value = actual;
	return value.types === expected.types && value.default === expected.default;
}
//#endregion
export { CordisCatalogProjector, FaceModelEmitter, TypeGraphRenderError, TypeGraphRenderer, TypertAnalysisError, TypertEmitError, WorkspaceAnalyzer, WorkspaceCaches, WorkspaceTypertGenerator, collectEvents, collectServices, projectCordisCatalog, renderEvents, renderServices };
