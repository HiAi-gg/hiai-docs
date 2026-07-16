let dirty = $state(false);
let reason = $state<string | null>(null);

export const pwaDirtyState = {
	get dirty() {
		return dirty;
	},
	get reason() {
		return reason;
	},
	mark(value: boolean, why = "Unsaved changes") {
		dirty = value;
		reason = value ? why : null;
	},
};
