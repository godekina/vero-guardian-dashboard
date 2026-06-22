import '@testing-library/jest-dom';
import './src/i18n/config';
import { installIndexedDBMock } from './test-utils/indexeddb-mock';

// Mock File System Access API (showSaveFilePicker)
if (typeof globalThis.window === 'undefined') {
	// running in node - provide a minimal window and document
	globalThis.window = globalThis;
}

if (!('showSaveFilePicker' in globalThis)) {
	globalThis.showSaveFilePicker = async (options = {}) => {
		const chunks = [];
		return {
			createWritable: async () => ({
				write: async (data) => {
					// accept Blob or write request
					if (data instanceof Blob) {
						const array = new Uint8Array(await data.arrayBuffer());
						chunks.push(array);
					} else if (data && data.data instanceof Blob) {
						const array = new Uint8Array(await data.data.arrayBuffer());
						chunks.push(array);
					}
				},
				close: async () => {},
			}),
		};
	};
}

// Install enhanced IndexedDB mock for tests
try {
	installIndexedDBMock();
} catch (e) {
	// ignore if already installed or environment prevents it
}
