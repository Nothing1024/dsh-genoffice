import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
//#region lib/types/repository.js
/**
* Exact-specifier repository packages installed through the Loader's bundled
* pnpm. The caller owns source validation and the cache root; this module owns
* isolated installation, single-flight reuse, and atomic cache publication.
*/
/** Exact pnpm release shipped with the Loader for repository installation. */
const BUNDLED_PNPM_VERSION = "11.7.0";
const DEPENDENCY_NAME = "repository";
const MARKER_NAME = ".repository-cache.json";
const MAX_ERROR_OUTPUT = 32 * 1024;
const SENSITIVE_ENV_PATTERN = /KEY|PASSWORD|SECRET|TOKEN/i;
function scrubEnvironment(environment = process.env) {
	return Object.fromEntries(Object.entries(environment).filter(([name]) => !SENSITIVE_ENV_PATTERN.test(name)));
}
function appendOutput(current, chunk) {
	const combined = current + Buffer.from(chunk).toString("utf8");
	return combined.length <= MAX_ERROR_OUTPUT ? combined : combined.slice(-32768);
}
async function installWithBundledPnpm(directory) {
	const pnpmBin = join(dirname(createRequire(import.meta.url).resolve("pnpm")), "bin", "pnpm.mjs");
	let output = "";
	const result = await new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [
			pnpmBin,
			"install",
			"--no-frozen-lockfile",
			"--reporter=append-only"
		], {
			cwd: directory,
			env: scrubEnvironment(),
			shell: false,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		child.stdout.on("data", (chunk) => {
			output = appendOutput(output, chunk);
		});
		child.stderr.on("data", (chunk) => {
			output = appendOutput(output, chunk);
		});
		child.once("error", reject);
		child.once("close", (code, signal) => {
			resolve({
				code,
				signal
			});
		});
	});
	if (result.signal !== null) throw new Error(`bundled pnpm install was killed by ${result.signal}${output ? `\n${output.trimEnd()}` : ""}`);
	if (result.code !== 0) throw new Error(`bundled pnpm install exited with code ${String(result.code)}${output ? `\n${output.trimEnd()}` : ""}`);
}
function cacheKey(specifier) {
	return createHash("sha256").update(specifier).digest("hex");
}
async function readCached(directory, specifier) {
	let content;
	try {
		content = await readFile(join(directory, MARKER_NAME), "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return;
		throw error;
	}
	let parsed;
	try {
		parsed = JSON.parse(content);
	} catch (error) {
		throw new Error(`repository cache marker is invalid: ${join(directory, MARKER_NAME)}`, { cause: error });
	}
	if (typeof parsed !== "object" || parsed === null || typeof parsed.specifier !== "string") throw new Error(`repository cache marker is invalid: ${join(directory, MARKER_NAME)}`);
	if (parsed.specifier !== specifier) throw new Error(`repository cache key collision for ${JSON.stringify(specifier)}`);
	const packageDirectory = join(directory, "node_modules", DEPENDENCY_NAME);
	let packageStat;
	try {
		packageStat = await stat(packageDirectory);
	} catch (error) {
		throw new Error(`repository cache entry is incomplete: ${directory}`, { cause: error });
	}
	if (!packageStat.isDirectory()) throw new Error(`repository cache package is not a directory: ${packageDirectory}`);
	return packageDirectory;
}
async function removeStaging(directory, cause) {
	try {
		await rm(directory, {
			recursive: true,
			force: true
		});
	} catch (cleanupError) {
		throw new AggregateError([cause, cleanupError], `failed to clean repository staging directory ${directory}`);
	}
	throw cause;
}
/**
* Persistent exact-specifier package cache backed by bundled pnpm.
*
* One isolated project contains one dependency named `repository`. A successful
* install is atomically renamed into its SHA-256 key, so failed installs never
* become cache hits. The exact specifier is immutable: callers change the
* specifier (normally its Git ref) to request another generation.
*/
var RepositoryCache = class {
	install;
	/** Absolute directory containing immutable repository cache entries. */
	directory;
	tasks = /* @__PURE__ */ new Map();
	/**
	* @param directory - caller-owned persistent cache root.
	* @param install - isolated package installation boundary; defaults to the bundled pnpm.
	*/
	constructor(directory, install = installWithBundledPnpm) {
		this.install = install;
		this.directory = resolve(directory);
	}
	/**
	* Resolve one package-manager-native dependency specifier to its installed package directory.
	* @param specifier - exact immutable dependency specifier used as the permanent cache identity.
	* @returns the installed `repository` dependency directory.
	* @throws when the specifier is empty/padded, installation fails, or a published cache entry is corrupt.
	*/
	resolve(specifier) {
		if (!specifier || specifier.trim() !== specifier) throw new TypeError("repository specifier must be a non-empty unpadded string");
		const existing = this.tasks.get(specifier);
		if (existing) return existing;
		const task = this.resolveUncached(specifier).finally(() => {
			if (this.tasks.get(specifier) === task) this.tasks.delete(specifier);
		});
		this.tasks.set(specifier, task);
		return task;
	}
	async resolveUncached(specifier) {
		const finalDirectory = join(this.directory, cacheKey(specifier));
		const cached = await readCached(finalDirectory, specifier);
		if (cached) return cached;
		await mkdir(this.directory, { recursive: true });
		const staging = await mkdtemp(join(this.directory, ".repository-"));
		try {
			await writeFile(join(staging, "package.json"), `${JSON.stringify({
				name: "cordis-repository-cache-entry",
				private: true,
				version: "0.0.0",
				packageManager: `pnpm@${BUNDLED_PNPM_VERSION}`,
				dependencies: { [DEPENDENCY_NAME]: specifier }
			}, void 0, 2)}\n`);
			await writeFile(join(staging, "pnpm-workspace.yaml"), [
				"packages: []",
				"dangerouslyAllowAllBuilds: true",
				""
			].join("\n"));
			await this.install(staging);
			const packageDirectory = join(staging, "node_modules", DEPENDENCY_NAME);
			if (!(await stat(packageDirectory)).isDirectory()) throw new Error(`installed repository is not a directory: ${packageDirectory}`);
			await writeFile(join(staging, MARKER_NAME), `${JSON.stringify({ specifier })}\n`);
			try {
				await rename(staging, finalDirectory);
			} catch (error) {
				const winner = await readCached(finalDirectory, specifier);
				if (!winner) throw error;
				await rm(staging, {
					recursive: true,
					force: true
				});
				return winner;
			}
		} catch (error) {
			return removeStaging(staging, new Error(`failed to prepare repository ${JSON.stringify(specifier)}`, { cause: error }));
		}
		return await readCached(finalDirectory, specifier);
	}
};
//#endregion
export { BUNDLED_PNPM_VERSION, RepositoryCache };
