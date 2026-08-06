import { existsSync as fsExistsSync, readFileSync as fsReadFileSync, writeFileSync as fsWriteFileSync, mkdirSync } from "node:fs";
import { mkdir as fsMkdir, readFile as fsReadFile, rm as fsRm } from "node:fs/promises";
import { dirname } from "node:path";
import { loadEnvFile as processLoadEnvFile } from "node:process";
import { logger } from "./logger.js";

export function existsSync(path: string): boolean {
	return fsExistsSync(path);
}

export function readFileSync(path: string): string {
	return fsReadFileSync(path, "utf8");
}

export function writeFileSync(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	logger.log({ message: `Writing file: ${path}` });
	fsWriteFileSync(path, content);
}

export async function readFile(path: string): Promise<string> {
	return await fsReadFile(path, "utf8");
}

export async function mkdir(path: string): Promise<void> {
	await fsMkdir(path, { recursive: true });
}

export async function rm(path: string): Promise<void> {
	await fsRm(path, { force: true });
}

export function loadEnvFile(path: string): void {
	processLoadEnvFile(path);
}
