import { Logger } from "cordis";
import { Time } from "cosmokit";
import z from "schemastery";
//#region lib/types/shared.js
/** Shared console log exporter implementation used by Node and browser builds. */
var ConsoleExporter$1 = class {
	ctx;
	static name = "logger-console";
	static Config = z.object({
		colors: z.union([z.const(false), z.number()]),
		maxLength: z.number(),
		levels: z.dict(z.number()),
		showDiff: z.boolean().default(false),
		showTime: z.string().default("yyyy-MM-dd hh:mm:ss "),
		label: z.object({
			width: z.number(),
			margin: z.number(),
			align: z.union(["left", "right"])
		})
	});
	colors;
	maxLength;
	levels;
	showDiff;
	showTime;
	label;
	timestamp;
	formatters = {};
	constructor(ctx, config = {}) {
		this.ctx = ctx;
		Object.assign(this, this.getDefaults(), config);
		this.timestamp = Date.now();
		ctx.logger.exporter(this);
	}
	getDefaults() {
		return {
			colors: false,
			showTime: "yyyy-MM-dd hh:mm:ss ",
			showDiff: false
		};
	}
	export(message) {
		console.log(this.render(message));
	}
	render(message) {
		const prefix = `[${message.type[0].toUpperCase()}]`;
		const space = " ".repeat(this.label?.margin ?? 1);
		let indent = 3 + space.length, output = "";
		if (this.showTime) {
			indent += this.showTime.length;
			output += Logger.color(this, 8, Time.template(this.showTime));
		}
		const code = Logger.code(message.name, this.colors);
		const label = Logger.color(this, code, message.name, ";1");
		const padLength = (this.label?.width ?? 0) + label.length - message.name.length;
		if (this.label?.align === "right") {
			output += label.padStart(padLength) + space + prefix + space;
			indent += (this.label.width ?? 0) + space.length;
		} else output += prefix + space + label.padEnd(padLength) + space;
		output += Logger.format(this, message).replace(/\n/g, "\n" + " ".repeat(indent));
		if (this.showDiff && this.timestamp) {
			const diff = message.ts - this.timestamp;
			output += Logger.color(this, code, " +" + Time.format(diff));
		}
		this.timestamp = message.ts;
		return output;
	}
};
//#endregion
//#region lib/types/browser.js
/** Browser console exporter that dispatches to native console methods. */
var ConsoleExporter = class extends ConsoleExporter$1 {
	export(message) {
		const prefix = `[${message.type[0].toUpperCase()}] ${message.name}`;
		const method = message.type === "error" ? "error" : message.type === "warn" ? "warn" : "log";
		console[method](prefix, ...message.args);
	}
};
//#endregion
export { ConsoleExporter, ConsoleExporter as default };
