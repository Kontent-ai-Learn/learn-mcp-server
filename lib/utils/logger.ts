import { tryCatchAsync } from "@kontent-ai/core-sdk";
import cliSpinners from "cli-spinners";
import { match } from "ts-pattern";

export type LogType = "info" | "warning" | "error" | "process" | "completed";
export type LogData = { readonly message: string; readonly type?: LogType };
export type SpinnerLog = (data: LogData) => void;
export type Logger = {
	readonly log: (data: LogData) => void;
	readonly logWithSpinnerAsync: <T>(operation: (spinner: SpinnerLog) => Promise<T>) => Promise<T>;
};

export const logger: Logger = {
	log: (data) => console.log(format(data)),
	logWithSpinnerAsync: async (operation) => {
		// No interactive terminal (MCP stdio host, pipes, CI, tests): emit plain stderr lines.
		if (!process.stderr.isTTY) {
			return operation((data) => console.log(format(data)));
		}

		const { frames, interval } = cliSpinners.dots;
		const state = { frame: 0, text: "" };
		const render = (): void => {
			const frame = frames[state.frame % frames.length] ?? "";
			state.frame += 1;
			process.stderr.write(`\r${frame} ${state.text}`);
		};
		const timer = setInterval(render, interval);
		const { success, error, data } = await tryCatchAsync(async () => {
			const result = await operation((data) => {
				state.text = data.message;
				render();
			});
			clearInterval(timer);
			process.stderr.write(`\r${state.text}\n`);
			return result;
		});

		if (!success) {
			clearInterval(timer);
			process.stderr.write(`\r${state.text}\n`);
			throw error;
		}

		return data;
	},
};

function format({ message, type }: LogData): string {
	const symbol = match(type)
		.with("info", undefined, () => "")
		.with("warning", () => "⚠ ")
		.with("error", () => "✖ ")
		.with("process", () => "⏳ ")
		.with("completed", () => "✔ ")
		.exhaustive();
	return `${symbol}${message}`;
}
