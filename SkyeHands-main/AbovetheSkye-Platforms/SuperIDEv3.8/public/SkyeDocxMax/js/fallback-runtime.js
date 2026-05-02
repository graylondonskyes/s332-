(function () {
  if (!window.DOMPurify) {
    window.DOMPurify = {
      sanitize(value) {
        return String(value || "");
      },
    };
  }

  if (!window.lucide) {
    window.lucide = {
      createIcons() {},
    };
  }

  if (!window.JSZip) {
    window.JSZip = class SkyeDocxMaxZipFallback {
      constructor() {
        this.files = [];
      }

      file(path, content) {
        this.files.push({ path, content: String(content || "") });
        return this;
      }

      async generateAsync() {
        const manifest = {
          app_id: "SkyeDocxMax",
          fallback_zip: true,
          generated_at: new Date().toISOString(),
          files: this.files.map((file) => ({ path: file.path, size: file.content.length })),
        };
        const body = [
          "SkyeDocxMax fallback export package",
          "",
          JSON.stringify(manifest, null, 2),
          "",
          ...this.files.map((file) => `--- ${file.path} ---\n${file.content}`),
        ].join("\n");
        return new Blob([body], { type: "text/plain;charset=utf-8" });
      }
    };
  }

  if (window.Quill) return;

  class FallbackQuill {
    constructor(selector) {
      const host = typeof selector === "string" ? document.querySelector(selector) : selector;
      if (!host) throw new Error("Editor container was not found.");
      host.innerHTML = "";
      const editor = document.createElement("div");
      editor.className = "ql-editor skye-fallback-editor";
      editor.contentEditable = "true";
      editor.spellcheck = true;
      editor.innerHTML = "<p><br></p>";
      host.appendChild(editor);
      this.root = editor;
      this.handlers = {};
      this.clipboard = {
        dangerouslyPasteHTML: (...args) => {
          const html = args.length > 1 ? args[1] : args[0];
          this.root.innerHTML = String(html || "");
          this.emit("text-change", {}, {}, "api");
        },
      };
      this.history = { clear() {} };
      this.root.addEventListener("input", () => this.emit("text-change", {}, {}, "user"));
    }

    on(eventName, handler) {
      if (!this.handlers[eventName]) this.handlers[eventName] = [];
      this.handlers[eventName].push(handler);
    }

    emit(eventName, ...args) {
      for (const handler of this.handlers[eventName] || []) handler(...args);
    }

    getText(index = 0, length) {
      const text = this.root.innerText || "";
      return typeof length === "number" ? text.slice(index, index + length) : text.slice(index);
    }

    getLength() {
      return this.getText().length;
    }

    getSelection() {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !this.root.contains(selection.anchorNode)) {
        return { index: this.getLength(), length: 0 };
      }
      return { index: 0, length: String(selection.toString() || "").length };
    }

    setSelection() {}

    focus() {
      this.root.focus();
    }

    format(command, value) {
      try {
        document.execCommand(command, false, value);
      } catch {}
    }

    formatText() {}

    getFormat() {
      return {};
    }

    insertText(index, text) {
      this.root.textContent = `${this.getText(0, index)}${text}${this.getText(index)}`;
      this.emit("text-change", {}, {}, "api");
    }

    deleteText(index, length) {
      const text = this.getText();
      this.root.textContent = `${text.slice(0, index)}${text.slice(index + length)}`;
      this.emit("text-change", {}, {}, "api");
    }

    insertEmbed(_index, type, value) {
      if (type === "image") {
        const image = document.createElement("img");
        image.src = value;
        image.alt = "";
        this.root.appendChild(image);
        this.emit("text-change", {}, {}, "api");
      }
    }

    getModule() {
      return {
        addHandler() {},
      };
    }
  }

  window.Quill = FallbackQuill;
})();
