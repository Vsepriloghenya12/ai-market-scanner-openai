"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = exports.StorageService = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const config_1 = require("../config");
const defaultAnalyzerState = {
    lastRunAt: null,
    isRunning: false,
    runCount: 0,
    lastError: null
};
const ensureStorageDir = () => {
    const directory = node_path_1.default.dirname(config_1.config.storageFile);
    if (!node_fs_1.default.existsSync(directory)) {
        node_fs_1.default.mkdirSync(directory, { recursive: true });
    }
};
const defaultState = () => ({
    signals: [],
    analyzer: { ...defaultAnalyzerState }
});
class StorageService {
    state;
    constructor() {
        ensureStorageDir();
        this.state = this.load();
    }
    load() {
        if (!node_fs_1.default.existsSync(config_1.config.storageFile)) {
            const initial = defaultState();
            node_fs_1.default.writeFileSync(config_1.config.storageFile, JSON.stringify(initial, null, 2), 'utf-8');
            return initial;
        }
        try {
            const raw = node_fs_1.default.readFileSync(config_1.config.storageFile, 'utf-8');
            const parsed = JSON.parse(raw);
            return {
                signals: parsed.signals ?? [],
                analyzer: {
                    ...defaultAnalyzerState,
                    ...(parsed.analyzer ?? {})
                }
            };
        }
        catch (error) {
            console.error('Failed to read storage file, using defaults.', error);
            return defaultState();
        }
    }
    persist() {
        node_fs_1.default.writeFileSync(config_1.config.storageFile, JSON.stringify(this.state, null, 2), 'utf-8');
    }
    getSignals() {
        return [...this.state.signals].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    }
    saveSignal(signal) {
        this.state.signals.unshift(signal);
        this.state.signals = this.state.signals.slice(0, config_1.config.historyLimit);
        this.persist();
    }
    getAnalyzerState() {
        return { ...this.state.analyzer };
    }
    updateAnalyzerState(nextState) {
        this.state.analyzer = {
            ...this.state.analyzer,
            ...nextState
        };
        this.persist();
    }
}
exports.StorageService = StorageService;
exports.storageService = new StorageService();
