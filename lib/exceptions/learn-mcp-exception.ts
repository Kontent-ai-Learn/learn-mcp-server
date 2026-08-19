export type LearnMcpExceptionType = "syncAlreadyRunning" | "unauthorized";

export class LearnMcpExceptionError extends Error {
	public readonly type: LearnMcpExceptionType;

	public constructor(type: LearnMcpExceptionType, message: string) {
		super(message);
		this.name = "LearnMcpExceptionError";
		this.type = type;
	}
}
