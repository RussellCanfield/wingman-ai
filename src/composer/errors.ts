export class NoFilesChangedError extends Error {
	public errorCode: number;

	constructor(message: string, errorCode: number = 500) {
		super(message);
		this.name = "CustomError";
		this.errorCode = errorCode;

		// Set the prototype explicitly to maintain the instanceof behavior
		Object.setPrototypeOf(this, NoFilesChangedError.prototype);
	}

	public getErrorCode(): number {
		return this.errorCode;
	}
}
