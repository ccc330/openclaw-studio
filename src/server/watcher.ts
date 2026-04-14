import fs from 'fs';
import path from 'path';
import { getWatchPaths } from './scanner.js';

type ChangeCallback = (filePath: string) => void;

export class FileWatcher {
  private watchers = new Map<string, fs.FSWatcher>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private onChange: ChangeCallback;

  constructor(onChange: ChangeCallback) {
    this.onChange = onChange;
  }

  start() {
    this.refresh();
  }

  /** Re-scan watch paths and add watchers for new directories */
  refresh() {
    const paths = new Set(getWatchPaths());

    // Remove watchers for paths no longer needed
    for (const [watchPath, watcher] of this.watchers) {
      if (!paths.has(watchPath)) {
        watcher.close();
        this.watchers.delete(watchPath);
      }
    }

    // Add watchers for new paths
    for (const watchPath of paths) {
      if (this.watchers.has(watchPath)) continue;
      try {
        const watcher = fs.watch(watchPath, { recursive: false }, (_event, filename) => {
          if (!filename) return;
          const fullPath = path.join(watchPath, filename);
          this.debounce(fullPath);
        });
        this.watchers.set(watchPath, watcher);
      } catch {
        // path may not exist
      }
    }
  }

  private debounce(filePath: string) {
    const existing = this.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      filePath,
      setTimeout(() => {
        this.debounceTimers.delete(filePath);
        this.onChange(filePath);
      }, 300),
    );
  }

  stop() {
    for (const w of this.watchers.values()) w.close();
    this.watchers.clear();
    for (const t of this.debounceTimers.values()) clearTimeout(t);
    this.debounceTimers.clear();
  }
}
