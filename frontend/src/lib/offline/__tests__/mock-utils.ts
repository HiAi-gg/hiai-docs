export interface BunMockFunction {
	mockReset(): void;
	mockResolvedValue(value: unknown): void;
	mockRejectedValue(error: unknown): void;
	mockImplementation(implementation: (...args: never[]) => unknown): void;
	mock: { calls: unknown[][] };
}

export function asBunMock(value: unknown): BunMockFunction {
	return value as BunMockFunction;
}
